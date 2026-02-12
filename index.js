const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// MySQL connection with multipleStatements enabled
const db = mysql.createConnection({
  host: "vlai-rds.cb40uq8wcu0z.ap-south-1.rds.amazonaws.com",
  user: "admin",
  password: "vlai27735",
  database: "skvt_mngt",
  timezone: "+05:30",
  multipleStatements: true,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection error:", err);
    throw err;
  }
  console.log("MySQL Connected.");
});

app.get("/", (req, res) => {
  res.send("Welcome to the SKVT Management API");
});

app.get("/api/stats", (req, res) => {
  const query = `
    SET SESSION time_zone = '+05:30';
    SELECT 
      (SELECT COUNT(*) FROM Departments) AS total_departments,
      (SELECT COUNT(DISTINCT sa.employee_id)
       FROM ShiftAssignments sa
       JOIN Shifts s ON sa.shift_id = s.shift_id
       WHERE CURDATE() BETWEEN sa.start_date AND COALESCE(sa.end_date, sa.specific_date, '9999-12-31')
       AND (
         (s.end_time > s.start_time AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time)
         OR
         (s.end_time <= s.start_time AND 
          (
            (CURDATE() = sa.start_date AND CURRENT_TIME() >= s.start_time) OR
            (CURDATE() = DATE_ADD(sa.start_date, INTERVAL 1 DAY) AND CURRENT_TIME() < s.end_time)
          )
         )
       )) AS active_employees,
      (SELECT COUNT(*) FROM Users WHERE role = 'Employee') AS total_employees,
      (SELECT COUNT(*) FROM DutyPoints) AS total_duty_points,
      (SELECT COUNT(*) FROM Shifts) AS total_shifts;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching stats:", err);
      return res.status(500).json({ error: "Error fetching stats", details: err.message });
    }
    const stats = results[1][0]; // Access the SELECT result from multi-statement query
    res.json({
      total_departments: stats.total_departments,
      active_employees: stats.active_employees,
      total_employees: stats.total_employees,
      total_duty_points: stats.total_duty_points,
      total_shifts: stats.total_shifts
    });
  });
});

// API 0.1: Create a new user
app.post("/api/users", async (req, res) => {
  const { name, phone, email, password, role, department_id } = req.body;
  if (!["SuperAdmin", "DepartmentAdmin", "Employee"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  if (role === "Employee" && !department_id) {
    return res.status(400).json({ error: "Department ID is required for employees" });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      "SET SESSION time_zone = '+05:30'; INSERT INTO Users (name, phone, email, password, role, department_id) VALUES (?, ?, ?, ?, ?, ?)",
      [name, phone, email, hashedPassword, role, department_id || null],
      (err, result) => {
        if (err) {
          console.error("Error creating user:", err);
          return res.status(500).json({ error: "Error creating user", details: err.message });
        }
        res.status(201).json({ message: "User created successfully", user_id: result[1].insertId });
      }
    );
  } catch (err) {
    console.error("Error hashing password:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// API: Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  db.query(
    "SET SESSION time_zone = '+05:30'; SELECT * FROM Users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error("Error fetching user:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
      }
      if (results[1].length === 0) return res.status(401).json({ error: "User not found" });
      const user = results[1][0];
      try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid password" });
        const userResponse = {
          id: user.user_id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: true,
          createdAt: user.created_at.toISOString()
        };
        if (user.department_id !== null) {
          userResponse.departmentId = user.department_id.toString();
        }
        res.status(200).json({ message: "Logged in successfully", user: userResponse });
      } catch (err) {
        console.error("Error comparing passwords:", err);
        res.status(500).json({ error: "Server error", details: err.message });
      }
    }
  );
});

// // API: Get all users with filters
// app.get("/api/users", (req, res) => {
//   const { role, department_id, shift_id, duty_point_id, user_id, name, page = 1, limit = 10 } = req.query;
//   const pageNum = parseInt(page, 10);
//   const limitNum = parseInt(limit, 10);

//   if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
//     return res.status(400).json({ error: "Invalid page or limit parameters" });
//   }

//   const offset = (pageNum - 1) * limitNum;

//   // Base query for counting total records with time zone set
//   let countQuery = `
//     SET SESSION time_zone = '+05:30';
//     SELECT COUNT(DISTINCT u.user_id) AS total
//     FROM Users u
//     LEFT JOIN ShiftAssignments sa ON u.user_id = sa.employee_id
//     WHERE 1=1
//   `;
//   const countParams = [];

//   // Base query for fetching paginated data with time zone set
//   let dataQuery = `
//     SET SESSION time_zone = '+05:30';
//     SELECT 
//       u.user_id, 
//       u.name, 
//       u.email, 
//       u.phone, 
//       u.role, 
//       u.department_id,
//       d.name AS department_name,
//       sa.shift_id,
//       s.name AS shift_name,
//       s.start_time,
//       s.end_time,
//       sa.duty_point_id,
//       dp.name AS duty_point_name,
//       sa.start_date AS from_date,
//       COALESCE(sa.end_date, sa.specific_date) AS to_date,
//       CASE 
//         WHEN sa.shift_id IS NULL OR sa.duty_point_id IS NULL THEN false
//         WHEN CURDATE() BETWEEN sa.start_date AND COALESCE(sa.end_date, sa.specific_date, '9999-12-31')
//         AND (
//           (s.end_time > s.start_time AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time)
//           OR
//           (s.end_time <= s.start_time AND 
//            (
//              (CURDATE() = sa.start_date AND CURRENT_TIME() >= s.start_time) OR
//              (CURDATE() = DATE_ADD(sa.start_date, INTERVAL 1 DAY) AND CURRENT_TIME() < s.end_time)
//            )
//           )
//         ) THEN true
//         ELSE false
//       END AS active
//     FROM Users u
//     LEFT JOIN Departments d ON u.department_id = d.department_id
//     LEFT JOIN ShiftAssignments sa ON u.user_id = sa.employee_id
//     LEFT JOIN Shifts s ON sa.shift_id = s.shift_id
//     LEFT JOIN DutyPoints dp ON sa.duty_point_id = dp.duty_point_id
//     WHERE 1=1
//   `;
//   const dataParams = [];

//   // Apply filters to both queries
//   if (role) {
//     countQuery += " AND u.role = ?";
//     dataQuery += " AND u.role = ?";
//     countParams.push(role);
//     dataParams.push(role);
//   }
//   if (department_id) {
//     countQuery += " AND u.department_id = ?";
//     dataQuery += " AND u.department_id = ?";
//     countParams.push(department_id);
//     dataParams.push(department_id);
//   }
//   if (shift_id) {
//     countQuery += " AND sa.shift_id = ?";
//     dataQuery += " AND sa.shift_id = ?";
//     countParams.push(shift_id);
//     dataParams.push(shift_id);
//   }
//   if (duty_point_id) {
//     countQuery += " AND sa.duty_point_id = ?";
//     dataQuery += " AND sa.duty_point_id = ?";
//     countParams.push(duty_point_id);
//     dataParams.push(duty_point_id);
//   }
//   if (user_id) {
//     countQuery += " AND u.user_id = ?";
//     dataQuery += " AND u.user_id = ?";
//     countParams.push(user_id);
//     dataParams.push(user_id);
//   }
//   if (name) {
//     countQuery += " AND u.name LIKE ?";
//     dataQuery += " AND u.name LIKE ?";
//     countParams.push(`%${name}%`);
//     dataParams.push(`%${name}%`);
//   }

//   // Add pagination to data query
//   dataQuery += ` LIMIT ? OFFSET ?`;
//   dataParams.push(limitNum, offset);

//   // Execute count query
//   db.query(countQuery, countParams, (countErr, countResults) => {
//     if (countErr) {
//       console.error("Error fetching user count:", countErr);
//       return res.status(500).json({ error: "Error fetching users", details: countErr.message });
//     }
//     const total = countResults[1][0].total;

//     // Execute data query
//     db.query(dataQuery, dataParams, (dataErr, dataResults) => {
//       if (dataErr) {
//         console.error("Error fetching users:", dataErr);
//         return res.status(500).json({ error: "Error fetching users", details: dataErr.message });
//       }
//       const userData = dataResults[1];

//       // Format results
//       const formattedResults = userData.map(user => ({
//         user_id: user.user_id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         role: user.role,
//         department_id: user.department_id,
//         department_name: user.department_name || "",
//         shift_id: user.shift_id || "",
//         shift_name: user.shift_name || "",
//         duty_point_id: user.duty_point_id || "",
//         duty_point_name: user.duty_point_name || "",
//         start_time: user.start_time ? user.start_time.toString().split(' ')[4] : "",
//         end_time: user.end_time ? user.end_time.toString().split(' ')[4] : "",
//         from_date: user.from_date ? user.from_date.toISOString().split('T')[0] : "",
//         to_date: user.to_date ? user.to_date.toISOString().split('T')[0] : "",
//         status: user.shift_id && user.duty_point_id ? (user.active ? "on_duty" : "off_duty") : "not_assigned"
//       }));

//       // Calculate total pages
//       const totalPages = Math.ceil(total / limitNum);

//       res.json({
//         data: formattedResults,
//         pagination: {
//           total,
//           page: pageNum,
//           limit: limitNum,
//           totalPages
//         }
//       });
//     });
//   });
// });



// API: Get all users with filters
app.get("/api/users", (req, res) => {
  const { role, department_id, shift_id, duty_point_id, user_id, name, status, page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
    return res.status(400).json({ error: "Invalid page or limit parameters" });
  }

  const offset = (pageNum - 1) * limitNum;

  // Base query for counting total records with time zone set
  let countQuery = `
    SET SESSION time_zone = '+05:30';
    SELECT COUNT(DISTINCT u.user_id) AS total
    FROM Users u
    LEFT JOIN ShiftAssignments sa ON u.user_id = sa.employee_id
    LEFT JOIN Shifts s ON sa.shift_id = s.shift_id
    WHERE 1=1
  `;
  const countParams = [];

  // Base query for fetching paginated data with time zone set
  let dataQuery = `
    SET SESSION time_zone = '+05:30';
    SELECT 
      u.user_id, 
      u.name, 
      u.email, 
      u.phone, 
      u.role, 
      u.department_id,
      d.name AS department_name,
      sa.shift_id,
      s.name AS shift_name,
      s.start_time,
      s.end_time,
      sa.duty_point_id,
      dp.name AS duty_point_name,
      sa.start_date AS from_date,
      COALESCE(sa.end_date, sa.specific_date) AS to_date,
      CASE 
        WHEN sa.shift_id IS NULL OR sa.duty_point_id IS NULL THEN false
        WHEN CURDATE() BETWEEN sa.start_date AND COALESCE(sa.end_date, sa.specific_date, '9999-12-31')
        AND (
          (s.end_time > s.start_time AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time)
          OR
          (s.end_time <= s.start_time AND 
           (
             (CURDATE() = sa.start_date AND CURRENT_TIME() >= s.start_time) OR
             (CURDATE() = DATE_ADD(sa.start_date, INTERVAL 1 DAY) AND CURRENT_TIME() < s.end_time)
           )
          )
        ) THEN true
        ELSE false
      END AS active
    FROM Users u
    LEFT JOIN Departments d ON u.department_id = d.department_id
    LEFT JOIN ShiftAssignments sa ON u.user_id = sa.employee_id
    LEFT JOIN Shifts s ON sa.shift_id = s.shift_id
    LEFT JOIN DutyPoints dp ON sa.duty_point_id = dp.duty_point_id
    WHERE 1=1
  `;
  const dataParams = [];

  // Apply filters to both queries
  if (role) {
    countQuery += " AND u.role = ?";
    dataQuery += " AND u.role = ?";
    countParams.push(role);
    dataParams.push(role);
  }
  if (department_id) {
    countQuery += " AND u.department_id = ?";
    dataQuery += " AND u.department_id = ?";
    countParams.push(department_id);
    dataParams.push(department_id);
  }
  if (shift_id) {
    countQuery += " AND sa.shift_id = ?";
    dataQuery += " AND sa.shift_id = ?";
    countParams.push(shift_id);
    dataParams.push(shift_id);
  }
  if (duty_point_id) {
    countQuery += " AND sa.duty_point_id = ?";
    dataQuery += " AND sa.duty_point_id = ?";
    countParams.push(duty_point_id);
    dataParams.push(duty_point_id);
  }
  if (user_id) {
    countQuery += " AND u.user_id = ?";
    dataQuery += " AND u.user_id = ?";
    countParams.push(user_id);
    dataParams.push(user_id);
  }
  if (name) {
    countQuery += " AND u.name LIKE ?";
    dataQuery += " AND u.name LIKE ?";
    countParams.push(`%${name}%`);
    dataParams.push(`%${name}%`);
  }

  // Add status filter
  if (status) {
    const activeCondition = `
      CURDATE() BETWEEN sa.start_date AND COALESCE(sa.end_date, sa.specific_date, '9999-12-31')
      AND (
        (s.end_time > s.start_time AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time)
        OR
        (s.end_time <= s.start_time AND 
         (
           (CURDATE() = sa.start_date AND CURRENT_TIME() >= s.start_time) OR
           (CURDATE() = DATE_ADD(sa.start_date, INTERVAL 1 DAY) AND CURRENT_TIME() < s.end_time)
         )
        )
      )
    `;

    if (status === "not_assigned") {
      countQuery += " AND sa.shift_id IS NULL";
      dataQuery += " AND sa.shift_id IS NULL";
    } else if (status === "on_duty") {
      countQuery += ` AND sa.shift_id IS NOT NULL AND (${activeCondition})`;
      dataQuery += ` AND sa.shift_id IS NOT NULL AND (${activeCondition})`;
    } else if (status === "off_duty") {
      countQuery += ` AND sa.shift_id IS NOT NULL AND NOT (${activeCondition})`;
      dataQuery += ` AND sa.shift_id IS NOT NULL AND NOT (${activeCondition})`;
    } else {
      return res.status(400).json({ error: "Invalid status filter" });
    }
  }

  // Add pagination to data query
  dataQuery += ` LIMIT ? OFFSET ?`;
  dataParams.push(limitNum, offset);

  // Execute count query
  db.query(countQuery, countParams, (countErr, countResults) => {
    if (countErr) {
      console.error("Error fetching user count:", countErr);
      return res.status(500).json({ error: "Error fetching users", details: countErr.message });
    }
    const total = countResults[1][0].total;

    // Execute data query
    db.query(dataQuery, dataParams, (dataErr, dataResults) => {
      if (dataErr) {
        console.error("Error fetching users:", dataErr);
        return res.status(500).json({ error: "Error fetching users", details: dataErr.message });
      }
      const userData = dataResults[1];

      // Format results
      const formattedResults = userData.map(user => ({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name || "",
        shift_id: user.shift_id || "",
        shift_name: user.shift_name || "",
        duty_point_id: user.duty_point_id || "",
        duty_point_name: user.duty_point_name || "",
        start_time: user.start_time ? user.start_time : "this is data ",
        end_time: user.end_time ? user.end_time : "this is data ",

        // start_time:"this is start date",
        // end_time:"this is end time",
        from_date: user.from_date ? user.from_date.toISOString().split('T')[0] : "",
        to_date: user.to_date ? user.to_date.toISOString().split('T')[0] : "",
        status: user.shift_id && user.duty_point_id ? (user.active ? "on_duty" : "off_duty") : "not_assigned"
      }));

      // Calculate total pages
      const totalPages = Math.ceil(total / limitNum);

      res.json({
        data: formattedResults,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages
        }
      });
    });
  });
});

app.post("/api/departments", async (req, res) => {
  const {
    name,
    description,
    admin_id,
    admin_name,
    admin_email,
    admin_phone,
    admin_password,
  } = req.body;
  let adminId;

  if (admin_id) {
    db.query(
      `SET SESSION time_zone = '+05:30'; SELECT * FROM Users WHERE user_id = ? AND role = "DepartmentAdmin"`,
      [admin_id],
      (err, results) => {
        if (err) {
          console.error("Error checking admin:", err);
          return res.status(500).json({ error: "Server error", details: err.message });
        }
        if (results[1].length === 0) return res.status(400).json({ error: "Invalid admin_id" });
        adminId = admin_id;
        insertDepartment(name, description, adminId, res);
      }
    );
  } else if (admin_name && admin_email && admin_phone && admin_password) {
    try {
      const hashedPassword = await bcrypt.hash(admin_password, 10);
      db.query(
        `SET SESSION time_zone = '+05:30'; INSERT INTO Users (name, email, phone, password, role) VALUES (?, ?, ?, ?, "DepartmentAdmin")`,
        [admin_name, admin_email, admin_phone, hashedPassword],
        (err, result) => {
          if (err) {
            console.error("Error creating admin:", err);
            return res.status(500).json({ error: "Error creating admin", details: err.message });
          }
          adminId = result[1].insertId;
          insertDepartment(name, description, adminId, res, () => {
            db.query(
              `SET SESSION time_zone = '+05:30'; UPDATE Users SET department_id = ? WHERE user_id = ?`,
              [res.locals.department_id, adminId],
              (updateErr) => {
                if (updateErr) {
                  console.error("Error updating admin's department_id:", updateErr);
                }
              }
            );
          });
        }
      );
    } catch (err) {
      console.error("Error hashing password:", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  } else {
    return res.status(400).json({ error: "Must provide admin_id or admin details" });
  }
});

function insertDepartment(name, description, adminId, res, callback) {
  db.query(
    "SET SESSION time_zone = '+05:30'; INSERT INTO Departments (name, description, admin_id) VALUES (?, ?, ?)",
    [name, description, adminId],
    (err, result) => {
      if (err) {
        console.error("Error creating department:", err);
        return res.status(500).json({ error: "Error creating department", details: err.message });
      }
      res.locals.department_id = result[1].insertId;
      res.status(201).json({
        message: "Department created successfully",
        department_id: result[1].insertId,
      });
      if (callback) callback();
    }
  );
}

// API 2: Get all departments or a specific department
app.get("/api/departments", (req, res) => {
  const { department_id } = req.query;
  let query = `
    SET SESSION time_zone = '+05:30';
    SELECT d.department_id, d.name, d.description, d.admin_id, u.name as admin_name,
        (SELECT COUNT(*) FROM Users WHERE department_id = d.department_id AND role = 'Employee') as num_employees,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('shift_id', s.shift_id, 'name', s.name, 'start_time', s.start_time, 'end_time', s.end_time, 'duration', s.duration))
         FROM Shifts s WHERE s.department_id = d.department_id) as shifts,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('duty_point_id', dp.duty_point_id, 'name', dp.name, 'description', dp.description,
            'num_people', (SELECT COUNT(*) FROM ShiftAssignments sa 
                           JOIN Shifts s ON sa.shift_id = s.shift_id
                           WHERE sa.duty_point_id = dp.duty_point_id
                           AND CURDATE() BETWEEN sa.start_date AND IFNULL(sa.end_date, '9999-12-31')
                           AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time)))
         FROM DutyPoints dp WHERE dp.department_id = d.department_id) as duty_points
    FROM Departments d
    LEFT JOIN Users u ON d.admin_id = u.user_id
  `;
  const params = [];
  if (department_id) {
    query += " WHERE d.department_id = ?";
    params.push(parseInt(department_id, 10));
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("SQL Error:", {
        message: err.message,
        sql: err.sql,
        sqlState: err.sqlState,
        sqlMessage: err.sqlMessage,
        code: err.code,
      });
      return res.status(500).json({ error: "Error fetching departments", details: err.message });
    }
    const selectResults = results[1];
    if (department_id && selectResults.length === 0) return res.status(404).json({ error: "Department not found" });
    const departments = department_id ? [selectResults[0]] : selectResults;
    departments.forEach((dept) => {
      dept.shifts = dept.shifts || [];
      dept.duty_points = dept.duty_points || [];
      dept.current_shift =
        dept.shifts.find((s) => {
          const now = new Date().toLocaleTimeString("en-US", {
            hour12: false,
            timeZone: "Asia/Kolkata",
          });
          return now >= s.start_time && now <= s.end_time;
        }) || null;
    });
    res.json(department_id ? departments[0] : departments);
  });
});

// API 3: Get specific department with current shift employees
app.get("/api/departments/:department_id", (req, res) => {
  const department_id = parseInt(req.params.department_id, 10);
  if (isNaN(department_id)) {
    return res.status(400).json({ error: "Invalid department_id" });
  }
  const query = `
    SET SESSION time_zone = '+05:30';
    SELECT 
      d.department_id, 
      d.name, 
      d.description, 
      d.admin_id, 
      u.name as admin_name,
      (SELECT COUNT(*) FROM Users WHERE department_id = d.department_id AND role = 'Employee') as num_employees,
      (SELECT JSON_ARRAYAGG(
         JSON_OBJECT(
           'shift_id', s.shift_id, 
           'name', s.name, 
           'start_time', s.start_time, 
           'end_time', s.end_time, 
           'duration', s.duration,
           'num_people', (
             SELECT COUNT(*) 
             FROM ShiftAssignments sa 
             JOIN Shifts s2 ON sa.shift_id = s2.shift_id
             WHERE sa.shift_id = s.shift_id
             AND CURDATE() BETWEEN sa.start_date AND IFNULL(sa.end_date, '9999-12-31')
             AND (
               (s2.end_time > s2.start_time AND CURRENT_TIME() BETWEEN s2.start_time AND s2.end_time)
               OR
               (s2.end_time <= s2.start_time AND 
                (CURRENT_TIME() >= s2.start_time OR CURRENT_TIME() < s2.end_time)
               )
             )
           )
         )
       )
       FROM Shifts s 
       WHERE s.department_id = d.department_id) as shifts,
      (SELECT JSON_ARRAYAGG(
         JSON_OBJECT(
           'duty_point_id', dp.duty_point_id, 
           'name', dp.name, 
           'description', dp.description,
           'num_people', (
             SELECT COUNT(*) 
             FROM ShiftAssignments sa 
             JOIN Shifts s ON sa.shift_id = s.shift_id
             WHERE sa.duty_point_id = dp.duty_point_id
             AND CURDATE() BETWEEN sa.start_date AND IFNULL(sa.end_date, '9999-12-31')
             AND (
               (s.end_time > s.start_time AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time)
               OR
               (s.end_time <= s.start_time AND 
                (CURRENT_TIME() >= s.start_time OR CURRENT_TIME() < s.end_time)
               )
             )
           )
         )
       )
       FROM DutyPoints dp 
       WHERE dp.department_id = d.department_id) as duty_points,
      (SELECT JSON_ARRAYAGG(
         JSON_OBJECT(
           'user_id', u.user_id, 
           'name', u.name, 
           'phone', u.phone, 
           'email', u.email, 
           'duty_point_id', sa.duty_point_id
         )
       )
       FROM ShiftAssignments sa
       JOIN Users u ON sa.employee_id = u.user_id
       JOIN Shifts s ON sa.shift_id = s.shift_id
       WHERE s.department_id = d.department_id
       AND CURDATE() BETWEEN sa.start_date AND IFNULL(sa.end_date, '9999-12-31')
       AND (
         (s.end_time > s.start_time AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time)
         OR
         (s.end_time <= s.start_time AND 
          (CURRENT_TIME() >= s.start_time OR CURRENT_TIME() < s.end_time)
         )
       )) as current_employees
    FROM Departments d
    LEFT JOIN Users u ON d.admin_id = u.user_id
    WHERE d.department_id = ?;
  `;
  db.query(query, [department_id], (err, results) => {
    if (err) {
      console.error("SQL Error:", {
        message: err.message,
        sql: err.sql,
        sqlState: err.sqlState,
        sqlMessage: err.sqlMessage,
        code: err.code,
      });
      return res.status(500).json({ error: "Error fetching department", details: err.message });
    }
    const selectResults = results[1];
    if (selectResults.length === 0) {
      return res.status(404).json({ error: "Department not found" });
    }
    const dept = selectResults[0];
    dept.shifts = dept.shifts || [];
    dept.duty_points = dept.duty_points || [];
    dept.current_employees = dept.current_employees || [];
    dept.current_shift =
      dept.shifts.find((s) => {
        const now = new Date().toLocaleTimeString("en-US", {
          hour12: false,
          timeZone: "Asia/Kolkata",
        });
        return (
          (s.end_time > s.start_time && now >= s.start_time && now <= s.end_time) ||
          (s.end_time <= s.start_time && (now >= s.start_time || now < s.end_time))
        );
      }) || null;
    res.json(dept);
  });
});

app.get("/api/department-details", (req, res) => {
  const { department_id } = req.query;
  let query = `
    SET SESSION time_zone = '+05:30';
    SELECT 
      d.department_id,
      d.name,
      (SELECT JSON_ARRAYAGG(JSON_OBJECT('shift_id', s.shift_id, 'name', s.name))
       FROM Shifts s WHERE s.department_id = d.department_id) as shifts,
      (SELECT JSON_ARRAYAGG(JSON_OBJECT('duty_point_id', dp.duty_point_id, 'name', dp.name))
       FROM DutyPoints dp WHERE dp.department_id = d.department_id) as duty_points
    FROM Departments d
  `;
  const params = [];
  if (department_id) {
    query += " WHERE d.department_id = ?";
    params.push(parseInt(department_id, 10));
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("SQL Error:", {
        message: err.message,
        sql: err.sql,
        sqlState: err.sqlState,
        sqlMessage: err.sqlMessage,
        code: err.code
      });
      return res.status(500).json({ error: "Error fetching department details", details: err.message });
    }
    const selectResults = results[1];
    if (department_id && selectResults.length === 0) {
      return res.status(404).json({ error: "Department not found" });
    }
    const formattedResults = selectResults.map(dept => ({
      department_id: dept.department_id,
      name: dept.name,
      shifts: dept.shifts || [],
      duty_points: dept.duty_points || []
    }));
    res.json(department_id ? formattedResults[0] : formattedResults);
  });
});

// Admin API 1: Create duty point
app.post("/api/duty_points", (req, res) => {
  const { name, description, coordinate, department_id } = req.body;
  db.query(
    "SET SESSION time_zone = '+05:30'; INSERT INTO DutyPoints (department_id, name, description) VALUES (?, ?, ?)",
    [department_id, name, `${description} (Coordinate: ${coordinate})`],
    (err, result) => {
      if (err) {
        console.error("Error creating duty point:", err);
        return res.status(500).json({ error: "Error creating duty point", details: err.message });
      }
      res.status(201).json({
        message: "Duty point created successfully",
        duty_point_id: result[1].insertId,
      });
    }
  );
});

// Admin API 2: Create shift
app.post("/api/shifts", (req, res) => {
  const { name, department_id, start_time, end_time, duration } = req.body;
  db.query(
    "SET SESSION time_zone = '+05:30'; INSERT INTO Shifts (department_id, name, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?)",
    [department_id, name, start_time, end_time, duration],
    (err, result) => {
      if (err) {
        console.error("Error creating shift:", err);
        return res.status(500).json({ error: "Error creating shift", details: err.message });
      }
      res.status(201).json({
        message: "Shift created successfully",
        shift_id: result[1].insertId,
      });
    }
  );
});

// API: Assign employee to duty point for a shift
app.post("/api/shift_assignments", (req, res) => {
  const {
    duty_point_id,
    shift_id,
    employee_id,
    department_id,
    start_date,
    end_date,
    specific_date,
  } = req.body;
  db.query(
    "SET SESSION time_zone = '+05:30'; SELECT * FROM Users WHERE user_id = ? AND department_id = ?",
    [employee_id, department_id],
    (err, emp) => {
      if (err) {
        console.error("Error checking employee:", err);
        return res.status(500).json({ error: "Server error", details: err.message });
      }
      if (emp[1].length === 0) return res.status(400).json({ error: "Employee not found in department" });

      const assignment_type = specific_date ? "OneTime" : "Recurring";
      const conflictQuery = `
        SET SESSION time_zone = '+05:30';
        ${
          specific_date
            ? `SELECT employee_id FROM ShiftAssignments sa 
               JOIN Shifts s ON sa.shift_id = s.shift_id
               WHERE sa.employee_id = ? AND sa.specific_date = ? AND s.shift_id = ?`
            : `SELECT employee_id FROM ShiftAssignments sa 
               JOIN Shifts s ON sa.shift_id = s.shift_id
               WHERE sa.employee_id = ? AND s.shift_id = ? AND (
                   (sa.start_date <= ? AND (sa.end_date >= ? OR sa.end_date IS NULL)) OR
                   (sa.start_date <= ? AND (sa.end_date >= ? OR sa.end_date IS NULL)) OR
                   (? <= sa.end_date AND ? >= sa.start_date)
               )`
        };
      `;
      const params = specific_date
        ? [employee_id, specific_date, shift_id]
        : [employee_id, shift_id, end_date, start_date, start_date, end_date, start_date, end_date];

      db.query(conflictQuery, params, (err, assigned) => {
        if (err) {
          console.error("Error checking conflicts:", err);
          return res.status(500).json({ error: "Error checking conflicts", details: err.message });
        }
        const assignedIds = assigned[1]?.map((a) => a.employee_id) || [];
        if (assignedIds.length > 0) return res.status(400).json({ error: "Employee has conflicting assignment" });

        const insertQuery = specific_date
          ? "SET SESSION time_zone = '+05:30'; INSERT INTO ShiftAssignments (duty_point_id, shift_id, employee_id, assignment_type, specific_date) VALUES (?, ?, ?, ?, ?)"
          : "SET SESSION time_zone = '+05:30'; INSERT INTO ShiftAssignments (duty_point_id, shift_id, employee_id, assignment_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)";
        const insertParams = specific_date
          ? [duty_point_id, shift_id, employee_id, "OneTime", specific_date]
          : [duty_point_id, shift_id, employee_id, "Recurring", start_date, end_date];

        db.query(insertQuery, insertParams, (err, result) => {
          if (err) {
            console.error("Error creating assignment:", err);
            return res.status(500).json({ error: "Error creating assignment", details: err.message });
          }
          res.status(201).json({
            message: "Assignment created successfully",
            assignment_id: result[1].insertId,
          });
        });
      });
    }
  );
});

// API: Get all duty points for a department
app.get("/api/duty_points/:department_id", (req, res) => {
  const department_id = parseInt(req.params.department_id, 10);
  if (isNaN(department_id)) {
    return res.status(400).json({ error: "Invalid department_id" });
  }
  const query = `
    SET SESSION time_zone = '+05:30';
    SELECT dp.duty_point_id, dp.name, dp.description,
        (SELECT COUNT(*) FROM ShiftAssignments sa 
         JOIN Shifts s ON sa.shift_id = s.shift_id
         WHERE sa.duty_point_id = dp.duty_point_id
         AND CURDATE() BETWEEN sa.start_date AND IFNULL(sa.end_date, '9999-12-31')
         AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time) as num_people,
        (SELECT name FROM Shifts s 
         WHERE s.department_id = dp.department_id 
         AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time LIMIT 1) as current_shift
    FROM DutyPoints dp
    WHERE dp.department_id = ?;
  `;
  db.query(query, [department_id], (err, results) => {
    if (err) {
      console.error("SQL Error:", {
        message: err.message,
        sql: err.sql,
        sqlState: err.sqlState,
        sqlMessage: err.sqlMessage,
        code: err.code,
      });
      return res.status(500).json({ error: "Error fetching duty points", details: err.message });
    }
    res.json(results[1]);
  });
});

// API: Get all shifts for a department
app.get("/api/shifts/:department_id", (req, res) => {
  const department_id = parseInt(req.params.department_id, 10);
  if (isNaN(department_id)) {
    return res.status(400).json({ error: "Invalid department_id" });
  }
  db.query(
    "SET SESSION time_zone = '+05:30'; SELECT shift_id, name, start_time, end_time, duration FROM Shifts WHERE department_id = ?",
    [department_id],
    (err, results) => {
      if (err) {
        console.error("Error fetching shifts:", err);
        return res.status(500).json({ error: "Error fetching shifts", details: err.message });
      }
      res.json(results[1]);
    }
  );
});

// Bonus API: Get free employees for a shift and duty point
app.get("/api/free_employees/:department_id", (req, res) => {
  const department_id = parseInt(req.params.department_id, 10);
  if (isNaN(department_id)) {
    return res.status(400).json({ error: "Invalid department_id" });
  }
  const { shift_id, start_date, end_date, specific_date } = req.query;
  const conflictQuery = `
    SET SESSION time_zone = '+05:30';
    ${
      specific_date
        ? `SELECT employee_id FROM ShiftAssignments sa 
           JOIN Shifts s ON sa.shift_id = s.shift_id
           WHERE sa.specific_date = ? AND s.shift_id = ?`
        : `SELECT employee_id FROM ShiftAssignments sa 
           JOIN Shifts s ON sa.shift_id = s.shift_id
           WHERE s.shift_id = ? AND (
               (sa.start_date <= ? AND (sa.end_date >= ? OR sa.end_date IS NULL)) OR
               (sa.start_date <= ? AND (sa.end_date >= ? OR sa.end_date IS NULL)) OR
               (? <= sa.end_date AND ? >= sa.start_date)
           )`
    };
  `;
  const params = specific_date
    ? [specific_date, shift_id]
    : [shift_id, end_date, start_date, start_date, end_date, start_date, end_date];

  db.query(conflictQuery, params, (err, assigned) => {
    if (err) {
      console.error("SQL Error:", {
        message: err.message,
        sql: err.sql,
        sqlState: err.sqlState,
        sqlMessage: err.sqlMessage,
        code: err.code,
      });
      return res.status(500).json({ error: "Error checking assignments", details: err.message });
    }
    const assignedIds = assigned[1]?.map((a) => a.employee_id) || [];
    db.query(
      `SET SESSION time_zone = '+05:30'; SELECT user_id, name, phone, email FROM Users WHERE department_id = ? AND role = "Employee" AND user_id NOT IN (?)`,
      [department_id, assignedIds.length ? assignedIds : [0]],
      (err, employees) => {
        if (err) {
          console.error("Error fetching free employees:", err);
          return res.status(500).json({ error: "Error fetching free employees", details: err.message });
        }
        res.json(employees[1]);
      }
    );
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
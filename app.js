const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: "vlai-rds.cb40uq8wcu0z.ap-south-1.rds.amazonaws.com",
  user: "admin",
  password: "vlai27735", // Replace with your MySQL password
  database: "skvt_mngt",
//   timezone: "+05:30", // IST timezone///zzz
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected.");
});

// API 0.1: Create a new user
app.post("/api/users", async (req, res) => {
  const { name, phone, email, password, role, department_id } = req.body;
  if (!["SuperAdmin", "DepartmentAdmin", "Employee"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  if (role === "Employee" && !department_id) {
    return res
      .status(400)
      .json({ error: "Department ID is required for employees" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  db.query(
    "INSERT INTO Users (name, phone, email, password, role, department_id) VALUES (?, ?, ?, ?, ?, ?)",
    [name, phone, email, hashedPassword, role, department_id || null],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Error creating user" });
      res
        .status(201)
        .json({
          message: "User created successfully",
          user_id: result.insertId,
        });
    }
  );
});

// API: Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  db.query(
    "SELECT * FROM Users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (results.length === 0)
        return res.status(401).json({ error: "User not found" });
      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ error: "Invalid password" });
      // req.session.user = user; // Commented out as requested
      res
        .status(200)
        .json({
          message: "Logged in successfully",
          user: { user_id: user.user_id, role: user.role },
        });
    }
  );
});

// API: Get all users with filters
app.get("/api/users", (req, res) => {
  const { role, department_id, shift_id, user_id, name } = req.query;
  let query =
    "SELECT user_id, name, email, phone, role, department_id FROM Users WHERE 1=1";
  const params = [];
  if (role) {
    query += " AND role = ?";
    params.push(role);
  }
  if (department_id) {
    query += " AND department_id = ?";
    params.push(department_id);
  }
  if (shift_id) {
    query +=
      " AND user_id IN (SELECT employee_id FROM ShiftAssignments WHERE shift_id = ?)";
    params.push(shift_id);
  }
  if (user_id) {
    query += " AND user_id = ?";
    params.push(user_id);
  }
  if (name) {
    query += " AND name LIKE ?";
    params.push(`%${name}%`);
  }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: "Error fetching users" });
    res.json(results);
  });
});

// API 1: Create department (SuperAdmin only)
app.post("/api/departments", async (req, res) => {
  // if (!req.session.user || req.session.user.role !== 'SuperAdmin') {
  //     return res.status(403).json({ error: 'Unauthorized' });
  // }
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
      'SELECT * FROM Users WHERE user_id = ? AND role = "DepartmentAdmin"',
      [admin_id],
      (err, results) => {
        if (err) return res.status(500).json({ error: "Server error" });
        if (results.length === 0)
          return res.status(400).json({ error: "Invalid admin_id" });
        adminId = admin_id;
        insertDepartment(name, description, adminId, res);
      }
    );
  } else if (admin_name && admin_email && admin_phone && admin_password) {
    const hashedPassword = await bcrypt.hash(admin_password, 10);
    db.query(
      'INSERT INTO Users (name, email, phone, password, role) VALUES (?, ?, ?, ?, "DepartmentAdmin")',
      [admin_name, admin_email, admin_phone, hashedPassword],
      (err, result) => {
        if (err) return res.status(500).json({ error: "Error creating admin" });
        adminId = result.insertId;
        insertDepartment(name, description, adminId, res);
      }
    );
  } else {
    return res
      .status(400)
      .json({ error: "Must provide admin_id or admin details" });
  }
});

function insertDepartment(name, description, adminId, res) {
  db.query(
    "INSERT INTO Departments (name, description, admin_id) VALUES (?, ?, ?)",
    [name, description, adminId],
    (err, result) => {
      if (err)
        return res.status(500).json({ error: "Error creating department" });
      res
        .status(201)
        .json({
          message: "Department created successfully",
          department_id: result.insertId,
        });
    }
  );
}

// API 2: Get all departments or a specific department
app.get("/api/departments", (req, res) => {
  const { department_id } = req.query;
  const query = `
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
         FROM DutyPoints dp WHERE dp.department_id = d.department_id) as duty_points,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('user_id', u.user_id, 'name', u.name, 'phone', u.phone, 'email', u.email, 'duty_point_id', sa.duty_point_id))
         FROM ShiftAssignments sa
         JOIN Users u ON sa.employee_id = u.user_id
         JOIN Shifts s ON sa.shift_id = s.shift_id
         WHERE s.department_id = d.department_id
         AND CURDATE() BETWEEN sa.start_date AND IFNULL(sa.end_date, '9999-12-31')
         AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time) as current_employees
    FROM Departments d
    LEFT JOIN Users u ON d.admin_id = u.user_id
    WHERE d.department_id = ?
`;
  const params = [];
  if (department_id) {
    query += " WHERE d.department_id = ?";
    params.push(department_id);
  }

  db.query(query, params, (err, results) => {
    if (err)
      return res.status(500).json({ error: "Error fetching departments" });
    if (department_id && results.length === 0)
      return res.status(404).json({ error: "Department not found" });
    results.forEach((dept) => {
      dept.shifts = dept.shifts || []; // No JSON.parse needed
      dept.duty_points = dept.duty_points || []; // No JSON.parse needed
      dept.current_shift =
        dept.shifts.find((s) => {
          const now = new Date().toLocaleTimeString("en-US", {
            hour12: false,
            timeZone: "Asia/Kolkata",
          });
          return now >= s.start_time && now <= s.end_time;
        }) || null;
    });
    res.json(department_id ? results[0] : results);
  });
});

// API 3: Get specific department with current shift employees
app.get('/api/departments/:department_id', (req, res) => {
    const department_id = parseInt(req.params.department_id, 10);
    if (isNaN(department_id)) {
        return res.status(400).json({ error: 'Invalid department_id' });
    }
    const query = `
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
             FROM DutyPoints dp WHERE dp.department_id = d.department_id) as duty_points,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('user_id', u.user_id, 'name', u.name, 'phone', u.phone, 'email', u.email, 'duty_point_id', sa.duty_point_id))
             FROM ShiftAssignments sa
             JOIN Users u ON sa.employee_id = u.user_id
             JOIN Shifts s ON sa.shift_id = s.shift_id
             WHERE s.department_id = d.department_id
             AND CURDATE() BETWEEN sa.start_date AND IFNULL(sa.end_date, '9999-12-31')
             AND CURRENT_TIME() BETWEEN s.start_time AND s.end_time) as current_employees
        FROM Departments d
        LEFT JOIN Users u ON d.admin_id = u.user_id
        WHERE d.department_id = ?
    `;
    db.query(query, [department_id], (err, results) => {
        if (err) {
            console.error('SQL Error:', {
                message: err.message,
                sql: err.sql,
                sqlState: err.sqlState,
                sqlMessage: err.sqlMessage,
                code: err.code
            });
            return res.status(500).json({ error: 'Error fetching department', details: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
        console.log('Raw Results:', JSON.stringify(results, null, 2));
        const dept = results[0];
        dept.shifts = dept.shifts || [];
        dept.duty_points = dept.duty_points || [];
        dept.current_employees = dept.current_employees || [];
        dept.current_shift = dept.shifts.find(s => {
            const now = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Kolkata' });
            return now >= s.start_time && now <= s.end_time;
        }) || null;
        res.json(dept);
    });
});

// Admin API 1: Create duty point
app.post("/api/duty_points", (req, res) => {
  // if (!req.session.user || req.session.user.role !== 'DepartmentAdmin') {
  //     return res.status(403).json({ error: 'Unauthorized' });
  // }
  const { name, description, coordinate, department_id } = req.body;
  // if (req.session.user.department_id !== department_id) {
  //     return res.status(403).json({ error: 'Cannot create duty point for another department' });
  // }
  db.query(
    "INSERT INTO DutyPoints (department_id, name, description) VALUES (?, ?, ?)",
    [department_id, name, `${description} (Coordinate: ${coordinate})`],
    (err, result) => {
      if (err)
        return res.status(500).json({ error: "Error creating duty point" });
      res
        .status(201)
        .json({
          message: "Duty point created successfully",
          duty_point_id: result.insertId,
        });
    }
  );
});

// Admin API 2: Create shift
app.post("/api/shifts", (req, res) => {
  // if (!req.session.user || req.session.user.role !== 'DepartmentAdmin') {
  //     return res.status(403).json({ error: 'Unauthorized' });
  // }
  const { name, department_id, start_time, end_time, duration } = req.body;
  // if (req.session.user.department_id !== department_id) {
  //     return res.status(403).json({ error: 'Cannot create shift for another department' });
  // }
  db.query(
    "INSERT INTO Shifts (department_id, name, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?)",
    [department_id, name, start_time, end_time, duration],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Error creating shift" });
      res
        .status(201)
        .json({
          message: "Shift created successfully",
          shift_id: result.insertId,
        });
    }
  );
});

// API: Assign employee to duty point for a shift
app.post("/api/shift_assignments", (req, res) => {
  // if (!req.session.user || req.session.user.role !== 'DepartmentAdmin') {
  //     return res.status(403).json({ error: 'Unauthorized' });
  // }
  const {
    duty_point_id,
    shift_id,
    employee_id,
    department_id,
    start_date,
    end_date,
    specific_date,
  } = req.body;
  // if (req.session.user.department_id !== department_id) {
  //     return res.status(403).json({ error: 'Cannot assign for another department' });
  // }

  db.query(
    "SELECT * FROM Users WHERE user_id = ? AND department_id = ?",
    [employee_id, department_id],
    (err, emp) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (emp.length === 0)
        return res
          .status(400)
          .json({ error: "Employee not found in department" });

      const assignment_type = specific_date ? "OneTime" : "Recurring";
      const conflictQuery = specific_date
        ? `SELECT * FROM ShiftAssignments sa JOIN Shifts s ON sa.shift_id = s.shift_id
               WHERE sa.employee_id = ? AND sa.specific_date = ? AND s.shift_id = ?`
        : `SELECT * FROM ShiftAssignments sa JOIN Shifts s ON sa.shift_id = s.shift_id
               WHERE sa.employee_id = ? AND s.shift_id = ? AND (
                   (sa.start_date <= ? AND (sa.end_date >= ? OR sa.end_date IS NULL)) OR
                   (sa.start_date <= ? AND (sa.end_date >= ? OR sa.end_date IS NULL)) OR
                   (? <= sa.end_date AND ? >= sa.start_date)
               )`;
      const params = specific_date
        ? [employee_id, specific_date, shift_id]
        : [
            employee_id,
            shift_id,
            end_date,
            start_date,
            start_date,
            end_date,
            start_date,
            end_date,
          ];

      db.query(conflictQuery, params, (err, conflicts) => {
        if (err)
          return res.status(500).json({ error: "Error checking conflicts" });
        if (conflicts.length > 0)
          return res
            .status(400)
            .json({ error: "Employee has conflicting assignment" });

        const insertQuery = specific_date
          ? "INSERT INTO ShiftAssignments (duty_point_id, shift_id, employee_id, assignment_type, specific_date) VALUES (?, ?, ?, ?, ?)"
          : "INSERT INTO ShiftAssignments (duty_point_id, shift_id, employee_id, assignment_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)";
        const insertParams = specific_date
          ? [duty_point_id, shift_id, employee_id, "OneTime", specific_date]
          : [
              duty_point_id,
              shift_id,
              employee_id,
              "Recurring",
              start_date,
              end_date,
            ];

        db.query(insertQuery, insertParams, (err, result) => {
          if (err)
            return res.status(500).json({ error: "Error creating assignment" });
          res
            .status(201)
            .json({
              message: "Assignment created successfully",
              assignment_id: result.insertId,
            });
        });
      });
    }
  );
});

// API: Get all duty points for a department
app.get("/api/duty_points/:department_id", (req, res) => {
  const { department_id } = req.params;
  // if (!req.session.user || (req.session.user.role === 'DepartmentAdmin' && req.session.user.department_id !== department_id)) {
  //     return res.status(403).json({ error: 'Unauthorized' });
  // }
  const query = `
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
        WHERE dp.department_id = ?
    `;
  db.query(query, [department_id], (err, results) => {
    if (err)
      return res.status(500).json({ error: "Error fetching duty points" });
    res.json(results);
  });
});

// API: Get all shifts for a department
app.get("/api/shifts/:department_id", (req, res) => {
  const { department_id } = req.params;
  // if (!req.session.user || (req.session.user.role === 'DepartmentAdmin' && req.session.user.department_id !== department_id)) {
  //     return res.status(403).json({ error: 'Unauthorized' });
  // }
  db.query(
    "SELECT shift_id, name, start_time, end_time, duration FROM Shifts WHERE department_id = ?",
    [department_id],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Error fetching shifts" });
      res.json(results);
    }
  );
});

// Bonus API: Get free employees for a shift and duty point
app.get("/api/free_employees/:department_id", (req, res) => {
  const { department_id } = req.params;
  // if (!req.session.user || (req.session.user.role === 'DepartmentAdmin' && req.session.user.department_id !== department_id)) {
  //     return res.status(403).json({ error: 'Unauthorized' });
  // }
  const { shift_id, start_date, end_date, specific_date } = req.query;
  const conflictQuery = specific_date
    ? `SELECT employee_id FROM ShiftAssignments sa 
           JOIN Shifts s ON sa.shift_id = s.shift_id
           WHERE sa.specific_date = ? AND s.shift_id = ?`
    : `SELECT employee_id FROM ShiftAssignments sa 
           JOIN Shifts s ON sa.shift_id = s.shift_id
           WHERE s.shift_id = ? AND (
               (sa.start_date <= ? AND (sa.end_date >= ? OR sa.end_date IS NULL)) OR
               (sa.start_date <= ? AND (sa.end_date >= ? OR sa.end_date IS NULL)) OR
               (? <= sa.end_date AND ? >= sa.start_date)
           )`;
  const params = specific_date
    ? [specific_date, shift_id]
    : [
        shift_id,
        end_date,
        start_date,
        start_date,
        end_date,
        start_date,
        end_date,
      ];

  db.query(conflictQuery, params, (err, assigned) => {
    if (err)
      return res.status(500).json({ error: "Error checking assignments" });
    const assignedIds = assigned.map((a) => a.employee_id);
    db.query(
      'SELECT user_id, name, phone, email FROM Users WHERE department_id = ? AND role = "Employee" AND user_id NOT IN (?)',
      [department_id, assignedIds.length ? assignedIds : [0]],
      (err, employees) => {
        if (err)
          return res
            .status(500)
            .json({ error: "Error fetching free employees" });
        res.json(employees);
      }
    );
  });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

Temple Management Application - User Journey Flow Documentation
Overview
This document outlines the user journey flow for the SuperAdmin, DepartmentAdmin, and Employee roles in the Temple Management Application. It focuses on the SuperAdmin creating departments (with an existing or new admin), the DepartmentAdmin managing their department, and the Employee viewing their shift assignments. Designed for frontend developers, it provides a guide to integrate backend APIs, supporting the specified user experiences. The application operates in IST (UTC+5:30) with a MySQL backend and Node.js APIs.
Backend Status: Fully implemented, running at http://localhost:3000. Authentication (session checks) is disabled; enable sessions or JWT for production.
Current Date/Time: 08:26 AM IST, Tuesday, June 24, 2025.
User Journey Flow
The journey covers three personas: SuperAdmin (system setup), DepartmentAdmin (department management), and Employee (shift duties). Below are the step-by-step flows, including API endpoints and frontend integration guidance.
1. SuperAdmin Journey
Role: Oversees the platform, creating users and departments.
Journey:

Login: Authenticate to access the system.
View Dashboard: Review system stats (departments, users, deployed employees).
Create DepartmentAdmin (Optional): Create a new DepartmentAdmin if needed.
Create Department: Set up a department with an existing or new admin.
Monitor Department: View the new department’s details.

API Flow and Endpoints:



Step
Action
API Endpoint
Method
Description
Request Body/Params
Response Example



1
Login
/api/login
POST
Authenticate SuperAdmin.
{"email": "superadmin@temple.com", "password": "superadmin"}
{"message": "Logged in successfully", "user": {"user_id": 1, "role": "SuperAdmin"}}


2
View Dashboard
/api/departments
GET
Fetch all departments for stats.
None
[{"department_id": 1, "name": "Existing Dept", "num_employees": 3, "shifts": [...], "duty_points": [...], "current_shift": {...}}]


3
Create DepartmentAdmin (Optional)
/api/users
POST
Create a new DepartmentAdmin.
{"name": "Test Admin", "phone": "9876543211", "email": "testadmin@temple.com", "password": "admin123", "role": "DepartmentAdmin"}
{"message": "User created successfully", "user_id": 2}


4a
Create Department (Existing Admin)
/api/departments
POST
Create a department with an existing admin.
{"name": "Pooja Department", "description": "Handles pooja activities", "admin_id": 2}
{"message": "Department created successfully", "department_id": 2}


4b
Create Department (New Admin)
/api/departments
POST
Create a department with a new admin.
{"name": "Security Department", "description": "Manages temple security", "admin_name": "New Admin", "admin_email": "newadmin@temple.com", "admin_phone": "7654321098", "admin_password": "newadmin123"}
{"message": "Department created successfully", "department_id": 1}


5
Monitor Department
/api/departments/:department_id
GET
View department details.
Path param: department_id=1
{"department_id": 1, "name": "Security Department", "num_employees": 0, "shifts": [], "duty_points": [], "current_employees": [], "current_shift": null}


Frontend Integration:

Login: Store user_id and role from POST /api/login in local storage.
Dashboard: Display stats from GET /api/departments (e.g., department count, employees).
Department Creation Form:
Offer two options: select an existing admin (fetch via GET /api/users?role=DepartmentAdmin) or input new admin details (name, email, phone, password).
Validate inputs (e.g., ensure admin_id exists or new admin fields are complete).


UI: Show a confirmation modal after department creation, redirecting to details (GET /api/departments/:id).
Error Handling: Handle 400 errors (e.g., “Invalid admin_id”) and 500 errors (check details).


2. DepartmentAdmin Journey
Role: Manages their assigned department, setting up duty points, shifts, and employee assignments.
Journey:

Login: Authenticate to access their department.
View Dashboard: Review department stats, current shift, duty points, and assigned employees.
Create Duty Points: Define locations for duties.
Create Shifts: Set up shift schedules.
Assign Employees:
Select a duty point.
Choose a shift.
View free employees for the shift and date range.
Assign an employee to the duty point and shift.


Monitor Assignments: Verify assignments via department details.

API Flow and Endpoints:



Step
Action
API Endpoint
Method
Description
Request Body/Params
Response Example



1
Login
/api/login
POST
Authenticate DepartmentAdmin.
{"email": "newadmin@temple.com", "password": "newadmin123"}
{"message": "Logged in successfully", "user": {"user_id": 2, "role": "DepartmentAdmin"}}


2
View Dashboard
/api/departments/:department_id
GET
Fetch department stats and assignments.
Path param: department_id=1
{"department_id": 1, "name": "Security Department", "num_employees": 3, "shifts": [...], "duty_points": [...], "current_employees": [...], "current_shift": {...}}


3
Create Duty Point
/api/duty_points
POST
Define a duty point.
{"name": "YSK 1", "description": "Main altar", "coordinate": "12.34,56.78", "department_id": 1}
{"message": "Duty point created successfully", "duty_point_id": 1}


4
Create Shift
/api/shifts
POST
Define a shift.
{"name": "Night Shift", "department_id": 1, "start_time": "00:00:00", "end_time": "06:00:00", "duration": 6.0}
{"message": "Shift created successfully", "shift_id": 1}


5a
List Duty Points
/api/duty_points/:department_id
GET
Select a duty point.
Path param: department_id=1
[{"duty_point_id": 1, "name": "YSK 1", "description": "Main altar (Coordinate: 12.34,56.78)", "num_people": 0, "current_shift": null}]


5b
List Shifts
/api/shifts/:department_id
GET
Select a shift.
Path param: department_id=1
[{"shift_id": 1, "name": "Night Shift", "start_time": "00:00:00", "end_time": "06:00:00", "duration": 6}]


5c
Get Free Employees
/api/free_employees/:department_id
GET
View available employees.
Path param: department_id=1, Query params: shift_id=1&start_date=2025-06-01&end_date=2025-06-10
[{"user_id": 3, "name": "Test Employee", "phone": "8765432109", "email": "testemp@temple.com"}]


5d
Assign Employee
/api/shift_assignments
POST
Assign employee to shift.
{"duty_point_id": 1, "shift_id": 1, "employee_id": 3, "department_id": 1, "start_date": "2025-06-01", "end_date": "2025-06-10"}
{"message": "Assignment created successfully", "assignment_id": 1}


6
Monitor Assignments
/api/departments/:department_id
GET
Verify assignments.
Path param: department_id=1
{"department_id": 1, "current_employees": [{"user_id": 3, "name": "Test Employee", ...}]}


Frontend Integration:

Login: Store user_id and role from POST /api/login.
Dashboard: Use GET /api/departments/:id for stats, current shift, duty points, and employees.
Assignment Flow:
Display duty points (GET /api/duty_points/:id) in a dropdown.
Show shifts (GET /api/shifts/:id) for the selected duty point.
Fetch free employees (GET /api/free_employees/:id) based on shift and dates.
Submit assignment (POST /api/shift_assignments).


UI: Implement a wizard interface (Duty Point → Shift → Employee → Dates → Confirm).
Error Handling: Handle 400 errors for conflicts (e.g., “Employee has conflicting assignment”) by prompting alternative selections.


3. Employee Journey
Role: Performs duties at assigned duty points during scheduled shifts.
Journey:

Login: Authenticate to access their assignments.
View Dashboard: See current and upcoming shift assignments, including duty point and shift details.
View Department Info (Optional): Access basic department details for context.

API Flow and Endpoints:



Step
Action
API Endpoint
Method
Description
Request Body/Params
Response Example



1
Login
/api/login
POST
Authenticate Employee.
{"email": "testemp@temple.com", "password": "emp123"}
{"message": "Logged in successfully", "user": {"user_id": 3, "role": "Employee"}}


2
View Assignments
/api/departments/:department_id
GET
Fetch current assignments via current_employees.
Path param: department_id=1
{"department_id": 1, "current_employees": [{"user_id": 3, "name": "Test Employee", "phone": "8765432109", "email": "testemp@temple.com", "duty_point_id": 1}], "current_shift": {...}}


3
View Department Info (Optional)
/api/departments/:department_id
GET
Fetch department details.
Path param: department_id=1
{"department_id": 1, "name": "Security Department", "admin_name": "New Admin", ...}


Frontend Integration:

Login: Store user_id and role from POST /api/login.
Dashboard: Extract current_employees from GET /api/departments/:id for the logged-in employee’s assignments.
UI: Minimal interface showing assignment details (duty point, shift, dates). Optionally display department info.
Error Handling: Handle 404 errors (e.g., invalid department_id) by redirecting to an error page.
Future Enhancement: Consider a custom endpoint (e.g., GET /api/assignments/:user_id) for employee-specific assignments.


Frontend Integration Guidelines
Setup

Backend: Run the backend with app.js (version ID: c20366c5-353f-4a5f-aaea-3e5f5c76617d):node app.js


Dependencies: Install Node.js packages:npm install express mysql2 bcryptjs body-parser


Database: Set up the temple_management database with the provided SQL schema. Ensure the SuperAdmin user exists (superadmin@temple.com, password: superadmin).
Clear tables for testing:TRUNCATE TABLE Users;
TRUNCATE TABLE Departments;
TRUNCATE TABLE DutyPoints;
TRUNCATE TABLE Shifts;
TRUNCATE TABLE ShiftAssignments;
INSERT INTO Users (name, email, phone, password, role) 
VALUES ('Super Admin', 'superadmin@temple.com', '1234567890', '$2b$10$Ma7FG4/qgEmCd6saGBjLy.cM9bEO6sWOUMMhxuFrc2oF7XhAzrlWy', 'SuperAdmin');





Integration Tips

Authentication: Store user_id and role in local storage post-login. Restrict UI features based on role (e.g., hide department creation for non-SuperAdmins).
Dynamic IDs: Use API responses (e.g., user_id, department_id) for subsequent calls.
Time Zone: Display times in IST using JavaScript (e.g., toLocaleTimeString with timeZone: 'Asia/Kolkata').
Forms:
SuperAdmin: Dual-option form for department creation (existing admin dropdown or new admin fields).
DepartmentAdmin: Stepper for assignments (Duty Point → Shift → Employee → Dates).
Employee: Simple display of assignment details.


Error Handling: Show user-friendly messages for 400 (validation), 401 (login failure), 404 (not found), and 500 (server) errors.

Testing

Use the Postman collection (artifact ID: 9e6e8b1a-f431-4073-a280-f4cb5c9bfc22) to validate APIs.
Test scenarios:
SuperAdmin creating departments with both admin options.
DepartmentAdmin assigning employees to shifts, checking conflicts.
Employee viewing current assignments at 08:26 AM IST, June 24, 2025.


Verify IST handling for shift assignments (GET /api/departments/:id).

Security

Authentication is disabled. For production:
Enable session checks in app.js or use JWT.
Restrict endpoints (e.g., only SuperAdmin for POST /api/departments).


Validate inputs on the frontend to prevent bad requests.


Troubleshooting

API Errors: Check details in 500 responses and server logs for SQL Error.
Time Zone: Run SELECT @@session.time_zone, CURRENT_TIME(), CURDATE(); in MySQL to confirm +05:30, time around 08:26:00, and 2025-06-24.
Conflicts: Handle 400 errors by prompting alternative employee or date selections.
Contact: Share logs, API responses, and database state with the backend team for issues.


Conclusion
This README documents the user journey for SuperAdmin, DepartmentAdmin, and Employee, detailing the API flow for login, department creation, management, and assignment viewing. Frontend developers can use these endpoints to build intuitive interfaces, ensuring a seamless user experience. Refer to the Postman collection for API testing and contact the backend team for support.
Temple Management Application - Frontend Integration Guide
System Overview
Backend Status: Fully implemented and tested, running at http://localhost:3000. Authentication (session checks) is currently disabled; for production, enable sessions or implement JWT.
API Endpoints Overview
The backend provides RESTful APIs for user management, department operations, duty points, shifts, and shift assignments. Below is the API flow for each user role, with endpoints, usage, and integration notes.
Base URL

http://localhost:3000

Authentication

Currently disabled (session checks commented out). Use POST /api/login to authenticate users and retrieve user_id and role.
For production, implement session management or JWT using the login response.

Error Handling

200: Success (GET requests).
201: Resource created (POST requests).
400: Bad request (e.g., invalid role, missing fields).
401: Unauthorized (invalid credentials).
404: Not found (e.g., invalid department_id).
500: Server error (check details in response).
Display user-friendly error messages (e.g., “Employee already assigned” for 400 conflicts).


User Roles and API Flows
1. SuperAdmin
Role Overview: Manages the entire platform, including users, departments, and system-wide monitoring.
User Journey:

Login: Authenticate to access the system.
View Dashboard: See total departments, users, deployed employees, and department summaries.
Create Users: Add SuperAdmin, DepartmentAdmin, or Employee users.
Create Departments: Set up departments with existing or new admins.
Monitor Departments: View all or specific department details, including shifts, duty points, and current assignments.
List Users: Filter users by role, department, or name.

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
Fetch all departments for stats (count, employees, shifts, duty points).
None
[{"department_id": 1, "name": "Another Department", "num_employees": 3, "shifts": [...], "duty_points": [...], "current_shift": {...}}]


3
Create User (DepartmentAdmin)
/api/users
POST
Create a DepartmentAdmin.
{"name": "Test Admin", "phone": "9876543211", "email": "testadmin@temple.com", "password": "admin123", "role": "DepartmentAdmin"}
{"message": "User created successfully", "user_id": 2}


4
Create User (Employee)
/api/users
POST
Create an Employee for a department.
{"name": "Test Employee", "phone": "8765432109", "email": "testemp@temple.com", "password": "emp123", "role": "Employee", "department_id": 1}
{"message": "User created successfully", "user_id": 3}


5
Create Department (Existing Admin)
/api/departments
POST
Create a department with an existing admin.
{"name": "Test Department", "description": "Test department description", "admin_id": 2}
{"message": "Department created successfully", "department_id": 2}


6
Create Department (New Admin)
/api/departments
POST
Create a department with a new admin.
{"name": "Another Department", "description": "Another department description", "admin_name": "New Admin", "admin_email": "newadmin@temple.com", "admin_phone": "7654321098", "admin_password": "newadmin123"}
{"message": "Department created successfully", "department_id": 1}


7
View Specific Department
/api/departments/:department_id
GET
Fetch detailed department data.
Path param: department_id=1
{"department_id": 1, "name": "Another Department", "num_employees": 3, "shifts": [...], "duty_points": [...], "current_employees": [...], "current_shift": {...}}


8
List Users
/api/users
GET
Filter users by role, department, or name.
Query params: role=Employee&department_id=1&name=Test
[{"user_id": 3, "name": "Test Employee", "email": "testemp@temple.com", "phone": "8765432109", "role": "Employee", "department_id": 1}]


Integration Notes:

Dashboard: Use GET /api/departments to display total departments, employees, shifts, and duty points. Aggregate user counts with GET /api/users?role=....
Forms: Implement user creation with role selection (dropdown: SuperAdmin, DepartmentAdmin, Employee) and department_id for Employees. For department creation, provide options to select an existing admin or enter new admin details.
Error Handling: Display validation errors (e.g., “Invalid role” for 400) and handle duplicate emails (500 with details).


2. DepartmentAdmin
Role Overview: Manages a specific department, setting up duty points, shifts, and assigning employees.
User Journey:

Login: Authenticate to access department management.
View Dashboard: See department stats, current shift, duty points, and assigned employees.
Create Duty Points: Define locations for employee duties.
Create Shifts: Set up shift schedules.
Assign Employees: Select duty point, shift, and free employees for assignments.
Monitor Duty Points and Shifts: View current assignments and shift schedules.
Check Free Employees: Identify available employees for shift assignments.

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
{"email": "testadmin@temple.com", "password": "admin123"}
{"message": "Logged in successfully", "user": {"user_id": 2, "role": "DepartmentAdmin"}}


2
View Dashboard
/api/departments/:department_id
GET
Fetch department stats, shifts, duty points, and current employees.
Path param: department_id=1
{"department_id": 1, "name": "Another Department", "num_employees": 3, "shifts": [...], "duty_points": [...], "current_employees": [...], "current_shift": {...}}


3
Create Duty Point
/api/duty_points
POST
Define a duty point.
{"name": "YSK 1", "description": "Main altar for daily pooja", "coordinate": "12.34,56.78", "department_id": 1}
{"message": "Duty point created successfully", "duty_point_id": 1}


4
Create Shift
/api/shifts
POST
Define a shift schedule.
{"name": "Day Shift", "department_id": 1, "start_time": "00:00:00", "end_time": "16:00:00", "duration": 8.0}
{"message": "Shift created successfully", "shift_id": 1}


5
List Duty Points
/api/duty_points/:department_id
GET
View duty points and current assignments.
Path param: department_id=1
[{"duty_point_id": 1, "name": "YSK 1", "description": "Main altar for daily pooja (Coordinate: 12.34,56.78)", "num_people": 2, "current_shift": "Day Shift"}]


6
List Shifts
/api/shifts/:department_id
GET
View shift schedules.
Path param: department_id=1
[{"shift_id": 1, "name": "Day Shift", "start_time": "00:00:00", "end_time": "16:00:00", "duration": 8}]


7
Get Free Employees
/api/free_employees/:department_id
GET
List employees available for a shift and date range.
Path param: department_id=1, Query params: shift_id=1&start_date=2025-06-21&end_date=2025-06-30
[{"user_id": 6, "name": "Employee Three", "phone": "9876543213", "email": "emp3@temple.com"}]


8
Assign Employee
/api/shift_assignments
POST
Assign an employee to a shift.
{"duty_point_id": 1, "shift_id": 1, "employee_id": 4, "department_id": 1, "start_date": "2025-06-01", "end_date": "2025-06-20"}
{"message": "Assignment created successfully", "assignment_id": 1}


Integration Notes:

Dashboard: Use GET /api/departments/:department_id to display department stats, current shift, and assigned employees.
Assignment Flow:
Fetch duty points (GET /api/duty_points/:id).
Fetch shifts (GET /api/shifts/:id).
Fetch free employees (GET /api/free_employees/:id) based on selected shift and dates.
Submit assignment (POST /api/shift_assignments).


UI: Implement a wizard-like interface for assignments (select duty point → select shift → select employee).
Error Handling: Handle 400 errors for conflicts (e.g., “Employee has conflicting assignment”) by prompting alternative selections.


3. Employee
Role Overview: Performs duties at assigned duty points during scheduled shifts, with minimal system interaction.
User Journey:

Login: Authenticate to view assignments.
View Dashboard: See current and upcoming shift assignments, including duty point and shift details.
View Department Info: Access basic department details (optional).

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
{"message": "Logged in successfully", "user": {"user_id": 4, "role": "Employee"}}


2
View Assignments
/api/departments/:department_id
GET
Fetch current and upcoming assignments via current_employees.
Path param: department_id=1
{"department_id": 1, "current_employees": [{"user_id": 4, "name": "Test Employee", "phone": "8765432109", "email": "testemp@temple.com", "duty_point_id": 1}]}, ...


3
View Department Info
/api/departments/:department_id
GET
Fetch basic department details (optional).
Path param: department_id=1
{"department_id": 1, "name": "Another Department", ...}


Integration Notes:

Dashboard: Use GET /api/departments/:department_id to extract current_employees for the logged-in employee’s assignments.
UI: Keep the interface minimal, showing only assignment details (duty point, shift, dates).
Future Enhancement: Consider a custom endpoint (e.g., GET /api/assignments/:user_id) for employee-specific assignments if needed.


Frontend Integration Guidelines
Setup

Backend: Ensure the backend is running with app.js (version ID: c20366c5-353f-4a5f-aaea-3e5f5c76617d):
node app.js


Dependencies: Install Node.js packages:
npm install express mysql2 bcryptjs body-parser


Database: Set up the temple_management database with the provided SQL schema. Verify the SuperAdmin user (superadmin@temple.com, password: superadmin).

Clear tables for testing:
TRUNCATE TABLE Users;
TRUNCATE TABLE Departments;
TRUNCATE TABLE DutyPoints;
TRUNCATE TABLE Shifts;
TRUNCATE TABLE ShiftAssignments;
INSERT INTO Users (name, email, phone, password, role) 
VALUES ('Super Admin', 'superadmin@temple.com', '1234567890', '$2b$10$Ma7FG4/qgEmCd6saGBjLy.cM9bEO6sWOUMMhxuFrc2oF7XhAzrlWy', 'SuperAdmin');





Integration Tips

Authentication: Store user_id and role from POST /api/login in local storage or session for role-based UI rendering.
Dynamic IDs: Capture IDs from API responses (e.g., user_id, department_id) for subsequent calls instead of hardcoding.
Time Zone: All API responses use IST (UTC+5:30). Ensure frontend displays times in IST (e.g., using JavaScript’s toLocaleTimeString with timeZone: 'Asia/Kolkata').
Pagination: For large datasets (e.g., GET /api/users), implement pagination on the frontend if the backend adds support later.
Responsive UI: Design dashboards to be responsive, with clear sections for stats, lists, and forms.

Testing

Run curl commands manually to verify responses.
Test edge cases (e.g., duplicate emails, invalid department_id, conflicting assignments).
Verify time-based queries (e.g., current_employees) at different times to ensure IST handling.

Security

Currently, no authentication is enforced. For production:
Uncomment session checks in app.js.
Restrict API access based on role (e.g., only SuperAdmin for POST /api/departments).


Validate inputs on the frontend to prevent bad requests (e.g., ensure department_id is provided for Employees).


Conclusion
This guide provides a structured API flow for each user role, aligning with their features and user journey. Frontend developers can use the listed endpoints to build dashboards, forms, and assignment workflows, ensuring a seamless integration with the Temple Management Application. For further details, refer to the Postman collection or backend documentation.
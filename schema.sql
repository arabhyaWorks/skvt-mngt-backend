CREATE DATABASE skvt_mngt;
USE skvt_mngt;

-- Set timezone to IST (UTC+5:30)
-- SET time_zone = '+05:30';

-- Disable foreign key checks to handle circular dependencies
SET FOREIGN_KEY_CHECKS = 0;

-- Users Table
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('SuperAdmin', 'DepartmentAdmin', 'Employee') NOT NULL,
    department_id INT,
    designation VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES Departments(department_id) ON DELETE SET NULL
);

-- Departments Table
CREATE TABLE Departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    admin_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES Users(user_id) ON DELETE SET NULL
);

-- DutyPoints Table
CREATE TABLE DutyPoints (
    duty_point_id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES Departments(department_id) ON DELETE CASCADE
);

-- Shifts Table
CREATE TABLE Shifts (
    shift_id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration DECIMAL(4,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES Departments(department_id) ON DELETE CASCADE
);

-- ShiftAssignments Table
CREATE TABLE ShiftAssignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    duty_point_id INT NOT NULL,
    shift_id INT NOT NULL,
    employee_id INT NOT NULL,
    assignment_type ENUM('OneTime', 'Recurring') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    specific_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (duty_point_id) REFERENCES DutyPoints(duty_point_id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES Shifts(shift_id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Insert a default Super Admin
INSERT INTO Users (name, email, phone, password, role) 
VALUES ('Super Admin', 'superadmin@temple.com', '1234567890', '$2b$10$Ma7FG4/qgEmCd6saGBjLy.cM9bEO6sWOUMMhxuFrc2oF7XhAzrlWy', 'SuperAdmin');
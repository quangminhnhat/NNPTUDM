const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");

class AdminMiscService {
  /**
   * Register a new user with role-specific data
   * @param {Object} userData - User registration data
   * @param {string} connectionString - Database connection string
   * @returns {Object} Success response
   */
  static async registerUser(userData, connectionString) {
    try {
      console.log("Processing registration for:", userData.email);
      const {
        Name: username,
        fullName,
        email,
        birthday: birth,
        phone,
        Address: address,
        subject,
        salary,
        Password,
      } = userData;

      // Input validation
      if (
        !username ||
        !email ||
        !fullName ||
        !birth ||
        !phone ||
        !address ||
        !subject ||
        !Password
      ) {
        console.log("Missing required fields:", {
          username,
          email,
          fullName,
          birth,
          phone,
          address,
          subject,
        });
        const error = new Error("All fields are required");
        error.statusCode = 400;
        throw error;
      }

      const hashpassword = await bcrypt.hash(Password, 10);
      const role = this.mapRole[subject];

      if (!role) {
        console.log("Invalid subject:", subject);
        const error = new Error("Invalid subject selection");
        error.statusCode = 400;
        throw error;
      }

      const handleSqlError = (err) => {
        console.error("Insert error:", err);
        if (err.code === "ER_DUP_ENTRY") {
          const error = new Error("Email or username already exists");
          error.statusCode = 400;
          throw error;
        }
        if (err.code === "ER_NO_REFERENCED_ROW") {
          const error = new Error("Invalid reference data");
          error.statusCode = 400;
          throw error;
        }
        const error = new Error("Registration failed. Please try again later.");
        error.statusCode = 500;
        throw error;
      };

      // The user's personal information (full_name, email, etc.) should be in the 'users' table.
      // The role-specific tables (students, teachers, admins) only need the user_id to link back to the users table.
      const userInsertQuery = `
        INSERT INTO users (username, password, role, full_name, email, phone_number, address, date_of_birth, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE());
      `;
      const userValues = [
        username,
        hashpassword,
        role,
        fullName,
        email,
        phone,
        address,
        birth,
      ];

      if (role === "student") {
        const insertQuery = `
        BEGIN TRANSACTION;
        ${userInsertQuery}

        DECLARE @NewUserId INT;
        SET @NewUserId = SCOPE_IDENTITY();

        INSERT INTO students (user_id, created_at, updated_at)
        VALUES (@NewUserId, GETDATE(), GETDATE());

        COMMIT TRANSACTION;
      `;

        return new Promise((resolve, reject) => {
          sql.query(connectionString, insertQuery, userValues, (err, result) => {
            if (err) {
              handleSqlError(err);
              reject(err);
              return;
            }
            console.log("Student registered:", result);
            resolve({ success: true, message: "Registration successful" });
          });
        });
      } else if (role === "teacher") {
        // Add salary to the user insert query for teachers
        const teacherUserInsertQuery = `
          INSERT INTO users (username, password, role, full_name, email, phone_number, address, date_of_birth, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE());
        `;
        const teacherUserValues = [...userValues, salary || null];

        const insertQuery = `
        BEGIN TRANSACTION;
        ${teacherUserInsertQuery}

        DECLARE @NewUserId INT;
        SET @NewUserId = SCOPE_IDENTITY();

        INSERT INTO teachers (user_id, salary, created_at, updated_at)
        VALUES (@NewUserId, ?, GETDATE(), GETDATE());

        COMMIT TRANSACTION;
      `;

        return new Promise((resolve, reject) => {
          sql.query(connectionString, insertQuery, teacherUserValues, (err, result) => {
            if (err) {
              handleSqlError(err);
              reject(err);
              return;
            }
            console.log("Teacher registered:", result);
            resolve({ success: true, message: "Registration successful" });
          });
        });
      } else if (role === "admin") {
        const insertQuery = `
        BEGIN TRANSACTION;
        ${userInsertQuery}

        DECLARE @NewUserId INT;
        SET @NewUserId = SCOPE_IDENTITY();

        INSERT INTO admins (user_id, created_at, updated_at)
        VALUES (@NewUserId, GETDATE(), GETDATE());

        COMMIT TRANSACTION;
      `;

        return new Promise((resolve, reject) => {
          sql.query(connectionString, insertQuery, userValues, (err, result) => {
            if (err) {
              handleSqlError(err);
              reject(err);
              return;
            }
            console.log("Admin registered:", result);
            resolve({ success: true, message: "Registration successful" });
          });
        });
      }
    } catch (error) {
      if (error.code === "ERR_HTTP_HEADERS_SENT") {
        console.log("Headers already sent, response already handled");
        throw error;
      }

      console.error("Error during registration:", error);
      if (error.statusCode) {
        throw error;
      }
      const newError = new Error("Registration failed. Please try again later.");
      newError.statusCode = 500;
      throw newError;
    }
  }
}

// Static property for role mapping
AdminMiscService.mapRole = {
  subject1: "student",
  subject2: "teacher",
  subject3: "admin",
};

module.exports = AdminMiscService;
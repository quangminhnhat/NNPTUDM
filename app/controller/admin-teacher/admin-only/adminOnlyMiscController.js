const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const { authenticateRole } = require("../../../middleware/roleAuth");
const multer = require("multer");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const upload = require("../../../middleware/upload");
const courseImageUpload = require("../../../middleware/courseImageUpload");
const executeQuery = require("../../../middleware/executeQuery");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../../../middleware/auth");
const router = express.Router();


const mapRole = {
  subject1: "student",
  subject2: "teacher",
  subject3: "admin",
};

router.get(
  "/register",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("register.ejs", {
      user: req.user,
    });
  }
);

router.post(
  "/register",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    // Avoid sending multiple responses
    let hasResponded = false;
    const sendResponse = (statusCode, message) => {
      if (!hasResponded) {
        hasResponded = true;
        if (statusCode === 200) {
          return res.redirect("/login");
        }
        res.status(statusCode).send(message);
      }
    };

    try {
      console.log("Hitting registration endpoint with body:", req.body);
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
      } = req.body;

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
        return sendResponse(400, "All fields are required");
      }

      console.log("Processing registration for:", email);
      const hashpassword = await bcrypt.hash(Password, 10);
      const role = mapRole[subject];

      if (!role) {
        console.log("Invalid subject:", subject);
        return sendResponse(400, "Invalid subject selection");
      }

      const handleSqlError = (err) => {
        console.error("Insert error:", err);
        if (err.code === "ER_DUP_ENTRY") {
          return sendResponse(400, "Email or username already exists");
        }
        if (err.code === "ER_NO_REFERENCED_ROW") {
          return sendResponse(400, "Invalid reference data");
        }
        return sendResponse(
          500,
          "Registration failed. Please try again later."
        );
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

        sql.query(connectionString, insertQuery, userValues, (err, result) => {
          if (err) return handleSqlError(err);
          console.log("Student registered:", result);
          return sendResponse(200, "Registration successful");
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

        sql.query(connectionString, insertQuery, teacherUserValues, (err, result) => {
          if (err) return handleSqlError(err);
          console.log("Teacher registered:", result);
          return sendResponse(200, "Registration successful");
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

        sql.query(connectionString, insertQuery, userValues, (err, result) => {
          if (err) return handleSqlError(err);
          console.log("Admin registered:", result);
          return sendResponse(200, "Registration successful");
        });
      }
    } catch (error) {
      if (error.code === "ERR_HTTP_HEADERS_SENT") {
        console.log("Headers already sent, response already handled");
        return;
      }

      console.error("Error during registration:", error);
      return sendResponse(500, "Registration failed. Please try again later.");
    }
  }
);

module.exports = router;
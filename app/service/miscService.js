const executeQuery = require("./executeQueryservice");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const connectionString = process.env.CONNECTION_STRING;

const mapRole = {
  student: "student",
  teacher: "teacher",
  staff: "admin",
};

/**
 * Get material by ID
 * @param {number} materialId - The ID of the material
 * @returns {Object|null} - The material data or null if not found
 */
async function getMaterialById(materialId) {
  try {
    const query = "SELECT file_name, file_path FROM materials WHERE id = ?";
    const result = await executeQuery(query, [materialId]);
    return result.length ? result[0] : null;
  } catch (error) {
    console.error("Error fetching material:", error);
    throw error;
  }
}

/**
 * Get homepage courses
 * @returns {Array} - List of courses
 */
async function getHomepageCourses() {
  try {
    const query = `
      SELECT
        id,
        course_name AS title,
        description AS course_desc,
        image_path AS img,
        link
      FROM courses
      ORDER BY created_at DESC
    `;
    const courses = await executeQuery(query);
    console.log("Homepage courses images:", courses.map(c => c.img));
    return courses;
  } catch (error) {
    console.error("Error loading homepage courses:", error);
    throw error;
  }
}

/**
 * Register a new user
 * @param {Object} userData - User data object
 * @returns {string} - Success message or error
 */
async function registerUser(userData) {
  try {
    console.log("Registering user with data:", userData);
    const {
      username,
      fullName,
      email,
      birth,
      phone,
      address,
      subject,
      salary,
      password,
    } = userData;

    const missingFields = [];
    if (!username) missingFields.push('username');
    if (!email) missingFields.push('email');
    if (!fullName) missingFields.push('fullName');
    if (!birth) missingFields.push('birth');
    if (!phone) missingFields.push('phone');
    if (!address) missingFields.push('address');
    if (!subject) missingFields.push('subject');
    if (!password) missingFields.push('password');

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const hashpassword = await bcrypt.hash(password, 10);
    const role = mapRole[subject];

    if (!role) {
      throw new Error("Invalid subject selection");
    }

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
            if (err.code === "ER_DUP_ENTRY") {
              reject(new Error("Email or username already exists"));
            } else if (err.code === "ER_NO_REFERENCED_ROW") {
              reject(new Error("Invalid reference data"));
            } else {
              reject(new Error("Registration failed. Please try again later."));
            }
          } else {
            console.log("Student registered:", result);
            resolve("Registration successful");
          }
        });
      });
    } else if (role === "teacher") {
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
            if (err.code === "ER_DUP_ENTRY") {
              reject(new Error("Email or username already exists"));
            } else if (err.code === "ER_NO_REFERENCED_ROW") {
              reject(new Error("Invalid reference data"));
            } else {
              reject(new Error("Registration failed. Please try again later."));
            }
          } else {
            console.log("Teacher registered:", result);
            resolve("Registration successful");
          }
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
            if (err.code === "ER_DUP_ENTRY") {
              reject(new Error("Email or username already exists"));
            } else if (err.code === "ER_NO_REFERENCED_ROW") {
              reject(new Error("Invalid reference data"));
            } else {
              reject(new Error("Registration failed. Please try again later."));
            }
          } else {
            console.log("Admin registered:", result);
            resolve("Registration successful");
          }
        });
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    throw error;
  }
}

module.exports = {
  getMaterialById,
  getHomepageCourses,
  registerUser,
};
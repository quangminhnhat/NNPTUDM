const path = require("path");
const sql = require("msnodesqlv8");

class AdminTeacherUploadMaterialService {
  /**
   * Upload material file and save to database
   * @param {number} courseId - The course ID
   * @param {Object} file - The uploaded file object
   * @param {string} connectionString - Database connection string
   * @returns {Object} Success response
   */
  static async uploadMaterial(courseId, file, connectionString) {
    try {
      if (!courseId || !file) {
        const error = new Error("Missing course_id or file.");
        error.statusCode = 400;
        throw error;
      }

      const insertQuery = `
        INSERT INTO materials (course_id, file_name, file_path, uploaded_at)
        VALUES (?, ?, ?, GETDATE())
      `;

      const values = [
        courseId,
        file.originalname,
        path.join("uploads", file.filename),
        file.mimetype,
      ];

      return new Promise((resolve, reject) => {
        sql.query(connectionString, insertQuery, values, (err) => {
          if (err) {
            console.error("Insert material error:", err);
            const error = new Error("Database insert error");
            error.statusCode = 500;
            reject(error);
            return;
          }
          console.log("Material uploaded successfully.");
          resolve({ success: true, message: "File uploaded and saved to database." });
        });
      });
    } catch (error) {
      console.error("Upload material error:", error);
      if (error.statusCode) {
        throw error;
      }
      const newError = new Error("File upload failed");
      newError.statusCode = 500;
      throw newError;
    }
  }
}

module.exports = AdminTeacherUploadMaterialService;
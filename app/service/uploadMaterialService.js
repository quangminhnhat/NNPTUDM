const path = require("path");
const sql = require("msnodesqlv8");
const connectionString = process.env.CONNECTION_STRING;

class UploadMaterialService {
  // Upload material file and save to database
  async uploadMaterial(course_id, file) {
    // Input validation
    if (!course_id || !file) {
      const error = new Error("Missing course_id or file.");
      error.status = 400;
      throw error;
    }

    const insertQuery = `
      INSERT INTO materials (course_id, file_name, file_path, uploaded_at)
      VALUES (?, ?, ?, GETDATE())
    `;

    const values = [
      course_id,
      file.originalname,
      path.join("uploads", file.filename),
      file.mimetype,
    ];

    return new Promise((resolve, reject) => {
      sql.query(connectionString, insertQuery, values, (err) => {
        if (err) {
          console.error("Insert material error:", err);
          const error = new Error("Database insert error");
          error.status = 500;
          reject(error);
        } else {
          console.log("Material uploaded successfully.");
          resolve({
            success: true,
            message: "File uploaded and saved to database."
          });
        }
      });
    });
  }
}

module.exports = new UploadMaterialService();
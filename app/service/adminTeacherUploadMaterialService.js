const MaterialModel = require("../model/MaterialModel");

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

      return await MaterialModel.uploadMaterial(courseId, file);
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
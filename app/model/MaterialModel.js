const executeQuery = require("../service/executeQueryservice");
const path = require("path");
const fs = require("fs");

class MaterialModel {
  /**
   * Get all materials with course information
   * @returns {Promise<Array>} Array of materials with course names
   */
  static async getAllMaterials() {
    const query = `
      SELECT m.*, c.course_name
      FROM materials m
      JOIN courses c ON m.course_id = c.id
      ORDER BY m.uploaded_at DESC
    `;
    const materials = await executeQuery(query);
    return materials;
  }

  /**
   * Upload a new material
   * @param {number} courseId - Course ID
   * @param {Object} file - Uploaded file object
   * @returns {Promise<Object>} Success message
   */
  static async uploadMaterial(courseId, file) {
    // Verify course exists
    const courseCheckQuery = "SELECT id FROM courses WHERE id = ?";
    const courseResult = await executeQuery(courseCheckQuery, [courseId]);

    if (!courseResult || courseResult.length === 0) {
      const error = new Error("Course not found");
      error.status = 404;
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
    ];

    await executeQuery(insertQuery, values);

    return { success: true, message: "Material uploaded successfully" };
  }

  /**
   * Get material data for editing
   * @param {number} materialId - Material ID
   * @returns {Promise<Object>} Material data and available courses
   */
  static async getMaterialForEdit(materialId) {
    // Get material details with course info
    const materialQuery = `
      SELECT m.*, c.course_name
      FROM materials m
      JOIN courses c ON m.course_id = c.id
      WHERE m.id = ?
    `;

    // Get available courses for dropdown
    const courseQuery = `
      SELECT id, course_name
      FROM courses
      WHERE end_date >= GETDATE()
      ORDER BY course_name
    `;

    const [material, courses] = await Promise.all([
      executeQuery(materialQuery, [materialId]),
      executeQuery(courseQuery),
    ]);

    if (!material.length) {
      const error = new Error("Material not found");
      error.status = 404;
      throw error;
    }

    return {
      material: material[0],
      courses,
    };
  }

  /**
   * Update an existing material
   * @param {number} materialId - Material ID
   * @param {number} courseId - New course ID
   * @param {Object} file - New uploaded file (optional)
   * @returns {Promise<Object>} Success message
   */
  static async updateMaterial(materialId, courseId, file) {
    // Get current material info
    const currentMaterial = await executeQuery(
      "SELECT * FROM materials WHERE id = ?",
      [materialId]
    );

    if (!currentMaterial.length) {
      const error = new Error("Material not found");
      error.status = 404;
      throw error;
    }

    let updateQuery = "UPDATE materials SET course_id = ?";
    let queryParams = [courseId];

    // If new file uploaded, update file info
    if (file) {
      // Delete old file
      const oldFilePath = path.join(__dirname, "..", currentMaterial[0].file_path);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      // Update with new file info
      updateQuery += ", file_name = ?, file_path = ?";
      queryParams.push(
        file.originalname,
        path.join("uploads", file.filename)
      );
    }

    updateQuery += ", updated_at = GETDATE() WHERE id = ?";
    queryParams.push(materialId);

    await executeQuery(updateQuery, queryParams);
    return { message: "Material updated successfully" };
  }

  /**
   * Delete a material
   * @param {number} materialId - Material ID
   * @returns {Promise<Object>} Success message
   */
  static async deleteMaterial(materialId) {
    // Get the file path from the database
    const getFilePathQuery = "SELECT file_path FROM materials WHERE id = ?";
    const result = await executeQuery(getFilePathQuery, [materialId]);

    if (!result || result.length === 0) {
      const error = new Error("Material not found");
      error.status = 404;
      throw error;
    }

    const relativePath = result[0].file_path;
    // Correctly construct the absolute path from the project root
    const absolutePath = path.join(__dirname, "..", relativePath);

    // Delete the record from the database
    const deleteQuery = "DELETE FROM materials WHERE id = ?";
    await executeQuery(deleteQuery, [materialId]);

    // Delete the file from the disk
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    return { message: "Material deleted successfully" };
  }

  /**
   * Get courses for material upload
   * @returns {Promise<Array>} Available courses
   */
  static async getCoursesForUpload() {
    const query = `
      SELECT id, course_name
      FROM courses
      WHERE end_date >= GETDATE()
      ORDER BY course_name
    `;

    return await executeQuery(query);
  }

  /**
   * Get material by ID
   * @param {number} materialId - Material ID
   * @returns {Promise<Object>} Material data
   */
  static async getMaterialById(materialId) {
    const query = `
      SELECT m.*, c.course_name
      FROM materials m
      JOIN courses c ON m.course_id = c.id
      WHERE m.id = ?
    `;

    const result = await executeQuery(query, [materialId]);

    if (!result.length) {
      const error = new Error("Material not found");
      error.status = 404;
      throw error;
    }

    return result[0];
  }
}

module.exports = MaterialModel;
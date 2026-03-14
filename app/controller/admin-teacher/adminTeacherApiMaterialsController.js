const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../middleware/roleAuth");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING; 
const upload = require("../../middleware/upload");
const executeQuery = require("../../middleware/executeQuery");
const {
  checkAuthenticated,
} = require("../../middleware/auth");
const router = express.Router();

/**
 * @swagger
 * /api/materials/{id}/edit:
 *   get:
 *     summary: Get material for editing
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Material ID
 *     responses:
 *       200:
 *         description: Material data for editing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 material:
 *                   type: object
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Material not found
 *       500:
 *         description: Database error
 */
router.get(
  "/materials/:id/edit",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const materialId = req.params.id;

      // Get material details with course info
      const query = `
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
        executeQuery(query, [materialId]),
        executeQuery(courseQuery),
      ]);

      if (!material.length) {
        return res.status(404).json({ error: "Material not found" });
      }

      res.json({
        material: material[0],
        courses,
      });
    } catch (error) {
      console.error("Error loading material edit form:", error);
      res.status(500).json({ error: "Error loading material edit form" });
    }
  }
);

/**
 * @swagger
 * /api/materials/{id}:
 *   post:
 *     summary: Update material
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Material ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               course_id:
 *                 type: integer
 *                 description: Course ID
 *               material:
 *                 type: string
 *                 format: binary
 *                 description: New material file (optional)
 *     responses:
 *       200:
 *         description: Material updated successfully
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Material not found
 *       500:
 *         description: Update error
 */
router.post(
  "/materials/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  upload.single("material"),
  async (req, res) => {
    try {
      const materialId = req.params.id;
      const { course_id } = req.body;
      const file = req.file;

      // Get current material info
      const currentMaterial = await executeQuery(
        "SELECT * FROM materials WHERE id = ?",
        [materialId]
      );

      if (!currentMaterial.length) {
        return res.status(404).json({ error: "Material not found" });
      }

      let updateQuery = "UPDATE materials SET course_id = ?";
      let queryParams = [course_id];

      // If new file uploaded, update file info
      if (file) {
        // Delete old file
        const oldFilePath = path.join(__dirname, currentMaterial[0].file_path);
        fs.unlink(oldFilePath, (err) => {
          if (err) console.error("Error deleting old file:", err);
        });

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
      res.json({ message: "Material updated successfully" });
    } catch (error) {
      console.error("Error updating material:", error);

      // Delete uploaded file if there was an error
      if (req.file) {
        const filePath = path.join(__dirname, "uploads", req.file.filename);
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      res.status(500).json({ error: "Failed to update material" });
    }
  }
);
  

/**
 * @swagger
 * /api/materials/{id}:
 *   delete:
 *     summary: Delete material
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Material ID
 *     responses:
 *       200:
 *         description: Material deleted successfully
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Material not found
 *       500:
 *         description: Delete error
 */
router.delete(
  "/materials/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    const materialId = req.params.id;
    try {
      // 1. Get the file path from the database
      const getFilePathQuery = "SELECT file_path FROM materials WHERE id = ?";
      const result = await executeQuery(getFilePathQuery, [materialId]);

      if (!result || result.length === 0) {
        return res.status(404).json({ error: "Material not found." });
      }

      const relativePath = result[0].file_path;
      // Correctly construct the absolute path from the project root
      const absolutePath = path.join(__dirname, "..", relativePath);

      // 2. Delete the record from the database
      const deleteQuery = "DELETE FROM materials WHERE id = ?";
      await executeQuery(deleteQuery, [materialId]);

      // 3. Delete the file from the disk
      fs.unlink(absolutePath, (fsErr) => {
        if (fsErr) {
          // Log the error but don't block the user, as the DB record is gone.
          console.error("File deletion error:", fsErr);
        }
        res.json({ message: "Material deleted successfully." });
      });
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(500).json({ error: "Failed to delete material." });
    }
  }
);

/**
 * @swagger
 * /api/upload:
 *   get:
 *     summary: Get courses for material upload
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       course_name:
 *                         type: string
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Database error
 */
router.get(
  "/upload",
  authenticateRole(["admin", "teacher"]),
  checkAuthenticated,
  async (req, res) => {
    try {
      const courses = await executeQuery("SELECT id, course_name FROM courses ORDER BY course_name");
      res.json({ courses: courses });
    } catch (error) {
      console.error("Error loading upload material page:", error);
      res.status(500).json({ error: "Error loading page data." });
    }
  }
);

module.exports = router;
const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const upload = require("../../service/uploadservice");
const executeQuery = require("../../service/executeQueryservice");
const materialsService = require("../../service/materialsService");
const {
  checkAuthenticated,
} = require("../../service/authservice");
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
      const data = await materialsService.getMaterialForEdit(materialId);
      res.json(data);
    } catch (error) {
      console.error("Error loading material edit form:", error);
      res.status(error.status || 500).json({ error: error.message || "Error loading material edit form" });
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

      const result = await materialsService.updateMaterial(materialId, course_id, file);
      res.json(result);
    } catch (error) {
      console.error("Error updating material:", error);

      // Delete uploaded file if there was an error
      if (req.file) {
        const filePath = path.join(__dirname, "uploads", req.file.filename);
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      res.status(error.status || 500).json({ error: error.message || "Failed to update material" });
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
      const result = await materialsService.deleteMaterial(materialId);
      res.json(result);
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to delete material" });
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
      const data = await materialsService.getCoursesForUpload();
      res.json(data);
    } catch (error) {
      console.error("Error loading upload material page:", error);
      res.status(error.status || 500).json({ error: error.message || "Error loading page data" });
    }
  }
);

module.exports = router;
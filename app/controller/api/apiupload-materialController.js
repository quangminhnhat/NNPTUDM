const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const connectionString = process.env.CONNECTION_STRING; 
const upload = require("../../service/uploadservice");
const courseImageUpload = require("../../service/courseImageUploadservice");
const {
  checkAuthenticated,
} = require("../../service/authservice");
const uploadMaterialService = require("../../service/uploadMaterialService");
const router = express.Router();






/**
 * @swagger
 * /api/upload-material:
 *   post:
 *     summary: Upload material
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               course_id:
 *                 type: string
 *               material:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Material uploaded successfully
 *       500:
 *         description: Upload error
 */
router.post(
  "/upload-material",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  upload.single("material"),
  async (req, res) => {
    try {
      const { course_id } = req.body;
      const file = req.file;

      const result = await uploadMaterialService.uploadMaterial(course_id, file);

      res.json(result);
    } catch (error) {
      console.error("Upload material error:", error);
      res.status(error.status || 500).json({ error: error.message || "Upload error" });
    }
  }
);


module.exports = router;

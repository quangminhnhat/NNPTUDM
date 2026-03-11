const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../middleware/roleAuth");
const connectionString = process.env.CONNECTION_STRING; 
const upload = require("../../middleware/upload");
const courseImageUpload = require("../../middleware/courseImageUpload");
const {
  checkAuthenticated,
} = require("../../middleware/auth");
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
  (req, res) => {
    const { course_id } = req.body;
    const file = req.file;

    if (!course_id || !file) {
      return res.status(400).json({ error: "Missing course_id or file." });
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

    sql.query(connectionString, insertQuery, values, (err) => {
      if (err) {
        console.error("Insert material error:", err);
        return res.status(500).json({ error: "Database insert error" });
      }
      console.log("Material uploaded successfully.");
      res.json({ success: true, message: "File uploaded and saved to database." });
    });
  }
);

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
 *                 description: Course ID
 *               material:
 *                 type: string
 *                 format: binary
 *                 description: Material file
 *     responses:
 *       200:
 *         description: Material uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - missing course_id or file
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Database insert error
 */
router.post(
  "/upload-material",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  upload.single("material"),
  (req, res) => {
    const { course_id } = req.body;
    const file = req.file;

    if (!course_id || !file) {
      return res.status(400).json({ error: "Missing course_id or file." });
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

    sql.query(connectionString, insertQuery, values, (err) => {
      if (err) {
        console.error("Insert material error:", err);
        return res.status(500).json({ error: "Database insert error" });
      }
      console.log("Material uploaded successfully.");
      res.json({ success: true, message: "File uploaded and saved to database." });
    });
  }
);


module.exports = router;

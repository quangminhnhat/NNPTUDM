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
 * /api/materials:
 *   get:
 *     summary: Get all materials
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of materials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 materials:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/materials",
  checkAuthenticated,
  async (req, res) => {
    try {
      const query = `
        SELECT m.*, c.course_name 
        FROM materials m
        JOIN courses c ON m.course_id = c.id
        ORDER BY m.uploaded_at DESC
      `;
      const materials = await executeQuery(query);
      res.json(materials);
    } catch (error) {
      console.error("Fetch materials error:", error);
      res.status(500).json({ error: "Database error" });
    }
  }
);

module.exports = router;

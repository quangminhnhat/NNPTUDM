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
      const materials = await materialsService.getAllMaterials();
      res.json(materials);
    } catch (error) {
      console.error("Fetch materials error:", error);
      res.status(error.status || 500).json({ error: error.message || "Database error" });
    }
  }
);

module.exports = router;

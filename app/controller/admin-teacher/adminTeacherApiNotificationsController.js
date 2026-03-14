const express = require("express");
const app = express();
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../middleware/roleAuth");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING; 
const executeQuery = require("../../middleware/executeQuery");
const {
  checkAuthenticated,
} = require("../../middleware/auth");

const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Send a notification (Admin/Teacher only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - message
 *             properties:
 *               userId:
 *                 type: integer
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
router.post(
  "/notifications",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const { userId, message } = req.body;
      const senderId = req.user.id;
  
      if (!userId || !message) {
        return res.status(400).json({ error: "User and message are required." });
      }
  
      const insertQuery = `
        INSERT INTO notifications (user_id, message, sender_id)
        VALUES (?, ?, ?);
      `;
  
      await executeQuery(insertQuery, [userId, message, senderId]);
  
      console.log("Notification sent to user ID:", userId);
      res.json({ success: true, message: "Notification sent successfully." });
    } catch (error) {
      console.error("Insert notification error:", error);
      res.status(500).json({ error: "Failed to send notification." });
    }
  }
);

module.exports = router;
const express = require("express");
const app = express();
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../../service/executeQueryservice");
const notificationsService = require("../../service/notificationsService");
const {
  checkAuthenticated,
} = require("../../service/authservice");

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

      const result = await notificationsService.sendNotification(userId, message, senderId);
      res.json(result);
    } catch (error) {
      console.error("Insert notification error:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to send notification" });
    }
  }
);

module.exports = router;
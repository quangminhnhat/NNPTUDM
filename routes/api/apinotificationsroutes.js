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

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get("/notifications", checkAuthenticated, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === "admin") {
      query = `
              SELECT n.*,
                  receiver.full_name as receiver_name,
                  sender.full_name as sender_name
              FROM notifications n
              LEFT JOIN users receiver ON n.user_id = receiver.id
              LEFT JOIN users sender ON n.sender_id = sender.id
              ORDER BY n.created_at DESC
          `;
    } else {
      query = `
              SELECT n.*,
                  sender.full_name as sender_name
              FROM notifications n
              LEFT JOIN users sender ON n.sender_id = sender.id
              WHERE n.user_id = ?
              ORDER BY n.created_at DESC
          `;
      params = [req.user.id];
    }

    const notifications = await executeQuery(query, params);
    
    let users = [];
    if (req.user.role === "admin" || req.user.role === "teacher") {
      const userQuery = `
              SELECT u.id, u.full_name, u.role
              FROM users u
              ORDER BY u.full_name
          `;
      users = await executeQuery(userQuery);
    }

    res.json({
      user: req.user,
      notifications,
      users,
      messages: { success: req.flash('success'), error: req.flash('error') }
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).send("Error loading notifications");
  }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       500:
 *         description: Server error
 */
router.post("/notifications/:id/read", checkAuthenticated, async (req, res) => {
  try {
    const query = `
            UPDATE notifications 
            SET [read] = 1, 
                updated_at = GETDATE()
            WHERE id = ? AND user_id = ?
        `;
    await executeQuery(query, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted
 *       500:
 *         description: Server error
 */
router.delete("/notifications/:id", checkAuthenticated, async (req, res) => {
  try {
    await executeQuery("DELETE FROM notifications WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

module.exports = router;

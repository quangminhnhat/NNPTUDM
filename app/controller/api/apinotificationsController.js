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
    const data = await notificationsService.getAllNotifications(req.user.id, req.user.role);

    res.json({
      user: req.user,
      notifications: data.notifications,
      users: data.users,
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
    const result = await notificationsService.markAsRead(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(error.status || 500).json({ error: error.message || "Failed to update notification" });
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
    await notificationsService.deleteNotification(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(error.status || 500).json({ error: error.message || "Failed to delete notification" });
  }
});

module.exports = router;

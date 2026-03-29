const express = require("express");
const app = express();
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../service/roleAuthservice");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../service/executeQueryservice");
const notificationsService = require("../service/notificationsService");
const {
  checkAuthenticated,
} = require("../service/authservice");

const router = express.Router();

// Admin and teacher routes moved to admin-teacher/adminTeacherNotificationsController.js


router.get("/notifications", checkAuthenticated, async (req, res) => {
  try {
    const data = await notificationsService.getNotifications(req.user.id, req.user.role);

    res.render("notifications.ejs", {
      user: req.user,
      notifications: data.notifications,
      users: data.users
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).send("Error loading notifications");
  }
});

router.post("/notifications/:id/read", checkAuthenticated, async (req, res) => {
  try {
    const result = await notificationsService.markAsRead(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(error.status || 500).json({ error: error.message || "Failed to update notification" });
  }
});

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
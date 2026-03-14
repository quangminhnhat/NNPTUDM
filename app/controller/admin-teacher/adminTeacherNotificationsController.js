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

router.post(
  "/notifications",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const { userId, message } = req.body;
      const senderId = req.user.id;

      if (!userId || !message) {
        req.flash("error", "User and message are required.");
        return res.redirect("/notifications");
      }

      const insertQuery = `
        INSERT INTO notifications (user_id, message, sender_id)
        VALUES (?, ?, ?);
      `;

      await executeQuery(insertQuery, [userId, message, senderId]);

      console.log("Notification sent to user ID:", userId);
      req.flash("success", "Notification sent successfully.");
      res.redirect("/notifications");
    } catch (error) {
      console.error("Insert notification error:", error);
      req.flash("error", "Failed to send notification.");
      res.redirect("/notifications");
    }
  }
);

module.exports = router;
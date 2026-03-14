const express = require("express");
const app = express();
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../middleware/roleAuth");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING; 
const executeQuery = require("../middleware/executeQuery");
const {
  checkAuthenticated,
} = require("../middleware/auth");

const router = express.Router();

// Admin and teacher routes moved to admin-teacher/adminTeacherNotificationsController.js


router.get("/notifications", checkAuthenticated, async (req, res) => {
  try {
   
    res.render("notifications.ejs", {
      user: req.user,
    
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).send("Error loading notifications");
  }
});

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

router.delete("/notifications/:id", checkAuthenticated, async (req, res) => {
  try {
    await executeQuery("DELETE FROM notifications WHERE id = ?", [
      req.params.id,
    ]);
    res.redirect("/notifications");
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).send("Failed to delete notification");
  }
});

module.exports = router;
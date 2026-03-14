const express = require("express");
const { authenticateRole } = require("../middleware/roleAuth");
const { checkAuthenticated } = require("../middleware/auth");
const router = express.Router();

// Render-only routes: all CRUD logic moved to /api/scheduleRoutes.js

router.get(
  "/schedule",
  checkAuthenticated,
  (req, res) => {
    res.render("Schedule/schedule", { user: req.user });
  }
);

module.exports = router;
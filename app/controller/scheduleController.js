const express = require("express");
const { authenticateRole } = require("../service/roleAuthservice");
const { checkAuthenticated } = require("../service/authservice");
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
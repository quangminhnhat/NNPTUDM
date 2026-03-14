const express = require("express");
const { authenticateRole } = require("../../../middleware/roleAuth");
const { checkAuthenticated } = require("../../../middleware/auth");
const router = express.Router();

// Admin-only routes for schedule

router.get(
  "/schedule/new",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("Schedule/newSchedule", { user: req.user });
  }
);

router.get(
  "/schedules",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("Schedule/schedules", { user: req.user });
  }
);

router.get(
  "/schedules/:id/edit",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("Schedule/editSchedule", { user: req.user });
  }
);

module.exports = router;
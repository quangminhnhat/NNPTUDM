const express = require("express");
const { authenticateRole } = require("../../../middleware/roleAuth");
const { checkAuthenticated } = require("../../../middleware/auth");
const router = express.Router();

// Admin-only routes for courses

router.get("/courses/new", checkAuthenticated, authenticateRole("admin"), (req, res) => {
  res.render("courses/addCourse", { user: req.user });
});

router.get("/courses/:id/edit", checkAuthenticated, authenticateRole("admin"), (req, res) => {
  res.render("courses/editCourse", { user: req.user });
});

module.exports = router;
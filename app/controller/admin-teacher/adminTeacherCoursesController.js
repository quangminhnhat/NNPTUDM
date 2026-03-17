const express = require("express");
const { authenticateRole } = require("../../service/roleAuthservice");
const { checkAuthenticated } = require("../../service/authservice");
const router = express.Router();

// Admin and Teacher routes for courses

router.get("/courses/:id", checkAuthenticated, authenticateRole(["admin", "teacher"]), (req, res) => {
  res.render("courses/courseDetail", { user: req.user });
});

router.get("/courses", checkAuthenticated, authenticateRole(["admin", "teacher"]), (req, res) => {
  res.render("courses/courses", { user: req.user });
});

module.exports = router;
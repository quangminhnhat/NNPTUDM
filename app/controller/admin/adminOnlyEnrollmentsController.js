const express = require("express");
const { authenticateRole } = require("../../service/roleAuth");
const { checkAuthenticated } = require("../../service/auth");
const router = express.Router();

// Admin-only routes for enrollments

router.get(
  "/enrollments",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("enrollments/enrollments", { user: req.user });
  }
);

router.get(
  "/enrollments/new",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("enrollments/Addenrollments", { user: req.user });
  }
);

router.get(
  "/enrollments/:id/edit",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("enrollments/editEnrollment", { user: req.user });
  }
);

module.exports = router;
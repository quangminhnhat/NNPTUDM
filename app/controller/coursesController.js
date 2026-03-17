const express = require("express");
const { authenticateRole } = require("../service/roleAuthservice");
const { checkAuthenticated } = require("../service/authservice");
const router = express.Router();

// Render-only routes - all CRUD operations delegated to API endpoints

router.get("/course-detail/:id", async (req, res) => {
  res.render("courses/course-detail", { user: req.user });
});

router.get("/available-courses", checkAuthenticated, authenticateRole("student"), (req, res) => {
  res.render("courses/availableCourses", { user: req.user });
});

router.get("/my-courses", checkAuthenticated, (req, res) => {
  res.render("courses/my-courses", { user: req.user });
});

module.exports = router;
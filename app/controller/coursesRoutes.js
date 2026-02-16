const express = require("express");
const { authenticateRole } = require("../middleware/roleAuth");
const { checkAuthenticated } = require("../middleware/auth");
const router = express.Router();

// Render-only routes - all CRUD operations delegated to API endpoints

router.get("/course-detail/:id", async (req, res) => {
  res.render("courses/course-detail", { user: req.user });
});

router.get("/courses/new", checkAuthenticated, authenticateRole("admin"), (req, res) => {
  res.render("courses/addCourse", { user: req.user });
});

router.get("/courses/:id", checkAuthenticated, authenticateRole(["admin", "teacher"]), (req, res) => {
  res.render("courses/courseDetail", { user: req.user });
});

router.get("/courses/:id/edit", checkAuthenticated, authenticateRole("admin"), (req, res) => {
  res.render("courses/editCourse", { user: req.user });
});

router.get("/courses", checkAuthenticated, authenticateRole(["admin", "teacher"]), (req, res) => {
  res.render("courses/courses", { user: req.user });
});

router.get("/available-courses", checkAuthenticated, authenticateRole("student"), (req, res) => {
  res.render("courses/availableCourses", { user: req.user });
});

router.get("/my-courses", checkAuthenticated, (req, res) => {
  res.render("courses/my-courses", { user: req.user });
});

module.exports = router;
const express = require("express");
const { authenticateRole } = require("../middleware/roleAuth");
const { checkAuthenticated } = require("../middleware/auth");
const router = express.Router();

// Render-only routes - all CRUD operations delegated to API endpoints

// Render exam list page
router.get('/exams', checkAuthenticated, (req, res) => {
  res.render('exams/examList', { user: req.user });
});

// Render exam taking page
router.get('/exams/:assignmentId/take', checkAuthenticated, authenticateRole(['student']), (req, res) => {
  res.render('exams/examTake', { user: req.user, assignmentId: req.params.assignmentId });
});

// Teacher routes moved to admin-teacher/adminTeacherExamController.js

module.exports = router; 
      
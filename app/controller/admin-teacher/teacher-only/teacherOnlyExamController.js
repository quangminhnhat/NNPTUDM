const express = require("express");
const { authenticateRole } = require("../../../middleware/roleAuth");
const { checkAuthenticated } = require("../../../middleware/auth");
const router = express.Router();

// Teacher-only routes for exams

// Render new exam page
router.get('/exams/new', checkAuthenticated, authenticateRole(['teacher']), (req, res) => {
  res.render('exams/examNew', { user: req.user });
});

// Render new question page
router.get('/exams/:examId/questions/new', checkAuthenticated, authenticateRole(['teacher']), (req, res) => {
  res.render('exams/questionNew', { user: req.user, examId: req.params.examId });
});

// Render exam edit page
router.get('/exams/:examId/edit', checkAuthenticated, authenticateRole(['teacher']), (req, res) => {
  res.render('exams/examEdit', { user: req.user, examId: req.params.examId });
});

// Render question edit page
router.get('/questions/:questionId/edit', checkAuthenticated, authenticateRole(['teacher']), (req, res) => {
  res.render('exams/questionEdit', { user: req.user, questionId: req.params.questionId });
});

// Render exam assignments page
router.get('/exams/:examId/assign', checkAuthenticated, authenticateRole(['teacher']), (req, res) => {
  res.render('exams/examAssignments', { user: req.user, examId: req.params.examId });
});

// Render assignment scores page
router.get('/exams/assignments/:assignmentId/scores', checkAuthenticated, authenticateRole(['teacher']), (req, res) => {
  res.render('exams/assignmentScores', { user: req.user, assignmentId: req.params.assignmentId });
});

// Render grading page for exam attempt
router.get('/exams/attempts/:attemptId/grade', checkAuthenticated, authenticateRole(['teacher']), (req, res) => {
  res.render('exams/gradeAttempt', { user: req.user, attemptId: req.params.attemptId });
});

module.exports = router;
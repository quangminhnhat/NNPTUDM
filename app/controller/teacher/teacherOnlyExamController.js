const express = require("express");
const { authenticateRole } = require("../../service/roleAuthservice");
const { checkAuthenticated } = require("../../service/authservice");
const examsService = require("../../service/examsService");
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
router.get('/exams/:examId/assign', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const examId = req.params.examId;
    const userId = req.user.id;
    
    // Fetch exam data and available classes
    const data = await examsService.getExamAssignData(examId, userId);
    
    res.render('exams/examAssignments', { 
      user: req.user, 
      examId: examId,
      exam: data.exam,
      availableClasses: data.availableClasses
    });
  } catch (error) {
    console.error('Error rendering exam assignments page:', error);
    res.status(403).send('Access denied or exam not found');
  }
});

// Render assignment scores page
router.get('/exams/assignments/:assignmentId/scores', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;
    const userId = req.user.id;
    
    // Fetch assignment scores data
    const data = await examsService.getAssignmentScores(assignmentId, userId);
    
    res.render('exams/assignmentScores', { 
      user: req.user, 
      assignmentId: assignmentId,
      assignment: data.assignment,
      scores: data.scores || []
    });
  } catch (error) {
    console.error('Error rendering assignment scores page:', error);
    res.status(403).send('Access denied or assignment not found');
  }
});

// Render grading page for exam attempt
router.get('/exams/attempts/:attemptId/grade', checkAuthenticated, authenticateRole(['teacher']), (req, res) => {
  res.render('exams/gradeAttempt', { user: req.user, attemptId: req.params.attemptId });
});

module.exports = router;
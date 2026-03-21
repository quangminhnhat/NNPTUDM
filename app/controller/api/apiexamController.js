//lib import
const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const examsService = require("../../service/examsService");
const { authenticateRole } = require("../../service/roleAuthservice");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../../service/authservice");

// Configure multer for question media uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/exam_media';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Get exam list
/**
 * @swagger
 * /api/exams:
 *   get:
 *     summary: Get list of exams
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of exams
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exams:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get('/exams', checkAuthenticated, async (req, res) => {
  try {
    const { exams } = await examsService.getExams(req.user);
    res.json({ user: req.user, exams });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Error fetching exams' });
  }
});

// Get new exam form data
/**
 * @swagger
 * /api/exams/new:
 *   get:
 *     summary: Get data for new exam form
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Form data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 */
router.get('/exams/new', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const data = await examsService.getNewExamFormData(req.user.id);
    res.json({ user: req.user, ...data });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Error loading form data' });
  }
});

// Create new exam
/**
 * @swagger
 * /api/exam/new:
 *   post:
 *     summary: Create new exam
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exam_title:
 *                 type: string
 *               description:
 *                 type: string
 *               duration_minutes:
 *                 type: integer
 *               total_marks:
 *                 type: integer
 *               passing_marks:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Exam created successfully
 *       500:
 *         description: Creation error
 */
router.post('/exam/new', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const result = await examsService.createExam(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ message: error.message || 'Error creating exam' });
  }
});

// Import exam and questions from Excel file
router.post('/exams/import', checkAuthenticated, authenticateRole(['teacher']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const fileBuffer = fs.readFileSync(req.file.path);
    const result = await examsService.importExamsFromExcel(req.user.id, fileBuffer);

    res.status(201).json(result);
  } catch (error) {
    console.error('Excel import error:', error);
    const status = error.status || 500;
    res.status(status).json({ message: error.message || 'Error importing exam' });
  } finally {
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupErr) {
      console.error('Failed to delete uploaded file:', cleanupErr);
    }
  }
});

// Download exam import template (protected)
router.get('/exams/template/download', checkAuthenticated, authenticateRole(['teacher']), (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../../../app/public/exam_import_template.xlsx');
    if (fs.existsSync(templatePath)) {
      return res.download(templatePath, 'exam_import_template.xlsx');
    }
    return res.status(404).json({ message: 'Template file not found on server. Run the generator to create it.' });
  } catch (error) {
    console.error('Template download error:', error);
    return res.status(500).json({ message: 'Error downloading template' });
  }
});

// Get new question form data
/**
 * @swagger
 * /api/exams/{examId}/questions/new:
 *   get:
 *     summary: Get data for new question form
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     responses:
 *       200:
 *         description: Form data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Exam not found
 */
router.get('/exams/:examId/questions/new', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const { examId } = req.params;
    const data = await examsService.getQuestionFormData(examId, req.user.id);
    res.json({ user: req.user, ...data });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Error loading question form' });
  }
});

// Get exam edit data
/**
 * @swagger
 * /api/exams/{examId}/edit:
 *   get:
 *     summary: Get exam edit form data
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     responses:
 *       200:
 *         description: Exam edit data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exam:
 *                   type: object
 *                 user:
 *                   type: object
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Exam not found
 */
router.get('/exams/:examId/edit', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const { examId } = req.params;
    const { exam, questions } = await examsService.getExamDetails(examId, req.user.id);
    res.json({ user: req.user, exam, questions });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Error loading exam' });
  }
});

// Update exam
/**
 * @swagger
 * /api/exams/{examId}:
 *   put:
 *     summary: Update exam
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exam_title:
 *                 type: string
 *               description:
 *                 type: string
 *               duration_minutes:
 *                 type: integer
 *               total_marks:
 *                 type: integer
 *               passing_marks:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Exam updated successfully
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Exam not found
 */
router.put('/exams/:examId', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const { examId } = req.params;
    const result = await examsService.updateExam(examId, req.user.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || "Error updating exam"
    });
  }
});

// Get question edit data
/**
 * @swagger
 * /api/questions/{questionId}/edit:
 *   get:
 *     summary: Get question edit form data
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question edit data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 question:
 *                   type: object
 *                 media:
 *                   type: array
 *                   items:
 *                     type: object
 *                 options:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Question not found
 */
router.get('/questions/:questionId/edit', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
  try {
    const { questionId } = req.params;
    const { question, examId } = await examsService.getQuestionEditData(questionId, req.user.id);
    res.json({ user: req.user, question, examId });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Error loading question' });
  }
});

// Update question
// Delete question media
/**
 * @swagger
 * /api/questions/media/{mediaId}:
 *   delete:
 *     summary: Delete question media
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Media ID
 *     responses:
 *       200:
 *         description: Media deleted successfully
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Media not found
 */
router.delete('/questions/media/:mediaId', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
    try {
        const { mediaId } = req.params;
        const result = await examsService.deleteQuestionMedia(mediaId, req.user.id);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Error deleting media"
        });
    }
});

/**
 * @swagger
 * /api/questions/{questionId}:
 *   put:
 *     summary: Update question
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               question_text:
 *                 type: string
 *               points:
 *                 type: integer
 *               difficulty:
 *                 type: string
 *               type_id:
 *                 type: integer
 *               media:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Question updated successfully
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Question not found
 */
router.put('/questions/:questionId', checkAuthenticated, authenticateRole(['teacher']), upload.array('media'), async (req, res) => {
    try {
        const { questionId } = req.params;
        const result = await examsService.updateQuestion(questionId, req.user.id, req.body, req.files);
        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ message: error.message || "Error updating question" });
    }
});

// Delete question
/**
 * @swagger
 * /api/questions/{questionId}:
 *   delete:
 *     summary: Delete question
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question deleted successfully
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Question not found
 */
router.delete('/questions/:questionId', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
    try {
        const { questionId } = req.params;
        const result = await examsService.deleteQuestion(questionId, req.user.id);
        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ message: error.message || "Error deleting question" });
    }
});

// Delete exam
/**
 * @swagger
 * /api/exams/{examId}:
 *   delete:
 *     summary: Delete exam
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     responses:
 *       200:
 *         description: Exam deleted successfully
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Exam not found
 */
router.delete('/exams/:examId', checkAuthenticated, authenticateRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { examId } = req.params;
        const result = await examsService.deleteExam(examId, req.user);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Error deleting exam"
        });
    }
});

// Add question to exam or question bank
/**
 * @swagger
 * /api/{examId}/questions/add:
 *   post:
 *     summary: Add question to exam
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               question_text:
 *                 type: string
 *               type_id:
 *                 type: string
 *               points:
 *                 type: integer
 *               difficulty:
 *                 type: string
 *               media:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Question added successfully
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Exam not found
 */
router.post('/:examId/questions/add', checkAuthenticated, authenticateRole(['teacher']), upload.array('media'), async (req, res) => {
    try {
        const { examId } = req.params;
        const result = await examsService.addQuestion(examId, req.user.id, req.body, req.files);
        res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ message: error.message || "Error adding question" });
    }
});

// Get exam questions
/**
 * @swagger
 * /api/{examId}/questions:
 *   get:
 *     summary: Get exam questions
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     responses:
 *       200:
 *         description: List of exam questions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Exam not found
 */
router.get('/:examId/questions', checkAuthenticated, async (req, res) => {
    try {
        const { examId } = req.params;
        const questions = await examsService.getExamQuestions(examId);
        res.json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching questions" });
    }
});

// Get exam assignments data
/**
 * @swagger
 * /api/exams/{examId}/assign:
 *   get:
 *     summary: Get exam assignment form data
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     responses:
 *       200:
 *         description: Assignment form data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exam:
 *                   type: object
 *                 classes:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Exam not found
 */
router.get('/exams/:examId/assign', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
    try {
        const { examId } = req.params;
        const data = await examsService.getExamAssignData(examId, req.user.id);
        res.json({
            user: req.user,
            ...data
        });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: error.message || 'Error loading assignments' });
    }
});

// Assign exam to class
/**
 * @swagger
 * /api/exams/{examId}/assign:
 *   post:
 *     summary: Assign exam to class
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               class_id:
 *                 type: integer
 *               open_at:
 *                 type: string
 *                 format: date-time
 *               close_at:
 *                 type: string
 *                 format: date-time
 *               max_attempts:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Exam assigned successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Exam or class not found
 */
router.post('/exams/:examId/assign', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
    try {
        const { examId } = req.params;
        const result = await examsService.assignExamToClass(examId, req.user.id, req.body);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Error assigning exam' });
    }
});

// Get exam assignment scores data
/**
 * @swagger
 * /api/exams/assignments/{assignmentId}/scores:
 *   get:
 *     summary: Get exam assignment scores
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assignment ID
 *     responses:
 *       200:
 *         description: Assignment scores data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignment:
 *                   type: object
 *                 attempts:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Assignment not found
 */
router.get('/exams/assignments/:assignmentId/scores', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const data = await examsService.getAssignmentScores(assignmentId, req.user.id);
        res.json({
            user: req.user,
            ...data
        });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: error.message || 'Error loading scores' });
    }
});

// Get grading data for a specific attempt
/**
 * @swagger
 * /api/exams/attempts/{attemptId}/grade:
 *   get:
 *     summary: Get grading data for exam attempt
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attempt ID
 *     responses:
 *       200:
 *         description: Grading data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attempt:
 *                   type: object
 *                 responses:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Attempt not found
 */
router.get('/exams/attempts/:attemptId/grade', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
    try {
        const { attemptId } = req.params;
        const data = await examsService.getAttemptGradeData(attemptId, req.user.id);
        res.json({
            user: req.user,
            ...data
        });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: error.message || 'Error loading grading page' });
    }
});

// Teacher: submit manual grades for an attempt
/**
 * @swagger
 * /api/exams/attempts/{attemptId}/grade:
 *   post:
 *     summary: Submit grades for exam attempt
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attempt ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scores:
 *                 type: object
 *               comments:
 *                 type: object
 *     responses:
 *       200:
 *         description: Grades submitted successfully
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Attempt not found
 */
router.post('/exams/attempts/:attemptId/grade', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
    try {
        const { attemptId } = req.params;
        const result = await examsService.gradeAttempt(attemptId, req.user.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Error saving manual grades:', error);
        res.status(error.status || 500).json({ error: error.message || 'Error saving grades' });
    }
});

// Delete exam assignment
/**
 * @swagger
 * /api/exams/assignments/{assignmentId}:
 *   delete:
 *     summary: Delete exam assignment
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assignment ID
 *     responses:
 *       200:
 *         description: Assignment deleted successfully
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Assignment not found
 */
router.delete('/exams/assignments/:assignmentId', checkAuthenticated, authenticateRole(['teacher']), async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const result = await examsService.deleteExamAssignment(assignmentId, req.user.id);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Error removing assignment' });
    }
});

// Start exam attempt
/**
 * @swagger
 * /api/{assignmentId}/start:
 *   post:
 *     summary: Start exam attempt
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assignment ID
 *     responses:
 *       200:
 *         description: Exam attempt started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attemptId:
 *                   type: integer
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Cannot start exam (time constraints, max attempts reached)
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Assignment not found
 */
router.post('/:assignmentId/start', checkAuthenticated, authenticateRole(['student']), async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const result = await examsService.startExamAttempt(assignmentId, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('Error in /start endpoint:', error);
        res.status(error.status || 500).json({ message: error.message || "Error starting exam" });
    }
});





// Submit exam attempt
const examResponseMediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/response_media';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const uploadExamResponse = multer({ storage: examResponseMediaStorage });

// Process an exam submission
/**
 * @swagger
 * /api/exams/submit/{attemptId}:
 *   post:
 *     summary: Submit exam attempt
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Attempt ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               responses:
 *                 type: string
 *                 description: JSON string of question responses
 *               isAutoSubmit:
 *                 type: string
 *                 enum: [true, false]
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Exam submitted successfully
 *       400:
 *         description: Invalid submission
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Attempt not found
 */
router.post('/exams/submit/:attemptId', checkAuthenticated, authenticateRole(['student']), uploadExamResponse.array('files'), async (req, res) => {
    try {
        const attemptId = req.params.attemptId;
        // Handle both JSON string and object formats
        const responses = typeof req.body.responses === 'string'
            ? JSON.parse(req.body.responses)
            : req.body.responses;
        const result = await examsService.submitExamAttempt(attemptId, req.user.id, responses, req.files);
        res.json(result);
    } catch (error) {
        console.error('Error submitting exam:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Error submitting exam"
        });
    }
});




// New route to start taking an exam
/**
 * @swagger
 * /api/exams/{assignmentId}/take:
 *   get:
 *     summary: Start or resume an exam attempt
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assignment ID
 *     responses:
 *       200:
 *         description: Exam data for taking the exam
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 exam:
 *                   type: object
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 attemptId:
 *                   type: integer
 *                 responses:
 *                   type: object
 *                 duration:
 *                   type: integer
 *       400:
 *         description: Exam not open or closed
 *       403:
 *         description: Permission denied or max attempts reached
 *       404:
 *         description: Exam or assignment not found
 */
router.get('/exams/:assignmentId/take', checkAuthenticated, authenticateRole(['student']), async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const data = await examsService.takeExam(assignmentId, req.user.id);
        res.json({
            user: req.user,
            ...data
        });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: error.message || 'Error starting exam' });
    }
});


module.exports = router;

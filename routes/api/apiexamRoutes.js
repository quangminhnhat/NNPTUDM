//lib import
const express = require("express");
const router = express.Router();
const path = require("path");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const multer = require("multer");
const fs = require("fs");
const { authenticateRole } = require("../../middleware/roleAuth");
const executeQuery = require("../../middleware/executeQuery");
const { createMCQQuestion, editMCQQuestion, deleteMCQQuestion } = require("../../middleware/mcqQuestionHelper");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../../middleware/auth");

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
    let query = '';
    const userRole = req.user.role.toLowerCase();

    if (userRole === 'admin') {
      // Admin can see all exams
      query = `
        SELECT e.*, t.full_name as teacher_name 
        FROM Exams e 
        JOIN teachers te ON e.teachers_id = te.id
        JOIN users t ON te.user_id = t.id
      `;
    } else if (userRole === 'teacher') {
      // Teachers can only see their own exams
      query = `
        SELECT e.*, t.full_name as teacher_name 
        FROM Exams e 
        JOIN teachers te ON e.teachers_id = te.id
        JOIN users t ON te.user_id = t.id
        WHERE te.user_id = ${req.user.id}
      `;
    } else if (userRole === 'student') {
      // Get both assigned and attempted exams for students, including separate assignments of the same exam in different classes
      query = `
        WITH LatestAttempts AS (
          SELECT 
            assignment_id,
            attempt_id,
            total_score,
            status as attempt_status,
            COUNT(*) OVER (PARTITION BY assignment_id, student_id) as attempt_count,
            ROW_NUMBER() OVER (PARTITION BY assignment_id, student_id ORDER BY attempt_no DESC) as rn
          FROM Attempts
          WHERE status != 'in_progress' AND student_id = (
            SELECT id FROM students WHERE user_id = ${req.user.id}
          )
        )
        SELECT DISTINCT
          e.*,
          t.full_name as teacher_name,
          CASE 
            WHEN a.attempt_status = 'completed' THEN 'Completed'
            WHEN a.attempt_status = 'in_progress' THEN 'In Progress'
            WHEN ea.open_at <= GETDATE() AND ea.close_at >= GETDATE() AND 
                 (a.attempt_count IS NULL OR 
                  (ea.max_attempts IS NULL OR a.attempt_count < ea.max_attempts)) THEN 'Available'
            WHEN ea.open_at > GETDATE() THEN 'Upcoming'
            ELSE 'Expired'
          END as exam_status,
          CASE 
            WHEN a.attempt_status = 'in_progress' THEN 0
            WHEN ea.open_at <= GETDATE() AND ea.close_at >= GETDATE() AND 
                 (a.attempt_count IS NULL OR 
                  (ea.max_attempts IS NULL OR a.attempt_count < ea.max_attempts)) THEN 1
            WHEN ea.open_at > GETDATE() THEN 2
            ELSE 3
          END as status_order,
          a.total_score,
          a.attempt_status,
          ea.open_at,
          ea.close_at,
          ea.assignment_id,
          ea.max_attempts,
          ISNULL(a.attempt_count, 0) as attempt_count,
          s.id as student_id,
          en.class_id,
          c.class_name
        FROM Exams e 
        JOIN teachers te ON e.teachers_id = te.id
        JOIN users t ON te.user_id = t.id
        JOIN ExamAssignments ea ON e.exam_id = ea.exam_id
        JOIN classes c ON ea.classes_id = c.id
        JOIN enrollments en ON c.id = en.class_id AND en.student_id = (
          SELECT id FROM students WHERE user_id = ${req.user.id}
        )
        JOIN students s ON s.id = en.student_id
        LEFT JOIN LatestAttempts a ON ea.assignment_id = a.assignment_id AND a.rn = 1
        WHERE s.user_id = ${req.user.id}
        ORDER BY status_order, ea.open_at ASC
      `;
    } else {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const exams = await executeQuery(query);
    
    res.json({
      user: req.user,
      exams: exams
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching exams' });
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
  res.json({
    user: req.user
  });
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
    const { exam_title, description, duration_minutes, total_marks, passing_marks } = req.body;
    
    // Get teacher_id from the authenticated user
    const teacherQuery = `
      SELECT t.id FROM teachers t 
      JOIN users u ON t.user_id = u.id 
      WHERE u.id = ${req.user.id}
    `;
    const teacher = await executeQuery(teacherQuery);
    
    if (!teacher || teacher.length === 0) {
      return res.status(403).json({ message: "Only teachers can create exams" });
    }

    // Generate a unique exam code
    const examCode = 'EXAM' + Date.now().toString().slice(-6);
    
    const query = `
      INSERT INTO Exams (teachers_id, exam_code, exam_title, description, duration_min, total_points, passing_points, created_at)
      OUTPUT INSERTED.exam_id
      VALUES (${teacher[0].id}, '${examCode}', '${exam_title}', '${description}', ${duration_minutes}, ${total_marks}, ${passing_marks || 'NULL'}, GETDATE())
    `;
    const result = await executeQuery(query);
    res.status(201).json({ 
      message: "Exam created successfully",
      examId: result[0].exam_id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating exam" });
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

    // Verify teacher owns this exam
    const verifyQuery = `
      SELECT e.*, t.user_id as teacher_user_id
      FROM Exams e
      JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
    `;
    const exam = await executeQuery(verifyQuery);

    if (!exam || exam.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    if (exam[0].teacher_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to add questions to this exam' });
    }

    res.json({
      user: req.user,
      examId: examId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error loading question form' });
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

    // Get exam details
    const examQuery = `
      SELECT e.*, t.user_id as teacher_user_id
      FROM Exams e
      JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
    `;
    const exam = await executeQuery(examQuery);

    if (!exam || exam.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Verify teacher owns this exam
    if (exam[0].teacher_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to edit this exam' });
    }

    // Get exam questions
    const questionsQuery = `
      SELECT q.*, qt.type_name
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${examId}
      ORDER BY q.created_at
    `;
    const questions = await executeQuery(questionsQuery);

    res.json({
      user: req.user,
      exam: exam[0],
      questions: questions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error loading exam' });
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
    const { exam_title, description, duration_minutes, total_marks, passing_marks } = req.body;

    // Verify teacher owns this exam
    const verifyQuery = `
      SELECT e.*
      FROM Exams e
      JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
      AND t.user_id = ${req.user.id}
    `;
    const exam = await executeQuery(verifyQuery);

    if (!exam || exam.length === 0) {
      return res.status(403).json({ 
        success: false,
        message: "You don't have permission to edit this exam" 
      });
    }

    // Update exam
    const updateQuery = `
      UPDATE Exams 
      SET exam_title = '${exam_title}',
          description = '${description}',
          duration_min = ${duration_minutes},
          total_points = ${total_marks},
          passing_points = ${passing_marks || 'NULL'},
          updated_at = GETDATE()
      WHERE exam_id = ${examId}
    `;
    await executeQuery(updateQuery);

    res.json({ 
      success: true,
      message: "Exam updated successfully" 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Error updating exam" 
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

    // Get question details with media and options
    const questionQuery = `
      SELECT q.*, qt.type_name,
             (SELECT ISNULL(
               (SELECT mo.* 
               FROM MCQOptions mo 
               WHERE mo.question_id = q.question_id 
               FOR JSON PATH), '[]')
             ) as options,
             (SELECT JSON_QUERY((
               SELECT qm.* 
               FROM QuestionMedia qm 
               WHERE qm.question_id = q.question_id 
               FOR JSON PATH
             ))) as media,
             e.exam_id,
             t.user_id as teacher_user_id
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      LEFT JOIN Exams e ON q.exam_id = e.exam_id
      LEFT JOIN teachers t ON e.teachers_id = t.id
      WHERE q.question_id = ${questionId}
    `;
    
    const question = await executeQuery(questionQuery);

    if (!question || question.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // If question belongs to an exam, verify teacher owns it
    if (question[0].exam_id && question[0].teacher_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to edit this question' });
    }

    // Parse the JSON strings from SQL
    const questionData = {
      ...question[0],
      options: JSON.parse(question[0].options || '[]'),
      media: JSON.parse(question[0].media || '[]')
    };

    res.json({
      user: req.user,
      question: questionData,
      examId: questionData.exam_id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error loading question' });
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

        // Get media info and verify ownership
        const mediaQuery = `
            SELECT qm.*, q.exam_id, t.user_id as teacher_user_id 
            FROM QuestionMedia qm
            JOIN Questions q ON qm.question_id = q.question_id
            LEFT JOIN Exams e ON q.exam_id = e.exam_id
            LEFT JOIN teachers t ON e.teachers_id = t.id
            WHERE qm.media_id = ${mediaId}
        `;
        
        const media = await executeQuery(mediaQuery);

        if (!media || media.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Media not found"
            });
        }

        // If media belongs to an exam question, verify teacher owns it
        if (media[0].exam_id && media[0].teacher_user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to delete this media"
            });
        }

        // Delete the file from disk if it exists
        try {
            const filePath = path.join(__dirname, '..', media[0].file_url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            // Continue with database deletion even if file deletion fails
        }

        // Delete from database
        await executeQuery(`DELETE FROM QuestionMedia WHERE media_id = ${mediaId}`);

        res.json({
            success: true,
            message: "Media deleted successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error deleting media"
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
    const { question_text, points, difficulty, type_id } = req.body;
    const files = req.files;

    // Verify the question exists and belongs to the teacher
    const verifyQuery = `
      SELECT q.*, e.teachers_id 
      FROM Questions q
      LEFT JOIN Exams e ON q.exam_id = e.exam_id
      WHERE q.question_id = ${questionId}
    `;
    const question = await executeQuery(verifyQuery);

    if (!question || question.length === 0) {
      return res.status(404).json({ message: "Question not found" });
    }

    // If it's an MCQ question
    if (type_id === 1 || question[0].type_id === 1) {
      const mcqResult = await editMCQQuestion(questionId, {
        points,
        body_text: question_text,
        difficulty,
        options: req.body.options
      }, files);

      if (!mcqResult.success) {
        throw new Error(mcqResult.error);
      }

      return res.status(200).json({ 
        message: mcqResult.message,
        questionId: mcqResult.questionId 
      });
    }

    // For other question types...
    const updateQuery = `
      UPDATE Questions 
      SET points = ${points},
          body_text = '${question_text}',
          difficulty = ${difficulty || 'NULL'},
          updated_at = GETDATE()
      WHERE question_id = ${questionId}
    `;
    await executeQuery(updateQuery);

    // Handle media files if any
    if (files && files.length > 0) {
      // Delete existing media
      await executeQuery(`DELETE FROM QuestionMedia WHERE question_id = ${questionId}`);
      
      // Add new media files
      for (const file of files) {
        const mediaQuery = `
          INSERT INTO QuestionMedia (question_id, file_name, file_url, caption, file_data, created_at)
          VALUES (${questionId}, '${file.originalname}', '${file.path}', NULL, NULL, GETDATE())
        `;
        await executeQuery(mediaQuery);
      }
    }

    res.status(200).json({ message: "Question updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating question" });
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

    // Verify the question exists and belongs to the teacher
    const verifyQuery = `
      SELECT q.*, e.teachers_id 
      FROM Questions q
      LEFT JOIN Exams e ON q.exam_id = e.exam_id
      WHERE q.question_id = ${questionId}
    `;
    const question = await executeQuery(verifyQuery);

    if (!question || question.length === 0) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Verify teacher owns this question
    const teacherQuery = `
      SELECT id FROM teachers 
      WHERE user_id = ${req.user.id}
    `;
    const teacher = await executeQuery(teacherQuery);

    if (question[0].exam_id && teacher[0].id !== question[0].teachers_id) {
      return res.status(403).json({ message: "You don't have permission to delete this question" });
    }

    // If it's an MCQ question
    if (question[0].type_id === 1) {
      const mcqResult = await deleteMCQQuestion(questionId);

      if (!mcqResult.success) {
        throw new Error(mcqResult.error);
      }

      return res.status(200).json({ message: mcqResult.message });
    }

    // For other question types...
    // Delete associated media first
    await executeQuery(`DELETE FROM QuestionMedia WHERE question_id = ${questionId}`);
    
    // Delete the question
    await executeQuery(`DELETE FROM Questions WHERE question_id = ${questionId}`);

    res.status(200).json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting question" });
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

    // If teacher, verify they own the exam
    if (req.user.role === 'teacher') {
      const verifyQuery = `
        SELECT e.* 
        FROM Exams e
        JOIN teachers t ON e.teachers_id = t.id
        WHERE e.exam_id = ${examId}
        AND t.user_id = ${req.user.id}
      `;
      const exam = await executeQuery(verifyQuery);

      if (!exam || exam.length === 0) {
        return res.status(403).json({ 
          success: false,
          message: "You don't have permission to delete this exam" 
        });
      }
    }

    // Delete all related records in order
    // First delete all responses and their media
    await executeQuery(`
      DELETE rm 
      FROM ResponseMedia rm
      JOIN Responses r ON rm.response_id = r.response_id
      JOIN Attempts a ON r.attempt_id = a.attempt_id
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      WHERE ea.exam_id = ${examId}
    `);

    // Delete responses
    await executeQuery(`
      DELETE r
      FROM Responses r
      JOIN Attempts a ON r.attempt_id = a.attempt_id
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      WHERE ea.exam_id = ${examId}
    `);

    // Delete attempts
    await executeQuery(`
      DELETE a
      FROM Attempts a
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      WHERE ea.exam_id = ${examId}
    `);

    // Delete assignments
    await executeQuery(`
      DELETE FROM ExamAssignments WHERE exam_id = ${examId}
    `);

    // Delete question media
    await executeQuery(`
      DELETE qm
      FROM QuestionMedia qm
      JOIN Questions q ON qm.question_id = q.question_id
      WHERE q.exam_id = ${examId}
    `);

    // Delete MCQ options
    await executeQuery(`
      DELETE mo
      FROM MCQOptions mo
      JOIN Questions q ON mo.question_id = q.question_id
      WHERE q.exam_id = ${examId}
    `);

    // Delete questions
    await executeQuery(`
      DELETE FROM Questions WHERE exam_id = ${examId}
    `);

    // Finally delete the exam
    await executeQuery(`
      DELETE FROM Exams WHERE exam_id = ${examId}
    `);

    res.json({ 
      success: true,
      message: "Exam deleted successfully" 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Error deleting exam" 
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
    const { question_text, type_id, points, difficulty } = req.body;
    const { examId } = req.params;
    const files = req.files;

    // For MCQ questions, use the helper function
    if (type_id === '1') {
      const mcqResult = await createMCQQuestion(examId, {
        points,
        body_text: question_text,
        difficulty,
        options: req.body.options
      }, files);

      if (!mcqResult.success) {
        throw new Error(mcqResult.error);
      }

      return res.status(201).json({ 
        success: true,
        message: mcqResult.message,
        questionId: mcqResult.questionId 
      });
    }

    // For other question types
    const questionQuery = `
      INSERT INTO Questions (exam_id, type_id, points, body_text, difficulty, created_at)
      OUTPUT INSERTED.question_id
      VALUES (${examId === 'bank' ? 'NULL' : examId}, ${type_id}, ${points}, '${question_text}', ${difficulty || 'NULL'}, GETDATE())
    `;
    const question = await executeQuery(questionQuery);
    const questionId = question[0].question_id;

    // Handle media files if any
    if (files && files.length > 0) {
      for (const file of files) {
        const mediaQuery = `
          INSERT INTO QuestionMedia (question_id, file_name, file_url, caption, file_data, created_at)
          VALUES (${questionId}, '${file.originalname}', '${file.path}', NULL, NULL, GETDATE())
        `;
        await executeQuery(mediaQuery);
      }
    }

    // If it's MCQ type, use the dedicated helper function
    if (type_id === 1) {
      const mcqResult = await createMCQQuestion(examId, {
        points,
        body_text,
        difficulty,
        options: req.body.options
      }, files);

      if (!mcqResult.success) {
        throw new Error(mcqResult.error);
      }

      return res.status(201).json({ 
        message: mcqResult.message,
        questionId: mcqResult.questionId 
      });
    }

    res.status(201).json({ 
      message: examId === 'bank' ? "Question added to bank successfully" : "Question added to exam successfully",
      questionId: questionId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding question" });
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
    const query = `
      SELECT q.*, qt.type_name, 
             (SELECT JSON_QUERY((
               SELECT mo.* 
               FROM MCQOptions mo 
               WHERE mo.question_id = q.question_id 
               FOR JSON PATH
             ))) as options,
             (SELECT JSON_QUERY((
               SELECT qm.* 
               FROM QuestionMedia qm 
               WHERE qm.question_id = q.question_id 
               FOR JSON PATH
             ))) as media
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${examId}
    `;
    const questions = await executeQuery(query);
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

    // Get exam details
    const examQuery = `
      SELECT e.*, t.user_id as teacher_user_id
      FROM Exams e
      JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
    `;
    const exam = await executeQuery(examQuery);

    if (!exam || exam.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Verify teacher owns this exam
    if (exam[0].teacher_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Get current assignments with student counts
    const assignmentsQuery = `
      SELECT ea.*, c.class_name,
             (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id) as student_count
      FROM ExamAssignments ea
      JOIN classes c ON ea.classes_id = c.id
      WHERE ea.exam_id = ${examId}
      ORDER BY ea.open_at DESC
    `;
    const assignments = await executeQuery(assignmentsQuery);

    // Get available classes (not yet assigned)
    const availableClassesQuery = `
      SELECT c.* 
      FROM classes c
      JOIN teachers t ON c.teacher_id = t.id
      WHERE t.user_id = ${req.user.id}
      AND NOT EXISTS (
        SELECT 1 FROM ExamAssignments ea
        WHERE ea.classes_id = c.id
        AND ea.exam_id = ${examId}
      )
    `;
    const availableClasses = await executeQuery(availableClassesQuery);

    res.json({
      user: req.user,
      exam: exam[0],
      assignments: assignments,
      availableClasses: availableClasses
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error loading assignments' });
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
    const { class_id, open_at, close_at, max_attempts } = req.body;

    // Verify exam exists and belongs to teacher
    const examQuery = `
      SELECT e.*, t.user_id as teacher_user_id 
      FROM Exams e
      JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
    `;
    const exam = await executeQuery(examQuery);

    if (!exam || exam.length === 0 || exam[0].teacher_user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

    // Verify class exists and belongs to teacher
    const classQuery = `
      SELECT c.* 
      FROM classes c
      JOIN teachers t ON c.teacher_id = t.id
      WHERE c.id = ${class_id}
      AND t.user_id = ${req.user.id}
    `;
    const classResult = await executeQuery(classQuery);

    if (!classResult || classResult.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid class' });
    }

    // Create assignment
    // Convert ISO datetime string to SQL Server datetime format
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toISOString().slice(0, 19).replace('T', ' ');
    };

    const insertQuery = `
      INSERT INTO ExamAssignments (exam_id, classes_id, open_at, close_at, max_attempts, created_at)
      VALUES (${examId}, ${class_id}, '${formatDate(open_at)}', '${formatDate(close_at)}', ${max_attempts || 'NULL'}, GETDATE())
    `;
    await executeQuery(insertQuery);

    res.json({ success: true, message: 'Exam assigned successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error assigning exam' });
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

        // Get assignment details with exam and class info
        const assignmentQuery = `
            SELECT ea.*, e.exam_title, e.exam_code, c.class_name,
                   t.user_id as teacher_user_id
            FROM ExamAssignments ea
            JOIN Exams e ON ea.exam_id = e.exam_id
            JOIN classes c ON ea.classes_id = c.id
            JOIN teachers t ON e.teachers_id = t.id
            WHERE ea.assignment_id = ${assignmentId}
        `;
        const assignments = await executeQuery(assignmentQuery);

        if (!assignments || assignments.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        // Verify teacher owns this exam
        if (assignments[0].teacher_user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not have permission to view these scores' });
        }

        // Get student scores with latest attempts
        const scoresQuery = `
            WITH LatestAttempts AS (
                SELECT 
                    student_id,
                    MAX(attempt_no) as latest_attempt_no,
                    assignment_id
                FROM Attempts
                WHERE assignment_id = ${assignmentId}
                GROUP BY student_id, assignment_id
            )
      SELECT DISTINCT
        s.id as student_id,
        u.full_name as student_name,
        a.attempt_id,
        a.attempt_no,
        a.total_score as score,
        a.manual_score,
        a.started_at,
        a.submitted_at,
        a.status,
        CASE 
          WHEN a.status = 'graded' THEN 'Completed'
          WHEN a.submitted_at IS NOT NULL THEN 'Awaiting Grading'
          WHEN a.started_at IS NOT NULL THEN 'In Progress'
          ELSE 'Not Started'
        END as status_text
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN enrollments e ON s.id = e.student_id
            LEFT JOIN LatestAttempts la ON s.id = la.student_id
            LEFT JOIN Attempts a ON (
                s.id = a.student_id 
                AND a.assignment_id = ${assignmentId}
                AND a.attempt_no = la.latest_attempt_no
                AND a.assignment_id = la.assignment_id
            )
            WHERE e.class_id = ${assignments[0].classes_id}
            ORDER BY u.full_name
        `;

        const scores = await executeQuery(scoresQuery);

        res.json({
            user: req.user,
            assignment: assignments[0],
            scores: scores
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading scores' });
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

    // Get attempt, assignment, exam and teacher
    const attemptQuery = `
      SELECT a.*, ea.assignment_id, ea.exam_id, e.exam_title, t.user_id as teacher_user_id, s.id as student_id, u.full_name
      FROM Attempts a
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      JOIN Exams e ON ea.exam_id = e.exam_id
      JOIN teachers t ON e.teachers_id = t.id
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE a.attempt_id = ${attemptId}
    `;

    const attemptRes = await executeQuery(attemptQuery);
    if (!attemptRes || attemptRes.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attemptRes[0];

    // Verify teacher owns this exam
    if (attempt.teacher_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to grade this attempt' });
    }

    // Get responses and related data
    const responsesQuery = `
      SELECT r.*, q.body_text, qt.type_code, rm.file_name, rm.file_url, oi.display_label
      FROM Responses r
      JOIN Questions q ON r.question_id = q.question_id
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      LEFT JOIN ResponseMedia rm ON r.response_id = rm.response_id
      LEFT JOIN OptionInstances oi ON r.chosen_option_instance_id = oi.option_instance_id
      WHERE r.attempt_id = ${attemptId}
      ORDER BY r.response_id
    `;

    const responsesRaw = await executeQuery(responsesQuery);

    // Group files per response
    const responsesMap = {};
    responsesRaw.forEach(r => {
      if (!responsesMap[r.response_id]) {
        responsesMap[r.response_id] = {
          response_id: r.response_id,
          question_id: r.question_id,
          body_text: r.body_text,
          type_code: r.type_code,
          essay_text: r.essay_text,
          score_awarded: r.score_awarded,
          grader_comment: r.grader_comment,
          files: [],
          display_label: r.display_label
        };
      }
      if (r.file_url) {
        responsesMap[r.response_id].files.push({ name: r.file_name, url: r.file_url });
      }
    });

    const responses = Object.values(responsesMap);

    res.json({
      user: req.user,
      attempt: attempt,
      student: { id: attempt.student_id, full_name: attempt.full_name },
      responses: responses
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error loading grading page' });
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
    const scores = req.body.scores || {};
    const comments = req.body.comments || {};

    // Get attempt and verify teacher owns it
    const attemptQuery = `
      SELECT a.*, ea.assignment_id, ea.exam_id, e.exam_title, t.user_id as teacher_user_id
      FROM Attempts a
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      JOIN Exams e ON ea.exam_id = e.exam_id
      JOIN teachers t ON e.teachers_id = t.id
      WHERE a.attempt_id = ${attemptId}
    `;
    const attemptRes = await executeQuery(attemptQuery);
    if (!attemptRes || attemptRes.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    const attempt = attemptRes[0];
    if (attempt.teacher_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to grade this attempt' });
    }

    // Update each response
    let manualTotal = 0;
    for (const responseId in scores) {
      const rawScore = parseFloat(scores[responseId]);
      const scoreVal = isNaN(rawScore) ? 0 : rawScore;
      manualTotal += scoreVal;
      const comment = (comments[responseId] || '').replace(/'/g, "''");

      await executeQuery(`UPDATE Responses SET score_awarded = ${scoreVal}, grader_comment = N'${comment}' WHERE response_id = ${responseId}`);
    }

  // Update attempt manual_score, compute and store total_score and set status to graded
  // total_score is now a regular column, so update it explicitly using the stored auto_score
  await executeQuery(`UPDATE Attempts SET manual_score = ${manualTotal}, total_score = auto_score + ${manualTotal}, status = 'graded' WHERE attempt_id = ${attemptId}`);

    res.json({ success: true, message: 'Grades saved successfully' });
  } catch (error) {
    console.error('Error saving manual grades:', error);
    res.status(500).json({ error: 'Error saving grades' });
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

    // Verify assignment exists and belongs to teacher
    const verifyQuery = `
      SELECT ea.*, t.user_id as teacher_user_id 
      FROM ExamAssignments ea
      JOIN Exams e ON ea.exam_id = e.exam_id
      JOIN teachers t ON e.teachers_id = t.id
      WHERE ea.assignment_id = ${assignmentId}
    `;
    const assignment = await executeQuery(verifyQuery);

    if (!assignment || assignment.length === 0 || assignment[0].teacher_user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

    // Delete assignment and all related attempts
    await executeQuery(`
      DELETE ea FROM ExamAssignments ea
      LEFT JOIN Attempts a ON ea.assignment_id = a.assignment_id
      WHERE ea.assignment_id = ${assignmentId}
    `);

    res.json({ success: true, message: 'Assignment removed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error removing assignment' });
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

    // Get assignment and exam details
    const assignmentQuery = `
      SELECT ea.*, e.exam_id, e.exam_title, e.exam_code, e.duration_min, e.shuffle_questions, e.shuffle_options 
      FROM ExamAssignments ea
      JOIN Exams e ON ea.exam_id = e.exam_id
      WHERE ea.assignment_id = ${assignmentId}
    `;
    const assignment = await executeQuery(assignmentQuery);
    
    if (!assignment || assignment.length === 0) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Get student ID
    const studentQuery = `
      SELECT id FROM students WHERE user_id = ${req.user.id}
    `;
    const student = await executeQuery(studentQuery);

    if (!student || student.length === 0) {
      return res.status(403).json({ message: "Student not found" });
    }

    // Check attempt count - only count SUBMITTED attempts (have submitted_at set)
    const attemptCountQuery = `
      SELECT COUNT(*) as attempt_count, ea.max_attempts
      FROM Attempts a
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      WHERE a.assignment_id = ${assignmentId} 
      AND a.student_id = ${student[0].id}
      AND a.submitted_at IS NOT NULL
      GROUP BY ea.max_attempts`;
    
    const attemptCount = await executeQuery(attemptCountQuery);
    
    console.log('Attempt check:', attemptCount.length > 0 ? attemptCount[0] : { attempt_count: 0, max_attempts: null });
    
    if (attemptCount.length > 0 && attemptCount[0].attempt_count >= attemptCount[0].max_attempts) {
      return res.status(403).json({ message: "Maximum attempts reached for this exam" });
    }

    // Create attempt
    const attemptQuery = `
      INSERT INTO Attempts (
        assignment_id, 
        student_id,
        attempt_no, 
        started_at,
        submitted_at,
        auto_score,
        manual_score,
        status
      )
      OUTPUT INSERTED.attempt_id
      VALUES (
        ${assignmentId},
        ${student[0].id},
        (SELECT ISNULL(MAX(attempt_no), 0) + 1 
         FROM Attempts 
         WHERE assignment_id = ${assignmentId}
         AND student_id = ${student[0].id}), 
        GETDATE(),
        NULL,
        0,
        0,
        'in_progress')
    `;
    const attempt = await executeQuery(attemptQuery);
    const attemptId = attempt[0].attempt_id;

    // Get questions with their type info
    let questionsQuery = `
      SELECT q.*, qt.type_name, qt.type_code
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${assignment[0].exam_id}
      ORDER BY q.question_id
    `;

    let questions = await executeQuery(questionsQuery);
    
    if (!questions || questions.length === 0) {
      questions = [];
    }

    // Shuffle questions if enabled
    if (assignment[0].shuffle_questions && questions.length > 0) {
      questions.sort(() => Math.random() - 0.5);
    }

    // For each MCQ question, create shuffled option instances (needed for auto-grading)
    for (const question of questions) {
      if (question.type_code === 'MCQ') {
        try {
          const optionsQuery = `
            SELECT * FROM MCQOptions WHERE question_id = ${question.question_id}
          `;
          let options = await executeQuery(optionsQuery);

          // Shuffle options if enabled
          if (assignment[0].shuffle_options && options && options.length > 0) {
            options.sort(() => Math.random() - 0.5);
          }

          // Create option instances with shuffled order
          if (options && options.length > 0) {
            for (let i = 0; i < options.length; i++) {
              const option = options[i];
              // Escape single quotes in option text
              const escapedText = option.option_text ? option.option_text.replace(/'/g, "''") : '';
              // Convert boolean to SQL bit (0 or 1)
              const isCorrect = option.is_correct ? 1 : 0;
              const insertQuery = `
                INSERT INTO OptionInstances (
                  attempt_id, 
                  question_id, 
                  option_id, 
                  display_order, 
                  display_label, 
                  option_text_snapshot, 
                  is_correct_snapshot
                )
                VALUES (
                  ${attemptId},
                  ${question.question_id},
                  ${option.option_id},
                  ${i + 1},
                  '${String.fromCharCode(65 + i)}',
                  '${escapedText}',
                  ${isCorrect}
                )
              `;
              await executeQuery(insertQuery);
            }
          }
        } catch (e) {
          console.error(`Error creating option instances for question ${question.question_id}:`, e);
          // Continue with other questions even if this one fails
        }
      }
    }

    // Build full question details with options and media
    const fullQuestions = [];
    for (const q of questions) {
      const questionData = {
        question_id: q.question_id,
        body_text: q.body_text,
        type_id: q.type_id,
        type_name: q.type_name,
        type_code: q.type_code,
        points: q.points,
        options: [],
        media: []
      };

      // Get options for MCQ questions
      if (q.type_code === 'MCQ') {
        try {
          const optionsQuery = `
            SELECT * FROM MCQOptions WHERE question_id = ${q.question_id}
          `;
          let options = await executeQuery(optionsQuery);
          
          // Shuffle options if enabled
          if (assignment[0].shuffle_options && options && options.length > 0) {
            options.sort(() => Math.random() - 0.5);
          }
          
          questionData.options = options || [];
        } catch (e) {
          console.error(`Error loading options for question ${q.question_id}:`, e);
          questionData.options = [];
        }
      }

      // Get media files
      try {
        const mediaQuery = `
          SELECT media_id, caption, file_name, file_url FROM QuestionMedia WHERE question_id = ${q.question_id}
        `;
        const media = await executeQuery(mediaQuery);
        questionData.media = media || [];
      } catch (e) {
        console.error(`Error loading media for question ${q.question_id}:`, e);
        questionData.media = [];
      }

      fullQuestions.push(questionData);
    }

    res.json({ 
      exam: {
        exam_id: assignment[0].exam_id,
        exam_title: assignment[0].exam_title,
        exam_code: assignment[0].exam_code,
        duration_min: assignment[0].duration_min
      },
      attempt: {
        attempt_id: attemptId
      },
      questions: fullQuestions
    });
  } catch (error) {
    console.error('Error in /start endpoint:', error);
    res.status(500).json({ message: "Error starting exam", error: error.message });
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
        const responses = JSON.parse(req.body.responses);
        const isAutoSubmit = req.body.isAutoSubmit === 'true';

        // Get attempt details
        const attemptQuery = `
            SELECT a.*, ea.exam_id 
            FROM Attempts a
            INNER JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
            WHERE a.attempt_id = ${attemptId}`;
        const [attempt] = await executeQuery(attemptQuery);

        if (!attempt) {
            return res.status(404).json({ success: false, message: "Attempt not found" });
        }

        // Get questions for this exam
        const questionsQuery = `
            SELECT q.*, qt.type_code 
            FROM Questions q
            INNER JOIN QuestionTypes qt ON q.type_id = qt.type_id
            WHERE q.exam_id = ${attempt.exam_id}`;
        const questions = await executeQuery(questionsQuery);

        let totalScore = 0;
        let hasEssayQuestion = false;

        // Process each response
        for (const questionId in responses) {
            const question = questions.find(q => q.question_id === parseInt(questionId));
            const response = responses[questionId];

            if (question.type_code === 'MCQ') {
                // Find existing OptionInstance for this attempt and option
                const optionInstanceQuery = `
                    SELECT option_instance_id, is_correct_snapshot
                    FROM OptionInstances
                    WHERE attempt_id = ${attemptId} AND option_id = ${response.selectedOptionId}`;
                const [optionInstance] = await executeQuery(optionInstanceQuery);

                if (optionInstance) {
                    const score = optionInstance.is_correct_snapshot ? question.points : 0;
                    totalScore += score;

                    await executeQuery(`
                        INSERT INTO Responses (attempt_id, question_id, chosen_option_instance_id, score_awarded, answered_at)
                        VALUES (${attemptId}, ${question.question_id}, ${optionInstance.option_instance_id}, ${score}, GETDATE())`);
                }

            } else if (question.type_code === 'ESSAY') {
                hasEssayQuestion = true;
                // For essay questions, store response text and any uploaded files
                // Create response without score (will be graded manually)
        const safeEssayText = (response.text || '').replace(/'/g, "''");
        const responseResult = await executeQuery(`
          INSERT INTO Responses (attempt_id, question_id, essay_text, answered_at)
          VALUES (${attemptId}, ${question.question_id}, N'${safeEssayText}', GETDATE())`);

                // Handle file uploads if any
                if (req.files && req.files.length > 0) {
                    const responseFiles = req.files.filter(f => f.fieldname === `files_${questionId}`);
          for (const file of responseFiles) {
            // Store original file name and the saved file path/url
            await executeQuery(`
              INSERT INTO ResponseMedia (response_id, file_name, file_url)
              VALUES (${responseResult[0].response_id}, N'${file.originalname.replace(/'/g, "''")}', '${file.path.replace(/'/g, "''")}')`);
          }
                }
            }
        }

        // Update attempt status and score
        const status = hasEssayQuestion ? 'needs_grading' : 'graded';
        await executeQuery(`
            UPDATE Attempts
            SET submitted_at = GETDATE(),
                auto_score = ${totalScore},
                status = '${status}'
            WHERE attempt_id = ${attemptId}`);

        res.json({
            success: true,
            message: hasEssayQuestion ?
                "Exam submitted successfully. Essay questions will be graded by your teacher." :
                "Exam submitted and graded successfully.",
            score: hasEssayQuestion ? null : totalScore
        });

    } catch (error) {
        console.error('Error submitting exam:', error);
        res.status(500).json({
            success: false,
            message: "Error submitting exam"
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

        // Get student ID
        const studentQuery = `SELECT id FROM students WHERE user_id = ${req.user.id}`;
        const student = await executeQuery(studentQuery);

        if (!student || student.length === 0) {
            return res.status(403).json({ error: 'Student not found' });
        }

        // Check if exam is available and student can take it
        const examQuery = `
            SELECT ea.*, e.*, t.user_id as teacher_user_id,
                   (SELECT COUNT(*) FROM Attempts
                    WHERE assignment_id = ea.assignment_id
                    AND student_id = ${student[0].id}) as attempt_count
            FROM ExamAssignments ea
            JOIN Exams e ON ea.exam_id = e.exam_id
            JOIN teachers t ON e.teachers_id = t.id
            JOIN enrollments en ON ea.classes_id = en.class_id
            WHERE ea.assignment_id = ${assignmentId}
            AND en.student_id = ${student[0].id}
        `;

        const exam = await executeQuery(examQuery);

        if (!exam || exam.length === 0) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        // Check if exam is within time window
        const now = new Date();
        const openAt = new Date(exam[0].open_at);
        const closeAt = new Date(exam[0].close_at);

        if (now < openAt) {
            return res.status(400).json({ error: 'Exam is not yet open' });
        }

        if (now > closeAt) {
            return res.status(400).json({ error: 'Exam has closed' });
        }

        // Check attempt limits
        if (exam[0].max_attempts && exam[0].attempt_count >= exam[0].max_attempts) {
            return res.status(403).json({ error: 'Maximum attempts reached' });
        }

        // Check for existing in-progress attempt
        const inProgressQuery = `
            SELECT attempt_id, started_at, DATEADD(minute, ${exam[0].duration_min}, started_at) as end_time
            FROM Attempts
            WHERE assignment_id = ${assignmentId}
            AND student_id = ${student[0].id}
            AND status = 'in_progress'
        `;

        const inProgress = await executeQuery(inProgressQuery);
        let attemptId;
        let isNewAttempt = false;

        if (inProgress && inProgress.length > 0) {
            // Resume existing attempt
            attemptId = inProgress[0].attempt_id;

            // Calculate remaining time
            const endTime = new Date(inProgress[0].end_time);
            const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));

            if (remainingTime <= 0) {
                // Auto-submit if time has expired
                await executeQuery(`
                    UPDATE Attempts
                    SET status = 'submitted',
                        submitted_at = GETDATE()
                    WHERE attempt_id = ${attemptId}
                `);

                return res.json({ message: 'Your attempt has expired and been automatically submitted' });
            }

            exam[0].remaining_time = remainingTime;
        } else {
            // Create new attempt
            const newAttemptQuery = `
                INSERT INTO Attempts (
                    assignment_id,
                    student_id,
                    attempt_no,
                    started_at,
                    status
                )
                OUTPUT INSERTED.attempt_id
                VALUES (
                    ${assignmentId},
                    ${student[0].id},
                    ${exam[0].attempt_count + 1},
                    GETDATE(),
                    'in_progress'
                )
            `;

            const newAttempt = await executeQuery(newAttemptQuery);
            attemptId = newAttempt[0].attempt_id;
            exam[0].remaining_time = exam[0].duration_min * 60; // Convert to seconds
            isNewAttempt = true;
        }

        // If it's a new attempt, generate OptionInstances for MCQ questions
        if (isNewAttempt) {
            const mcqQuestionsQuery = `
                SELECT q.question_id, q.type_id, qt.type_code
                FROM Questions q
                JOIN QuestionTypes qt ON q.type_id = qt.type_id
                WHERE q.exam_id = ${exam[0].exam_id} AND qt.type_code = 'MCQ'
            `;
            const mcqQuestions = await executeQuery(mcqQuestionsQuery);

            for (const question of mcqQuestions) {
                const optionsQuery = `SELECT * FROM MCQOptions WHERE question_id = ${question.question_id}`;
                let options = await executeQuery(optionsQuery);

                if (exam[0].shuffle_options) {
                    options.sort(() => Math.random() - 0.5);
                }

                for (let i = 0; i < options.length; i++) {
                    const option = options[i];
                    await executeQuery(`
                        INSERT INTO OptionInstances (
                            attempt_id,
                            question_id,
                            option_id,
                            display_order,
                            display_label,
                            option_text_snapshot,
                            is_correct_snapshot
                        )
                        VALUES (
                            ${attemptId},
                            ${question.question_id},
                            ${option.option_id},
                            ${i + 1},
                            '${String.fromCharCode(65 + i)}',
                            N'${option.option_text.replace(/'/g, "''")}',
                            ${option.is_correct ? 1 : 0}
                        )
                    `);
                }
            }
        }

        // Get questions with ONLY the OptionInstances for this SPECIFIC attempt
        const questionsQuery = `
            SELECT q.*, qt.type_code, qt.type_name,
                   (SELECT JSON_QUERY((
                     SELECT mo.option_id, mo.option_text,
                            oi.option_instance_id, oi.display_label, oi.option_text_snapshot, oi.is_correct_snapshot
                     FROM MCQOptions mo
                     LEFT JOIN OptionInstances oi ON mo.option_id = oi.option_id AND oi.attempt_id = ${attemptId}
                     WHERE mo.question_id = q.question_id
                     ORDER BY oi.display_order
                     FOR JSON PATH
                   ))) as options,
                   (SELECT JSON_QUERY((
                     SELECT qm.*
                     FROM QuestionMedia qm
                     WHERE qm.question_id = q.question_id
                     FOR JSON PATH
                   ))) as media
            FROM Questions q
            JOIN QuestionTypes qt ON q.type_id = qt.type_id
            WHERE q.exam_id = ${exam[0].exam_id}
            ORDER BY ${exam[0].shuffle_questions ? 'NEWID()' : 'q.created_at'}
        `;

        const questions = await executeQuery(questionsQuery);

        // Parse JSON strings from SQL
        // Process each question
        questions.forEach(q => {
            try {
                // Parse options and media
                try {
                    q.options = q.options ? JSON.parse(q.options) : [];
                } catch (parseError) {
                    console.error('Error parsing options for question', q.question_id, ':', parseError);
                    console.error('Raw options string:', q.options);
                    q.options = [];
                }

                try {
                    q.media = q.media ? JSON.parse(q.media) : [];
                } catch (parseError) {
                    console.error('Error parsing media for question', q.question_id, ':', parseError);
                    console.error('Raw media string:', q.media);
                    q.media = [];
                }
            } catch (error) {
                console.error('Error processing question', q.question_id, ':', error);
                q.options = [];
                q.media = [];
            }
        });
        
        // Get any existing responses
        const responsesQuery = `
            SELECT r.*, 
                   rm.file_name, rm.file_url,
                   oi.option_id, oi.display_label
            FROM Responses r
            LEFT JOIN ResponseMedia rm ON r.response_id = rm.response_id
            LEFT JOIN OptionInstances oi ON r.chosen_option_instance_id = oi.option_instance_id
            WHERE r.attempt_id = ${attemptId}
        `;
        
        const responses = await executeQuery(responsesQuery);

        // Group responses by question
        const responseMap = {};
        responses.forEach(r => {
            if (!responseMap[r.question_id]) {
                responseMap[r.question_id] = {
                    essay_text: r.essay_text,
                    chosen_options: [],
                    files: []
                };
            }
            
            if (r.option_id) {
                responseMap[r.question_id].chosen_options.push({
                    option_id: r.option_id,
                    display_label: r.display_label
                });
            }
            
            if (r.file_url) {
                responseMap[r.question_id].files.push({
                    name: r.file_name,
                    url: r.file_url
                });
            }
        });

        res.json({
            user: req.user,
            exam: exam[0],
            questions: questions,
            attemptId: attemptId,
            responses: responseMap,
            duration: Math.floor(exam[0].remaining_time / 60)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error starting exam' });
    }
});


module.exports = router;

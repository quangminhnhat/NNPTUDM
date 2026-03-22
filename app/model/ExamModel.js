const executeQuery = require("../service/executeQueryservice");
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { createMCQQuestion, editMCQQuestion, deleteMCQQuestion } = require('../service/mcqQuestionHelperservice');

class ExamModel {
  /**
   * Get exams based on user role
   * @param {Object} user - User object with role
   * @returns {Promise<Array>} Array of exams
   */
  static async getExams(user) {
    let query = '';
    const userRole = user.role.toLowerCase();

    if (userRole === 'admin') {
      query = `
        SELECT
          e.exam_id,
          e.exam_title,
          e.description,
          e.duration_min,
          e.total_points,
          e.passing_points,
          e.start_time,
          e.end_time,
          e.shuffle_questions,
          e.shuffle_options,
          e.exam_code,
          e.created_at,
          c.course_name,
          u.full_name as teacher_name,
          (SELECT COUNT(*) FROM Questions q WHERE q.exam_id = e.exam_id) as question_count,
          (SELECT COUNT(DISTINCT ea.classes_id) FROM ExamAssignments ea WHERE ea.exam_id = e.exam_id) as assigned_classes_count
        FROM Exams e
        LEFT JOIN courses c ON e.course_id = c.id
        LEFT JOIN teachers t ON e.teachers_id = t.id
        LEFT JOIN users u ON t.user_id = u.id
        ORDER BY e.created_at DESC
      `;
    } else if (userRole === 'teacher') {
      query = `
        SELECT
          e.exam_id,
          e.exam_title,
          e.description,
          e.duration_min,
          e.total_points,
          e.passing_points,
          e.start_time,
          e.end_time,
          e.shuffle_questions,
          e.shuffle_options,
          e.exam_code,
          e.created_at,
          c.course_name,
          (SELECT COUNT(*) FROM Questions q WHERE q.exam_id = e.exam_id) as question_count,
          (SELECT COUNT(DISTINCT ea.classes_id) FROM ExamAssignments ea WHERE ea.exam_id = e.exam_id) as assigned_classes_count
        FROM Exams e
        LEFT JOIN courses c ON e.course_id = c.id
        JOIN teachers t ON e.teachers_id = t.id
        WHERE t.user_id = ${user.id}
        ORDER BY e.created_at DESC
      `;
    } else if (userRole === 'student') {
      query = `
        WITH LatestAttempts AS (
          SELECT
            assignment_id,
            attempt_id,
            total_score,
            submitted_at,
            COUNT(*) OVER (PARTITION BY assignment_id, student_id) as attempt_count,
            ROW_NUMBER() OVER (PARTITION BY assignment_id, student_id ORDER BY started_at DESC) as rn
          FROM Attempts
          WHERE submitted_at IS NOT NULL AND student_id = (
            SELECT id FROM students WHERE user_id = ${user.id}
          )
        )
        SELECT DISTINCT
          e.exam_id,
          e.exam_title,
          e.description,
          e.duration_min,
          e.total_points,
          e.passing_points,
          e.start_time,
          e.end_time,
          e.shuffle_questions,
          e.shuffle_options,
          e.exam_code,
          e.created_at,
          c.course_name,
          CASE
            WHEN a.submitted_at IS NOT NULL THEN 'Completed'
            WHEN ea.open_at <= GETDATE() AND ea.close_at >= GETDATE() AND
                 (a.attempt_count IS NULL OR
                  (ea.max_attempts IS NULL OR a.attempt_count < ea.max_attempts)) THEN 'Available'
            WHEN ea.open_at > GETDATE() THEN 'Upcoming'
            ELSE 'Expired'
          END as exam_status,
          CASE
            WHEN a.submitted_at IS NOT NULL THEN 0
            WHEN ea.open_at <= GETDATE() AND ea.close_at >= GETDATE() AND
                 (a.attempt_count IS NULL OR
                  (ea.max_attempts IS NULL OR a.attempt_count < ea.max_attempts)) THEN 1
            WHEN ea.open_at > GETDATE() THEN 2
            ELSE 3
          END as status_order,
          a.total_score,
          ea.open_at,
          ea.close_at,
          ea.assignment_id,
          ea.max_attempts,
          ISNULL(a.attempt_count, 0) as attempt_count,
          s.id as student_id,
          en.class_id,
          cls.class_name
        FROM Exams e
        LEFT JOIN courses c ON e.course_id = c.id
        JOIN ExamAssignments ea ON e.exam_id = ea.exam_id
        JOIN classes cls ON ea.classes_id = cls.id
        JOIN enrollments en ON cls.id = en.class_id AND en.student_id = (
          SELECT id FROM students WHERE user_id = ${user.id}
        )
        JOIN students s ON s.id = en.student_id
        LEFT JOIN LatestAttempts a ON ea.assignment_id = a.assignment_id AND a.rn = 1
        WHERE s.user_id = ${user.id}
        ORDER BY status_order, ea.open_at ASC
      `;
    } else {
      const error = new Error('Unauthorized access');
      error.status = 403;
      throw error;
    }

    const exams = await executeQuery(query);
    return { exams };
  }

  /**
   * Create a new exam
   * @param {number} userId - User ID
   * @param {Object} data - Exam data
   * @returns {Promise<Object>} Success response
   */
  static async createExam(userId, data) {
    const {
      exam_title,
      course_id,
      total_marks,
      passing_marks,
      duration_minutes,
      start_time,
      end_time,
      shuffle_questions,
      shuffle_options
    } = data;

    const teacherQuery = `
      SELECT id FROM teachers WHERE user_id = ${userId}
    `;
    const teachers = await executeQuery(teacherQuery);

    if (!teachers || teachers.length === 0) {
      const error = new Error("Teacher not found");
      error.status = 404;
      throw error;
    }

    const teacherId = teachers[0].id;

    const duplicateQuery = `
      SELECT * FROM Exams
      WHERE exam_title = '${exam_title}'
        AND teachers_id = ${teacherId}
        AND course_id = ${course_id}
    `;
    const existing = await executeQuery(duplicateQuery);
    if (existing && existing.length > 0) {
      const error = new Error("Exam with this title already exists for this course");
      error.status = 400;
      throw error;
    }

    const insertQuery = `
      INSERT INTO Exams (exam_title, description, duration_min, total_points, passing_points, start_time, end_time, shuffle_questions, shuffle_options, course_id, teachers_id, exam_code, created_at)
      VALUES (
        '${exam_title.replace(/'/g, "''")}',
        '${(data.description || '').replace(/'/g, "''")}',
        ${duration_minutes || 0},
        ${total_marks || 0},
        ${passing_marks || 'NULL'},
        '${start_time}',
        '${end_time}',
        ${shuffle_questions ? 1 : 0},
        ${shuffle_options ? 1 : 0},
        ${course_id},
        ${teacherId},
        '${(data.exam_code || '').replace(/'/g, "''")}',
        GETDATE()
      )
    `;

    await executeQuery(insertQuery);

    return { success: true, message: 'Exam created successfully' };
  }

  /**
   * Import exams from Excel
   * @param {number} userId - User ID
   * @param {Buffer} workbookBuffer - Excel file buffer
   * @returns {Promise<Object>} Success response
   */
  static async importExamsFromExcel(userId, workbookBuffer) {
    if (!workbookBuffer) {
      const error = new Error("No file provided");
      error.status = 400;
      throw error;
    }

    const teacherQuery = `SELECT id FROM teachers WHERE user_id = ${userId}`;
    const teachers = await executeQuery(teacherQuery);

    if (!teachers || teachers.length === 0) {
      const error = new Error("Teacher not found");
      error.status = 404;
      throw error;
    }

    const teacherId = teachers[0].id;

    const workbook = xlsx.read(workbookBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    let insertedCount = 0;
    for (const row of rows) {
      try {
        const examData = {
          exam_title: row['Exam Title'],
          description: row['Description'] || '',
          course_id: row['Course ID'],
          total_marks: row['Total Marks'] || 0,
          passing_marks: row['Passing Marks'] || null,
          duration_minutes: row['Duration (minutes)'] || 0,
          start_time: row['Start Time'],
          end_time: row['End Time'],
          shuffle_questions: row['Shuffle Questions'] === 'Yes',
          shuffle_options: row['Shuffle Options'] === 'Yes',
          exam_code: row['Exam Code'] || ''
        };

        if (examData.exam_title && examData.course_id && examData.start_time && examData.end_time) {
          const duplicateQuery = `
            SELECT * FROM Exams
            WHERE exam_title = '${examData.exam_title.replace(/'/g, "''")}'
              AND teachers_id = ${teacherId}
              AND course_id = ${examData.course_id}
          `;
          const existing = await executeQuery(duplicateQuery);

          if (!existing || existing.length === 0) {
            const insertQuery = `
              INSERT INTO Exams (exam_title, description, duration_min, total_points, passing_points, start_time, end_time, shuffle_questions, shuffle_options, course_id, teachers_id, exam_code, created_at)
              VALUES (
                '${examData.exam_title.replace(/'/g, "''")}',
                '${examData.description.replace(/'/g, "''")}',
                ${examData.duration_minutes},
                ${examData.total_marks},
                ${examData.passing_marks || 'NULL'},
                '${examData.start_time}',
                '${examData.end_time}',
                ${examData.shuffle_questions ? 1 : 0},
                ${examData.shuffle_options ? 1 : 0},
                ${examData.course_id},
                ${teacherId},
                '${examData.exam_code.replace(/'/g, "''")}',
                GETDATE()
              )
            `;
            await executeQuery(insertQuery);
            insertedCount++;
          }
        }
      } catch (rowError) {
        console.error('Error processing row:', rowError);
      }
    }

    return { success: true, message: `Imported ${insertedCount} exams` };
  }

  /**
   * Get exam details by ID
   * @param {number} examId - Exam ID
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Exam details
   */
  static async getExamDetails(examId, userId) {
    const query = `
      SELECT e.*, t.user_id as teacher_user_id
      FROM Exams e
      LEFT JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
    `;

    const exam = await executeQuery(query);

    if (!exam || exam.length === 0) {
      const error = new Error("Exam not found");
      error.status = 404;
      throw error;
    }

    if (exam[0].teacher_user_id && exam[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to exam");
      error.status = 403;
      throw error;
    }

    const questionsQuery = `
      SELECT q.*, qt.type_name
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${examId}
      ORDER BY q.created_at
    `;

    const questions = await executeQuery(questionsQuery);

    return {
      exam: exam[0],
      questions,
    };
  }

  /**
   * Update exam by ID
   * @param {number} examId - Exam ID
   * @param {number} userId - User ID for authorization
   * @param {Object} data - Updated exam data
   * @returns {Promise<Object>} Success response
   */
  static async updateExam(examId, userId, data) {
    const { exam_title, description, duration_minutes, total_marks, passing_marks } = data;

    const verifyQuery = `
      SELECT e.*
      FROM Exams e
      JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
      AND t.user_id = ${userId}
    `;

    const exam = await executeQuery(verifyQuery);

    if (!exam || exam.length === 0) {
      const error = new Error("Exam not found or unauthorized");
      error.status = 404;
      throw error;
    }

    const updateQuery = `
      UPDATE Exams
      SET exam_title = '${(exam_title || '').replace(/'/g, "''")}',
          description = '${(description || '').replace(/'/g, "''")}',
          duration_min = ${duration_minutes || 0},
          total_points = ${total_marks || 0},
          passing_points = ${passing_marks || 'NULL'},
          updated_at = GETDATE()
      WHERE exam_id = ${examId}
    `;

    await executeQuery(updateQuery);

    return { success: true, message: 'Exam updated successfully' };
  }

  /**
   * Delete exam by ID
   * @param {number} examId - Exam ID
   * @param {Object} user - User object for authorization
   * @returns {Promise<Object>} Success response
   */
  static async deleteExam(examId, user) {
    if (user.role === 'teacher') {
      const verifyQuery = `
        SELECT e.*
        FROM Exams e
        JOIN teachers t ON e.teachers_id = t.id
        WHERE e.exam_id = ${examId}
        AND t.user_id = ${user.id}
      `;
      const exam = await executeQuery(verifyQuery);

      if (!exam || exam.length === 0) {
        const error = new Error("Exam not found or unauthorized");
        error.status = 404;
        throw error;
      }
    }

    // Delete related records in correct order
    await executeQuery(`
      DELETE rm
      FROM ResponseMedia rm
      JOIN Responses r ON rm.response_id = r.response_id
      JOIN Attempts a ON r.attempt_id = a.attempt_id
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      WHERE ea.exam_id = ${examId}
    `);

    await executeQuery(`
      DELETE r
      FROM Responses r
      JOIN Attempts a ON r.attempt_id = a.attempt_id
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      WHERE ea.exam_id = ${examId}
    `);

    await executeQuery(`
      DELETE a
      FROM Attempts a
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      WHERE ea.exam_id = ${examId}
    `);

    await executeQuery(`DELETE FROM ExamAssignments WHERE exam_id = ${examId}`);

    await executeQuery(`
      DELETE qm
      FROM QuestionMedia qm
      JOIN Questions q ON qm.question_id = q.question_id
      WHERE q.exam_id = ${examId}
    `);

    await executeQuery(`
      DELETE mo
      FROM MCQOptions mo
      JOIN Questions q ON mo.question_id = q.question_id
      WHERE q.exam_id = ${examId}
    `);

    await executeQuery(`DELETE FROM Questions WHERE exam_id = ${examId}`);
    await executeQuery(`DELETE FROM Exams WHERE exam_id = ${examId}`);

    return { success: true, message: 'Exam deleted successfully' };
  }

  /**
   * Add question to exam
   * @param {number|string} examId - Exam ID or 'bank'
   * @param {number} userId - User ID
   * @param {Object} data - Question data
   * @param {Array} files - Uploaded files
   * @returns {Promise<Object>} Success response
   */
  static async addQuestion(examId, userId, data, files) {
    const { question_text, type_id, points, difficulty } = data;

    if (type_id === '1' || type_id === 1) {
      return await createMCQQuestion(examId, userId, data, files);
    }

    const questionQuery = `
      INSERT INTO Questions (exam_id, type_id, points, body_text, difficulty, created_at)
      OUTPUT INSERTED.question_id
      VALUES (${examId === 'bank' ? 'NULL' : examId}, ${type_id}, ${points}, '${(question_text || '').replace(/'/g, "''")}', ${difficulty || 'NULL'}, GETDATE())
    `;
    const question = await executeQuery(questionQuery);
    const questionId = question[0].question_id;

    if (files && files.length > 0) {
      for (const file of files) {
        const fileName = `${Date.now()}_${file.originalname}`;
        const filePath = path.join('uploads', 'exam_media', fileName);

        // Move file to uploads directory
        const tempPath = file.path;
        const targetPath = path.join(__dirname, '..', 'public', filePath);

        // Ensure directory exists
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.renameSync(tempPath, targetPath);

        // Insert media record
        const mediaQuery = `
          INSERT INTO QuestionMedia (question_id, media_type, file_path, file_name, uploaded_at)
          VALUES (${questionId}, '${file.mimetype}', '${filePath}', '${file.originalname}', GETDATE())
        `;
        await executeQuery(mediaQuery);
      }
    }

    return {
      success: true,
      message: examId === 'bank' ? 'Question added to bank successfully' : 'Question added to exam successfully',
      questionId
    };
  }

  /**
   * Get exam questions
   * @param {number} examId - Exam ID
   * @returns {Promise<Array>} Array of questions
   */
  static async getExamQuestions(examId) {
    const query = `
      SELECT q.*, qt.type_name,
             (SELECT JSON_QUERY((SELECT mo.* FROM MCQOptions mo WHERE mo.question_id = q.question_id FOR JSON PATH))) as options,
             (SELECT JSON_QUERY((SELECT qm.* FROM QuestionMedia qm WHERE qm.question_id = q.question_id FOR JSON PATH))) as media
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${examId}
    `;
    const questions = await executeQuery(query);
    return questions;
  }

  /**
   * Get question edit data
   * @param {number} questionId - Question ID
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Question edit data
   */
  static async getQuestionEditData(questionId, userId) {
    const questionQuery = `
      SELECT q.*, qt.type_name,
             (SELECT ISNULL((SELECT mo.* FROM MCQOptions mo WHERE mo.question_id = q.question_id FOR JSON PATH), '[]')) as options,
             (SELECT JSON_QUERY((SELECT qm.* FROM QuestionMedia qm WHERE qm.question_id = q.question_id FOR JSON PATH))) as media,
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
      const error = new Error("Question not found");
      error.status = 404;
      throw error;
    }

    if (question[0].exam_id && question[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to question");
      error.status = 403;
      throw error;
    }

    return {
      question: {
        ...question[0],
        options: JSON.parse(question[0].options || '[]'),
        media: JSON.parse(question[0].media || '[]')
      },
      examId: question[0].exam_id
    };
  }

  /**
   * Update question
   * @param {number} questionId - Question ID
   * @param {number} userId - User ID for authorization
   * @param {Object} data - Updated question data
   * @param {Array} files - New uploaded files
   * @returns {Promise<Object>} Success response
   */
  static async updateQuestion(questionId, userId, data, files) {
    const { question_text, points, difficulty, type_id } = data;

    const verifyQuery = `
      SELECT q.*, e.teachers_id
      FROM Questions q
      LEFT JOIN Exams e ON q.exam_id = e.exam_id
      WHERE q.question_id = ${questionId}
    `;

    const question = await executeQuery(verifyQuery);

    if (!question || question.length === 0) {
      const error = new Error("Question not found");
      error.status = 404;
      throw error;
    }

    if (question[0].exam_id) {
      const teacherQuery = `SELECT user_id FROM teachers WHERE id = ${question[0].teachers_id}`;
      const teacher = await executeQuery(teacherQuery);

      if (!teacher || teacher.length === 0 || teacher[0].user_id !== userId) {
        const error = new Error("Unauthorized access to question");
        error.status = 403;
        throw error;
      }
    }

    if (type_id == 1 || question[0].type_id === 1) {
      return await editMCQQuestion(questionId, userId, data, files);
    }

    const updateQuery = `
      UPDATE Questions
      SET points = ${points},
          body_text = '${(question_text || '').replace(/'/g, "''")}',
          difficulty = ${difficulty || 'NULL'},
          updated_at = GETDATE()
      WHERE question_id = ${questionId}
    `;
    await executeQuery(updateQuery);

    if (files && files.length > 0) {
      for (const file of files) {
        const fileName = `${Date.now()}_${file.originalname}`;
        const filePath = path.join('uploads', 'exam_media', fileName);

        // Move file to uploads directory
        const tempPath = file.path;
        const targetPath = path.join(__dirname, '..', 'public', filePath);

        // Ensure directory exists
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.renameSync(tempPath, targetPath);

        // Insert media record
        const mediaQuery = `
          INSERT INTO QuestionMedia (question_id, media_type, file_path, file_name, uploaded_at)
          VALUES (${questionId}, '${file.mimetype}', '${filePath}', '${file.originalname}', GETDATE())
        `;
        await executeQuery(mediaQuery);
      }
    }

    return { message: 'Question updated successfully' };
  }

  /**
   * Delete question
   * @param {number} questionId - Question ID
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Success response
   */
  static async deleteQuestion(questionId, userId) {
    const verifyQuery = `
      SELECT q.*, e.teachers_id
      FROM Questions q
      LEFT JOIN Exams e ON q.exam_id = e.exam_id
      WHERE q.question_id = ${questionId}
    `;
    const question = await executeQuery(verifyQuery);

    if (!question || question.length === 0) {
      const error = new Error("Question not found");
      error.status = 404;
      throw error;
    }

    if (question[0].exam_id) {
      const teacherQuery = `SELECT user_id FROM teachers WHERE id = ${question[0].teachers_id}`;
      const teacher = await executeQuery(teacherQuery);

      if (!teacher || teacher.length === 0 || teacher[0].user_id !== userId) {
        const error = new Error("Unauthorized access to question");
        error.status = 403;
        throw error;
      }
    }

    if (question[0].type_id === 1) {
      return await deleteMCQQuestion(questionId, userId);
    }

    await executeQuery(`DELETE FROM QuestionMedia WHERE question_id = ${questionId}`);
    await executeQuery(`DELETE FROM Questions WHERE question_id = ${questionId}`);

    return { message: 'Question deleted successfully' };
  }

  /**
   * Delete question media
   * @param {number} mediaId - Media ID
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Success response
   */
  static async deleteQuestionMedia(mediaId, userId) {
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
      const error = new Error("Media not found");
      error.status = 404;
      throw error;
    }

    if (media[0].exam_id && media[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to media");
      error.status = 403;
      throw error;
    }

    try {
      const filePath = path.join(__dirname, '..', 'public', media[0].file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Error deleting media file:", error);
    }

    await executeQuery(`DELETE FROM QuestionMedia WHERE media_id = ${mediaId}`);

    return { success: true, message: 'Media deleted successfully' };
  }

  /**
   * Get exam assignment data
   * @param {number} examId - Exam ID
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Assignment data
   */
  static async getExamAssignData(examId, userId) {
    const examQuery = `
      SELECT e.*, t.user_id as teacher_user_id
      FROM Exams e
      JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
    `;
    const exam = await executeQuery(examQuery);

    if (!exam || exam.length === 0) {
      const error = new Error("Exam not found");
      error.status = 404;
      throw error;
    }

    if (exam[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to exam");
      error.status = 403;
      throw error;
    }

    const assignmentsQuery = `
      SELECT ea.*, c.class_name,
             (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id) as student_count
      FROM ExamAssignments ea
      JOIN classes c ON ea.classes_id = c.id
      WHERE ea.exam_id = ${examId}
      ORDER BY ea.open_at DESC
    `;
    const assignments = await executeQuery(assignmentsQuery);

    const availableClassesQuery = `
      SELECT c.*
      FROM classes c
      JOIN teachers t ON c.teacher_id = t.id
      WHERE t.user_id = ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM ExamAssignments ea
          WHERE ea.classes_id = c.id
            AND ea.exam_id = ${examId}
        )
    `;
    const availableClasses = await executeQuery(availableClassesQuery);

    return {
      exam: exam[0],
      assignments,
      availableClasses
    };
  }

  /**
   * Assign exam to class
   * @param {number} examId - Exam ID
   * @param {number} userId - User ID for authorization
   * @param {Object} data - Assignment data
   * @returns {Promise<Object>} Success response
   */
  static async assignExamToClass(examId, userId, data) {
    const { class_id, open_at, close_at, max_attempts } = data;

    const examQuery = `
      SELECT e.*, t.user_id as teacher_user_id
      FROM Exams e
      JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
    `;
    const exam = await executeQuery(examQuery);

    if (!exam || exam.length === 0) {
      const error = new Error("Exam not found");
      error.status = 404;
      throw error;
    }

    if (exam[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to exam");
      error.status = 403;
      throw error;
    }

    const classQuery = `
      SELECT c.*
      FROM classes c
      JOIN teachers t ON c.teacher_id = t.id
      WHERE c.id = ${class_id}
      AND t.user_id = ${userId}
    `;
    const classData = await executeQuery(classQuery);

    if (!classData || classData.length === 0) {
      const error = new Error("Class not found or unauthorized");
      error.status = 404;
      throw error;
    }

    const existingAssignmentQuery = `
      SELECT * FROM ExamAssignments
      WHERE exam_id = ${examId}
      AND classes_id = ${class_id}
    `;
    const existing = await executeQuery(existingAssignmentQuery);

    if (existing && existing.length > 0) {
      const error = new Error("Exam already assigned to this class");
      error.status = 400;
      throw error;
    }

    const insertQuery = `
      INSERT INTO ExamAssignments (exam_id, classes_id, open_at, close_at, max_attempts, created_at)
      VALUES (${examId}, ${class_id}, '${open_at}', '${close_at}', ${max_attempts || 1}, GETDATE())
    `;
    await executeQuery(insertQuery);

    return { success: true, message: 'Exam assigned to class successfully' };
  }

  /**
   * Delete exam assignment
   * @param {number} assignmentId - Assignment ID
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Success response
   */
  static async deleteExamAssignment(assignmentId, userId) {
    const assignmentQuery = `
      SELECT ea.*, t.user_id as teacher_user_id
      FROM ExamAssignments ea
      JOIN Exams e ON ea.exam_id = e.exam_id
      JOIN teachers t ON e.teachers_id = t.id
      WHERE ea.assignment_id = ${assignmentId}
    `;
    const assignment = await executeQuery(assignmentQuery);

    if (!assignment || assignment.length === 0) {
      const error = new Error("Assignment not found");
      error.status = 404;
      throw error;
    }

    if (assignment[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to assignment");
      error.status = 403;
      throw error;
    }

    await executeQuery(`DELETE FROM ExamAssignments WHERE assignment_id = ${assignmentId}`);

    return { success: true, message: 'Exam assignment deleted successfully' };
  }

  /**
   * Get assignment scores
   * @param {number} assignmentId - Assignment ID
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Scores data
   */
  static async getAssignmentScores(assignmentId, userId) {
    const assignmentQuery = `
      SELECT ea.*, e.exam_title, t.user_id as teacher_user_id
      FROM ExamAssignments ea
      JOIN Exams e ON ea.exam_id = e.exam_id
      JOIN teachers t ON e.teachers_id = t.id
      WHERE ea.assignment_id = ${assignmentId}
    `;
    const assignment = await executeQuery(assignmentQuery);

    if (!assignment || assignment.length === 0) {
      const error = new Error("Assignment not found");
      error.status = 404;
      throw error;
    }

    if (assignment[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to assignment");
      error.status = 403;
      throw error;
    }

    const scoresQuery = `
      SELECT
        a.attempt_id,
        a.started_at,
        a.submitted_at,
        a.total_score,
        a.is_graded,
        u.full_name as student_name,
        u.username as student_username,
        ROW_NUMBER() OVER (PARTITION BY a.student_id ORDER BY a.started_at DESC) as attempt_number
      FROM Attempts a
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE a.assignment_id = ${assignmentId}
      ORDER BY u.full_name, a.started_at DESC
    `;
    const scores = await executeQuery(scoresQuery);

    return {
      assignment: assignment[0],
      scores
    };
  }

  /**
   * Get attempt grade data
   * @param {number} attemptId - Attempt ID
   * @param {number} userId - User ID for authorization
   * @returns {Promise<Object>} Grade data
   */
  static async getAttemptGradeData(attemptId, userId) {
    const attemptQuery = `
      SELECT a.*, ea.exam_id, t.user_id as teacher_user_id, u.full_name as student_name
      FROM Attempts a
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      JOIN Exams e ON ea.exam_id = e.exam_id
      JOIN teachers t ON e.teachers_id = t.id
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE a.attempt_id = ${attemptId}
    `;
    const attempt = await executeQuery(attemptQuery);

    if (!attempt || attempt.length === 0) {
      const error = new Error("Attempt not found");
      error.status = 404;
      throw error;
    }

    if (attempt[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to attempt");
      error.status = 403;
      throw error;
    }

    const responsesQuery = `
      SELECT r.*, q.body_text as question_text, q.points as max_points, qt.type_name
      FROM Responses r
      JOIN Questions q ON r.question_id = q.question_id
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE r.attempt_id = ${attemptId}
      ORDER BY q.created_at
    `;
    const responses = await executeQuery(responsesQuery);

    return {
      attempt: attempt[0],
      responses
    };
  }

  /**
   * Grade attempt
   * @param {number} attemptId - Attempt ID
   * @param {number} userId - User ID for authorization
   * @param {Object} data - Grade data
   * @returns {Promise<Object>} Success response
   */
  static async gradeAttempt(attemptId, userId, data) {
    const attemptQuery = `
      SELECT a.*, ea.exam_id, t.user_id as teacher_user_id
      FROM Attempts a
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      JOIN Exams e ON ea.exam_id = e.exam_id
      JOIN teachers t ON e.teachers_id = t.id
      WHERE a.attempt_id = ${attemptId}
    `;
    const attempt = await executeQuery(attemptQuery);

    if (!attempt || attempt.length === 0) {
      const error = new Error("Attempt not found");
      error.status = 404;
      throw error;
    }

    if (attempt[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to attempt");
      error.status = 403;
      throw error;
    }

    let totalScore = 0;
    for (const [responseId, score] of Object.entries(data)) {
      if (responseId.startsWith('response_')) {
        const actualResponseId = responseId.replace('response_', '');
        const updateQuery = `
          UPDATE Responses
          SET score = ${score || 0}, graded_at = GETDATE()
          WHERE response_id = ${actualResponseId}
        `;
        await executeQuery(updateQuery);
        totalScore += parseFloat(score || 0);
      }
    }

    const updateAttemptQuery = `
      UPDATE Attempts
      SET total_score = ${totalScore}, is_graded = 1, graded_at = GETDATE()
      WHERE attempt_id = ${attemptId}
    `;
    await executeQuery(updateAttemptQuery);

    return { success: true, message: 'Attempt graded successfully' };
  }

  /**
   * Start exam attempt
   * @param {number} assignmentId - Assignment ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Attempt data
   */
  static async startExamAttempt(assignmentId, userId) {
    const studentQuery = `SELECT id FROM students WHERE user_id = ${userId}`;
    const student = await executeQuery(studentQuery);

    if (!student || student.length === 0) {
      const error = new Error("Student not found");
      error.status = 404;
      throw error;
    }

    const studentId = student[0].id;

    const assignmentQuery = `
      SELECT ea.*, e.exam_title, e.duration_min, e.total_points, e.shuffle_questions, e.shuffle_options
      FROM ExamAssignments ea
      JOIN Exams e ON ea.exam_id = e.exam_id
      WHERE ea.assignment_id = ${assignmentId}
      AND ea.open_at <= GETDATE()
      AND ea.close_at >= GETDATE()
    `;
    const assignment = await executeQuery(assignmentQuery);

    if (!assignment || assignment.length === 0) {
      const error = new Error("Assignment not found or not available");
      error.status = 404;
      throw error;
    }

    const existingAttemptsQuery = `
      SELECT COUNT(*) as attempt_count
      FROM Attempts
      WHERE assignment_id = ${assignmentId}
      AND student_id = ${studentId}
    `;
    const existingAttempts = await executeQuery(existingAttemptsQuery);
    const attemptCount = existingAttempts[0].attempt_count;

    if (attemptCount >= assignment[0].max_attempts) {
      const error = new Error("Maximum attempts reached");
      error.status = 400;
      throw error;
    }

    const insertAttemptQuery = `
      INSERT INTO Attempts (assignment_id, student_id, started_at, created_at)
      OUTPUT INSERTED.attempt_id
      VALUES (${assignmentId}, ${studentId}, GETDATE(), GETDATE())
    `;
    const attempt = await executeQuery(insertAttemptQuery);
    const attemptId = attempt[0].attempt_id;

    const questionsQuery = `
      SELECT q.question_id, q.body_text, q.points, q.difficulty, qt.type_name,
             (SELECT JSON_QUERY((SELECT mo.* FROM MCQOptions mo WHERE mo.question_id = q.question_id FOR JSON PATH))) as options,
             (SELECT JSON_QUERY((SELECT qm.* FROM QuestionMedia qm WHERE qm.question_id = q.question_id FOR JSON PATH))) as media
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${assignment[0].exam_id}
      ORDER BY ${assignment[0].shuffle_questions ? 'NEWID()' : 'q.created_at'}
    `;
    const questions = await executeQuery(questionsQuery);

    // Shuffle options if required
    if (assignment[0].shuffle_options) {
      questions.forEach(question => {
        if (question.options) {
          const options = JSON.parse(question.options);
          // Shuffle options array
          for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
          }
          question.options = JSON.stringify(options);
        }
      });
    }

    return {
      attemptId,
      assignment: assignment[0],
      questions
    };
  }

  /**
   * Submit exam attempt
   * @param {number} attemptId - Attempt ID
   * @param {number} userId - User ID
   * @param {Object} responses - Student responses
   * @param {Array} files - Uploaded files
   * @returns {Promise<Object>} Success response
   */
  static async submitExamAttempt(attemptId, userId, responses, files) {
    const studentQuery = `SELECT id FROM students WHERE user_id = ${userId}`;
    const student = await executeQuery(studentQuery);

    if (!student || student.length === 0) {
      const error = new Error("Student not found");
      error.status = 404;
      throw error;
    }

    const studentId = student[0].id;

    const attemptQuery = `
      SELECT a.*, ea.exam_id
      FROM Attempts a
      JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
      WHERE a.attempt_id = ${attemptId}
      AND a.student_id = ${studentId}
      AND a.submitted_at IS NULL
    `;
    const attempt = await executeQuery(attemptQuery);

    if (!attempt || attempt.length === 0) {
      const error = new Error("Attempt not found or already submitted");
      error.status = 404;
      throw error;
    }

    // Insert responses
    for (const [questionId, responseData] of Object.entries(responses)) {
      let responseText = '';
      let selectedOptionId = null;

      if (typeof responseData === 'string') {
        responseText = responseData;
      } else if (typeof responseData === 'object') {
        responseText = responseData.text || '';
        selectedOptionId = responseData.selectedOption || null;
      }

      const insertResponseQuery = `
        INSERT INTO Responses (attempt_id, question_id, response_text, selected_option_id, created_at)
        VALUES (${attemptId}, ${questionId}, '${responseText.replace(/'/g, "''")}', ${selectedOptionId || 'NULL'}, GETDATE())
      `;
      await executeQuery(insertResponseQuery);
    }

    // Handle file uploads
    if (files && files.length > 0) {
      for (const file of files) {
        const fileName = `${Date.now()}_${file.originalname}`;
        const filePath = path.join('uploads', 'exam_media', fileName);

        // Move file to uploads directory
        const tempPath = file.path;
        const targetPath = path.join(__dirname, '..', 'public', filePath);

        // Ensure directory exists
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.renameSync(tempPath, targetPath);

        // Insert media record - assuming question_id is passed in some way
        // This might need adjustment based on how files are associated with questions
        const mediaQuery = `
          INSERT INTO ResponseMedia (response_id, media_type, file_path, file_name, uploaded_at)
          VALUES ((SELECT TOP 1 response_id FROM Responses WHERE attempt_id = ${attemptId} ORDER BY created_at DESC), '${file.mimetype}', '${filePath}', '${file.originalname}', GETDATE())
        `;
        await executeQuery(mediaQuery);
      }
    }

    // Update attempt as submitted
    const updateAttemptQuery = `
      UPDATE Attempts
      SET submitted_at = GETDATE()
      WHERE attempt_id = ${attemptId}
    `;
    await executeQuery(updateAttemptQuery);

    return { success: true, message: 'Exam submitted successfully' };
  }

  /**
   * Take exam (get exam data for student)
   * @param {number} assignmentId - Assignment ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Exam data
   */
  static async takeExam(assignmentId, userId) {
    const studentQuery = `SELECT id FROM students WHERE user_id = ${userId}`;
    const student = await executeQuery(studentQuery);

    if (!student || student.length === 0) {
      const error = new Error("Student not found");
      error.status = 404;
      throw error;
    }

    const studentId = student[0].id;

    const assignmentQuery = `
      SELECT ea.*, e.exam_title, e.description, e.duration_min, e.total_points,
             e.start_time, e.end_time, e.shuffle_questions, e.shuffle_options,
             c.course_name, cls.class_name
      FROM ExamAssignments ea
      JOIN Exams e ON ea.exam_id = e.exam_id
      JOIN courses c ON e.course_id = c.id
      JOIN classes cls ON ea.classes_id = cls.id
      WHERE ea.assignment_id = ${assignmentId}
      AND ea.open_at <= GETDATE()
      AND ea.close_at >= GETDATE()
    `;
    const assignment = await executeQuery(assignmentQuery);

    if (!assignment || assignment.length === 0) {
      const error = new Error("Assignment not found or not available");
      error.status = 404;
      throw error;
    }

    const existingAttemptsQuery = `
      SELECT COUNT(*) as attempt_count, MAX(a.started_at) as last_attempt_time
      FROM Attempts a
      WHERE a.assignment_id = ${assignmentId}
      AND a.student_id = ${studentId}
    `;
    const existingAttempts = await executeQuery(existingAttemptsQuery);
    const attemptCount = existingAttempts[0].attempt_count;
    const lastAttemptTime = existingAttempts[0].last_attempt_time;

    if (attemptCount >= assignment[0].max_attempts) {
      const error = new Error("Maximum attempts reached");
      error.status = 400;
      throw error;
    }

    const questionsQuery = `
      SELECT q.question_id, q.body_text, q.points, q.difficulty, qt.type_name,
             (SELECT JSON_QUERY((SELECT mo.* FROM MCQOptions mo WHERE mo.question_id = q.question_id FOR JSON PATH))) as options,
             (SELECT JSON_QUERY((SELECT qm.* FROM QuestionMedia qm WHERE qm.question_id = q.question_id FOR JSON PATH))) as media
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${assignment[0].exam_id}
      ORDER BY ${assignment[0].shuffle_questions ? 'NEWID()' : 'q.created_at'}
    `;
    const questions = await executeQuery(questionsQuery);

    // Shuffle options if required
    if (assignment[0].shuffle_options) {
      questions.forEach(question => {
        if (question.options) {
          const options = JSON.parse(question.options);
          // Shuffle options array
          for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
          }
          question.options = JSON.stringify(options);
        }
      });
    }

    return {
      assignment: assignment[0],
      questions,
      attemptCount,
      lastAttemptTime,
      remainingAttempts: assignment[0].max_attempts - attemptCount
    };
  }

  /**
   * Get new exam form data
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Form data
   */
  static async getNewExamFormData(userId) {
    const classesQuery = `
      SELECT c.*, co.course_name
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      WHERE t.user_id = ${userId}
    `;
    const coursesQuery = `
      SELECT id, course_name FROM courses ORDER BY course_name
    `;
    const subjectsQuery = `
      SELECT * FROM Subjects ORDER BY subject_name
    `;
    const difficultyLevelsQuery = `
      SELECT * FROM DifficultyLevels ORDER BY level_name
    `;
    const questionTypesQuery = `
      SELECT * FROM QuestionTypes ORDER BY type_name
    `;

    const [classes, courses, subjects, difficultyLevels, questionTypes] = await Promise.all([
      executeQuery(classesQuery),
      executeQuery(coursesQuery),
      executeQuery(subjectsQuery),
      executeQuery(difficultyLevelsQuery),
      executeQuery(questionTypesQuery)
    ]);

    return {
      classes,
      courses,
      subjects,
      difficultyLevels,
      questionTypes,
    };
  }

  /**
   * Get question form data
   * @param {number} examId - Exam ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Form data
   */
  static async getQuestionFormData(examId, userId) {
    const verifyQuery = `
      SELECT e.*, t.user_id as teacher_user_id
      FROM Exams e
      JOIN teachers t ON e.teachers_id = t.id
      WHERE e.exam_id = ${examId}
    `;

    const exam = await executeQuery(verifyQuery);

    if (!exam || exam.length === 0) {
      const error = new Error("Exam not found");
      error.status = 404;
      throw error;
    }

    if (exam[0].teacher_user_id !== userId) {
      const error = new Error("Unauthorized access to exam");
      error.status = 403;
      throw error;
    }

    return { examId };
  }
}

module.exports = ExamModel;
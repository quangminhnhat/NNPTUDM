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
          e.shuffle_questions,
          e.shuffle_options,
          e.exam_code,
          e.created_at,
          u.full_name as teacher_name,
          (SELECT COUNT(*) FROM Questions q WHERE q.exam_id = e.exam_id) as question_count,
          (SELECT COUNT(DISTINCT ea.classes_id) FROM ExamAssignments ea WHERE ea.exam_id = e.exam_id) as assigned_classes_count
        FROM Exams e
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
          e.shuffle_questions,
          e.shuffle_options,
          e.exam_code,
          e.created_at,
          (SELECT COUNT(*) FROM Questions q WHERE q.exam_id = e.exam_id) as question_count,
          (SELECT COUNT(DISTINCT ea.classes_id) FROM ExamAssignments ea WHERE ea.exam_id = e.exam_id) as assigned_classes_count
        FROM Exams e
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
            status,
            COUNT(*) OVER (PARTITION BY assignment_id, student_id) as attempt_count,
            ROW_NUMBER() OVER (PARTITION BY assignment_id, student_id ORDER BY started_at DESC) as rn
          FROM Attempts
          WHERE student_id = (
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
          e.shuffle_questions,
          e.shuffle_options,
          e.exam_code,
          e.created_at,
          c.course_name,
          u.full_name as teacher_name,
          CASE
            WHEN a.status = 'in_progress' THEN 'In Progress'
            WHEN ea.open_at <= GETDATE() AND ea.close_at >= GETDATE() AND
                 (a.attempt_count IS NULL OR a.attempt_count < ISNULL(ea.max_attempts, 2147483647)) THEN 'Available'
            WHEN ea.open_at > GETDATE() THEN 'Upcoming'
            WHEN a.attempt_count >= ISNULL(ea.max_attempts, 0) THEN 'Completed'
            ELSE 'Expired'
          END as exam_status,
          CASE
            WHEN a.status = 'in_progress' THEN 0
            WHEN ea.open_at <= GETDATE() AND ea.close_at >= GETDATE() AND
                 (a.attempt_count IS NULL OR a.attempt_count < ISNULL(ea.max_attempts, 2147483647)) THEN 1
            WHEN ea.open_at > GETDATE() THEN 2
            WHEN a.attempt_count >= ISNULL(ea.max_attempts, 0) THEN 3
            ELSE 4
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
        JOIN ExamAssignments ea ON e.exam_id = ea.exam_id
        JOIN classes cls ON ea.classes_id = cls.id
        JOIN courses c ON cls.course_id = c.id
        JOIN teachers t ON cls.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
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
      total_marks,
      passing_marks,
      duration_minutes,
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

    // Generate exam code if not provided
    let exam_code = data.exam_code;
    if (!exam_code) {
      // Find the highest existing exam code number and increment
      const codeQuery = `
        SELECT TOP 1 exam_code
        FROM Exams
        WHERE exam_code LIKE 'EXAM%'
        ORDER BY CAST(SUBSTRING(exam_code, 5, LEN(exam_code) - 4) AS INT) DESC
      `;
      const existingCodes = await executeQuery(codeQuery);
      let nextNumber = 1;

      if (existingCodes && existingCodes.length > 0) {
        const lastCode = existingCodes[0].exam_code;
        const numberPart = lastCode.substring(4); // Remove 'EXAM' prefix
        nextNumber = parseInt(numberPart) + 1;
      }

      exam_code = `EXAM${nextNumber.toString().padStart(3, '0')}`;
    }

    const duplicateQuery = `
      SELECT * FROM Exams
      WHERE exam_title = '${exam_title}'
        AND teachers_id = ${teacherId}
    `;
    const existing = await executeQuery(duplicateQuery);
    if (existing && existing.length > 0) {
      const error = new Error("Exam with this title already exists for this course");
      error.status = 400;
      throw error;
    }

    const insertQuery = `
      INSERT INTO Exams (exam_title, description, duration_min, total_points, passing_points, shuffle_questions, shuffle_options, teachers_id, exam_code, created_at)
      VALUES (
        '${exam_title.replace(/'/g, "''")}',
        '${(data.description || '').replace(/'/g, "''")}',
        ${duration_minutes || 0},
        ${total_marks || 0},
        ${passing_marks || 'NULL'},
        ${shuffle_questions ? 1 : 0},
        ${shuffle_options ? 1 : 0},
        ${teacherId},
        '${exam_code.replace(/'/g, "''")}',
        GETDATE()
      )
    `;

    await executeQuery(insertQuery);

    // Get the newly created exam ID
    const examIdQuery = `
      SELECT exam_id FROM Exams
      WHERE exam_title = '${exam_title.replace(/'/g, "''")}'
        AND teachers_id = ${teacherId}
      ORDER BY created_at DESC
    `;
    const examResult = await executeQuery(examIdQuery);
    const examId = examResult[0].exam_id;

    return { success: true, message: 'Exam created successfully', examId };
  }

  /**
   * Import exams from Excel
   * @param {number} userId - User ID
   * @param {Buffer} workbookBuffer - Excel file buffer
   * @returns {Promise<Object>} Success response with examId
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

    console.log('Available sheet names:', workbook.SheetNames);

    // Process Exam sheet
    let examId = null;
    const examSheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('exam'));
    if (examSheetName) {
      const examSheet = workbook.Sheets[examSheetName];
      const examRows = xlsx.utils.sheet_to_json(examSheet);

      console.log('Exam rows:', examRows.length, examRows[0] ? Object.keys(examRows[0]) : 'No rows');

      if (examRows.length > 0) {
        const row = examRows[0]; // Take first exam only
        const examData = {
          exam_title: row['exam_title'] || row['Exam Title'] || row['examTitle'] || row['title'] || row['Exam title'] || row['exam name'] || row['Exam Name'],
          description: row['description'] || row['Description'] || row['desc'],
          total_marks: row['total_marks'] || row['Total Marks'] || row['totalMarks'] || row['marks'] || row['Total marks'] || row['total points'] || row['Total Points'],
          passing_marks: row['passing_marks'] || row['Passing Marks'] || row['passingMarks'] || row['passing'] || row['Passing marks'] || row['passing score'] || row['Passing Score'],
          duration_minutes: row['duration_minutes'] || row['Duration Minutes'] || row['durationMinutes'] || row['duration'] || row['Duration minutes'] || row['time'] || row['Time']
        };

        console.log('Parsed exam data:', examData);

        if (examData.exam_title) {
          // Generate exam code automatically
          const codeQuery = `
            SELECT TOP 1 exam_code
            FROM Exams
            WHERE exam_code LIKE 'EXAM%'
            ORDER BY CAST(SUBSTRING(exam_code, 5, LEN(exam_code) - 4) AS INT) DESC
          `;
          const existingCodes = await executeQuery(codeQuery);
          let nextNumber = 1;

          if (existingCodes && existingCodes.length > 0) {
            const lastCode = existingCodes[0].exam_code;
            const numberPart = lastCode.substring(4);
            nextNumber = parseInt(numberPart) + 1;
          }

          const exam_code = `EXAM${nextNumber.toString().padStart(3, '0')}`;

          const insertQuery = `
            INSERT INTO Exams (exam_title, description, duration_min, total_points, passing_points, shuffle_questions, shuffle_options, teachers_id, exam_code, created_at)
            VALUES (
              '${examData.exam_title.replace(/'/g, "''")}',
              '${examData.description.replace(/'/g, "''")}',
              ${examData.duration_minutes},
              ${examData.total_marks},
              ${examData.passing_marks || 'NULL'},
              0, 0, ${teacherId}, '${exam_code}', GETDATE()
            )
          `;
          await executeQuery(insertQuery);

          // Get the created exam ID
          const examIdQuery = `
            SELECT exam_id FROM Exams
            WHERE exam_title = '${examData.exam_title.replace(/'/g, "''")}'
              AND teachers_id = ${teacherId}
            ORDER BY created_at DESC
          `;
          const examResult = await executeQuery(examIdQuery);
          examId = examResult[0].exam_id;
        }
      }
    }

    // Process Questions sheet if exam was created
    let questionsInserted = 0;
    const questionsSheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('question'));
    if (examId && questionsSheetName) {
      const questionsSheet = workbook.Sheets[questionsSheetName];
      let questionRows = xlsx.utils.sheet_to_json(questionsSheet);

      // If same sheet as exam, skip the first row (exam data)
      if (questionsSheetName === examSheetName) {
        questionRows = questionRows.slice(1);
      }

      console.log('Question rows after slice:', questionRows.length, questionRows[0] ? Object.keys(questionRows[0]) : 'No rows');

      for (const row of questionRows) {
        try {
          const questionData = {
            question_text: row['exam_title'] || row['question_text'] || row['Question Text'] || row['questionText'] || row['question'] || row['Question text'],
            type_id: row['description'] || row['type_id'] || row['Type ID'] || row['typeId'] || row['type'] || 1, // Default to MCQ
            points: row['duration_minutes'] || row['points'] || row['Points'] || 1,
            difficulty: row['total_marks'] || row['difficulty'] || row['Difficulty'] || 2,
            options: row['passing_marks'] || row['options'] || row['Options'],
            correct_answer: row['__EMPTY'] || row['correct_answer'] || row['Correct Answer'] || row['correctAnswer'] || row['answer'] || row['Correct answer']
          };

          // Skip header rows
          if (questionData.question_text === 'question_text' || questionData.question_text === 'Question Text') {
            continue;
          }

          // Handle difficulty if it's a string
          if (typeof questionData.difficulty === 'string') {
            const diffMap = { 'easy': 1, 'medium': 2, 'hard': 3 };
            questionData.difficulty = diffMap[questionData.difficulty.toLowerCase()] || 2;
          }

          // Handle options if it's JSON string
          let parsedOptions = [];
          let correctIndex = questionData.correct_answer;
          let isCorrectIndexFromJSON = false;
          if (typeof questionData.options === 'string' && questionData.options.startsWith('[')) {
            try {
              const optionObjects = JSON.parse(questionData.options);
              parsedOptions = optionObjects.map(opt => opt.text);
              correctIndex = optionObjects.findIndex(opt => opt.isCorrect);
              isCorrectIndexFromJSON = true;
            } catch (e) {
              // If not JSON, treat as delimited string
              parsedOptions = questionData.options.split(/\|\||\|/).map(opt => opt.trim());
            }
          } else if (questionData.options) {
            parsedOptions = typeof questionData.options === 'string'
              ? questionData.options.split(/\|\||\|/).map(opt => opt.trim())
              : questionData.options;
          }

          // Update options and correct_answer
          questionData.options = parsedOptions;
          questionData.correct_answer = correctIndex;

          console.log('Parsed question data:', questionData);

          if (questionData.question_text) {
            // Handle options: already parsed above
            let options = questionData.options;
            if (!Array.isArray(options)) {
              options = [];
            }

            // Handle correct_answer: convert letter to index if needed
            let correctIndex = questionData.correct_answer;
            if (isCorrectIndexFromJSON) {
              // Already 0-based from JSON
            } else if (typeof correctIndex === 'string' && correctIndex.length === 1) {
              correctIndex = correctIndex.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
            } else if (typeof correctIndex === 'string' && options.length > 0) {
              // Assume it's the option text
              correctIndex = options.indexOf(correctIndex);
              if (correctIndex === -1) correctIndex = 0; // Default to first if not found
            } else if (typeof correctIndex === 'number') {
              correctIndex = correctIndex - 1; // 1-based to 0-based
            }

            // Insert question
            const questionInsertQuery = `
              INSERT INTO Questions (exam_id, type_id, points, body_text, difficulty, created_at)
              VALUES (${examId}, ${questionData.type_id}, ${questionData.points}, '${questionData.question_text.replace(/'/g, "''")}', ${questionData.difficulty}, GETDATE())
            `;
            await executeQuery(questionInsertQuery);

            // Get the inserted question ID
            const questionIdQuery = `SELECT TOP 1 question_id FROM Questions WHERE exam_id = ${examId} ORDER BY created_at DESC`;
            const questionResult = await executeQuery(questionIdQuery);
            const questionId = questionResult[0].question_id;

            // Insert MCQ options if it's an MCQ question and options exist
            if (questionData.type_id == 1 && options.length > 0) {
              for (let i = 0; i < options.length; i++) {
                const isCorrect = i === correctIndex;
                const optionInsertQuery = `
                  INSERT INTO MCQOptions (question_id, option_text, is_correct)
                  VALUES (${questionId}, '${options[i].replace(/'/g, "''")}', ${isCorrect ? 1 : 0})
                `;
                await executeQuery(optionInsertQuery);
              }
            }

            questionsInserted++;
          }
        } catch (rowError) {
          console.error('Error processing question row:', rowError);
        }
      }
    }

    if (!examId) {
      const error = new Error(`No valid exam data found in Excel file. Available sheets: ${workbook.SheetNames.join(', ')}`);
      error.status = 400;
      throw error;
    }

    return {
      success: true,
      message: `Imported exam with ${questionsInserted} questions`,
      examId: examId
    };
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
      return await createMCQQuestion(examId, data, files);
    }

    // Validate question text
    if (!question_text || question_text.trim() === '') {
      const error = new Error('Question text is required');
      error.status = 400;
      throw error;
    }

    const pointsValue = points || 1;
    const questionQuery = `
      INSERT INTO Questions (exam_id, type_id, points, body_text, difficulty, created_at)
      OUTPUT INSERTED.question_id
      VALUES (${examId === 'bank' ? 'NULL' : examId}, ${type_id}, ${pointsValue}, '${(question_text || '').replace(/'/g, "''")}', ${difficulty || 'NULL'}, GETDATE())
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
      return await editMCQQuestion(questionId, data, files);
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

    // Format dates to SQL Server compatible format (ensure seconds are present)
    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      // If format is 'YYYY-MM-DDTHH:mm', add ':00' for seconds
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        return dateStr + ':00';
      }
      return dateStr;
    };

    const formattedOpenAt = formatDate(open_at);
    const formattedCloseAt = formatDate(close_at);

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
      VALUES (${examId}, ${class_id}, '${formattedOpenAt}', '${formattedCloseAt}', ${max_attempts || 1}, GETDATE())
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

    // Reuse unfinished attempt if exists (prevent duplicate attempts when page reloads)
    const openAttemptQuery = `
      SELECT attempt_id FROM Attempts
      WHERE assignment_id = ${assignmentId}
      AND student_id = ${studentId}
      AND submitted_at IS NULL
      ORDER BY started_at DESC
    `;
    const openAttempts = await executeQuery(openAttemptQuery);
    let attemptId;
    let isNewAttempt = false;

    if (openAttempts && openAttempts.length > 0) {
      attemptId = openAttempts[0].attempt_id;
    } else {
      const nextAttemptNo = attemptCount + 1;
      const insertAttemptQuery = `
        INSERT INTO Attempts (assignment_id, student_id, attempt_no, started_at)
        OUTPUT INSERTED.attempt_id
        VALUES (${assignmentId}, ${studentId}, ${nextAttemptNo}, GETDATE())
      `;
      const attempt = await executeQuery(insertAttemptQuery);
      attemptId = attempt[0].attempt_id;
      isNewAttempt = true;
    }

    if (isNewAttempt) {
      const mcqQuestionsQuery = `
        SELECT q.question_id
        FROM Questions q
        JOIN QuestionTypes qt ON q.type_id = qt.type_id
        WHERE q.exam_id = ${assignment[0].exam_id}
          AND qt.type_code = 'MCQ'
      `;
      const mcqQuestions = await executeQuery(mcqQuestionsQuery);

      for (const question of mcqQuestions) {
        const optionsQuery = `SELECT * FROM MCQOptions WHERE question_id = ${question.question_id}`;
        let options = await executeQuery(optionsQuery);

        if (assignment[0].shuffle_options) {
          options.sort(() => Math.random() - 0.5);
        }

        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
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
              ${opt.option_id},
              ${i + 1},
              '${String.fromCharCode(65 + i)}',
              N'${(opt.option_text || '').replace(/'/g, "''")}',
              ${opt.is_correct ? 1 : 0}
            )
          `);
        }
      }
    } else {
      // Check if OptionInstances exist for this attempt, create if missing
      const existingOptionInstancesQuery = `
        SELECT COUNT(*) as count
        FROM OptionInstances
        WHERE attempt_id = ${attemptId}
      `;
      const existingCount = await executeQuery(existingOptionInstancesQuery);

      if (existingCount[0].count === 0) {
        const mcqQuestionsQuery = `
          SELECT q.question_id
          FROM Questions q
          JOIN QuestionTypes qt ON q.type_id = qt.type_id
          WHERE q.exam_id = ${assignment[0].exam_id}
            AND qt.type_code = 'MCQ'
        `;
        const mcqQuestions = await executeQuery(mcqQuestionsQuery);

        for (const question of mcqQuestions) {
          const optionsQuery = `SELECT * FROM MCQOptions WHERE question_id = ${question.question_id}`;
          let options = await executeQuery(optionsQuery);

          if (assignment[0].shuffle_options) {
            options.sort(() => Math.random() - 0.5);
          }

          for (let i = 0; i < options.length; i++) {
            const opt = options[i];
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
                ${opt.option_id},
                ${i + 1},
                '${String.fromCharCode(65 + i)}',
                N'${(opt.option_text || '').replace(/'/g, "''")}',
                ${opt.is_correct ? 1 : 0}
              )
            `);
          }
        }
      }
    }

    const questionsQuery = `
      SELECT q.question_id, q.type_id, q.body_text, q.points, q.difficulty, qt.type_name, qt.type_code,
             (SELECT JSON_QUERY((
               SELECT mo.option_id, mo.option_text,
                      oi.option_instance_id, oi.display_label, oi.option_text_snapshot, oi.is_correct_snapshot
               FROM MCQOptions mo
               LEFT JOIN OptionInstances oi ON mo.option_id = oi.option_id AND oi.attempt_id = ${attemptId}
               WHERE mo.question_id = q.question_id
               ORDER BY oi.display_order
               FOR JSON PATH
             ))) as options,
             (SELECT JSON_QUERY((SELECT qm.* FROM QuestionMedia qm WHERE qm.question_id = q.question_id FOR JSON PATH))) as media
      FROM Questions q
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      WHERE q.exam_id = ${assignment[0].exam_id}
      ORDER BY ${assignment[0].shuffle_questions ? 'NEWID()' : 'q.created_at'}
    `;
    const questions = await executeQuery(questionsQuery);

    const normalizeQuestionData = (question) => {
      if (question.options && typeof question.options === 'string') {
        try {
          question.options = JSON.parse(question.options);
        } catch {
          question.options = [];
        }
      } else if (!question.options) {
        question.options = [];
      }

      if (question.media && typeof question.media === 'string') {
        try {
          question.media = JSON.parse(question.media);
        } catch {
          question.media = [];
        }
      } else if (!question.media) {
        question.media = [];
      }

      return question;
    };

    questions.forEach(normalizeQuestionData);

    return {
      exam: assignment[0],
      attempt: { attempt_id: attemptId },
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
      let essayText = null;
      let chosenOptionInstanceId = null;

      if (typeof responseData === 'string') {
        essayText = responseData;
      } else if (typeof responseData === 'object') {
        essayText = responseData.text || null;
        chosenOptionInstanceId = responseData.selectedOptionId || null;
      }

      const insertResponseQuery = `
        INSERT INTO Responses (attempt_id, question_id, chosen_option_instance_id, essay_text, answered_at)
        VALUES (${attemptId}, ${questionId}, ${chosenOptionInstanceId || 'NULL'}, ${essayText !== null ? "'" + essayText.replace(/'/g, "''") + "'" : 'NULL'}, GETDATE())
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

    // Auto-grade MCQ responses and mark grading status
    const scoreRowsQuery = `
      SELECT r.response_id, r.question_id, r.chosen_option_instance_id, q.points,
             qt.type_code, oi.is_correct_snapshot, oi.option_id, oi.question_id as oi_question_id
      FROM Responses r
      JOIN Questions q ON r.question_id = q.question_id
      JOIN QuestionTypes qt ON q.type_id = qt.type_id
      LEFT JOIN OptionInstances oi ON r.chosen_option_instance_id = oi.option_instance_id
      WHERE r.attempt_id = ${attemptId}
    `;
    const scoreRows = await executeQuery(scoreRowsQuery);

    let autoScore = 0;
    let hasEssay = false;

    for (const row of scoreRows) {
      if (row.type_code === 'ESSAY') {
        hasEssay = true;
        continue;
      }
      if (row.type_code === 'MCQ' && row.chosen_option_instance_id && row.is_correct_snapshot == 1) {
        autoScore += Number(row.points || 0);
      }
      // MCQ unanswered gives 0, but still considered automatically graded as long as there are no essay questions
    }

    const status = hasEssay ? 'submitted' : 'graded';
    const totalScore = autoScore;

    const updateAttemptQuery = `
      UPDATE Attempts
      SET submitted_at = GETDATE(), auto_score = ${autoScore}, manual_score = 0, total_score = ${totalScore}, status = '${status}'
      WHERE attempt_id = ${attemptId}
    `;
    await executeQuery(updateAttemptQuery);

    return { success: true, message: 'Exam submitted successfully', autoScore, totalScore, status };
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
             c.course_name, cls.class_name
      FROM ExamAssignments ea
      JOIN Exams e ON ea.exam_id = e.exam_id
      JOIN classes cls ON ea.classes_id = cls.id
      JOIN courses c ON cls.course_id = c.id
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

    const normalizeQuestionData = (question) => {
      if (question.options && typeof question.options === 'string') {
        try {
          question.options = JSON.parse(question.options);
        } catch {
          question.options = [];
        }
      } else if (!question.options) {
        question.options = [];
      }

      if (question.media && typeof question.media === 'string') {
        try {
          question.media = JSON.parse(question.media);
        } catch {
          question.media = [];
        }
      } else if (!question.media) {
        question.media = [];
      }

      return question;
    };

    questions.forEach(normalizeQuestionData);

    // Shuffle options if required
    if (assignment[0].shuffle_options) {
      questions.forEach(question => {
        if (Array.isArray(question.options) && question.options.length > 0) {
          const options = [...question.options];
          for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
          }
          question.options = options;
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
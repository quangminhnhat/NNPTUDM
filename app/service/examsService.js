const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const executeQuery = require('./executeQueryservice');
const { createMCQQuestion, editMCQQuestion, deleteMCQQuestion } = require('./mcqQuestionHelperservice');

async function getExams(user) {
  let query = '';
  const userRole = user.role.toLowerCase();

  if (userRole === 'admin') {
    query = `
      SELECT e.*, t.full_name as teacher_name 
      FROM Exams e 
      JOIN teachers te ON e.teachers_id = te.id
      JOIN users t ON te.user_id = t.id
    `;
  } else if (userRole === 'teacher') {
    query = `
      SELECT e.*, t.full_name as teacher_name 
      FROM Exams e 
      JOIN teachers te ON e.teachers_id = te.id
      JOIN users t ON te.user_id = t.id
      WHERE te.user_id = ${user.id}
    `;
  } else if (userRole === 'student') {
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
          SELECT id FROM students WHERE user_id = ${user.id}
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
        SELECT id FROM students WHERE user_id = ${user.id}
      )
      JOIN students s ON s.id = en.student_id
      LEFT JOIN LatestAttempts a ON ea.assignment_id = a.assignment_id AND a.rn = 1
      WHERE s.user_id = ${user.id}
      ORDER BY status_order, ea.open_at ASC
    `;
  } else {
    const err = new Error('Unauthorized access');
    err.status = 403;
    throw err;
  }

  const exams = await executeQuery(query);
  return { exams };
}

async function createExam(userId, data) {
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
    const err = new Error('Teacher not found');
    err.status = 403;
    throw err;
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
    const err = new Error('Exam with same title already exists');
    err.status = 400;
    throw err;
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

async function importExamsFromExcel(userId, workbookBuffer) {
  if (!workbookBuffer) {
    const err = new Error('No file uploaded');
    err.status = 400;
    throw err;
  }

  const teacherQuery = `SELECT id FROM teachers WHERE user_id = ${userId}`;
  const teachers = await executeQuery(teacherQuery);

  if (!teachers || teachers.length === 0) {
    const err = new Error('Teacher not found');
    err.status = 403;
    throw err;
  }

  const teacherId = teachers[0].id;

  const workbook = xlsx.read(workbookBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet);

  let insertedCount = 0;
  for (const row of rows) {
    const exam_title = (row.exam_title || '').replace(/'/g, "''");
    const description = (row.description || '').replace(/'/g, "''");
    const duration_minutes = row.duration_minutes || 0;
    const total_marks = row.total_marks || 0;
    const passing_marks = row.passing_marks || null;
    const start_time = row.start_time || null;
    const end_time = row.end_time || null;
    const shuffle_questions = row.shuffle_questions ? 1 : 0;
    const shuffle_options = row.shuffle_options ? 1 : 0;
    const courseId = row.course_id || 'NULL';

    if (!exam_title || !courseId) continue;

    const insertQuery = `
      INSERT INTO Exams (exam_title, description, duration_min, total_points, passing_points, start_time, end_time, shuffle_questions, shuffle_options, course_id, teachers_id, exam_code, created_at)
      VALUES (
        '${exam_title}',
        '${description}',
        ${duration_minutes},
        ${total_marks},
        ${passing_marks !== null ? passing_marks : 'NULL'},
        ${start_time ? `'${start_time}'` : 'NULL'},
        ${end_time ? `'${end_time}'` : 'NULL'},
        ${shuffle_questions},
        ${shuffle_options},
        ${courseId},
        ${teacherId},
        '${(row.exam_code || '').replace(/'/g, "''")}',
        GETDATE()
      )
    `;

    await executeQuery(insertQuery);
    insertedCount++;
  }

  return { success: true, message: `Imported ${insertedCount} exams` };
}

async function getNewExamFormData(userId) {
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

async function getQuestionFormData(examId, userId) {
  const verifyQuery = `
    SELECT e.*, t.user_id as teacher_user_id
    FROM Exams e
    JOIN teachers t ON e.teachers_id = t.id
    WHERE e.exam_id = ${examId}
  `;

  const exam = await executeQuery(verifyQuery);

  if (!exam || exam.length === 0) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }

  if (exam[0].teacher_user_id !== userId) {
    const err = new Error('You do not have permission to add questions to this exam');
    err.status = 403;
    throw err;
  }

  return { examId };
}

async function getExamDetails(examId, userId) {
  const query = `
    SELECT e.*, t.user_id as teacher_user_id
    FROM Exams e
    LEFT JOIN teachers t ON e.teachers_id = t.id
    WHERE e.exam_id = ${examId}
  `;

  const exam = await executeQuery(query);

  if (!exam || exam.length === 0) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }

  if (exam[0].teacher_user_id && exam[0].teacher_user_id !== userId) {
    const err = new Error('You do not have permission to view this exam');
    err.status = 403;
    throw err;
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

async function updateExam(examId, userId, data) {
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
    const err = new Error("You don't have permission to edit this exam");
    err.status = 403;
    throw err;
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

async function getQuestionEditData(questionId, userId) {
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
    const err = new Error('Question not found');
    err.status = 404;
    throw err;
  }

  if (question[0].exam_id && question[0].teacher_user_id !== userId) {
    const err = new Error('You do not have permission to edit this question');
    err.status = 403;
    throw err;
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

async function deleteQuestionMedia(mediaId, userId) {
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
    const err = new Error('Media not found');
    err.status = 404;
    throw err;
  }

  if (media[0].exam_id && media[0].teacher_user_id !== userId) {
    const err = new Error("You don't have permission to delete this media");
    err.status = 403;
    throw err;
  }

  try {
    const filePath = path.join(__dirname, '..', media[0].file_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }

  await executeQuery(`DELETE FROM QuestionMedia WHERE media_id = ${mediaId}`);

  return { success: true, message: 'Media deleted successfully' };
}

async function updateQuestion(questionId, userId, data, files) {
  const { question_text, points, difficulty, type_id } = data;

  const verifyQuery = `
    SELECT q.*, e.teachers_id
    FROM Questions q
    LEFT JOIN Exams e ON q.exam_id = e.exam_id
    WHERE q.question_id = ${questionId}
  `;

  const question = await executeQuery(verifyQuery);

  if (!question || question.length === 0) {
    const err = new Error('Question not found');
    err.status = 404;
    throw err;
  }

  if (question[0].exam_id) {
    const teacherQuery = `SELECT id FROM teachers WHERE user_id = ${userId}`;
    const teacher = await executeQuery(teacherQuery);
    if (!teacher || teacher.length === 0 || teacher[0].id !== question[0].teachers_id) {
      const err = new Error("You don't have permission to edit this question");
      err.status = 403;
      throw err;
    }
  }

  if (type_id == 1 || question[0].type_id === 1) {
    const mcqResult = await editMCQQuestion(questionId, {
      points,
      body_text: question_text,
      difficulty,
      options: data.options
    }, files);

    if (!mcqResult.success) {
      const err = new Error(mcqResult.error || 'Failed to edit MCQ question');
      err.status = 500;
      throw err;
    }

    return { message: mcqResult.message, questionId: mcqResult.questionId };
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
    await executeQuery(`DELETE FROM QuestionMedia WHERE question_id = ${questionId}`);
    for (const file of files) {
      const mediaQuery = `
        INSERT INTO QuestionMedia (question_id, file_name, file_url, caption, file_data, created_at)
        VALUES (${questionId}, '${(file.originalname || '').replace(/'/g, "''")}', '${(file.path || '').replace(/'/g, "''")}', NULL, NULL, GETDATE())
      `;
      await executeQuery(mediaQuery);
    }
  }

  return { message: 'Question updated successfully' };
}

async function deleteQuestion(questionId, userId) {
  const verifyQuery = `
    SELECT q.*, e.teachers_id
    FROM Questions q
    LEFT JOIN Exams e ON q.exam_id = e.exam_id
    WHERE q.question_id = ${questionId}
  `;
  const question = await executeQuery(verifyQuery);

  if (!question || question.length === 0) {
    const err = new Error('Question not found');
    err.status = 404;
    throw err;
  }

  if (question[0].exam_id) {
    const teacherQuery = `SELECT id FROM teachers WHERE user_id = ${userId}`;
    const teacher = await executeQuery(teacherQuery);
    if (!teacher || teacher.length === 0 || teacher[0].id !== question[0].teachers_id) {
      const err = new Error("You don't have permission to delete this question");
      err.status = 403;
      throw err;
    }
  }

  if (question[0].type_id === 1) {
    const mcqResult = await deleteMCQQuestion(questionId);
    if (!mcqResult.success) {
      const err = new Error(mcqResult.error || 'Failed to delete MCQ question');
      err.status = 500;
      throw err;
    }

    return { message: mcqResult.message };
  }

  await executeQuery(`DELETE FROM QuestionMedia WHERE question_id = ${questionId}`);
  await executeQuery(`DELETE FROM Questions WHERE question_id = ${questionId}`);

  return { message: 'Question deleted successfully' };
}

async function deleteExam(examId, user) {
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
      const err = new Error("You don't have permission to delete this exam");
      err.status = 403;
      throw err;
    }
  }

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

async function addQuestion(examId, userId, data, files) {
  const { question_text, type_id, points, difficulty } = data;

  if (type_id === '1' || type_id === 1) {
    const mcqResult = await createMCQQuestion(examId, {
      points,
      body_text: question_text,
      difficulty,
      options: data.options
    }, files);

    if (!mcqResult.success) {
      const err = new Error(mcqResult.error || 'Failed to create MCQ question');
      err.status = 500;
      throw err;
    }

    return {
      success: true,
      message: mcqResult.message,
      questionId: mcqResult.questionId
    };
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
      const mediaQuery = `
        INSERT INTO QuestionMedia (question_id, file_name, file_url, caption, file_data, created_at)
        VALUES (${questionId}, '${(file.originalname || '').replace(/'/g, "''")}', '${(file.path || '').replace(/'/g, "''")}', NULL, NULL, GETDATE())
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

async function getExamQuestions(examId) {
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

async function getExamAssignData(examId, userId) {
  const examQuery = `
    SELECT e.*, t.user_id as teacher_user_id
    FROM Exams e
    JOIN teachers t ON e.teachers_id = t.id
    WHERE e.exam_id = ${examId}
  `;
  const exam = await executeQuery(examQuery);

  if (!exam || exam.length === 0) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }

  if (exam[0].teacher_user_id !== userId) {
    const err = new Error('Unauthorized access');
    err.status = 403;
    throw err;
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

async function assignExamToClass(examId, userId, data) {
  const { class_id, open_at, close_at, max_attempts } = data;

  const examQuery = `
    SELECT e.*, t.user_id as teacher_user_id
    FROM Exams e
    JOIN teachers t ON e.teachers_id = t.id
    WHERE e.exam_id = ${examId}
  `;
  const exam = await executeQuery(examQuery);

  if (!exam || exam.length === 0 || exam[0].teacher_user_id !== userId) {
    const err = new Error('Unauthorized access');
    err.status = 403;
    throw err;
  }

  const classQuery = `
    SELECT c.*
    FROM classes c
    JOIN teachers t ON c.teacher_id = t.id
    WHERE c.id = ${class_id}
      AND t.user_id = ${userId}
  `;
  const classResult = await executeQuery(classQuery);

  if (!classResult || classResult.length === 0) {
    const err = new Error('Invalid class');
    err.status = 400;
    throw err;
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };

  const insertQuery = `
    INSERT INTO ExamAssignments (exam_id, classes_id, open_at, close_at, max_attempts, created_at)
    VALUES (${examId}, ${class_id}, '${formatDate(open_at)}', '${formatDate(close_at)}', ${max_attempts || 'NULL'}, GETDATE())
  `;

  await executeQuery(insertQuery);

  return { success: true, message: 'Exam assigned successfully' };
}

async function getAssignmentScores(assignmentId, userId) {
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
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }

  if (assignments[0].teacher_user_id !== userId) {
    const err = new Error('You do not have permission to view these scores');
    err.status = 403;
    throw err;
  }

  const scoresQuery = `
    WITH LatestAttempts AS (
      SELECT student_id, MAX(attempt_no) as latest_attempt_no, assignment_id
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

  return {
    assignment: assignments[0],
    scores,
  };
}

async function getAttemptGradeData(attemptId, userId) {
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
    const err = new Error('Attempt not found');
    err.status = 404;
    throw err;
  }

  const attempt = attemptRes[0];

  if (attempt.teacher_user_id !== userId) {
    const err = new Error('You do not have permission to grade this attempt');
    err.status = 403;
    throw err;
  }

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

  const responsesMap = {};
  responsesRaw.forEach((r) => {
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
        display_label: r.display_label,
      };
    }
    if (r.file_url) {
      responsesMap[r.response_id].files.push({ name: r.file_name, url: r.file_url });
    }
  });

  return {
    attempt,
    student: { id: attempt.student_id, full_name: attempt.full_name },
    responses: Object.values(responsesMap),
  };
}

async function gradeAttempt(attemptId, userId, data) {
  const { scores = {}, comments = {} } = data;

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
    const err = new Error('Attempt not found');
    err.status = 404;
    throw err;
  }

  const attempt = attemptRes[0];

  if (attempt.teacher_user_id !== userId) {
    const err = new Error('You do not have permission to grade this attempt');
    err.status = 403;
    throw err;
  }

  let manualTotal = 0;
  for (const responseId in scores) {
    const rawScore = parseFloat(scores[responseId]);
    const scoreVal = isNaN(rawScore) ? 0 : rawScore;
    manualTotal += scoreVal;
    const comment = (comments[responseId] || '').replace(/'/g, "''");
    await executeQuery(`UPDATE Responses SET score_awarded = ${scoreVal}, grader_comment = N'${comment}' WHERE response_id = ${responseId}`);
  }

  await executeQuery(`UPDATE Attempts SET manual_score = ${manualTotal}, total_score = auto_score + ${manualTotal}, status = 'graded' WHERE attempt_id = ${attemptId}`);

  return { success: true, message: 'Grades saved successfully' };
}

async function deleteExamAssignment(assignmentId, userId) {
  const verifyQuery = `
    SELECT ea.*, t.user_id as teacher_user_id
    FROM ExamAssignments ea
    JOIN Exams e ON ea.exam_id = e.exam_id
    JOIN teachers t ON e.teachers_id = t.id
    WHERE ea.assignment_id = ${assignmentId}
  `;

  const assignment = await executeQuery(verifyQuery);

  if (!assignment || assignment.length === 0 || assignment[0].teacher_user_id !== userId) {
    const err = new Error('Unauthorized access');
    err.status = 403;
    throw err;
  }

  await executeQuery(`
    DELETE ea FROM ExamAssignments ea
    LEFT JOIN Attempts a ON ea.assignment_id = a.assignment_id
    WHERE ea.assignment_id = ${assignmentId}
  `);

  return { success: true, message: 'Assignment removed successfully' };
}

async function startExamAttempt(assignmentId, userId) {
  const assignmentQuery = `
    SELECT ea.*, e.exam_id, e.exam_title, e.exam_code, e.duration_min, e.shuffle_questions, e.shuffle_options
    FROM ExamAssignments ea
    JOIN Exams e ON ea.exam_id = e.exam_id
    WHERE ea.assignment_id = ${assignmentId}
  `;

  const assignment = await executeQuery(assignmentQuery);

  if (!assignment || assignment.length === 0) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }

  const studentQuery = `SELECT id FROM students WHERE user_id = ${userId}`;
  const student = await executeQuery(studentQuery);

  if (!student || student.length === 0) {
    const err = new Error('Student not found');
    err.status = 403;
    throw err;
  }

  const attemptCountQuery = `
    SELECT COUNT(*) as attempt_count, ea.max_attempts
    FROM Attempts a
    JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
    WHERE a.assignment_id = ${assignmentId}
      AND a.student_id = ${student[0].id}
      AND a.submitted_at IS NOT NULL
    GROUP BY ea.max_attempts
  `;
  const attemptCount = await executeQuery(attemptCountQuery);

  if (attemptCount.length > 0 && attemptCount[0].attempt_count >= attemptCount[0].max_attempts) {
    const err = new Error('Maximum attempts reached for this exam');
    err.status = 403;
    throw err;
  }

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
      (SELECT ISNULL(MAX(attempt_no), 0) + 1 FROM Attempts WHERE assignment_id = ${assignmentId} AND student_id = ${student[0].id}),
      GETDATE(),
      NULL,
      0,
      0,
      'in_progress'
    )
  `;
  const attempt = await executeQuery(attemptQuery);
  const attemptId = attempt[0].attempt_id;

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

  if (assignment[0].shuffle_questions && questions.length > 0) {
    questions.sort(() => Math.random() - 0.5);
  }

  for (const question of questions) {
    if (question.type_code === 'MCQ') {
      const optionsQuery = `SELECT * FROM MCQOptions WHERE question_id = ${question.question_id}`;
      let options = await executeQuery(optionsQuery);

      if (assignment[0].shuffle_options && options && options.length > 0) {
        options.sort(() => Math.random() - 0.5);
      }

      if (options && options.length > 0) {
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          const escapedText = option.option_text ? option.option_text.replace(/'/g, "''") : '';
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
    }
  }

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

    if (q.type_code === 'MCQ') {
      const optionsQuery = `SELECT * FROM MCQOptions WHERE question_id = ${q.question_id}`;
      let options = await executeQuery(optionsQuery);
      if (assignment[0].shuffle_options && options && options.length > 0) {
        options.sort(() => Math.random() - 0.5);
      }
      questionData.options = options || [];
    }

    const mediaQuery = `SELECT media_id, caption, file_name, file_url FROM QuestionMedia WHERE question_id = ${q.question_id}`;
    const media = await executeQuery(mediaQuery);
    questionData.media = media || [];

    fullQuestions.push(questionData);
  }

  return {
    exam: {
      exam_id: assignment[0].exam_id,
      exam_title: assignment[0].exam_title,
      exam_code: assignment[0].exam_code,
      duration_min: assignment[0].duration_min,
    },
    attempt: { attempt_id: attemptId },
    questions: fullQuestions
  };
}

async function submitExamAttempt(attemptId, userId, responses, files) {
  const attemptQuery = `
    SELECT a.*, ea.exam_id
    FROM Attempts a
    INNER JOIN ExamAssignments ea ON a.assignment_id = ea.assignment_id
    WHERE a.attempt_id = ${attemptId}
  `;

  const [attempt] = await executeQuery(attemptQuery);

  if (!attempt) {
    const err = new Error('Attempt not found');
    err.status = 404;
    throw err;
  }

  const questionsQuery = `
    SELECT q.*, qt.type_code
    FROM Questions q
    INNER JOIN QuestionTypes qt ON q.type_id = qt.type_id
    WHERE q.exam_id = ${attempt.exam_id}
  `;
  const questions = await executeQuery(questionsQuery);

  let totalScore = 0;
  let hasEssayQuestion = false;

  for (const questionIdStr in responses) {
    const questionIdNum = parseInt(questionIdStr, 10);
    const question = questions.find((q) => q.question_id === questionIdNum);
    const response = responses[questionIdStr];

    if (!question) continue;

    if (question.type_code === 'MCQ') {
      const optionInstanceQuery = `
        SELECT option_instance_id, is_correct_snapshot
        FROM OptionInstances
        WHERE attempt_id = ${attemptId} AND option_id = ${response.selectedOptionId}
      `;
      const [optionInstance] = await executeQuery(optionInstanceQuery);

      if (optionInstance) {
        const score = optionInstance.is_correct_snapshot ? question.points : 0;
        totalScore += score;

        await executeQuery(`
          INSERT INTO Responses (attempt_id, question_id, chosen_option_instance_id, score_awarded, answered_at)
          VALUES (${attemptId}, ${question.question_id}, ${optionInstance.option_instance_id}, ${score}, GETDATE())
        `);
      }
    } else if (question.type_code === 'ESSAY') {
      hasEssayQuestion = true;
      const safeEssayText = (response.text || '').replace(/'/g, "''");
      const responseResult = await executeQuery(`
        INSERT INTO Responses (attempt_id, question_id, essay_text, answered_at)
        VALUES (${attemptId}, ${question.question_id}, N'${safeEssayText}', GETDATE())
      `);

      if (files && files.length > 0) {
        const responseFiles = files.filter((f) => f.fieldname === `files_${questionIdStr}`);
        for (const file of responseFiles) {
          await executeQuery(`
            INSERT INTO ResponseMedia (response_id, file_name, file_url)
            VALUES (${responseResult[0].response_id}, N'${(file.originalname || '').replace(/'/g, "''")}', '${(file.path || '').replace(/'/g, "''")}')
          `);
        }
      }
    }
  }

  const status = hasEssayQuestion ? 'needs_grading' : 'graded';

  await executeQuery(`
    UPDATE Attempts
    SET submitted_at = GETDATE(),
        auto_score = ${totalScore},
        status = '${status}'
    WHERE attempt_id = ${attemptId}
  `);

  return {
    success: true,
    message: hasEssayQuestion
      ? 'Exam submitted successfully. Essay questions will be graded by your teacher.'
      : 'Exam submitted and graded successfully.',
    score: hasEssayQuestion ? null : totalScore,
  };
}

async function takeExam(assignmentId, userId) {
  const studentQuery = `SELECT id FROM students WHERE user_id = ${userId}`;
  const student = await executeQuery(studentQuery);

  if (!student || student.length === 0) {
    const err = new Error('Student not found');
    err.status = 403;
    throw err;
  }

  const examQuery = `
    SELECT ea.*, e.*, t.user_id as teacher_user_id,
           (SELECT COUNT(*) FROM Attempts WHERE assignment_id = ea.assignment_id AND student_id = ${student[0].id}) as attempt_count
    FROM ExamAssignments ea
    JOIN Exams e ON ea.exam_id = e.exam_id
    JOIN teachers t ON e.teachers_id = t.id
    JOIN enrollments en ON ea.classes_id = en.class_id
    WHERE ea.assignment_id = ${assignmentId}
    AND en.student_id = ${student[0].id}
  `;

  const exam = await executeQuery(examQuery);

  if (!exam || exam.length === 0) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const openAt = new Date(exam[0].open_at);
  const closeAt = new Date(exam[0].close_at);

  if (now < openAt) {
    const err = new Error('Exam is not yet open');
    err.status = 400;
    throw err;
  }
  if (now > closeAt) {
    const err = new Error('Exam has closed');
    err.status = 400;
    throw err;
  }

  if (exam[0].max_attempts && exam[0].attempt_count >= exam[0].max_attempts) {
    const err = new Error('Maximum attempts reached');
    err.status = 403;
    throw err;
  }

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
    attemptId = inProgress[0].attempt_id;
    const endTime = new Date(inProgress[0].end_time);
    const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));

    if (remainingTime <= 0) {
      await executeQuery(`
        UPDATE Attempts
        SET status = 'submitted',
            submitted_at = GETDATE()
        WHERE attempt_id = ${attemptId}
      `);
      return { message: 'Your attempt has expired and been automatically submitted' };
    }

    exam[0].remaining_time = remainingTime;
  } else {
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
    exam[0].remaining_time = exam[0].duration_min * 60;
    isNewAttempt = true;
  }

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
            N'${(option.option_text || '').replace(/'/g, "''")}',
            ${option.is_correct ? 1 : 0}
          )
        `);
      }
    }
  }

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

  questions.forEach((q) => {
    try {
      q.options = q.options ? JSON.parse(q.options) : [];
    } catch (parseError) {
      console.error('Error parsing options for question', q.question_id, ':', parseError);
      q.options = [];
    }
    try {
      q.media = q.media ? JSON.parse(q.media) : [];
    } catch (parseError) {
      console.error('Error parsing media for question', q.question_id, ':', parseError);
      q.media = [];
    }
  });

  const responsesQuery = `
    SELECT r.*, rm.file_name, rm.file_url, oi.option_id, oi.display_label
    FROM Responses r
    LEFT JOIN ResponseMedia rm ON r.response_id = rm.response_id
    LEFT JOIN OptionInstances oi ON r.chosen_option_instance_id = oi.option_instance_id
    WHERE r.attempt_id = ${attemptId}
  `;
  const responses = await executeQuery(responsesQuery);

  const responseMap = {};
  responses.forEach((r) => {
    if (!responseMap[r.question_id]) {
      responseMap[r.question_id] = {
        essay_text: r.essay_text,
        chosen_options: [],
        files: []
      };
    }

    if (r.option_id) {
      responseMap[r.question_id].chosen_options.push({ option_id: r.option_id, display_label: r.display_label });
    }

    if (r.file_url) {
      responseMap[r.question_id].files.push({ name: r.file_name, url: r.file_url });
    }
  });

  return {
    user: null,
    exam: exam[0],
    questions,
    attemptId,
    responses: responseMap,
    duration: Math.floor(exam[0].remaining_time / 60)
  };
}

module.exports = {
  getExams,
  createExam,
  importExamsFromExcel,
  getNewExamFormData,
  getExamDetails,
  updateExam,
  getQuestionEditData,
  deleteQuestionMedia,
  updateQuestion,
  deleteQuestion,
  deleteExam,
  addQuestion,
  getExamQuestions,
  getExamAssignData,
  assignExamToClass,
  getAssignmentScores,
  getAttemptGradeData,
  gradeAttempt,
  deleteExamAssignment,
  startExamAttempt,
  submitExamAttempt,
  takeExam,
  getQuestionFormData,
};

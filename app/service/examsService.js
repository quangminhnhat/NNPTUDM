const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const ExamModel = require('../model/ExamModel');
const { createMCQQuestion, editMCQQuestion, deleteMCQQuestion } = require('./mcqQuestionHelperservice');

async function getExams(user) {
  return await ExamModel.getExams(user);
}

async function createExam(userId, data) {
  return await ExamModel.createExam(userId, data);
}

async function importExamsFromExcel(userId, workbookBuffer) {
  return await ExamModel.importExamsFromExcel(userId, workbookBuffer);
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
  return await ExamModel.updateExam(examId, userId, data);
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
  return await ExamModel.deleteQuestionMedia(mediaId, userId);
}

async function updateQuestion(questionId, userId, data, files) {
  return await ExamModel.updateQuestion(questionId, userId, data, files);
}

async function deleteQuestion(questionId, userId) {
  return await ExamModel.deleteQuestion(questionId, userId);
}

async function deleteExam(examId, user) {
  return await ExamModel.deleteExam(examId, user);
}

async function addQuestion(examId, userId, data, files) {
  return await ExamModel.addQuestion(examId, userId, data, files);
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
  return await ExamModel.assignExamToClass(examId, userId, data);
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
  return await ExamModel.gradeAttempt(attemptId, userId, data);
}

async function deleteExamAssignment(assignmentId, userId) {
  return await ExamModel.deleteExamAssignment(assignmentId, userId);
}

async function startExamAttempt(assignmentId, userId) {
  return await ExamModel.startExamAttempt(assignmentId, userId);
}

async function submitExamAttempt(attemptId, userId, responses, files) {
  return await ExamModel.submitExamAttempt(attemptId, userId, responses, files);
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

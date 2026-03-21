const executeQuery = require("./executeQueryservice");

async function getAllEnrollments() {
  const query = `
    SELECT 
      e.id, 
      u.full_name AS student_name, 
      c.class_name,
      co.tuition_fee,
      e.enrollment_date,
      e.payment_status,
      e.payment_date
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN classes c ON e.class_id = c.id
    JOIN courses co ON c.course_id = co.id
    ORDER BY e.enrollment_date DESC
  `;

  return executeQuery(query);
}

async function deleteEnrollment(enrollmentId) {
  // First check if enrollment exists
  const checkQuery = `
    SELECT e.id, e.student_id, u.full_name, c.class_name 
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN classes c ON e.class_id = c.id
    WHERE e.id = ?
  `;

  const enrollment = await executeQuery(checkQuery, [enrollmentId]);

  if (!enrollment.length) {
    const error = new Error("Enrollment not found");
    error.status = 404;
    error.code = "ENROLLMENT_NOT_FOUND";
    throw error;
  }

  const deleteQuery = "DELETE FROM enrollments WHERE id = ?";
  await executeQuery(deleteQuery, [enrollmentId]);

  const notifyQuery = `
    INSERT INTO notifications (user_id, message, sent_at)
    VALUES ((SELECT user_id FROM students WHERE id = ?), ?, GETDATE())
  `;

  await executeQuery(notifyQuery, [
    enrollment[0].student_id,
    `Your enrollment in ${enrollment[0].class_name} has been cancelled.`,
  ]);

  return { success: true, redirect: "/enrollments" };
}

async function toggleEnrollmentPayment(enrollmentId) {
  const query = `
    UPDATE enrollments 
    SET 
      payment_status = ~payment_status,
      payment_date = CASE 
        WHEN payment_status = 0 THEN GETDATE()
        ELSE NULL 
      END,
      updated_at = GETDATE()
    WHERE id = ?
  `;

  await executeQuery(query, [enrollmentId]);
  return { success: true };
}

async function getEnrollmentEditData(id) {
  const enrollmentQuery = `
    SELECT 
      e.*, 
      u.full_name AS student_name,
      c.class_name,
      co.course_name,
      co.tuition_fee
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN classes c ON e.class_id = c.id
    JOIN courses co ON c.course_id = co.id
    WHERE e.id = ?
  `;

  const studentQuery = `
    SELECT s.id, u.full_name, u.email 
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN enrollments e ON s.id = e.student_id
    GROUP BY s.id, u.full_name, u.email
  `;

  const classQuery = `
    SELECT 
      c.id, 
      c.class_name,
      co.course_name,
      tu.full_name AS teacher_name,
      co.start_date,
      co.end_date
    FROM classes c
    JOIN courses co ON c.course_id = co.id
    JOIN teachers t ON c.teacher_id = t.id
    JOIN users tu ON t.user_id = tu.id
    WHERE co.end_date >= GETDATE()
  `;

  const [enrollment, students, classes] = await Promise.all([
    executeQuery(enrollmentQuery, [id]),
    executeQuery(studentQuery),
    executeQuery(classQuery),
  ]);

  if (!enrollment.length) {
    const error = new Error("Enrollment not found");
    error.status = 404;
    throw error;
  }

  return { enrollment: enrollment[0], students, classes };
}

async function getNewEnrollmentFormData() {
  const studentQuery = `
    SELECT 
      s.id, 
      u.full_name, 
      u.email,
      u.phone_number,
      COUNT(e.id) as enrolled_count,
      SUM(CASE WHEN e.payment_status = 0 THEN 1 ELSE 0 END) as unpaid_enrollments
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN enrollments e ON s.id = e.student_id
    GROUP BY s.id, u.full_name, u.email, u.phone_number
    ORDER BY u.full_name
  `;

  const classQuery = `
    SELECT 
      c.id,
      c.class_name,
      co.course_name,
      co.tuition_fee,
      tu.full_name AS teacher_name,
      co.start_date,
      co.end_date,
      c.weekly_schedule,
      CONVERT(VARCHAR(5), c.start_time, 108) as start_time,
      CONVERT(VARCHAR(5), c.end_time, 108) as end_time,
      (SELECT COUNT(*) FROM enrollments WHERE class_id = c.id) as enrolled_count,
      CASE 
        WHEN co.end_date < GETDATE() THEN 'Ended'
        WHEN co.start_date > GETDATE() THEN 'Upcoming'
        ELSE 'Active'
      END as status
    FROM classes c
    JOIN courses co ON c.course_id = co.id
    JOIN teachers t ON c.teacher_id = t.id
    JOIN users tu ON t.user_id = tu.id
    WHERE co.end_date >= GETDATE()
    ORDER BY co.start_date ASC, c.class_name
  `;

  const [students, classes] = await Promise.all([
    executeQuery(studentQuery),
    executeQuery(classQuery),
  ]);

  return { students, classes };
}

async function createEnrollment(student_id, class_id) {
  if (!student_id || !class_id) {
    const error = new Error("Missing required fields");
    error.status = 400;
    error.code = "INVALID_INPUT";
    throw error;
  }

  const student = await executeQuery("SELECT id FROM students WHERE id = ?", [student_id]);
  if (!student.length) {
    const error = new Error("Student not found");
    error.status = 404;
    error.code = "STUDENT_NOT_FOUND";
    throw error;
  }

  const classInfo = await executeQuery(
    `SELECT c.id, c.class_name, co.start_date, co.end_date FROM classes c JOIN courses co ON c.course_id = co.id WHERE c.id = ?`,
    [class_id]
  );
  if (!classInfo.length) {
    const error = new Error("Class not found");
    error.status = 404;
    error.code = "CLASS_NOT_FOUND";
    throw error;
  }

  const existing = await executeQuery(
    `SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?`,
    [student_id, class_id]
  );
  if (existing.length) {
    const error = new Error("Student already enrolled in this class");
    error.status = 409;
    error.code = "DUPLICATE_ENROLLMENT";
    throw error;
  }

  const insertQuery = `
    INSERT INTO enrollments (
      student_id, 
      class_id, 
      enrollment_date,
      payment_status,
      updated_at,
      created_at
    )
    VALUES (?, ?, GETDATE(), 0, GETDATE(), GETDATE())
  `;

  await executeQuery(insertQuery, [student_id, class_id]);

  const notifyQuery = `
    INSERT INTO notifications (
      user_id,
      message,
      sent_at,
      created_at,
      updated_at
    )
    VALUES ((SELECT user_id FROM students WHERE id = ?), ?, GETDATE(), GETDATE(), GETDATE())
  `;

  await executeQuery(notifyQuery, [
    student_id,
    `You have been enrolled in ${classInfo[0].class_name}`,
  ]);

  return { success: true, redirect: "/enrollments" };
}

async function updateEnrollment(enrollmentId, class_id) {
  if (!class_id) {
    const error = new Error("Class must be selected.");
    error.status = 400;
    throw error;
  }

  const enrollmentQuery = `
    SELECT e.id, e.student_id, e.class_id, u.full_name as student_name,
           (SELECT class_name FROM classes WHERE id = e.class_id) as old_class_name
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE e.id = ?`;

  const [enrollment] = await executeQuery(enrollmentQuery, [enrollmentId]);
  if (!enrollment) {
    const error = new Error("Enrollment not found.");
    error.status = 404;
    throw error;
  }

  const classQuery = `SELECT class_name FROM classes WHERE id = ?`;
  const [newClass] = await executeQuery(classQuery, [class_id]);

  if (!newClass) {
    const error = new Error("The selected class does not exist.");
    error.status = 404;
    throw error;
  }

  await executeQuery(
    `UPDATE enrollments SET class_id = ?, updated_at = GETDATE() WHERE id = ?`,
    [class_id, enrollmentId]
  );

  const notifyQuery = `
    INSERT INTO notifications (user_id, message)
    VALUES ((SELECT user_id FROM students WHERE id = ?), ?)`;
  const message = `Your enrollment has been changed from class '${enrollment.old_class_name}' to '${newClass.class_name}'.`;

  await executeQuery(notifyQuery, [enrollment.student_id, message]);

  return { success: true, redirect: "/enrollments" };
}

module.exports = {
  getAllEnrollments,
  deleteEnrollment,
  toggleEnrollmentPayment,
  getEnrollmentEditData,
  getNewEnrollmentFormData,
  createEnrollment,
  updateEnrollment,
};
const EnrollmentModel = require("../model/EnrollmentModel");

async function getAllEnrollments() {
  return await EnrollmentModel.getAllEnrollments();
}

async function deleteEnrollment(enrollmentId) {
  return await EnrollmentModel.deleteEnrollment(enrollmentId);
}

async function toggleEnrollmentPayment(enrollmentId) {
  return await EnrollmentModel.toggleEnrollmentPayment(enrollmentId);
}

async function getEnrollmentEditData(id) {
  return await EnrollmentModel.getEnrollmentEditData(id);
}

async function getNewEnrollmentFormData() {
  const executeQuery = require("./executeQueryservice");

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
  const enrollmentData = { student_id, class_id };
  return await EnrollmentModel.createEnrollment(enrollmentData);
}

async function updateEnrollment(enrollmentId, class_id) {
  const enrollmentData = { class_id };
  return await EnrollmentModel.updateEnrollment(enrollmentId, enrollmentData);
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
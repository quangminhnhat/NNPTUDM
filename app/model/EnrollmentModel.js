const executeQuery = require("../service/executeQueryservice");

class EnrollmentModel {
  /**
   * Get all enrollments
   * @returns {Promise<Array>} Array of enrollments
   */
  static async getAllEnrollments() {
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

    return await executeQuery(query);
  }

  /**
   * Delete an enrollment
   * @param {number} enrollmentId - Enrollment ID
   * @returns {Promise<Object>} Success message
   */
  static async deleteEnrollment(enrollmentId) {
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
      INSERT INTO notifications (user_id, message, sender_id)
      VALUES ((SELECT user_id FROM students WHERE id = ?), ?, 1)
    `;

    await executeQuery(notifyQuery, [
      enrollment[0].student_id,
      `Your enrollment in ${enrollment[0].class_name} has been cancelled.`,
    ]);

    return { success: true, redirect: "/enrollments" };
  }

  /**
   * Toggle enrollment payment status
   * @param {number} enrollmentId - Enrollment ID
   * @returns {Promise<Object>} Success message
   */
  static async toggleEnrollmentPayment(enrollmentId) {
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

  /**
   * Get enrollment edit data
   * @param {number} id - Enrollment ID
   * @returns {Promise<Object>} Enrollment data for editing
   */
  static async getEnrollmentEditData(id) {
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
      SELECT c.id, c.class_name, co.course_name
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      ORDER BY co.course_name, c.class_name
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

    return {
      enrollment: enrollment[0],
      students,
      classes,
    };
  }

  /**
   * Create a new enrollment
   * @param {Object} enrollmentData - Enrollment data
   * @returns {Promise<Object>} Success message
   */
  static async createEnrollment(enrollmentData) {
    const { student_id, class_id, payment_status } = enrollmentData;

    // Check if student is already enrolled in this class
    const checkQuery = `
      SELECT id FROM enrollments
      WHERE student_id = ? AND class_id = ?
    `;

    const existing = await executeQuery(checkQuery, [student_id, class_id]);

    if (existing.length > 0) {
      const error = new Error("Student is already enrolled in this class");
      error.status = 400;
      throw error;
    }

    const insertQuery = `
      INSERT INTO enrollments (student_id, class_id, enrollment_date, payment_status, payment_date)
      VALUES (?, ?, GETDATE(), ?, ?)
    `;

    const paymentDate = payment_status ? "GETDATE()" : null;

    await executeQuery(insertQuery, [student_id, class_id, payment_status, paymentDate]);

    return { success: true, redirect: "/enrollments" };
  }

  /**
   * Update an enrollment
   * @param {number} enrollmentId - Enrollment ID
   * @param {Object} enrollmentData - Updated enrollment data
   * @returns {Promise<Object>} Success message
   */
  static async updateEnrollment(enrollmentId, enrollmentData) {
    const { student_id, class_id, payment_status } = enrollmentData;

    // Check if enrollment exists
    const checkQuery = "SELECT id FROM enrollments WHERE id = ?";
    const existing = await executeQuery(checkQuery, [enrollmentId]);

    if (!existing.length) {
      const error = new Error("Enrollment not found");
      error.status = 404;
      throw error;
    }

    // Check if student is already enrolled in another class (excluding current enrollment)
    const duplicateCheckQuery = `
      SELECT id FROM enrollments
      WHERE student_id = ? AND class_id = ? AND id != ?
    `;

    const duplicate = await executeQuery(duplicateCheckQuery, [student_id, class_id, enrollmentId]);

    if (duplicate.length > 0) {
      const error = new Error("Student is already enrolled in this class");
      error.status = 400;
      throw error;
    }

    const updateQuery = `
      UPDATE enrollments
      SET student_id = ?, class_id = ?, payment_status = ?,
          payment_date = CASE WHEN ? = 1 THEN GETDATE() ELSE NULL END,
          updated_at = GETDATE()
      WHERE id = ?
    `;

    await executeQuery(updateQuery, [student_id, class_id, payment_status, payment_status, enrollmentId]);

    return { success: true, redirect: "/enrollments" };
  }

  /**
   * Get enrollment by ID
   * @param {number} enrollmentId - Enrollment ID
   * @returns {Promise<Object>} Enrollment data
   */
  static async getEnrollmentById(enrollmentId) {
    const query = `
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

    const result = await executeQuery(query, [enrollmentId]);

    if (!result.length) {
      const error = new Error("Enrollment not found");
      error.status = 404;
      throw error;
    }

    return result[0];
  }

  /**
   * Get enrollments for a specific student
   * @param {number} studentId - Student ID
   * @returns {Promise<Array>} Array of student's enrollments
   */
  static async getEnrollmentsByStudent(studentId) {
    const query = `
      SELECT
        e.*,
        c.class_name,
        co.course_name,
        co.tuition_fee,
        t.user_id as teacher_user_id,
        u.full_name as teacher_name
      FROM enrollments e
      JOIN classes c ON e.class_id = c.id
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE e.student_id = ?
      ORDER BY e.enrollment_date DESC
    `;

    return await executeQuery(query, [studentId]);
  }
}

module.exports = EnrollmentModel;
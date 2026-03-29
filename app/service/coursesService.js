const CourseModel = require("../model/CourseModel");
const executeQuery = require("./executeQueryservice");

async function getCourseDetail(courseId) {
  return await CourseModel.getCourseDetail(courseId);
}

async function getNewCourseFormData() {
  return {}; // no DB needs for this route now, controller can return user
}

async function deleteCourse(courseId) {
  return await CourseModel.deleteCourse(courseId);
}

async function getCourseById(courseId) {
  return await CourseModel.getCourseById(courseId);
}

async function getCourseEditData(courseId) {
  return await CourseModel.getCourseEditData(courseId);
}

async function getAllCourses() {
  return await CourseModel.getAllCourses();
}

async function createCourse(data, file) {
  return await CourseModel.createCourse(data, file);
}

async function updateCourse(courseId, data, file) {
  return await CourseModel.updateCourse(courseId, data, file);
}

async function getAvailableCourses(userId) {
  const courses = await CourseModel.getAvailableCourses(userId);

  const studentQuery = "SELECT * FROM students WHERE user_id = ?";
  const studentResult = await executeQuery(studentQuery, [userId]);

  return {
    courses,
    student: studentResult.length > 0 ? studentResult[0] : null
  };
}

async function enrollCourse(userId, class_id) {
  // This function involves multiple models - keep in service for now
  const EnrollmentModel = require("../model/EnrollmentModel");

  // Get student ID from user ID
  const studentQuery = "SELECT id FROM students WHERE user_id = ?";
  const studentResult = await executeQuery(studentQuery, [userId]);

  if (!studentResult.length) {
    const error = new Error("Student not found");
    error.status = 400;
    throw error;
  }

  const studentId = studentResult[0].id;

  // Check if already enrolled
  const checkQuery = "SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?";
  const existing = await executeQuery(checkQuery, [studentId, class_id]);

  if (existing.length > 0) {
    const error = new Error("Already enrolled in this class");
    error.status = 400;
    throw error;
  }

  // Get course tuition fee
  const courseQuery = `
    SELECT c.tuition_fee
    FROM courses c
    JOIN classes cls ON c.id = cls.course_id
    WHERE cls.id = ?
  `;
  const courseResult = await executeQuery(courseQuery, [class_id]);

  if (!courseResult.length) {
    const error = new Error("Class not found");
    error.status = 404;
    throw error;
  }

  const tuitionFee = courseResult[0].tuition_fee;

  // Create enrollment using EnrollmentModel
  await EnrollmentModel.createEnrollment({
    student_id: studentId,
    class_id: class_id,
    payment_status: 0
  });

  return {
    success: true,
    message: `Successfully enrolled! Tuition fee: $${tuitionFee}`,
    redirect: "/courses"
  };
}

async function getMyCourses(user) {
  // Get student ID from user ID
  const studentQuery = "SELECT id FROM students WHERE user_id = ?";
  const studentResult = await executeQuery(studentQuery, [user.id]);

  if (!studentResult.length) {
    return [];
  }

  const studentId = studentResult[0].id;

  const query = `
    SELECT DISTINCT
      c.id,
      c.course_name,
      c.description,
      c.tuition_fee,
      c.start_date,
      CONVERT(varchar(10), c.start_date, 23) as formatted_start_date,
      CONVERT(varchar(10), c.end_date, 23) as formatted_end_date,
      c.image_path,
      cls.class_name,
      cls.id as class_id,
      CONVERT(varchar(5), cls.start_time, 108) as class_start_time,
      CONVERT(varchar(5), cls.end_time, 108) as class_end_time,
      cls.weekly_schedule,
      e.enrollment_date,
      e.payment_status,
      e.payment_date,
      u.full_name as teacher_name,
      u.email as teacher_email,
      u.phone_number as teacher_phone,
      u.profile_pic as teacher_avatar
    FROM enrollments e
    JOIN classes cls ON e.class_id = cls.id
    JOIN courses c ON cls.course_id = c.id
    JOIN teachers t ON cls.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE e.student_id = ?
    ORDER BY c.start_date DESC
  `;

  const enrollments = await executeQuery(query, [studentId]);

  // Group by course
  const coursesMap = new Map();

  enrollments.forEach(enrollment => {
    if (!coursesMap.has(enrollment.id)) {
      coursesMap.set(enrollment.id, {
        id: enrollment.id,
        course_name: enrollment.course_name,
        description: enrollment.description,
        tuition_fee: enrollment.tuition_fee,
        formatted_start_date: enrollment.formatted_start_date,
        formatted_end_date: enrollment.formatted_end_date,
        image_path: enrollment.image_path,
        classes: []
      });
    }

    coursesMap.get(enrollment.id).classes.push({
      class_id: enrollment.class_id,
      class_name: enrollment.class_name,
      class_start_time: enrollment.class_start_time,
      class_end_time: enrollment.class_end_time,
      weekly_schedule: enrollment.weekly_schedule,
      teacher_name: enrollment.teacher_name,
      teacher_email: enrollment.teacher_email,
      teacher_phone: enrollment.teacher_phone,
      teacher_avatar: enrollment.teacher_avatar,
      enrollment_date: enrollment.enrollment_date,
      payment_status: enrollment.payment_status,
      payment_date: enrollment.payment_date
    });
  });

  return Array.from(coursesMap.values());
}

module.exports = {
  getCourseDetail,
  getNewCourseFormData,
  deleteCourse,
  getCourseById,
  getCourseEditData,
  getAllCourses,
  createCourse,
  updateCourse,
  getAvailableCourses,
  enrollCourse,
  getMyCourses,
};
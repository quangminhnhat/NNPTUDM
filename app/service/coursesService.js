const path = require("path");
const fs = require("fs");
const executeQuery = require("./executeQueryservice");

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatSchedule(weekly_schedule) {
  if (!weekly_schedule) return "No schedule set";
  return weekly_schedule
    .split(",")
    .map((day) => daysOfWeek[parseInt(day, 10) - 1])
    .join(", ");
}

async function getCourseDetail(courseId) {
  const query = `
    SELECT 
      id,
      course_name,
      description,
      image_path
    FROM courses
    WHERE id = ?
  `;

  const [course] = await executeQuery(query, [courseId]);

  if (!course) {
    const error = new Error("Course not found.");
    error.status = 404;
    throw error;
  }

  return course;
}

async function getNewCourseFormData() {
  return {}; // no DB needs for this route now, controller can return user
}

async function deleteCourse(courseId) {
  // Validation for dependencies
  const classCheckQuery = `
    SELECT COUNT(*) as classCount
    FROM classes
    WHERE course_id = ?
  `;
  const classCheck = await executeQuery(classCheckQuery, [courseId]);

  if (classCheck[0].classCount > 0) {
    const err = new Error("Cannot delete course that has classes");
    err.status = 400;
    throw err;
  }

  const materialCheckQuery = `
    SELECT COUNT(*) as materialCount
    FROM materials
    WHERE course_id = ?
  `;
  const materialCheck = await executeQuery(materialCheckQuery, [courseId]);

  if (materialCheck[0].materialCount > 0) {
    const err = new Error("Cannot delete course that has materials");
    err.status = 400;
    throw err;
  }

  // Delete image if exists
  const courseRow = await executeQuery("SELECT image_path FROM courses WHERE id = ?", [courseId]);
  const imagePath = courseRow[0] ? courseRow[0].image_path : null;

  if (imagePath) {
    const oldImagePath = path.join(__dirname, "..", imagePath);
    try {
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    } catch (e) {
      console.error("Course image deletion failed:", e);
    }
  }

  await executeQuery("DELETE FROM courses WHERE id = ?", [courseId]);
  return { success: true, redirect: "/courses" };
}

async function getCourseById(courseId) {
  const query = `
    SELECT 
      c.*,
      CONVERT(varchar(10), c.start_date, 23) as formatted_start_date,
      CONVERT(varchar(10), c.end_date, 23) as formatted_end_date,
      (SELECT COUNT(*) FROM classes WHERE course_id = c.id) as class_count,
      (SELECT COUNT(*) FROM materials WHERE course_id = c.id) as material_count,
      (
        SELECT STRING_AGG(CONCAT(u.full_name, ' (', cls.class_name, ')'), ', ')
        FROM classes cls
        JOIN teachers t ON cls.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE cls.course_id = c.id
      ) as teachers_and_classes
    FROM courses c
    WHERE c.id = ?
  `;

  const courseResult = await executeQuery(query, [courseId]);
  if (!courseResult.length) {
    const error = new Error("Course not found");
    error.status = 404;
    throw error;
  }

  const classesQuery = `
    SELECT 
      cls.id,
      cls.class_name,
      u.full_name as teacher_name,
      CONVERT(varchar(5), cls.start_time, 108) as start_time,
      CONVERT(varchar(5), cls.end_time, 108) as end_time,
      cls.weekly_schedule,
      (SELECT COUNT(*) FROM enrollments WHERE class_id = cls.id) as student_count
    FROM classes cls
    JOIN teachers t ON cls.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE cls.course_id = ?
    ORDER BY cls.class_name
  `;

  const classesResult = await executeQuery(classesQuery, [courseId]);

  const materialsQuery = `
    SELECT id, file_name, uploaded_at
    FROM materials
    WHERE course_id = ?
    ORDER BY uploaded_at DESC
  `;

  const materialsResult = await executeQuery(materialsQuery, [courseId]);

  return {
    course: {
      ...courseResult[0],
      classes: classesResult.map((cls) => ({
        ...cls,
        schedule: formatSchedule(cls.weekly_schedule),
      })),
      materials: materialsResult,
    },
  };
}

async function getCourseEditData(courseId) {
  const query = `
    SELECT 
      c.*,
      CONVERT(varchar(10), c.start_date, 23) as formatted_start_date,
      CONVERT(varchar(10), c.end_date, 23) as formatted_end_date,
      (SELECT COUNT(*) FROM classes WHERE course_id = c.id) as class_count,
      (SELECT COUNT(*) FROM materials WHERE course_id = c.id) as material_count,
      (
        SELECT STRING_AGG(CONCAT(u.full_name, ' (', cls.class_name, ')'), ', ') 
        FROM classes cls
        JOIN teachers t ON cls.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE cls.course_id = c.id
      ) as teachers_and_classes
    FROM courses c
    WHERE c.id = ?
  `;

  const courseResult = await executeQuery(query, [courseId]);
  if (!courseResult.length) {
    const error = new Error("Course not found");
    error.status = 404;
    throw error;
  }

  const course = {
    ...courseResult[0],
    start_date: new Date(courseResult[0].start_date),
    end_date: new Date(courseResult[0].end_date),
  };

  return { course };
}

async function getAllCourses() {
  const query = `
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM classes WHERE course_id = c.id) as class_count,
      (SELECT COUNT(*) FROM materials WHERE course_id = c.id) as material_count,
      (
        SELECT STRING_AGG(CONCAT(u.full_name, ' (', cls.class_name, ')'), ', ')
        FROM classes cls
        JOIN teachers t ON cls.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE cls.course_id = c.id
      ) as teachers_and_classes
    FROM courses c
    ORDER BY c.created_at DESC
  `;

  const courses = await executeQuery(query);

  return courses.map((course) => ({
    ...course,
    hasClasses: course.class_count > 0,
    teacherInfo: course.teachers_and_classes || "No classes assigned",
  }));
}

async function createCourse(data, file) {
  const {
    course_name,
    description,
    start_date,
    end_date,
    tuition_fee,
  } = data;

  if (!course_name || !description || !start_date || !end_date) {
    const err = new Error("Missing required fields");
    err.status = 400;
    throw err;
  }

  const image_path = file
    ? path.posix.join("uploads", "image", file.filename)
    : null;

  const query = `
    INSERT INTO courses (
      course_name,
      description,
      start_date,
      end_date,
      tuition_fee,
      image_path,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
  `;

  await executeQuery(query, [
    course_name,
    description,
    start_date,
    end_date,
    tuition_fee || null,
    image_path,
  ]);

  return { success: true, redirect: "/courses" };
}

async function updateCourse(courseId, data, file) {
  let { course_name, description, start_date, end_date, tuition_fee } = data;

  // Keep old image path and update if new file present
  const currentCourse = await executeQuery("SELECT image_path FROM courses WHERE id = ?", [courseId]);

  if (!currentCourse.length) {
    const err = new Error("Course not found");
    err.status = 404;
    throw err;
  }

  let image_path = currentCourse[0].image_path;

  if (file) {
    if (image_path) {
      const oldImagePath = path.join(__dirname, "..", image_path);
      try {
        if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      } catch (e) {
        console.error("Old course image removal failed:", e);
      }
    }
    image_path = path.posix.join("uploads", "image", file.filename);
  }

  course_name = Array.isArray(course_name) ? course_name[0] : course_name;
  description = Array.isArray(description) ? description[0] : description;

  const query = `
    UPDATE courses
    SET course_name = ?,
        description = ?,
        start_date = ?,
        end_date = ?,
        tuition_fee = ?,
        image_path = ?,
        updated_at = GETDATE()
    WHERE id = ?
  `;

  await executeQuery(query, [
    course_name,
    description,
    start_date,
    end_date,
    tuition_fee || null,
    image_path,
    courseId,
  ]);

  return { success: true, redirect: "/courses" };
}

async function getAvailableCourses(userId) {
  const query = `
    SELECT DISTINCT
      c.id as course_id,
      c.course_name,
      c.description,
      c.start_date,
      c.end_date,
      c.tuition_fee,
      c.image_path,
      cls.id as class_id,
      cls.class_name,
      cls.start_time,
      cls.end_time,
      cls.weekly_schedule,
      u.full_name as teacher_name,
      (SELECT COUNT(*) FROM enrollments WHERE class_id = cls.id) as enrolled_count
    FROM courses c
    JOIN classes cls ON c.id = cls.course_id
    JOIN teachers t ON cls.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE c.start_date > GETDATE()
      AND NOT EXISTS (
        SELECT 1
        FROM enrollments e
        JOIN students s ON e.student_id = s.id
        WHERE s.user_id = ?
          AND e.class_id = cls.id
      )
    ORDER BY c.start_date ASC
  `;

  const courses = await executeQuery(query, [userId]);

  const studentQuery = `
    SELECT s.id, u.full_name, u.email
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.user_id = ?
  `;

  const studentInfo = await executeQuery(studentQuery, [userId]);

  return { courses, student: studentInfo[0] };
}

async function enrollCourse(userId, class_id) {
  if (!class_id || class_id === "null") {
    const err = new Error("Invalid class selection");
    err.status = 400;
    throw err;
  }

  const studentQuery = "SELECT id FROM students WHERE user_id = ?";
  const students = await executeQuery(studentQuery, [userId]);

  if (!students.length) {
    const err = new Error("Student not found");
    err.status = 404;
    throw err;
  }

  const studentId = students[0].id;

  const checkEnrollmentQuery = `
    SELECT 
      c.id as class_id,
      c.course_id,
      co.tuition_fee,
      (SELECT COUNT(*) FROM enrollments WHERE class_id = c.id) as enrolled_count,
      CASE WHEN EXISTS (
        SELECT 1 FROM enrollments e WHERE e.class_id = c.id AND e.student_id = ?
      ) THEN 1 ELSE 0 END as is_enrolled
    FROM classes c
    JOIN courses co ON c.course_id = co.id
    WHERE c.id = ?
  `;

  const classInfo = await executeQuery(checkEnrollmentQuery, [studentId, class_id]);

  if (!classInfo.length) {
    const err = new Error("Class not found");
    err.status = 404;
    throw err;
  }

  if (classInfo[0].is_enrolled) {
    const err = new Error("You are already enrolled in this class");
    err.status = 400;
    throw err;
  }

  const insertQuery = `
    INSERT INTO enrollments (
      student_id,
      class_id,
      enrollment_date,
      payment_status,
      updated_at
    ) VALUES (?, ?, GETDATE(), 0, GETDATE())
  `;

  await executeQuery(insertQuery, [studentId, class_id]);

  const notifyQuery = `
    INSERT INTO notifications (
      user_id,
      message,
      sent_at,
      created_at,
      updated_at
    ) VALUES (?, ?, GETDATE(), GETDATE(), GETDATE())
  `;

  await executeQuery(notifyQuery, [
    userId,
    "You have successfully enrolled in a new course. Please complete the payment.",
  ]);

  return { success: true, redirect: "/my-courses" };
}

async function getMyCourses(user) {
  let query;
  let params = [];

  if (user.role === "student") {
    query = `
      SELECT 
        c.course_name,
        c.description AS course_description,
        c.tuition_fee,
        c.image_path,
        u.full_name AS teacher_name,
        u.email AS teacher_email,
        u.phone_number AS teacher_phone,
        cls.class_name,
        CONVERT(VARCHAR(5), cls.start_time, 108) as class_start_time,
        CONVERT(VARCHAR(5), cls.end_time, 108) as class_end_time,
        cls.weekly_schedule,
        e.payment_status,
        e.payment_date,
        CONVERT(VARCHAR(10), e.enrollment_date, 23) as formatted_enrollment_date
      FROM enrollments e
      JOIN students st ON e.student_id = st.id
      JOIN classes cls ON e.class_id = cls.id
      JOIN teachers t ON cls.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      JOIN courses c ON cls.course_id = c.id
      WHERE st.user_id = ?
      ORDER BY u.full_name, c.course_name
    `;
    params = [user.id];
  } else if (user.role === "teacher") {
    query = `
      SELECT 
        c.course_name,
        c.description AS course_description,
        c.tuition_fee,
        c.image_path,
        u.full_name AS teacher_name,
        u.email AS teacher_email,
        u.phone_number AS teacher_phone,
        cls.class_name,
        CONVERT(VARCHAR(5), cls.start_time, 108) as class_start_time,
        CONVERT(VARCHAR(5), cls.end_time, 108) as class_end_time,
        cls.weekly_schedule,
        (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cls.id) as student_count,
        (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cls.id AND e.payment_status = 1) as paid_students
      FROM teachers t
      JOIN classes cls ON t.id = cls.teacher_id
      JOIN users u ON t.user_id = u.id
      JOIN courses c ON cls.course_id = c.id
      WHERE t.user_id = ?
      ORDER BY c.course_name
    `;
    params = [user.id];
  } else {
    const err = new Error("Unauthorized user role");
    err.status = 403;
    throw err;
  }

  const courses = await executeQuery(query, params);

  const processedCourses = courses.map((course) => ({
    ...course,
    schedule: formatSchedule(course.weekly_schedule),
    formatted_tuition: course.tuition_fee
      ? course.tuition_fee.toLocaleString("vi-VN", {
          style: "currency",
          currency: "VND",
        })
      : "Not set",
  }));

  return processedCourses;
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
const executeQuery = require("../service/executeQueryservice");
const path = require("path");
const fs = require("fs");

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatSchedule(weekly_schedule) {
  if (!weekly_schedule) return "";
  return weekly_schedule
    .split(",")
    .map((day) => daysOfWeek[parseInt(day, 10) - 1])
    .join(", ");
}

class CourseModel {
  /**
   * Get course details by ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} Course data
   */
  static async getCourseDetail(courseId) {
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
      const error = new Error("Course not found");
      error.status = 404;
      throw error;
    }

    return course;
  }

  /**
   * Delete a course
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} Success message
   */
  static async deleteCourse(courseId) {
    // Validation for dependencies
    const classCheckQuery = `
      SELECT COUNT(*) as classCount
      FROM classes
      WHERE course_id = ?
    `;
    const classCheck = await executeQuery(classCheckQuery, [courseId]);

    if (classCheck[0].classCount > 0) {
      const error = new Error("Cannot delete course with assigned classes");
      error.status = 400;
      throw error;
    }

    const materialCheckQuery = `
      SELECT COUNT(*) as materialCount
      FROM materials
      WHERE course_id = ?
    `;
    const materialCheck = await executeQuery(materialCheckQuery, [courseId]);

    if (materialCheck[0].materialCount > 0) {
      const error = new Error("Cannot delete course with uploaded materials");
      error.status = 400;
      throw error;
    }

    // Delete image if exists
    const courseRow = await executeQuery("SELECT image_path FROM courses WHERE id = ?", [courseId]);
    const imagePath = courseRow[0] ? courseRow[0].image_path : null;

    if (imagePath) {
      const fullPath = path.join(__dirname, "..", "public", imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await executeQuery("DELETE FROM courses WHERE id = ?", [courseId]);
    return { success: true, redirect: "/courses" };
  }

  /**
   * Get course by ID with full details
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} Course data with classes and materials
   */
  static async getCourseById(courseId) {
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

  /**
   * Get course edit data
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} Course data for editing
   */
  static async getCourseEditData(courseId) {
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

  /**
   * Get all courses
   * @returns {Promise<Array>} Array of courses
   */
  static async getAllCourses() {
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

  /**
   * Create a new course
   * @param {Object} data - Course data
   * @param {Object} file - Uploaded image file
   * @returns {Promise<Object>} Success message
   */
  static async createCourse(data, file) {
    const {
      course_name,
      description,
      start_date,
      end_date,
      tuition_fee,
    } = data;

    if (!course_name || !description || !start_date || !end_date) {
      const error = new Error("Missing required fields");
      error.status = 400;
      throw error;
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

  /**
   * Update a course
   * @param {number} courseId - Course ID
   * @param {Object} data - Course data
   * @param {Object} file - Uploaded image file
   * @returns {Promise<Object>} Success message
   */
  static async updateCourse(courseId, data, file) {
    let { course_name, description, start_date, end_date, tuition_fee } = data;

    // Keep old image path and update if new file present
    const currentCourse = await executeQuery("SELECT image_path FROM courses WHERE id = ?", [courseId]);

    if (!currentCourse.length) {
      const error = new Error("Course not found");
      error.status = 404;
      throw error;
    }

    let image_path = currentCourse[0].image_path;

    if (file) {
      // Delete old image if exists
      if (image_path) {
        const oldImagePath = path.join(__dirname, "..", "public", image_path);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      // Set new image path
      image_path = path.posix.join("uploads", "image", file.filename);
    }

    course_name = Array.isArray(course_name) ? course_name[0] : course_name;
    description = Array.isArray(description) ? description[0] : description;
    start_date = Array.isArray(start_date) ? start_date[0] : start_date;
    end_date = Array.isArray(end_date) ? end_date[0] : end_date;
    tuition_fee = Array.isArray(tuition_fee) ? tuition_fee[0] : tuition_fee;

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

    return { success: true, redirect: `/courses/${courseId}` };
  }

  /**
   * Get available courses for enrollment
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Available courses
   */
  static async getAvailableCourses(userId) {
    const query = `
      SELECT DISTINCT
        c.id,
        c.course_name,
        c.description,
        c.tuition_fee,
        CONVERT(varchar(10), c.start_date, 23) as formatted_start_date,
        CONVERT(varchar(10), c.end_date, 23) as formatted_end_date,
        c.image_path,
        (
          SELECT STRING_AGG(cls.class_name, ', ')
          FROM classes cls
          WHERE cls.course_id = c.id
        ) as available_classes
      FROM courses c
      JOIN classes cls ON c.id = cls.course_id
      LEFT JOIN enrollments e ON cls.id = e.class_id
        AND e.student_id = (SELECT id FROM students WHERE user_id = ?)
      WHERE c.end_date >= GETDATE()
        AND e.id IS NULL
      ORDER BY c.start_date
    `;

    return await executeQuery(query, [userId]);
  }
}

module.exports = CourseModel;
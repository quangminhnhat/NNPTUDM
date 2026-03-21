const executeQuery = require("./executeQueryservice");

class AdminTeacherCoursesService {
  /**
   * Get course details by ID with classes and materials
   * @param {number} courseId - The course ID
   * @returns {Object} Course data with classes and materials
   */
  static async getCourseDetails(courseId) {
    try {
      // Get course details with class and material counts
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
        error.statusCode = 404;
        throw error;
      }

      // Get all classes for this course
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

      // Get all materials for this course
      const materialsQuery = `
        SELECT id, file_name, uploaded_at
        FROM materials
        WHERE course_id = ?
        ORDER BY uploaded_at DESC
      `;

      const materialsResult = await executeQuery(materialsQuery, [courseId]);

      // Process the course data
      const course = {
        ...courseResult[0],
        classes: classesResult.map((cls) => ({
          ...cls,
          schedule: cls.weekly_schedule
            ? cls.weekly_schedule
                .split(",")
                .map(
                  (day) =>
                    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                      parseInt(day) - 1
                    ]
                )
                .join(", ")
            : "No schedule set",
        })),
        materials: materialsResult,
      };

      return course;
    } catch (error) {
      console.error("Error fetching course details:", error);
      if (error.statusCode) {
        throw error;
      }
      const newError = new Error("Error loading course details");
      newError.statusCode = 500;
      throw newError;
    }
  }

  /**
   * Get all courses with class and material counts
   * @returns {Array} List of processed courses
   */
  static async getAllCourses() {
    try {
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

      // Process the results
      const processedCourses = courses.map((course) => ({
        ...course,
        hasClasses: course.class_count > 0,
        teacherInfo: course.teachers_and_classes || "No classes assigned",
      }));

      return processedCourses;
    } catch (error) {
      console.error("Fetch courses error:", error);
      const newError = new Error("Error loading courses");
      newError.statusCode = 500;
      throw newError;
    }
  }
}

module.exports = AdminTeacherCoursesService;
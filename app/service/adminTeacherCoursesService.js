const CourseModel = require("../model/CourseModel");

class AdminTeacherCoursesService {
  /**
   * Get course details by ID with classes and materials
   * @param {number} courseId - The course ID
   * @returns {Object} Course data with classes and materials
   */
  static async getCourseDetails(courseId) {
    try {
      return await CourseModel.getCourseById(courseId);
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
      return await CourseModel.getAllCourses();
    } catch (error) {
      console.error("Fetch courses error:", error);
      const newError = new Error("Error loading courses");
      newError.statusCode = 500;
      throw newError;
    }
  }
}

module.exports = AdminTeacherCoursesService;
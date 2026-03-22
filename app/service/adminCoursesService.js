const CourseModel = require("../model/CourseModel");

class AdminCoursesService {
  /**
   * Get data for new course form
   * @param {Object} user - The authenticated user
   * @returns {Object} Form data
   */
  static getNewCourseFormData(user) {
    return { user };
  }

  /**
   * Delete course by ID with dependency checks
   * @param {number} courseId - The course ID to delete
   * @returns {Object} Success or error response
   */
  static async deleteCourse(courseId) {
    try {
      await CourseModel.deleteCourse(courseId);
      return { success: true, redirect: "/courses" };
    } catch (error) {
      console.error("Course deletion error:", error);
      if (error.statusCode) {
        throw error;
      }
      const newError = new Error("Failed to delete course");
      newError.statusCode = 500;
      throw newError;
    }
  }

  /**
   * Get course data for edit form
   * @param {number} courseId - The course ID
   * @returns {Object} Course data
   */
  static async getCourseForEdit(courseId) {
    try {
      const result = await CourseModel.getCourseEditData(courseId);
      return result.course;
    } catch (error) {
      console.error("Error loading course edit form:", error);
      if (error.statusCode) {
        throw error;
      }
      const newError = new Error("Error loading course edit form");
      newError.statusCode = 500;
      throw newError;
    }
  }

  /**
   * Create new course
   * @param {Object} courseData - Course data from request body
   * @param {Object} file - Uploaded file (optional)
   * @returns {Object} Success response
   */
  static async createCourse(courseData, file) {
    try {
      return await CourseModel.createCourse(courseData, file);
    } catch (err) {
      console.error("Course creation error:", err);
      const error = new Error("Failed to create course");
      error.statusCode = 500;
      throw error;
    }
  }

  /**
   * Update course by ID
   * @param {number} courseId - The course ID
   * @param {Object} courseData - Updated course data
   * @param {Object} file - Uploaded file (optional)
   * @returns {Object} Success response
   */
  static async updateCourse(courseId, courseData, file) {
    try {
      return await CourseModel.updateCourse(courseId, courseData, file);
    } catch (err) {
      console.error("Course update error:", err);
      const error = new Error("Failed to update course");
      error.statusCode = 500;
      throw error;
    }
  }

  /**
   * Delete course by ID with image cleanup
   * @param {number} courseId - The course ID to delete
   * @returns {Object} Success response
   */
  static async deleteCourseWithImageCleanup(courseId) {
    try {
      await CourseModel.deleteCourse(courseId);
      return { success: true, redirect: "/courses" };
    } catch (err) {
      console.error("Course deletion error:", err);
      const error = new Error("Failed to delete course");
      error.statusCode = 500;
      throw error;
    }
  }
}

module.exports = AdminCoursesService;
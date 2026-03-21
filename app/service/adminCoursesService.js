const path = require("path");
const fs = require("fs");
const executeQuery = require("./executeQueryservice");

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
      // Check if course has any classes
      const classCheckQuery = `
        SELECT COUNT(*) as classCount
        FROM classes
        WHERE course_id = ?
      `;
      const classCheck = await executeQuery(classCheckQuery, [courseId]);

      if (classCheck[0].classCount > 0) {
        const error = new Error("Cannot delete course that has classes");
        error.statusCode = 400;
        throw error;
      }

      // Check if course has any materials
      const materialCheckQuery = `
        SELECT COUNT(*) as materialCount
        FROM materials
        WHERE course_id = ?
      `;
      const materialCheck = await executeQuery(materialCheckQuery, [courseId]);

      if (materialCheck[0].materialCount > 0) {
        const error = new Error("Cannot delete course that has materials");
        error.statusCode = 400;
        throw error;
      }

      // If no dependencies, delete the course
      const deleteQuery = `DELETE FROM courses WHERE id = ?`;
      await executeQuery(deleteQuery, [courseId]);

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

      const course = {
        ...courseResult[0],
        start_date: new Date(courseResult[0].start_date),
        end_date: new Date(courseResult[0].end_date),
      };

      return course;
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
      const { course_name, description, start_date, end_date, tuition_fee } = courseData;

      // Handle image path
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
    } catch (err) {
      // Clean up uploaded file if query fails
      if (file) {
        fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
      }
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
      let { course_name, description, start_date, end_date, tuition_fee } = courseData;

      // Ensure single values for fields that might be submitted as arrays
      course_name = Array.isArray(course_name) ? course_name[0] : course_name;
      description = Array.isArray(description) ? description[0] : description;

      // Get current course info
      const currentCourse = await executeQuery(
        "SELECT image_path FROM courses WHERE id = ?",
        [courseId]
      );

      if (!currentCourse.length) {
        const error = new Error("Course not found");
        error.statusCode = 404;
        throw error;
      }

      let image_path = currentCourse[0].image_path;

      // If new image uploaded, update path and delete old image
      if (file) {
        if (image_path) {
          // image_path stored in DB is relative to project root, resolve correctly
          const oldImagePath = path.join(__dirname, "..", image_path);
          try {
            if (fs.existsSync(oldImagePath)) {
              fs.unlink(oldImagePath, (err) => {
                if (err) console.error("Error deleting old image:", err);
              });
            }
          } catch (e) {
            console.error("Old image deletion check failed:", e);
          }
        }
        // Use POSIX join to store URL-friendly forward slashes
        image_path = path.posix.join("uploads", "image", file.filename);
      }

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
    } catch (err) {
      // Clean up uploaded file if query fails
      if (file) {
        fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
      }
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
      // Get course info for image deletion
      const course = await executeQuery(
        "SELECT image_path FROM courses WHERE id = ?",
        [courseId]
      );

      // Delete image file if exists
      if (course[0]?.image_path) {
        const imagePath = path.join(__dirname, "..", course[0].image_path);
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlink(imagePath, (err) => {
              if (err) console.error("Error deleting course image:", err);
            });
          }
        } catch (e) {
          console.error("Course image deletion check failed:", e);
        }
      }

      // Delete course record
      await executeQuery("DELETE FROM courses WHERE id = ?", [courseId]);

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
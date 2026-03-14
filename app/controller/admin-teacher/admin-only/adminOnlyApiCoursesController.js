const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../../middleware/roleAuth");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const courseImageUpload = require("../../../middleware/courseImageUpload");
const executeQuery = require("../../../middleware/executeQuery");
const { checkAuthenticated } = require("../../../middleware/auth");
const router = express.Router();

/**
 * @swagger
 * /api/courses/new:
 *   get:
 *     summary: Get data for new course form (Admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Form data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/courses/new",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.json({ user: req.user });
  }
);

/**
 * @swagger
 * /api/courses/{id}:
 *   delete:
 *     summary: Delete course by ID (Admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course deleted successfully
 *       400:
 *         description: Cannot delete course with dependencies
 *       500:
 *         description: Deletion error
 */
router.delete(
  "/courses/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const courseId = req.params.id;

      // Check if course has any classes
      const classCheckQuery = `
      SELECT COUNT(*) as classCount
      FROM classes
      WHERE course_id = ?
    `;
      const classCheck = await executeQuery(classCheckQuery, [courseId]);

      if (classCheck[0].classCount > 0) {
        return res.status(400).json({ error: "Cannot delete course that has classes" });
      }

      // Check if course has any materials
      const materialCheckQuery = `
      SELECT COUNT(*) as materialCount
      FROM materials
      WHERE course_id = ?
    `;
      const materialCheck = await executeQuery(materialCheckQuery, [courseId]);

      if (materialCheck[0].materialCount > 0) {
        return res.status(400).json({ error: "Cannot delete course that has materials" });
      }

      // If no dependencies, delete the course
      const deleteQuery = `DELETE FROM courses WHERE id = ?`;
      await executeQuery(deleteQuery, [courseId]);

      res.json({ success: true, redirect: "/courses" });
    } catch (error) {
      console.error("Course deletion error:", error);
      res.status(500).json({ error: "Failed to delete course" });
    }
  }
);

/**
 * @swagger
 * /api/courses/{id}/edit:
 *   get:
 *     summary: Get course edit form data (Admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course edit data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 course:
 *                   type: object
 *                 user:
 *                   type: object
 *       404:
 *         description: Course not found
 *       500:
 *         description: Database error
 */
router.get(
  "/courses/:id/edit",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const courseId = req.params.id;

      // Get course details
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
        return res.status(404).json({ error: "Course not found" });
      }

      const course = {
        ...courseResult[0],
        start_date: new Date(courseResult[0].start_date),
        end_date: new Date(courseResult[0].end_date),
      };

      res.json({ course, user: req.user, messages: { error: req.flash("error"), success: req.flash("success") } });
    } catch (error) {
      console.error("Error loading course edit form:", error);
      res.status(500).json({ error: "Error loading course edit form" });
    }
  }
);

/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Create new course (Admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               course_name:
 *                 type: string
 *               description:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               tuition_fee:
 *                 type: number
 *               course_image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Course created successfully
 *       500:
 *         description: Creation error
 */
router.post(
  "/courses",
  checkAuthenticated,
  authenticateRole("admin"),
  courseImageUpload.single("course_image"),
  async (req, res) => {
    try {
      const { course_name, description, start_date, end_date, tuition_fee } =
        req.body;

      // Handle image path
      // Store path using POSIX-style forward slashes so URL paths are consistent
      const image_path = req.file
        ? path.posix.join("uploads", "image", req.file.filename)
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
      res.json({ success: true, redirect: "/courses" });
    } catch (err) {
      // Clean up uploaded file if query fails
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
      }
      console.error("Course creation error:", err);
      res.status(500).json({ error: "Failed to create course" });
    }
  }
);

/**
 * @swagger
 * /api/courses/{id}:
 *   post:
 *     summary: Update course by ID (Admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               course_name:
 *                 type: string
 *               description:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               tuition_fee:
 *                 type: number
 *               course_image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Course updated successfully
 *       404:
 *         description: Course not found
 *       500:
 *         description: Update error
 */
router.post(
  "/courses/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  courseImageUpload.single("course_image"),
  async (req, res) => {
    try {
      const courseId = req.params.id;
      let { course_name, description, start_date, end_date, tuition_fee } =
        req.body;

      // Ensure single values for fields that might be submitted as arrays
      course_name = Array.isArray(course_name) ? course_name[0] : course_name;
      description = Array.isArray(description) ? description[0] : description;

      // Get current course info
      const currentCourse = await executeQuery(
        "SELECT image_path FROM courses WHERE id = ?",
        [courseId]
      );

      if (!currentCourse.length) {
        return res.status(404).json({ error: "Course not found" });
      }

      let image_path = currentCourse[0].image_path;

      // If new image uploaded, update path and delete old image
      if (req.file) {
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
        image_path = path.posix.join("uploads", "image", req.file.filename);
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
      res.json({ success: true, redirect: "/courses" });
    } catch (err) {
      // Clean up uploaded file if query fails
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
      }
      console.error("Course update error:", err);
      res.status(500).json({ error: "Failed to update course" });
    }
  }
);

/**
 * @swagger
 * /api/courses/{id}:
 *   delete:
 *     summary: Delete course by ID with image cleanup (Admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course deleted successfully
 *       500:
 *         description: Deletion error
 */
router.delete(
  "/courses/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const courseId = req.params.id;

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

      res.json({ success: true, redirect: "/courses" });
    } catch (err) {
      console.error("Course deletion error:", err);
      res.status(500).json({ error: "Failed to delete course" });
    }
  }
);

module.exports = router;
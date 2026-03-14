const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../middleware/roleAuth");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const courseImageUpload = require("../../middleware/courseImageUpload");
const executeQuery = require("../../middleware/executeQuery");
const { checkAuthenticated } = require("../../middleware/auth");
const router = express.Router();

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     summary: Get course details by ID (Admin/Teacher)
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
 *         description: Course details
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
  "/courses/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const courseId = req.params.id;

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
        return res.status(404).json({ error: "Course not found" });
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

      res.json({ course, user: req.user, messages: { error: req.flash("error"), success: req.flash("success") } });
    } catch (error) {
      console.error("Error fetching course details:", error);
      res.status(500).json({ error: "Error loading course details" });
    }
  }
);

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Get all courses (Admin/Teacher)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                 user:
 *                   type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/courses",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
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

      res.json({ courses: processedCourses, user: req.user });
    } catch (err) {
      console.error("Fetch courses error:", err);
      res.status(500).json({ error: "Error loading courses" });
    }
  }
);

module.exports = router;
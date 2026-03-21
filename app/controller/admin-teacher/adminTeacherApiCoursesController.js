const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const courseImageUpload = require("../../service/courseImageUploadservice");
const executeQuery = require("../../service/executeQueryservice");
const { checkAuthenticated } = require("../../service/authservice");
const adminTeacherCoursesService = require("../../service/adminTeacherCoursesService");
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
      const course = await adminTeacherCoursesService.getCourseDetails(courseId);
      res.json({ course, user: req.user, messages: { error: req.flash("error"), success: req.flash("success") } });
    } catch (error) {
      console.error("Error fetching course details:", error);
      res.status(error.statusCode || 500).json({ error: error.message });
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
      const courses = await adminTeacherCoursesService.getAllCourses();
      res.json({ courses: courses, user: req.user });
    } catch (error) {
      console.error("Fetch courses error:", error);
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
);

module.exports = router;
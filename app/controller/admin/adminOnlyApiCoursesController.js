const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const courseImageUpload = require("../../service/courseImageUploadservice");
const executeQuery = require("../../service/executeQueryservice");
const { checkAuthenticated } = require("../../service/authservice");
const adminCoursesService = require("../../service/adminCoursesService");
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
    try {
      const data = adminCoursesService.getNewCourseFormData(req.user);
      res.json(data);
    } catch (error) {
      console.error("Error getting new course form data:", error);
      res.status(500).json({ error: "Failed to get form data" });
    }
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
      const result = await adminCoursesService.deleteCourse(courseId);
      res.json(result);
    } catch (error) {
      console.error("Course deletion error:", error);
      res.status(error.statusCode || 500).json({ error: error.message });
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
      const course = await adminCoursesService.getCourseForEdit(courseId);
      res.json({ course, user: req.user, messages: { error: req.flash("error"), success: req.flash("success") } });
    } catch (error) {
      console.error("Error loading course edit form:", error);
      res.status(error.statusCode || 500).json({ error: error.message });
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
      const result = await adminCoursesService.createCourse(req.body, req.file);
      res.json(result);
    } catch (error) {
      console.error("Course creation error:", error);
      res.status(error.statusCode || 500).json({ error: error.message });
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
      const result = await adminCoursesService.updateCourse(courseId, req.body, req.file);
      res.json(result);
    } catch (error) {
      console.error("Course update error:", error);
      res.status(error.statusCode || 500).json({ error: error.message });
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
      const result = await adminCoursesService.deleteCourseWithImageCleanup(courseId);
      res.json(result);
    } catch (error) {
      console.error("Course deletion error:", error);
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
);

module.exports = router;
const express = require("express");
const { authenticateRole } = require("../../service/roleAuthservice");
const courseImageUpload = require("../../service/courseImageUploadservice");
const { checkAuthenticated } = require("../../service/authservice");
const {
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
} = require("../../service/coursesService");
const router = express.Router();

/**
 * @swagger
 * /api/course-detail/{id}:
 *   get:
 *     summary: Get course details by ID
 *     tags: [Courses]
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
 *       404:
 *         description: Course not found
 */
router.get("/course-detail/:id", async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await getCourseDetail(courseId);
    res.json({ course, user: req.user });
  } catch (error) {
    console.error("Error fetching public course details:", error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error loading course details" });
  }
});

/**
 * @swagger
 * /api/courses/new:
 *   get:
 *     summary: Get data for new course form
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
  async (req, res) => {
    try {
      await getNewCourseFormData();
      res.json({ user: req.user });
    } catch (error) {
      console.error("Error loading new course form:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Error loading course form data" });
    }
  }
);

/**
 * @swagger
 * /api/courses/{id}:
 *   delete:
 *     summary: Delete course by ID
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
      const result = await deleteCourse(courseId);
      res.json(result);
    } catch (error) {
      console.error("Course deletion error:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Failed to delete course" });
    }
  }
);

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     summary: Get course details by ID
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
      const { course } = await getCourseById(courseId);
      res.json({ course, user: req.user, messages: { error: req.flash("error"), success: req.flash("success") } });
    } catch (error) {
      console.error("Error fetching course details:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Error loading course details" });
    }
  }
);

/**
 * @swagger
 * /api/courses/{id}/edit:
 *   get:
 *     summary: Get course edit form data
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
      const { course } = await getCourseEditData(courseId);
      res.json({ course, user: req.user, messages: { error: req.flash("error"), success: req.flash("success") } });
    } catch (error) {
      console.error("Error loading course edit form:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Error loading course edit form" });
    }
  }
);

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Get all courses
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
      const courses = await getAllCourses();
      res.json({ courses, user: req.user });
    } catch (err) {
      console.error("Fetch courses error:", err);
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error loading courses" });
    }
  }
);

/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Create new course
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
      const result = await createCourse(req.body, req.file);
      res.json(result);
    } catch (err) {
      // Clean up uploaded file if query fails
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
      }
      console.error("Course creation error:", err);
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Failed to create course" });
    }
  }
);

/**
 * @swagger
 * /api/courses/{id}:
 *   post:
 *     summary: Update course by ID
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
      const result = await updateCourse(courseId, req.body, req.file);
      res.json(result);
    } catch (err) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
      }
      console.error("Course update error:", err);
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Failed to update course" });
    }
  }
);



/**
 * @swagger
 * /api/available-courses:
 *   get:
 *     summary: Get available courses for enrollment
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                 student:
 *                   type: object
 *                 user:
 *                   type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/available-courses",
  checkAuthenticated,
  authenticateRole("student"),
  async (req, res) => {
    try {
      const { courses, student } = await getAvailableCourses(req.user.id);
      res.json({ courses, student, user: req.user });
    } catch (err) {
      console.error("Error fetching available courses:", err);
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error loading available courses" });
    }
  }
);

/**
 * @swagger
 * /api/enroll-course:
 *   post:
 *     summary: Enroll in a course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               class_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Enrollment successful
 *       400:
 *         description: Invalid request or already enrolled
 *       404:
 *         description: Class not found
 *       500:
 *         description: Enrollment error
 */
router.post(
  "/enroll-course",
  checkAuthenticated,
  authenticateRole("student"),
  async (req, res) => {
    try {
      const { class_id } = req.body;
      const result = await enrollCourse(req.user.id, class_id);
      res.json(result);
    } catch (err) {
      console.error("Enrollment error:", err);
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Failed to enroll in course" });
    }
  }
);

/**
 * @swagger
 * /api/my-courses:
 *   get:
 *     summary: Get user's enrolled courses
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get("/my-courses", checkAuthenticated, async (req, res) => {
  try {
    const courses = await getMyCourses(req.user);
    res.json({ user: req.user, courses, messages: { error: req.flash("error"), success: req.flash("success") } });
  } catch (error) {
    console.error("Error fetching courses:", error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error loading courses" });
  }
});

module.exports = router;

const express = require("express");
const { authenticateRole } = require("../../service/roleAuthservice");
const { checkAuthenticated } = require("../../service/authservice");
const {
  getAllClasses,
  updateClass,
  getClassEditData,
  deleteClass,
  createClass,
  getNewClassFormData,
  getClassStudents,
} = require("../../service/classesService");
const executeQuery = require("../../service/executeQueryservice");
const router = express.Router();

/**
 * @swagger
 * /api/classes:
 *   get:
 *     summary: Get all classes
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of classes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 classes:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/classes",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const classes = await getAllClasses();
      let filteredClasses = classes;

      // If examId is provided, filter out classes already assigned to this exam
      if (req.query.examId) {
        const examId = parseInt(req.query.examId);
        if (!isNaN(examId)) {
          // Get classes already assigned to this exam
          const assignedClassesQuery = `
            SELECT DISTINCT classes_id
            FROM ExamAssignments
            WHERE exam_id = ${examId}
          `;
          const assignedClassesResult = await executeQuery(assignedClassesQuery);
          const assignedClassIds = assignedClassesResult.map(row => row.classes_id);

          // Filter out assigned classes
          filteredClasses = classes.filter(cls => !assignedClassIds.includes(cls.id));
        }
      }

      res.json({ classes: filteredClasses, user: req.user });
    } catch (err) {
      console.error("Fetch classes error:", err);
      res.status(500).json({ error: "Error loading classes" });
    }
  }
);

/**
 * @swagger
 * /api/classes/{id}:
 *   post:
 *     summary: Update class by ID
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Class ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               class_name:
 *                 type: string
 *               course_id:
 *                 type: integer
 *               teacher_id:
 *                 type: integer
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *               weekly_days:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Class updated successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Update error
 */
router.post(
  "/classes/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const classId = req.params.id;
      const result = await updateClass(classId, req.body);
      res.json(result);
    } catch (error) {
      console.error("Error updating class:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Failed to update class" });
    }
  }
);

/**
 * @swagger
 * /api/classes/{id}/edit:
 *   get:
 *     summary: Get class edit form data
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Class ID
 *     responses:
 *       200:
 *         description: Class edit data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 classItem:
 *                   type: object
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                 teachers:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Class not found
 *       500:
 *         description: Database error
 */
router.get(
  "/classes/:id/edit",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const classId = req.params.id;
      const { classItem, courses, teachers } = await getClassEditData(classId);
      res.json({ user: req.user, classItem, courses, teachers });
    } catch (error) {
      console.error("Error loading class edit form:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Error loading class edit form" });
    }
  }
);

/**
 * @swagger
 * /api/classes/{id}:
 *   delete:
 *     summary: Delete class by ID
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Class ID
 *     responses:
 *       200:
 *         description: Class deleted successfully
 *       400:
 *         description: Cannot delete class with enrollments
 *       404:
 *         description: Class not found
 *       500:
 *         description: Deletion error
 */
router.delete(
  "/classes/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const classId = req.params.id;
      const result = await deleteClass(classId);
      res.json(result);
    } catch (error) {
      console.error("Class deletion error:", {
        classId: req.params.id,
        error: error.message,
        stack: error.stack,
      });
      const status = error.status || 500;
      const body = {
        error: error.message || "Failed to delete class",
      };
      if (error.code) body.code = error.code;
      if (error.details) body.details = error.details;
      res.status(status).json(body);
    }
  }
);

/**
 * @swagger
 * /api/classes:
 *   post:
 *     summary: Create new class
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               class_name:
 *                 type: string
 *               course_id:
 *                 type: integer
 *               teacher_id:
 *                 type: integer
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *               weekly_days:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Class created successfully
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Course not found
 *       409:
 *         description: Schedule conflict
 *       500:
 *         description: Creation error
 */
router.post(
  "/classes",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const result = await createClass(req.body);
      res.json(result);
    } catch (error) {
      console.error("Create class error:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Failed to create class" });
    }
  }
);

/**
 * @swagger
 * /api/classes/new:
 *   get:
 *     summary: Get data for new class form
 *     tags: [Classes]
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
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                 teachers:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/classes/new",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const { courses, teachers } = await getNewClassFormData();
      res.json({
        user: req.user,
        courses,
        teachers,
        messages: {
          error: req.flash("error"),
          success: req.flash("success"),
        },
      });
    } catch (err) {
      console.error("Error loading new class form:", err);
      res.status(500).json({ error: "Error loading form data" });
    }
  }
);

/**
 * @swagger
 * /api/classes/{id}/students:
 *   get:
 *     summary: Get students enrolled in a class
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Class ID
 *     responses:
 *       200:
 *         description: List of students
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 classInfo:
 *                   type: object
 *                 students:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Class not found
 *       500:
 *         description: Database error
 */
router.get(
  "/classes/:id/students",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const classId = req.params.id;
      const { classInfo, students } = await getClassStudents(classId);
      res.json({ user: req.user, classInfo, students });
    } catch (error) {
      console.error("Error fetching class students:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Failed to load student list." });
    }
  }
);

module.exports = router;


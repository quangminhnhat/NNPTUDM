const express = require("express");
const { authenticateRole } = require("../../service/roleAuthservice");
const { checkAuthenticated } = require("../../service/authservice");
const {
  getAllEnrollments,
  deleteEnrollment,
  toggleEnrollmentPayment,
  getEnrollmentEditData,
  getNewEnrollmentFormData,
  createEnrollment,
  updateEnrollment,
} = require("../../service/enrollmentsService");
const router = express.Router();

/**
 * @swagger
 * /api/enrollments:
 *   get:
 *     summary: Get all enrollments
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of enrollments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enrollments:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/enrollments",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const enrollments = await getAllEnrollments();
      res.json({ enrollments, user: req.user });
    } catch (error) {
      console.error("Fetch enrollments error:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Database error" });
    }
  }
);

/**
 * @swagger
 * /api/enrollments/{id}:
 *   delete:
 *     summary: Delete enrollment by ID
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Enrollment ID
 *     responses:
 *       200:
 *         description: Enrollment deleted successfully
 *       404:
 *         description: Enrollment not found
 *       500:
 *         description: Deletion error
 */
router.delete(
  "/enrollments/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const result = await deleteEnrollment(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Enrollment deletion error:", {
        enrollmentId: req.params.id,
        error: error.message,
        stack: error.stack,
      });
      const status = error.status || 500;
      res.status(status).json({
        error: error.message || "Failed to delete enrollment",
        code: error.code || "DELETE_FAILED",
      });
    }
  }
);

/**
 * @swagger
 * /api/enrollments/{id}/toggle-payment:
 *   post:
 *     summary: Toggle payment status for enrollment
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Enrollment ID
 *     responses:
 *       200:
 *         description: Payment status toggled successfully
 *       500:
 *         description: Update error
 */
router.post(
  "/enrollments/:id/toggle-payment",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const result = await toggleEnrollmentPayment(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Update payment status error:", error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message || "Update failed" });
    }
  }
);

/**
 * @swagger
 * /api/enrollments/{id}/edit:
 *   get:
 *     summary: Get enrollment edit form data
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Enrollment ID
 *     responses:
 *       200:
 *         description: Edit form data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enrollment:
 *                   type: object
 *                 students:
 *                   type: array
 *                   items:
 *                     type: object
 *                 classes:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Enrollment not found
 *       500:
 *         description: Database error
 */
router.get(
  "/enrollments/:id/edit",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const data = await getEnrollmentEditData(req.params.id);
      res.json({ ...data, user: req.user });
    } catch (err) {
      console.error("Error loading enrollment edit form:", err);
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error loading enrollment edit form" });
    }
  }
);

/**
 * @swagger
 * /api/enrollments/new:
 *   get:
 *     summary: Get data for new enrollment form
 *     tags: [Enrollments]
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
 *                 students:
 *                   type: array
 *                   items:
 *                     type: object
 *                 classes:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/enrollments/new",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const { students, classes } = await getNewEnrollmentFormData();
      res.json({
        students: students.map((s) => ({
          ...s,
          hasUnpaidFees: s.unpaid_enrollments > 0,
        })),
        classes: classes.map((cls) => ({
          ...cls,
          isAvailable: cls.status !== "Ended",
          schedule: cls.weekly_schedule
            ? cls.weekly_schedule
                .split(",")
                .map((day) => {
                  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                  return days[parseInt(day) - 1];
                })
                .join(", ")
            : "No schedule",
          timeSlot: `${cls.start_time} - ${cls.end_time}`,
        })),
        user: req.user,
        currentDate: new Date().toISOString().split("T")[0],
        errors: req.flash("error"),
        success: req.flash("success"),
      });
    } catch (err) {
      console.error("Error loading enrollment form:", {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });

      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Failed to load enrollment form" });
    }
  }
);

/**
 * @swagger
 * /api/enrollments:
 *   post:
 *     summary: Create new enrollment
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               student_id:
 *                 type: integer
 *               class_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Enrollment created successfully
 *       500:
 *         description: Creation error
 */
router.post(
  "/enrollments",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const { student_id, class_id } = req.body;
      const result = await createEnrollment(student_id, class_id);
      res.json(result);
    } catch (error) {
      console.error("Enrollment creation error:", {
        error: error.message,
        stack: error.stack,
        body: req.body,
      });
      const status = error.status || 500;
      res.status(status).json({
        error: error.message || "Failed to create enrollment",
        code: error.code || "CREATE_FAILED",
      });
    }
  }
);

/**
 * @swagger
 * /api/enrollments/{id}:
 *   put:
 *     summary: Update enrollment
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Enrollment ID
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
 *         description: Enrollment updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Enrollment or class not found
 *       500:
 *         description: Update error
 */
router.put(
  "/enrollments/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    const enrollmentId = req.params.id;
    const { class_id } = req.body;

    try {
      const result = await updateEnrollment(enrollmentId, class_id);
      res.json(result);
    } catch (error) {
      console.error("Error updating enrollment:", {
        enrollmentId,
        body: req.body,
        error: error.message,
        stack: error.stack,
      });
      const status = error.status || 500;
      res.status(status).json({
        error: error.message || "Failed to update enrollment.",
        code: error.code || "UPDATE_FAILED",
      });
    }
  }
);

module.exports = router;


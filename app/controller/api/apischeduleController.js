const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const connectionString = process.env.CONNECTION_STRING; 
const executeQuery = require("../../service/executeQueryservice");
const {
  checkAuthenticated,
} = require("../../service/authservice");
const router = express.Router();
const validateSchedule = require("../../service/validateScheduleservice");
const schedulesService = require("../../service/schedulesService");




/**
 * @swagger
 * /api/schedule/new:
 *   get:
 *     summary: Get data for creating a new schedule
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Form data for new schedule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 classes:
 *                   type: array
 *                 user:
 *                   type: object
 *                 currentDate:
 *                   type: string
 *                   format: date
 *       500:
 *         description: Server error
 */
router.get(
  "/schedule/new",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const data = await schedulesService.getNewScheduleFormData();

      res.json({
        classes: data.classes,
        user: req.user,
        currentDate: data.currentDate,
      });
    } catch (err) {
      console.error("Error loading schedule form:", err);
      console.error(err.stack);
      res.status(500).json({ error: "Error loading schedule form" });
    }
  }
);








/**
 * @swagger
 * /api/schedules/{id}:
 *   delete:
 *     summary: Delete a schedule
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: Schedule deleted successfully
 *       404:
 *         description: Schedule not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/schedules/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const scheduleId = req.params.id;
      
      const result = await schedulesService.deleteSchedule(scheduleId);
      
      res.json(result);
    } catch (err) {
      console.error("Delete schedule error:", err);
      res.status(err.status || 500).json({ error: err.message || "Failed to delete schedule" });
    }
  }
);

/**
 * @swagger
 * /api/schedules:
 *   get:
 *     summary: Get all schedules
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of schedules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedules:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/schedules",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const data = await schedulesService.getAllSchedules();
      res.json({ ...data, user: req.user });
    } catch (err) {
      console.error("Fetch schedules error:", err);
      res.status(500).json({ error: "Error loading schedules" });
    }
  }
);



/**
 * @swagger
 * /api/schedules:
 *   post:
 *     summary: Create a new schedule
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - class_id
 *               - schedule_date
 *               - start_time
 *               - end_time
 *               - day_of_week
 *             properties:
 *               class_id:
 *                 type: integer
 *               schedule_date:
 *                 type: string
 *                 format: date
 *               start_time:
 *                 type: string
 *                 format: time
 *               end_time:
 *                 type: string
 *                 format: time
 *               day_of_week:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Schedule created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Schedule conflict detected
 *       500:
 *         description: Server error
 */
router.post(
  "/schedules",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const { class_id, schedule_date, start_time, end_time, day_of_week } =
        req.body;

      const result = await schedulesService.createSchedule(class_id, schedule_date, start_time, end_time, day_of_week);

      res.json(result);
    } catch (err) {
      console.error("Create schedule error:", err);
      res.status(err.status || 500).json({ error: err.message || "Failed to create schedule" });
    }
  }
);


/**
 * @swagger
 * /api/schedules/{id}/edit:
 *   get:
 *     summary: Get data for editing a schedule
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: Schedule edit data retrieved
 *       404:
 *         description: Schedule not found
 *       500:
 *         description: Server error
 */
router.get("/schedules/:id/edit", checkAuthenticated, authenticateRole("admin"), async (req, res) => {
  try {
    const scheduleId = req.params.id;

    const data = await schedulesService.getEditScheduleFormData(scheduleId);

    res.json({
      ...data,
      user: req.user,
      messages: {
        error: req.flash('error'),
        success: req.flash('success')
      }
    });

    } catch (err) {
    console.error("Schedule edit error:", err);
    res.status(err.status || 500).json({
      error: err.message || 'Error loading schedule edit form',
      detail: String(err),
      user: req.user
    });
  }
});




//you gonna need to redo this part
/**
 * @swagger
 * /api/schedule:
 *   get:
 *     summary: Get weekly schedule for student/teacher
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weekStart
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date of the week (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Weekly schedule data
 *       403:
 *         description: Unauthorized role
 *       500:
 *         description: Server error
 */
router.get("/schedule", checkAuthenticated, (req, res) => {
    try {
      const data = schedulesService.getWeeklySchedule(req.user.id, req.user.role, req.query.weekStart);

      res.json({
        user: req.user,
        ...data
      });
    } catch (error) {
      console.error("Error getting weekly schedule:", error);
      res.status(error.status || 500).json({
        error: error.message || "Database operation failed"
      });
    }
  });




  /**
   * @swagger
   * /api/schedules/{id}:
   *   post:
   *     summary: Update a schedule
   *     tags: [Schedules]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Schedule ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - class_id
   *               - schedule_date
   *               - start_time
   *               - end_time
   *               - day_of_week
   *             properties:
   *               class_id:
   *                 type: integer
   *               schedule_date:
   *                 type: string
   *                 format: date
   *               start_time:
   *                 type: string
   *                 format: time
   *               end_time:
   *                 type: string
   *                 format: time
   *               day_of_week:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Schedule updated successfully
   *       400:
   *         description: Missing required fields
   *       404:
   *         description: Class not found
   *       500:
   *         description: Server error
   */
  router.post(
    "/schedules/:id",
    checkAuthenticated,
    authenticateRole("admin"),
    async (req, res) => {
      try {
        const scheduleId = req.params.id;
        const { class_id, schedule_date, start_time, end_time, day_of_week } =
          req.body;

        const result = await schedulesService.updateSchedule(scheduleId, class_id, schedule_date, start_time, end_time, day_of_week);

        res.json(result);
      } catch (err) {
        console.error("Update schedule error:", err);
        res.status(err.status || 500).json({ error: err.message || "Failed to update schedule" });
      }
    }
  );


  /**
   * @swagger
   * /api/schedules/new:
   *   get:
   *     summary: Get data for new schedule form (Alternative)
   *     tags: [Schedules]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Form data for new schedule
   *       500:
   *         description: Server error
   */
  router.get(
    "/schedules/new",
    checkAuthenticated,
    authenticateRole("admin"),
    async (req, res) => {
      try {
        const data = await schedulesService.getNewScheduleFormDataAlt();

        res.json({
          user: req.user,
          ...data
        });
      } catch (err) {
        console.error("Error loading schedule form:", err);
        res.status(500).json({ error: "Error loading schedule form" });
      }
    }
  );

  /**
   * @swagger
   * /api/schedules/{id}:
   *   delete:
   *     summary: Delete a schedule (Duplicate)
   *     tags: [Schedules]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Schedule ID
   *     responses:
   *       200:
   *         description: Schedule deleted successfully
   *       404:
   *         description: Schedule not found
   *       500:
   *         description: Server error
   */
  router.delete(
    "/schedules/:id",
    checkAuthenticated,
    authenticateRole("admin"),
    async (req, res) => {
      try {
        const scheduleId = req.params.id;

        const result = await schedulesService.deleteSchedule(scheduleId);

        res.json(result);
      } catch (err) {
        console.error("Delete schedule error:", err);
        res.status(err.status || 500).json({ error: err.message || "Failed to delete schedule" });
      }
    }
  );

  module.exports = router;

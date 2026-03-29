const executeQuery = require("../service/executeQueryservice");

// Helper: check if a column exists in a table (SQL Server)
async function columnExists(tableName, columnName) {
  try {
    const q = `
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = ? AND COLUMN_NAME = ?
    `;
    const rows = await executeQuery(q, [tableName, columnName]);
    return rows && rows.length > 0;
  } catch (err) {
    console.error('Failed to check column existence:', err);
    return false;
  }
}

class ScheduleModel {
  /**
   * Get data for creating a new schedule
   * @returns {Promise<Object>} Form data with classes and current date
   */
  static async getNewScheduleFormData() {
    const query = `
      SELECT
        c.id,
        c.class_name,
        c.course_id,
        c.teacher_id,
        CONVERT(varchar(5), c.start_time, 108) as start_time,
        CONVERT(varchar(5), c.end_time, 108) as end_time,
        c.weekly_schedule,
        co.course_name,
        CONVERT(varchar(10), co.start_date, 23) as start_date,
        CONVERT(varchar(10), co.end_date, 23) as end_date,
        tu.full_name as teacher_name
      FROM classes c
      INNER JOIN courses co ON c.course_id = co.id
      LEFT JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN users tu ON t.user_id = tu.id
      WHERE co.end_date >= GETDATE()
      ORDER BY co.start_date ASC, c.class_name
    `;

    let classes = await executeQuery(query);

    // Process weekly schedule for display
    const processedClasses = classes.map((cls) => ({
      ...cls,
      formattedStartTime: cls.start_time,
      formattedEndTime: cls.end_time,
      schedule: cls.weekly_schedule
        ? cls.weekly_schedule
            .split(",")
            .map((day) => {
              const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
              return days[parseInt(day) - 1];
            })
            .join(", ")
        : "No schedule set",
    }));

    return {
      classes: processedClasses,
      currentDate: new Date().toISOString().split("T")[0]
    };
  }

  /**
   * Delete a schedule
   * @param {number} scheduleId - Schedule ID
   * @returns {Promise<Object>} Success message
   */
  static async deleteSchedule(scheduleId) {
    // Check if schedule exists
    const checkQuery = "SELECT id FROM schedules WHERE id = ?";
    const schedule = await executeQuery(checkQuery, [scheduleId]);

    if (!schedule.length) {
      const error = new Error("Schedule not found");
      error.status = 404;
      throw error;
    }

    // Delete schedule
    const deleteQuery = "DELETE FROM schedules WHERE id = ?";
    await executeQuery(deleteQuery, [scheduleId]);

    return { success: true, message: "Schedule deleted" };
  }

  /**
   * Get all schedules
   * @returns {Promise<Object>} Object containing schedules array
   */
  static async getAllSchedules() {
    const query = `
    SELECT
      s.*,
      c.class_name,
      co.course_name,
      tu.full_name as teacher_name,
      CONVERT(VARCHAR(5), s.start_time, 108) as formatted_start_time,
      CONVERT(VARCHAR(5), s.end_time, 108) as formatted_end_time
    FROM schedules s
    JOIN classes c ON s.class_id = c.id
    JOIN courses co ON c.course_id = co.id
    LEFT JOIN teachers t ON c.teacher_id = t.id
    LEFT JOIN users tu ON t.user_id = tu.id
    ORDER BY s.schedule_date DESC, s.start_time ASC
  `;

    const schedules = await executeQuery(query);
    return { schedules };
  }

  /**
   * Create a new schedule
   * @param {number} class_id - Class ID
   * @param {string} schedule_date - Schedule date
   * @param {string} start_time - Start time
   * @param {string} end_time - End time
   * @param {number} day_of_week - Day of week
   * @returns {Promise<Object>} Success message
   */
  static async createSchedule(class_id, schedule_date, start_time, end_time, day_of_week) {
    // Input validation
    if (!class_id || !schedule_date || !start_time || !end_time || !day_of_week) {
      const missing = [];
      if (!class_id) missing.push("class_id");
      if (!schedule_date) missing.push("schedule_date");
      if (!start_time) missing.push("start_time");
      if (!end_time) missing.push("end_time");
      if (!day_of_week) missing.push("day_of_week");
      
      const error = new Error(`Missing required fields: ${missing.join(", ")}`);
      error.status = 400;
      throw error;
    }

    // Check for schedule conflicts
    const conflictQuery = `
    SELECT id FROM schedules
    WHERE class_id = ?
    AND schedule_date = ?
    AND ((start_time <= ? AND end_time >= ?)
      OR (start_time <= ? AND end_time >= ?)
      OR (start_time >= ? AND end_time <= ?))
  `;

    const conflicts = await executeQuery(conflictQuery, [
      class_id,
      schedule_date,
      start_time,
      start_time,
      end_time,
      end_time,
      start_time,
      end_time,
    ]);

    if (conflicts.length > 0) {
      const error = new Error("Schedule conflict detected");
      error.status = 409;
      throw error;
    }

    // Adapt insert depending on whether `schedules.course_id` exists
    const hasCourseCol = await columnExists('schedules', 'course_id');

    if (hasCourseCol) {
      // Retrieve course_id from classes table and include it in the insert
      const courseQuery = "SELECT course_id FROM classes WHERE id = ?";
      const courseResult = await executeQuery(courseQuery, [class_id]);
      if (!courseResult.length) {
        const error = new Error('Class not found');
        error.status = 404;
        throw error;
      }
      const course_id = courseResult[0].course_id;

      const insertQuery = `
      INSERT INTO schedules (
        class_id,
        course_id,
        day_of_week,
        schedule_date,
        start_time,
        end_time,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`;

      await executeQuery(insertQuery, [
        class_id,
        course_id,
        day_of_week,
        schedule_date,
        start_time,
        end_time,
      ]);
    } else {
      const insertQuery = `
      INSERT INTO schedules (
        class_id,
        day_of_week,
        schedule_date,
        start_time,
        end_time,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE())`;

      await executeQuery(insertQuery, [
        class_id,
        day_of_week,
        schedule_date,
        start_time,
        end_time,
      ]);
    }

    return { success: true, message: "Schedule created" };
  }

  /**
   * Get data for editing a schedule
   * @param {number} scheduleId - Schedule ID
   * @returns {Promise<Object>} Edit form data
   */
  static async getEditScheduleFormData(scheduleId) {
    // Get schedule details with all related information
    const scheduleQuery = `
      SELECT
        s.*,
        c.id as class_id,
        c.class_name,
        c.weekly_schedule,
        co.id as course_id,
        co.course_name,
        co.start_date as course_start,
        co.end_date as course_end,
        tu.full_name as teacher_name,
        CONVERT(varchar(5), s.start_time, 108) as formatted_start_time,
        CONVERT(varchar(5), s.end_time, 108) as formatted_end_time,
        CONVERT(varchar(10), s.schedule_date, 23) as formatted_schedule_date
      FROM schedules s
      JOIN classes c ON s.class_id = c.id
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users tu ON t.user_id = tu.id
      WHERE s.id = ?
    `;

    // Get all available classes for dropdown
    const classesQuery = `
      SELECT
        c.id,
        c.class_name,
        co.course_name,
        tu.full_name as teacher_name,
        CONVERT(varchar(10), co.start_date, 23) as start_date,
        CONVERT(varchar(10), co.end_date, 23) as end_date,
        c.weekly_schedule
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users tu ON t.user_id = tu.id
      WHERE co.end_date >= GETDATE()
      ORDER BY co.start_date ASC, c.class_name
    `;

    // Execute both queries concurrently
    const [scheduleResults, classesResults] = await Promise.all([
      executeQuery(scheduleQuery, [scheduleId]),
      executeQuery(classesQuery)
    ]);

    if (!scheduleResults.length) {
      const error = new Error('Schedule not found');
      error.status = 404;
      throw error;
    }

    // Process weekly schedule for classes
    const processedClasses = classesResults.map(cls => ({
      ...cls,
      schedule: cls.weekly_schedule ?
        cls.weekly_schedule.split(',')
          .map(day => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][parseInt(day) - 1])
          .join(', ') :
        'No schedule set'
    }));

    return {
      schedule: {
        ...scheduleResults[0],
        day_name: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
          new Date(scheduleResults[0].schedule_date).getDay()
        ]
      },
      classes: processedClasses
    };
  }

  /**
   * Update a schedule
   * @param {number} scheduleId - Schedule ID
   * @param {number} class_id - Class ID
   * @param {string} schedule_date - Schedule date
   * @param {string} start_time - Start time
   * @param {string} end_time - End time
   * @param {number} day_of_week - Day of week
   * @returns {Promise<Object>} Success message
   */
  static async updateSchedule(scheduleId, class_id, schedule_date, start_time, end_time, day_of_week) {
    // Input validation with specific error messages
    const missingFields = [];
    if (!class_id) missingFields.push("Class");
    if (!schedule_date) missingFields.push("Schedule date");
    if (!start_time) missingFields.push("Start time");
    if (!end_time) missingFields.push("End time");
    if (!day_of_week) missingFields.push("Day of week");

    if (missingFields.length > 0) {
      const error = new Error(`Missing required fields: ${missingFields.join(", ")}`);
      error.status = 400;
      throw error;
    }

    // Update schedule. Include course_id if that column exists in the DB.
    const hasCourseCol = await columnExists('schedules', 'course_id');

    if (hasCourseCol) {
      const courseQuery = "SELECT course_id FROM classes WHERE id = ?";
      const courseResult = await executeQuery(courseQuery, [class_id]);
      if (!courseResult.length) {
        const error = new Error('Class not found');
        error.status = 404;
        throw error;
      }
      const course_id = courseResult[0].course_id;

      const updateQuery = `
      UPDATE schedules
      SET class_id = ?,
          course_id = ?,
          day_of_week = ?,
          schedule_date = ?,
          start_time = ?,
          end_time = ?,
          updated_at = GETDATE()
      WHERE id = ?`;

      await executeQuery(updateQuery, [
        class_id,
        course_id,
        day_of_week,
        schedule_date,
        start_time,
        end_time,
        scheduleId,
      ]);
    } else {
      const updateQuery = `
      UPDATE schedules
      SET class_id = ?,
          day_of_week = ?,
          schedule_date = ?,
          start_time = ?,
          end_time = ?,
          updated_at = GETDATE()
      WHERE id = ?`;

      await executeQuery(updateQuery, [
        class_id,
        day_of_week,
        schedule_date,
        start_time,
        end_time,
        scheduleId,
      ]);
    }

    return { success: true, message: "Schedule updated successfully" };
  }

  /**
   * Get data for new schedule form (Alternative)
   * @returns {Promise<Object>} Form data with classes and current date
   */
  static async getNewScheduleFormDataAlt() {
    // Get active classes with course and teacher info
    const query = `
    SELECT
      c.id,
      c.class_name,
      co.id as course_id,
      co.course_name,
      tu.full_name as teacher_name,
      co.start_date,
      co.end_date
    FROM classes c
    JOIN courses co ON c.course_id = co.id
    JOIN teachers t ON c.teacher_id = t.id
    JOIN users tu ON t.user_id = tu.id
    WHERE co.end_date >= GETDATE()
    ORDER BY co.start_date ASC, c.class_name
  `;

    const classes = await executeQuery(query);

    return {
      classes: classes,
      currentDate: new Date().toISOString().split("T")[0]
    };
  }
}

module.exports = ScheduleModel;
const ScheduleModel = require("../model/ScheduleModel");

class SchedulesService {
  // Get data for creating a new schedule
  async getNewScheduleFormData() {
    return await ScheduleModel.getNewScheduleFormData();
  }

  // Delete a schedule
  async deleteSchedule(scheduleId) {
    return await ScheduleModel.deleteSchedule(scheduleId);
  }

  // Get all schedules
  async getAllSchedules() {
    return await ScheduleModel.getAllSchedules();
  }

  // Create a new schedule
  async createSchedule(class_id, schedule_date, start_time, end_time, day_of_week) {
    return await ScheduleModel.createSchedule(class_id, schedule_date, start_time, end_time, day_of_week);
  }

  // Get data for editing a schedule
  async getEditScheduleFormData(scheduleId) {
    return await ScheduleModel.getEditScheduleFormData(scheduleId);
  }

  // Get weekly schedule for student/teacher
  async getWeeklySchedule(userId, role, weekStart) {
    // 1. Week calculation
    let monday;
    if (weekStart) {
      monday = new Date(weekStart);
    } else {
      const today = new Date();
      const offset = (today.getDay() + 6) % 7; // Mon = 0
      monday = new Date(today);
      monday.setDate(today.getDate() - offset);
    }

    // 2. Days setup
    const dayNames = [
      "Thứ 2",
      "Thứ 3",
      "Thứ 4",
      "Thứ 5",
      "Thứ 6",
      "Thứ 7",
      "Chủ nhật",
    ];
    const days = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      return {
        name: dayNames[i],
        date: dt.toLocaleDateString("vi-VN"),
        iso: dt.toISOString().slice(0, 10),
      };
    });

    // 3. Query based on user role
    let query;
    let params = [];

    if (role === "student") {
        query = `
          SELECT
            cls.id as class_id,
            cls.class_name,
            co.course_name,
            tu.full_name AS teacher,
            CONVERT(VARCHAR(5), cls.start_time, 108) as start_time,
            CONVERT(VARCHAR(5), cls.end_time, 108) as end_time,
            cls.weekly_schedule,
            s.schedule_date AS extra_date,
            s.start_time AS extra_start,
            s.end_time AS extra_end,
            co.start_date AS course_start,
            co.end_date AS course_end
          FROM students st
          JOIN enrollments e ON st.id = e.student_id
          JOIN classes cls ON e.class_id = cls.id
          JOIN courses co ON cls.course_id = co.id
          JOIN teachers t ON cls.teacher_id = t.id
          JOIN users tu ON t.user_id = tu.id
          LEFT JOIN schedules s ON cls.id = s.class_id
            AND s.schedule_date BETWEEN ? AND ?
          WHERE st.user_id = ?
            AND co.start_date <= ?
            AND co.end_date >= ?
        `;
        params = [days[0].iso, days[6].iso, userId, days[6].iso, days[0].iso];
    } else if (role === "teacher") {
      query = `
        SELECT
          cls.id as class_id,
          cls.class_name,
          co.course_name,
          tu.full_name AS teacher,
          CONVERT(VARCHAR(5), cls.start_time, 108) as start_time,
          CONVERT(VARCHAR(5), cls.end_time, 108) as end_time,
          cls.weekly_schedule,
          s.schedule_date AS extra_date,
          s.start_time AS extra_start,
          s.end_time AS extra_end,
          co.start_date AS course_start,
          co.end_date AS course_end
        FROM teachers t
        JOIN classes cls ON t.id = cls.teacher_id
        JOIN courses co ON cls.course_id = co.id
        JOIN users tu ON t.user_id = tu.id
        LEFT JOIN schedules s ON cls.id = s.class_id
          AND s.schedule_date BETWEEN ? AND ?
        WHERE t.user_id = ?
          AND co.start_date <= ?
          AND co.end_date >= ?
      `;
      params = [days[0].iso, days[6].iso, userId, days[6].iso, days[0].iso];
    } else {
      const error = new Error("Unauthorized role");
      error.status = 403;
      throw error;
    }

    const executeQuery = require("./executeQueryservice");
    const rows = await executeQuery(query, params);

    const scheduleData = [];
    const periodMap = {}; // To track which periods are already filled

    // Helper function to convert time string to period number
    const timeToPeriod = (timeValue) => {
      // Xử lý cả Date object và string
      let hours, minutes;
      if (timeValue instanceof Date) {
        hours = timeValue.getHours();
        minutes = timeValue.getMinutes();
      } else if (typeof timeValue === "string") {
        [hours, minutes] = timeValue.split(":").map(Number);
      } else {
        // Fallback nếu có kiểu dữ liệu khác
        const timeStr = timeValue.toString();
        [hours, minutes] = timeStr.split(":").map(Number);
      }

      // Tính toán period dựa trên giờ bắt đầu là 7:00
      return Math.floor(hours - 7 + minutes / 60) + 1;
    };

    // Trong phần xử lý kết quả query
    const courseStart = rows.length > 0 ? rows[0].course_start : null;
    const courseEnd = rows.length > 0 ? rows[0].course_end : null;

    // Process regular weekly classes
    rows.forEach((row) => {
      if (row.weekly_schedule) {
        const weekDays = row.weekly_schedule.split(",").map(Number);

        weekDays.forEach((dayIndex) => {
          if (dayIndex >= 1 && dayIndex <= 7) {
            const startPeriod = timeToPeriod(row.start_time);
            const endPeriod = timeToPeriod(row.end_time);
            const dayIso = days[dayIndex - 1].iso; // Lấy ngày ISO tương ứng

            // Thêm từng tiết học vào scheduleData
            for (let period = startPeriod; period <= endPeriod; period++) {
              scheduleData.push({
                type: "regular",
                date: dayIso,
                startPeriod: period,
                endPeriod: period,
                className: row.class_name,
                courseName: row.course_name,
                teacher: row.teacher || "",
                classId: row.class_id,
              });
            }
          }
        });
      }

      // Process extra sessions
      if (row.extra_date) {
        const extraDate = new Date(row.extra_date).toISOString().slice(0, 10);
        const startPeriod = timeToPeriod(row.extra_start);
        const endPeriod = timeToPeriod(row.extra_end);

        for (let period = startPeriod; period <= endPeriod; period++) {
          const key = `${extraDate}-${period}`;

          if (!periodMap[key]) {
            scheduleData.push({
              type: "extra",
              date: extraDate,
              startPeriod: period,
              endPeriod: period,
              className: row.class_name,
              courseName: row.course_name,
              teacher: row.teacher || "",
              classId: row.class_id,
            });
            periodMap[key] = true;
          }
        }
      }
    });

    return {
      days,
      scheduleData,
      courseStart,
      courseEnd,
      weekStart: days[0].iso,
      prevWeekStart: new Date(new Date(monday).setDate(monday.getDate() - 7))
        .toISOString()
        .slice(0, 10),
      nextWeekStart: new Date(new Date(monday).setDate(monday.getDate() + 7))
        .toISOString()
        .slice(0, 10),
    };
  }

  // Update a schedule
  async updateSchedule(scheduleId, class_id, schedule_date, start_time, end_time, day_of_week) {
    return await ScheduleModel.updateSchedule(scheduleId, class_id, schedule_date, start_time, end_time, day_of_week);
  }

  // Get data for new schedule form (Alternative)
  async getNewScheduleFormDataAlt() {
    return await ScheduleModel.getNewScheduleFormDataAlt();
  }
}

module.exports = new SchedulesService();
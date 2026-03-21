const executeQuery = require("./executeQueryservice");

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatSchedule(weekly_schedule) {
  if (!weekly_schedule) return "No schedule set";
  return weekly_schedule
    .split(",")
    .map((day) => daysOfWeek[parseInt(day, 10) - 1])
    .join(", ");
}

async function getAllClasses() {
  const query = `
      SELECT 
        c.id, 
        c.class_name,
        c.weekly_schedule,
        co.course_name,
        u.full_name AS teacher_name,
        CONVERT(VARCHAR(5), c.start_time, 108) as formatted_start_time,
        CONVERT(VARCHAR(5), c.end_time, 108) as formatted_end_time,
        (SELECT COUNT(*) FROM enrollments WHERE class_id = c.id) as student_count
      FROM classes c
      JOIN courses co ON c.course_id = co.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      ORDER BY c.created_at DESC
    `;

  const classes = await executeQuery(query);

  classes.forEach((cls) => {
    cls.scheduleDisplay = formatSchedule(cls.weekly_schedule);
  });

  return classes;
}

async function updateClass(id, data) {
  const {
    class_name,
    course_id,
    teacher_id,
    start_time,
    end_time,
    weekly_days,
  } = data;

  if (
    !class_name ||
    !course_id ||
    !teacher_id ||
    !start_time ||
    !end_time ||
    !weekly_days
  ) {
    const error = new Error("Missing required fields");
    error.status = 400;
    throw error;
  }

  const weekly_schedule = Array.isArray(weekly_days)
    ? weekly_days.join(",")
    : weekly_days;

  const updateQuery = `
      UPDATE classes 
      SET class_name = ?,
          course_id = ?,
          teacher_id = ?,
          start_time = ?,
          end_time = ?,
          weekly_schedule = ?,
          updated_at = GETDATE()
      WHERE id = ?
    `;

  await executeQuery(updateQuery, [
    class_name,
    course_id,
    teacher_id,
    start_time,
    end_time,
    weekly_schedule,
    id,
  ]);

  return { success: true, redirect: "/classes" };
}

async function getClassEditData(id) {
  const classQuery = `
        SELECT 
          c.*, 
          CONVERT(varchar(5), c.start_time, 108) as formatted_start_time,
          CONVERT(varchar(5), c.end_time, 108) as formatted_end_time
        FROM classes c
        WHERE c.id = ?
      `;

  const courseQuery = `SELECT id, course_name FROM courses ORDER BY course_name`;
  const teacherQuery = `
        SELECT t.id, u.full_name 
        FROM teachers t
        JOIN users u ON t.user_id = u.id
        ORDER BY u.full_name`;

  const [classResult, courses, teachers] = await Promise.all([
    executeQuery(classQuery, [id]),
    executeQuery(courseQuery),
    executeQuery(teacherQuery),
  ]);

  if (!classResult.length) {
    const error = new Error("Class not found");
    error.status = 404;
    throw error;
  }

  const classItem = {
    ...classResult[0],
    course_id: classResult[0].course_id,
    teacher_id: classResult[0].teacher_id,
    class_name: classResult[0].class_name,
    formatted_start_time: classResult[0].formatted_start_time,
    formatted_end_time: classResult[0].formatted_end_time,
    weekly_schedule: classResult[0].weekly_schedule,
  };

  const courseList = courses.map((c) => ({ id: c.id, name: c.course_name }));
  const teacherList = teachers.map((t) => ({ id: t.id, name: t.full_name }));

  return { classItem, courses: courseList, teachers: teacherList };
}

async function deleteClass(id) {
  const checkQuery = `
        SELECT c.id, c.class_name, COUNT(e.id) as enrollment_count
        FROM classes c
        LEFT JOIN enrollments e ON c.id = e.class_id
        WHERE c.id = ?
        GROUP BY c.id, c.class_name
      `;

  const classInfo = await executeQuery(checkQuery, [id]);

  if (!classInfo.length) {
    const error = new Error("Class not found");
    error.status = 404;
    error.code = "CLASS_NOT_FOUND";
    throw error;
  }

  if (classInfo[0].enrollment_count > 0) {
    const error = new Error("Cannot delete class with active enrollments");
    error.status = 400;
    error.code = "HAS_ENROLLMENTS";
    error.details = {
      className: classInfo[0].class_name,
      enrollmentCount: classInfo[0].enrollment_count,
    };
    throw error;
  }

  await executeQuery("DELETE FROM schedules WHERE class_id = ?", [id]);
  await executeQuery("DELETE FROM classes WHERE id = ?", [id]);

  return { success: true, redirect: "/classes" };
}

async function createClass(data) {
  const {
    class_name,
    course_id,
    teacher_id,
    start_time,
    end_time,
    weekly_days,
  } = data;

  if (
    !class_name ||
    !course_id ||
    !teacher_id ||
    !start_time ||
    !end_time ||
    !weekly_days
  ) {
    const error = new Error("Missing required fields");
    error.status = 400;
    throw error;
  }

  const weekly_schedule = Array.isArray(weekly_days)
    ? weekly_days.join(",")
    : weekly_days;

  const courseQuery = `
      SELECT start_date, end_date 
      FROM courses 
      WHERE id = ?
    `;
  const courseResult = await executeQuery(courseQuery, [course_id]);

  if (!courseResult.length) {
    const error = new Error("Course not found");
    error.status = 404;
    throw error;
  }

  const conflictQuery = `
        SELECT c.class_name, c.weekly_schedule,
               CONVERT(VARCHAR(5), c.start_time, 108) as start_time,
               CONVERT(VARCHAR(5), c.end_time, 108) as end_time
        FROM classes c
        WHERE c.teacher_id = ?
          AND c.start_time < ?
          AND c.end_time > ?
      `;

  const potentialConflicts = await executeQuery(conflictQuery, [
    teacher_id,
    end_time,
    start_time,
  ]);

  const newDays = Array.isArray(weekly_days)
    ? weekly_days.map(String)
    : [String(weekly_days)];

  const teacherConflicts = potentialConflicts.filter((existingClass) => {
    if (!existingClass.weekly_schedule) return false;
    const existingDays = existingClass.weekly_schedule.split(",");
    return newDays.some((newDay) => existingDays.includes(newDay));
  });

  if (teacherConflicts.length > 0) {
    const error = new Error(
      `Schedule Conflict: The selected teacher is already assigned to another class during the chosen time and day. Conflicting class: ${teacherConflicts[0].class_name}`
    );
    error.status = 409;
    throw error;
  }

  const query = `
      INSERT INTO classes (
        class_name, 
        course_id, 
        teacher_id, 
        start_time, 
        end_time, 
        weekly_schedule,
        created_at, 
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
    `;

  await executeQuery(query, [
    class_name,
    course_id,
    teacher_id,
    start_time,
    end_time,
    weekly_schedule,
  ]);

  return { success: true, redirect: "/classes" };
}

async function getNewClassFormData() {
  const courseQuery = "SELECT id, course_name FROM courses ORDER BY course_name";
  const teacherQuery = `
        SELECT t.id, u.full_name 
        FROM teachers t
        JOIN users u ON t.user_id = u.id
        ORDER BY u.full_name
      `;
  const [courses, teachers] = await Promise.all([
    executeQuery(courseQuery),
    executeQuery(teacherQuery),
  ]);

  return { courses, teachers };
}

async function getClassStudents(id) {
  const classQuery = `
        SELECT 
          c.id, 
          c.class_name,
          co.course_name,
          u.full_name AS teacher_name
        FROM classes c
        JOIN courses co ON c.course_id = co.id
        JOIN teachers t ON c.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE c.id = ?
      `;

  const classInfo = await executeQuery(classQuery, [id]);
  if (!classInfo.length) {
    const error = new Error("Class not found.");
    error.status = 404;
    throw error;
  }

  const studentsQuery = `
        SELECT 
          u.full_name,
          u.email,
          u.phone_number,
          e.enrollment_date,
          e.payment_status,
          e.payment_date
        FROM enrollments e
        JOIN students s ON e.student_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE e.class_id = ?
        ORDER BY u.full_name
      `;

  const students = await executeQuery(studentsQuery, [id]);
  return { classInfo: classInfo[0], students };
}

module.exports = {
  getAllClasses,
  updateClass,
  getClassEditData,
  deleteClass,
  createClass,
  getNewClassFormData,
  getClassStudents,
};

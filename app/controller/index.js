var express = require("express");
var router = express.Router();

// Admin-Teacher Controllers
router.use(require(__dirname + "/admin-teacher/admin-only/adminOnlyApiCoursesController"));
router.use(require(__dirname + "/admin-teacher/admin-only/adminOnlyApiUsersController"));
router.use(require(__dirname + "/admin-teacher/admin-only/adminOnlyCoursesController"));
router.use(require(__dirname + "/admin-teacher/admin-only/adminOnlyEnrollmentsController"));
router.use(require(__dirname + "/admin-teacher/admin-only/adminOnlyMiscController"));
router.use(require(__dirname + "/admin-teacher/admin-only/adminOnlyScheduleController"));
router.use(require(__dirname + "/admin-teacher/admin-only/adminOnlyUsersController"));
router.use(require(__dirname + "/admin-teacher/teacher-only/teacherOnlyExamController"));
router.use(require(__dirname + "/admin-teacher/adminTeacherClassesController"));
router.use(require(__dirname + "/admin-teacher/adminTeacherCoursesController"));
router.use(require(__dirname + "/admin-teacher/adminTeacherMaterialController"));
router.use(require(__dirname + "/admin-teacher/adminTeacherMaterialsController"));
router.use(require(__dirname + "/admin-teacher/adminTeacherNotificationsController"));
router.use(require(__dirname + "/admin-teacher/adminTeacherUploadMaterialController"));
router.use(require(__dirname + "/admin-teacher/adminTeacherRequestController"));

// Main Controllers
router.use(require(__dirname + "/classesController"));
router.use(require(__dirname + "/coursesController"));
router.use(require(__dirname + "/enrollmentsController"));
router.use(require(__dirname + "/examController"));
router.use(require(__dirname + "/materialController"));
router.use(require(__dirname + "/materialsController"));
router.use(require(__dirname + "/MiscController"));
router.use(require(__dirname + "/notificationsController"));
router.use(require(__dirname + "/requestController"));
router.use(require(__dirname + "/scheduleController"));
router.use(require(__dirname + "/upload-materialController"));
router.use(require(__dirname + "/usersController"));

// API Controllers
router.use("/api", require(__dirname + "/admin-teacher/adminTeacherApiCoursesController"));
router.use("/api", require(__dirname + "/admin-teacher/adminTeacherApiMaterialController"));
router.use("/api", require(__dirname + "/admin-teacher/adminTeacherApiMaterialsController"));
router.use("/api", require(__dirname + "/admin-teacher/adminTeacherApiNotificationsController"));
router.use("/api", require(__dirname + "/api/apiclassesController"));
router.use("/api", require(__dirname + "/api/apicoursesController"));
router.use("/api", require(__dirname + "/api/apienrollmentsController"));
router.use("/api", require(__dirname + "/api/apiexamController"));
router.use("/api", require(__dirname + "/api/apimaterialController"));
router.use("/api", require(__dirname + "/api/apimaterialsController"));
router.use("/api", require(__dirname + "/api/apiMiscController"));
router.use("/api", require(__dirname + "/api/apinotificationsController"));
router.use("/api", require(__dirname + "/api/apirequestController"));
router.use("/api", require(__dirname + "/api/apischeduleController"));
router.use("/api", require(__dirname + "/api/apiupload-materialController"));
router.use("/api", require(__dirname + "/api/apiusersController"));


module.exports = router;

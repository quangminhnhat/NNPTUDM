var express = require("express");
var router = express.Router();

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

//lib import
const express = require("express");
const { authenticateRole } = require("../middleware/roleAuth");
const { checkAuthenticated } = require("../middleware/auth");

const router = express.Router();

// All admin and teacher routes moved to admin-teacher/adminTeacherRequestController.js

module.exports = router;

//lib import
const express = require("express");
const { authenticateRole } = require("../service/roleAuth");
const { checkAuthenticated } = require("../service/auth");

const router = express.Router();

// All admin and teacher routes moved to admin-teacher/adminTeacherRequestController.js

module.exports = router;

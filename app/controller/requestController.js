//lib import
const express = require("express");
const { authenticateRole } = require("../service/roleAuthservice");
const { checkAuthenticated } = require("../service/authservice");

const router = express.Router();

// All admin and teacher routes moved to admin-teacher/adminTeacherRequestController.js

module.exports = router;

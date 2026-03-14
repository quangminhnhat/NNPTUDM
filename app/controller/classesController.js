const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../middleware/roleAuth");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../middleware/executeQuery");
const {
  checkAuthenticated,
} = require("../middleware/auth");
const router = express.Router();

// All admin and teacher routes moved to admin-teacher/adminTeacherClassesController.js

module.exports = router;
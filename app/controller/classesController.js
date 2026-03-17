const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../service/roleAuthservice");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../service/executeQueryservice");
const {
  checkAuthenticated,
} = require("../service/authservice");
const router = express.Router();

// All admin and teacher routes moved to admin-teacher/adminTeacherClassesController.js

module.exports = router; 
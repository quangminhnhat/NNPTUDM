const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../service/roleAuth");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../service/executeQuery");
const {
  checkAuthenticated,
} = require("../service/auth");
const router = express.Router();

// All admin and teacher routes moved to admin-teacher/adminTeacherClassesController.js

module.exports = router; 
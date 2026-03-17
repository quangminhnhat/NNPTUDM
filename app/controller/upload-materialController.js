const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../service/roleAuthservice");
const connectionString = process.env.CONNECTION_STRING; 
const upload = require("../service/uploadservice");
const courseImageUpload = require("../service/courseImageUploadservice");
const {
  checkAuthenticated,
} = require("../service/authservice");
const router = express.Router();
// All admin and teacher routes moved to admin-teacher/adminTeacherUploadMaterialController.js

module.exports = router;
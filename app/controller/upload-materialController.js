const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../service/roleAuth");
const connectionString = process.env.CONNECTION_STRING; 
const upload = require("../service/upload");
const courseImageUpload = require("../service/courseImageUpload");
const {
  checkAuthenticated,
} = require("../service/auth");
const router = express.Router();
// All admin and teacher routes moved to admin-teacher/adminTeacherUploadMaterialController.js

module.exports = router;
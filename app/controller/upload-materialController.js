const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../middleware/roleAuth");
const connectionString = process.env.CONNECTION_STRING; 
const upload = require("../middleware/upload");
const courseImageUpload = require("../middleware/courseImageUpload");
const {
  checkAuthenticated,
} = require("../middleware/auth");
const router = express.Router();
// All admin and teacher routes moved to admin-teacher/adminTeacherUploadMaterialController.js

module.exports = router;
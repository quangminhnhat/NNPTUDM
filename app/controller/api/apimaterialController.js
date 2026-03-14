const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const upload = require("../../middleware/upload");
const executeQuery = require("../../middleware/executeQuery");
const { authenticateRole } = require("../../middleware/roleAuth");

// You may need to import your authentication middleware
const {
  checkAuthenticated,
} = require("../../middleware/auth");

// All admin and teacher routes moved to admin-teacher/adminTeacherApiMaterialController.js

module.exports = router;

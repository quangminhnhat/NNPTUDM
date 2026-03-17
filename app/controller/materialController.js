const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const upload = require("../service/uploadservice");
const executeQuery = require("../service/executeQueryservice");
const { authenticateRole } = require("../service/roleAuthservice");

// You may need to import your authentication middleware
const {
  checkAuthenticated,
} = require("../service/authservice");

// All admin and teacher routes moved to admin-teacher/adminTeacherMaterialController.js

module.exports = router;
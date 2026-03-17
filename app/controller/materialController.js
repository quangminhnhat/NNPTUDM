const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const upload = require("../service/upload");
const executeQuery = require("../service/executeQuery");
const { authenticateRole } = require("../service/roleAuth");

// You may need to import your authentication middleware
const {
  checkAuthenticated,
} = require("../service/auth");

// All admin and teacher routes moved to admin-teacher/adminTeacherMaterialController.js

module.exports = router;
const express = require("express");
const { authenticateRole } = require("../middleware/roleAuth");
const { checkAuthenticated } = require("../middleware/auth");
const router = express.Router();

// Render-only routes - all CRUD operations delegated to API endpoints

// All admin routes moved to admin-teacher/adminTeacherEnrollmentsController.js

module.exports = router;

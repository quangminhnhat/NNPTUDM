const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../middleware/roleAuth");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING; 
const upload = require("../middleware/upload");
const executeQuery = require("../middleware/executeQuery");
const {
  checkAuthenticated,
} = require("../middleware/auth");
const router = express.Router();


router.get(
  "/materials",
  checkAuthenticated,
  async (req, res) => {
    try {
     
      res.render("materials/materials", { user: req.user });
    } catch (error) {
      console.error("Fetch materials error:", error);
      res.status(500).send("Database error");
    }
  }
);

// All admin and teacher routes moved to admin-teacher/adminTeacherMaterialsController.js

module.exports = router;
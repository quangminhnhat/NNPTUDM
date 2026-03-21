const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const upload = require("../../service/uploadservice");
const executeQuery = require("../../service/executeQueryservice");
const materialsService = require("../../service/materialsService");
const { authenticateRole } = require("../../service/roleAuthservice");

// You may need to import your authentication middleware
const {
  checkAuthenticated,
} = require("../../service/authservice");

router.post(
  "/upload-material",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  upload.single("material"),
  async (req, res) => {
    try {
      const { course_id } = req.body;
      const file = req.file;

      // Input validation
      if (!course_id || !file) {
        return res.status(400).json({
          error: "Missing required fields",
          details: {
            course_id: !course_id ? "Missing course ID" : null,
            file: !file ? "No file uploaded" : null,
          },
        });
      }

      await materialsService.uploadMaterial(course_id, file);
      res.redirect("/materials");
    } catch (error) {
      console.error("Material upload error:", error);

      // Delete uploaded file if database insert fails
      if (req.file) {
        const filePath = path.join(__dirname, "..", "uploads", req.file.filename);
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      res.status(500).json({
        error: "Failed to upload material",
        details: error.message,
      });
    }
  }
);

module.exports = router;
const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const connectionString = process.env.CONNECTION_STRING;
const upload = require("../../service/uploadservice");
const courseImageUpload = require("../../service/courseImageUploadservice");
const {
  checkAuthenticated,
} = require("../../service/authservice");
const adminTeacherUploadMaterialService = require("../../service/adminTeacherUploadMaterialService");
const router = express.Router();

router.post(
  "/upload-material",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  upload.single("material"),
  async (req, res) => {
    try {
      const { course_id } = req.body;
      const result = await adminTeacherUploadMaterialService.uploadMaterial(course_id, req.file, connectionString);
      res.send(result.message);
    } catch (error) {
      console.error("Upload material error:", error);
      res.status(error.statusCode || 500).send(error.message);
    }
  }
);

module.exports = router;
const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const upload = require("../../service/uploadservice");
const executeQuery = require("../../service/executeQueryservice");
const materialsService = require("../../service/materialsService");
const {
  checkAuthenticated,
} = require("../../service/authservice");
const router = express.Router();


router.get(
  "/materials/:id/edit",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const materialId = req.params.id;
      const data = await materialsService.getMaterialForEdit(materialId);

      res.render("materials/editMaterial", {
        user: req.user,
        material: data.material,
        courses: data.courses,
      });
    } catch (error) {
      console.error("Error loading material edit form:", error);
      res.status(500).send("Error loading material edit form");
    }
  }
);

router.post(
  "/materials/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  upload.single("material"),
  async (req, res) => {
    try {
      const materialId = req.params.id;
      const { course_id } = req.body;
      const file = req.file;

      await materialsService.updateMaterial(materialId, course_id, file);
      res.redirect("/materials");
    } catch (error) {
      console.error("Error updating material:", error);

      // Delete uploaded file if there was an error
      if (req.file) {
        const filePath = path.join(__dirname, "uploads", req.file.filename);
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      res.status(500).send("Failed to update material");
    }
  }
);


router.delete(
  "/materials/:id",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    const materialId = req.params.id;
    try {
      await materialsService.deleteMaterial(materialId);
      req.flash("success", "Material deleted successfully.");
      res.redirect("/materials");
    } catch (error) {
      console.error("Error deleting material:", error);
      req.flash("error", error.message || "Failed to delete material.");
      res.redirect("/materials");
    }
  }
);

router.get(
  "/upload",
  authenticateRole(["admin", "teacher"]),
  checkAuthenticated,
  async (req, res) => {
    try {
      const data = await materialsService.getCoursesForUpload();
      res.render("materials/uploadMaterial", {
        user: req.user,
        courses: data.courses
      });
    } catch (error) {
      console.error("Error loading upload material page:", error);
      res.status(500).send("Error loading page data.");
    }
  }
);

module.exports = router;
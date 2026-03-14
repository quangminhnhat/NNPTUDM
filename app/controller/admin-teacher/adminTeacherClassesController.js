const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../middleware/roleAuth");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../../middleware/executeQuery");
const {
  checkAuthenticated,
} = require("../../middleware/auth");
const router = express.Router();


router.get(
  "/classes",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      // Just render the view - data will be loaded via API
      res.render("class/classes", { user: req.user });
    } catch (err) {
      console.error("Fetch classes error:", err);
      res.status(500).send("Error loading classes");
    }
  }
);


router.get(
  "/classes/:id/edit",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      // Just render the view - data will be loaded via API
      res.render("class/editClass.ejs", { user: req.user });
    } catch (error) {
      console.error("Error loading class edit form:", error);
      res.status(500).send("Error loading class edit form");
    }
  }
);


router.get(
  "/classes/new",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      // Just render the form - data will be loaded via API
      res.render("class/addClass", {
        user: req.user,
        messages: {
          error: req.flash("error"),
          success: req.flash("success"),
        },
      });
    } catch (err) {
      console.error("Error loading new class form:", err);
      res.status(500).send("Error loading form data");
    }
  }
);

router.get(
  "/classes/:id/students",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      // Just render the view - data will be loaded via API
      res.render("class/classStudents", { user: req.user });
    } catch (error) {
      console.error("Error loading class students view:", error);
      res.status(500).send("Error loading student list.");
    }
  }
);

module.exports = router;
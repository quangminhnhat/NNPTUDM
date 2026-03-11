//lib import
const express = require("express");
const { authenticateRole } = require("../middleware/roleAuth");
const { checkAuthenticated } = require("../middleware/auth");

const router = express.Router();

// Render-only routes - all CRUD operations delegated to API endpoints

// Render requests list page
router.get(
  "/requests",
  checkAuthenticated,
  authenticateRole(["student", "teacher", "admin"]),
  (req, res) => {
    res.render("request/requestsindex", {
      user: req.user,
    });
  }
);

// Render new request form
router.get(
  "/requests/new",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  (req, res) => {
    res.render("request/requestsnew", {
      user: req.user,
      title: "New Request",
    });
  }
);

// Render edit request form
router.get(
  "/requests/:requestId/edit",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  (req, res) => {
    res.render("request/requestsedit", {
      user: req.user,
      title: "Edit Request",
    });
  }
);

module.exports = router;

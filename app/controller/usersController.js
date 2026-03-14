const express = require("express");
const { authenticateRole } = require("../middleware/roleAuth");
const { checkAuthenticated } = require("../middleware/auth");
const router = express.Router();

// Render-only routes: all CRUD logic moved to /api/usersRoutes.js

router.get("/users/:id/edit", checkAuthenticated, (req, res) => {
  res.render("user/editUser", { user: req.user });
});

router.get("/profile", checkAuthenticated, (req, res) => {
  res.render("user/profile", { user: req.user });
});

module.exports = router;

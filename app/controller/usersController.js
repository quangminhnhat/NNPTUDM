const express = require("express");
const { authenticateRole } = require("../service/roleAuth");
const { checkAuthenticated } = require("../service/auth");
const router = express.Router();

// Render-only routes: all CRUD logic moved to /api/usersRoutes.js

router.get("/users/:id/edit", checkAuthenticated, (req, res) => {
  res.render("user/editUser", { user: req.user });
});

router.get("/profile", checkAuthenticated, (req, res) => {
  res.render("user/profile", { user: req.user });
});

module.exports = router;

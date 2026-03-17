const express = require("express");
const { authenticateRole } = require("../../service/roleAuthservice");
const { checkAuthenticated } = require("../../service/authservice");
const router = express.Router();

// Admin-only routes for users

router.get(
  "/users",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("userList", { user: req.user });
  }
);

module.exports = router;
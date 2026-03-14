const express = require("express");
const { authenticateRole } = require("../../../middleware/roleAuth");
const { checkAuthenticated } = require("../../../middleware/auth");
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
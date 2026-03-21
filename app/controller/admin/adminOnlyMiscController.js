const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const { authenticateRole } = require("../../service/roleAuthservice");
const multer = require("multer");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const upload = require("../../service/uploadservice");
const courseImageUpload = require("../../service/courseImageUploadservice");
const executeQuery = require("../../service/executeQueryservice");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../../service/authservice");
const adminMiscService = require("../../service/adminMiscService");
const router = express.Router();


router.get(
  "/register",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.render("register.ejs", {
      user: req.user,
    });
  }
);

router.post(
  "/register",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      console.log("Hitting registration endpoint with body:", req.body);
      const result = await adminMiscService.registerUser(req.body, connectionString);
      res.redirect("/login");
    } catch (error) {
      console.error("Registration error:", error);
      res.status(error.statusCode || 500).send(error.message);
    }
  }
);

module.exports = router;
const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcrypt");
const sql = require("msnodesqlv8");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const { authenticateRole } = require("../middleware/roleAuth");
const multer = require("multer");
const fs = require("fs");
const connectionString = process.env.CONNECTION_STRING;
const upload = require("../middleware/upload");
const courseImageUpload = require("../middleware/courseImageUpload");
const executeQuery = require("../middleware/executeQuery");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../middleware/auth");
const router = express.Router();


const mapRole = {
  subject1: "student",
  subject2: "teacher",
  subject3: "admin",
};

router.get("/download/:id", async (req, res) => {
  try {
    const materialId = req.params.id;
    const query = "SELECT file_name, file_path FROM materials WHERE id = ?";
    const result = await executeQuery(query, [materialId]);
    if (!result.length) {
      return res.status(404).send("File not found");
    }
    const filePath = path.join(__dirname, "..", result[0].file_path);
    res.download(filePath, result[0].file_name);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).send("Download failed");
  }
});


router.get("/", async (req, res) => {
  try {
    res.render("index.ejs", { user: req.user });
  } catch (error) {
    console.error("Error loading homepage courses:", error);
    res.render("index.ejs", { user: req.user });
  }
});

router.get("/school", (req, res) => {
  res.render("school.ejs", { user: req.user });
});

router.get("/news", (req, res) => {
  res.render("news.ejs", { user: req.user });
});





module.exports = router;

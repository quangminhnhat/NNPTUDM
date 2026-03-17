const express = require("express");
const app = express();
const path = require("path");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const { authenticateRole } = require("../../service/roleAuthservice");
const multer = require("multer");
const fs = require("fs");
const upload = require("../../service/uploadservice");
const courseImageUpload = require("../../service/courseImageUploadservice");
const executeQuery = require("../../service/executeQueryservice");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../../service/authservice");
const miscService = require("../../service/miscService");
const router = express.Router();

/**
 * @swagger
 * /api/download/{id}:
 *   get:
 *     summary: Download material by ID
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Material ID
 *     responses:
 *       200:
 *         description: File download
 *       404:
 *         description: Material not found
 *       500:
 *         description: Download error
 */
router.get("/download/:id", checkAuthenticated, async (req, res) => {
  try {
    const materialId = req.params.id;
    const material = await miscService.getMaterialById(materialId);
    if (!material) {
      return res.status(404).send("File not found");
    }
    const filePath = path.join(__dirname, "..", material.file_path);
    res.download(filePath, material.file_name);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).send("Download failed");
  }
});


/**
 * @swagger
 * /api/:
 *   get:
 *     summary: Get homepage courses
 *     tags: [Misc]
 *     responses:
 *       200:
 *         description: List of courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 courses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       course_desc:
 *                         type: string
 *                       img:
 *                         type: string
 *                       link:
 *                         type: string
 */
router.get("/", async (req, res) => {
  try {
    const courses = await miscService.getHomepageCourses();
    res.json({ user: req.user, courses });
  } catch (error) {
    console.error("Error loading homepage courses:", error);
    res.json({ user: req.user, courses: [] });
  }
});

/**
 * @swagger
 * /api/school:
 *   get:
 *     summary: Get school info
 *     tags: [Misc]
 *     responses:
 *       200:
 *         description: School info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 */
router.get("/school", (req, res) => {
  res.json({ user: req.user });
});

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: Get news info
 *     tags: [Misc]
 *     responses:
 *       200:
 *         description: News info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 */
router.get("/news", (req, res) => {
  res.json({ user: req.user });
});





/**
 * @swagger
 * /api/register:
 *   get:
 *     summary: Get registration info (Admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Registration info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/register",
  checkAuthenticated,
  authenticateRole("admin"),
  (req, res) => {
    res.json({
      user: req.user,
    });
  }
);

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Register a new user (Admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Name
 *               - fullName
 *               - email
 *               - birthday
 *               - phone
 *               - Address
 *               - subject
 *               - Password
 *             properties:
 *               Name:
 *                 type: string
 *                 description: Username
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               birthday:
 *                 type: string
 *                 format: date
 *               phone:
 *                 type: string
 *               Address:
 *                 type: string
 *               subject:
 *                 type: string
 *                 enum: [subject1, subject2, subject3]
 *                 description: Role mapping (subject1=student, subject2=teacher, subject3=admin)
 *               salary:
 *                 type: number
 *                 description: Required for teachers (subject2)
 *               Password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Registration successful
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post(
  "/register",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      console.log("Hitting registration endpoint with body:", req.body);
      const {
        Name: username,
        fullName,
        email,
        birthday: birth,
        phone,
        Address: address,
        subject,
        salary,
        Password,
      } = req.body;

      const message = await miscService.registerUser({
        username,
        fullName,
        email,
        birth,
        phone,
        address,
        subject,
        salary,
        password: Password,
      });

      // For API consumers (including fetch), always return JSON.
      return res.json({ success: true, message });
    } catch (error) {
      console.error("Error during registration:", error);
      return res.status(400).send(error.message);
    }
  }
);



module.exports = router;

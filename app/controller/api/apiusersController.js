const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../../service/executeQueryservice");
const { checkAuthenticated } = require("../../service/authservice");
const usersService = require("../../service/usersService");
const router = express.Router();
const profilePicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/profile_pic";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      `user-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});
const profilePicUpload = multer({ storage: profilePicStorage });

/**
 * @swagger
 * /api/users/{id}/edit:
 *   get:
 *     summary: Get user details for editing
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get("/users/:id/edit", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id;

    const data = await usersService.getUserForEdit(userId);

    res.json({
      user: req.user,
      ...data,
      messages: {
        error: req.flash("error"),
        success: req.flash("success"),
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(error.status || 500).json({ error: error.message || "Error loading user data" });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   post:
 *     summary: Update user details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [student, teacher, admin]
 *               full_name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone_number:
 *                 type: string
 *               salary:
 *                 type: number
 *               address:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               profile_pic:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User updated successfully
 *       500:
 *         description: Server error
 */
router.post(
  "/users/:id",
  checkAuthenticated,
  profilePicUpload.single("profile_pic"),
  async (req, res) => {
    try {
      const {
        username,
        role,
        full_name,
        email,
        phone_number,
        salary,
        address,
        date_of_birth,
      } = req.body;
      const userId = req.params.id;

      const result = await usersService.updateUser(userId, {
        username,
        role,
        full_name,
        email,
        phone_number,
        salary,
        address,
        date_of_birth,
      }, req.file);

      if (req.user.role !== "admin" || userId == req.user.id) {
        return res.json({ ...result, redirect: "/profile" });
      } else {
        return res.json({ ...result, redirect: "/users" });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(error.status || 500).json({
        error: error.message || "An unexpected error occurred.",
        detail: String(error)
      });
    }
  }
);

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 details:
 *                   type: object
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server error
 */
router.get("/profile", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;

    const data = await usersService.getUserProfile(userId);

    res.json({
      user: req.user,
      ...data,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(error.status || 500).json({ error: error.message || "Error fetching profile data." });
  }
});

module.exports = router;

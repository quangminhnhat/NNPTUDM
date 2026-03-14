const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../middleware/roleAuth");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../../middleware/executeQuery");
const { checkAuthenticated } = require("../../middleware/auth");
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
    const query = `
          SELECT u.id, u.username, u.role, u.full_name, u.email, u.phone_number, u.profile_pic, t.salary, u.address, CONVERT(varchar(10), u.date_of_birth, 23) as date_of_birth
          FROM users u
          LEFT JOIN teachers t ON u.id = t.user_id
          WHERE u.id = ?
        `;

    const result = await executeQuery(query, [userId]);

    if (!result.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: req.user,
      editUser: result[0],
      messages: {
        error: req.flash("error"),
        success: req.flash("success"),
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Error loading user data" });
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
    let connection;

    try {
      connection = await sql.promises.open(connectionString);
      await connection.promises.beginTransaction();

      const roleResult = await connection.promises.query(
        "SELECT role, profile_pic FROM users WHERE id = ?",
        [userId]
      );
      
      if (!roleResult.first || roleResult.first.length === 0) {
        await connection.promises.rollback();
        return res.status(404).json({ error: "User not found." });
      }
      
      const currentUserData = roleResult.first[0];
      const oldRole = currentUserData?.role;

      let newProfilePicPath = currentUserData?.profile_pic;
      if (req.file) {
        newProfilePicPath = req.file.path.replace(/\\/g, '/'); // Use forward slashes for consistency
        const oldPicPath = currentUserData?.profile_pic;
        if (oldPicPath && fs.existsSync(oldPicPath)) {
          fs.unlink(oldPicPath, (err) => {
            if (err) console.error("Error deleting old profile picture:", err);
          });
        }
      }

      let updateQueryParts = [
        "username = ?",
        "full_name = ?",
        "email = ?",
        "phone_number = ?",
        "address = ?",
        "date_of_birth = ?",
        "profile_pic = ?",
        "updated_at = GETDATE()",
      ];
      let queryParams = [
        username,
        full_name || null,
        email || null,
        phone_number || null,
        address || null,
        date_of_birth || null,
        newProfilePicPath,
      ];

      if (role && role !== oldRole) {
        updateQueryParts.push("role = ?");
        queryParams.push(role);
      }

      queryParams.push(userId);

      const updateUserQuery = `UPDATE users SET ${updateQueryParts.join(
        ", "
      )} WHERE id = ?`;
      await connection.promises.query(updateUserQuery, queryParams);
      
      if (role && oldRole !== role) {
        if (oldRole === "student") {
          const studentDepsQuery = `
            SELECT s.id 
            FROM students s
            JOIN enrollments e ON s.id = e.student_id
            WHERE s.user_id = ?
          `;
          const studentDeps = await connection.promises.query(studentDepsQuery, [userId]);
          if (studentDeps.first && studentDeps.first.length > 0) {
            await connection.promises.rollback();
            return res.status(400).json({ error: "Cannot change role. This student is enrolled in one or more classes. Please unenroll them first." });
          }
        }

        await connection.promises.query(
          "DELETE FROM students WHERE user_id = ?",
          [userId]
        );
        await connection.promises.query(
          "DELETE FROM teachers WHERE user_id = ?",
          [userId]
        );
        await connection.promises.query(
          "DELETE FROM admins WHERE user_id = ?",
          [userId]
        );

        if (role === "student") {
          await connection.promises.query(
            "INSERT INTO students (user_id) VALUES (?)",
            [userId]
          );
        } else if (role === "teacher") {
          await connection.promises.query(
            "INSERT INTO teachers (user_id, salary) VALUES (?, ?)",
            [userId, salary || 0]
          );
        } else if (role === "admin") {
          await connection.promises.query(
            "INSERT INTO admins (user_id) VALUES (?)",
            [userId]
          );
        }
      } else {
        if (oldRole === "teacher" && salary !== undefined) {
          await connection.promises.query(
            "UPDATE teachers SET salary = ? WHERE user_id = ?",
            [salary, userId]
          );
        }
      }

      await connection.promises.commit();

      if (req.user.role !== "admin" || userId == req.user.id) {
        return res.json({ success: true, redirect: "/profile" });
      } else {
        return res.json({ success: true, redirect: "/users" });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting uploaded file after failed update:", err);
        });
      }
      if (connection) {
        await connection.promises.rollback();
      }
      res.status(500).json({ error: "An unexpected error occurred.", detail: String(error) });
    } finally {
      if (connection) {
        await connection.promises.close();
      }
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

    const query = `
      SELECT id, username, role, full_name, email, phone_number, address, profile_pic, CONVERT(varchar(10), date_of_birth, 23) as date_of_birth, created_at, updated_at
      FROM users
      WHERE id = ?
    `;

    const [details] = await executeQuery(query, [userId]);

    if (!details) {
      return res.status(404).json({ error: "Profile not found." });
    }

    res.json({
      user: req.user,
      details: details,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Error fetching profile data." });
  }
});

module.exports = router;

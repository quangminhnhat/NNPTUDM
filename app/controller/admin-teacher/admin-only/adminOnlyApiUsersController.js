const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../../middleware/roleAuth");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../../../middleware/executeQuery");
const { checkAuthenticated } = require("../../../middleware/auth");
const router = express.Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                 user:
 *                   type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/users",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    try {
      const query = `
      SELECT u.id, u.username, u.role, u.created_at, u.updated_at,
             u.full_name, u.email, u.phone_number AS phone
      FROM users u
      ORDER BY u.created_at DESC;
    `;
      const users = await executeQuery(query);
      res.json({ users: users, user: req.user });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Database error while fetching users." });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user (Admin only)
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
 *         description: User deleted successfully
 *       400:
 *         description: Cannot delete user (dependencies or self-deletion)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/users/:id",
  checkAuthenticated,
  authenticateRole("admin"),
  async (req, res) => {
    const userIdToDelete = req.params.id;
    const adminUserId = req.user.id;

    if (userIdToDelete == adminUserId) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }

    let connection;
    try {
      connection = await sql.promises.open(connectionString);
      await connection.promises.beginTransaction();

      const userResult = await connection.promises.query(
        "SELECT role FROM users WHERE id = ?",
        [userIdToDelete]
      );
      if (!userResult.first || userResult.first.length === 0) {
        await connection.promises.rollback();
        return res.status(404).json({ error: "User not found." });
      }
      const userRole = userResult.first[0].role;

      if (userRole === "student") {
        const studentDeps = await connection.promises.query(
          `
        SELECT
          (SELECT COUNT(*) FROM enrollments e JOIN students s ON e.student_id = s.id WHERE s.user_id = ?) as enrollment_count,
          (SELECT COUNT(*) FROM Attempts a JOIN students s ON a.student_id = s.id WHERE s.user_id = ?) as attempt_count
      `,
          [userIdToDelete, userIdToDelete]
        );

        if (
          studentDeps.first[0].enrollment_count > 0 ||
          studentDeps.first[0].attempt_count > 0
        ) {
          await connection.promises.rollback();
          return res.status(400).json({ error: "Cannot delete student with existing enrollments or exam attempts." });
        }
      } else if (userRole === "teacher") {
        const teacherDeps = await connection.promises.query(
          "SELECT COUNT(*) as class_count FROM classes c JOIN teachers t ON c.teacher_id = t.id WHERE t.user_id = ?",
          [userIdToDelete]
        );
        if (teacherDeps.first[0].class_count > 0) {
          await connection.promises.rollback();
          return res.status(400).json({ error: "Cannot delete teacher assigned to active classes." });
        }
      }

      await connection.promises.query("DELETE FROM users WHERE id = ?", [
        userIdToDelete,
      ]);
      await connection.promises.commit();

      res.json({ success: true, message: "User deleted successfully." });
    } catch (error) {
      console.error("Error deleting user:", error);
      if (connection) await connection.promises.rollback();
      res.status(500).json({ error: "Failed to delete user due to a server error." });
    } finally {
      if (connection) await connection.promises.close();
    }
  }
);

module.exports = router;
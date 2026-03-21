const express = require("express");
const sql = require("msnodesqlv8");
const { authenticateRole } = require("../../service/roleAuthservice");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const connectionString = process.env.CONNECTION_STRING;
const executeQuery = require("../../service/executeQueryservice");
const { checkAuthenticated } = require("../../service/authservice");
const adminUsersService = require("../../service/adminUsersService");
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
      const users = await adminUsersService.getAllUsers();
      res.json({ users: users, user: req.user });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: error.message });
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
    try {
      const userIdToDelete = req.params.id;
      const adminUserId = req.user.id;
      const result = await adminUsersService.deleteUser(userIdToDelete, adminUserId, connectionString);
      res.json(result);
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
);

module.exports = router;
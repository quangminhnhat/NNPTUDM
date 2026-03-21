//lib import
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
const requestsService = require("../../service/requestsService");
const {
  checkAuthenticated,
  checkNotAuthenticated,
} = require("../../service/authservice");
const validateSchedule = require("../../service/validateScheduleservice");

const router = express.Router();

// Render request list page
/**
 * @swagger
 * /api/requests:
 *   get:
 *     summary: Get requests
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Database error
 */
router.get(
  "/requests",
  checkAuthenticated,
  authenticateRole(["student", "teacher", "admin"]),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      console.log('Debug: Loading requests for user:', { userId, userRole });

      const requests = await requestsService.getRequests(userId, userRole);

      console.log('Debug: Requests fetched:', requests ? requests.length : 0);

      res.json({
        user: req.user,
        requests: requests,
        userRole,
        title: "Request List",
      });
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(error.status || 500).json({
        error: 'Error loading requests',
        message: error.message
      });
    }
  }
);

// Render new request form
/**
 * @swagger
 * /api/requests/new:
 *   get:
 *     summary: Get data for new request form
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Form data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requestTypes:
 *                   type: array
 *                 classes:
 *                   type: array
 *       500:
 *         description: Server error
 */
router.get(
  "/requests/new",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  async (req, res) => {
    try {
      const data = await requestsService.getNewRequestFormData(req.user.id, req.user.role);

      res.json({
        user: req.user,
        requestTypes: data.requestTypes,
        classes: data.classes,
        title: "New Request",
      });
    } catch (error) {
      console.error("Error loading request form:", error);
      res.status(error.status || 500).json({
        error: error.message || 'Error loading request form'
      });
    }
  }
);

// Render edit request form
/**
 * @swagger
 * /api/requests/{requestId}/edit:
 *   get:
 *     summary: Get data for edit request form
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID
 *     responses:
 *       200:
 *         description: Request details retrieved
 *       404:
 *         description: Request not found
 *       500:
 *         description: Server error
 */
router.get(
  "/requests/:requestId/edit",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const data = await requestsService.getEditRequestFormData(requestId, req.user.id, req.user.role);

      res.json({
        user: req.user,
        request: data.request,
        classes: data.classes,
        title: "Edit Request",
      });
    } catch (error) {
      console.error("Error loading edit form:", error);
      res.status(error.status || 500).json({
        error: error.message || 'Error loading edit form'
      });
    }
  }
);


// Create a new request

/**
 * @swagger
 * /api/requestAdd:
 *   post:
 *     summary: Create a new request
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestType
 *               - details
 *             properties:
 *               requestType:
 *                 type: string
 *               details:
 *                 type: string
 *               classId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Request submitted successfully
 *       400:
 *         description: Invalid request type
 *       500:
 *         description: Server error
 */
router.post(
  "/requestAdd",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  async (req, res) => {
    try {
      const { requestType, details, classId } = req.body;
      const userId = req.user.id;
      const senderRole = req.user.role;

      await requestsService.createRequest(requestType, details, classId, userId, senderRole, req.user.username);

      res.status(200).json({ message: "Request submitted successfully" });
    } catch (error) {
      console.error("Error submitting request:", error);
      res.status(error.status || 500).json({
        error: error.message || "Failed to submit request"
      });
    }
  }
);

/**
 * @swagger
 * /api/requestDelete/{requestId}:
 *   delete:
 *     summary: Delete a pending request
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID
 *     responses:
 *       200:
 *         description: Request deleted successfully
 *       400:
 *         description: Only pending requests can be deleted
 *       404:
 *         description: Request not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/requestDelete/:requestId",
  checkAuthenticated,
  authenticateRole(["student", "teacher", "admin"]),
  async (req, res) => {
    try {
      const requestId = req.params.requestId;
      const userId = req.user.id;

      await requestsService.deleteRequest(requestId, userId);

      res.status(200).json({
        message: "Request deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting request:", error);
      res.status(error.status || 500).json({
        error: error.message || "Failed to delete request"
      });
    }
  }
);

/**
 * @swagger
 * /api/requestEdit/{requestId}:
 *   put:
 *     summary: Edit a pending request
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               details:
 *                 type: string
 *               classId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Request updated successfully
 *       400:
 *         description: Only pending requests can be edited
 *       404:
 *         description: Request not found
 *       500:
 *         description: Server error
 */
router.put(
  "/requestEdit/:requestId",
  checkAuthenticated,
  authenticateRole(["student", "teacher"]),
  async (req, res) => {
    try {
      const requestId = req.params.requestId;
      const userId = req.user.id;
      const { details, classId } = req.body;

      await requestsService.editRequest(requestId, userId, details, classId, req.user.username);

      res.status(200).json({
        message: "Request updated successfully"
      });
    } catch (error) {
      console.error("Error updating request:", error);
      res.status(error.status || 500).json({
        error: error.message || "Failed to update request"
      });
    }
  }
);

// Toggle request status (admin only)
/**
 * @swagger
 * /api/requestToggleStatus/{requestId}:
 *   put:
 *     summary: Toggle request status (Approve/Reject)
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Request ID
 *     responses:
 *       200:
 *         description: Request status updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Request not found
 *       500:
 *         description: Server error
 */
router.put(
  "/requestToggleStatus/:requestId",
  checkAuthenticated,
  authenticateRole(["admin", "teacher"]),
  async (req, res) => {
    try {
      const requestId = req.params.requestId;
      const actionUserId = req.user.id;
      const userRole = req.user.role;

      const result = await requestsService.toggleRequestStatus(requestId, actionUserId, userRole);

      res.status(200).json({
        message: `Request ${result.newStatus} successfully`,
        newStatus: result.newStatus
      });
    } catch (error) {
      console.error("Error toggling request status:", error);
      res.status(error.status || 500).json({
        error: error.message || "Failed to update request status"
      });
    }
  }
);

module.exports = router;

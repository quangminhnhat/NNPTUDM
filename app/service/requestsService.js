const executeQuery = require("./executeQueryservice");
const RequestModel = require("../model/RequestModel");

/**
 * Get requests based on user role
 * @param {number} userId - User ID
 * @param {string} userRole - User role (student, teacher, admin)
 * @returns {Promise<Array>} Array of requests
 */
async function getRequests(userId, userRole) {
  return await RequestModel.getRequests(userId, userRole);
}

/**
 * Get data for new request form
 * @param {number} userId - User ID
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Form data with request types and classes
 */
async function getNewRequestFormData(userId, userRole) {
    try {
        // Get available request types for user role
        const typeQuery = `
            SELECT type_id, type_name
            FROM RequestTypes
            WHERE applicable_to = @role
        `;

        const requestTypes = await executeQuery(typeQuery, {
            role: userRole
        });

        // Get available classes for the user
        const classQuery = userRole === 'student' ?
            `SELECT c.id, c.class_name
             FROM classes c
             JOIN enrollments e ON c.id = e.class_id
             JOIN students s ON e.student_id = s.id
             WHERE s.user_id = @userId` :
            `SELECT c.id, c.class_name
             FROM classes c
             JOIN teachers t ON c.teacher_id = t.id
             WHERE t.user_id = @userId`;

        const classes = await executeQuery(classQuery, {
            userId: userId
        });

        return {
            requestTypes,
            classes
        };
    } catch (error) {
        console.error("Error loading request form:", error);
        throw new Error("Database error while loading request form");
    }
}

/**
 * Get data for edit request form
 * @param {number} requestId - Request ID
 * @param {number} userId - User ID
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Form data with request and classes
 */
async function getEditRequestFormData(requestId, userId, userRole) {
    try {
        // Get request details
        const requestQuery = `
            SELECT r.*, rt.type_name, c.class_name
            FROM Requests r
            JOIN RequestTypes rt ON r.type_id = rt.type_id
            LEFT JOIN classes c ON r.class_id = c.id
            WHERE r.request_id = @requestId
            AND r.user_id = @userId
        `;

        const requestResult = await executeQuery(requestQuery, {
            requestId,
            userId
        });

        if (!requestResult || requestResult.length === 0) {
            const error = new Error("Request not found");
            error.status = 404;
            throw error;
        }

        // Get available classes (same as new request form)
        const classQuery = userRole === 'student' ?
            `SELECT c.id, c.class_name
             FROM classes c
             JOIN enrollments e ON c.id = e.class_id
             JOIN students s ON e.student_id = s.id
             WHERE s.user_id = @userId` :
            `SELECT c.id, c.class_name
             FROM classes c
             JOIN teachers t ON c.teacher_id = t.id
             WHERE t.user_id = @userId`;

        const classes = await executeQuery(classQuery, {
            userId
        });

        return {
            request: requestResult[0],
            classes
        };
    } catch (error) {
        console.error("Error loading edit form:", error);
        throw error;
    }
}

/**
 * Create a new request
 * @param {string} requestType - Request type name
 * @param {string} details - Request description
 * @param {number} classId - Class ID (optional)
 * @param {number} userId - User ID
 * @param {string} senderRole - User role
 * @returns {Promise<Object>} Success message
 */
async function createRequest(requestType, details, classId, userId, senderRole) {
  return await RequestModel.createRequest(requestType, details, classId, userId, senderRole);
}

/**
 * Delete a pending request
 * @param {number} requestId - Request ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Success message
 */
async function deleteRequest(requestId, userId) {
  return await RequestModel.deleteRequest(requestId, userId);
}

/**
 * Edit a pending request
 * @param {number} requestId - Request ID
 * @param {number} userId - User ID
 * @param {string} details - New description
 * @param {number} classId - New class ID
 * @returns {Promise<Object>} Success message
 */
async function editRequest(requestId, userId, details, classId) {
  return await RequestModel.editRequest(requestId, userId, details, classId);
}

/**
 * Toggle request status (Approve/Reject)
 * @param {number} requestId - Request ID
 * @param {number} actionUserId - User performing the action
 * @param {string} userRole - Role of the user performing action
 * @returns {Promise<Object>} Success message with new status
 */
async function toggleRequestStatus(requestId, actionUserId, userRole) {
  return await RequestModel.toggleRequestStatus(requestId, actionUserId, userRole);
}

module.exports = {
    getRequests,
    getNewRequestFormData,
    getEditRequestFormData,
    createRequest,
    deleteRequest,
    editRequest,
    toggleRequestStatus
};
const executeQuery = require("../service/executeQueryservice");

class RequestModel {
  /**
   * Get requests based on user role
   * @param {number} userId - User ID
   * @param {string} userRole - User role (student, teacher, admin)
   * @returns {Promise<Array>} Array of requests
   */
  static async getRequests(userId, userRole) {
    try {
      let requestQuery = `
        SELECT r.request_id, r.description, r.status, r.created_at,
               rt.type_name, c.class_name, u.username, u.full_name, u.role,
               r.class_id, r.user_id
        FROM Requests r
        JOIN RequestTypes rt ON r.type_id = rt.type_id
        JOIN users u ON r.user_id = u.id
        LEFT JOIN classes c ON r.class_id = c.id
      `;

      let whereClause = '';
      let params = {};

      // Filter based on role
      if (userRole === 'student') {
        whereClause = ' WHERE r.user_id = @userId';
        params.userId = userId;
      } else if (userRole === 'teacher') {
        whereClause = ' WHERE r.user_id = @userId OR r.class_id IN (SELECT c.id FROM classes c JOIN teachers t ON c.teacher_id = t.id WHERE t.user_id = @userId)';
        params.userId = userId;
      }
      // Admin sees all requests - no WHERE clause

      requestQuery += whereClause + ` ORDER BY r.created_at DESC`;

      const requests = await executeQuery(requestQuery, params);
      return requests || [];
    } catch (error) {
      console.error("Error fetching requests:", error);
      throw new Error("Database error while fetching requests");
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
  static async createRequest(requestType, details, classId, userId, senderRole) {
    try {
      // Get request type ID from RequestTypes table
      const typeQuery = `SELECT type_id FROM RequestTypes WHERE type_name = ? AND applicable_to = ?`;
      const typeResult = await executeQuery(typeQuery, [
        requestType,
        senderRole
      ]);

      if (!typeResult || typeResult.length === 0) {
        const error = new Error("Invalid request type");
        error.status = 400;
        throw error;
      }

      const typeId = typeResult[0].type_id;

      // Insert the request
      const insertQuery = `
        INSERT INTO Requests (user_id, type_id, class_id, description, status, created_at, updated_at)
        VALUES (@userId, @typeId, @classId, @details, 'pending', GETDATE(), GETDATE())
      `;

      await executeQuery(insertQuery, {
        userId: userId,
        typeId: typeId,
        classId: classId || null,
        details: details
      });

      // If it's a class-related request, notify relevant users
      if (classId) {
        // Get teacher of the class
        const teacherQuery = `
          SELECT t.user_id, u.full_name
          FROM teachers t
          JOIN classes c ON t.id = c.teacher_id
          JOIN users u ON t.user_id = u.id
          WHERE c.id = @classId
        `;
        const teacher = await executeQuery(teacherQuery, { classId });

        if (teacher && teacher.length > 0) {
          // Insert notification for teacher
          const notificationQuery = `
            INSERT INTO notifications (user_id, message, sender_id)
            VALUES (?, ?, ?)
          `;
          await executeQuery(notificationQuery, [
            teacher[0].user_id,
            `New request submitted for class: ${details}`,
            userId
          ]);
        }
      }

      return { message: "Request submitted successfully" };
    } catch (error) {
      console.error("Error submitting request:", error);
      throw error;
    }
  }

  /**
   * Delete a pending request
   * @param {number} requestId - Request ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Success message
   */
  static async deleteRequest(requestId, userId) {
    try {
      // First check if request exists and belongs to user
      const checkQuery = `
        SELECT status
        FROM Requests
        WHERE request_id = @requestId
        AND user_id = @userId
      `;

      const request = await executeQuery(checkQuery, {
        requestId: requestId,
        userId: userId
      });

      if (!request || request.length === 0) {
        const error = new Error("Request not found");
        error.status = 404;
        throw error;
      }

      // Only allow deletion of pending requests
      if (request[0].status !== 'pending') {
        const error = new Error("Only pending requests can be deleted");
        error.status = 400;
        throw error;
      }

      // Delete the request
      const deleteQuery = `
        DELETE FROM Requests
        WHERE request_id = @requestId
        AND user_id = @userId
        AND status = 'pending'
      `;

      await executeQuery(deleteQuery, {
        requestId: requestId,
        userId: userId
      });

      return { message: "Request deleted successfully" };
    } catch (error) {
      console.error("Error deleting request:", error);
      throw error;
    }
  }

  /**
   * Edit a pending request
   * @param {number} requestId - Request ID
   * @param {number} userId - User ID
   * @param {string} details - New description
   * @param {number} classId - New class ID
   * @returns {Promise<Object>} Success message
   */
  static async editRequest(requestId, userId, details, classId) {
    try {
      // Check if request exists and belongs to user
      const checkQuery = `
        SELECT r.status, r.type_id, rt.type_name, rt.applicable_to
        FROM Requests r
        JOIN RequestTypes rt ON r.type_id = rt.type_id
        WHERE r.request_id = @requestId
        AND r.user_id = @userId
      `;

      const request = await executeQuery(checkQuery, {
        requestId: requestId,
        userId: userId
      });

      if (!request || request.length === 0) {
        const error = new Error("Request not found");
        error.status = 404;
        throw error;
      }

      // Only allow editing of pending requests
      if (request[0].status !== 'pending') {
        const error = new Error("Only pending requests can be edited");
        error.status = 400;
        throw error;
      }

      // Update the request
      const updateQuery = `
        UPDATE Requests
        SET description = @details,
            class_id = @classId,
            updated_at = GETDATE()
        WHERE request_id = @requestId
        AND user_id = @userId
        AND status = 'pending'
      `;

      await executeQuery(updateQuery, {
        requestId: requestId,
        userId: userId,
        details: details,
        classId: classId || null
      });

      return { message: "Request updated successfully" };
    } catch (error) {
      console.error("Error editing request:", error);
      throw error;
    }
  }

  /**
   * Toggle request status (Approve/Reject)
   * @param {number} requestId - Request ID
   * @param {number} actionUserId - User performing the action
   * @param {string} userRole - Role of the user performing action
   * @returns {Promise<Object>} Success message with new status
   */
  static async toggleRequestStatus(requestId, actionUserId, userRole) {
    try {
      // Get current request status
      const statusQuery = `
        SELECT r.status, r.user_id, r.class_id, r.description,
               u.full_name as requester_name, c.class_name
        FROM Requests r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN classes c ON r.class_id = c.id
        WHERE r.request_id = @requestId
      `;

      const request = await executeQuery(statusQuery, { requestId });

      if (!request || request.length === 0) {
        const error = new Error("Request not found");
        error.status = 404;
        throw error;
      }

      const currentStatus = request[0].status;
      let newStatus;

      // Determine new status based on current status and user role
      if (userRole === 'admin') {
        // Admin can approve/reject any request
        newStatus = currentStatus === 'pending' ? 'approved' :
                   currentStatus === 'approved' ? 'rejected' : 'approved';
      } else if (userRole === 'teacher') {
        // Teacher can only approve/reject requests for their classes
        if (request[0].class_id) {
          const teacherCheckQuery = `
            SELECT 1
            FROM classes c
            JOIN teachers t ON c.teacher_id = t.id
            WHERE c.id = @classId AND t.user_id = @actionUserId
          `;
          const teacherCheck = await executeQuery(teacherCheckQuery, {
            classId: request[0].class_id,
            actionUserId: actionUserId
          });

          if (!teacherCheck || teacherCheck.length === 0) {
            const error = new Error("You can only manage requests for your classes");
            error.status = 403;
            throw error;
          }
        }

        newStatus = currentStatus === 'pending' ? 'approved' :
                   currentStatus === 'approved' ? 'rejected' : 'approved';
      }

      // Update request status
      const updateQuery = `
        UPDATE Requests
        SET status = @newStatus,
            updated_at = GETDATE()
        WHERE request_id = @requestId
      `;

      await executeQuery(updateQuery, {
        requestId: requestId,
        newStatus: newStatus
      });

      // Create notification for the requester
      const notificationMessage = `Your request "${request[0].description}" has been ${newStatus}`;
      const notificationQuery = `
        INSERT INTO notifications (user_id, message, sender_id)
        VALUES (?, ?, ?)
      `;
      await executeQuery(notificationQuery, [
        request[0].user_id,
        notificationMessage,
        actionUserId
      ]);

      return {
        message: `Request ${newStatus} successfully`,
        newStatus: newStatus
      };
    } catch (error) {
      console.error("Error toggling request status:", error);
      throw error;
    }
  }
}

module.exports = RequestModel;
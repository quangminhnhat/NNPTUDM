const executeQuery = require("../service/executeQueryservice");

class NotificationModel {
  /**
   * Get all notifications for a user (with role-based access)
   * @param {number} userId - User ID
   * @param {string} userRole - User role (admin, teacher, student)
   * @returns {Promise<Object>} Object containing notifications and users (if admin/teacher)
   */
  static async getNotifications(userId, userRole) {
    let query;
    let params = [];

    if (userRole === "admin") {
      query = `
        SELECT n.*,
            receiver.full_name as receiver_name,
            sender.full_name as sender_name
        FROM notifications n
        LEFT JOIN users receiver ON n.user_id = receiver.id
        LEFT JOIN users sender ON n.sender_id = sender.id
        ORDER BY n.created_at DESC
      `;
    } else {
      query = `
        SELECT n.*,
            receiver.full_name as receiver_name,
            sender.full_name as sender_name
        FROM notifications n
        LEFT JOIN users receiver ON n.user_id = receiver.id
        LEFT JOIN users sender ON n.sender_id = sender.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
      `;
      params = [userId];
    }

    const notifications = await executeQuery(query, params);

    let users = [];
    if (userRole === "admin" || userRole === "teacher") {
      const userQuery = `
        SELECT u.id, u.full_name, u.role
        FROM users u
        ORDER BY u.full_name
      `;
      users = await executeQuery(userQuery);
    }

    return {
      notifications,
      users
    };
  }

  /**
   * Mark a notification as read
   * @param {number} notificationId - Notification ID
   * @param {number} userId - User ID (for security)
   * @returns {Promise<Object>} Success message
   */
  static async markAsRead(notificationId, userId) {
    const query = `
      UPDATE notifications
      SET [read] = 1,
          updated_at = GETDATE()
      WHERE id = ? AND user_id = ?
    `;
    await executeQuery(query, [notificationId, userId]);

    return { success: true };
  }

  /**
   * Delete a notification
   * @param {number} notificationId - Notification ID
   * @returns {Promise<Object>} Success message
   */
  static async deleteNotification(notificationId) {
    await executeQuery("DELETE FROM notifications WHERE id = ?", [notificationId]);

    return { message: "Notification deleted successfully" };
  }

  /**
   * Send a notification to a user
   * @param {number} userId - Recipient user ID
   * @param {string} message - Notification message
   * @param {number} senderId - Sender user ID
   * @returns {Promise<Object>} Success message
   */
  static async sendNotification(userId, message, senderId) {
    if (!userId || !message) {
      const error = new Error("User and message are required");
      error.status = 400;
      throw error;
    }

    const insertQuery = `
      INSERT INTO notifications (user_id, message, sender_id)
      VALUES (?, ?, ?);
    `;

    await executeQuery(insertQuery, [userId, message, senderId]);

    return { success: true, message: "Notification sent successfully" };
  }

  /**
   * Get notification by ID
   * @param {number} notificationId - Notification ID
   * @returns {Promise<Object>} Notification data
   */
  static async getNotificationById(notificationId) {
    const query = `
      SELECT n.*,
          sender.full_name as sender_name,
          receiver.full_name as receiver_name
      FROM notifications n
      LEFT JOIN users sender ON n.sender_id = sender.id
      LEFT JOIN users receiver ON n.user_id = receiver.id
      WHERE n.id = ?
    `;

    const result = await executeQuery(query, [notificationId]);

    if (!result.length) {
      const error = new Error("Notification not found");
      error.status = 404;
      throw error;
    }

    return result[0];
  }

  /**
   * Get unread notifications count for a user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Count of unread notifications
   */
  static async getUnreadCount(userId) {
    const query = `
      SELECT COUNT(*) as unread_count
      FROM notifications
      WHERE user_id = ? AND [read] = 0
    `;

    const result = await executeQuery(query, [userId]);
    return result[0].unread_count;
  }

  /**
   * Create a notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  static async createNotification(notificationData) {
    const { user_id, message, sender_id } = notificationData;

    const insertQuery = `
      INSERT INTO notifications (user_id, message, sender_id, created_at)
      OUTPUT INSERTED.id
      VALUES (?, ?, ?, GETDATE())
    `;

    const result = await executeQuery(insertQuery, [user_id, message, sender_id]);

    return {
      id: result[0].id,
      ...notificationData,
      read: false,
      created_at: new Date()
    };
  }

  /**
   * Get all notifications (admin only)
   * @returns {Promise<Array>} Array of all notifications
   */
  static async getAllNotifications() {
    const query = `
      SELECT n.*,
          receiver.full_name as receiver_name,
          sender.full_name as sender_name
      FROM notifications n
      LEFT JOIN users receiver ON n.user_id = receiver.id
      LEFT JOIN users sender ON n.sender_id = sender.id
      ORDER BY n.created_at DESC
    `;

    return await executeQuery(query);
  }
}

module.exports = NotificationModel;
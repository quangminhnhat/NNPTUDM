const NotificationModel = require("../model/NotificationModel");

/**
 * Get all notifications for a user (with role-based access)
 * @param {number} userId - User ID
 * @param {string} userRole - User role (admin, teacher, student)
 * @returns {Promise<Object>} Object containing notifications and users (if admin/teacher)
 */
async function getNotifications(userId, userRole) {
  try {
    return await NotificationModel.getNotifications(userId, userRole);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw new Error("Database error while fetching notifications");
  }
}

/**
 * Mark a notification as read
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for security)
 * @returns {Promise<Object>} Success message
 */
async function markAsRead(notificationId, userId) {
  try {
    return await NotificationModel.markAsRead(notificationId, userId);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

/**
 * Delete a notification
 * @param {number} notificationId - Notification ID
 * @returns {Promise<Object>} Success message
 */
async function deleteNotification(notificationId) {
  try {
    return await NotificationModel.deleteNotification(notificationId);
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}

/**
 * Send a notification to a user
 * @param {number} userId - Recipient user ID
 * @param {string} message - Notification message
 * @param {number} senderId - Sender user ID
 * @returns {Promise<Object>} Success message
 */
async function sendNotification(userId, message, senderId) {
  try {
    return await NotificationModel.sendNotification(userId, message, senderId);
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  deleteNotification,
  sendNotification
};
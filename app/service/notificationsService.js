const executeQuery = require("./executeQueryservice");

/**
 * Get all notifications for a user (with role-based access)
 * @param {number} userId - User ID
 * @param {string} userRole - User role (admin, teacher, student)
 * @returns {Promise<Object>} Object containing notifications and users (if admin/teacher)
 */
async function getNotifications(userId, userRole) {
    try {
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
                    sender.full_name as sender_name
                FROM notifications n
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
        const query = `
            UPDATE notifications
            SET [read] = 1,
                updated_at = GETDATE()
            WHERE id = ? AND user_id = ?
        `;
        const result = await executeQuery(query, [notificationId, userId]);

        if (result.rowsAffected && result.rowsAffected[0] === 0) {
            const error = new Error("Notification not found or access denied");
            error.status = 404;
            throw error;
        }

        return { success: true };
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
        const result = await executeQuery("DELETE FROM notifications WHERE id = ?", [notificationId]);

        if (result.rowsAffected && result.rowsAffected[0] === 0) {
            const error = new Error("Notification not found");
            error.status = 404;
            throw error;
        }

        return { message: "Notification deleted successfully" };
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

        console.log("Notification sent to user ID:", userId);
        return { success: true, message: "Notification sent successfully" };
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
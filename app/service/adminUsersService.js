const UserModel = require("../model/UserModel");

class AdminUsersService {
  /**
   * Get all users for admin view
   * @returns {Array} List of users
   */
  static async getAllUsers() {
    try {
      const users = await UserModel.getAllUsers();
      return users;
    } catch (error) {
      console.error("Error fetching users:", error);
      throw new Error("Database error while fetching users.");
    }
  }

  /**
   * Delete a user with dependency checks and transaction management
   * @param {number} userIdToDelete - ID of user to delete
   * @param {number} adminUserId - ID of admin performing deletion
   * @param {string} connectionString - Database connection string
   * @returns {Object} Success response
   */
  static async deleteUser(userIdToDelete, adminUserId, connectionString) {
    if (userIdToDelete == adminUserId) {
      const error = new Error("You cannot delete your own account.");
      error.statusCode = 400;
      throw error;
    }

    try {
      await UserModel.deleteUser(userIdToDelete);
      return { success: true, message: "User deleted successfully." };
    } catch (error) {
      console.error("Error deleting user:", error);
      if (error.statusCode) {
        throw error;
      }
      const newError = new Error("Failed to delete user due to a server error.");
      newError.statusCode = 500;
      throw newError;
    }
  }
}

module.exports = AdminUsersService;
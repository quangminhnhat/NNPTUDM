const UserModel = require("../model/UserModel");

class AdminMiscService {
  /**
   * Register a new user with role-specific data
   * @param {Object} userData - User registration data
   * @param {string} connectionString - Database connection string
   * @returns {Object} Success response
   */
  static async registerUser(userData, connectionString) {
    try {
      console.log("Processing registration for:", userData.email);
      await UserModel.registerUser(userData);
      console.log("User registered successfully");
      return { success: true, message: "Registration successful" };
    } catch (error) {
      if (error.code === "ERR_HTTP_HEADERS_SENT") {
        console.log("Headers already sent, response already handled");
        throw error;
      }

      console.error("Error during registration:", error);
      if (error.status) {
        throw error;
      }
      const newError = new Error("Registration failed. Please try again later.");
      newError.statusCode = 500;
      throw newError;
    }
  }
}

module.exports = AdminMiscService;
const UserModel = require("../model/UserModel");

class UsersService {
  // Get user details for editing
  async getUserForEdit(userId) {
    const user = await UserModel.getUserForEdit(userId);
    return { editUser: user };
  }

  // Update user details
  async updateUser(userId, userData, file) {
    return await UserModel.updateUser(userId, userData, file);
  }

  // Get current user profile
  async getUserProfile(userId) {
    const details = await UserModel.getUserProfile(userId);
    return { details };
  }
}

module.exports = new UsersService();
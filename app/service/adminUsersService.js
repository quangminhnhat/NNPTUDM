const sql = require("msnodesqlv8");
const executeQuery = require("./executeQueryservice");

class AdminUsersService {
  /**
   * Get all users for admin view
   * @returns {Array} List of users
   */
  static async getAllUsers() {
    try {
      const query = `
        SELECT u.id, u.username, u.role, u.created_at, u.updated_at,
               u.full_name, u.email, u.phone_number AS phone
        FROM users u
        ORDER BY u.created_at DESC;
      `;
      const users = await executeQuery(query);
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

    let connection;
    try {
      connection = await sql.promises.open(connectionString);
      await connection.promises.beginTransaction();

      const userResult = await connection.promises.query(
        "SELECT role FROM users WHERE id = ?",
        [userIdToDelete]
      );
      if (!userResult.first || userResult.first.length === 0) {
        await connection.promises.rollback();
        const error = new Error("User not found.");
        error.statusCode = 404;
        throw error;
      }
      const userRole = userResult.first[0].role;

      if (userRole === "student") {
        const studentDeps = await connection.promises.query(
          `
          SELECT
            (SELECT COUNT(*) FROM enrollments e JOIN students s ON e.student_id = s.id WHERE s.user_id = ?) as enrollment_count,
            (SELECT COUNT(*) FROM Attempts a JOIN students s ON a.student_id = s.id WHERE s.user_id = ?) as attempt_count
        `,
          [userIdToDelete, userIdToDelete]
        );

        if (
          studentDeps.first[0].enrollment_count > 0 ||
          studentDeps.first[0].attempt_count > 0
        ) {
          await connection.promises.rollback();
          const error = new Error("Cannot delete student with existing enrollments or exam attempts.");
          error.statusCode = 400;
          throw error;
        }
      } else if (userRole === "teacher") {
        const teacherDeps = await connection.promises.query(
          "SELECT COUNT(*) as class_count FROM classes c JOIN teachers t ON c.teacher_id = t.id WHERE t.user_id = ?",
          [userIdToDelete]
        );
        if (teacherDeps.first[0].class_count > 0) {
          await connection.promises.rollback();
          const error = new Error("Cannot delete teacher assigned to active classes.");
          error.statusCode = 400;
          throw error;
        }
      }

      await connection.promises.query("DELETE FROM users WHERE id = ?", [
        userIdToDelete,
      ]);
      await connection.promises.commit();

      return { success: true, message: "User deleted successfully." };
    } catch (error) {
      console.error("Error deleting user:", error);
      if (connection) await connection.promises.rollback();
      if (error.statusCode) {
        throw error;
      }
      const newError = new Error("Failed to delete user due to a server error.");
      newError.statusCode = 500;
      throw newError;
    } finally {
      if (connection) await connection.promises.close();
    }
  }
}

module.exports = AdminUsersService;
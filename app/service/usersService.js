const sql = require("msnodesqlv8");
const fs = require("fs");
const path = require("path");
const executeQuery = require("./executeQueryservice");
const connectionString = process.env.CONNECTION_STRING;

class UsersService {
  // Get user details for editing
  async getUserForEdit(userId) {
    const query = `
      SELECT u.id, u.username, u.role, u.full_name, u.email, u.phone_number, u.profile_pic, t.salary, u.address, CONVERT(varchar(10), u.date_of_birth, 23) as date_of_birth
      FROM users u
      LEFT JOIN teachers t ON u.id = t.user_id
      WHERE u.id = ?
    `;

    const result = await executeQuery(query, [userId]);

    if (!result.length) {
      const error = new Error("User not found");
      error.status = 404;
      throw error;
    }

    return { editUser: result[0] };
  }

  // Update user details
  async updateUser(userId, userData, file) {
    const {
      username,
      role,
      full_name,
      email,
      phone_number,
      salary,
      address,
      date_of_birth,
    } = userData;

    let connection;

    try {
      connection = await sql.promises.open(connectionString);
      await connection.promises.beginTransaction();

      const roleResult = await connection.promises.query(
        "SELECT role, profile_pic FROM users WHERE id = ?",
        [userId]
      );

      if (!roleResult.first || roleResult.first.length === 0) {
        await connection.promises.rollback();
        const error = new Error("User not found.");
        error.status = 404;
        throw error;
      }

      const currentUserData = roleResult.first[0];
      const oldRole = currentUserData?.role;

      let newProfilePicPath = currentUserData?.profile_pic;
      if (file) {
        newProfilePicPath = file.path.replace(/\\/g, '/'); // Use forward slashes for consistency
        const oldPicPath = currentUserData?.profile_pic;
        if (oldPicPath && fs.existsSync(oldPicPath)) {
          fs.unlink(oldPicPath, (err) => {
            if (err) console.error("Error deleting old profile picture:", err);
          });
        }
      }

      let updateQueryParts = [
        "username = ?",
        "full_name = ?",
        "email = ?",
        "phone_number = ?",
        "address = ?",
        "date_of_birth = ?",
        "profile_pic = ?",
        "updated_at = GETDATE()",
      ];
      let queryParams = [
        username,
        full_name || null,
        email || null,
        phone_number || null,
        address || null,
        date_of_birth || null,
        newProfilePicPath,
      ];

      if (role && role !== oldRole) {
        updateQueryParts.push("role = ?");
        queryParams.push(role);
      }

      queryParams.push(userId);

      const updateUserQuery = `UPDATE users SET ${updateQueryParts.join(
        ", "
      )} WHERE id = ?`;
      await connection.promises.query(updateUserQuery, queryParams);

      if (role && oldRole !== role) {
        if (oldRole === "student") {
          const studentDepsQuery = `
            SELECT s.id
            FROM students s
            JOIN enrollments e ON s.id = e.student_id
            WHERE s.user_id = ?
          `;
          const studentDeps = await connection.promises.query(studentDepsQuery, [userId]);
          if (studentDeps.first && studentDeps.first.length > 0) {
            await connection.promises.rollback();
            const error = new Error("Cannot change role. This student is enrolled in one or more classes. Please unenroll them first.");
            error.status = 400;
            throw error;
          }
        }

        await connection.promises.query(
          "DELETE FROM students WHERE user_id = ?",
          [userId]
        );
        await connection.promises.query(
          "DELETE FROM teachers WHERE user_id = ?",
          [userId]
        );
        await connection.promises.query(
          "DELETE FROM admins WHERE user_id = ?",
          [userId]
        );

        if (role === "student") {
          await connection.promises.query(
            "INSERT INTO students (user_id) VALUES (?)",
            [userId]
          );
        } else if (role === "teacher") {
          await connection.promises.query(
            "INSERT INTO teachers (user_id, salary) VALUES (?, ?)",
            [userId, salary || 0]
          );
        } else if (role === "admin") {
          await connection.promises.query(
            "INSERT INTO admins (user_id) VALUES (?)",
            [userId]
          );
        }
      } else {
        if (oldRole === "teacher" && salary !== undefined) {
          await connection.promises.query(
            "UPDATE teachers SET salary = ? WHERE user_id = ?",
            [salary, userId]
          );
        }
      }

      await connection.promises.commit();

      return { success: true };
    } catch (error) {
      console.error("Error updating user:", error);
      if (file && fs.existsSync(file.path)) {
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting uploaded file after failed update:", err);
        });
      }
      if (connection) {
        await connection.promises.rollback();
      }
      throw error;
    } finally {
      if (connection) {
        await connection.promises.close();
      }
    }
  }

  // Get current user profile
  async getUserProfile(userId) {
    const query = `
      SELECT id, username, role, full_name, email, phone_number, address, profile_pic,
        CONVERT(varchar(10), date_of_birth, 103) as date_of_birth,
        CONVERT(varchar(10), created_at, 103) as created_at,
        CONVERT(varchar(10), updated_at, 103) as updated_at
      FROM users
      WHERE id = ?
    `;

    const [details] = await executeQuery(query, [userId]);

    if (!details) {
      const error = new Error("Profile not found.");
      error.status = 404;
      throw error;
    }

    return { details };
  }
}

module.exports = new UsersService();
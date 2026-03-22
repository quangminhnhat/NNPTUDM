const executeQuery = require("./executeQueryservice");
const bcrypt = require("bcrypt");
const UserModel = require("../model/UserModel");

const mapRole = {
  student: "student",
  teacher: "teacher",
  staff: "admin",
};

/**
 * Get material by ID
 * @param {number} materialId - The ID of the material
 * @returns {Object|null} - The material data or null if not found
 */
async function getMaterialById(materialId) {
  try {
    const query = "SELECT file_name, file_path FROM materials WHERE id = ?";
    const result = await executeQuery(query, [materialId]);
    return result.length ? result[0] : null;
  } catch (error) {
    console.error("Error fetching material:", error);
    throw error;
  }
}

/**
 * Get homepage courses
 * @returns {Array} - List of courses
 */
async function getHomepageCourses() {
  try {
    const query = `
      SELECT
        id,
        course_name AS title,
        description AS course_desc,
        image_path AS img,
        link
      FROM courses
      ORDER BY created_at DESC
    `;
    const courses = await executeQuery(query);
    console.log("Homepage courses images:", courses.map(c => c.img));
    return courses;
  } catch (error) {
    console.error("Error loading homepage courses:", error);
    throw error;
  }
}

/**
 * Register a new user
 * @param {Object} userData - User data object
 * @returns {string} - Success message or error
 */
async function registerUser(userData) {
  // Map the parameters to match UserModel.registerUser expectations
  const mappedData = {
    Name: userData.username,
    fullName: userData.fullName,
    email: userData.email,
    birthday: userData.birth,
    phone: userData.phone,
    Address: userData.address,
    subject: userData.subject,
    salary: userData.salary,
    Password: userData.password,
  };

  return await UserModel.registerUser(mappedData);
}

module.exports = {
  getMaterialById,
  getHomepageCourses,
  registerUser,
};
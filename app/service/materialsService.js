const executeQuery = require("./executeQueryservice");
const path = require("path");
const fs = require("fs");

/**
 * Get all materials with course information
 * @returns {Promise<Array>} Array of materials with course names
 */
async function getAllMaterials() {
    try {
        const query = `
            SELECT m.*, c.course_name
            FROM materials m
            JOIN courses c ON m.course_id = c.id
            ORDER BY m.uploaded_at DESC
        `;
        const materials = await executeQuery(query);
        return materials;
    } catch (error) {
        console.error("Error fetching materials:", error);
        throw new Error("Database error while fetching materials");
    }
}

/**
 * Upload a new material
 * @param {number} courseId - Course ID
 * @param {Object} file - Uploaded file object
 * @returns {Promise<Object>} Success message
 */
async function uploadMaterial(courseId, file) {
    try {
        // Verify course exists
        const courseCheckQuery = "SELECT id FROM courses WHERE id = ?";
        const courseResult = await executeQuery(courseCheckQuery, [courseId]);

        if (!courseResult || courseResult.length === 0) {
            const error = new Error("Course not found");
            error.status = 404;
            throw error;
        }

        const insertQuery = `
            INSERT INTO materials (course_id, file_name, file_path, uploaded_at)
            VALUES (?, ?, ?, GETDATE())
        `;

        const values = [
            courseId,
            file.originalname,
            path.join("uploads", file.filename),
        ];

        await executeQuery(insertQuery, values);

        return { success: true, message: "Material uploaded successfully" };
    } catch (error) {
        console.error("Error uploading material:", error);
        throw error;
    }
}

/**
 * Get material data for editing
 * @param {number} materialId - Material ID
 * @returns {Promise<Object>} Material data and available courses
 */
async function getMaterialForEdit(materialId) {
    try {
        // Get material details with course info
        const query = `
            SELECT m.*, c.course_name
            FROM materials m
            JOIN courses c ON m.course_id = c.id
            WHERE m.id = ?
        `;

        // Get available courses for dropdown
        const courseQuery = `
            SELECT id, course_name
            FROM courses
            WHERE end_date >= GETDATE()
            ORDER BY course_name
        `;

        const [material, courses] = await Promise.all([
            executeQuery(query, [materialId]),
            executeQuery(courseQuery),
        ]);

        if (!material.length) {
            const error = new Error("Material not found");
            error.status = 404;
            throw error;
        }

        return {
            material: material[0],
            courses,
        };
    } catch (error) {
        console.error("Error loading material edit form:", error);
        throw error;
    }
}

/**
 * Update an existing material
 * @param {number} materialId - Material ID
 * @param {number} courseId - New course ID
 * @param {Object} file - New uploaded file (optional)
 * @returns {Promise<Object>} Success message
 */
async function updateMaterial(materialId, courseId, file) {
    try {
        // Get current material info
        const currentMaterial = await executeQuery(
            "SELECT * FROM materials WHERE id = ?",
            [materialId]
        );

        if (!currentMaterial.length) {
            const error = new Error("Material not found");
            error.status = 404;
            throw error;
        }

        let updateQuery = "UPDATE materials SET course_id = ?";
        let queryParams = [courseId];

        // If new file uploaded, update file info
        if (file) {
            // Delete old file
            const oldFilePath = path.join(__dirname, "..", currentMaterial[0].file_path);
            fs.unlink(oldFilePath, (err) => {
                if (err) console.error("Error deleting old file:", err);
            });

            // Update with new file info
            updateQuery += ", file_name = ?, file_path = ?";
            queryParams.push(
                file.originalname,
                path.join("uploads", file.filename)
            );
        }

        updateQuery += ", updated_at = GETDATE() WHERE id = ?";
        queryParams.push(materialId);

        await executeQuery(updateQuery, queryParams);
        return { message: "Material updated successfully" };
    } catch (error) {
        console.error("Error updating material:", error);
        throw error;
    }
}

/**
 * Delete a material
 * @param {number} materialId - Material ID
 * @returns {Promise<Object>} Success message
 */
async function deleteMaterial(materialId) {
    try {
        // Get the file path from the database
        const getFilePathQuery = "SELECT file_path FROM materials WHERE id = ?";
        const result = await executeQuery(getFilePathQuery, [materialId]);

        if (!result || result.length === 0) {
            const error = new Error("Material not found");
            error.status = 404;
            throw error;
        }

        const relativePath = result[0].file_path;
        // Correctly construct the absolute path from the project root
        const absolutePath = path.join(__dirname, "..", relativePath);

        // Delete the record from the database
        const deleteQuery = "DELETE FROM materials WHERE id = ?";
        await executeQuery(deleteQuery, [materialId]);

        // Delete the file from the disk
        fs.unlink(absolutePath, (fsErr) => {
            if (fsErr) {
                // Log the error but don't block the user, as the DB record is gone.
                console.error("File deletion error:", fsErr);
            }
        });

        return { message: "Material deleted successfully" };
    } catch (error) {
        console.error("Error deleting material:", error);
        throw error;
    }
}

/**
 * Get courses for material upload
 * @returns {Promise<Object>} Available courses
 */
async function getCoursesForUpload() {
    try {
        const courses = await executeQuery("SELECT id, course_name FROM courses ORDER BY course_name");
        return { courses: courses };
    } catch (error) {
        console.error("Error loading upload material page:", error);
        throw error;
    }
}

module.exports = {
    getAllMaterials,
    uploadMaterial,
    getMaterialForEdit,
    updateMaterial,
    deleteMaterial,
    getCoursesForUpload
};
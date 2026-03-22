const MaterialModel = require("../model/MaterialModel");

async function getAllMaterials() {
  return await MaterialModel.getAllMaterials();
}

async function uploadMaterial(courseId, file) {
  return await MaterialModel.uploadMaterial(courseId, file);
}

async function getMaterialForEdit(materialId) {
  return await MaterialModel.getMaterialForEdit(materialId);
}

async function updateMaterial(materialId, courseId, file) {
  return await MaterialModel.updateMaterial(materialId, courseId, file);
}

async function deleteMaterial(materialId) {
  return await MaterialModel.deleteMaterial(materialId);
}

async function getCoursesForUpload() {
  const courses = await MaterialModel.getCoursesForUpload();
  return { courses };
}

module.exports = {
  getAllMaterials,
  uploadMaterial,
  getMaterialForEdit,
  updateMaterial,
  deleteMaterial,
  getCoursesForUpload
};
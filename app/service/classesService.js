const ClassModel = require("../model/ClassModel");

async function getAllClasses() {
  return await ClassModel.getAllClasses();
}

async function updateClass(id, data) {
  return await ClassModel.updateClass(id, data);
}

async function getClassEditData(id) {
  return await ClassModel.getClassEditData(id);
}

async function deleteClass(id) {
  return await ClassModel.deleteClass(id);
}

async function createClass(data) {
  return await ClassModel.createClass(data);
}

async function getNewClassFormData() {
  return await ClassModel.getNewClassFormData();
}

async function getClassStudents(id) {
  return await ClassModel.getClassStudents(id);
}

module.exports = {
  getAllClasses,
  updateClass,
  getClassEditData,
  deleteClass,
  createClass,
  getNewClassFormData,
  getClassStudents,
};

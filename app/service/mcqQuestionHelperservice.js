const QuestionModel = require("../model/QuestionModel");

async function createMCQQuestion(examId, questionData, files) {
    return await QuestionModel.createMCQQuestion(examId, questionData, files);
}

async function editMCQQuestion(questionId, questionData, files) {
    return await QuestionModel.editMCQQuestion(questionId, questionData, files);
}

async function deleteMCQQuestion(questionId) {
    return await QuestionModel.deleteMCQQuestion(questionId);
}

module.exports = {
    createMCQQuestion,
    editMCQQuestion,
    deleteMCQQuestion
};
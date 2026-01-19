
-- Clear existing data from all tables
-- Disable foreign key constraints
EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT ALL"

-- Delete data from all tables in correct order
DELETE FROM ResponseMedia;
DELETE FROM ResponseMultiSelect;
DELETE FROM Responses;
DELETE FROM OptionInstances;
DELETE FROM Attempts;
DELETE FROM ExamAssignments;
DELETE FROM MCQOptions;
DELETE FROM QuestionMedia;
DELETE FROM Questions;
DELETE FROM Exams;
DELETE FROM QuestionTypes;
DELETE FROM RequestVotes;
DELETE FROM Requests;
DELETE FROM RequestTypes;
DELETE FROM notifications;
DELETE FROM enrollments;
DELETE FROM schedules;
DELETE FROM classes;
DELETE FROM materials;
DELETE FROM courses;
DELETE FROM students;
DELETE FROM teachers;
DELETE FROM admins;
DELETE FROM users;

-- Re-enable foreign key constraints
EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL"

-- Reset all identity columns
EXEC sp_MSforeachtable "IF OBJECTPROPERTY(OBJECT_ID('?'), 'TableHasIdentity') = 1 DBCC CHECKIDENT('?', RESEED, 0)"





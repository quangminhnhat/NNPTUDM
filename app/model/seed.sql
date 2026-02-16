






-- Insert question types first
INSERT INTO QuestionTypes
    (type_code, type_name)
VALUES
    ('MCQ', N'Câu hỏi trắc nghiệm'),
    ('ESSAY', N'Câu hỏi tự luận');

INSERT INTO RequestTypes
    (type_name, applicable_to)
VALUES
    (N'Hủy tiết', 'teacher'),
    (N'Đổi tiết', 'teacher'),
    (N'Tạm hoãn học', 'student'),
    (N'Gia hạn học phí', 'student');








-- Insert users (use correct column name password and provide unique emails)
INSERT INTO users
    (username, password, role, full_name, email, phone_number, address, date_of_birth, created_at, updated_at)
VALUES
    ('aaaaaaaaa', '$2b$10$tl7LZc8MATcxahLRXSCgZOw1OIfP3nTSnJe/bROpf4gicj45F8ZlO', 'student', N'Nguyen Anh', 'test@gmail.com', '0123456789', N'123 Example St, Hanoi', '2005-01-10', '2025-05-11 17:23:17.473', '2025-05-11 17:23:17.473'),
    ('bbbbbbbbbb', '$2b$10$tl7LZc8MATcxahLRXSCgZOw1OIfP3nTSnJe/bROpf4gicj45F8ZlO', 'teacher', N'Le Binh', 'test2@gmail.com', '0987654321', N'456 Sample Rd, Ho Chi Minh City', '1980-03-15', '2025-05-11 17:23:32.367', '2025-05-11 17:23:32.367'),
    ('cccccccccc', '$2b$10$tl7LZc8MATcxahLRXSCgZOw1OIfP3nTSnJe/bROpf4gicj45F8ZlO', 'admin', N'Tran Cuong', 'test3@gmail.com', '0912345678', N'789 Demo Ave, Da Nang', '1990-07-20', '2025-05-12 09:37:00.560', '2025-05-12 09:50:10.277');

-- below is adding more student
-- Add more test users (students)
INSERT INTO users
    (username, password, role, full_name, email, phone_number)
VALUES
    ('student2', '$2b$10$tl7LZc8MATcxahLRXSCgZOw1OIfP3nTSnJe/bROpf4gicj45F8ZlO', 'student', 'Test Student 2', 'student2@test.com', '0123456788'),
    ('student3', '$2b$10$tl7LZc8MATcxahLRXSCgZOw1OIfP3nTSnJe/bROpf4gicj45F8ZlO', 'student', 'Test Student 3', 'student3@test.com', '0123456787');

-- Insert student records for all students
INSERT INTO students
    (user_id)
VALUES
    (1),
    -- Main student
    ((SELECT id
        FROM users
        WHERE username = 'student2')),
    ((SELECT id
        FROM users
        WHERE username = 'student3'));

-- Insert teacher (user_id = 2)
INSERT INTO teachers
    (user_id, salary)
VALUES
    (2, 10000000000000.00);

-- Insert admin (user_id = 3)
INSERT INTO admins
    (user_id)
VALUES
    (3);

-- Insert courses (with image_path)
INSERT INTO courses
    (course_name, description, start_date, end_date, tuition_fee, image_path, link)
VALUES
    (N'Khoá học Toán, Lý, Hoá, Anh',
        N'Các khoá học Toán, Lý, Hoá, Anh được thiết kế phù hợp với từng trình độ, giúp học sinh củng cố kiến thức nền tảng, phát triển tư duy logic và nâng cao kỹ năng ngoại ngữ. Đội ngũ giáo viên chuyên môn, phương pháp giảng dạy hiện đại, hỗ trợ học sinh đạt kết quả cao trong học tập.',
        DATEADD(month, 1, GETDATE()), DATEADD(month, 2, GETDATE()), 3000000, 'slide1.jpg', '/Toan,Ly,Hoaclass'),
    (N'Khoá học Anh Văn',
        N'Chương trình Anh văn giúp học sinh phát triển toàn diện các kỹ năng nghe, nói, đọc, viết với giáo viên giàu kinh nghiệm và phương pháp hiện đại.',
        DATEADD(month, -1, GETDATE()), DATEADD(month, 1, GETDATE()), 1500000, 'slide2.jpg', '/AnhVanClass'),
    (N'Khoá học Văn',
        N'Khoá học Văn giúp học sinh nâng cao khả năng cảm thụ, phân tích tác phẩm và phát triển kỹ năng viết, trình bày ý tưởng một cách logic, sáng tạo.',
        DATEADD(month, -1, GETDATE()), DATEADD(month, 1, GETDATE()), 1800000, 'slide3.jpg', '/VanClass'),
    (N'Khoá học Toán',
        N'Khoá học Toán xây dựng nền tảng vững chắc, phát triển tư duy logic và khả năng giải quyết vấn đề cho học sinh ở mọi cấp độ.',
        DATEADD(month, -1, GETDATE()), DATEADD(month, 1, GETDATE()), 2000000, 'slide4.jpg', '/ToanClass'),
    (N'Khoá học Lý',
        N'Khoá học Vật lý giúp học sinh hiểu sâu các khái niệm, vận dụng kiến thức vào thực tiễn và đạt kết quả cao trong các kỳ thi.',
        DATEADD(month, -1, GETDATE()), DATEADD(month, 1, GETDATE()), 2000000, 'slide5.png', '/LyClass'),
    (N'Khoá học Hoá',
        N'Chương trình Hoá học chú trọng thực hành, giúp học sinh nắm vững lý thuyết và ứng dụng vào các bài tập, thí nghiệm thực tế.',
        DATEADD(month, -1, GETDATE()), DATEADD(month, 1, GETDATE()), 2000000, 'slide6.png', '/HoaClass'),
    (N'Khoá học Sử',
        N'Khoá học Lịch sử giúp học sinh hiểu rõ các sự kiện, nhân vật lịch sử và phát triển tư duy phản biện, phân tích.',
        DATEADD(month, -1, GETDATE()), DATEADD(month, 1, GETDATE()), 1700000, 'slide7.jpg', '/SuClass');

-- Insert materials
INSERT INTO materials
    (course_id, file_name, file_path)
VALUES
    (1, 'Slide bài giảng 1', '/materials/csharp_slide1.pdf');

-- Insert classes
DECLARE @teacher_id INT;
SELECT @teacher_id = id
FROM teachers
WHERE user_id = (SELECT id
FROM users
WHERE username = 'bbbbbbbbbb');

INSERT INTO classes
    (class_name, course_id, teacher_id, start_time, end_time, weekly_schedule)
VALUES
    (N'Math A1', 1, @teacher_id, '08:00', '10:00', '2,4,6');
-- Tue, Thu, Sat

-- Insert schedules with random dates within the course duration
DECLARE @course_start_date DATE;
DECLARE @course_end_date DATE;
DECLARE @date_diff INT;

-- Get the date range for course_id = 1 (linked to class_id = 1)
SELECT @course_start_date = start_date, @course_end_date = end_date
FROM courses
WHERE id = 1;

SET @date_diff = DATEDIFF(day, @course_start_date, @course_end_date);

INSERT INTO schedules
    (class_id, day_of_week, schedule_date, start_time, end_time)
VALUES
    (1, N'Monday', DATEADD(day, ABS(CHECKSUM(NEWID())) % @date_diff, @course_start_date), '08:00', '10:00'),
    (1, N'Wednesday', DATEADD(day, ABS(CHECKSUM(NEWID())) % @date_diff, @course_start_date), '08:00', '10:00'),
    (1, N'Friday', DATEADD(day, ABS(CHECKSUM(NEWID())) % @date_diff, @course_start_date), '08:00', '10:00');


-- Enroll all students in the Math A1 class
INSERT INTO enrollments
    (student_id, class_id, enrollment_date, payment_status)
VALUES
    ((SELECT id
        FROM students
        WHERE user_id = (SELECT id
        FROM users
        WHERE username = 'aaaaaaaaa')),
        (SELECT id
        FROM classes
        WHERE class_name = N'Math A1'),
        GETDATE(), 0),
    ((SELECT id
        FROM students
        WHERE user_id = (SELECT id
        FROM users
        WHERE username = 'student2')),
        (SELECT id
        FROM classes
        WHERE class_name = N'Math A1'),
        GETDATE(), 1),
    ((SELECT id
        FROM students
        WHERE user_id = (SELECT id
        FROM users
        WHERE username = 'student3')),
        (SELECT id
        FROM classes
        WHERE class_name = N'Math A1'),
        GETDATE(), 1);

-- Insert notifications
INSERT INTO notifications
    (user_id, message)
VALUES
    (1, N'Bạn đã được đăng ký vào lớp LTC001.'),
    (2, N'Bạn có lớp mới: LTC001.');


INSERT INTO Requests
    (user_id, type_id, class_id, description, status, created_at, updated_at)
VALUES
    ((SELECT id
        FROM users
        WHERE role = 'teacher' AND username = 'bbbbbbbbbb'), (SELECT type_id
        FROM RequestTypes
        WHERE type_name = N'Đổi tiết' AND applicable_to = 'teacher'), 1, N'Tôi cần đổi tiết học từ thứ 2 sang thứ 4 tuần sau do có việc đột xuất', 'pending', GETDATE(), GETDATE()),
    ((SELECT id
        FROM users
        WHERE role = 'student' AND username = 'aaaaaaaaa'), (SELECT type_id
        FROM RequestTypes
        WHERE type_name = N'Tạm hoãn học' AND applicable_to = 'student'), 1, N'Em xin tạm hoãn học 1 tuần do bị ốm', 'pending', GETDATE(), GETDATE())






-- Insert a demo exam
DECLARE @teacher_id_for_exam INT;
SELECT @teacher_id_for_exam = id
FROM teachers
WHERE user_id = (SELECT id
FROM users
WHERE role = 'teacher');

INSERT INTO Exams
    (teachers_id, exam_code, exam_title, description, duration_min, total_points, created_at)
VALUES
    (
        @teacher_id_for_exam,
        'EXAM001',
        'Midterm Test',
        'Mathematics Midterm Examination',
        60,
        100,
        GETDATE()
);

-- Create one exam assignment for the class
DECLARE @exam_id INT;
DECLARE @class_id INT;
DECLARE @exam_assignment_id INT;
DECLARE @student1_id INT, @student2_id INT, @student3_id INT;
DECLARE @student1_attempt_id BIGINT, @student2_attempt_id BIGINT, @student3_attempt_id BIGINT;

-- Get the exam and class IDs
SELECT @exam_id = exam_id
FROM Exams
WHERE exam_code = 'EXAM001';
SELECT @class_id = id
FROM classes
WHERE class_name = 'Math A1';

-- Get student IDs
SELECT @student1_id = id
FROM students
WHERE user_id = (SELECT id
FROM users
WHERE username = 'aaaaaaaaa');
SELECT @student2_id = id
FROM students
WHERE user_id = (SELECT id
FROM users
WHERE username = 'student2');
SELECT @student3_id = id
FROM students
WHERE user_id = (SELECT id
FROM users
WHERE username = 'student3');

-- Create single assignment with multiple attempts allowed
IF @exam_id IS NOT NULL AND @class_id IS NOT NULL
BEGIN
    INSERT INTO ExamAssignments
        (exam_id, classes_id, open_at, close_at, max_attempts)
    VALUES
        (
            @exam_id,
            @class_id,
            DATEADD(day, -7, GETDATE()),
            DATEADD(day, -1, GETDATE()),
            3  -- Allow up to 3 attempts
    );

    SET @exam_assignment_id = SCOPE_IDENTITY();
END;

-- Declare variables
DECLARE @mcq_type_id INT;
DECLARE @question1_id INT;
DECLARE @question2_id INT;

-- Get MCQ type_id first to ensure it's not NULL
SELECT @mcq_type_id = type_id
FROM QuestionTypes
WHERE type_code = 'MCQ';

-- Create table variables for storing question IDs
DECLARE @Questions TABLE (
    QuestionNumber INT,
    QuestionId INT
);

-- Verify we have a valid type_id before inserting
IF @mcq_type_id IS NOT NULL
BEGIN
    -- Insert first question
    INSERT INTO Questions
        (exam_id, type_id, points, body_text, difficulty)
    OUTPUT 1, INSERTED.question_id INTO @Questions
    VALUES
        (@exam_id, @mcq_type_id, 10, 'What is 2 + 2?', 2);

    -- Create second question
    INSERT INTO Questions
        (exam_id, type_id, points, body_text, difficulty)
    OUTPUT 2, INSERTED.question_id INTO @Questions
    VALUES
        (@exam_id, @mcq_type_id, 10, 'What is the square root of 16?', 2);
END
ELSE
BEGIN
    RAISERROR ('MCQ type_id not found in QuestionTypes table', 16, 1);
    RETURN;
END

-- Set question IDs and add options
SELECT @question1_id = QuestionId
FROM @Questions
WHERE QuestionNumber = 1;
SELECT @question2_id = QuestionId
FROM @Questions
WHERE QuestionNumber = 2;

-- Add options for first question
IF @question1_id IS NOT NULL
BEGIN
    INSERT INTO MCQOptions
        (question_id, option_text, is_correct)
    VALUES
        (@question1_id, '3', 0),
        (@question1_id, '4', 1),
        (@question1_id, '5', 0);
END

-- Add options for second question

IF @question2_id IS NOT NULL
BEGIN
    INSERT INTO MCQOptions
        (question_id, option_text, is_correct)
    VALUES
        (@question2_id, '2', 0),
        (@question2_id, '4', 1),
        (@question2_id, '8', 0);
END

-- Create attempts and responses for the three students
-- Create table variables to store attempt IDs and responses
DECLARE @Student1Attempt TABLE (attempt_id BIGINT);
DECLARE @Student2Attempt TABLE (attempt_id BIGINT);
DECLARE @Student3Attempt TABLE (attempt_id BIGINT);
DECLARE @Student1Responses TABLE (response_id BIGINT);
DECLARE @Student2Responses TABLE (response_id BIGINT);
DECLARE @Student3Responses TABLE (response_id BIGINT);

-- Create attempts for student 1
INSERT INTO Attempts
    (assignment_id, student_id, attempt_no, started_at, submitted_at, auto_score, status)
OUTPUT inserted.attempt_id INTO @Student1Attempt
VALUES
    (
        @exam_assignment_id,
        @student1_id,
        1,
        DATEADD(day, -6, GETDATE()),
        DATEADD(day, -6, GETDATE()),
        90,
        'graded'
);

-- Create attempt for Student 2 using table variable
INSERT INTO Attempts
    (assignment_id, student_id, attempt_no, started_at, submitted_at, auto_score, status)
OUTPUT inserted.attempt_id INTO @Student2Attempt
VALUES
    (
        @exam_assignment_id,
        @student2_id,
        1,
        DATEADD(day, -5, GETDATE()),
        DATEADD(day, -5, GETDATE()),
        75,
        'graded'
    );

-- Create attempt for Student 3 using table variable
INSERT INTO Attempts
    (assignment_id, student_id, attempt_no, started_at, submitted_at, auto_score, status)
OUTPUT inserted.attempt_id INTO @Student3Attempt
VALUES
    (
        @exam_assignment_id,
        @student3_id,
        1,
        DATEADD(day, -4, GETDATE()),
        DATEADD(day, -4, GETDATE()),
        45,
        'graded'
    );

-- Update student IDs if not already set
IF @student1_id IS NULL
    SELECT @student1_id = id
FROM students
WHERE user_id = (SELECT id
FROM users
WHERE username = 'aaaaaaaaa');
IF @student2_id IS NULL    
    SELECT @student2_id = id
FROM students
WHERE user_id = (SELECT id
FROM users
WHERE username = 'student2');
IF @student3_id IS NULL
    SELECT @student3_id = id
FROM students
WHERE user_id = (SELECT id
FROM users
WHERE username = 'student3');

IF @exam_assignment_id IS NULL
    SELECT @exam_assignment_id = assignment_id
FROM ExamAssignments
WHERE exam_id = @exam_id AND classes_id = @class_id;

-- For Student 1 (completed with high score)
-- No need to create another attempt since we already have it in @Student1Attempt
SET @student1_attempt_id = (SELECT attempt_id
FROM @Student1Attempt);

-- Create table variables for storing option instance IDs for Student 1
DECLARE @Option1Instances TABLE (option_instance_id BIGINT);
DECLARE @Option2Instances TABLE (option_instance_id BIGINT);

-- Create option instances for Student 1
IF @question1_id IS NOT NULL
BEGIN
    INSERT INTO OptionInstances
        (attempt_id, question_id, option_id, display_order, display_label, option_text_snapshot, is_correct_snapshot)
    OUTPUT INSERTED.option_instance_id INTO @Option1Instances
    SELECT TOP 1
        @student1_attempt_id, @question1_id, option_id, 1, 'A', option_text, is_correct
    FROM MCQOptions
    WHERE question_id = @question1_id AND is_correct = 1;
END

-- Create option instances for Question 2
IF @question2_id IS NOT NULL
BEGIN
    INSERT INTO OptionInstances
        (attempt_id, question_id, option_id, display_order, display_label, option_text_snapshot, is_correct_snapshot)
    OUTPUT INSERTED.option_instance_id INTO @Option2Instances
    SELECT TOP 1
        @student1_attempt_id, @question2_id, option_id, 1, 'A', option_text, is_correct
    FROM MCQOptions
    WHERE question_id = @question2_id AND is_correct = 1;
END

-- Create responses for Student 1
IF @question1_id IS NOT NULL AND @question2_id IS NOT NULL
BEGIN
    -- Insert response for question 1
    INSERT INTO Responses
        (attempt_id, question_id, chosen_option_instance_id, score_awarded, answered_at)
    VALUES
        (@student1_attempt_id, @question1_id,
            (SELECT TOP 1
                option_instance_id
            FROM @Option1Instances),
            10, DATEADD(day, -6, GETDATE()));

    -- Insert response for question 2
    INSERT INTO Responses
        (attempt_id, question_id, chosen_option_instance_id, score_awarded, answered_at)
    VALUES
        (@student1_attempt_id, @question2_id,
            (SELECT TOP 1
                option_instance_id
            FROM @Option2Instances),
            10, DATEADD(day, -6, GETDATE()));
END

-- For Student 2 (completed with medium score)
-- No need to create another attempt since we already have it in @Student2Attempt
SET @student2_attempt_id = (SELECT attempt_id
FROM @Student2Attempt);

-- Create table variables for storing option instance IDs for Student 2
DECLARE @S2Option1Instances TABLE (option_instance_id BIGINT);
DECLARE @S2Option2Instances TABLE (option_instance_id BIGINT);

-- Create option instances for Question 1
INSERT INTO OptionInstances
    (attempt_id, question_id, option_id, display_order, display_label, option_text_snapshot, is_correct_snapshot)
OUTPUT INSERTED.option_instance_id INTO @S2Option1Instances
SELECT TOP 1
    @student2_attempt_id, @question1_id, option_id, 1, 'A', option_text, is_correct
FROM MCQOptions
WHERE question_id = @question1_id AND is_correct = 0;

-- Create option instances for Question 2
INSERT INTO OptionInstances
    (attempt_id, question_id, option_id, display_order, display_label, option_text_snapshot, is_correct_snapshot)
OUTPUT INSERTED.option_instance_id INTO @S2Option2Instances
SELECT TOP 1
    @student2_attempt_id, @question2_id, option_id, 1, 'A', option_text, is_correct
FROM MCQOptions
WHERE question_id = @question2_id AND is_correct = 0;

-- Create responses for Student 2
IF @question1_id IS NOT NULL AND @question2_id IS NOT NULL
BEGIN
    -- Insert response for question 1
    INSERT INTO Responses
        (attempt_id, question_id, chosen_option_instance_id, score_awarded, answered_at)
    VALUES
        (@student2_attempt_id, @question1_id,
            (SELECT TOP 1
                option_instance_id
            FROM @S2Option1Instances),
            7.5, DATEADD(day, -5, GETDATE()));

    -- Insert response for question 2
    INSERT INTO Responses
        (attempt_id, question_id, chosen_option_instance_id, score_awarded, answered_at)
    VALUES
        (@student2_attempt_id, @question2_id,
            (SELECT TOP 1
                option_instance_id
            FROM @S2Option2Instances),
            7.5, DATEADD(day, -5, GETDATE()));
END

-- For Student 3 (completed with low score)
-- No need to create another attempt since we already have it in @Student3Attempt
SET @student3_attempt_id = (SELECT attempt_id
FROM @Student3Attempt);

-- Create table variables for storing option instance IDs for Student 3
DECLARE @S3Option1Instances TABLE (option_instance_id BIGINT);
DECLARE @S3Option2Instances TABLE (option_instance_id BIGINT);

-- Create option instances for Question 1
INSERT INTO OptionInstances
    (attempt_id, question_id, option_id, display_order, display_label, option_text_snapshot, is_correct_snapshot)
OUTPUT INSERTED.option_instance_id INTO @S3Option1Instances
SELECT TOP 1
    @student3_attempt_id, @question1_id, option_id, 1, 'A', option_text, is_correct
FROM MCQOptions
WHERE question_id = @question1_id AND is_correct = 0;

-- Create option instances for Question 2
INSERT INTO OptionInstances
    (attempt_id, question_id, option_id, display_order, display_label, option_text_snapshot, is_correct_snapshot)
OUTPUT INSERTED.option_instance_id INTO @S3Option2Instances
SELECT TOP 1
    @student3_attempt_id, @question2_id, option_id, 1, 'A', option_text, is_correct
FROM MCQOptions
WHERE question_id = @question2_id AND is_correct = 0;

-- Create responses for Student 3
IF @question1_id IS NOT NULL AND @question2_id IS NOT NULL
BEGIN
    -- Insert response for question 1
    INSERT INTO Responses
        (attempt_id, question_id, chosen_option_instance_id, score_awarded, answered_at)
    VALUES
        (@student3_attempt_id, @question1_id,
            (SELECT TOP 1
                option_instance_id
            FROM @S3Option1Instances),
            4.5, DATEADD(day, -4, GETDATE()));

    -- Insert response for question 2
    INSERT INTO Responses
        (attempt_id, question_id, chosen_option_instance_id, score_awarded, answered_at)
    VALUES
        (@student3_attempt_id, @question2_id,
            (SELECT TOP 1
                option_instance_id
            FROM @S3Option2Instances),
            4.5, DATEADD(day, -4, GETDATE()));
END

-- Create another exam for the same teacher
INSERT INTO Exams
    (teachers_id, exam_code, exam_title, description, duration_min, total_points, created_at)
VALUES
    (
        (SELECT TOP 1
            id
        FROM teachers
        WHERE user_id = (SELECT TOP 1
            id
        FROM users
        WHERE role = 'teacher')),
        'EXAM002',
        'Final Test',
        'Mathematics Final Examination',
        90,
        100,
        GETDATE()
);

-- Create exam assignment for the new exam
DECLARE @new_exam_id INT = (SELECT TOP 1
    exam_id
FROM Exams
WHERE exam_code = 'EXAM002');
DECLARE @existing_class_id INT = (SELECT TOP 1
    id
FROM classes);

INSERT INTO ExamAssignments
    (exam_id, classes_id, open_at, close_at, max_attempts)
VALUES
    (
        @new_exam_id,
        @existing_class_id,
        DATEADD(day, -3, GETDATE()), -- Started 3 days ago
        DATEADD(day, 3, GETDATE()), -- Ends in 3 days
        3
);

-- Add questions to the new exam
DECLARE @new_mcq_type_id INT = (SELECT type_id
FROM QuestionTypes
WHERE type_code = 'MCQ');
DECLARE @new_question1_id INT, @new_question2_id INT;

-- Create new questions
INSERT INTO Questions
    (exam_id, type_id, points, body_text, difficulty)
VALUES
    (@new_exam_id, @new_mcq_type_id, 15, 'What is 5 * 5?', 2);
SET @new_question1_id = SCOPE_IDENTITY();

INSERT INTO Questions
    (exam_id, type_id, points, body_text, difficulty)
VALUES
    (@new_exam_id, @new_mcq_type_id, 15, 'What is 10 / 2?', 2);
SET @new_question2_id = SCOPE_IDENTITY();

-- Add options for the new questions
INSERT INTO MCQOptions
    (question_id, option_text, is_correct)
VALUES
    (@new_question1_id, '20', 0),
    (@new_question1_id, '25', 1),
    (@new_question1_id, '30', 0);

INSERT INTO MCQOptions
    (question_id, option_text, is_correct)
VALUES
    (@new_question2_id, '4', 0),
    (@new_question2_id, '5', 1),
    (@new_question2_id, '6', 0);

-- Create an attempt for user 1
DECLARE @new_assignment_id INT = (SELECT assignment_id
FROM ExamAssignments
WHERE exam_id = @new_exam_id);

-- Create the attempt for student 1
INSERT INTO Attempts
    (assignment_id, student_id, attempt_no, started_at, submitted_at, auto_score, status)
VALUES
    (
        @new_assignment_id,
        @student1_id, -- Adding student_id which is required
        1,
        DATEADD(day, -2, GETDATE()),
        DATEADD(day, -2, GETDATE()),
        85,
        'graded'
);

DECLARE @new_attempt_id BIGINT = SCOPE_IDENTITY();

-- Create option instances and responses for both questions
-- For Question 1
INSERT INTO OptionInstances
    (attempt_id, question_id, option_id, display_order, display_label, option_text_snapshot, is_correct_snapshot)
SELECT TOP 1
    @new_attempt_id, @new_question1_id, option_id, 1, 'A', option_text, is_correct
FROM MCQOptions
WHERE question_id = @new_question1_id AND is_correct = 1;

DECLARE @new_option_instance1_id BIGINT = SCOPE_IDENTITY();

-- For Question 2
INSERT INTO OptionInstances
    (attempt_id, question_id, option_id, display_order, display_label, option_text_snapshot, is_correct_snapshot)
SELECT TOP 1
    @new_attempt_id, @new_question2_id, option_id, 1, 'A', option_text, is_correct
FROM MCQOptions
WHERE question_id = @new_question2_id AND is_correct = 1;

DECLARE @new_option_instance2_id BIGINT = SCOPE_IDENTITY();

-- Create responses
INSERT INTO Responses
    (attempt_id, question_id, chosen_option_instance_id, score_awarded, answered_at)
VALUES
    (@new_attempt_id, @new_question1_id, @new_option_instance1_id, 15, DATEADD(day, -2, GETDATE())),
    (@new_attempt_id, @new_question2_id, @new_option_instance2_id, 15, DATEADD(day, -2, GETDATE()));




-- Create exam assignment for the untested exam
BEGIN
    -- Declare all variables needed for the untested exam
    DECLARE @untested_exam_id INT;
    DECLARE @untested_class_id INT;
    DECLARE @untested_practice_mcq_type_id INT;
    DECLARE @untested_practice_q1_id INT;
    DECLARE @untested_practice_q2_id INT;

    -- Insert the exam and capture its ID
    INSERT INTO Exams
        (teachers_id, exam_code, exam_title, description, duration_min, total_points, created_at)
    VALUES
        (
            (SELECT TOP 1
                id
            FROM teachers
            WHERE user_id = (SELECT TOP 1
                id
            FROM users
            WHERE role = 'teacher')),
            'EXAM003',
            'Practice Test',
            'Mathematics Practice Quiz',
            45,
            50,
            GETDATE()
    );

    -- Set all necessary variables
    SET @untested_exam_id = SCOPE_IDENTITY();
    SET @untested_class_id = (SELECT TOP 1
        id
    FROM classes);
    SET @untested_practice_mcq_type_id = (SELECT type_id
    FROM QuestionTypes
    WHERE type_code = 'MCQ');

    IF @untested_exam_id IS NOT NULL AND @untested_class_id IS NOT NULL
    BEGIN
        -- Create the assignment for the exam
        INSERT INTO ExamAssignments
            (exam_id, classes_id, open_at, close_at, max_attempts)
        VALUES
            (
                @untested_exam_id,
                @untested_class_id,
                DATEADD(day, -1, GETDATE()), -- Started yesterday 
                DATEADD(day, 6, GETDATE()), -- Ends in 6 days
                2
            );
    END;

    -- Add questions to the untested exam
    IF @untested_exam_id IS NOT NULL AND @untested_practice_mcq_type_id IS NOT NULL
    BEGIN
        -- Create first question
        INSERT INTO Questions
            (exam_id, type_id, points, body_text, difficulty)
        VALUES
            (@untested_exam_id, @untested_practice_mcq_type_id, 25, 'What is 8 + 4?', 1);
        SET @untested_practice_q1_id = SCOPE_IDENTITY();

        -- Create second question
        INSERT INTO Questions
            (exam_id, type_id, points, body_text, difficulty)
        VALUES
            (@untested_exam_id, @untested_practice_mcq_type_id, 25, 'What is 15 - 7?', 1);
        SET @untested_practice_q2_id = SCOPE_IDENTITY();

        -- Add options for the first question
        IF @untested_practice_q1_id IS NOT NULL
        BEGIN
            INSERT INTO MCQOptions
                (question_id, option_text, is_correct)
            VALUES
                (@untested_practice_q1_id, '10', 0),
                (@untested_practice_q1_id, '12', 1),
                (@untested_practice_q1_id, '14', 0);
        END

        -- Add options for the second question
        IF @untested_practice_q2_id IS NOT NULL
        BEGIN
            INSERT INTO MCQOptions
                (question_id, option_text, is_correct)
            VALUES
                (@untested_practice_q2_id, '6', 0),
                (@untested_practice_q2_id, '8', 1),
                (@untested_practice_q2_id, '10', 0);
        END
    END
END;

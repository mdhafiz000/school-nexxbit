-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(50) PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(10) NOT NULL,
    xp INT DEFAULT 0,
    streak INT DEFAULT 0,
    parent_email VARCHAR(100),
    gender VARCHAR(20),
    school VARCHAR(150),
    parent_role VARCHAR(20),
    friends TEXT[] DEFAULT '{}',
    friend_code VARCHAR(10) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    email VARCHAR(255) UNIQUE
);

-- Create Classrooms Table
CREATE TABLE IF NOT EXISTS classrooms (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    teacher_username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE
);

-- Create Classroom Students Join Table
CREATE TABLE IF NOT EXISTS classroom_students (
    classroom_id VARCHAR(50) REFERENCES classrooms(id) ON DELETE CASCADE,
    student_username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    PRIMARY KEY (classroom_id, student_username)
);

-- Create Quiz History Table
CREATE TABLE IF NOT EXISTS quiz_history (
    id SERIAL PRIMARY KEY,
    student_username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subject VARCHAR(50) NOT NULL,
    score VARCHAR(10) NOT NULL,
    accuracy INT NOT NULL,
    time_spent VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL
);

-- ==========================================================
-- Lectra Faculty Tracker - Complete MySQL DDL Schema
-- Compatible with MySQL 5.7, 8.0+ and MariaDB 10.3+
-- Ready for phpMyAdmin / Hostinger cPanel / MySQL CLI import
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- Table structure for `users`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `password` VARCHAR(191) NOT NULL,
  `role` ENUM('HOD', 'SUB_ADMIN', 'CR', 'ABSENT_CONTROLLER', 'FACULTY') NOT NULL,
  `class_name` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `fingerprint_enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_user_id_key` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `classrooms`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `classrooms` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `room_number` VARCHAR(191) NOT NULL,
  `class_name` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `classrooms_room_number_class_name_key` (`room_number`, `class_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `faculty`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `faculty` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `faculty_name` VARCHAR(191) NOT NULL,
  `phone_number` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `faculty_faculty_name_key` (`faculty_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `timetables`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `timetables` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `classroom_id` INT NOT NULL,
  `day` VARCHAR(191) NOT NULL,
  `period_no` INT NOT NULL,
  `start_time` VARCHAR(191) NOT NULL,
  `end_time` VARCHAR(191) NOT NULL,
  `faculty_name` VARCHAR(191) NOT NULL,
  `subject_name` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `timetables_classroom_id_idx` (`classroom_id`),
  CONSTRAINT `timetables_classroom_id_fkey` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `faculty_logs`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `faculty_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `classroom_id` INT NOT NULL,
  `faculty_name` VARCHAR(191) NOT NULL,
  `period_no` INT NOT NULL,
  `entry_time` DATETIME(3) NULL,
  `status` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `faculty_logs_classroom_id_idx` (`classroom_id`),
  CONSTRAINT `faculty_logs_classroom_id_fkey` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `system_settings`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(191) NOT NULL,
  `value` LONGTEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_settings_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `fingerprints`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fingerprints` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(191) NOT NULL,
  `credential_id` TEXT NOT NULL,
  `public_key` TEXT NOT NULL,
  `counter` INT NOT NULL DEFAULT 0,
  `transports` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `fingerprints_user_id_key` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `fingerprint_audit_logs`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fingerprint_audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `details` TEXT NULL,
  `ip_address` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `students`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `students` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `roll_number` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `section` VARCHAR(191) NOT NULL,
  `student_mobile` VARCHAR(191) NOT NULL,
  `parent_mobile` VARCHAR(191) NOT NULL,
  `pre_excused_start` VARCHAR(191) NULL,
  `pre_excused_end` VARCHAR(191) NULL,
  `pre_excused_reason` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `students_roll_number_key` (`roll_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `attendance`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `student_id` INT NOT NULL,
  `date` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `marked_by` INT NOT NULL,
  `is_late_comer` BOOLEAN NOT NULL DEFAULT FALSE,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `attendance_student_id_date_key` (`student_id`, `date`),
  KEY `attendance_student_id_idx` (`student_id`),
  CONSTRAINT `attendance_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `absentee_call_logs`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `absentee_call_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `student_id` INT NOT NULL,
  `date` VARCHAR(191) NOT NULL,
  `answered` BOOLEAN NOT NULL,
  `reason` TEXT NULL,
  `called_by_id` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `call_type` VARCHAR(191) NOT NULL DEFAULT 'ABSENT',
  `recipient` VARCHAR(191) NOT NULL DEFAULT 'PARENT',
  PRIMARY KEY (`id`),
  KEY `absentee_call_logs_student_id_idx` (`student_id`),
  CONSTRAINT `absentee_call_logs_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Default User Accounts (HOD, Sub Admin, CRs)
-- HOD Credentials:
--   Username: TE_HOD
--   Password: HOD_TE
-- --------------------------------------------------------
INSERT INTO `users` (`name`, `user_id`, `password`, `role`, `class_name`, `created_at`, `fingerprint_enabled`)
VALUES
  ('Dr. Rajesh Sharma (HOD)', 'TE_HOD', '$2a$10$yw.07lMQB1jXvm4ln/GpouAV3SL3ORAVaRStAtG2/7scoCM7UKPr2', 'HOD', NULL, NOW(), 0),
  ('Prof. Anjali Verma (Sub Admin)', 'subadmin123', '$2a$10$YcXb0398vYXHSw4MOCjFMeAkP4j1/Ppox5G9/MK7xmpKeJTE8Wcqq', 'SUB_ADMIN', NULL, NOW(), 0),
  ('Rahul Kumar (CR CSE 3)', 'cr_cse3', '$2a$10$YcXb0398vYXHSw4MOCjFMeAkP4j1/Ppox5G9/MK7xmpKeJTE8Wcqq', 'CR', 'CSE 3rd Year', NOW(), 0),
  ('Sneha Reddy (CR CSE 4)', 'cr_cse4', '$2a$10$YcXb0398vYXHSw4MOCjFMeAkP4j1/Ppox5G9/MK7xmpKeJTE8Wcqq', 'CR', 'CSE 4th Year', NOW(), 0),
  ('Absent Controller', 'ac123', '$2a$10$YcXb0398vYXHSw4MOCjFMeAkP4j1/Ppox5G9/MK7xmpKeJTE8Wcqq', 'ABSENT_CONTROLLER', NULL, NOW(), 0)
ON DUPLICATE KEY UPDATE
  `password` = VALUES(`password`),
  `role` = VALUES(`role`),
  `name` = VALUES(`name`);

SET FOREIGN_KEY_CHECKS = 1;

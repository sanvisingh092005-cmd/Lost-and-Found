-- =====================================================
-- schema.sql  |  Lost & Found Campus Portal
-- Database: MySQL 8.x
-- =====================================================

DROP DATABASE IF EXISTS lost_found_portal;
CREATE DATABASE lost_found_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE lost_found_portal;

-- -----------------------------------------------------
-- Table: users
-- -----------------------------------------------------
CREATE TABLE users (
  user_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name      VARCHAR(100) NOT NULL,
  email     VARCHAR(150) NOT NULL,
  password  VARCHAR(255) NOT NULL,          -- store a bcrypt hash (60 chars), never plain text
  role      ENUM('STUDENT', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: items
-- -----------------------------------------------------
CREATE TABLE items (
  item_id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id               INT UNSIGNED NOT NULL,
  title                 VARCHAR(150) NOT NULL,
  description           TEXT NOT NULL,
  category              ENUM('Electronics', 'ID/Cards', 'Books', 'Accessories', 'Other')
                        NOT NULL DEFAULT 'Other',
  location              VARCHAR(150) NOT NULL,
  item_date             DATE NOT NULL,
  type                  ENUM('LOST', 'FOUND') NOT NULL,
  status                ENUM('OPEN', 'CLAIMED') NOT NULL DEFAULT 'OPEN',
  verification_question VARCHAR(255) NOT NULL,
  contact_info          VARCHAR(150) NOT NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  CONSTRAINT fk_items_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_items_type_status (type, status),
  INDEX idx_items_category (category),
  INDEX idx_items_created_at (created_at),
  FULLTEXT KEY ft_items_search (title, description, location)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Dummy data: users (1 admin + 2 students)
-- NOTE: the password values below are DEV-ONLY PLACEHOLDERS.
-- Real logins require bcrypt hashes; the backend will include a
-- tiny seeding/rehash step so these accounts work:
--   admin@campus.edu   -> Admin@123
--   aarav@campus.edu   -> Student@123
--   priya@campus.edu   -> Student@123
-- -----------------------------------------------------
INSERT INTO users (name, email, password, role) VALUES
  ('Campus Admin',  'admin@campus.edu', 'Admin@123',   'ADMIN'),
  ('Aarav Sharma',  'aarav@campus.edu', 'Student@123', 'STUDENT'),
  ('Priya Verma',   'priya@campus.edu', 'Student@123', 'STUDENT');

-- -----------------------------------------------------
-- Dummy data: items (6 realistic campus lost/found posts)
-- -----------------------------------------------------
INSERT INTO items
  (user_id, title, description, category, location, item_date, type, status,
   verification_question, contact_info, created_at)
VALUES
  (2, 'Black boAt Bluetooth Earbuds',
   'Lost a black boAt Airdopes case with earbuds inside. Case has a small scratch on the lid and a blue sticker on the back.',
   'Electronics', 'Central Library, 2nd Floor Reading Hall', '2026-11-12', 'LOST', 'OPEN',
   'What colour is the sticker on the back of the case?',
   'aarav@campus.edu | 98765 43210', '2026-11-12 18:30:00'),

  (3, 'Student ID Card - CSE 3rd Year',
   'Found a student ID card near the canteen counter. Name is partially faded; card is in a blue lanyard.',
   'ID/Cards', 'Main Canteen', '2026-11-13', 'FOUND', 'OPEN',
   'What is the roll number printed on the card?',
   'priya@campus.edu | Hostel B, Room 214', '2026-11-13 13:10:00'),

  (3, 'Engineering Mathematics - Grewal (Vol. 2)',
   'Lost my Higher Engineering Mathematics textbook. Has my handwritten notes on the first page and a yellow sticky tab at Chapter 7.',
   'Books', 'Block C, Classroom C-105', '2026-11-10', 'LOST', 'CLAIMED',
   'Which chapter has the yellow sticky tab?',
   'priya@campus.edu | 91234 56780', '2026-11-10 09:45:00'),

  (2, 'Silver Casio Wrist Watch',
   'Found a silver analog Casio watch with a metal strap near the basketball court benches.',
   'Accessories', 'Basketball Court', '2026-11-14', 'FOUND', 'OPEN',
   'What is engraved on the back of the watch?',
   'aarav@campus.edu | 98765 43210', '2026-11-14 17:55:00'),

  (3, 'Blue Steel Water Bottle (Milton)',
   'Lost a 1-litre blue Milton steel bottle with a dent near the bottom and a Python logo sticker.',
   'Other', 'Sports Ground Pavilion', '2026-11-15', 'LOST', 'OPEN',
   'Which logo sticker is on the bottle?',
   'priya@campus.edu | Hostel B, Room 214', '2026-11-15 16:20:00'),

  (2, 'Casio FX-991EX Scientific Calculator',
   'Found a Casio FX-991EX calculator left on a desk after the Data Structures lab session.',
   'Electronics', 'Computer Lab 3, Block A', '2026-11-16', 'FOUND', 'OPEN',
   'What name or initials are written on the calculator cover?',
   'aarav@campus.edu | 98765 43210', '2026-11-16 15:05:00');
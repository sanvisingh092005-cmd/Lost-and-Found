const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'lostfound.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- Tables (same structure as schema.sql, SQLite flavour) ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    email     TEXT NOT NULL UNIQUE,
    password  TEXT NOT NULL,
    role      TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'ADMIN'))
  );

  CREATE TABLE IF NOT EXISTS items (
    item_id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               INTEGER NOT NULL
                          REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    title                 TEXT NOT NULL,
    description           TEXT NOT NULL,
    category              TEXT NOT NULL DEFAULT 'Other'
                          CHECK (category IN ('Electronics', 'ID/Cards', 'Books', 'Accessories', 'Other')),
    location              TEXT NOT NULL,
    item_date             TEXT NOT NULL,
    type                  TEXT NOT NULL CHECK (type IN ('LOST', 'FOUND')),
    status                TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLAIMED')),
    verification_question TEXT NOT NULL,
    contact_info          TEXT NOT NULL,
    created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_items_type_status ON items (type, status);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);
  CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at);
`);

// ---------- Seed dummy data (only when the database is empty) ----------
function seed() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  );
  const insertItem = db.prepare(`
    INSERT INTO items
      (user_id, title, description, category, location, item_date, type, status,
       verification_question, contact_info, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adminHash = bcrypt.hashSync('Admin@123', 10);
  const studentHash = bcrypt.hashSync('Student@123', 10);

  const run = db.transaction(() => {
    insertUser.run('Campus Admin', 'admin@campus.edu', adminHash, 'ADMIN');
    insertUser.run('Aarav Sharma', 'aarav@campus.edu', studentHash, 'STUDENT');
    insertUser.run('Priya Verma', 'priya@campus.edu', studentHash, 'STUDENT');

    insertItem.run(
      2, 'Black boAt Bluetooth Earbuds',
      'Lost a black boAt Airdopes case with earbuds inside. Case has a small scratch on the lid and a blue sticker on the back.',
      'Electronics', 'Central Library, 2nd Floor Reading Hall', '2026-11-12', 'LOST', 'OPEN',
      'What colour is the sticker on the back of the case?',
      'aarav@campus.edu | 98765 43210', '2026-11-12 18:30:00'
    );
    insertItem.run(
      3, 'Student ID Card - CSE 3rd Year',
      'Found a student ID card near the canteen counter. Name is partially faded; card is in a blue lanyard.',
      'ID/Cards', 'Main Canteen', '2026-11-13', 'FOUND', 'OPEN',
      'What is the roll number printed on the card?',
      'priya@campus.edu | Hostel B, Room 214', '2026-11-13 13:10:00'
    );
    insertItem.run(
      3, 'Engineering Mathematics - Grewal (Vol. 2)',
      'Lost my Higher Engineering Mathematics textbook. Has my handwritten notes on the first page and a yellow sticky tab at Chapter 7.',
      'Books', 'Block C, Classroom C-105', '2026-11-10', 'LOST', 'CLAIMED',
      'Which chapter has the yellow sticky tab?',
      'priya@campus.edu | 91234 56780', '2026-11-10 09:45:00'
    );
    insertItem.run(
      2, 'Silver Casio Wrist Watch',
      'Found a silver analog Casio watch with a metal strap near the basketball court benches.',
      'Accessories', 'Basketball Court', '2026-11-14', 'FOUND', 'OPEN',
      'What is engraved on the back of the watch?',
      'aarav@campus.edu | 98765 43210', '2026-11-14 17:55:00'
    );
    insertItem.run(
      3, 'Blue Steel Water Bottle (Milton)',
      'Lost a 1-litre blue Milton steel bottle with a dent near the bottom and a Python logo sticker.',
      'Other', 'Sports Ground Pavilion', '2026-11-15', 'LOST', 'OPEN',
      'Which logo sticker is on the bottle?',
      'priya@campus.edu | Hostel B, Room 214', '2026-11-15 16:20:00'
    );
    insertItem.run(
      2, 'Casio FX-991EX Scientific Calculator',
      'Found a Casio FX-991EX calculator left on a desk after the Data Structures lab session.',
      'Electronics', 'Computer Lab 3, Block A', '2026-11-16', 'FOUND', 'OPEN',
      'What name or initials are written on the calculator cover?',
      'aarav@campus.edu | 98765 43210', '2026-11-16 15:05:00'
    );
  });

  run();
  console.log('Database seeded with 3 users and 6 items.');
}

seed();

module.exports = db;
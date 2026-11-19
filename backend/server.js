const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'campus-lost-found-dev-secret';

const CATEGORIES = ['Electronics', 'ID/Cards', 'Books', 'Accessories', 'Other'];
const TYPES = ['LOST', 'FOUND'];

app.use(cors());
app.use(express.json());
// Optional: serve the frontend if you put it in backend/public
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- Helpers ----------------
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function makeToken(user) {
  return jwt.sign({ user_id: user.user_id }, JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(u) {
  return { user_id: u.user_id, name: u.name, email: u.email, role: u.role };
}

// Reads the Bearer token and loads the user from the DB.
// required = true  -> 401 if missing/invalid
// required = false -> req.user = null when missing/invalid
function auth(required) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    let user = null;

    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        user = db
          .prepare('SELECT user_id, name, email, role FROM users WHERE user_id = ?')
          .get(payload.user_id) || null;
      } catch (err) {
        user = null;
      }
    }

    if (!user && required) {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }
    req.user = user;
    next();
  };
}

// ---------------- Auth routes ----------------
app.post('/api/register', (req, res) => {
  const name = str(req.body.name);
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
  if (exists) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  // Public registration always creates a STUDENT; admins are created only via the database.
  const info = db
    .prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, 'STUDENT');

  const user = db
    .prepare('SELECT user_id, name, email, role FROM users WHERE user_id = ?')
    .get(info.lastInsertRowid);

  res.status(201).json({ token: makeToken(user), user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  res.json({ token: makeToken(user), user: publicUser(user) });
});

// ---------------- Item routes ----------------
// Browse items. Optional filters: ?type=LOST|FOUND &category=... &search=...
// contact_info is only included when the request carries a valid login token.
app.get('/api/items', auth(false), (req, res) => {
  const type = str(req.query.type).toUpperCase();
  const category = str(req.query.category);
  const search = str(req.query.search);

  const where = [];
  const params = [];

  if (type) {
    if (!TYPES.includes(type)) {
      return res.status(400).json({ error: 'type must be LOST or FOUND.' });
    }
    where.push('i.type = ?');
    params.push(type);
  }
  if (category) {
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category.' });
    }
    where.push('i.category = ?');
    params.push(category);
  }
  if (search) {
    const like = `%${search}%`;
    where.push('(i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ?)');
    params.push(like, like, like);
  }

  const sql = `
    SELECT i.*, u.name AS poster_name
    FROM items i
    JOIN users u ON u.user_id = i.user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY i.created_at DESC, i.item_id DESC
  `;

  const rows = db.prepare(sql).all(...params);
  if (!req.user) {
    rows.forEach((r) => delete r.contact_info);
  }
  res.json(rows);
});

// Create a lost/found post
app.post('/api/items', auth(true), (req, res) => {
  const title = str(req.body.title);
  const description = str(req.body.description);
  const category = str(req.body.category) || 'Other';
  const location = str(req.body.location);
  const item_date = str(req.body.item_date);
  const type = str(req.body.type).toUpperCase();
  const verification_question = str(req.body.verification_question);
  const contact_info = str(req.body.contact_info);

  if (!title || !description || !location || !item_date || !type || !verification_question || !contact_info) {
    return res.status(400).json({
      error: 'title, description, location, item_date, type, verification_question and contact_info are required.'
    });
  }
  if (title.length > 150 || location.length > 150 || contact_info.length > 150 || verification_question.length > 255) {
    return res.status(400).json({ error: 'One or more fields are too long.' });
  }
  if (!TYPES.includes(type)) {
    return res.status(400).json({ error: 'type must be LOST or FOUND.' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category.' });
  }
  if (!isDate(item_date)) {
    return res.status(400).json({ error: 'item_date must be in YYYY-MM-DD format.' });
  }

  const info = db
    .prepare(`
      INSERT INTO items
        (user_id, title, description, category, location, item_date, type, status,
         verification_question, contact_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
    `)
    .run(
      req.user.user_id, title, description, category, location, item_date, type,
      verification_question, contact_info
    );

  const item = db
    .prepare(`
      SELECT i.*, u.name AS poster_name
      FROM items i JOIN users u ON u.user_id = i.user_id
      WHERE i.item_id = ?
    `)
    .get(info.lastInsertRowid);

  res.status(201).json(item);
});

// Mark an item as CLAIMED (owner or admin only)
app.patch('/api/items/:id/claim', auth(true), (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid item id.' });

  const item = db.prepare('SELECT * FROM items WHERE item_id = ?').get(id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  if (req.user.role !== 'ADMIN' && item.user_id !== req.user.user_id) {
    return res.status(403).json({ error: 'Only the owner or an admin can mark this item as claimed.' });
  }
  if (item.status === 'CLAIMED') {
    return res.status(409).json({ error: 'This item is already marked as claimed.' });
  }

  db.prepare("UPDATE items SET status = 'CLAIMED' WHERE item_id = ?").run(id);

  const updated = db
    .prepare(`
      SELECT i.*, u.name AS poster_name
      FROM items i JOIN users u ON u.user_id = i.user_id
      WHERE i.item_id = ?
    `)
    .get(id);

  res.json(updated);
});

// Delete an item (owner or admin only)
app.delete('/api/items/:id', auth(true), (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid item id.' });

  const item = db.prepare('SELECT * FROM items WHERE item_id = ?').get(id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  if (req.user.role !== 'ADMIN' && item.user_id !== req.user.user_id) {
    return res.status(403).json({ error: 'Only the owner or an admin can delete this item.' });
  }

  db.prepare('DELETE FROM items WHERE item_id = ?').run(id);
  res.json({ message: 'Item deleted.', item_id: id });
});

// ---------------- Fallbacks ----------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`Lost & Found API running at http://localhost:${PORT}`);
});
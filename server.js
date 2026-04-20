require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── DATABASE CONNECTION ──
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to MySQL database');
  }
});

// ── ADMIN LOGIN ──
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.query(
    'SELECT * FROM admins WHERE username=? AND password=?',
    [username, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.length > 0) {
        res.json({ success: true, message: 'Login successful' });
      } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }
  );
});

// ── GET ALL STUDENTS ──
app.get('/api/students', (req, res) => {
  db.query('SELECT * FROM students', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// ── ADD STUDENT ──
app.post('/api/students', (req, res) => {
  const { id, name, email, phone, dept, year, grade, status, address } = req.body;
  db.query(
    'INSERT INTO students VALUES (?,?,?,?,?,?,?,?,?)',
    [id, name, email, phone, dept, year, grade, status, address],
    (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY')
          return res.status(400).json({ error: 'Student ID already exists' });
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, message: 'Student added successfully' });
    }
  );
});

// ── UPDATE STUDENT ──
app.put('/api/students/:id', (req, res) => {
  const { name, email, phone, dept, year, grade, status, address } = req.body;
  db.query(
    'UPDATE students SET name=?,email=?,phone=?,dept=?,year=?,grade=?,status=?,address=? WHERE id=?',
    [name, email, phone, dept, year, grade, status, address, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (result.affectedRows === 0)
        return res.status(404).json({ error: 'Student not found' });
      res.json({ success: true, message: 'Student updated successfully' });
    }
  );
});

// ── DELETE STUDENT ──
app.delete('/api/students/:id', (req, res) => {
  db.query('DELETE FROM students WHERE id=?', [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Student not found' });
    res.json({ success: true, message: 'Student deleted successfully' });
  });
});

// ── SEARCH STUDENTS ──
app.get('/api/students/search', (req, res) => {
  const { q, dept, status } = req.query;
  let sql = 'SELECT * FROM students WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (name LIKE ? OR id LIKE ? OR email LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (dept) { sql += ' AND dept=?'; params.push(dept); }
  if (status) { sql += ' AND status=?'; params.push(status); }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// ── AI PROXY (keeps API key safe on server) ──
app.post('/api/ai/chat', async (req, res) => {
  const { message, context } = req.body;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: context,
        messages: [{ role: 'user', content: message }]
      })
    });
    const data = await response.json();
    res.json({ reply: data.content?.[0]?.text || 'No response from AI.' });
  } catch (err) {
    res.status(500).json({ error: 'AI service error' });
  }
});

// ── START SERVER ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

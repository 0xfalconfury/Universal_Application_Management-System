require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Database ----------
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'application_portal',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// ---------- Uploads directory ----------
const uploadDir = path.join(__dirname, 'uploads', 'id-cards');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeId = (req.body.university_id || 'unknown')
      .toString()
      .replace(/[^a-zA-Z0-9-_]/g, '_');
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${safeId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/;
    if (!allowed.test(file.mimetype))
      return cb(new Error('ID card must be an image (jpg/png/webp) or PDF'));
    cb(null, true);
  },
});

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// ---------- Seed: default admin + letter templates ----------
async function seed() {
  const adminHash = bcrypt.hashSync('admin123', 10);
  await pool.query(
    `INSERT INTO users (university_id, role, name, email, password_hash, status)
     VALUES ('ADMIN-001', 'admin', 'Head of Department', 'admin@university.edu', $1, 'approved')
     ON CONFLICT (university_id) DO NOTHING`, [adminHash]);

  const templates = [
    {
      title: 'Application for Leave of Absence',
      body: `Date: {{date}}

To
The {{authority_title}}
{{institution}}
{{institution_address}}

Subject: Application for leave of absence

Respected Sir/Madam,

I am {{name}}, a student of {{department}}, Batch {{batch}}, bearing ID {{university_id}}. I would like to request leave from {{from_date}} to {{to_date}} due to {{reason}}. I kindly request you to grant me the leave.

Thank you for your consideration.

Yours obediently,
{{name}}
ID: {{university_id}}
Department: {{department}}
Batch: {{batch}}`
    },
    {
      title: 'Application for Bonafide Certificate',
      body: `Date: {{date}}

To
The {{authority_title}}
{{institution}}

Subject: Application for bonafide certificate

Respected Sir/Madam,

I, {{name}}, a student of {{department}}, Batch {{batch}}, ID {{university_id}}, am in need of a bonafide certificate for {{purpose}}. I therefore request you to kindly issue me the certificate at your earliest convenience.

Thank you.

Yours faithfully,
{{name}}
ID: {{university_id}}`
    },
    {
      title: 'Application for Fee Waiver',
      body: `Date: {{date}}

To
The {{authority_title}}
{{institution}}

Subject: Application for waiver of tuition fees

Respected Sir/Madam,

I, {{name}}, student of {{department}}, Batch {{batch}}, ID {{university_id}}, request a waiver of my tuition fees for the {{semester}} semester due to {{reason}}. I hope you will kindly consider my request.

Yours sincerely,
{{name}}
ID: {{university_id}}`
    }
  ];

  for (const t of templates) {
    await pool.query(
      'INSERT INTO templates (title, body) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [t.title, t.body]
    );
  }
  console.log('Seeded admin (university_id: ADMIN-001, password: admin123) and templates.');
}

// ---------- Auth routes ----------
app.post('/api/register', upload.single('id_card_file'), async (req, res) => {
  try {
    const {
      role, university_id, name, email, phone, address,
      department, advisor, batch, id_card, password,
    } = req.body;

    if (!role || !university_id || !name || !email || !password)
      return res.status(400).json({ error: 'Missing required fields' });
    if (!['student', 'teacher'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Mandatory ID card file for students
    if (role === 'student' && !req.file)
      return res.status(400).json({ error: 'Student ID card file is required' });

    const hash = bcrypt.hashSync(password, 10);
    const idCardFile = req.file
      ? path.join('uploads', 'id-cards', req.file.filename)
      : null;

    const result = await pool.query(
      `INSERT INTO users
        (university_id, role, name, email, phone, address,
         department, advisor, batch, id_card, id_card_file,
         password_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
       RETURNING id, university_id, role, name, email, status`,
      [
        university_id, role, name, email,
        phone || null, address || null,
        role === 'student' ? department : null,
        role === 'student' ? advisor : null,
        role === 'student' ? batch : null,
        role === 'student' ? id_card : null,
        idCardFile,
        hash,
      ]
    );

    res.status(201).json({
      message: 'Registration submitted. Waiting for admin approval.',
      user: result.rows[0],
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (err.code === '23505')
      return res.status(409).json({ error: 'ID or email already registered' });
    if (err.message && err.message.includes('ID card'))
      return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { university_id, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE university_id = $1', [university_id]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid ID or password' });
    if (user.active === false)                                    // ← NEW
      return res.status(403).json({ error: 'This account has been deactivated' });
    if (user.status === 'pending')
      return res.status(403).json({ error: 'Your account is waiting for admin approval' });
    if (user.status === 'rejected')
      return res.status(403).json({ error: 'Your account was rejected by admin' });

    req.session.user = {
      id: user.id, university_id: user.university_id,
      role: user.role, name: user.name
    };
    res.json({ user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.session.user }));

// ---------- Templates ----------
app.get('/api/templates', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT id, title, body FROM templates ORDER BY id');
  res.json(result.rows);
});

// ---------- Applications ----------
app.post('/api/applications', requireRole('student'), async (req, res) => {
  try {
    const { template_id, letter_date, institution_name, authority_name } = req.body;
    if (!template_id || !letter_date || !institution_name || !authority_name)
      return res.status(400).json({ error: 'All fields are required' });

    const tpl = await pool.query('SELECT * FROM templates WHERE id = $1', [template_id]);
    if (!tpl.rows.length) return res.status(404).json({ error: 'Template not found' });

    const me = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.user.id]);

    let letter = tpl.rows[0].body
      .replaceAll('{{date}}', letter_date)
      .replaceAll('{{institution}}', institution_name)
      .replaceAll('{{authority_title}}', authority_name)
      .replaceAll('{{name}}', me.rows[0].name)
      .replaceAll('{{university_id}}', me.rows[0].university_id)
      .replaceAll('{{department}}', me.rows[0].department || '')
      .replaceAll('{{batch}}', me.rows[0].batch || '');

    ['from_date','to_date','reason','purpose','semester','institution_address'].forEach(k => {
      letter = letter.replaceAll('{{' + k + '}}', req.body[k] || '');
    });

    const result = await pool.query(
      `INSERT INTO applications (user_id, template_id, letter_date, institution_name, authority_name, final_letter, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING id`,
      [req.session.user.id, template_id, letter_date, institution_name, authority_name, letter]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Application submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/applications', requireAuth, async (req, res) => {
  const role = req.session.user.role;
  let result;
  if (role === 'student') {
    result = await pool.query(
      `SELECT a.*, t.title AS template_title FROM applications a
       JOIN templates t ON t.id = a.template_id
       WHERE a.user_id = $1 ORDER BY a.created_at DESC`, [req.session.user.id]);
  } else {
    result = await pool.query(
      `SELECT a.*, t.title AS template_title, u.name AS applicant_name, u.university_id, u.department, u.batch
       FROM applications a
       JOIN templates t ON t.id = a.template_id
       JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC`);
  }
  res.json(result.rows);
});

app.get('/api/applications/:id', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT a.*, t.title AS template_title, u.name AS applicant_name, u.university_id, u.department, u.batch
     FROM applications a JOIN templates t ON t.id = a.template_id JOIN users u ON u.id = a.user_id
     WHERE a.id = $1`, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  const appRow = result.rows[0];
  if (req.session.user.role === 'student' && appRow.user_id !== req.session.user.id)
    return res.status(403).json({ error: 'Forbidden' });
  res.json(appRow);
});

// ---------- Admin: user management ----------
app.get('/api/admin/users', requireRole('admin'), async (req, res) => {
  const { status } = req.query;
  let query = `SELECT id, university_id, role, name, email, phone, address,
                      department, advisor, batch, id_card, id_card_file,
                      status, created_at
               FROM users WHERE role != 'admin'`;
  const params = [];
  if (status) { query += ' AND status = $1'; params.push(status); }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

app.post('/api/admin/users/:id/approve', requireRole('admin'), async (req, res) => {
  await pool.query(`UPDATE users SET status = 'approved' WHERE id = $1 AND role != 'admin'`, [req.params.id]);
  res.json({ message: 'User approved' });
});

app.post('/api/admin/users/:id/reject', requireRole('admin'), async (req, res) => {
  await pool.query(`UPDATE users SET status = 'rejected' WHERE id = $1 AND role != 'admin'`, [req.params.id]);
  res.json({ message: 'User rejected' });
});

// ---------- Admin: view uploaded ID card (protected) ----------
app.get('/api/admin/users/:id/id-card', requireRole('admin'), async (req, res) => {
  const r = await pool.query('SELECT id_card_file FROM users WHERE id = $1', [req.params.id]);
  if (!r.rows.length || !r.rows[0].id_card_file)
    return res.status(404).json({ error: 'No ID card on file' });

  const filePath = path.join(__dirname, r.rows[0].id_card_file);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: 'File missing on disk' });

  res.sendFile(filePath);
});

// ---------- Admin: application review ----------
app.post('/api/admin/applications/:id/review', requireRole('admin'), async (req, res) => {
  const { action, feedback } = req.body;
  if (!['approved', 'rejected'].includes(action))
    return res.status(400).json({ error: 'Action must be approved or rejected' });
  if (action === 'rejected' && !feedback)
    return res.status(400).json({ error: 'Feedback is required when rejecting' });

  const result = await pool.query(
    `UPDATE applications SET status = $1, feedback = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = $4 RETURNING id`, [action, feedback || null, req.session.user.id, req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Application not found' });
  res.json({ message: 'Application ' + action });
});

// ---------- Start ----------
app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  try {
    await seed();
  } catch (err) {
    console.error('Seed error (did you run schema.sql?):', err.message);
  }
});
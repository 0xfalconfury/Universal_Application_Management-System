// create-admin.js
// Interactive CLI to manage admin accounts.
// Run: npm run create-admin   (or) node create-admin.js
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'application_portal',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/* ==================== prompts ==================== */
function ask(question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let input = '';
    stdout.write(question);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(input.trim());
      } else if (char === '\u0003') { // Ctrl+C
        stdout.write('\n');
        process.exit(1);
      } else if (char === '\u007f' || char === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          stdout.write('\b \b');
        }
      } else {
        input += char;
        stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

async function askPassword(confirmLabel = 'Confirm Password') {
  const password = await askHidden('Password (min 6 chars, hidden): ');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
  const confirm = await askHidden(confirmLabel + ' (hidden): ');
  if (password !== confirm) throw new Error('Passwords do not match');
  return password;
}

/* ==================== helpers ==================== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pad(s, n) { return String(s).padEnd(n, ' '); }

function printAdminsTable(rows) {
  if (!rows.length) { console.log('  (no admins found)\n'); return; }
  const cols = [
    { key: 'id', label: 'ID', width: 4 },
    { key: 'university_id', label: 'University ID', width: 16 },
    { key: 'name', label: 'Name', width: 24 },
    { key: 'email', label: 'Email', width: 30 },
    { key: 'active', label: 'Active', width: 6 },
    { key: 'created_at', label: 'Created', width: 20 },
  ];
  console.log('  ' + cols.map(c => pad(c.label, c.width)).join(' '));
  console.log('  ' + cols.map(c => '-'.repeat(c.width)).join(' '));
  rows.forEach(r => {
    const line = cols.map(c => {
      let v = r[c.key];
      if (c.key === 'active') v = v ? 'yes' : 'NO';
      if (c.key === 'created_at' && v) v = new Date(v).toISOString().slice(0, 19).replace('T', ' ');
      return pad(String(v ?? ''), c.width);
    }).join(' ');
    console.log('  ' + line);
  });
  console.log('');
}

async function findAdminByIdOrUid(idOrUid) {
  const num = parseInt(idOrUid);
  let r;
  if (!Number.isNaN(num)) {
    r = await pool.query(
      `SELECT id, university_id, name, email, active, created_at
       FROM users WHERE id = $1 AND role = 'admin'`, [num]);
  }
  if (!r || !r.rows.length) {
    r = await pool.query(
      `SELECT id, university_id, name, email, active, created_at
       FROM users WHERE university_id = $1 AND role = 'admin'`, [idOrUid]);
  }
  return r.rows[0] || null;
}

/* ==================== actions ==================== */

// --- 1. Add admin ---
async function addAdmin() {
  console.log('\n--- Add New Admin ---');
  const university_id = await ask('University ID (e.g. ADMIN-002): ');
  if (!university_id) throw new Error('University ID is required');

  const name = await ask('Full Name: ');
  if (!name) throw new Error('Name is required');

  const email = await ask('Email: ');
  if (!EMAIL_RE.test(email)) throw new Error('Invalid email');

  const password = await askPassword();

  const existing = await pool.query(
    'SELECT id FROM users WHERE university_id = $1 OR email = $2',
    [university_id, email]);
  if (existing.rows.length) throw new Error('University ID or email already exists');

  const hash = bcrypt.hashSync(password, 10);
  const result = await pool.query(
    `INSERT INTO users (university_id, role, name, email, password_hash, status, active)
     VALUES ($1, 'admin', $2, $3, $4, 'approved', TRUE)
     RETURNING id, university_id, name, email`,
    [university_id, name, email, hash]);

  console.log('\n✅ Admin created:');
  printAdminsTable([{ ...result.rows[0], active: true, created_at: new Date() }]);
}

// --- 2. List admins ---
async function listAdmins() {
  console.log('\n--- All Admins ---');
  const showInactive = (await ask('Include deactivated admins? (y/N): ')).toLowerCase() === 'y';
  const query = showInactive
    ? `SELECT id, university_id, name, email, active, created_at
       FROM users WHERE role = 'admin' ORDER BY id`
    : `SELECT id, university_id, name, email, active, created_at
       FROM users WHERE role = 'admin' AND active = TRUE ORDER BY id`;
  const r = await pool.query(query);
  printAdminsTable(r.rows);
}

// --- 3. Change admin password ---
async function changePassword() {
  console.log('\n--- Change Admin Password ---');
  const key = await ask('Admin ID or University ID: ');
  const admin = await findAdminByIdOrUid(key);
  if (!admin) throw new Error('Admin not found');

  console.log(`  Target: ${admin.name} (${admin.university_id})`);

  // Confirm current password for safety
  const current = await askHidden('Current password (hidden): ');
  const row = await pool.query('SELECT password_hash FROM users WHERE id = $1', [admin.id]);
  if (!bcrypt.compareSync(current, row.rows[0].password_hash))
    throw new Error('Current password is incorrect');

  const newPassword = await askPassword('Confirm New Password');
  const hash = bcrypt.hashSync(newPassword, 10);

  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, admin.id]);
  console.log('\n✅ Password updated.');
}

// --- 4. Update admin details (name / email) ---
async function updateDetails() {
  console.log('\n--- Update Admin Details ---');
  const key = await ask('Admin ID or University ID: ');
  const admin = await findAdminByIdOrUid(key);
  if (!admin) throw new Error('Admin not found');

  console.log(`  Current name:  ${admin.name}`);
  const newName = await ask(`New name (leave blank to keep "${admin.name}"): `);

  console.log(`  Current email: ${admin.email}`);
  const newEmail = await ask(`New email (leave blank to keep "${admin.email}"): `);

  if (!newName && !newEmail) {
    console.log('  Nothing to update.');
    return;
  }
  if (newEmail && !EMAIL_RE.test(newEmail)) throw new Error('Invalid email');

  if (newEmail) {
    const dup = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id <> $2', [newEmail, admin.id]);
    if (dup.rows.length) throw new Error('Email already used by another account');
  }

  await pool.query(
    `UPDATE users
     SET name = COALESCE($1, name),
         email = COALESCE($2, email)
     WHERE id = $3`,
    [newName || null, newEmail || null, admin.id]);

  console.log('\n✅ Admin updated.');
}

// --- 5. Deactivate / reactivate ---
async function toggleActive() {
  console.log('\n--- Activate / Deactivate Admin ---');
  const key = await ask('Admin ID or University ID: ');
  const admin = await findAdminByIdOrUid(key);
  if (!admin) throw new Error('Admin not found');

  const currentlyActive = admin.active;
  const verb = currentlyActive ? 'deactivate' : 'reactivate';
  const confirm = (await ask(`Are you sure you want to ${verb} "${admin.name}"? (y/N): `)).toLowerCase();
  if (confirm !== 'y') { console.log('Cancelled.'); return; }

  await pool.query('UPDATE users SET active = $1 WHERE id = $2', [!currentlyActive, admin.id]);
  console.log(`\n✅ Admin ${currentlyActive ? 'deactivated' : 'reactivated'}.`);
}

// --- 6. Delete admin ---
async function deleteAdmin() {
  console.log('\n--- Delete Admin ---');
  const key = await ask('Admin ID or University ID: ');
  const admin = await findAdminByIdOrUid(key);
  if (!admin) throw new Error('Admin not found');

  // Prevent deleting the last remaining active admin
  const count = await pool.query(
    `SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND active = TRUE AND id <> $1`,
    [admin.id]);
  if (admin.active && count.rows[0].n === 0)
    throw new Error('Cannot delete the last active admin — add another admin first');

  // Prevent deleting yourself (session doesn't exist in CLI, so use env var)
  const selfId = process.env.CLI_ADMIN_ID ? parseInt(process.env.CLI_ADMIN_ID) : null;
  if (selfId && selfId === admin.id)
    throw new Error('Cannot delete the admin account you are currently using');

  console.log(`  You are about to delete: ${admin.name} (${admin.university_id}, ${admin.email})`);
  const confirm = await ask('Type the University ID to CONFIRM deletion (or blank to cancel): ');
  if (confirm !== admin.university_id) { console.log('Cancelled.'); return; }

  await pool.query('DELETE FROM users WHERE id = $1', [admin.id]);
  console.log('\n✅ Admin deleted.');
}

// --- 7. Promote a teacher to admin ---
async function promoteTeacher() {
  console.log('\n--- Promote Teacher to Admin ---');
  const key = await ask('Teacher University ID: ');
  const r = await pool.query(
    `SELECT id, university_id, name, email, role, status, active
     FROM users WHERE university_id = $1`, [key]);
  if (!r.rows.length) throw new Error('User not found');
  const u = r.rows[0];
  if (u.role === 'admin') throw new Error('This user is already an admin');
  if (u.role !== 'teacher') throw new Error('Only teachers can be promoted to admin');

  console.log(`  Target: ${u.name} (${u.email}), status=${u.status}, active=${u.active}`);
  const confirm = (await ask('Confirm promotion to admin? (y/N): ')).toLowerCase();
  if (confirm !== 'y') { console.log('Cancelled.'); return; }

  await pool.query(
    `UPDATE users SET role = 'admin', status = 'approved', active = TRUE WHERE id = $1`,
    [u.id]);
  console.log('\n✅ Promoted to admin.');
}

// --- 8. View single admin ---
async function viewAdmin() {
  console.log('\n--- View Admin ---');
  const key = await ask('Admin ID or University ID: ');
  const admin = await findAdminByIdOrUid(key);
  if (!admin) throw new Error('Admin not found');

  const extra = await pool.query(
    `SELECT COUNT(*)::int AS apps FROM applications WHERE reviewed_by = $1`,
    [admin.id]);

  console.log('\n  ── Admin Details ──');
  console.log(`  ID:            ${admin.id}`);
  console.log(`  University ID: ${admin.university_id}`);
  console.log(`  Name:          ${admin.name}`);
  console.log(`  Email:         ${admin.email}`);
  console.log(`  Active:        ${admin.active ? 'yes' : 'NO (deactivated)'}`);
  console.log(`  Created:       ${admin.created_at}`);
  console.log(`  Reviews done:  ${extra.rows[0].apps}`);
  console.log('');
}

/* ==================== main menu ==================== */
const MENU = `
╔══════════════════════════════════════════════════╗
║      EduApply — Admin Management Console         ║
╠══════════════════════════════════════════════════╣
║  1. Add new admin                                ║
║  2. List all admins                              ║
║  3. Change an admin's password                   ║
║  4. Update an admin's name / email               ║
║  5. Deactivate / reactivate an admin             ║
║  6. Delete an admin                              ║
║  7. Promote a teacher to admin                   ║
║  8. View a single admin's details                ║
║  9. Exit                                         ║
╚══════════════════════════════════════════════════╝
`;

async function main() {
  // Sanity check: make sure the schema has the `active` column
  try {
    await pool.query('SELECT active FROM users LIMIT 1');
  } catch (err) {
    if (err.code === '42703') {
      throw new Error(
        'Column "active" missing. Run:\n' +
        '  ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;'
      );
    }
    throw err;
  }

  while (true) {
    console.log(MENU);
    const choice = await ask('Choose an option [1-9]: ');

    try {
      switch (choice) {
        case '1': await addAdmin();       break;
        case '2': await listAdmins();     break;
        case '3': await changePassword(); break;
        case '4': await updateDetails();  break;
        case '5': await toggleActive();   break;
        case '6': await deleteAdmin();    break;
        case '7': await promoteTeacher(); break;
        case '8': await viewAdmin();      break;
        case '9':
          console.log('\nGoodbye 👋\n');
          return;
        default:
          console.log('  Invalid option. Choose 1–9.\n');
      }
    } catch (err) {
      console.error('\n❌ ' + err.message + '\n');
    }

    // Small pause so the user sees results before menu re-prints
    await ask('Press Enter to return to the menu…');
  }
}

main()
  .catch((err) => {
    console.error('\n❌ Fatal error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
    pool.end();
  });
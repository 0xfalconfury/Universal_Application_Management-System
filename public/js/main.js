/* ================= EduApply — shared helpers ================= */
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

/* click ripple effect on all buttons */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

function redirectByRole(role) {
  if (role === 'admin') window.location.href = '/admin.html';
  else if (role === 'teacher') window.location.href = '/teacher.html';
  else window.location.href = '/student.html';
}

async function requireRolePage(...roles) {
  try {
    const { user } = await api('/api/me');
    if (!roles.includes(user.role)) { window.location.href = '/index.html'; return null; }
    return user;
  } catch {
    window.location.href = '/index.html';
    return null;
  }
}

function bindLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) {
    console.warn('bindLogout: #logout-btn not found in DOM');
    return;
  }
  // Prevent double-binding if called twice
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.disabled = true;                // prevent double-click
    try {
      await api('/api/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout request failed, redirecting anyway:', err.message);
    }
    window.location.href = '/index.html';
  });
}

/* ================= Index page: login / register ================= */
const navBtns = document.querySelectorAll('.nav-btn');
navBtns.forEach(btn => btn.addEventListener('click', () => {
  navBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
}));

/* role toggle shows/hides student-only fields */
function syncStudentFields() {
  const checked = document.querySelector('input[name="reg-role"]:checked');
  const isStudent = checked && checked.value === 'student';
  document.querySelectorAll('.student-only').forEach(f => {
    f.style.display = isStudent ? '' : 'none';
    f.querySelectorAll('input').forEach(inp => { inp.required = isStudent; });
  });
}
document.querySelectorAll('input[name="reg-role"]').forEach(r =>
  r.addEventListener('change', syncStudentFields)
);
// initial sync (on page load, student is default)
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('input[name="reg-role"]')) syncStudentFields();
});

const loginForm = document.getElementById('login-form');
if (loginForm) {
  api('/api/me').then(({ user }) => redirectByRole(user.role)).catch(() => {});

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('login-msg');
    msg.textContent = ''; msg.className = 'form-msg';
    try {
      const { user } = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify(formData(loginForm)),
      });
      redirectByRole(user.role);
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('error');
    }
  });
}

const regForm = document.getElementById('register-form');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('register-msg');
    msg.textContent = ''; msg.className = 'form-msg span-2';

    const roleEl = document.querySelector('input[name="reg-role"]:checked');
    const role = roleEl ? roleEl.value : 'student';

    const fd = new FormData(regForm);
    fd.append('role', role);

    if (role === 'teacher') {
      ['department', 'advisor', 'batch', 'id_card', 'id_card_file'].forEach(k => fd.delete(k));
    }

    // client-side guard: student must attach an ID card file
    const fileInput = regForm.querySelector('input[name="id_card_file"]');
    if (role === 'student' && (!fileInput.files || !fileInput.files.length)) {
      msg.textContent = 'Please upload your student ID card.';
      msg.classList.add('error');
      return;
    }

    try {
      // NOTE: do not set Content-Type manually — browser sets multipart boundary
      const res = await fetch('/api/register', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      msg.textContent = 'Registration submitted! Please wait for admin approval, then sign in.';
      msg.classList.add('success');
      regForm.reset();
      syncStudentFields();
      toast('Account submitted for approval');
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('error');
    }
  });
}
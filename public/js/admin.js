/* ================= Admin dashboard ================= */
let currentAppId = null;

function statusBadge(s) { return '<span class="badge ' + s + '">' + s + '</span>'; }

/* ----- tabs ----- */
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab-btn');
  if (!tab) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById('tab-users').classList.toggle('hidden', tab.dataset.tab !== 'users');
  document.getElementById('tab-apps').classList.toggle('hidden', tab.dataset.tab !== 'apps');
});

/* ----- users ----- */
async function loadUsers() {
  const rows = await api('/api/admin/users');
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = rows.length ? '' : '<tr><td colspan="10" class="muted">No account requests yet.</td></tr>';

  rows.forEach(u => {
    const tr = document.createElement('tr');

    let action = '';
    if (u.status === 'pending')
      action =
        '<button class="btn btn-success btn-sm" data-approve="' + u.id + '">Approve</button> ' +
        '<button class="btn btn-danger btn-sm" data-reject="' + u.id + '">Reject</button>';

    let idCardCell = '<span class="muted">—</span>';
    if (u.id_card_file) {
      idCardCell = '<button class="btn btn-ghost btn-sm" data-idcard="' + u.id + '">View ID</button>';
    } else if (u.id_card) {
      idCardCell = '<span class="muted">' + u.id_card + '</span>';
    }

    tr.innerHTML =
      '<td>' + u.university_id + '</td>' +
      '<td>' + u.name + '</td>' +
      '<td>' + u.role + '</td>' +
      '<td>' + u.email + '</td>' +
      '<td>' + (u.phone || '—') + '</td>' +
      '<td>' + (u.department ? u.department + ' / ' + (u.batch || '—') : '—') + '</td>' +
      '<td>' + (u.advisor || '—') + '</td>' +
      '<td>' + idCardCell + '</td>' +
      '<td>' + statusBadge(u.status) + '</td>' +
      '<td>' + (action || '<span class="muted">—</span>') + '</td>';

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', async () => {
    await api('/api/admin/users/' + b.dataset.approve + '/approve', { method: 'POST' });
    toast('User approved');
    loadUsers();
  }));

  tbody.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', async () => {
    await api('/api/admin/users/' + b.dataset.reject + '/reject', { method: 'POST' });
    toast('User rejected', 'error');
    loadUsers();
  }));

  // NEW: view ID card in new tab (auth-checked)
  tbody.querySelectorAll('[data-idcard]').forEach(b => b.addEventListener('click', () => {
    window.open('/api/admin/users/' + b.dataset.idcard + '/id-card', '_blank');
  }));
}

/* ----- applications ----- */
async function loadApps() {
  const rows = await api('/api/applications');
  const tbody = document.getElementById('apps-tbody');
  tbody.innerHTML = rows.length ? '' : '<tr><td colspan="8" class="muted">No applications yet.</td></tr>';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + r.id + '</td>' +
      '<td>' + r.applicant_name + '</td>' +
      '<td>' + r.university_id + '</td>' +
      '<td>' + (r.department || '—') + '</td>' +
      '<td>' + r.template_title + '</td>' +
      '<td>' + r.institution_name + '</td>' +
      '<td>' + statusBadge(r.status) + '</td>' +
      '<td><button class="btn btn-ghost btn-sm" data-review="' + r.id + '">Review</button></td>';
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-review]').forEach(btn => btn.addEventListener('click', async () => {
    const app = await api('/api/applications/' + btn.dataset.review);
    currentAppId = app.id;
    document.getElementById('review-meta').innerHTML =
      '<span>Student: <b>' + app.applicant_name + '</b></span>' +
      '<span>ID: <b>' + app.university_id + '</b></span>' +
      '<span>Dept: <b>' + (app.department || '—') + '</b></span>' +
      '<span>Batch: <b>' + (app.batch || '—') + '</b></span>' +
      '<span>Status: ' + statusBadge(app.status) + '</span>';
    document.getElementById('modal-body').textContent = app.final_letter;
    document.getElementById('feedback').value = app.feedback || '';
    document.getElementById('modal').classList.add('open');
  }));
}

async function review(action) {
  const feedback = document.getElementById('feedback').value.trim();
  if (action === 'rejected' && !feedback) {
    toast('Feedback is required when rejecting', 'error');
    return;
  }
  try {
    await api('/api/admin/applications/' + currentAppId + '/review', {
      method: 'POST',
      body: JSON.stringify({ action, feedback }),
    });
    document.getElementById('modal').classList.remove('open');
    toast(action === 'approved' ? 'Application approved' : 'Application rejected — feedback sent');
    loadApps();
  } catch (err) {
    toast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Bind logout FIRST — even if auth check fails, user can still log out
  // (e.g. session expired mid-page; the redirect will happen anyway)
  bindLogout();

  const me = await requireRolePage('admin');
  if (!me) return;

  document.getElementById('user-name').textContent = me.name;

  loadUsers();
  loadApps();

  document.getElementById('modal-close').addEventListener('click', () =>
    document.getElementById('modal').classList.remove('open'));

  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') e.target.classList.remove('open');
  });

  document.getElementById('approve-btn').addEventListener('click', () => review('approved'));
  document.getElementById('reject-btn').addEventListener('click', () => review('rejected'));
});
/* ================= Faculty dashboard (read-only) ================= */
function statusBadge(s) { return '<span class="badge ' + s + '">' + s + '</span>'; }

document.addEventListener('DOMContentLoaded', async () => {
  const me = await requireRolePage('teacher');
  if (!me) return;
  bindLogout();
  document.getElementById('user-name').textContent = me.name;

  const rows = await api('/api/applications');
  const tbody = document.getElementById('apps-tbody');
  tbody.innerHTML = rows.length ? '' : '<tr><td colspan="9" class="muted">No applications submitted yet.</td></tr>';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + r.id + '</td>' +
      '<td>' + r.applicant_name + '</td>' +
      '<td>' + r.university_id + '</td>' +
      '<td>' + (r.department || '—') + '</td>' +
      '<td>' + (r.batch || '—') + '</td>' +
      '<td>' + r.template_title + '</td>' +
      '<td>' + r.institution_name + '</td>' +
      '<td>' + statusBadge(r.status) + '</td>' +
      '<td><button class="btn btn-ghost btn-sm" data-view="' + r.id + '">View</button></td>';
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', async () => {
    const app = await api('/api/applications/' + btn.dataset.view);
    document.getElementById('modal-title').textContent =
      app.template_title + ' — ' + app.applicant_name + ' (' + app.university_id + ')';
    document.getElementById('modal-body').textContent = app.final_letter;
    document.getElementById('modal').classList.add('open');
  }));

  document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal').classList.remove('open'));
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') e.target.classList.remove('open');
  });
});

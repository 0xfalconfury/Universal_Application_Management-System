/* ================= Student dashboard ================= */
let templates = [];
let me = null;

function renderPreview() {
  const select = document.getElementById('template-select');
  const tplId = parseInt(select.value);
  const tpl = templates.find(t => t.id === tplId);
  const box = document.getElementById('letter-preview');
  if (!tpl) {
    box.innerHTML = '<p class="muted">Select a template and fill the fields to preview your letter.</p>';
    return;
  }

  const f = document.getElementById('app-form');
  let letter = tpl.body;
  const map = {
    '{{date}}': f.letter_date.value || '____-__-__',
    '{{institution}}': f.institution_name.value || '____________',
    '{{authority_title}}': f.authority_name.value || '____________',
    '{{name}}': me ? me.name : '____________',
    '{{university_id}}': me ? me.university_id : '____',
    '{{department}}': me ? (me.department || '') : '',
    '{{batch}}': me ? (me.batch || '') : '',
  };
  f.querySelectorAll('[data-opt]').forEach(inp => {
    map['{{' + inp.dataset.opt + '}}'] = inp.value || '____________';
  });
  Object.keys(map).forEach(k => { letter = letter.replaceAll(k, map[k]); });
  box.textContent = letter;
}

function buildOptionalFields(tpl) {
  const wrap = document.getElementById('optional-fields');
  wrap.innerHTML = '';
  const defs = {
    from_date:  { label: 'Leave From', type: 'date' },
    to_date:    { label: 'Leave To', type: 'date' },
    reason:     { label: 'Reason', type: 'text' },
    purpose:    { label: 'Purpose', type: 'text' },
    semester:   { label: 'Semester', type: 'text' },
    institution_address: { label: 'Institution Address', type: 'text' },
  };
  const grid = document.createElement('div');
  grid.className = 'grid-2';
  Object.keys(defs).forEach(key => {
    if (!tpl.body.includes('{{' + key + '}}')) return;
    const d = defs[key];
    const div = document.createElement('div');
    div.className = 'field';
    div.innerHTML = '<label>' + d.label + '</label><input type="' + d.type + '" data-opt="' + key + '" />';
    grid.appendChild(div);
  });
  if (grid.children.length) wrap.appendChild(grid);
}

function statusBadge(s) { return '<span class="badge ' + s + '">' + s + '</span>'; }

async function loadMyApplications() {
  const rows = await api('/api/applications');
  const tbody = document.getElementById('apps-tbody');
  tbody.innerHTML = rows.length ? '' : '<tr><td colspan="7" class="muted">No applications yet.</td></tr>';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + r.id + '</td>' +
      '<td>' + r.template_title + '</td>' +
      '<td>' + r.institution_name + '</td>' +
      '<td>' + r.letter_date.slice(0, 10) + '</td>' +
      '<td>' + statusBadge(r.status) + '</td>' +
      '<td>' + (r.feedback ? '<span style="color:var(--danger)">' + r.feedback + '</span>' : '<span class="muted">—</span>') + '</td>' +
      '<td><button class="btn btn-ghost btn-sm" data-view="' + r.id + '">View</button></td>';
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', async () => {
    const app = await api('/api/applications/' + btn.dataset.view);
    document.getElementById('modal-title').textContent = app.template_title;
    document.getElementById('modal-body').textContent = app.final_letter;
    document.getElementById('modal').classList.add('open');
  }));
}

document.addEventListener('DOMContentLoaded', async () => {
  me = await requireRolePage('student');
  if (!me) return;
  bindLogout();
  document.getElementById('user-name').textContent = me.name;
  document.getElementById('greet-name').textContent = me.name.split(' ')[0];

  templates = await api('/api/templates');
  const select = document.getElementById('template-select');
  select.innerHTML = '<option value="">Choose an application type…</option>' +
    templates.map(t => '<option value="' + t.id + '">' + t.title + '</option>').join('');

  const form = document.getElementById('app-form');
  form.letter_date.valueAsDate = new Date();

  select.addEventListener('change', () => {
    const tpl = templates.find(t => t.id === parseInt(select.value));
    buildOptionalFields(tpl || { body: '' });
    renderPreview();
  });
  form.addEventListener('input', renderPreview);

  document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal').classList.remove('open'));
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') e.target.classList.remove('open');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('app-msg');
    msg.textContent = ''; msg.className = 'form-msg';
    const data = formData(form);
    form.querySelectorAll('[data-opt]').forEach(i => { data[i.dataset.opt] = i.value; });
    try {
      await api('/api/applications', { method: 'POST', body: JSON.stringify(data) });
      msg.textContent = 'Application submitted successfully!';
      msg.classList.add('success');
      toast('Application sent to admin');
      loadMyApplications();
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('error');
    }
  });

  loadMyApplications();
});
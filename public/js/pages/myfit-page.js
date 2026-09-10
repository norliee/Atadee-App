renderNav('myfit');
document.getElementById('myfit-heading-icon').innerHTML = ICONS.tape;
document.getElementById('myfit-heading-icon').style.color = 'var(--gold)';

const listEl = document.getElementById('profile-list');
const formWrap = document.getElementById('form-wrap');
const fieldsEl = document.getElementById('mf-fields');
const nameInput = document.getElementById('mf-name');
const formTitle = document.getElementById('form-title');
let editingId = null;

fieldsEl.innerHTML = MYFIT_FIELDS.map(f => `
  <div class="measure-field">
    <label>${f.label}</label>
    <input type="number" step="0.1" min="0" data-key="${f.key}" placeholder="0.0">
  </div>
`).join('');

function render() {
  const profiles = getMyFitProfiles();
  if (profiles.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.tape}</span>No saved profiles yet. Add yours, or one for a family member you order for.</div>`;
    return;
  }
  listEl.innerHTML = profiles.map(p => `
    <div class="card myfit-card" style="margin-bottom:12px;">
      <div>
        <div class="name">${p.name}</div>
        <div class="stats">${MYFIT_FIELDS.filter(f => p[f.key]).map(f => `${f.label.split(' ')[0]} ${p[f.key]}"`).join(' · ') || 'No measurements yet'}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline" data-edit="${p.id}" style="padding:8px 14px; font-size:.8rem;">Edit</button>
        <button class="btn btn-outline" data-delete="${p.id}" style="padding:8px 14px; font-size:.8rem;">Delete</button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openForm(btn.dataset.edit)));
  listEl.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => {
    deleteMyFitProfile(btn.dataset.delete);
    toast('Profile deleted');
    render();
  }));
}

function openForm(id) {
  editingId = id || null;
  const profile = id ? getMyFitProfiles().find(p => p.id === id) : null;
  formTitle.textContent = profile ? `Edit ${profile.name}` : 'New profile';
  nameInput.value = profile ? profile.name : '';
  fieldsEl.querySelectorAll('input').forEach(inp => {
    inp.value = profile && profile[inp.dataset.key] ? profile[inp.dataset.key] : '';
  });
  formWrap.style.display = 'block';
  formWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.getElementById('add-profile-btn').addEventListener('click', () => openForm(null));
document.getElementById('mf-cancel').addEventListener('click', () => { formWrap.style.display = 'none'; });

document.getElementById('mf-save').addEventListener('click', () => {
  if (!nameInput.value.trim()) { toast('Give this profile a name first'); return; }
  const profile = { id: editingId || `mf_${Date.now()}`, name: nameInput.value.trim() };
  fieldsEl.querySelectorAll('input').forEach(inp => {
    if (inp.value) profile[inp.dataset.key] = Number(inp.value);
  });
  upsertMyFitProfile(profile);
  formWrap.style.display = 'none';
  toast('Profile saved');
  render();
});

render();

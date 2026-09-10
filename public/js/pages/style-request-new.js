renderNav('requests');

const root = document.getElementById('root');

const CHANGE_LABELS = {
  different_fabric: 'Different fabric',
  longer_sleeves: 'Longer sleeves',
  different_neckline: 'Different neckline',
  different_colour: 'Different colour',
  less_fitted: 'Less fitted',
  add_embroidery: 'Add embroidery',
  make_similar: 'Just make something similar'
};

async function load() {
  const [garments, categories] = await Promise.all([api('/api/garments'), api('/api/categories')]);

  root.innerHTML = `
    <h1 style="font-size:1.4rem; display:flex; align-items:center; gap:10px;"><span class="icon" style="color:var(--gold);">${ICONS.needle}</span>Post a style request</h1>
    <p class="muted">Have a screenshot from Instagram, Pinterest, or WhatsApp? Upload it and tell us what to change — interested designers will send you quotes.</p>

    <div class="card" style="padding:22px; margin-top:16px;">
      <label class="upload-zone" for="ref-upload" style="display:block; margin-bottom:14px;">
        <span class="icon">${ICONS.mannequin}</span>
        <div style="font-size:.85rem;">Upload a reference photo (optional)</div>
      </label>
      <input type="file" id="ref-upload" accept="image/*" style="display:none;">
      <div class="thumb-row" id="ref-preview"></div>

      <div class="measure-field" style="margin-top:16px;"><label>What are you making?</label>
        <select id="garment"><option value="">Not sure / general</option>${garments.map(g => `<option value="${g.key}">${g.label}</option>`).join('')}</select>
      </div>
      <div class="measure-field"><label>Category</label>
        <select id="category"><option value="">Any category</option>${categories.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
      </div>

      <div class="measure-field">
        <label>What would you like changed or customized? (optional)</label>
        <div class="change-chip-grid" id="changes-grid"></div>
      </div>

      <div class="measure-field"><label>Anything else designers should know?</label><input id="notes" placeholder="Fabric preference, occasion, inspiration details…"></div>
      <div class="measure-field"><label>Your location</label><input id="location" placeholder="e.g. East Legon, Accra"></div>
      <div class="measure-field"><label>Budget range (optional, GH₵)</label>
        <div style="display:flex; gap:10px;">
          <input id="budget-min" type="number" placeholder="Min">
          <input id="budget-max" type="number" placeholder="Max">
        </div>
      </div>
      <div class="measure-field"><label>Needed by (optional)</label><input type="date" id="deadline"></div>

      <h3 style="font-size:.95rem; margin-top:18px;">Your details</h3>
      <div class="measure-field"><label>Full name</label><input id="customer-name" placeholder="e.g. Abena Owusu"></div>
      <div class="measure-field"><label>Phone number</label><input id="customer-phone" placeholder="e.g. 024 123 4567"></div>

      <button class="btn btn-primary btn-block" id="submit-btn" type="button" style="margin-top:10px;">Post request</button>
    </div>
  `;

  const changesGrid = document.getElementById('changes-grid');
  const selectedChanges = new Set();
  changesGrid.innerHTML = Object.entries(CHANGE_LABELS).map(([key, label]) => `<button type="button" class="change-chip" data-key="${key}">${label}</button>`).join('');
  changesGrid.querySelectorAll('.change-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (selectedChanges.has(chip.dataset.key)) { selectedChanges.delete(chip.dataset.key); chip.classList.remove('active'); }
      else { selectedChanges.add(chip.dataset.key); chip.classList.add('active'); }
    });
  });

  let refImageUrl = null;
  document.getElementById('ref-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const form = new FormData();
      form.append('photo', file);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      refImageUrl = data.url;
      document.getElementById('ref-preview').innerHTML = `<img src="${refImageUrl}">`;
    } catch (err) { toast(err.message); }
  });

  document.getElementById('submit-btn').addEventListener('click', async (e) => {
    const customerName = document.getElementById('customer-name').value;
    const customerPhone = document.getElementById('customer-phone').value;
    if (!customerName || !customerPhone) { toast('Add your name and phone number'); return; }

    e.target.disabled = true; e.target.textContent = 'Posting…';
    try {
      const result = await api('/api/style-requests', {
        method: 'POST',
        body: JSON.stringify({
          customerName, customerPhone,
          garmentType: document.getElementById('garment').value || null,
          category: document.getElementById('category').value || null,
          referenceImageUrl: refImageUrl,
          changesWanted: [...selectedChanges],
          notes: document.getElementById('notes').value || null,
          location: document.getElementById('location').value || null,
          budgetMin: document.getElementById('budget-min').value || null,
          budgetMax: document.getElementById('budget-max').value || null,
          deadline: document.getElementById('deadline').value || null
        })
      });
      window.location.href = `/style-request-view.html?id=${result.id}`;
    } catch (err) {
      toast(err.message);
      e.target.disabled = false; e.target.textContent = 'Post request';
    }
  });
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

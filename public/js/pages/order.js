renderNav('browse');

const root = document.getElementById('order-root');
const designerId = qs('designerId');
const garmentKey = qs('garment');

const GARMENT_ICONS = {
  mens_shirt: 'mannequin',
  mens_suit: 'mannequin',
  kaftan_agbada: 'spool',
  womens_dress: 'mannequin',
  kaba_slit: 'mannequin',
  kids_outfit: 'scissors'
};

const CHANGE_LABELS = {
  different_fabric: 'Different fabric',
  longer_sleeves: 'Longer sleeves',
  different_neckline: 'Different neckline',
  different_colour: 'Different colour',
  less_fitted: 'Less fitted',
  add_embroidery: 'Add embroidery',
  make_similar: 'Just make something similar'
};
const selectedChanges = new Set();

async function load() {
  const designer = await api(`/api/designers/${designerId}`);

  if (!garmentKey) {
    root.innerHTML = `
      <div class="empty-state">
        <span class="icon">${ICONS.spool}</span>
        Pick what you'd like made from ${designer.name}'s page first.
        <div style="margin-top:16px;"><a class="btn btn-primary" href="/designer.html?id=${designerId}">View ${designer.name}</a></div>
      </div>`;
    return;
  }

  const garments = await api('/api/garments');
  const garment = garments.find(g => g.key === garmentKey);
  if (!garment) { root.innerHTML = `<div class="empty-state">Unknown garment type.</div>`; return; }

  document.title = `${garment.label} — atadeɛ`;

  const myfitProfiles = getMyFitProfiles();

  const pendingStyleRequestRaw = localStorage.getItem('atadee_pending_style_request');
  let pendingStyleRequest = null;
  try { pendingStyleRequest = pendingStyleRequestRaw ? JSON.parse(pendingStyleRequestRaw) : null; } catch {}

  root.innerHTML = `
    <a href="/designer.html?id=${designerId}" class="muted" style="font-size:.85rem;">&larr; Back to ${designer.name}</a>
    <h1 style="font-size:1.5rem; margin-top:10px; display:flex; align-items:center; gap:10px;"><span class="icon" style="color:var(--gold); width:26px; height:26px;">${ICONS[GARMENT_ICONS[garmentKey] || 'needle']}</span>${garment.label}</h1>
    <p class="muted">for ${designer.name} · ${designer.location}</p>

    ${pendingStyleRequest ? `
    <div class="card" style="padding:16px; margin-top:14px; display:flex; gap:14px; align-items:center; border-color:var(--gold-soft);">
      ${pendingStyleRequest.referenceImageUrl ? `<img src="${pendingStyleRequest.referenceImageUrl}" style="width:56px; height:56px; object-fit:cover; border-radius:10px; flex-shrink:0;">` : `<span class="icon" style="width:32px;height:32px;color:var(--gold);">${ICONS.heart}</span>`}
      <p class="muted" style="font-size:.85rem; margin:0;">Continuing from your accepted style request — your reference photo and notes have been added below.</p>
    </div>` : ''}

    <form id="order-form">
      <div class="card" style="padding:20px; margin-top:16px;">
        <h2 style="font-size:1rem;">Inspiration photo <span class="muted" style="font-weight:400;">(optional)</span></h2>
        <p class="muted" style="font-size:.82rem;">Have a screenshot or photo of the style you want? Upload it so your designer knows exactly what you're picturing.</p>
        <label class="upload-zone" for="inspo-upload" style="display:block; margin-top:10px;">
          <span class="icon">${ICONS.mannequin}</span>
          <div style="font-size:.85rem;">${pendingStyleRequest?.referenceImageUrl ? 'Replace inspiration photo' : 'Upload a photo'}</div>
        </label>
        <input type="file" id="inspo-upload" accept="image/*" style="display:none;">
        <div class="thumb-row" id="inspo-preview">${pendingStyleRequest?.referenceImageUrl ? `<img src="${pendingStyleRequest.referenceImageUrl}">` : ''}</div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h2 style="font-size:1rem;">Anything to change from your inspiration photo? <span class="muted" style="font-weight:400;">(optional)</span></h2>
        <div class="change-chip-grid" id="changes-grid"></div>
        <div class="measure-field" style="margin-top:12px;"><label>Or describe it in your own words</label><input id="changes-custom" placeholder="e.g. Make the sleeves puffier, use a heavier fabric…"></div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <div class="section-title" style="margin-bottom:6px;">
          <h2 style="font-size:1rem; margin:0;">Your measurements (inches)</h2>
          ${myfitProfiles.length ? `<select id="myfit-select" style="padding:8px 12px; border-radius:8px; border:1px solid var(--line); font-size:.82rem;">
            <option value="">Use a MyFit profile…</option>
            ${myfitProfiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>` : `<a href="/myfit.html" class="muted" style="font-size:.78rem; text-decoration:underline;">Save a MyFit profile</a>`}
        </div>
        <div id="myfit-consent-note"></div>
        <div class="progress-label"><span id="progress-text">0 of ${garment.fields.length} added</span></div>
        <div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%;"></div></div>
        <div id="fields" style="margin-top:14px;"></div>
      </div>

      <div id="size-preview"></div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h2 style="font-size:1rem;">Who is this for?</h2>
        <div class="toggle-row">
          <button type="button" class="toggle-option active" id="for-self" data-for="self">Myself</button>
          <button type="button" class="toggle-option" id="for-other" data-for="other">Someone else in Ghana</button>
        </div>
        <div id="recipient-fields" style="display:none;">
          <div class="measure-field"><label>Recipient's full name</label><input id="recipient-name" placeholder="e.g. Kwabena Owusu"></div>
          <div class="measure-field"><label>Recipient's phone number</label><input id="recipient-phone" placeholder="e.g. 024 123 4567"></div>
          <div class="measure-field"><label>Delivery address in Ghana</label><input id="delivery-address" placeholder="e.g. House No. 12, East Legon, Accra"></div>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h2 style="font-size:1rem;">Your details</h2>
        <div class="measure-field"><label>Full name</label><input required id="customer-name" placeholder="e.g. Abena Owusu"></div>
        <div class="measure-field"><label>Phone / WhatsApp number</label><input required id="customer-phone" placeholder="e.g. 024 123 4567"></div>
        <div class="measure-field"><label>Ordering from</label>
          <select id="customer-country">
            <option>Ghana</option>
            <option>United Kingdom</option>
            <option>United States</option>
            <option>Canada</option>
            <option>Nigeria</option>
            <option>Other</option>
          </select>
        </div>
        <p class="muted" id="abroad-note" style="display:none; font-size:.8rem; margin-top:-8px;">Prices are shown in Ghana cedis (GH₵). Payment can be made by card from anywhere; delivery is arranged within Ghana or internationally by agreement with the designer.</p>
        <div class="measure-field"><label>Budget range (optional, GH₵)</label>
          <div style="display:flex; gap:10px;">
            <input id="budget-min" type="number" placeholder="Min">
            <input id="budget-max" type="number" placeholder="Max">
          </div>
        </div>
        <div class="measure-field"><label>Notes for the designer (optional)</label><input id="notes" placeholder="Fabric preference, event date, style reference…"></div>
      </div>

      <button class="btn btn-primary btn-block" type="submit" id="submit-btn" style="margin-top:16px;">Place order</button>
    </form>
  `;

  let uploadedRefUrl = pendingStyleRequest?.referenceImageUrl || null;

  if (pendingStyleRequest) {
    const combinedNotes = pendingStyleRequest.notes || '';
    if (combinedNotes) document.getElementById('notes').value = combinedNotes;
    (pendingStyleRequest.changesWanted || []).forEach(key => selectedChanges.add(key));
    localStorage.removeItem('atadee_pending_style_request');
  }

  const changesGrid = document.getElementById('changes-grid');
  changesGrid.innerHTML = Object.entries(CHANGE_LABELS).map(([key, label]) => `<button type="button" class="change-chip ${selectedChanges.has(key) ? 'active' : ''}" data-key="${key}">${label}</button>`).join('');
  changesGrid.querySelectorAll('.change-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (selectedChanges.has(chip.dataset.key)) { selectedChanges.delete(chip.dataset.key); chip.classList.remove('active'); }
      else { selectedChanges.add(chip.dataset.key); chip.classList.add('active'); }
    });
  });

  document.getElementById('inspo-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const form = new FormData();
      form.append('photo', file);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      uploadedRefUrl = data.url;
      document.getElementById('inspo-preview').innerHTML = `<img src="${uploadedRefUrl}">`;
    } catch (err) { toast(err.message); }
  });

  // Order-for toggle
  let orderFor = 'self';
  const recipientFields = document.getElementById('recipient-fields');
  document.getElementById('for-self').addEventListener('click', () => {
    orderFor = 'self';
    document.getElementById('for-self').classList.add('active');
    document.getElementById('for-other').classList.remove('active');
    recipientFields.style.display = 'none';
  });
  document.getElementById('for-other').addEventListener('click', () => {
    orderFor = 'other';
    document.getElementById('for-other').classList.add('active');
    document.getElementById('for-self').classList.remove('active');
    recipientFields.style.display = 'block';
  });

  document.getElementById('customer-country').addEventListener('change', (e) => {
    document.getElementById('abroad-note').style.display = e.target.value === 'Ghana' ? 'none' : 'block';
  });

  // Measurement fields with guided text
  const fieldsEl = document.getElementById('fields');
  fieldsEl.innerHTML = garment.fields.map(f => `
    <div class="measure-field">
      <label>${f.label}</label>
      <input type="number" step="0.1" min="0" data-field="${f.key}" placeholder="0.0">
      <div class="guide-text"><span class="icon">${ICONS.tape}</span><span>${f.guide}</span></div>
    </div>
  `).join('');

  const previewEl = document.getElementById('size-preview');
  const inputs = fieldsEl.querySelectorAll('input');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  function updateProgress() {
    const filled = [...inputs].filter(i => i.value).length;
    progressFill.style.width = `${(filled / inputs.length) * 100}%`;
    progressText.textContent = `${filled} of ${inputs.length} added`;
  }

  let previewRequestId = 0;
  async function updatePreview() {
    const measurements = {};
    inputs.forEach(inp => { if (inp.value) measurements[inp.dataset.field] = Number(inp.value); });
    updateProgress();
    const thisRequestId = ++previewRequestId;
    try {
      const sizeResult = await api('/api/size-check', {
        method: 'POST',
        body: JSON.stringify({ garmentType: garmentKey, measurements })
      });
      if (thisRequestId !== previewRequestId) return; // a newer request already resolved — ignore this stale one
      previewEl.innerHTML = `
        <div class="size-preview">
          <span class="icon">${ICONS.tape}</span>
          <div>
            <div class="muted" style="font-size:.8rem;">Estimated size</div>
            <div class="size-big">${sizeResult.size}</div>
            <div class="muted" style="font-size:.85rem;">${sizeResult.note}</div>
          </div>
        </div>`;
    } catch {
      if (thisRequestId !== previewRequestId) return;
      previewEl.innerHTML = `<p class="muted" style="margin-top:16px;">Fill in your measurements above to see your estimated size.</p>`;
    }
  }
  inputs.forEach(inp => inp.addEventListener('input', updatePreview));
  updatePreview();

  const myfitSelect = document.getElementById('myfit-select');
  if (myfitSelect) {
    myfitSelect.addEventListener('change', () => {
      if (!myfitSelect.value) return;
      const profile = myfitProfiles.find(p => p.id === myfitSelect.value);
      const consent = confirm(`Share ${profile.name}'s measurements with ${designer.name} for this order only?\n\nYour measurements are never shared with any other designer.`);
      if (!consent) { myfitSelect.value = ''; syncPrettySelectLabel(myfitSelect); return; }
      const applied = applyMyFitToGarment(profile, garment.fields);
      inputs.forEach(inp => {
        if (applied[inp.dataset.field] !== undefined) inp.value = applied[inp.dataset.field];
      });
      updatePreview();
      toast(`Applied ${profile.name}'s measurements`);
      const noteEl = document.getElementById('myfit-consent-note');
      if (noteEl) noteEl.innerHTML = `<div class="consent-note">Sharing ${profile.name}'s measurements with <strong>${designer.name}</strong> for this order only.</div>`;
    });
  }

  document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const measurements = {};
    inputs.forEach(inp => { if (inp.value) measurements[inp.dataset.field] = Number(inp.value); });

    if (Object.keys(measurements).length === 0) {
      toast('Add at least your key measurement before requesting a quote.');
      return;
    }
    if (orderFor === 'other') {
      const rn = document.getElementById('recipient-name').value;
      const rp = document.getElementById('recipient-phone').value;
      const da = document.getElementById('delivery-address').value;
      if (!rn || !rp || !da) { toast("Add the recipient's name, phone and delivery address"); return; }
    }

    btn.disabled = true; btn.textContent = 'Placing order…';
    try {
      const result = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          designerId: Number(designerId),
          customerName: document.getElementById('customer-name').value,
          customerPhone: document.getElementById('customer-phone').value,
          garmentType: garmentKey,
          measurements,
          budgetMin: document.getElementById('budget-min').value || null,
          budgetMax: document.getElementById('budget-max').value || null,
          notes: document.getElementById('notes').value || null,
          orderFor,
          recipientName: orderFor === 'other' ? document.getElementById('recipient-name').value : null,
          recipientPhone: orderFor === 'other' ? document.getElementById('recipient-phone').value : null,
          customerCountry: document.getElementById('customer-country').value,
          deliveryCountry: 'Ghana',
          deliveryAddress: orderFor === 'other' ? document.getElementById('delivery-address').value : null,
          referenceImageUrl: uploadedRefUrl,
          changesWanted: [...selectedChanges],
          changesCustom: document.getElementById('changes-custom').value || null
        })
      });
      window.location.href = `/track.html?id=${result.orderId}`;
    } catch (err) {
      toast(err.message);
      btn.disabled = false; btn.textContent = 'Place order';
    }
  });
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

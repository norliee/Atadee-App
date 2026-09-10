renderNav(null);

const root = document.getElementById('root');
let code = qs('code');

async function showCodeEntry(errorMsg) {
  root.innerHTML = `
    <h1 style="font-size:1.4rem;">Join a group order</h1>
    <p class="muted">Enter the code your organizer shared with you.</p>
    <div class="card" style="padding:22px; margin-top:16px;">
      ${errorMsg ? `<p style="color:var(--terracotta); font-size:.85rem; margin-top:0;">${errorMsg}</p>` : ''}
      <div class="measure-field"><label>Group code</label><input id="code-input" placeholder="e.g. VQDJGH" style="text-transform:uppercase;"></div>
      <button class="btn btn-primary btn-block" id="go-btn" type="button">Continue</button>
    </div>
  `;
  document.getElementById('go-btn').addEventListener('click', () => {
    const val = document.getElementById('code-input').value.trim();
    if (!val) { toast('Enter a code'); return; }
    window.location.href = `/group-order-join.html?code=${val.toUpperCase()}`;
  });
}

async function load() {
  if (!code) { showCodeEntry(); return; }

  let group;
  try {
    group = await api(`/api/group-orders/code/${code}`);
  } catch (err) {
    showCodeEntry(err.message);
    return;
  }

  if (group.status !== 'open') {
    root.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.scissors}</span>This group order is closed to new members.</div>`;
    return;
  }

  const garments = await api('/api/garments');
  const garment = garments.find(g => g.key === group.garment_type);

  root.innerHTML = `
    <h1 style="font-size:1.4rem;">${group.title}</h1>
    <p class="muted">${garment.label} with ${group.designer.name}, ${group.designer.location} · ${group.memberCount} joined so far</p>

    <form id="join-form">
      <div class="card" style="padding:20px; margin-top:16px;">
        <h2 style="font-size:1rem;">Your measurements (inches)</h2>
        <div id="fields" style="margin-top:10px;"></div>
      </div>
      <div id="size-preview"></div>
      <div class="card" style="padding:20px; margin-top:16px;">
        <h2 style="font-size:1rem;">Your details</h2>
        <div class="measure-field"><label>Full name</label><input required id="customer-name" placeholder="e.g. Kwame Asante"></div>
        <div class="measure-field"><label>Phone number</label><input required id="customer-phone" placeholder="e.g. 024 123 4567"></div>
      </div>
      <button class="btn btn-primary btn-block" id="submit-btn" type="submit" style="margin-top:16px;">Join group order</button>
    </form>
  `;

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

  async function updatePreview() {
    const measurements = {};
    inputs.forEach(inp => { if (inp.value) measurements[inp.dataset.field] = Number(inp.value); });
    try {
      const sizeResult = await api('/api/size-check', { method: 'POST', body: JSON.stringify({ garmentType: group.garment_type, measurements }) });
      previewEl.innerHTML = `<div class="size-preview"><span class="icon">${ICONS.tape}</span><div><div class="muted" style="font-size:.8rem;">Estimated size</div><div class="size-big">${sizeResult.size}</div><div class="muted" style="font-size:.85rem;">${sizeResult.note}</div></div></div>`;
    } catch { previewEl.innerHTML = `<p class="muted" style="margin-top:16px;">Fill in your measurements to see your estimated size.</p>`; }
  }
  inputs.forEach(inp => inp.addEventListener('input', updatePreview));
  updatePreview();

  document.getElementById('join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const measurements = {};
    inputs.forEach(inp => { if (inp.value) measurements[inp.dataset.field] = Number(inp.value); });
    if (Object.keys(measurements).length === 0) { toast('Add at least your key measurement'); return; }

    btn.disabled = true; btn.textContent = 'Joining…';
    try {
      const result = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          designerId: group.designer.id,
          customerName: document.getElementById('customer-name').value,
          customerPhone: document.getElementById('customer-phone').value,
          garmentType: group.garment_type,
          measurements,
          groupOrderId: group.id
        })
      });
      root.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.heart}</span>You're in! ${group.designer.name} will follow up.<div style="margin-top:16px;"><a class="btn btn-primary" href="/track.html?id=${result.orderId}">Track your order</a></div></div>`;
    } catch (err) {
      toast(err.message);
      btn.disabled = false; btn.textContent = 'Join group order';
    }
  });
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

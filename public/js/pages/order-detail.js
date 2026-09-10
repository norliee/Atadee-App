renderNav(null);

const root = document.getElementById('root');
const orderId = qs('id');
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
  const order = await api(`/api/orders/${orderId}`);

  const measurements = Object.entries(order.measurements || {});

  root.innerHTML = `
    <a href="/dashboard.html" class="muted" style="font-size:.85rem;">&larr; Back to dashboard</a>
    <h1 style="font-size:1.5rem; margin-top:10px; text-transform:capitalize;">${order.garment_type.replace(/_/g, ' ')}</h1>
    <p class="muted">Order #${order.id} · <span class="pill">${STATUS_LABELS[order.status]}</span></p>

    <div class="card" style="padding:20px;">
      <h2 style="font-size:1rem; margin:0;">Customer</h2>
      <p style="margin:6px 0 0;"><strong>${order.customer_name}</strong> · ${order.customer_phone}</p>
      ${order.customer_country && order.customer_country !== 'Ghana' ? `<p class="muted" style="font-size:.85rem;">Ordering from ${order.customer_country}</p>` : ''}
    </div>

    ${measurements.length ? `
    <div class="detail-section">
      <h2><span class="icon">${ICONS.tape}</span>Measurements (inches)</h2>
      <div class="measure-display-grid">
        ${measurements.map(([k, v]) => `
          <div class="measure-display-card">
            <div class="value">${v}<span class="unit">"</span></div>
            <div class="label">${k.replace(/_/g, ' ')}</div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${order.reference_image_url ? `
    <div class="detail-section">
      <h2><span class="icon">${ICONS.mannequin}</span>Inspiration photo</h2>
      <div class="inspo-photo-frame" id="inspo-frame">
        <img src="${order.reference_image_url}" alt="Inspiration photo">
        <span class="expand-hint">${ICONS.mannequin} Click to zoom</span>
      </div>
    </div>` : ''}

    ${(order.changes_wanted && order.changes_wanted.length) || order.changes_custom ? `
    <div class="detail-section">
      <h2><span class="icon">${ICONS.scissors}</span>Requested changes from the photo</h2>
      ${order.changes_wanted && order.changes_wanted.length ? `
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
          ${order.changes_wanted.map(key => `<span class="pill" style="background:rgba(201,162,75,.18);">${CHANGE_LABELS[key] || key}</span>`).join('')}
        </div>` : ''}
      ${order.changes_custom ? `<p style="margin-top:${order.changes_wanted && order.changes_wanted.length ? '10px' : '6px'};">${order.changes_custom}</p>` : ''}
    </div>` : ''}

    ${(order.budget_min || order.budget_max) ? `
    <div class="detail-section">
      <h2><span class="icon">${ICONS.spool}</span>Customer's budget</h2>
      <p style="font-size:1.1rem; font-weight:700; color:var(--forest-deep); margin-top:6px;">${money(order.budget_min || 0)} – ${money(order.budget_max || 0)}</p>
    </div>` : ''}

    ${order.notes ? `
    <div class="detail-section">
      <h2><span class="icon">${ICONS.needle}</span>Notes from the customer</h2>
      <p style="font-size:1rem; margin-top:6px;">${order.notes}</p>
    </div>` : ''}

    ${order.order_for === 'other' ? `
    <div class="detail-section">
      <h2><span class="icon">${ICONS.heart}</span>Delivering to someone else</h2>
      <p style="margin-top:6px;"><strong>${order.recipient_name}</strong> · ${order.recipient_phone}</p>
      <p class="muted" style="font-size:.9rem;">${order.delivery_address || ''}${order.delivery_country ? ', ' + order.delivery_country : ''}</p>
    </div>` : ''}

    <div class="detail-section" style="margin-bottom:30px;">
      <a class="btn btn-gold" href="/messages.html?orderId=${order.id}&as=designer">
        <span class="icon" style="width:16px;height:16px;">${ICONS.needle}</span>Message ${order.customer_name}
      </a>
    </div>
  `;

  if (order.reference_image_url) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    document.getElementById('inspo-frame').addEventListener('click', () => {
      lightboxImg.src = order.reference_image_url;
      lightboxImg.classList.remove('zoomed');
      lightbox.style.display = 'flex';
    });
    lightboxImg.addEventListener('click', (e) => { e.stopPropagation(); lightboxImg.classList.toggle('zoomed'); });
    document.getElementById('lightbox-close').addEventListener('click', () => { lightbox.style.display = 'none'; });
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.style.display = 'none'; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lightbox.style.display = 'none'; });
  }
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

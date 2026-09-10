renderNav('my-orders');

const root = document.getElementById('root');
let activeTab = 'active';
let allOrders = [];

async function load() {
  let user;
  try { user = await api('/api/auth/me'); } catch { user = null; }
  if (!user) {
    root.innerHTML = `
      <div class="empty-state">
        <span class="icon">${ICONS.heart}</span>
        Sign in to see your orders in one place.
        <div style="margin-top:16px;"><a class="btn btn-primary" href="/login.html?redirect=/my-orders.html">Sign in</a></div>
      </div>`;
    return;
  }

  try {
    allOrders = await api('/api/orders/mine');
  } catch (err) {
    root.innerHTML = `<div class="empty-state">${err.message}</div>`;
    return;
  }

  root.innerHTML = `
    <div class="myorders-tabs" id="myorders-tabs">
      <button data-tab="active" class="active">Active</button>
      <button data-tab="completed">Completed</button>
    </div>
    <div id="orders-list"></div>
  `;

  document.querySelectorAll('#myorders-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('#myorders-tabs button').forEach(b => b.classList.toggle('active', b === btn));
      renderList();
    });
  });

  renderList();
}

function renderList() {
  const listEl = document.getElementById('orders-list');
  const filtered = allOrders.filter(o => activeTab === 'completed' ? o.status === 'completed' : o.status !== 'completed');

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.scissors}</span>No ${activeTab} orders${activeTab === 'active' ? ' — browse designers to place one.' : ' yet.'}</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(o => {
    const idx = STATUS_FLOW.indexOf(o.status);
    const pct = Math.round((idx / (STATUS_FLOW.length - 1)) * 100);
    const expected = new Date(new Date(o.created_at.replace(' ', 'T') + 'Z').getTime() + (o.designer_turnaround_days || 14) * 86400000);
    return `
    <div class="card order-card" data-order-toggle="${o.id}">
      <div class="order-card-head">
        <div>
          <strong style="font-family:'Fraunces',serif; color:var(--forest-deep); font-size:1.05rem;">${o.garment_type.replace('_', ' ')}</strong>
          <div class="muted" style="font-size:.85rem;">${o.designer_name}</div>
        </div>
        <span class="pill">${STATUS_LABELS[o.status]}</span>
      </div>
      <div class="order-progress-track"><div class="order-progress-fill" style="width:${pct}%;"></div></div>
      <div style="display:flex; justify-content:space-between; font-size:.82rem;" class="muted">
        <span>${pct}% complete</span>
        <span>Expected: ${expected.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </div>
      ${o.quoted_price ? `<div class="muted" style="font-size:.82rem; margin-top:6px;">Payment: ${o.payment_status === 'paid' ? 'Paid in full' : o.payment_status === 'partial' ? `${money(o.amount_paid)} of ${money(o.quoted_price)} paid` : 'Not yet paid'}</div>` : ''}

      <div class="order-checklist">
        ${STATUS_FLOW.map((s, i) => `
          <div class="checklist-item ${i < idx ? 'done' : i === idx ? 'current' : ''}">
            <span class="checklist-dot">${i < idx ? '✓' : i === idx ? '●' : '○'}</span>${STATUS_LABELS[s]}
          </div>
        `).join('')}
      </div>
      <a href="/track.html?id=${o.id}" class="btn btn-outline" style="margin-top:14px; padding:9px 16px; font-size:.82rem;" onclick="event.stopPropagation()">View full details</a>
    </div>`;
  }).join('');

  listEl.querySelectorAll('[data-order-toggle]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      card.classList.toggle('expanded');
    });
  });
}

load();

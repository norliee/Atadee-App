renderNav(null);

const root = document.getElementById('admin-root');
const STAFF_ROLES = ['admin', 'support', 'finance', 'moderator'];
const ROLE_LABELS = { admin: 'Admin', support: 'Customer Support', finance: 'Finance', moderator: 'Trust & Safety' };

const SECTIONS = [
  { key: 'overview', label: 'Overview', roles: ['admin', 'support', 'finance', 'moderator'] },
  { key: 'designers', label: 'Designers', roles: ['admin', 'moderator'] },
  { key: 'trust', label: 'Trust & Safety', roles: ['admin', 'moderator', 'support'] },
  { key: 'orders', label: 'Orders', roles: ['admin', 'support', 'finance'] },
  { key: 'finance', label: 'Finance', roles: ['admin', 'finance'] },
  { key: 'support', label: 'Support', roles: ['admin', 'support'] },
  { key: 'users', label: 'Users', roles: ['admin', 'support'] },
  { key: 'platform', label: 'Platform', roles: ['admin', 'moderator'] }
];

let currentStaff = null;

async function init() {
  const user = await api('/api/auth/me');
  if (!user || !STAFF_ROLES.includes(user.role)) {
    root.innerHTML = `
      <div class="empty-state" style="margin-top:40px;">
        <span class="icon">${ICONS.gear}</span>
        This area is for atadeɛ staff only.
        <div style="margin-top:16px;"><a class="btn btn-primary" href="/login.html?redirect=/admin.html">Sign in with a staff account</a></div>
      </div>`;
    return;
  }
  currentStaff = user;
  renderShell();
}

function renderShell() {
  const visibleSections = SECTIONS.filter(s => s.roles.includes(currentStaff.role));
  root.innerHTML = `
    <div class="dash-header">
      <h1 style="font-size:1.5rem;">Admin</h1>
      <span class="pill" style="text-transform:none;">${currentStaff.name} · ${ROLE_LABELS[currentStaff.role]}</span>
    </div>
    <div class="dash-tabs" id="admin-tabs">
      ${visibleSections.map((s, i) => `<button class="dash-tab ${i === 0 ? 'active' : ''}" data-tab="${s.key}">${s.label}</button>`).join('')}
    </div>
    ${visibleSections.map((s, i) => `<div class="dash-panel ${i === 0 ? 'active' : ''}" id="panel-${s.key}"><p class="muted">Loading…</p></div>`).join('')}
  `;

  document.querySelectorAll('#admin-tabs .dash-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#admin-tabs .dash-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.dash-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab.dataset.tab}`));
      loadSection(tab.dataset.tab);
    });
  });

  loadSection(visibleSections[0].key);
}

function loadSection(key) {
  const loaders = {
    overview: loadOverview, designers: loadDesigners, trust: loadTrust, orders: loadOrders,
    finance: loadFinance, support: loadSupport, users: loadUsers, platform: loadPlatform
  };
  if (loaders[key]) loaders[key]();
}

async function loadOverview() {
  const panel = document.getElementById('panel-overview');
  const data = await api('/api/admin/overview');
  const statusLabel = { requested: 'Order Placed', quoted: 'Price Set', confirmed: 'Confirmed', in_progress: 'In Progress', ready_for_pickup: 'Ready for Pickup', completed: 'Completed' };

  panel.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><span class="icon">${ICONS.mannequin}</span><div class="stat-value">${data.totalDesigners}</div><div class="stat-label">Designers${data.pendingDesigners ? ` (${data.pendingDesigners} pending)` : ''}</div></div>
      <div class="stat-card"><span class="icon">${ICONS.heart}</span><div class="stat-value">${data.totalCustomers}</div><div class="stat-label">Customers</div></div>
      <div class="stat-card"><span class="icon">${ICONS.scissors}</span><div class="stat-value">${data.totalOrders}</div><div class="stat-label">Total orders</div></div>
      <div class="stat-card"><span class="icon">${ICONS.tape}</span><div class="stat-value">${money(data.gmv)}</div><div class="stat-label">Gross transaction value</div></div>
      <div class="stat-card"><span class="icon">${ICONS.tape}</span><div class="stat-value">${money(data.revenueThisMonth)}</div><div class="stat-label">Paid this month</div></div>
      <div class="stat-card"><span class="icon">${ICONS.tape}</span><div class="stat-value">${money(data.commissionEarned)}</div><div class="stat-label">Commission earned (~${data.effectiveCommissionRate}% effective)</div></div>
      <div class="stat-card"><span class="icon">${ICONS.needle}</span><div class="stat-value">${data.openReports}</div><div class="stat-label">Open reports</div></div>
      <div class="stat-card"><span class="icon">${ICONS.needle}</span><div class="stat-value">${data.openDisputes}</div><div class="stat-label">Open disputes</div></div>
      <div class="stat-card"><span class="icon">${ICONS.needle}</span><div class="stat-value">${data.openTickets}</div><div class="stat-label">Open support tickets</div></div>
    </div>
    <div class="section-title" style="margin-top:24px;"><h2 style="font-size:1.05rem;">Orders by status</h2></div>
    <div class="card" style="padding:16px 20px;">
      ${data.ordersByStatus.length === 0 ? `<p class="muted">No orders yet.</p>` : data.ordersByStatus.map(s => `
        <div class="service-row"><span>${statusLabel[s.status] || s.status}</span><strong>${s.c}</strong></div>
      `).join('')}
    </div>
  `;
}


async function loadDesigners() {
  const panel = document.getElementById('panel-designers');
  panel.innerHTML = `
    <div class="eco-chip-row" style="display:flex; gap:8px; margin-bottom:16px;" id="designer-filter-row">
      <button class="eco-chip active" data-filter="pending">Pending approval</button>
      <button class="eco-chip" data-filter="all">All designers</button>
      <button class="eco-chip" data-filter="suspended">Suspended</button>
      <button class="eco-chip" data-filter="featured">Featured</button>
    </div>
    <div id="designers-list"></div>
  `;
  document.querySelectorAll('#designer-filter-row .eco-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#designer-filter-row .eco-chip').forEach(c => c.classList.toggle('active', c === chip));
      renderDesignersList(chip.dataset.filter);
    });
  });
  renderDesignersList('pending');
}

async function renderDesignersList(filter) {
  const listEl = document.getElementById('designers-list');
  listEl.innerHTML = `<p class="muted">Loading…</p>`;
  const url = filter === 'all' ? '/api/admin/designers' : `/api/admin/designers?status=${filter}`;
  const designers = await api(url);

  if (designers.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.mannequin}</span>Nothing here right now.</div>`;
    return;
  }

  listEl.innerHTML = `<div class="card">${designers.map(d => {
    const hasWork = d.portfolio_count > 0;
    const hasWorkplace = !!d.workplace_image_url;
    const readyForApproval = hasWork && hasWorkplace;
    return `
    <div class="order-row" style="align-items:flex-start; flex-wrap:wrap;">
      <div>
        <strong>${d.name}</strong> <span class="muted" style="font-size:.82rem;">#${d.id} · ${d.category} · ${d.location}</span><br>
        <span class="pill" style="margin-top:4px;">${d.approval_status}</span>
        ${d.suspended ? `<span class="pill" style="background:rgba(199,123,77,.15); color:#8a4a24;">suspended${d.suspension_reason ? ': ' + d.suspension_reason : ''}</span>` : ''}
        ${d.featured ? `<span class="pill" style="background:rgba(201,162,75,.2);">featured</span>` : ''}
        <span class="pill">plan: ${d.plan}</span>
        <div class="muted" style="font-size:.8rem; margin-top:6px;">
          Verified: phone ${d.phone_verified ? '✓' : '✗'} · id ${d.id_verified ? '✓' : '✗'} · business ${d.business_verified ? '✓' : '✗'} · portfolio ${d.portfolio_verified ? '✓' : '✗'}
        </div>
        ${d.approval_status === 'pending' ? `
          <div style="font-size:.8rem; margin-top:6px; color:${readyForApproval ? 'var(--forest-deep)' : '#8a4a24'};">
            ${hasWork ? '✓' : '✗'} Work photos (${d.portfolio_count}) &nbsp; ${hasWorkplace ? '✓' : '✗'} Workplace photo
            ${d.workplace_image_url ? `<a href="${d.workplace_image_url}" target="_blank" style="margin-left:6px; text-decoration:underline;">view</a>` : ''}
          </div>
        ` : ''}
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${d.approval_status === 'pending' ? `
          <button class="btn btn-primary" data-approve="${d.id}" ${readyForApproval ? '' : 'disabled title="Needs work + workplace photos before approval"'} style="padding:7px 12px; font-size:.76rem; ${readyForApproval ? '' : 'opacity:.5; cursor:not-allowed;'}">Approve</button>
          <button class="btn btn-outline" data-reject="${d.id}" style="padding:7px 12px; font-size:.76rem;">Reject</button>
        ` : ''}
        <button class="btn btn-outline" data-toggle-verify="${d.id}" data-field="id_verified" data-value="${d.id_verified ? 0 : 1}" style="padding:7px 12px; font-size:.76rem;">${d.id_verified ? 'Unverify ID' : 'Verify ID'}</button>
        <button class="btn btn-outline" data-toggle-verify="${d.id}" data-field="business_verified" data-value="${d.business_verified ? 0 : 1}" style="padding:7px 12px; font-size:.76rem;">${d.business_verified ? 'Unverify business' : 'Verify business'}</button>
        <button class="btn btn-outline" data-toggle-feature="${d.id}" data-value="${d.featured ? 0 : 1}" style="padding:7px 12px; font-size:.76rem;">${d.featured ? 'Unfeature' : 'Feature'}</button>
        <button class="btn btn-outline" data-toggle-suspend="${d.id}" data-value="${d.suspended ? 0 : 1}" style="padding:7px 12px; font-size:.76rem;">${d.suspended ? 'Unsuspend' : 'Suspend'}</button>
      </div>
    </div>
  `; }).join('')}</div>`;

  listEl.querySelectorAll('[data-approve]').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await api(`/api/admin/designers/${btn.dataset.approve}/approval`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
      toast('Designer approved'); renderDesignersList(filter);
    } catch (err) { toast(err.message); }
  }));
  listEl.querySelectorAll('[data-reject]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/designers/${btn.dataset.reject}/approval`, { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) });
    toast('Designer rejected'); renderDesignersList(filter);
  }));
  listEl.querySelectorAll('[data-toggle-verify]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/designers/${btn.dataset.toggleVerify}/verify`, { method: 'PATCH', body: JSON.stringify({ [btn.dataset.field]: btn.dataset.value === '1' }) });
    renderDesignersList(filter);
  }));
  listEl.querySelectorAll('[data-toggle-feature]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/designers/${btn.dataset.toggleFeature}/marketing`, { method: 'PATCH', body: JSON.stringify({ featured: btn.dataset.value === '1' }) });
    renderDesignersList(filter);
  }));
  listEl.querySelectorAll('[data-toggle-suspend]').forEach(btn => btn.addEventListener('click', async () => {
    const suspend = btn.dataset.value === '1';
    const reason = suspend ? prompt('Reason for suspension (shown to internal staff only):') : null;
    await api(`/api/admin/designers/${btn.dataset.toggleSuspend}/suspend`, { method: 'PATCH', body: JSON.stringify({ suspended: suspend, reason }) });
    toast(suspend ? 'Designer suspended' : 'Designer unsuspended'); renderDesignersList(filter);
  }));
}

async function loadTrust() {
  const panel = document.getElementById('panel-trust');
  const [reports, disputes, suspicious] = await Promise.all([
    api('/api/admin/reports'), api('/api/admin/disputes'), api('/api/admin/suspicious')
  ]);

  panel.innerHTML = `
    <div class="section-title"><h2 style="font-size:1.05rem;">Reported profiles (${reports.filter(r => r.status === 'open').length} open)</h2></div>
    <div class="card" id="reports-list" style="margin-bottom:24px;"></div>

    <div class="section-title"><h2 style="font-size:1.05rem;">Disputes & refunds (${disputes.filter(d => d.status === 'open').length} open)</h2></div>
    <div class="card" id="disputes-list" style="margin-bottom:24px;"></div>

    <div class="section-title"><h2 style="font-size:1.05rem;">Suspicious activity</h2></div>
    <div class="card" style="padding:18px;">
      <h3 style="font-size:.9rem;">Designers with multiple open reports</h3>
      ${suspicious.flaggedDesigners.length === 0 ? `<p class="muted" style="font-size:.85rem;">None flagged.</p>` : suspicious.flaggedDesigners.map(d => `<div class="service-row"><span>${d.name}</span><strong>${d.report_count} reports</strong></div>`).join('')}
      <h3 style="font-size:.9rem; margin-top:14px;">Orders paid but stuck 14+ days</h3>
      ${suspicious.staleOrders.length === 0 ? `<p class="muted" style="font-size:.85rem;">None found.</p>` : suspicious.staleOrders.map(o => `<div class="service-row"><span>Order #${o.id} — ${o.customer_name} / ${o.designer_name}</span><strong>${o.status}</strong></div>`).join('')}
      <h3 style="font-size:.9rem; margin-top:14px;">Customers with repeated disputes</h3>
      ${suspicious.repeatDisputers.length === 0 ? `<p class="muted" style="font-size:.85rem;">None found.</p>` : suspicious.repeatDisputers.map(c => `<div class="service-row"><span>${c.customer_name}</span><strong>${c.dispute_count} disputes</strong></div>`).join('')}
    </div>
  `;

  const reportsList = document.getElementById('reports-list');
  reportsList.innerHTML = reports.length === 0 ? `<p class="muted" style="padding:16px;">No reports filed.</p>` : reports.map(r => `
    <div class="order-row" style="align-items:flex-start;">
      <div>
        <strong>${r.designer_name}</strong> <span class="pill">${r.status}</span><br>
        <span class="muted" style="font-size:.82rem;">${r.reason}${r.detail ? ' — ' + r.detail : ''}${r.reporter_name ? ' · reported by ' + r.reporter_name : ''}</span>
      </div>
      ${r.status === 'open' ? `<div style="display:flex; gap:6px;">
        <button class="btn btn-primary" data-resolve-report="${r.id}" style="padding:7px 12px; font-size:.76rem;">Resolve</button>
        <button class="btn btn-outline" data-dismiss-report="${r.id}" style="padding:7px 12px; font-size:.76rem;">Dismiss</button>
      </div>` : ''}
    </div>
  `).join('');
  reportsList.querySelectorAll('[data-resolve-report]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/reports/${btn.dataset.resolveReport}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) });
    loadTrust();
  }));
  reportsList.querySelectorAll('[data-dismiss-report]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/reports/${btn.dataset.dismissReport}`, { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) });
    loadTrust();
  }));

  const disputesList = document.getElementById('disputes-list');
  disputesList.innerHTML = disputes.length === 0 ? `<p class="muted" style="padding:16px;">No disputes raised.</p>` : disputes.map(d => `
    <div class="order-row" style="align-items:flex-start;">
      <div>
        <strong>Order #${d.order_id}</strong> — ${d.customer_name} / ${d.designer_name} <span class="pill">${d.status}</span><br>
        <span class="muted" style="font-size:.82rem;">${d.category}: ${d.detail}</span><br>
        <span class="muted" style="font-size:.8rem;">Paid so far: ${money(d.amount_paid)} of ${d.quoted_price ? money(d.quoted_price) : '—'}</span>
      </div>
      ${d.status === 'open' ? `<div id="dispute-actions-${d.id}" style="display:flex; gap:6px; flex-direction:column; align-items:flex-end;">
        <div style="display:flex; gap:6px;">
          <input type="number" placeholder="Refund GH₵ (optional)" id="refund-${d.id}" style="width:150px; padding:7px 10px; border-radius:6px; border:1px solid var(--line); font-size:.78rem;">
          <button class="btn btn-primary" data-resolve-dispute="${d.id}" style="padding:7px 12px; font-size:.76rem;">Resolve</button>
          <button class="btn btn-outline" data-dismiss-dispute="${d.id}" style="padding:7px 12px; font-size:.76rem;">Dismiss</button>
        </div>
      </div>` : ''}
    </div>
  `).join('');
  disputesList.querySelectorAll('[data-resolve-dispute]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.resolveDispute;
    const refundInput = document.getElementById(`refund-${id}`);
    const refundAmount = refundInput.value ? Number(refundInput.value) : undefined;
    try {
      await api(`/api/admin/disputes/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved', refundAmount }) });
      toast('Dispute resolved' + (refundAmount ? ` with ${money(refundAmount)} refund` : ''));
      loadTrust();
    } catch (err) { toast(err.message); }
  }));
  disputesList.querySelectorAll('[data-dismiss-dispute]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/disputes/${btn.dataset.dismissDispute}`, { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) });
    loadTrust();
  }));
}

async function loadOrders() {
  const panel = document.getElementById('panel-orders');
  const orders = await api('/api/admin/orders');
  panel.innerHTML = `
    <div class="section-title"><h2 style="font-size:1.05rem;">All orders (most recent 100)</h2></div>
    <div class="card">${orders.length === 0 ? `<p class="muted" style="padding:16px;">No orders yet.</p>` : orders.map(o => `
      <div class="order-row">
        <div><strong>#${o.id} ${o.garment_type.replace('_', ' ')}</strong> — ${o.customer_name} → ${o.designer_name}<br>
          <span class="muted" style="font-size:.8rem;">${o.quoted_price ? money(o.quoted_price) : 'no price yet'} · ${o.payment_status}</span>
        </div>
        <span class="pill">${o.status}</span>
      </div>
    `).join('')}</div>
  `;
}

async function loadFinance() {
  const panel = document.getElementById('panel-finance');
  const [settings, coupons, transactions] = await Promise.all([
    api('/api/admin/settings'), api('/api/admin/coupons'), api('/api/admin/transactions')
  ]);

  let commissionTiers, serviceFeeTiers;
  try { commissionTiers = JSON.parse(settings.commission_tiers); } catch { commissionTiers = [{ max: null, rate: 10 }]; }
  try { serviceFeeTiers = JSON.parse(settings.service_fee_tiers); } catch { serviceFeeTiers = [{ max: null, fee: 5 }]; }

  function tierRangeLabel(tiers, i) {
    const min = i === 0 ? 0 : tiers[i - 1].max + 1;
    return tiers[i].max === null ? `GH₵${min}+` : `GH₵${min}–${tiers[i].max}`;
  }

  panel.innerHTML = `
    <div class="section-title"><h2 style="font-size:1.05rem;">Designer commission (tiered)</h2></div>
    <div class="card" style="padding:18px; margin-bottom:24px;">
      <p class="muted" style="font-size:.82rem; margin-top:0;">Based on the order's total value — one rate applies to the whole order. Taken from the designer's side of a split payment; the platform absorbs Paystack's own fee out of this.</p>
      <div id="commission-tiers-list">
        ${commissionTiers.map((t, i) => `
          <div class="service-row" style="gap:10px;">
            <span style="flex:1;">${tierRangeLabel(commissionTiers, i)}</span>
            <input type="number" data-commission-tier="${i}" value="${t.rate}" style="width:80px; padding:6px 8px; border-radius:6px; border:1px solid var(--line);"> %
            <input type="number" data-commission-max="${i}" value="${t.max === null ? '' : t.max}" placeholder="${t.max === null ? 'no limit' : 'max GH₵'}" ${t.max === null ? 'disabled' : ''} style="width:100px; padding:6px 8px; border-radius:6px; border:1px solid var(--line);">
          </div>
        `).join('')}
      </div>
      <button class="btn btn-outline" id="save-commission-tiers" type="button" style="margin-top:12px;">Save commission tiers</button>
    </div>

    <div class="section-title"><h2 style="font-size:1.05rem;">atadeɛ Service & Protection fee (tiered, flat GH₵)</h2></div>
    <div class="card" style="padding:18px; margin-bottom:24px;">
      <p class="muted" style="font-size:.82rem; margin-top:0;">A small flat amount added at checkout, based on order size — charged once per order, not per payment. Not meant to fully cover Paystack's fee on its own; the commission above does that.</p>
      <div id="fee-tiers-list">
        ${serviceFeeTiers.map((t, i) => `
          <div class="service-row" style="gap:10px;">
            <span style="flex:1;">${tierRangeLabel(serviceFeeTiers, i)}</span>
            GH₵<input type="number" data-fee-tier="${i}" value="${t.fee}" style="width:80px; padding:6px 8px; border-radius:6px; border:1px solid var(--line);">
            <input type="number" data-fee-max="${i}" value="${t.max === null ? '' : t.max}" placeholder="${t.max === null ? 'no limit' : 'max GH₵'}" ${t.max === null ? 'disabled' : ''} style="width:100px; padding:6px 8px; border-radius:6px; border:1px solid var(--line);">
          </div>
        `).join('')}
      </div>
      <button class="btn btn-outline" id="save-fee-tiers" type="button" style="margin-top:12px;">Save fee tiers</button>
    </div>

    <div class="section-title"><h2 style="font-size:1.05rem;">Coupons & promotions</h2></div>
    <div class="card" style="padding:18px; margin-bottom:24px;">
      <div id="coupons-list">${coupons.length === 0 ? `<p class="muted" style="font-size:.85rem;">No coupons yet.</p>` : coupons.map(c => `
        <div class="service-row">
          <span>${c.code} — ${c.discount_value}${c.discount_type === 'percent' ? '%' : ' GH₵'} off ${c.description ? '(' + c.description + ')' : ''} ${!c.active ? '· inactive' : ''}</span>
          <span style="display:flex; gap:8px;">
            <button class="btn btn-outline" data-toggle-coupon="${c.id}" data-value="${c.active ? 0 : 1}" style="padding:5px 10px; font-size:.72rem;">${c.active ? 'Deactivate' : 'Activate'}</button>
            <button class="btn btn-outline" data-delete-coupon="${c.id}" style="padding:5px 10px; font-size:.72rem;">Delete</button>
          </span>
        </div>
      `).join('')}</div>
      <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
        <input id="coupon-code" placeholder="CODE" style="width:120px; padding:8px 10px; border-radius:6px; border:1px solid var(--line);">
        <input id="coupon-value" type="number" placeholder="Discount %" style="width:110px; padding:8px 10px; border-radius:6px; border:1px solid var(--line);">
        <input id="coupon-desc" placeholder="Description (optional)" style="flex:1; min-width:140px; padding:8px 10px; border-radius:6px; border:1px solid var(--line);">
        <button class="btn btn-primary" id="add-coupon" type="button">Add coupon</button>
      </div>
    </div>

    <div class="section-title"><h2 style="font-size:1.05rem;">Transactions (most recent 100)</h2></div>
    <div class="card">${transactions.length === 0 ? `<p class="muted" style="padding:16px;">No transactions yet.</p>` : transactions.map(t => `
      <div class="order-row">
        <div><strong>${t.method === 'refund' ? 'Refund' : t.method === 'platform_fee' ? 'atadeɛ Service & Protection fee' : t.method.toUpperCase()}</strong> — ${t.customer_name} → ${t.designer_name} (order #${t.order_id})<br>
          <span class="muted" style="font-size:.8rem;">${t.reference} · ${new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</span>
        </div>
        <strong style="color:${t.amount < 0 ? 'var(--terracotta)' : 'var(--forest-deep)'};">${money(t.amount)}</strong>
      </div>
    `).join('')}</div>
  `;

  document.getElementById('save-commission-tiers').addEventListener('click', async () => {
    const updated = commissionTiers.map((t, i) => ({
      rate: Number(document.querySelector(`[data-commission-tier="${i}"]`).value),
      max: t.max === null ? null : Number(document.querySelector(`[data-commission-max="${i}"]`).value)
    }));
    await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ commission_tiers: JSON.stringify(updated) }) });
    toast('Commission tiers updated');
    loadFinance();
  });

  document.getElementById('save-fee-tiers').addEventListener('click', async () => {
    const updated = serviceFeeTiers.map((t, i) => ({
      fee: Number(document.querySelector(`[data-fee-tier="${i}"]`).value),
      max: t.max === null ? null : Number(document.querySelector(`[data-fee-max="${i}"]`).value)
    }));
    await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ service_fee_tiers: JSON.stringify(updated) }) });
    toast('atadeɛ Service & Protection fee tiers updated');
    loadFinance();
  });

  document.getElementById('add-coupon').addEventListener('click', async () => {
    const code = document.getElementById('coupon-code').value;
    const value = document.getElementById('coupon-value').value;
    if (!code || !value) { toast('Enter a code and discount value'); return; }
    try {
      await api('/api/admin/coupons', { method: 'POST', body: JSON.stringify({ code, discountValue: Number(value), discountType: 'percent', description: document.getElementById('coupon-desc').value || null }) });
      loadFinance();
    } catch (err) { toast(err.message); }
  });
  panel.querySelectorAll('[data-toggle-coupon]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/coupons/${btn.dataset.toggleCoupon}`, { method: 'PATCH', body: JSON.stringify({ active: btn.dataset.value === '1' }) });
    loadFinance();
  }));
  panel.querySelectorAll('[data-delete-coupon]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/coupons/${btn.dataset.deleteCoupon}`, { method: 'DELETE' });
    loadFinance();
  }));
}

async function loadSupport() {
  const panel = document.getElementById('panel-support');
  const tickets = await api('/api/admin/support-tickets');
  panel.innerHTML = `
    <div class="section-title"><h2 style="font-size:1.05rem;">Support tickets (${tickets.filter(t => t.status === 'open').length} open)</h2></div>
    <div class="card">${tickets.length === 0 ? `<p class="muted" style="padding:16px;">No tickets yet.</p>` : tickets.map(t => `
      <div class="order-row" style="align-items:flex-start;">
        <div>
          <strong>${t.subject}</strong> <span class="pill">${t.status}</span><br>
          <span class="muted" style="font-size:.82rem;">${t.name}${t.email ? ' · ' + t.email : ''}</span>
          <p style="font-size:.85rem; margin:6px 0;">${t.message}</p>
          ${t.staff_reply ? `<p style="font-size:.85rem; background:var(--ivory); padding:8px 10px; border-radius:8px;"><strong>Reply:</strong> ${t.staff_reply}</p>` : ''}
        </div>
        ${t.status === 'open' ? `<div style="display:flex; flex-direction:column; gap:6px; min-width:200px;">
          <input placeholder="Write a reply…" id="reply-${t.id}" style="padding:7px 10px; border-radius:6px; border:1px solid var(--line); font-size:.8rem;">
          <button class="btn btn-primary" data-resolve-ticket="${t.id}" style="padding:7px 12px; font-size:.76rem;">Reply & resolve</button>
        </div>` : ''}
      </div>
    `).join('')}</div>
  `;
  panel.querySelectorAll('[data-resolve-ticket]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.resolveTicket;
    const reply = document.getElementById(`reply-${id}`).value;
    await api(`/api/admin/support-tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved', staffReply: reply || null }) });
    toast('Ticket resolved'); loadSupport();
  }));
}

async function loadUsers() {
  const panel = document.getElementById('panel-users');
  const users = await api('/api/admin/users');
  panel.innerHTML = `
    <div class="section-title"><h2 style="font-size:1.05rem;">Customers</h2></div>
    <div class="card">${users.length === 0 ? `<p class="muted" style="padding:16px;">No customers yet.</p>` : users.map(u => `
      <div class="order-row">
        <div><strong>${u.name}</strong> ${u.suspended ? `<span class="pill" style="background:rgba(199,123,77,.15); color:#8a4a24;">suspended</span>` : ''}<br>
          <span class="muted" style="font-size:.82rem;">${u.email} · joined ${new Date(u.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</span>
        </div>
        <button class="btn btn-outline" data-toggle-user-suspend="${u.id}" data-value="${u.suspended ? 0 : 1}" style="padding:7px 12px; font-size:.76rem;">${u.suspended ? 'Unsuspend' : 'Suspend'}</button>
      </div>
    `).join('')}</div>
  `;
  panel.querySelectorAll('[data-toggle-user-suspend]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/users/${btn.dataset.toggleUserSuspend}/suspend`, { method: 'PATCH', body: JSON.stringify({ suspended: btn.dataset.value === '1' }) });
    loadUsers();
  }));
}

async function loadPlatform() {
  const panel = document.getElementById('panel-platform');
  const [categories, content, standards] = await Promise.all([
    api('/api/available-categories'), api('/api/admin/content'), api('/api/admin/measurement-standards')
  ]);

  panel.innerHTML = `
    <div class="section-title"><h2 style="font-size:1.05rem;">Categories</h2></div>
    <div class="card" style="padding:18px; margin-bottom:24px;">
      ${categories.map(c => `<div class="service-row"><span>${c.name}</span><button class="btn btn-outline" data-delete-category="${c.id}" style="padding:5px 10px; font-size:.72rem;">Remove</button></div>`).join('')}
      <div style="display:flex; gap:8px; margin-top:12px;">
        <input id="new-category" placeholder="New category name" style="flex:1; padding:8px 10px; border-radius:6px; border:1px solid var(--line);">
        <button class="btn btn-primary" id="add-category" type="button">Add</button>
      </div>
    </div>

    <div class="section-title"><h2 style="font-size:1.05rem;">Circular page content</h2></div>
    <div class="card" style="padding:18px; margin-bottom:24px;">
      ${content.map(c => `
        <div style="margin-bottom:14px;">
          <div class="measure-field"><label>${c.block_key}</label><input value="${c.title}" id="content-title-${c.id}"></div>
          <textarea id="content-body-${c.id}" style="width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--line); font-family:inherit; min-height:60px;">${c.body}</textarea>
          <button class="btn btn-outline" data-save-content="${c.id}" style="padding:6px 12px; font-size:.76rem; margin-top:6px;">Save</button>
        </div>
      `).join('')}
    </div>

    <div class="section-title"><h2 style="font-size:1.05rem;">Measurement standards (reference)</h2></div>
    <div class="card" style="padding:18px;">
      <p class="muted" style="font-size:.82rem; margin-top:0;">Read-only view of the size charts currently used to calculate recommended sizes.</p>
      ${standards.map(s => `<div class="service-row"><span>${s.label}</span><span class="muted" style="font-size:.8rem;">sized by ${s.sizeField}</span></div>`).join('')}
    </div>
  `;

  document.getElementById('add-category').addEventListener('click', async () => {
    const name = document.getElementById('new-category').value;
    if (!name) return;
    try { await api('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name }) }); loadPlatform(); }
    catch (err) { toast(err.message); }
  });
  panel.querySelectorAll('[data-delete-category]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/admin/categories/${btn.dataset.deleteCategory}`, { method: 'DELETE' });
    loadPlatform();
  }));
  panel.querySelectorAll('[data-save-content]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.saveContent;
    await api(`/api/admin/content/${id}`, { method: 'PATCH', body: JSON.stringify({ title: document.getElementById(`content-title-${id}`).value, body: document.getElementById(`content-body-${id}`).value }) });
    toast('Content updated');
  }));
}

init();

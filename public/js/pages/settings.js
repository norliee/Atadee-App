renderNav('settings');

const root = document.getElementById('root');
let currentUser = null;

async function load() {
  try { currentUser = await api('/api/auth/me'); } catch { currentUser = null; }
  if (!currentUser) {
    root.innerHTML = `
      <div class="empty-state">
        <span class="icon">${ICONS.heart}</span>
        Sign in to manage your account and privacy settings.
        <div style="margin-top:16px;"><a class="btn btn-primary" href="/login.html?redirect=/settings.html">Sign in</a></div>
      </div>`;
    return;
  }

  const [sessions, auditLog, orders] = await Promise.all([
    api('/api/auth/sessions'),
    api('/api/auth/audit-log'),
    api('/api/orders/mine')
  ]);

  root.innerHTML = `
    <div class="settings-section card" style="padding:20px;">
      <h2 style="font-size:1.05rem;">Account</h2>
      <div class="settings-row"><span class="muted">Name</span><strong>${currentUser.name}</strong></div>
      <div class="settings-row"><span class="muted">Email</span><strong>${currentUser.email}</strong></div>
      <div class="settings-row"><span class="muted">Signed in with</span><strong>${currentUser.auth_provider === 'google' ? 'Google' : 'Email & password'}</strong></div>
      <div class="settings-row"><span class="muted">Member since</span><strong>${new Date(currentUser.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</strong></div>
      <button class="btn btn-outline" id="logout-btn" type="button" style="margin-top:12px;">Sign out</button>
    </div>

    ${currentUser.auth_provider === 'password' ? `
    <div class="settings-section card" style="padding:20px;">
      <h2 style="font-size:1.05rem;">Change password</h2>
      <div class="measure-field"><label>Current password</label><input type="password" id="current-password"></div>
      <div class="measure-field"><label>New password</label><input type="password" id="new-password" placeholder="At least 8 characters"></div>
      <button class="btn btn-outline" id="change-password-btn" type="button">Update password</button>
    </div>` : ''}

    <div class="settings-section card" style="padding:20px;">
      <h2 style="font-size:1.05rem;">Devices &amp; sessions</h2>
      <p class="muted" style="font-size:.85rem;">Everywhere you're currently signed in. Sign out anywhere you don't recognize.</p>
      <div id="sessions-list" style="margin-top:10px;"></div>
    </div>

    <div class="settings-section card" style="padding:20px;">
      <h2 style="font-size:1.05rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:18px;height:18px;color:var(--forest);">${ICONS.leaf}</span>Who has your measurements</h2>
      <p class="muted" style="font-size:.85rem;">Your measurements are only ever sent to the specific designer for a specific order — never shared broadly. Here's exactly who has received them:</p>
      <div id="sharing-list" style="margin-top:10px;"></div>
    </div>

    <div class="settings-section card" style="padding:20px;">
      <h2 style="font-size:1.05rem;">Recent account activity</h2>
      <div id="audit-list" style="margin-top:6px;"></div>
    </div>

    <div class="settings-section card" style="padding:20px;">
      <h2 style="font-size:1.05rem;">Your data</h2>
      <p class="muted" style="font-size:.85rem;">Download a copy of your account info and order history.</p>
      <button class="btn btn-outline" id="export-btn" type="button">Export my data</button>
    </div>

    <div class="settings-section">
      <div class="danger-zone">
        <h2 style="font-size:1.05rem; margin-top:0;">Delete account</h2>
        <p class="muted" style="font-size:.85rem;">This removes your login and unlinks your order history from your account. Past orders stay in your designers' records (as any marketplace keeps transaction records) but will no longer show under your name.</p>
        ${currentUser.auth_provider === 'password' ? `<div class="measure-field"><label>Confirm your password</label><input type="password" id="delete-password"></div>` : ''}
        <button class="btn" id="delete-account-btn" type="button" style="background:var(--terracotta); color:#fff;">Delete my account</button>
      </div>
    </div>

    <div class="settings-section">
      <p class="muted" style="font-size:.78rem;">
        About security here: passwords are hashed (never stored in plain text) and sessions use random tokens, only a hash of which is kept server-side.
        This is a prototype, though — it doesn't include things a production system would need, like enforced HTTPS, encryption of the database file at rest, real fraud monitoring, or a real Google OAuth integration (the Google button above is a clearly-labeled demo).
      </p>
    </div>
  `;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/index.html';
  });

  if (currentUser.auth_provider === 'password') {
    document.getElementById('change-password-btn').addEventListener('click', async () => {
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      try {
        await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
        toast('Password updated');
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
      } catch (err) { toast(err.message); }
    });
  }

  renderSessions(sessions);
  renderSharing(orders);
  renderAudit(auditLog);

  document.getElementById('export-btn').addEventListener('click', async () => {
    const data = await api('/api/auth/export');
    let myfit = [];
    try { myfit = JSON.parse(localStorage.getItem('atadee_myfit_profiles') || '[]'); } catch {}
    const bundle = { ...data, myFitProfiles: myfit };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'atadee-my-data.json';
    a.click();
  });

  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    if (!confirm('This will permanently delete your atadeɛ account. Continue?')) return;
    const password = currentUser.auth_provider === 'password' ? document.getElementById('delete-password').value : undefined;
    try {
      await api('/api/auth/delete-account', { method: 'POST', body: JSON.stringify({ password }) });
      window.location.href = '/index.html';
    } catch (err) { toast(err.message); }
  });
}

function renderSessions(sessions) {
  document.getElementById('sessions-list').innerHTML = sessions.map(s => `
    <div class="session-row">
      <div>
        <strong>${s.isCurrent ? 'This device' : (s.userAgent ? s.userAgent.slice(0, 40) : 'Unknown device')}</strong>
        <div class="muted" style="font-size:.78rem;">Last active ${new Date(s.lastActiveAt.replace(' ', 'T') + 'Z').toLocaleString()}</div>
      </div>
      ${s.isCurrent ? `<span class="pill">Current</span>` : `<button class="btn btn-outline" data-revoke="${s.id}" style="padding:6px 12px; font-size:.76rem;">Sign out</button>`}
    </div>
  `).join('');

  document.querySelectorAll('[data-revoke]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/api/auth/sessions/${btn.dataset.revoke}`, { method: 'DELETE' });
      toast('Signed out of that device');
      const sessions = await api('/api/auth/sessions');
      renderSessions(sessions);
    });
  });
}

function renderSharing(orders) {
  const el = document.getElementById('sharing-list');
  if (orders.length === 0) {
    el.innerHTML = `<p class="muted" style="font-size:.85rem;">You haven't shared measurements with anyone yet.</p>`;
    return;
  }
  el.innerHTML = orders.map(o => `
    <div class="consent-note">
      <strong>${o.designer_name}</strong> — ${o.garment_type.replace('_', ' ')} (order #${o.id})
      <div class="muted" style="font-size:.76rem;">Shared for this order only, on ${new Date(o.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</div>
    </div>
  `).join('');
}

function renderAudit(rows) {
  const el = document.getElementById('audit-list');
  el.innerHTML = rows.length === 0
    ? `<p class="muted" style="font-size:.85rem;">No activity recorded yet.</p>`
    : rows.map(r => `
        <div class="audit-row">
          <span>${r.event.replace(/_/g, ' ')}${r.detail ? ' — ' + r.detail : ''}</span>
          <span class="muted" style="white-space:nowrap;">${new Date(r.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</span>
        </div>
      `).join('');
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

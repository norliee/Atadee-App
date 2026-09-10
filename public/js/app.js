const STATUS_LABELS = {
  requested: 'Order Placed',
  quoted: 'Price Set',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed'
};
const STATUS_FLOW = Object.keys(STATUS_LABELS);

function renderNav(active) {
  const el = document.getElementById('nav');
  if (!el) return;
  const link = (href, key, label, iconName) => `<a href="${href}" class="${active === key ? 'active' : ''}">${iconName ? `<span class="icon nav-link-icon">${ICONS[iconName]}</span>` : ''}${label}</a>`;
  el.innerHTML = `
    <div class="container nav-inner">
      <a href="/" class="brand"><span class="brand-badge"><span class="brand-mark icon">${ICONS.pempamsie}</span></span>atadeɛ</a>
      <div class="links">
        ${link('/index.html', 'browse', 'Designers', 'mannequin')}
        ${link('/shop.html', 'shop', 'Shop', 'tape')}
        ${link('/circular.html', 'circular', 'Sustainability', 'leaf')}
        ${link('/dashboard.html', 'dashboard', 'Designer dashboard', 'gear')}
        <span id="nav-account">${link('/login.html', 'login', 'Sign in')}</span>
      </div>
    </div>`;
  renderAccountNav(active);
}

async function renderAccountNav(active) {
  try {
    const user = await api('/api/auth/me');
    const slot = document.getElementById('nav-account');
    if (!slot) return;
    if (user) {
      const link = (href, key, label, iconName) => `<a href="${href}" class="${active === key ? 'active' : ''}">${iconName ? `<span class="icon nav-link-icon">${ICONS[iconName]}</span>` : ''}${label}</a>`;
      slot.outerHTML = `<span id="nav-account" style="display:flex; align-items:center; gap:16px;">
        <span class="notif-bell-wrap" id="notif-bell-wrap">
          <button type="button" class="notif-bell" id="notif-bell" aria-label="Notifications">
            <span class="icon">${ICONS.needle}</span>
            <span class="notif-badge" id="notif-badge" style="display:none;"></span>
          </button>
          <div class="notif-dropdown" id="notif-dropdown"></div>
        </span>
        ${link('/messages-inbox.html', 'messages', 'Messages', 'spool')}${link('/my-orders.html', 'my-orders', 'My Orders', 'scissors')}<a href="/settings.html" class="settings-link ${active === 'settings' ? 'active' : ''}"><span class="icon">${ICONS.gear}</span>Settings</a>
      </span>`;
      initNotificationBell('/api/notifications', '/api/notifications/read-all');
    }
  } catch {}
}

let notifCurrentFetchUrl = null;
let notifCurrentReadAllUrl = null;
let notifBellBound = false;

function initNotificationBell(fetchUrl, readAllUrl) {
  notifCurrentFetchUrl = fetchUrl;
  notifCurrentReadAllUrl = readAllUrl;

  const bellWrap = document.getElementById('notif-bell-wrap');
  const bell = document.getElementById('notif-bell');
  const badge = document.getElementById('notif-badge');
  const dropdown = document.getElementById('notif-dropdown');
  if (!bell) return;

  function timeAgo(ts) {
    const diffMs = Date.now() - new Date(ts.replace(' ', 'T') + 'Z').getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  async function refresh(showBadgeOnly) {
    try {
      const data = await api(notifCurrentFetchUrl);
      badge.style.display = data.unreadCount > 0 ? 'flex' : 'none';
      badge.textContent = data.unreadCount > 9 ? '9+' : data.unreadCount;
      if (showBadgeOnly) return;
      dropdown.innerHTML = data.notifications.length === 0
        ? `<div class="notif-empty">No notifications yet.</div>`
        : data.notifications.map(n => `
            <a href="${n.link_url || '#'}" class="notif-item ${n.is_read ? '' : 'unread'}">
              <span>${n.title}</span>
              <span class="notif-time">${timeAgo(n.created_at)}</span>
            </a>
          `).join('');
    } catch {}
  }

  // Bind the click/outside-click/poll behavior only once ever — later calls
  // (e.g. switching the selected designer) just swap which URLs `refresh`
  // reads from via the module-level variables above.
  if (!notifBellBound) {
    notifBellBound = true;
    let open = false;
    bell.addEventListener('click', async (e) => {
      e.stopPropagation();
      open = !open;
      dropdown.classList.toggle('open', open);
      if (open) {
        await refresh(false);
        const currentBadge = document.getElementById('notif-badge');
        if (currentBadge && currentBadge.style.display !== 'none') {
          await api(notifCurrentReadAllUrl, { method: 'POST' });
          currentBadge.style.display = 'none';
        }
      }
    });
    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('notif-bell-wrap');
      if (open && wrap && !wrap.contains(e.target)) { open = false; dropdown.classList.remove('open'); }
    });
    setInterval(() => refresh(true), 20000); // light polling — not a nuisance, just keeps the badge current
  }

  refresh(true);
}

function renderFooter() {
  const el = document.getElementById('footer');
  if (!el) return;
  el.innerHTML = `
    <div class="container footer-inner">
      <p class="muted" style="font-size:.76rem;">atadeɛ — a fashion marketplace prototype for Ghana.</p>
    </div>`;
}
if (document.getElementById('footer')) renderFooter();

// Side pane — Near Me and MyFit are used often enough to deserve a
// persistent, always-visible spot rather than living only in the footer.
// Injected site-wide (no placeholder needed in each HTML file), fixed to
// the right edge, collapsing to icon-only on narrow screens.
(function renderSidePane() {
  if (document.getElementById('side-pane')) return;
  const pane = document.createElement('div');
  pane.className = 'side-pane';
  pane.id = 'side-pane';
  pane.innerHTML = `
    <a href="/map.html" class="side-pane-item">
      <span class="icon">${ICONS.gear}</span><span class="side-pane-label">Near Me</span>
    </a>
    <a href="/myfit.html" class="side-pane-item">
      <span class="icon">${ICONS.needle}</span><span class="side-pane-label">MyFit</span>
    </a>`;
  document.body.appendChild(pane);
})();

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="icon" style="width:16px;height:16px;">${ICONS.needle}</span>${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function money(v) {
  if (v === null || v === undefined) return '—';
  return `GH₵${Number(v).toLocaleString()}`;
}

function starString(rating) {
  return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
}

function isSaved(itemId) {
  try {
    const saved = JSON.parse(localStorage.getItem('atadee_saved') || '[]');
    return saved.includes(String(itemId));
  } catch { return false; }
}

function toggleSaved(itemId) {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('atadee_saved') || '[]'); } catch {}
  const id = String(itemId);
  const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
  localStorage.setItem('atadee_saved', JSON.stringify(next));
  return next.includes(id);
}

// ---- Pretty selects: wraps every native <select> in a styled dropdown
// (icon + label trigger, floating option panel) while leaving the
// original <select> in the DOM — hidden but still fully functional —
// so existing code that reads `.value` or listens for 'change' keeps
// working untouched. Runs on a MutationObserver so selects populated
// later by page scripts (most of them, since options load from the API)
// get caught automatically without editing every page.
const SELECT_ICON_RULES = [
  { test: /wedding/i, icon: 'heart' },
  { test: /traditional|kente|kaftan|agbada/i, icon: 'spool' },
  { test: /corporate|shirt|suit/i, icon: 'mannequin' },
  { test: /kid|children/i, icon: 'scissors' },
  { test: /casual|dress|skirt/i, icon: 'mannequin' },
  { test: /sustainable|eco|circular/i, icon: 'leaf' },
  { test: /price|budget|₵|ghc/i, icon: 'tape' },
  { test: /rating|star/i, icon: 'heart' },
  { test: /category/i, icon: 'spool' },
  { test: /garment|making/i, icon: 'mannequin' }
];
const SELECT_FALLBACK_ICON = 'tape';

function pickSelectIcon(select) {
  const haystack = (select.id + ' ' + (select.name || '') + ' ' + [...select.options].map(o => o.textContent).join(' ')).toLowerCase();
  for (const rule of SELECT_ICON_RULES) {
    if (rule.test.test(haystack)) return rule.icon;
  }
  return SELECT_FALLBACK_ICON;
}

function enhanceSelect(select) {
  if (!select || select.dataset.enhanced || select.closest('.pretty-select')) return;
  if (select.multiple || select.size > 1) return; // leave unusual selects native
  select.dataset.enhanced = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'pretty-select';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  const iconName = pickSelectIcon(select);
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'pretty-select-trigger';
  trigger.innerHTML = `<span class="icon pretty-select-icon">${ICONS[iconName] || ''}</span><span class="pretty-select-label"></span><span class="pretty-select-chevron">▾</span>`;
  wrap.appendChild(trigger);

  const panel = document.createElement('div');
  panel.className = 'pretty-select-panel';
  wrap.appendChild(panel);

  function buildPanel() {
    panel.innerHTML = [...select.options].map((opt, i) => `
      <div class="pretty-select-option ${opt.value === select.value ? 'selected' : ''}" data-index="${i}">
        <span>${opt.textContent}</span>
        ${opt.value === select.value ? `<span class="pretty-select-check">✓</span>` : ''}
      </div>
    `).join('');
    panel.querySelectorAll('.pretty-select-option').forEach(row => {
      row.addEventListener('click', () => {
        select.selectedIndex = Number(row.dataset.index);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        syncPrettySelectLabel(select);
        closePanel();
      });
    });
  }

  function syncPrettySelectLabelInner() {
    const opt = select.options[select.selectedIndex];
    trigger.querySelector('.pretty-select-label').textContent = opt ? opt.textContent : '';
  }
  select._syncPrettyLabel = syncPrettySelectLabelInner;
  syncPrettySelectLabelInner();

  function openPanel() { buildPanel(); wrap.classList.add('open'); }
  function closePanel() { wrap.classList.remove('open'); }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrap.classList.contains('open');
    document.querySelectorAll('.pretty-select.open').forEach(w => w.classList.remove('open'));
    if (!isOpen) openPanel();
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) closePanel(); });

  // If something else changes the underlying select's value programmatically
  // and dispatches 'change' (or we're the ones dispatching it above), keep
  // the visible label in sync.
  select.addEventListener('change', syncPrettySelectLabelInner);
}

function syncPrettySelectLabel(select) {
  if (select && select._syncPrettyLabel) select._syncPrettyLabel();
}

function enhanceAllSelects() {
  document.querySelectorAll('select').forEach(select => {
    if (select.dataset.enhanced) {
      syncPrettySelectLabel(select);
    } else {
      enhanceSelect(select);
    }
  });
}

let prettySelectObserverScheduled = false;
const prettySelectObserver = new MutationObserver(() => {
  if (prettySelectObserverScheduled) return;
  prettySelectObserverScheduled = true;
  setTimeout(() => { enhanceAllSelects(); prettySelectObserverScheduled = false; }, 120);
});
prettySelectObserver.observe(document.body, { childList: true, subtree: true });
enhanceAllSelects();

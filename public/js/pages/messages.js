renderNav(null);

const orderId = qs('orderId');
const as = qs('as') === 'designer' ? 'designer' : 'customer';
const headerEl = document.getElementById('header');
const threadEl = document.getElementById('thread');
const composerEl = document.getElementById('composer');

let order = null;
let pollTimer = null;

function fmtTime(ts) {
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

async function loadHeader() {
  order = await api(`/api/orders/${orderId}`);
  headerEl.innerHTML = `
    <a href="${as === 'designer' ? '/dashboard.html' : '/track.html?id=' + orderId}" class="muted" style="font-size:.85rem;">&larr; ${as === 'designer' ? 'Back to dashboard' : 'Back to order'}</a>
    <h1 style="font-size:1.3rem; margin-top:8px; display:flex; align-items:center; gap:10px;">
      <span class="icon" style="color:var(--gold);">${ICONS.needle}</span>
      ${as === 'designer' ? order.customer_name : order.designer.name}
    </h1>
    <p class="muted" style="font-size:.85rem;">Order #${order.id} · ${order.garment_type.replace('_', ' ')}</p>
  `;
}

function renderMessage(m) {
  const mine = m.sender === as;
  if (m.kind === 'text') {
    return `
      <div class="msg-row ${mine ? 'mine' : ''}">
        <div>
          <div class="msg-bubble">${m.body}</div>
          <div class="msg-meta">${fmtTime(m.created_at)}</div>
        </div>
      </div>`;
  }
  if (m.kind === 'photo') {
    return `
      <div class="msg-row ${mine ? 'mine' : ''}">
        <div>
          <div class="msg-bubble photo-update">
            <img src="${m.photo_url}" alt="Progress photo">
            ${m.body ? `<div>${m.body}</div>` : ''}
          </div>
          <div class="msg-meta">${fmtTime(m.created_at)}</div>
        </div>
      </div>`;
  }
  if (m.kind === 'quote') {
    const breakdown = m.quote_breakdown || {};
    const canRespond = as === 'customer' && m.quote_status === 'pending';
    return `
      <div class="msg-row ${mine ? 'mine' : ''}">
        <div>
          <div class="quote-card">
            <div class="quote-title">Quote — ${money(m.quote_amount)}</div>
            ${Object.entries(breakdown).map(([label, amt]) => `<div class="quote-line"><span>${label}</span><span>${money(amt)}</span></div>`).join('')}
            ${m.quote_ready_by ? `<div class="quote-line"><span>Ready by</span><span>${m.quote_ready_by}</span></div>` : ''}
            <div class="quote-total"><span>Total</span><span>${money(m.quote_amount)}</span></div>
            ${m.body ? `<p class="muted" style="font-size:.82rem; margin-top:10px;">${m.body}</p>` : ''}
            ${canRespond ? `
              <div class="quote-actions">
                <button class="btn btn-primary" data-accept="${m.id}" style="flex:1; padding:9px; font-size:.82rem;">Accept Quote</button>
                <button class="btn btn-outline" data-decline="${m.id}" style="flex:1; padding:9px; font-size:.82rem;">Decline</button>
              </div>` : ''}
            ${m.quote_status && m.quote_status !== 'pending' ? `<span class="quote-status-pill ${m.quote_status}">${m.quote_status === 'accepted' ? 'Accepted' : 'Declined'}</span>` : ''}
          </div>
          <div class="msg-meta">${fmtTime(m.created_at)}</div>
        </div>
      </div>`;
  }
  return '';
}

async function loadMessages(preserveScroll) {
  const atBottom = threadEl.scrollTop + threadEl.clientHeight >= threadEl.scrollHeight - 40;
  const messages = await api(`/api/orders/${orderId}/messages`);
  if (messages.length === 0) {
    threadEl.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.needle}</span>No messages yet — say hello.</div>`;
  } else {
    threadEl.innerHTML = messages.map(renderMessage).join('');
  }

  threadEl.querySelectorAll('[data-accept]').forEach(btn => {
    btn.addEventListener('click', () => respondToQuote(btn.dataset.accept, 'accepted'));
  });
  threadEl.querySelectorAll('[data-decline]').forEach(btn => {
    btn.addEventListener('click', () => respondToQuote(btn.dataset.decline, 'declined'));
  });

  if (!preserveScroll || atBottom) threadEl.scrollTop = threadEl.scrollHeight;
}

async function respondToQuote(messageId, response) {
  try {
    await api(`/api/messages/${messageId}/quote-response`, { method: 'PATCH', body: JSON.stringify({ response }) });
    toast(response === 'accepted' ? 'Quote accepted' : 'Quote declined');
    loadMessages(true);
  } catch (err) { toast(err.message); }
}

function renderComposer() {
  composerEl.innerHTML = `
    ${as === 'designer' ? `
      <button class="icon-btn" id="photo-btn" type="button" title="Upload progress photo">${ICONS.camera}</button>
      <input type="file" id="photo-input" accept="image/*" style="display:none;">
    ` : ''}
    <input type="text" id="text-input" placeholder="Type a message…">
    <button class="btn btn-primary" id="send-btn" type="button" style="padding:12px 20px;">Send</button>
  `;

  document.getElementById('send-btn').addEventListener('click', sendText);
  document.getElementById('text-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendText(); });

  if (as === 'designer') {
    document.getElementById('photo-btn').addEventListener('click', () => document.getElementById('photo-input').click());
    document.getElementById('photo-input').addEventListener('change', uploadProgressPhoto);
  }
}

async function sendText() {
  const input = document.getElementById('text-input');
  if (!input.value.trim()) return;
  try {
    await api(`/api/orders/${orderId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ sender: as, kind: 'text', body: input.value.trim() })
    });
    input.value = '';
    loadMessages(true);
  } catch (err) { toast(err.message); }
}

async function uploadProgressPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const form = new FormData();
    form.append('photo', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const caption = prompt('Add a caption for this update (optional):', 'Progress update') || '';
    await api(`/api/orders/${orderId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ sender: 'designer', kind: 'photo', photoUrl: data.url, body: caption })
    });
    toast('Photo update sent');
    loadMessages(true);
  } catch (err) { toast(err.message); }
}

async function init() {
  await loadHeader();
  renderComposer();
  await loadMessages(false);
  api(`/api/orders/${orderId}/messages/mark-read`, { method: 'POST', body: JSON.stringify({ as }) }).catch(() => {});
  pollTimer = setInterval(() => loadMessages(true), 4000);
}

init().catch(err => { threadEl.innerHTML = `<div class="empty-state">${err.message}</div>`; });

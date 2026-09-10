renderNav('messages');

const root = document.getElementById('threads-root');

function timeAgo(ts) {
  const diffMs = Date.now() - new Date(ts.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString();
}

async function load() {
  let threads;
  try {
    threads = await api('/api/orders/mine/threads');
  } catch (err) {
    root.innerHTML = `
      <div class="empty-state">
        <span class="icon">${ICONS.needle}</span>
        Sign in to see your conversations with designers.
        <div style="margin-top:16px;"><a class="btn btn-primary" href="/login.html?redirect=/messages-inbox.html">Sign in</a></div>
      </div>`;
    return;
  }

  if (threads.length === 0) {
    root.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.needle}</span>No conversations yet — message a designer from any of your orders.</div>`;
    return;
  }

  root.innerHTML = `<div class="card">${threads.map(t => `
    <a href="/messages.html?orderId=${t.orderId}&as=customer" class="order-row" style="text-decoration:none; color:inherit; align-items:center;">
      <div class="avatar" style="width:44px; height:44px; border-radius:12px; flex-shrink:0; background-size:cover; background-position:center; background-image:linear-gradient(135deg, ${t.designerSwatch}, ${t.designerSwatch}cc)${t.designerImageUrl ? `, url('${t.designerImageUrl}')` : ''};"></div>
      <div style="flex:1; min-width:0; margin-left:12px;">
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:baseline;">
          <strong style="${t.unreadCount ? 'color:var(--forest-deep);' : ''}">${t.designerName}</strong>
          <span class="muted" style="font-size:.74rem; flex-shrink:0;">${timeAgo(t.lastMessageAt)}</span>
        </div>
        <div class="muted" style="font-size:.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${t.unreadCount ? 'font-weight:700; color:var(--charcoal);' : ''}">
          ${t.lastMessage || `Order: ${t.garmentType.replace('_', ' ')}`}
        </div>
      </div>
      ${t.unreadCount ? `<span class="notif-badge" style="position:static; margin-left:8px;">${t.unreadCount > 9 ? '9+' : t.unreadCount}</span>` : ''}
    </a>
  `).join('')}</div>`;
}

load();

renderNav(null);

const root = document.getElementById('root');
const groupId = qs('id');

async function load() {
  const group = await api(`/api/group-orders/${groupId}`);
  const joinUrl = `${window.location.origin}/group-order-join.html?code=${group.join_code}`;

  root.innerHTML = `
    <a href="/designer.html?id=${group.designer.id}" class="muted" style="font-size:.85rem;">&larr; Back to ${group.designer.name}</a>
    <h1 style="font-size:1.4rem; margin-top:10px;">${group.title}</h1>
    <p class="muted">${group.garment_type.replace('_', ' ')} with ${group.designer.name}${group.deadline ? ' · needed by ' + group.deadline : ''}</p>

    <div class="join-code-display" style="margin-top:16px;">
      <div class="muted" style="font-size:.8rem;">Share this code with your group</div>
      <div class="code">${group.join_code}</div>
      <p class="muted" style="font-size:.82rem; margin-top:8px; word-break:break-all;">${joinUrl}</p>
      <button class="btn btn-outline" id="copy-btn" type="button" style="margin-top:10px;">Copy link</button>
    </div>

    <div class="section-title" style="margin-top:28px;">
      <h2 style="font-size:1.05rem;">Who's joined (${group.members.length})</h2>
      <span class="pill">${group.status === 'open' ? 'Open' : 'Closed'}</span>
    </div>
    <div class="card" id="members-card"></div>

    ${group.status === 'open'
      ? `<button class="btn btn-outline" id="close-btn" type="button" style="margin-top:16px;">Close group order</button>`
      : ''}
  `;

  const membersCard = document.getElementById('members-card');
  membersCard.innerHTML = group.members.length === 0
    ? `<div class="empty-state"><span class="icon">${ICONS.needle}</span>No one has joined yet — share the code above.</div>`
    : group.members.map(m => `
        <div class="member-row">
          <div>
            <strong>${m.customer_name}</strong>
            <div class="muted" style="font-size:.82rem;">Size ${m.recommended_size} · ${m.customer_phone}</div>
          </div>
          <span class="pill">${STATUS_LABELS[m.status]}</span>
        </div>
      `).join('');

  document.getElementById('copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(joinUrl).then(() => toast('Link copied'));
  });

  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', async () => {
      try {
        await api(`/api/group-orders/${groupId}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) });
        toast('Group order closed');
        load();
      } catch (err) { toast(err.message); }
    });
  }
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

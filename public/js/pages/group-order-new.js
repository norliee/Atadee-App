renderNav(null);

const root = document.getElementById('root');
const designerId = qs('designerId');

async function load() {
  const [designer, garments] = await Promise.all([
    api(`/api/designers/${designerId}`),
    api('/api/garments')
  ]);

  root.innerHTML = `
    <a href="/designer.html?id=${designerId}" class="muted" style="font-size:.85rem;">&larr; Back to ${designer.name}</a>
    <h1 style="font-size:1.4rem; margin-top:10px; display:flex; align-items:center; gap:10px;"><span class="icon" style="color:var(--gold);">${ICONS.spool}</span>Start a group order</h1>
    <p class="muted">For a wedding party, church group, school, or company uniforms with ${designer.name}.</p>

    <div class="card" style="padding:22px; margin-top:16px;">
      <div class="measure-field"><label>Group name</label><input id="title" placeholder="e.g. Owusu Wedding Party"></div>
      <div class="measure-field"><label>What is everyone getting made?</label>
        <select id="garment">${garments.map(g => `<option value="${g.key}">${g.label}</option>`).join('')}</select>
      </div>
      <div class="measure-field"><label>Deadline (optional)</label><input type="date" id="deadline"></div>
      <div class="measure-field"><label>Budget guidance for participants (optional)</label><input id="budget-note" placeholder="e.g. GH₵400–600 per person"></div>
      <h3 style="font-size:.95rem; margin-top:18px;">Your details (organizer)</h3>
      <div class="measure-field"><label>Full name</label><input id="organizer-name" placeholder="e.g. Abena Owusu"></div>
      <div class="measure-field"><label>Phone number</label><input id="organizer-phone" placeholder="e.g. 024 123 4567"></div>
      <button class="btn btn-primary btn-block" id="create-btn" type="button" style="margin-top:10px;">Create group order</button>
    </div>
  `;

  document.getElementById('create-btn').addEventListener('click', async (e) => {
    const title = document.getElementById('title').value;
    const organizerName = document.getElementById('organizer-name').value;
    const organizerPhone = document.getElementById('organizer-phone').value;
    if (!title || !organizerName || !organizerPhone) { toast('Fill in the group name and your details'); return; }

    e.target.disabled = true; e.target.textContent = 'Creating…';
    try {
      const result = await api('/api/group-orders', {
        method: 'POST',
        body: JSON.stringify({
          designerId: Number(designerId),
          title,
          garmentType: document.getElementById('garment').value,
          organizerName, organizerPhone,
          deadline: document.getElementById('deadline').value || null,
          budgetNote: document.getElementById('budget-note').value || null
        })
      });
      window.location.href = `/group-order-view.html?id=${result.id}`;
    } catch (err) {
      toast(err.message);
      e.target.disabled = false; e.target.textContent = 'Create group order';
    }
  });
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

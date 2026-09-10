renderNav('requests');

const root = document.getElementById('root');
const requestId = qs('id');

const CHANGE_LABELS = {
  different_fabric: 'Different fabric', longer_sleeves: 'Longer sleeves', different_neckline: 'Different neckline',
  different_colour: 'Different colour', less_fitted: 'Less fitted', add_embroidery: 'Add embroidery', make_similar: 'Make something similar'
};

async function load() {
  const request = await api(`/api/style-requests/${requestId}`);

  root.innerHTML = `
    <h1 style="font-size:1.4rem;">Your style request</h1>
    <p class="muted">Posted ${new Date(request.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()} · <span class="pill">${request.status === 'open' ? 'Open for quotes' : 'Closed'}</span></p>

    <div class="card" style="padding:20px; margin-top:16px;">
      ${request.reference_image_url ? `<img src="${request.reference_image_url}" style="width:100%; max-width:280px; border-radius:12px; margin-bottom:14px;">` : ''}
      ${request.changes_wanted.length ? `<div class="change-chip-grid" style="margin-bottom:10px;">${request.changes_wanted.map(c => `<span class="change-chip active" style="cursor:default;">${CHANGE_LABELS[c] || c}</span>`).join('')}</div>` : ''}
      ${request.notes ? `<p>${request.notes}</p>` : ''}
      <p class="muted" style="font-size:.85rem; margin-top:8px;">
        ${request.location ? '📍 ' + request.location + ' · ' : ''}
        ${request.budget_min ? money(request.budget_min) + '–' + money(request.budget_max) + ' · ' : ''}
        ${request.deadline ? 'needed by ' + request.deadline : ''}
      </p>
    </div>

    <div class="section-title" style="margin-top:26px;">
      <h2 style="font-size:1.05rem;">Quotes (${request.quotes.length})</h2>
    </div>
    <div id="quotes-list"></div>
  `;

  const quotesList = document.getElementById('quotes-list');
  if (request.quotes.length === 0) {
    quotesList.innerHTML = `<div class="card empty-state"><span class="icon">${ICONS.spool}</span>No quotes yet — designers matching your category will see this request soon.</div>`;
    return;
  }

  quotesList.innerHTML = `<div class="card" style="padding:0 20px;">${request.quotes.map(q => `
    <div class="quote-list-item">
      <div class="avatar" style="background:linear-gradient(135deg, ${q.designer_swatch}, ${q.designer_swatch}cc); ${q.designer_image_url ? `background-image:url('${q.designer_image_url}');` : ''}"></div>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:6px;">
          <a href="/designer.html?id=${q.designer_id}" style="font-weight:600; text-decoration:underline;">${q.designer_name}${q.designer_verified ? ' ✓' : ''}</a>
          <span class="stars" style="font-size:.8rem;">${starString(q.designer_rating)}</span>
        </div>
        <div class="muted" style="font-size:.82rem;">${q.designer_location}</div>
        <div style="margin-top:8px; font-family:'Fraunces',serif; font-weight:700; font-size:1.1rem; color:var(--forest-deep);">${money(q.amount)}</div>
        ${q.ready_by ? `<div class="muted" style="font-size:.82rem;">Ready by ${q.ready_by}</div>` : ''}
        ${q.note ? `<p style="font-size:.88rem; margin-top:6px;">${q.note}</p>` : ''}
        ${request.status === 'open'
          ? `<button class="btn btn-primary" data-accept="${q.id}" style="margin-top:10px; padding:9px 18px; font-size:.82rem;">Accept & continue</button>`
          : q.status === 'accepted' ? `<span class="quote-status-pill accepted" style="margin-top:8px;">Accepted</span>` : `<span class="quote-status-pill declined" style="margin-top:8px;">Not selected</span>`
        }
      </div>
    </div>
  `).join('')}</div>`;

  quotesList.querySelectorAll('[data-accept]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Accepting…';
      try {
        const quote = request.quotes.find(q => q.id === Number(btn.dataset.accept));
        const result = await api(`/api/style-requests/${requestId}/quotes/${btn.dataset.accept}/accept`, { method: 'POST' });
        // Carry the reference photo + notes into the guided order flow.
        localStorage.setItem('atadee_pending_style_request', JSON.stringify({
          referenceImageUrl: request.reference_image_url,
          notes: request.notes,
          changesWanted: request.changes_wanted
        }));
        const garment = request.garment_type || '';
        window.location.href = garment
          ? `/order.html?designerId=${result.designerId}&garment=${garment}`
          : `/designer.html?id=${result.designerId}`;
      } catch (err) {
        toast(err.message);
        btn.disabled = false; btn.textContent = 'Accept & continue';
      }
    });
  });
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

renderNav(null);

const root = document.getElementById('review-root');
const orderId = qs('id');

const CATEGORIES = [
  { key: 'quality', label: 'Quality of sewing' },
  { key: 'fit', label: 'Fit' },
  { key: 'communication', label: 'Communication' },
  { key: 'accuracy', label: 'Accuracy to what you asked for' },
  { key: 'value', label: 'Value for money' },
  { key: 'onTime', label: 'On-time delivery' }
];

const scores = {};

function starRow(key) {
  return `
    <div class="measure-field">
      <label>${CATEGORIES.find(c => c.key === key).label}</label>
      <div class="star-rating" data-key="${key}">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}">★</button>`).join('')}
      </div>
    </div>`;
}

async function load() {
  const order = await api(`/api/orders/${orderId}`);
  const existing = await api(`/api/orders/${orderId}/review`);

  if (order.status !== 'completed') {
    root.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.scissors}</span>This order isn't marked completed yet — you can leave a review once it's finished.</div>`;
    return;
  }
  if (existing) {
    root.innerHTML = `
      <div class="empty-state">
        <span class="icon">${ICONS.heart}</span>
        You already reviewed this order — thank you!
        <div style="margin-top:16px;"><a class="btn btn-outline" href="/designer.html?id=${order.designer.id}">View ${order.designer.name}</a></div>
      </div>`;
    return;
  }

  root.innerHTML = `
    <a href="/track.html?id=${orderId}" class="muted" style="font-size:.85rem;">&larr; Back to order</a>
    <h1 style="font-size:1.4rem; margin-top:10px;">How was your order from ${order.designer.name}?</h1>
    <p class="muted">Order #${order.id} · ${order.garment_type.replace('_', ' ')}</p>

    <div class="card" style="padding:22px; margin-top:16px;">
      ${CATEGORIES.map(c => starRow(c.key)).join('')}

      <div class="measure-field">
        <label>Would you use this designer again?</label>
        <div class="toggle-row">
          <button type="button" class="toggle-option active" id="reorder-yes" data-val="1">Yes</button>
          <button type="button" class="toggle-option" id="reorder-no" data-val="0">No</button>
        </div>
      </div>

      <div class="measure-field">
        <label>Tell others about your experience (optional)</label>
        <input id="comment" placeholder="What stood out about this designer?">
      </div>

      <button class="btn btn-primary btn-block" id="submit-review" type="button" style="margin-top:10px;">Submit review</button>
    </div>
  `;

  document.querySelectorAll('.star-rating').forEach(row => {
    const key = row.dataset.key;
    scores[key] = 0;
    row.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        scores[key] = Number(btn.dataset.star);
        row.querySelectorAll('button').forEach(b => b.classList.toggle('filled', Number(b.dataset.star) <= scores[key]));
      });
    });
  });

  let wouldReorder = true;
  document.getElementById('reorder-yes').addEventListener('click', () => {
    wouldReorder = true;
    document.getElementById('reorder-yes').classList.add('active');
    document.getElementById('reorder-no').classList.remove('active');
  });
  document.getElementById('reorder-no').addEventListener('click', () => {
    wouldReorder = false;
    document.getElementById('reorder-no').classList.add('active');
    document.getElementById('reorder-yes').classList.remove('active');
  });

  document.getElementById('submit-review').addEventListener('click', async (e) => {
    const missing = CATEGORIES.filter(c => !scores[c.key]);
    if (missing.length) { toast(`Rate "${missing[0].label}" before submitting`); return; }

    e.target.disabled = true; e.target.textContent = 'Submitting…';
    try {
      await api(`/api/orders/${orderId}/review`, {
        method: 'POST',
        body: JSON.stringify({ ...scores, wouldReorder, comment: document.getElementById('comment').value || null })
      });
      root.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.heart}</span>Thank you — your review helps other customers find great designers.<div style="margin-top:16px;"><a class="btn btn-primary" href="/designer.html?id=${order.designer.id}">View ${order.designer.name}</a></div></div>`;
    } catch (err) {
      toast(err.message);
      e.target.disabled = false; e.target.textContent = 'Submit review';
    }
  });
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

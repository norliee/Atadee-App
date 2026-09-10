renderNav('browse');

const root = document.getElementById('track-root');
const orderId = qs('id');

async function load() {
  const [order, messages] = await Promise.all([
    api(`/api/orders/${orderId}`),
    api(`/api/orders/${orderId}/messages`)
  ]);
  const statusIdx = STATUS_FLOW.indexOf(order.status);
  const photoMessages = messages.filter(m => m.kind === 'photo' && m.sender === 'designer');

  // Payment only unlocks once the designer has actually started work (in
  // progress or further) AND has shared at least one in-app progress photo —
  // this is a deliberate anti-scam guard so no one pays a stranger upfront
  // with nothing to show for it.
  const productionStarted = ['in_progress', 'ready_for_pickup', 'completed'].includes(order.status);
  const paymentUnlocked = productionStarted && photoMessages.length > 0;
  const canPay = order.quoted_price && order.payment_status !== 'paid';

  root.innerHTML = `
    <h1 style="font-size:1.5rem;">Order #${order.id}</h1>
    <p class="muted">${order.order_type === 'ready_to_wear' ? 'Ready-to-wear · ' : ''}${order.garment_type.replace('_', ' ')} · ${order.order_type === 'ready_to_wear' ? 'bought from' : 'requested from'} <a href="/designer.html?id=${order.designer.id}" style="text-decoration:underline;">${order.designer.name}</a></p>

    <div class="card status-checklist-card" style="padding:20px;">
      ${STATUS_FLOW.map((s, i) => `
        <div class="checklist-row ${i < statusIdx ? 'done' : ''} ${i === statusIdx ? 'current' : ''}">
          <span class="checklist-mark">${i < statusIdx ? '✓' : i === statusIdx ? '●' : '○'}</span>
          <span>${STATUS_LABELS[s]}</span>
        </div>
      `).join('')}
    </div>

    <div class="card" style="padding:20px; margin-top:16px;">
      <div class="section-title" style="margin-bottom:10px;"><h2 style="font-size:1rem; margin:0;">Order details</h2><span class="pill">${STATUS_LABELS[order.status]}</span></div>
      <p><strong>Size:</strong> ${order.recommended_size} <span class="muted">— ${order.fit_note || ''}</span></p>
      <p><strong>Price:</strong> ${order.quoted_price ? money(order.quoted_price) : "Your designer hasn't set a price yet"}</p>
      ${order.quoted_price ? `<p><strong>Payment:</strong> ${order.payment_status === 'paid' ? `<span style="color:var(--forest);">Paid in full ✓</span>` : order.payment_status === 'partial' ? `${money(order.amount_paid)} paid, ${money(order.quoted_price - order.amount_paid)} remaining` : 'Not yet paid'}</p>` : ''}
      ${order.budget_min ? `<p><strong>Your budget:</strong> ${money(order.budget_min)}–${money(order.budget_max)}</p>` : ''}
      ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
      ${order.reference_image_url ? `
        <div style="margin-top:12px;">
          <strong style="font-size:.92rem;">Inspiration photo</strong>
          <img src="${order.reference_image_url}" style="display:block; width:100px; height:100px; object-fit:cover; border-radius:10px; margin-top:6px;">
        </div>` : ''}
      <p class="muted" style="font-size:.8rem; margin-top:14px;">Placed by ${order.customer_name} · ${order.customer_phone}${order.customer_country && order.customer_country !== 'Ghana' ? ` · ordering from ${order.customer_country}` : ''}</p>

      ${canPay && order.order_type !== 'ready_to_wear' ? (paymentUnlocked ? `
        <div style="margin-top:14px;">
          <a class="btn btn-primary" href="/payment.html?id=${order.id}"><span class="icon" style="width:16px;height:16px;">${ICONS.tape}</span>Pay now</a>
        </div>` : `
        <div class="card" style="padding:14px 16px; margin-top:14px; background:var(--ivory); border-color:var(--gold-soft);">
          <p style="font-size:.85rem; margin:0; display:flex; gap:8px;"><span class="icon" style="width:16px;height:16px; color:var(--gold); flex-shrink:0;">${ICONS.heart}</span>
          <span>Payment unlocks once your designer has started cutting/sewing and shared a progress photo in the message thread — this protects you from paying upfront before any real work has begun.</span></p>
        </div>`) : ''}
      ${canPay && order.order_type === 'ready_to_wear' ? `
        <div style="margin-top:14px;"><a class="btn btn-primary" href="/payment.html?id=${order.id}"><span class="icon" style="width:16px;height:16px;">${ICONS.tape}</span>Pay now</a></div>` : ''}

      <div style="margin-top:10px;">
        <a class="btn btn-gold" href="/messages.html?orderId=${order.id}&as=customer">
          <span class="icon" style="width:16px;height:16px;">${ICONS.needle}</span>Message ${order.designer.name}
        </a>
      </div>
      ${order.status === 'completed' ? `<div id="review-cta" style="margin-top:10px;"></div>` : ''}
    </div>

    ${order.order_for === 'other' ? `
    <div class="card" style="padding:20px; margin-top:16px;">
      <h2 style="font-size:1rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.heart}</span>Delivering to</h2>
      <p><strong>${order.recipient_name}</strong> · ${order.recipient_phone}</p>
      <p class="muted" style="font-size:.9rem;">${order.delivery_address}, ${order.delivery_country}</p>
    </div>` : ''}
    ${order.order_type === 'ready_to_wear' && order.delivery_address ? `
    <div class="card" style="padding:20px; margin-top:16px;">
      <h2 style="font-size:1rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.heart}</span>Delivery address</h2>
      <p class="muted" style="font-size:.9rem;">${order.delivery_address}, ${order.delivery_country}</p>
    </div>` : ''}

    <div class="card" style="padding:20px; margin-top:16px;" id="progress-photos-card"></div>

    ${order.order_type === 'ready_to_wear' ? '' : `
    <div class="card" style="padding:20px; margin-top:16px;">
      <h2 style="font-size:1rem;">Measurements submitted</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; margin-top:10px;">
        ${Object.entries(order.measurements).map(([k, v]) => `<div class="muted" style="font-size:.85rem;"><strong style="color:var(--forest-deep);">${v}"</strong> ${k.replace('_', ' ')}</div>`).join('')}
      </div>
    </div>`}
  `;

  if (order.status === 'completed') {
    const existingReview = await api(`/api/orders/${orderId}/review`);
    const ctaEl = document.getElementById('review-cta');
    ctaEl.innerHTML = existingReview
      ? `<span class="muted" style="font-size:.85rem; display:flex; align-items:center; gap:6px;"><span class="icon" style="width:15px;height:15px; color:var(--gold);">${ICONS.heart}</span>You reviewed this order — thank you!</span>`
      : `<a class="btn btn-outline" href="/review.html?id=${order.id}" style="display:inline-flex;"><span class="icon" style="width:16px;height:16px;">${ICONS.heart}</span>Rate your order</a>`;
  }

  const photosCard = document.getElementById('progress-photos-card');
  if (photoMessages.length === 0) {
    photosCard.innerHTML = `
      <h2 style="font-size:1rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.spool}</span>Progress updates</h2>
      <p class="muted" style="font-size:.85rem; margin-top:8px;">Your designer hasn't posted any progress photos yet.</p>`;
  } else {
    photosCard.innerHTML = `
      <h2 style="font-size:1rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.spool}</span>Progress updates</h2>
      <div style="display:flex; gap:14px; overflow-x:auto; margin-top:12px; padding-bottom:4px;">
        ${photoMessages.map(m => `
          <div style="flex-shrink:0; width:160px;">
            <img src="${m.photo_url}" style="width:160px; height:160px; object-fit:cover; border-radius:12px;">
            <div style="font-size:.8rem; margin-top:6px;">${m.body || ''}</div>
            <div class="muted" style="font-size:.72rem;">${new Date(m.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</div>
          </div>
        `).join('')}
      </div>`;
  }
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

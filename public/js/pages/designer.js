renderNav('browse');

const root = document.getElementById('profile-root');
const id = qs('id');

const GARMENT_ICONS = {
  mens_shirt: 'mannequin',
  mens_suit: 'mannequin',
  kaftan_agbada: 'spool',
  womens_dress: 'mannequin',
  kaba_slit: 'mannequin',
  kids_outfit: 'scissors'
};

const CATEGORY_LABELS = {
  quality: 'Quality of sewing', fit: 'Fit', communication: 'Communication',
  accuracy: 'Accuracy to style', value: 'Value for money', on_time: 'On-time delivery'
};

function trustBadges(d) {
  const badges = [];
  if (d.phone_verified) badges.push('Phone Verified');
  if (d.id_verified) badges.push('Identity Verified');
  if (d.business_verified) badges.push('Business Verified');
  if (d.portfolio_verified) badges.push('Portfolio Verified');
  return badges;
}

const SUS_LABELS = {
  sus_offcuts: 'Uses fabric offcuts & production scraps',
  sus_recycled: 'Uses recycled & reclaimed textiles',
  sus_deadstock: 'Uses deadstock & surplus fabrics',
  sus_upcycled: 'Creates upcycled garments & materials',
  sus_local_sourced: 'Sources materials locally where possible',
  sus_low_waste_cutting: 'Uses low-waste cutting techniques',
  sus_repair_alterations: 'Offers repair & alteration services'
};

function sustainabilityPractices(d) {
  return Object.keys(SUS_LABELS).filter(key => d[key]);
}

async function load() {
  const [designer, garments, reviewData, services, posts] = await Promise.all([
    api(`/api/designers/${id}`),
    api('/api/garments'),
    api(`/api/designers/${id}/reviews`),
    api(`/api/designers/${id}/services`),
    api(`/api/designers/${id}/posts`)
  ]);

  document.title = `${designer.name} — atadeɛ`;
  const badges = trustBadges(designer);
  const { reviews, stats } = reviewData;
  const AVAIL_LABELS = { accepting: 'Accepting orders', limited: 'Limited availability', booked: 'Fully booked' };
  const AVAIL_COLORS = { accepting: 'var(--forest)', limited: 'var(--gold)', booked: 'var(--terracotta)' };

  root.innerHTML = `
    <a href="/index.html" class="muted" style="font-size:.85rem;">&larr; Back to explore</a>
    <div class="profile-header" style="margin-top:14px;">
      <div class="profile-swatch" style="background:linear-gradient(135deg, ${designer.swatch}, ${designer.swatch}cc);">
        ${designer.image_url ? `<img class="cover-photo" src="${designer.image_url}" alt="${designer.name}" style="border-radius:22px;">` : `<span class="icon">${ICONS.mannequin}</span>`}
      </div>
      <div style="flex:1; min-width:220px;">
        <div class="cat">${designer.category}</div>
        <h1 style="font-size:1.7rem; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">${designer.name}${designer.sustainable_badge ? `<span class="sustain-badge"><span class="icon">${ICONS.leaf}</span>Sustainable Designer</span>` : ''}</h1>
        <div class="muted">${designer.specialties}</div>
        <div class="meta" style="display:flex; gap:20px; margin-top:10px; font-size:.9rem; flex-wrap:wrap;">
          <span>📍 ${designer.location}</span>
          <span class="stars">${starString(designer.rating)} <span class="muted">(${designer.reviews_count} reviews)</span></span>
          <span>${money(designer.price_min)}–${money(designer.price_max)}</span>
          <span>~${designer.turnaround_days} day turnaround</span>
          <span style="color:${AVAIL_COLORS[designer.availability]}; font-weight:600;"><span class="availability-dot ${designer.availability}"></span>${AVAIL_LABELS[designer.availability]}${designer.capacity_note ? ' · ' + designer.capacity_note : ''}</span>
        </div>
        ${badges.length ? `<div class="badge-row">${badges.map(b => `<span class="trust-badge"><span class="icon">${ICONS.heart}</span>${b}</span>`).join('')}</div>` : ''}
      </div>
    </div>

    ${posts.length ? `
    <div style="margin-top:20px;">
      <h2 style="font-size:1rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:18px;height:18px;color:var(--gold);">${ICONS.spool}</span>Latest from ${designer.name.split(' ')[0]}</h2>
      <div class="posts-strip" style="margin-top:10px;">
        ${posts.map(p => `
          <div class="post-card">
            <img src="${p.media_url}">
            ${p.caption ? `<div class="caption">${p.caption}</div>` : ''}
            <button class="post-like-btn ${isPostLiked(p.id) ? 'liked' : ''}" data-post-like="${p.id}" type="button">
              <span class="icon">${ICONS.heart}</span><span data-like-count="${p.id}">${p.likes_count}</span>
            </button>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="two-col">
      <div>
        <h2 style="font-size:1.15rem;">About</h2>
        <p>${designer.bio}</p>

        ${services.length ? `
        <div class="card" style="padding:18px; margin-top:18px;">
          <h3 style="font-size:.95rem; margin:0 0 8px;">Starting prices</h3>
          ${services.map(s => `<div class="service-row"><span>${s.label}</span><strong>from ${money(s.price_from)}</strong></div>`).join('')}
        </div>` : ''}

        ${sustainabilityPractices(designer).length ? `
        <div class="sustain-card" style="margin-top:18px;">
          <h3><span class="icon" style="color:var(--forest);">${ICONS.leaf}</span>${designer.name.split(' ')[0]}'s sustainability profile</h3>
          <ul class="sustain-list">
            ${sustainabilityPractices(designer).map(key => `<li><span class="icon">${ICONS.leaf}</span>${SUS_LABELS[key]}</li>`).join('')}
          </ul>
        </div>` : ''}

        ${stats.totalOrders > 0 ? `
        <div class="card" style="padding:18px; margin-top:18px;">
          <h3 style="font-size:.95rem; margin:0;">Track record</h3>
          <div class="trust-stats-grid">
            <div class="trust-stat"><div class="value">${stats.completionRate}%</div><div class="label">Orders completed</div></div>
            <div class="trust-stat"><div class="value">${stats.onTimeRate !== null ? stats.onTimeRate + '%' : '—'}</div><div class="label">On-time completion</div></div>
            <div class="trust-stat"><div class="value">${stats.verifiedReviewCount}</div><div class="label">Verified reviews</div></div>
          </div>
        </div>` : ''}

        <h2 style="font-size:1.15rem; margin-top:24px; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.spool}</span>Portfolio</h2>
        <div class="portfolio-grid">
          ${designer.portfolio.map(p => `
            <div class="portfolio-item" style="background:linear-gradient(150deg, ${p.swatch}, ${p.swatch}bb);">
              ${p.image_url ? `<img class="portfolio-photo" src="${p.image_url}" alt="${p.title}" style="position:absolute; inset:0; border-radius:var(--radius);">` : `<span class="icon">${ICONS.mannequin}</span>`}
              <span style="position:relative; z-index:1;">${p.title}</span>
            </div>`).join('')}
        </div>

        <h2 style="font-size:1.15rem; margin-top:28px; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.heart}</span>Reviews</h2>
        ${reviews.length === 0 ? `<p class="muted" style="font-size:.9rem;">No reviews yet — this designer's first atadeɛ orders are still in progress.</p>` : `
          ${stats.wouldReorderPct !== null ? `<p style="font-size:.9rem; margin-bottom:14px;"><strong style="color:var(--forest-deep);">${stats.wouldReorderPct}%</strong> of customers would use this designer again</p>` : ''}
          <div class="card" style="padding:0 20px;">
            ${reviews.map(r => `
              <div class="review-item">
                <div class="review-head">
                  <span class="review-name">${r.customer_name}<span class="verified-pill"><span class="icon" style="width:10px;height:10px;">${ICONS.heart}</span>Verified Purchase</span></span>
                  <span class="muted" style="font-size:.78rem;">${new Date(r.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</span>
                </div>
                <div class="review-cats">
                  ${Object.keys(CATEGORY_LABELS).map(cat => `<span>${CATEGORY_LABELS[cat]}: <strong style="color:var(--forest-deep);">${r[cat]}★</strong></span>`).join('')}
                </div>
                ${r.comment ? `<p class="review-comment">${r.comment}</p>` : ''}
                ${r.would_reorder ? `<span class="reorder-badge">✓ Would use this designer again</span>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
      <div>
        <div class="card" style="padding:22px;">
          <h2 style="font-size:1.1rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.needle}</span>Start an order</h2>
          <p class="muted" style="font-size:.85rem;">Choose what you're getting made. We'll ask only for the measurements that garment needs.</p>
          <div class="garment-grid" id="garment-grid" style="margin-top:14px;"></div>
        </div>
        <div class="card" style="padding:20px; margin-top:16px;">
          <a href="/group-order-new.html?designerId=${id}" class="btn btn-outline btn-block" style="margin-bottom:10px;">
            <span class="icon" style="width:16px;height:16px;">${ICONS.spool}</span>Planning for a group?
          </a>
          <a href="/appointment.html?designerId=${id}" class="btn btn-outline btn-block">
            <span class="icon" style="width:16px;height:16px;">${ICONS.tape}</span>Book an appointment
          </a>
        </div>
      </div>
    </div>
  `;

  const grid = document.getElementById('garment-grid');
  grid.innerHTML = garments.map(g => `
    <button class="garment-option" data-key="${g.key}">
      <span class="icon">${ICONS[GARMENT_ICONS[g.key] || 'mannequin']}</span>
      <span>
        <strong>${g.label}</strong>
        <span>${g.fields.length} measurements</span>
      </span>
    </button>
  `).join('');
  grid.querySelectorAll('.garment-option').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `/order.html?designerId=${id}&garment=${btn.dataset.key}`;
    });
  });

  document.querySelectorAll('[data-post-like]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.postLike;
      const liked = isPostLiked(postId);
      try {
        const result = await api(`/api/posts/${postId}/like`, { method: 'POST', body: JSON.stringify({ action: liked ? 'unlike' : 'like' }) });
        togglePostLiked(postId, !liked);
        btn.classList.toggle('liked', !liked);
        document.querySelector(`[data-like-count="${postId}"]`).textContent = result.likesCount;
      } catch (err) { toast(err.message); }
    });
  });

  // Record a view once per browser session per profile/post, so refreshing
  // the page doesn't inflate the designer's numbers artificially.
  if (!sessionStorage.getItem(`viewed_designer_${id}`)) {
    sessionStorage.setItem(`viewed_designer_${id}`, '1');
    api(`/api/designers/${id}/view`, { method: 'POST' }).catch(() => {});
  }
  posts.forEach(p => {
    if (!sessionStorage.getItem(`viewed_post_${p.id}`)) {
      sessionStorage.setItem(`viewed_post_${p.id}`, '1');
      api(`/api/posts/${p.id}/view`, { method: 'POST' }).catch(() => {});
    }
  });
}

function isPostLiked(postId) {
  try { return JSON.parse(localStorage.getItem('atadee_liked_posts') || '[]').includes(String(postId)); } catch { return false; }
}
function togglePostLiked(postId, liked) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('atadee_liked_posts') || '[]'); } catch {}
  const id = String(postId);
  list = liked ? [...new Set([...list, id])] : list.filter(x => x !== id);
  localStorage.setItem('atadee_liked_posts', JSON.stringify(list));
}

load().catch(err => {
  root.innerHTML = `<div class="empty-state">${err.message}</div>`;
});

renderNav('circular');

const root = document.getElementById('root');
const listingId = qs('id');

async function load() {
  const listing = await api(`/api/fabric-listings/${listingId}`);

  root.innerHTML = `
    <a href="/fabric-marketplace.html" class="muted" style="font-size:.85rem;">&larr; Back to marketplace</a>
    <div class="card" style="margin-top:14px; overflow:hidden;">
      <div class="cover" style="aspect-ratio:4/3; background:linear-gradient(135deg, ${listing.designer_swatch}, ${listing.designer_swatch}cc); display:flex; align-items:center; justify-content:center;">
        ${listing.image_url ? `<img src="${listing.image_url}" style="width:100%; height:100%; object-fit:cover;">` : `<span class="icon" style="width:44px;height:44px;color:#fff;">${ICONS.leaf}</span>`}
      </div>
      <div style="padding:20px;">
        <div class="cat">${listing.fabric_type}</div>
        <h1 style="font-size:1.4rem; margin:6px 0;">${listing.title}</h1>
        <p class="muted" style="font-size:.9rem;">From <a href="/designer.html?id=${listing.designer_id}" style="text-decoration:underline;">${listing.designer_name}</a> · ${listing.designer_location}</p>
        ${listing.description ? `<p style="margin-top:10px;">${listing.description}</p>` : ''}
        <div style="display:flex; gap:20px; margin-top:14px; font-size:.95rem;">
          <span><strong style="font-family:'Fraunces',serif; color:var(--forest-deep);">${listing.quantity_meters}m</strong> available</span>
          <span><strong style="font-family:'Fraunces',serif; color:var(--forest-deep);">${money(listing.price)}</strong></span>
        </div>
      </div>
    </div>

    <div class="card" style="padding:22px; margin-top:16px;" id="request-card"></div>
  `;

  const requestCard = document.getElementById('request-card');
  if (listing.status !== 'available') {
    requestCard.innerHTML = `<p class="muted">This fabric has already been ${listing.status === 'sold' ? 'sold' : 'reserved'}.</p>`;
    return;
  }

  requestCard.innerHTML = `
    <h2 style="font-size:1rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="color:var(--forest); width:18px; height:18px;">${ICONS.leaf}</span>Request this fabric</h2>
    <p class="muted" style="font-size:.85rem;">Send a request — the designer will confirm pickup or delivery details with you directly.</p>
    <div class="measure-field"><label>I am a…</label>
      <select id="buyer-type">
        <option value="designer">Fashion designer / tailor</option>
        <option value="student">Fashion student</option>
        <option value="craftsperson">Craftsperson / maker</option>
        <option value="customer">Individual customer</option>
      </select>
    </div>
    <div class="measure-field"><label>Full name</label><input id="buyer-name" placeholder="e.g. Kwame Asante"></div>
    <div class="measure-field"><label>Phone number</label><input id="buyer-phone" placeholder="e.g. 024 123 4567"></div>
    <div class="measure-field"><label>Message (optional)</label><input id="buyer-message" placeholder="What you're making, how much you need…"></div>
    <button class="btn btn-primary btn-block" id="request-btn" type="button">Send request</button>
  `;

  document.getElementById('request-btn').addEventListener('click', async (e) => {
    const buyerName = document.getElementById('buyer-name').value;
    const buyerPhone = document.getElementById('buyer-phone').value;
    if (!buyerName || !buyerPhone) { toast('Add your name and phone number'); return; }

    e.target.disabled = true; e.target.textContent = 'Sending…';
    try {
      await api(`/api/fabric-listings/${listingId}/request`, {
        method: 'POST',
        body: JSON.stringify({
          buyerName, buyerPhone,
          buyerType: document.getElementById('buyer-type').value,
          message: document.getElementById('buyer-message').value || null
        })
      });
      requestCard.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.leaf}</span>Request sent — ${listing.designer_name} will follow up with you directly.</div>`;
    } catch (err) {
      toast(err.message);
      e.target.disabled = false; e.target.textContent = 'Send request';
    }
  });
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

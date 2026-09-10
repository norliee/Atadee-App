renderNav('shop');

const root = document.getElementById('root');
const itemId = qs('id');

async function load() {
  const item = await api(`/api/shop-items/${itemId}`);

  root.innerHTML = `
    <a href="/shop.html" class="muted" style="font-size:.85rem;">&larr; Back to shop</a>
    <div class="card" style="margin-top:14px; overflow:hidden;">
      <div class="photo" style="aspect-ratio:4/5; background:linear-gradient(150deg, ${item.designer_swatch}, ${item.designer_swatch}bb); display:flex; align-items:center; justify-content:center; position:relative;">
        ${item.image_url ? `<img src="${item.image_url}" alt="${item.title}" style="width:100%; height:100%; object-fit:cover;">` : `<span class="icon" style="width:50px;height:50px;color:#fff;">${ICONS.mannequin}</span>`}
      </div>
      <div style="padding:20px;">
        <div class="cat">${item.designer_name} · ${item.designer_location}</div>
        <h1 style="font-size:1.4rem; margin:6px 0;">${item.title}</h1>
        <div style="display:flex; gap:16px; align-items:center; font-size:.95rem;">
          <span class="price" style="font-family:'Fraunces',serif; font-weight:700; color:var(--forest-deep); font-size:1.3rem;">${money(item.price)}</span>
          <span class="muted">Size ${item.size}</span>
          <span class="muted">${item.stock === 0 ? 'Sold out' : item.stock <= 2 ? `Only ${item.stock} left` : `${item.stock} in stock`}</span>
        </div>
      </div>
    </div>

    <div class="card" style="padding:22px; margin-top:16px;" id="buy-card"></div>
  `;

  const buyCard = document.getElementById('buy-card');
  if (item.stock === 0) {
    buyCard.innerHTML = `<p class="muted">This piece has sold out.</p><a class="btn btn-outline" href="/designer.html?id=${item.designer_id}">View more from ${item.designer_name}</a>`;
    return;
  }

  buyCard.innerHTML = `
    <h2 style="font-size:1rem;">Buy this piece</h2>
    <div class="measure-field"><label>Full name</label><input id="buyer-name" placeholder="e.g. Ama Boateng"></div>
    <div class="measure-field"><label>Phone number</label><input id="buyer-phone" placeholder="e.g. 024 123 4567"></div>
    <div class="measure-field"><label>Delivery address</label><input id="buyer-address" placeholder="e.g. House 3, Osu, Accra"></div>
    <button class="btn btn-primary btn-block" id="buy-btn" type="button" style="margin-top:8px;">Buy now · ${money(item.price)}</button>
  `;

  document.getElementById('buy-btn').addEventListener('click', async (e) => {
    const customerName = document.getElementById('buyer-name').value;
    const customerPhone = document.getElementById('buyer-phone').value;
    const deliveryAddress = document.getElementById('buyer-address').value;
    if (!customerName || !customerPhone || !deliveryAddress) { toast('Fill in your name, phone, and delivery address'); return; }

    e.target.disabled = true; e.target.textContent = 'Placing order…';
    try {
      const result = await api(`/api/shop-items/${itemId}/purchase`, {
        method: 'POST',
        body: JSON.stringify({ customerName, customerPhone, deliveryAddress })
      });
      window.location.href = `/track.html?id=${result.orderId}`;
    } catch (err) {
      toast(err.message);
      e.target.disabled = false; e.target.textContent = `Buy now · ${money(item.price)}`;
    }
  });
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

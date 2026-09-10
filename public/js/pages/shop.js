renderNav('shop');

const grid = document.getElementById('shop-grid');

async function load() {
  const items = await api('/api/shop-items');
  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="icon">${ICONS.mannequin}</span>Nothing in the shop yet.</div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const stockLabel = item.stock === 0 ? 'Sold out' : item.stock <= 2 ? `Only ${item.stock} left` : 'In stock';
    const stockClass = item.stock === 0 ? 'out' : item.stock <= 2 ? 'low' : '';
    return `
    <a class="card shop-card" href="/shop-item.html?id=${item.id}">
      <div class="photo" style="background:linear-gradient(150deg, ${item.designer_swatch}, ${item.designer_swatch}bb);">
        ${item.image_url ? `<img src="${item.image_url}" alt="${item.title}" loading="lazy">` : `<span class="icon" style="width:40px;height:40px;color:#fff;">${ICONS.mannequin}</span>`}
        <span class="stock-pill ${stockClass}">${stockLabel}</span>
      </div>
      <div class="body">
        <div class="cat">${item.designer_name} · Size ${item.size}</div>
        <h3 style="font-size:1.05rem;">${item.title}</h3>
        <div class="price-row" style="margin-top:8px;">
          <span class="price" style="font-family:'Fraunces',serif; font-weight:700; color:var(--forest-deep);">${money(item.price)}</span>
        </div>
      </div>
    </a>`;
  }).join('');
}

load().catch(err => { grid.innerHTML = `<div class="empty-state">${err.message}</div>`; });

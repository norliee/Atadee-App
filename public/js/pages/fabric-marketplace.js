renderNav('circular');
document.getElementById('fm-icon').innerHTML = ICONS.leaf;

const grid = document.getElementById('fabric-grid');
const searchInput = document.getElementById('f-q');

async function load() {
  const params = new URLSearchParams();
  if (searchInput.value) params.set('fabricType', searchInput.value);
  const listings = await api('/api/fabric-listings?' + params.toString());

  if (listings.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="icon">${ICONS.leaf}</span>No fabric listed yet — check back soon, or list your own from your designer dashboard.</div>`;
    return;
  }

  grid.innerHTML = listings.map(f => `
    <a class="card fabric-card" href="/fabric-listing.html?id=${f.id}">
      <div class="cover" style="background:linear-gradient(135deg, ${f.designer_swatch}, ${f.designer_swatch}cc);">
        ${f.image_url ? `<img class="cover-photo" src="${f.image_url}" alt="${f.title}" loading="lazy">` : `<span class="icon">${ICONS.leaf}</span>`}
      </div>
      <div class="body">
        <div class="cat">${f.fabric_type}</div>
        <h3>${f.title}</h3>
        <div class="muted" style="font-size:.85rem;">${f.designer_name} · ${f.designer_location}</div>
        <div class="fabric-meta-row">
          <span><strong>${f.quantity_meters}m</strong> available</span>
          <span><strong>${money(f.price)}</strong></span>
        </div>
      </div>
    </a>
  `).join('');
}

document.getElementById('fm-search-btn').addEventListener('click', load);
let debounceTimer;
searchInput.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(load, 300); });

load();

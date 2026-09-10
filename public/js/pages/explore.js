renderNav('explore');
document.getElementById('explore-hero-icon').innerHTML = ICONS.needle;

const GARMENT_LABELS = {
  mens_shirt: "Men's Shirt",
  mens_suit: "Men's Suit",
  kaftan_agbada: 'Kaftan / Agbada',
  womens_dress: "Women's Dress",
  kaba_slit: 'Kaba & Slit',
  kids_outfit: "Kids' Outfit"
};

const chipRow = document.getElementById('chip-row');
const grid = document.getElementById('style-grid');
const searchInput = document.getElementById('s-q');
let activeGarment = '';

function renderChips() {
  chipRow.innerHTML = ['', ...Object.keys(GARMENT_LABELS)].map(key => `
    <button class="chip ${activeGarment === key ? 'active' : ''}" data-key="${key}" type="button">
      ${key ? GARMENT_LABELS[key] : 'All styles'}
    </button>
  `).join('');
  chipRow.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      activeGarment = chip.dataset.key;
      renderChips();
      load();
    });
  });
}

async function load() {
  const params = new URLSearchParams();
  if (activeGarment) params.set('garmentType', activeGarment);
  if (searchInput.value) params.set('q', searchInput.value);

  const styles = await api('/api/styles?' + params.toString());

  if (styles.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="column-span: all;"><span class="icon">${ICONS.spool}</span>No styles match yet — try a different filter.</div>`;
    return;
  }

  grid.innerHTML = styles.map(s => `
    <div class="style-card">
      <div class="photo-wrap">
        <a href="/order.html?designerId=${s.designer_id}&garment=${s.garment_type || ''}" style="display:block;">
          ${s.image_url
            ? `<img src="${s.image_url}" alt="${s.title}" loading="lazy">`
            : `<div style="aspect-ratio:4/5; background:linear-gradient(150deg, ${s.designer_swatch}, ${s.designer_swatch}bb); display:flex; align-items:center; justify-content:center;"><span class="icon" style="width:36px;height:36px;color:#fff;">${ICONS.mannequin}</span></div>`}
        </a>
        <button class="fav-btn ${isSaved('style_' + s.id) ? 'saved' : ''}" data-id="style_${s.id}" type="button" aria-label="Save style">
          <span class="icon">${ICONS.heart}</span>
        </button>
      </div>
      <div class="body">
        <div class="tag">${GARMENT_LABELS[s.garment_type] || s.designer_category}</div>
        <h3>${s.title}</h3>
        <div class="designer-line">
          <a href="/designer.html?id=${s.designer_id}" style="text-decoration:underline;">${s.designer_name}</a> · ${s.designer_location}
        </div>
        <div class="price-row">
          <span class="price">${s.price_from ? 'From ' + money(s.price_from) : 'Ask for quote'}</span>
          <a class="btn btn-primary" href="/order.html?designerId=${s.designer_id}&garment=${s.garment_type || ''}" style="padding:8px 16px; font-size:.8rem;">Make this</a>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const saved = toggleSaved(btn.dataset.id);
      btn.classList.toggle('saved', saved);
    });
  });
}

document.getElementById('explore-search-btn').addEventListener('click', load);
let debounceTimer;
searchInput.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(load, 300); });

renderChips();
load();

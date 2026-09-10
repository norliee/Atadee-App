renderNav('browse');
document.getElementById('hero-icon').innerHTML = ICONS.tape;
document.getElementById('sustain-filter-icon').innerHTML = ICONS.leaf;

const CATEGORY_ICONS = {
  Wedding: 'heart',
  Corporate: 'mannequin',
  Traditional: 'spool',
  Kids: 'scissors',
  Casual: 'tape'
};

const els = {
  q: document.getElementById('f-q'),
  category: document.getElementById('f-category'),
  location: document.getElementById('f-location'),
  price: document.getElementById('f-price'),
  rating: document.getElementById('f-rating'),
  results: document.getElementById('results'),
  categoryRow: document.getElementById('category-row'),
  heading: document.getElementById('explore-heading'),
  moreFilters: document.getElementById('more-filters'),
  toggleFilters: document.getElementById('toggle-filters'),
  sustainable: document.getElementById('f-sustainable')
};

let activeCategory = '';

els.toggleFilters.addEventListener('click', () => {
  const showing = els.moreFilters.style.display !== 'none';
  els.moreFilters.style.display = showing ? 'none' : 'flex';
});
document.getElementById('clear-filters').addEventListener('click', () => {
  els.category.value = ''; els.location.value = ''; els.price.value = ''; els.rating.value = ''; els.sustainable.checked = false;
  [els.category, els.price, els.rating].forEach(syncPrettySelectLabel);
  activeCategory = '';
  renderCategoryRow();
  load();
});
document.getElementById('hero-search-btn').addEventListener('click', load);

let debounceTimer;
els.q.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(load, 300); });
els.location.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(load, 300); });
['change'].forEach(evt => {
  els.category.addEventListener(evt, () => { activeCategory = els.category.value; renderCategoryRow(); load(); });
  els.price.addEventListener(evt, load);
  els.rating.addEventListener(evt, load);
  els.sustainable.addEventListener(evt, load);
});

let allCategories = [];

async function loadCategories() {
  allCategories = await api('/api/categories');
  els.category.innerHTML = `<option value="">All categories</option>` + allCategories.map(c => `<option value="${c}">${c}</option>`).join('');
  renderCategoryRow();
}

function renderCategoryRow() {
  els.categoryRow.innerHTML = allCategories.map(c => `
    <button class="category-card ${activeCategory === c ? 'active' : ''}" data-cat="${c}" type="button">
      <span class="icon">${ICONS[CATEGORY_ICONS[c] || 'mannequin']}</span>
      <span>${c}</span>
    </button>
  `).join('');
  els.categoryRow.querySelectorAll('.category-card').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = activeCategory === btn.dataset.cat ? '' : btn.dataset.cat;
      els.category.value = activeCategory;
      syncPrettySelectLabel(els.category);
      renderCategoryRow();
      load();
    });
  });
}

async function load() {
  const params = new URLSearchParams();
  if (els.q.value) params.set('q', els.q.value);
  if (activeCategory) params.set('category', activeCategory);
  if (els.location.value) params.set('location', els.location.value);
  if (els.rating.value) params.set('minRating', els.rating.value);
  if (els.price.value) {
    const [min, max] = els.price.value.split('-');
    params.set('minPrice', min);
    params.set('maxPrice', max);
  }
  if (els.sustainable.checked) params.set('sustainable', 'true');

  const designers = await api('/api/designers?' + params.toString());
  els.heading.innerHTML = `${ICONS.spool ? `<span class="icon">${ICONS.spool}</span>` : ''}${activeCategory ? activeCategory + ' designers' : 'Explore designers'} <span class="muted" style="font-weight:400; font-size:.85rem;">(${designers.length})</span>`;

  if (designers.length === 0) {
    els.results.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="icon">${ICONS.mannequin}</span>No designers match those filters yet. Try widening your search.</div>`;
    return;
  }

  els.results.innerHTML = designers.map(d => `
    <div class="card designer-card" data-id="${d.id}">
      <a href="/designer.html?id=${d.id}" style="text-decoration:none; color:inherit;">
        <div class="cover" style="background:linear-gradient(135deg, ${d.swatch}, ${d.swatch}cc);">
          ${d.image_url ? `<img class="cover-photo" src="${d.image_url}" alt="${d.name}" loading="lazy">` : `<span class="icon">${ICONS.mannequin}</span>`}
        </div>
      </a>
      <button class="fav-btn ${isSaved(d.id) ? 'saved' : ''}" data-id="${d.id}" aria-label="Save designer" type="button">
        <span class="icon">${ICONS.heart}</span>
      </button>
      <a href="/designer.html?id=${d.id}" style="text-decoration:none; color:inherit;">
        <div class="body">
          <div class="cat">${d.category}${d.verified ? '<span class="badge">Verified</span>' : ''}${d.sustainable_badge ? `<span class="sustain-badge" style="margin-left:6px;"><span class="icon">${ICONS.leaf}</span>Sustainable</span>` : ''}</div>
          <h3>${d.name}</h3>
          <div class="muted" style="font-size:.85rem;">${d.specialties}</div>
          <div class="meta">
            <span>${d.location}</span>
            <span class="stars">${starString(d.rating)} <span class="muted">(${d.reviews_count})</span></span>
          </div>
          <div class="meta"><span>${money(d.price_min)}–${money(d.price_max)}</span><span>~${d.turnaround_days} days</span></div>
        </div>
      </a>
    </div>
  `).join('');

  els.results.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const saved = toggleSaved(btn.dataset.id);
      btn.classList.toggle('saved', saved);
      btn.innerHTML = `<span class="icon">${ICONS.heart}</span>`;
    });
  });
}

loadCategories().then(load);

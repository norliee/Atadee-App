renderNav('circular');
document.getElementById('edu-icon').innerHTML = ICONS.leaf;

const TABS = [
  { key: 'designers', label: 'Sustainable Designers' },
  { key: 'upcycled', label: 'Upcycled Fashion' },
  { key: 'offcut', label: 'From Offcuts' },
  { key: 'reworked', label: 'Reworked & Redesigned' },
  { key: 'repair', label: 'Repair & Alterations' },
  { key: 'marketplace', label: 'Fabric Marketplace' }
];
let activeTab = 'designers';

const tabsEl = document.getElementById('circular-tabs');
const contentEl = document.getElementById('circular-content');
const heroEl = document.getElementById('circular-hero');

function renderTabs() {
  tabsEl.innerHTML = TABS.map(t => `<button class="eco-chip ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}" type="button">${t.label}</button>`).join('');
  tabsEl.querySelectorAll('.eco-chip').forEach(chip => {
    chip.addEventListener('click', () => { activeTab = chip.dataset.tab; renderTabs(); loadTabContent(); });
  });
}

async function renderHero() {
  const stats = await api('/api/circular/stats');
  const progressPct = Math.min(100, Math.round((stats.badgePercent / stats.goalPercent) * 100));
  heroEl.innerHTML = `
    <span class="icon" style="width:40px;height:40px;color:var(--gold); margin:0 auto;">${ICONS.leaf}</span>
    <h1>atadeɛ Sustainability</h1>
    <p>A more sustainable, lower-waste way to make and buy clothes in Ghana — designers who reduce textile waste through offcuts, deadstock, upcycling, and repair, all in one place.</p>
    <div class="circular-stat-row">
      <div class="circular-stat"><div class="value">${stats.badgeCount}</div><div class="label">Sustainable Designer badges</div></div>
      <div class="circular-stat"><div class="value">${stats.practicingCount}</div><div class="label">Designers using at least one practice</div></div>
      <div class="circular-stat"><div class="value">${stats.badgePercent}%</div><div class="label">of active designers</div></div>
    </div>
    <div class="goal-track">
      <div class="goal-track-bar">
        <div class="goal-track-fill" style="width:${progressPct}%;"></div>
        <div class="goal-track-marker" style="left:100%;"></div>
      </div>
      <div class="goal-track-label">Goal: ${stats.goalPercent}% of active designers on verified sustainable practices — currently at ${stats.badgePercent}%</div>
    </div>
  `;
}

function designerCard(d) {
  return `
    <a class="card designer-card" href="/designer.html?id=${d.id}" style="text-decoration:none; color:inherit;">
      <div class="cover" style="background:linear-gradient(135deg, ${d.swatch}, ${d.swatch}cc);">
        ${d.image_url ? `<img class="cover-photo" src="${d.image_url}" alt="${d.name}" loading="lazy">` : `<span class="icon">${ICONS.mannequin}</span>`}
      </div>
      <div class="body">
        <div class="cat">${d.category}${d.sustainable_badge ? `<span class="sustain-badge" style="margin-left:6px;"><span class="icon">${ICONS.leaf}</span>Sustainable</span>` : ''}</div>
        <h3>${d.name}</h3>
        <div class="muted" style="font-size:.85rem;">${d.specialties}</div>
        <div class="meta"><span>${d.location}</span><span class="stars">${starString(d.rating)}</span></div>
      </div>
    </a>`;
}

function portfolioCard(p) {
  return `
    <a class="card style-card" href="/designer.html?id=${p.designer_id}" style="text-decoration:none; color:inherit; display:block;">
      <div class="photo-wrap">
        ${p.image_url
          ? `<img src="${p.image_url}" alt="${p.title}" loading="lazy">`
          : `<div style="aspect-ratio:4/5; background:linear-gradient(150deg, ${p.designer_swatch}, ${p.designer_swatch}bb); display:flex; align-items:center; justify-content:center;"><span class="icon" style="width:34px;height:34px;color:#fff;">${ICONS.leaf}</span></div>`}
      </div>
      <div class="body">
        <div class="tag">${p.designer_name}</div>
        <h3>${p.title}</h3>
        <div class="designer-line">${p.designer_location}</div>
      </div>
    </a>`;
}

async function loadTabContent() {
  contentEl.innerHTML = `<p class="muted">Loading…</p>`;

  if (activeTab === 'designers') {
    const designers = await api('/api/circular/designers?practicing=true');
    contentEl.innerHTML = designers.length === 0
      ? `<div class="empty-state"><span class="icon">${ICONS.leaf}</span>No designers practicing sustainable methods yet — check back soon.</div>`
      : `<div class="grid">${designers.map(designerCard).join('')}</div>`;
    return;
  }

  if (activeTab === 'repair') {
    const all = await api('/api/circular/designers?practicing=true');
    const repairDesigners = all.filter(d => d.sus_repair_alterations);
    contentEl.innerHTML = repairDesigners.length === 0
      ? `<div class="empty-state"><span class="icon">${ICONS.leaf}</span>No repair or alteration services listed yet.</div>`
      : `<div class="grid">${repairDesigners.map(designerCard).join('')}</div>`;
    return;
  }

  if (activeTab === 'marketplace') {
    contentEl.innerHTML = `
      <div class="empty-state">
        <span class="icon">${ICONS.spool}</span>
        Browse and list leftover fabric, offcuts, and deadstock in the Waste-to-Value Marketplace.
        <div style="margin-top:16px;"><a class="btn btn-primary" href="/fabric-marketplace.html">Open Fabric Marketplace</a></div>
      </div>`;
    return;
  }

  // upcycled / offcut / reworked portfolio tabs
  const items = await api(`/api/circular/portfolio?type=${activeTab}`);
  contentEl.innerHTML = items.length === 0
    ? `<div class="empty-state"><span class="icon">${ICONS.leaf}</span>Nothing tagged here yet — designers add these from their dashboard.</div>`
    : `<div class="style-columns">${items.map(portfolioCard).join('')}</div>`;
}

async function loadEduCards() {
  const cards = await api('/api/content-blocks');
  document.getElementById('edu-grid').innerHTML = cards.map(c => `
    <div class="edu-card">
      <h3><span class="icon">${ICONS.leaf}</span>${c.title}</h3>
      <p>${c.body}</p>
    </div>
  `).join('');
}
loadEduCards();

renderHero();
renderTabs();
loadTabContent();

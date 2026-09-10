renderNav('find-designer');

const root = document.getElementById('root');

let uploadedRefUrl = null;

async function load() {
  const [garments, categories] = await Promise.all([api('/api/garments'), api('/api/categories')]);

  root.innerHTML = `
    <h1 style="font-size:1.5rem; display:flex; align-items:center; gap:10px;"><span class="icon" style="color:var(--gold);">${ICONS.needle}</span>Find a Designer</h1>
    <p class="muted">Have a photo of a style you love? Upload it. Answer a few quick questions and we'll instantly show your best-matched designers <em>and</em> post your request so others can send quotes too.</p>

    <div class="card" style="padding:22px; margin-top:16px;" id="quiz-card">
      <label class="upload-zone" for="ref-upload" style="display:block; margin-bottom:14px;">
        <span class="icon">${ICONS.mannequin}</span>
        <div style="font-size:.85rem;">Upload an inspiration photo (optional)</div>
      </label>
      <input type="file" id="ref-upload" accept="image/*" style="display:none;">
      <div class="thumb-row" id="ref-preview"></div>

      <div class="measure-field" style="margin-top:14px;"><label>What are you making?</label>
        <select id="q-garment"><option value="">Any garment</option>${garments.map(g => `<option value="${g.key}">${g.label}</option>`).join('')}</select>
      </div>
      <div class="measure-field"><label>Category</label>
        <select id="q-category"><option value="">Any category</option>${categories.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
      </div>

      <div style="display:flex; gap:10px;">
        <div class="measure-field" style="flex:1;"><label>Budget min (GH₵)</label><input type="number" id="q-budget-min" placeholder="e.g. 300"></div>
        <div class="measure-field" style="flex:1;"><label>Budget max (GH₵)</label><input type="number" id="q-budget-max" placeholder="e.g. 600"></div>
      </div>
      <div class="measure-field"><label>When do you need it?</label>
        <select id="q-timeframe">
          <option value="">No rush</option>
          <option value="3">Within a few days</option>
          <option value="7">Within a week</option>
          <option value="14">Within 2 weeks</option>
          <option value="30">Within a month</option>
        </select>
      </div>
      <div class="measure-field"><label>Your location</label><input id="q-location" placeholder="e.g. Accra, Kumasi, East Legon"></div>
      <div class="measure-field"><label>Style preference (optional)</label><input id="q-style" placeholder="e.g. modern, traditional, bridal, streetwear"></div>
      <div class="measure-field"><label>Notes (optional)</label><input id="q-notes" placeholder="Anything designers should know"></div>

      <h3 style="font-size:.92rem; margin-top:14px;">Your details <span class="muted" style="font-weight:400;">(so quotes can reach you)</span></h3>
      <div style="display:flex; gap:10px;">
        <div class="measure-field" style="flex:1;"><label>Full name</label><input id="q-name" placeholder="e.g. Abena Owusu"></div>
        <div class="measure-field" style="flex:1;"><label>Phone number</label><input id="q-phone" placeholder="e.g. 024 123 4567"></div>
      </div>

      <button class="btn btn-primary btn-block" id="quiz-submit" type="button">Find my matches</button>
    </div>

    <div id="results" style="margin-top:24px;"></div>
  `;

  document.getElementById('ref-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const form = new FormData();
      form.append('photo', file);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      uploadedRefUrl = data.url;
      document.getElementById('ref-preview').innerHTML = `<img src="${uploadedRefUrl}">`;
    } catch (err) { toast(err.message); }
  });

  document.getElementById('quiz-submit').addEventListener('click', runSearch);
}

async function runSearch(e) {
  const btn = e.target;
  btn.disabled = true; btn.textContent = 'Searching…';

  const garmentType = document.getElementById('q-garment').value || null;
  const category = document.getElementById('q-category').value || null;
  const name = document.getElementById('q-name').value;
  const phone = document.getElementById('q-phone').value;

  try {
    const [matches, similar] = await Promise.all([
      api('/api/designer-match', {
        method: 'POST',
        body: JSON.stringify({
          garmentType, budgetMin: document.getElementById('q-budget-min').value || null,
          budgetMax: document.getElementById('q-budget-max').value || null,
          timeframeDays: document.getElementById('q-timeframe').value || null,
          location: document.getElementById('q-location').value || null,
          stylePreference: document.getElementById('q-style').value || null
        })
      }),
      (uploadedRefUrl && (garmentType || category))
        ? api(`/api/similar-work?${garmentType ? 'garmentType=' + garmentType : ''}${category ? '&category=' + category : ''}`)
        : Promise.resolve([])
    ]);

    let requestId = null;
    if (name && phone) {
      const result = await api('/api/style-requests', {
        method: 'POST',
        body: JSON.stringify({
          customerName: name, customerPhone: phone, garmentType, category,
          referenceImageUrl: uploadedRefUrl,
          notes: document.getElementById('q-notes').value || null,
          location: document.getElementById('q-location').value || null,
          budgetMin: document.getElementById('q-budget-min').value || null,
          budgetMax: document.getElementById('q-budget-max').value || null
        })
      });
      requestId = result.id;
    }

    renderResults(matches, similar, requestId);
  } catch (err) {
    toast(err.message);
  }
  btn.disabled = false; btn.textContent = 'Find my matches';
}

function renderResults(matches, similar, requestId) {
  const resultsEl = document.getElementById('results');
  let html = '';

  if (similar.length) {
    html += `
      <h2 style="font-size:1.1rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.spool}</span>Similar work from our designers</h2>
      <p class="muted" style="font-size:.8rem; margin-top:-6px;">Matched by garment type and category — not true photo recognition, but real pieces these designers have actually made.</p>
      <div class="style-columns" style="margin-top:12px;">
        ${similar.map(s => `
          <div class="style-card">
            <a href="/designer.html?id=${s.designer_id}">
              ${s.image_url ? `<img src="${s.image_url}" alt="${s.title}">` : `<div style="aspect-ratio:4/5; background:linear-gradient(150deg, ${s.designer_swatch}, ${s.designer_swatch}bb); display:flex; align-items:center; justify-content:center;"><span class="icon" style="width:32px;height:32px;color:#fff;">${ICONS.mannequin}</span></div>`}
            </a>
            <div class="body">
              <h3>${s.title}</h3>
              <div class="designer-line"><a href="/designer.html?id=${s.designer_id}" style="text-decoration:underline;">${s.designer_name}${s.verified ? ' ✓' : ''}</a> · ${s.designer_location}</div>
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  if (matches.length === 0) {
    html += `<div class="empty-state"><span class="icon">${ICONS.mannequin}</span>No instant matches — try widening your budget or garment type.</div>`;
  } else {
    html += `
      <h2 style="font-size:1.1rem; margin-top:${similar.length ? '28px' : '0'};">Your best matches</h2>
      ${matches.map(d => `
        <a href="/designer.html?id=${d.id}" class="card match-card" style="text-decoration:none; color:inherit; display:flex; margin-bottom:14px;">
          <div class="match-percent" style="--pct:${d.matchPercent};" data-pct="${d.matchPercent}"></div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:baseline;">
              <strong style="font-family:'Fraunces',serif; color:var(--forest-deep);">${d.name}</strong>
              <span class="stars" style="font-size:.82rem;">${starString(d.rating)}</span>
            </div>
            <div class="muted" style="font-size:.85rem;">${d.location} · ${money(d.price_min)}–${money(d.price_max)} · ~${d.turnaround_days} days</div>
            <div class="match-reasons">${d.matchReasons.map(r => `<span class="match-reason">${r}</span>`).join('')}</div>
          </div>
        </a>
      `).join('')}
    `;
  }

  if (requestId) {
    html += `
      <div class="card" style="padding:18px; margin-top:8px; display:flex; align-items:center; gap:14px; border-color:var(--gold-soft);">
        <span class="icon" style="width:26px;height:26px;color:var(--gold);">${ICONS.heart}</span>
        <div style="flex:1;">
          <p style="margin:0; font-size:.9rem;">We also posted your request — any interested designer can send you a quote.</p>
          <a href="/style-request-view.html?id=${requestId}" style="font-size:.85rem; text-decoration:underline; font-weight:600;">View incoming quotes →</a>
        </div>
      </div>`;
  } else {
    html += `<p class="muted" style="font-size:.82rem; margin-top:10px;">Add your name and phone number above to also post this as an open request other designers can quote on.</p>`;
  }

  resultsEl.innerHTML = html;
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

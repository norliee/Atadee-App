renderNav(null);

const root = document.getElementById('root');
const designerId = qs('designerId');

const APPT_TYPES = [
  { key: 'consultation', label: 'Consultation' },
  { key: 'measurement', label: 'Measurement' },
  { key: 'fitting', label: 'Fitting' },
  { key: 'fabric_selection', label: 'Fabric selection' },
  { key: 'collection', label: 'Collection' }
];

async function load() {
  const designer = await api(`/api/designers/${designerId}`);

  root.innerHTML = `
    <a href="/designer.html?id=${designerId}" class="muted" style="font-size:.85rem;">&larr; Back to ${designer.name}</a>
    <h1 style="font-size:1.4rem; margin-top:10px; display:flex; align-items:center; gap:10px;"><span class="icon" style="color:var(--gold);">${ICONS.tape}</span>Book an appointment</h1>
    <p class="muted">with ${designer.name}, ${designer.location}</p>

    <div class="card" style="padding:22px; margin-top:16px;">
      <div class="measure-field">
        <label>What's this for?</label>
        <div class="appt-type-grid" id="type-grid"></div>
      </div>

      <div class="measure-field">
        <label>Where?</label>
        <div class="toggle-row">
          <button type="button" class="toggle-option active" id="loc-studio" data-loc="studio">At ${designer.name.split(' ')[0]}'s studio</button>
          <button type="button" class="toggle-option" id="loc-home" data-loc="home">Home visit</button>
        </div>
      </div>
      <div class="measure-field" id="address-field" style="display:none;">
        <label>Your address</label>
        <input id="address" placeholder="e.g. House 5, East Legon, Accra">
        <p class="guide-text" style="margin-top:6px;"><span class="icon">${ICONS.tape}</span><span>Home visits may carry an additional fee — the designer will confirm this when accepting.</span></p>
      </div>

      <div style="display:flex; gap:10px;">
        <div class="measure-field" style="flex:1;"><label>Date</label><input type="date" id="slot-date"></div>
        <div class="measure-field" style="flex:1;"><label>Time</label><input type="time" id="slot-time"></div>
      </div>

      <div class="measure-field"><label>Full name</label><input id="customer-name" placeholder="e.g. Efua Mensah"></div>
      <div class="measure-field"><label>Phone number</label><input id="customer-phone" placeholder="e.g. 024 123 4567"></div>
      <div class="measure-field"><label>Anything the designer should know? (optional)</label><input id="notes" placeholder="e.g. First time ordering a kaftan"></div>

      <button class="btn btn-primary btn-block" id="submit-btn" type="button" style="margin-top:10px;">Request appointment</button>
    </div>
  `;

  let selectedType = APPT_TYPES[0].key;
  const typeGrid = document.getElementById('type-grid');
  typeGrid.innerHTML = APPT_TYPES.map(t => `<button type="button" class="appt-type-option ${t.key === selectedType ? 'active' : ''}" data-type="${t.key}">${t.label}</button>`).join('');
  typeGrid.querySelectorAll('.appt-type-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.type;
      typeGrid.querySelectorAll('.appt-type-option').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  let locationType = 'studio';
  document.getElementById('loc-studio').addEventListener('click', () => {
    locationType = 'studio';
    document.getElementById('loc-studio').classList.add('active');
    document.getElementById('loc-home').classList.remove('active');
    document.getElementById('address-field').style.display = 'none';
  });
  document.getElementById('loc-home').addEventListener('click', () => {
    locationType = 'home';
    document.getElementById('loc-home').classList.add('active');
    document.getElementById('loc-studio').classList.remove('active');
    document.getElementById('address-field').style.display = 'block';
  });

  document.getElementById('submit-btn').addEventListener('click', async (e) => {
    const customerName = document.getElementById('customer-name').value;
    const customerPhone = document.getElementById('customer-phone').value;
    const slotDate = document.getElementById('slot-date').value;
    const slotTime = document.getElementById('slot-time').value;
    const address = document.getElementById('address').value;

    if (!customerName || !customerPhone || !slotDate || !slotTime) { toast('Fill in your details, date, and time'); return; }
    if (locationType === 'home' && !address) { toast('Add your address for the home visit'); return; }

    e.target.disabled = true; e.target.textContent = 'Sending…';
    try {
      await api('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          designerId: Number(designerId), customerName, customerPhone, type: selectedType,
          slotDate, slotTime, locationType, address: locationType === 'home' ? address : null,
          notes: document.getElementById('notes').value || null
        })
      });
      root.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.heart}</span>Appointment requested — ${designer.name} will confirm the time with you.</div>`;
    } catch (err) {
      toast(err.message);
      e.target.disabled = false; e.target.textContent = 'Request appointment';
    }
  });
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

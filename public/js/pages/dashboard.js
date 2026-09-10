renderNav('dashboard');

const select = document.getElementById('designer-select');
const card = document.getElementById('orders-card');
const photosCard = document.getElementById('photos-card');

const GARMENT_OPTIONS = [
  { key: '', label: 'General / other' },
  { key: 'mens_shirt', label: "Men's Shirt" },
  { key: 'mens_suit', label: "Men's Suit" },
  { key: 'kaftan_agbada', label: 'Kaftan / Agbada' },
  { key: 'womens_dress', label: "Women's Dress" },
  { key: 'kaba_slit', label: 'Kaba & Slit' },
  { key: 'kids_outfit', label: "Kids' Outfit" }
];

async function init() {
  const designers = await api('/api/designers?all=true');
  select.innerHTML = designers.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  select.addEventListener('change', () => { loadOrders(); loadPhotos(); loadAnalytics(); loadAppointments(); loadGroupOrders(); loadShop(); loadRequests(); loadAvailability(); loadCalendar(); loadCustomers(); loadServices(); loadPosts(); loadSustainability(); loadFabricListings(); loadEngagementAnalytics(); loadQrCode(); initDesignerNotifBell(); loadPayoutAccount(); loadDesignerMessages(); });
  loadOrders();
  loadPhotos();
  loadAnalytics();
  loadAppointments();
  loadGroupOrders();
  loadAvailability();
  loadPayoutAccount();
  loadDesignerMessages();
  loadCalendar();
  loadCustomers();
  loadServices();
  loadPosts();
  loadShop();
  loadRequests();
  loadSustainability();
  loadFabricListings();
  loadEngagementAnalytics();
  loadQrCode();
  document.getElementById('dash-bell-icon').innerHTML = ICONS.needle;
  initDesignerNotifBell();
}

function initDesignerNotifBell() {
  initNotificationBell(`/api/designers/${select.value}/notifications`, `/api/designers/${select.value}/notifications/read-all`);
}

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

async function loadAnalytics() {
  const designer = await api(`/api/designers/${select.value}`);
  const stats = await api(`/api/designers/${select.value}/analytics`);
  const firstName = designer.name.split(' ')[0];

  document.getElementById('greeting').innerHTML = `<h1 style="font-size:1.4rem;">${timeOfDayGreeting()}, ${firstName}</h1>`;

  const statGrid = document.getElementById('stat-grid');
  statGrid.innerHTML = `
    <div class="stat-card">
      <span class="icon">${ICONS.tape}</span>
      <div class="stat-value">${money(stats.revenueThisMonth)}</div>
      <div class="stat-label">Revenue this month</div>
    </div>
    <div class="stat-card">
      <span class="icon">${ICONS.mannequin}</span>
      <div class="stat-value">${stats.activeOrders}</div>
      <div class="stat-label">Active orders</div>
    </div>
    <div class="stat-card">
      <span class="icon">${ICONS.scissors}</span>
      <div class="stat-value">${stats.dueThisWeek}</div>
      <div class="stat-label">Due this week</div>
    </div>
    <div class="stat-card">
      <span class="icon">${ICONS.needle}</span>
      <div class="stat-value">${stats.newRequests}</div>
      <div class="stat-label">New requests</div>
    </div>
  `;
}

async function uploadFile(file) {
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch('/api/uploads', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

async function loadPhotos() {
  const designer = await api(`/api/designers/${select.value}`);
  photosCard.innerHTML = `
    <h2 style="font-size:1.05rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.spool}</span>Photos</h2>
    <p class="muted" style="font-size:.85rem;">Real photos are what customers judge you on — replace the placeholder colors with your own work.</p>

    <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:14px;">
      <div style="flex:1; min-width:220px;">
        <label style="font-size:.82rem; font-weight:600; color:var(--forest-deep); display:block; margin-bottom:8px;">Cover photo</label>
        <label class="upload-zone" for="cover-upload" style="display:block;">
          <span class="icon">${ICONS.mannequin}</span>
          <div style="font-size:.85rem;">${designer.image_url ? 'Replace cover photo' : 'Upload a cover photo'}</div>
        </label>
        <input type="file" id="cover-upload" accept="image/*" style="display:none;">
        ${designer.image_url ? `<div class="thumb-row"><img src="${designer.image_url}"></div>` : ''}
      </div>

      <div style="flex:1; min-width:220px;">
        <label style="font-size:.82rem; font-weight:600; color:var(--forest-deep); display:block; margin-bottom:8px;">Add a portfolio photo</label>
        <label class="upload-zone" for="portfolio-upload" style="display:block;">
          <span class="icon">${ICONS.needle}</span>
          <div style="font-size:.85rem;">Upload a finished piece</div>
        </label>
        <input type="file" id="portfolio-upload" accept="image/*" style="display:none;">
      </div>
    </div>

    <div id="portfolio-form" style="display:none; margin-top:16px;">
      <div class="measure-field"><label>Title</label><input id="pf-title" placeholder="e.g. Navy two-piece suit"></div>
      <div style="display:flex; gap:10px;">
        <div class="measure-field" style="flex:1;"><label>Garment type</label>
          <select id="pf-garment">${GARMENT_OPTIONS.map(g => `<option value="${g.key}">${g.label}</option>`).join('')}</select>
        </div>
        <div class="measure-field" style="flex:1;"><label>Starting price (GH₵)</label><input id="pf-price" type="number" placeholder="e.g. 400"></div>
      </div>
      <div class="thumb-row" id="pf-preview"></div>
      <button class="btn btn-primary" id="pf-save" type="button" style="margin-top:10px;">Add to portfolio</button>
    </div>
  `;

  let pendingPortfolioUrl = null;

  document.getElementById('cover-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      await api(`/api/designers/${select.value}`, { method: 'PATCH', body: JSON.stringify({ imageUrl: url }) });
      toast('Cover photo updated');
      loadPhotos();
    } catch (err) { toast(err.message); }
  });

  document.getElementById('portfolio-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingPortfolioUrl = await uploadFile(file);
      document.getElementById('portfolio-form').style.display = 'block';
      document.getElementById('pf-preview').innerHTML = `<img src="${pendingPortfolioUrl}">`;
    } catch (err) { toast(err.message); }
  });

  document.getElementById('pf-save').addEventListener('click', async () => {
    const title = document.getElementById('pf-title').value;
    if (!title || !pendingPortfolioUrl) { toast('Add a title first'); return; }
    try {
      await api(`/api/designers/${select.value}/portfolio`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          imageUrl: pendingPortfolioUrl,
          garmentType: document.getElementById('pf-garment').value || null,
          priceFrom: document.getElementById('pf-price').value || null
        })
      });
      toast('Added to portfolio');
      pendingPortfolioUrl = null;
      loadPhotos();
    } catch (err) { toast(err.message); }
  });
}

const NEXT_ACTION_LABELS = {
  quoted: 'Confirm Price',
  confirmed: 'Mark Confirmed',
  in_progress: 'Start Work',
  ready_for_pickup: 'Mark Ready for Pickup',
  completed: 'Mark Completed'
};

async function loadOrders() {
  const orders = await api(`/api/designers/${select.value}/orders`);
  if (orders.length === 0) {
    card.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.scissors}</span>No orders yet for this designer.</div>`;
    return;
  }
  card.innerHTML = orders.map(o => {
    const idx = STATUS_FLOW.indexOf(o.status);
    const next = STATUS_FLOW[idx + 1];
    return `
    <div class="order-row" style="flex-wrap:wrap;">
      <div>
        <strong>#${o.id} — ${o.garment_type.replace('_', ' ')}</strong><br>
        <span class="muted" style="font-size:.85rem;">${o.customer_name} · ${o.customer_phone} · size ${o.recommended_size}</span>
        ${o.quoted_price ? `<div class="muted" style="font-size:.8rem;">Price: ${money(o.quoted_price)} · ${o.payment_status === 'paid' ? 'Paid in full' : o.payment_status === 'partial' ? money(o.amount_paid) + ' paid' : 'Unpaid'}</div>` : ''}
        <a href="/order-detail.html?id=${o.id}" style="margin-top:4px; font-size:.78rem; display:inline-block; font-weight:600; text-decoration:underline; color:var(--forest-deep);">View full details →</a>
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span class="pill">${STATUS_LABELS[o.status]}</span>
        <a class="btn btn-outline" href="/messages.html?orderId=${o.id}&as=designer" style="padding:8px 14px; font-size:.78rem;">Messages</a>
        <input type="number" placeholder="Price GH₵" value="${o.quoted_price || ''}" style="width:110px; padding:7px 10px; border-radius:6px; border:1px solid var(--line);" id="price-${o.id}">
        <button class="btn btn-outline" data-save-price="${o.id}" style="padding:8px 14px; font-size:.78rem;">${o.quoted_price ? 'Update price' : 'Set price'}</button>
        ${next ? `<button class="btn btn-outline" data-id="${o.id}" data-next="${next}">${NEXT_ACTION_LABELS[next] || 'Mark ' + STATUS_LABELS[next]}</button>` : '<span class="muted" style="font-size:.8rem;">Done</span>'}
      </div>
    </div>`;
  }).join('');

  card.querySelectorAll('[data-save-price]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.savePrice;
      const priceInput = document.getElementById(`price-${id}`);
      const price = Number(priceInput.value);
      if (!price || price <= 0) { toast('Enter a valid price'); return; }
      btn.disabled = true;
      try {
        const order = await api(`/api/orders/${id}`);
        await api(`/api/orders/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: order.status, quotedPrice: price })
        });
        toast(`Price set to ${money(price)}`);
        loadOrders();
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
      }
    });
  });

  card.querySelectorAll('button[data-next]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const next = btn.dataset.next;
      btn.disabled = true;
      try {
        await api(`/api/orders/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: next })
        });
        toast(`Order #${id} marked ${STATUS_LABELS[next]}`);
        loadOrders();
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
      }
    });
  });
}

const APPT_TYPE_LABELS = {
  consultation: 'Consultation', measurement: 'Measurement', fitting: 'Fitting',
  fabric_selection: 'Fabric selection', collection: 'Collection'
};

async function loadAppointments() {
  const apptCard = document.getElementById('appointments-card');
  const appts = await api(`/api/designers/${select.value}/appointments`);
  if (appts.length === 0) {
    apptCard.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.tape}</span>No appointment requests yet.</div>`;
    return;
  }
  apptCard.innerHTML = appts.map(a => `
    <div class="appt-row">
      <div>
        <strong>${APPT_TYPE_LABELS[a.type]}</strong> — ${a.customer_name} · ${a.customer_phone}<br>
        <span class="muted" style="font-size:.85rem;">${a.slot_date} at ${a.slot_time} · ${a.location_type === 'home' ? 'Home visit: ' + a.address : 'At studio'}</span>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <span class="pill">${a.status}</span>
        ${a.status === 'requested' ? `
          <button class="btn btn-primary" data-confirm="${a.id}" style="padding:8px 14px; font-size:.78rem;">Confirm</button>
          <button class="btn btn-outline" data-cancel="${a.id}" style="padding:8px 14px; font-size:.78rem;">Decline</button>
        ` : ''}
      </div>
    </div>
  `).join('');

  apptCard.querySelectorAll('[data-confirm]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/appointments/${btn.dataset.confirm}`, { method: 'PATCH', body: JSON.stringify({ status: 'confirmed' }) });
    toast('Appointment confirmed');
    loadAppointments();
  }));
  apptCard.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/appointments/${btn.dataset.cancel}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
    toast('Appointment declined');
    loadAppointments();
  }));
}

async function loadGroupOrders() {
  const groupCard = document.getElementById('group-orders-card');
  const groups = await api(`/api/designers/${select.value}/group-orders`);
  if (groups.length === 0) {
    groupCard.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.spool}</span>No group orders yet. Customers can start one from your profile page.</div>`;
    return;
  }
  groupCard.innerHTML = groups.map(g => `
    <div class="order-row">
      <div>
        <strong>${g.title}</strong> — ${g.garment_type.replace('_', ' ')}<br>
        <span class="muted" style="font-size:.85rem;">Organized by ${g.organizer_name} · ${g.memberCount} joined · code ${g.join_code}</span>
      </div>
      <span class="pill">${g.status}</span>
    </div>
  `).join('');
}

async function loadShop() {
  const shopCard = document.getElementById('shop-card');
  const items = await api(`/api/shop-items?designerId=${select.value}`);

  shopCard.innerHTML = `
    <h2 style="font-size:1.05rem;">Your ready-to-wear pieces</h2>
    <p class="muted" style="font-size:.85rem;">List existing, already-made pieces customers can buy instantly — no bespoke wait.</p>
    <div id="shop-items-list" style="margin:14px 0;"></div>
    <button class="btn btn-outline" id="add-shop-item-btn" type="button">+ Add a piece</button>
    <div id="shop-item-form" style="display:none; margin-top:14px;"></div>
  `;

  const listEl = document.getElementById('shop-items-list');
  listEl.innerHTML = items.length === 0
    ? `<p class="muted" style="font-size:.85rem;">Nothing listed yet.</p>`
    : items.map(i => `<div class="order-row"><div><strong>${i.title}</strong> — Size ${i.size} · ${money(i.price)}</div><span class="pill">${i.stock} in stock</span></div>`).join('');

  document.getElementById('add-shop-item-btn').addEventListener('click', () => {
    const formEl = document.getElementById('shop-item-form');
    formEl.style.display = formEl.innerHTML ? 'none' : 'block';
    if (formEl.innerHTML) { formEl.innerHTML = ''; return; }
    formEl.innerHTML = `
      <div class="quote-form-card card">
        <label class="upload-zone" for="shop-photo-upload" style="display:block; margin-bottom:14px;">
          <span class="icon">${ICONS.mannequin}</span><div style="font-size:.85rem;">Upload a photo</div>
        </label>
        <input type="file" id="shop-photo-upload" accept="image/*" style="display:none;">
        <div class="thumb-row" id="shop-photo-preview"></div>
        <div class="measure-field"><label>Title</label><input id="si-title" placeholder="e.g. Ankara midi skirt"></div>
        <div style="display:flex; gap:10px;">
          <div class="measure-field" style="flex:1;"><label>Size</label><input id="si-size" placeholder="e.g. M"></div>
          <div class="measure-field" style="flex:1;"><label>Price (GH₵)</label><input id="si-price" type="number" placeholder="e.g. 250"></div>
          <div class="measure-field" style="flex:1;"><label>Stock</label><input id="si-stock" type="number" value="1"></div>
        </div>
        <div class="measure-field"><label>Garment type</label>
          <select id="si-garment">${GARMENT_OPTIONS.map(g => `<option value="${g.key}">${g.label}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary" id="si-save" type="button">List this piece</button>
      </div>`;

    let uploadedUrl = null;
    document.getElementById('shop-photo-upload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        uploadedUrl = await uploadFile(file);
        document.getElementById('shop-photo-preview').innerHTML = `<img src="${uploadedUrl}">`;
      } catch (err) { toast(err.message); }
    });

    document.getElementById('si-save').addEventListener('click', async () => {
      const title = document.getElementById('si-title').value;
      const size = document.getElementById('si-size').value;
      const price = document.getElementById('si-price').value;
      if (!title || !size || !price) { toast('Fill in title, size, and price'); return; }
      try {
        await api(`/api/designers/${select.value}/shop-items`, {
          method: 'POST',
          body: JSON.stringify({
            title, size, price: Number(price), stock: Number(document.getElementById('si-stock').value) || 1,
            garmentType: document.getElementById('si-garment').value || null, imageUrl: uploadedUrl
          })
        });
        toast('Added to shop');
        loadShop();
      } catch (err) { toast(err.message); }
    });
  });
}

const CHANGE_LABELS_SHORT = {
  different_fabric: 'different fabric', longer_sleeves: 'longer sleeves', different_neckline: 'different neckline',
  different_colour: 'different colour', less_fitted: 'less fitted', add_embroidery: 'add embroidery', make_similar: 'make similar'
};

async function loadRequests() {
  const requestsCard = document.getElementById('requests-card');
  const requests = await api(`/api/designers/${select.value}/style-requests`);

  if (requests.length === 0) {
    requestsCard.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.needle}</span>No open requests in your category right now.</div>`;
    return;
  }

  requestsCard.innerHTML = requests.map(r => `
    <div class="order-row" style="align-items:flex-start;">
      <div style="display:flex; gap:12px;">
        ${r.reference_image_url ? `<img src="${r.reference_image_url}" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0;">` : ''}
        <div>
          <strong>${r.garment_type ? r.garment_type.replace('_', ' ') : 'General request'}</strong> — ${r.customer_name}<br>
          <span class="muted" style="font-size:.82rem;">
            ${r.location ? r.location + ' · ' : ''}${r.budget_min ? money(r.budget_min) + '–' + money(r.budget_max) : 'no budget given'}${r.deadline ? ' · by ' + r.deadline : ''}
          </span>
          ${r.changes_wanted.length ? `<div class="muted" style="font-size:.8rem; margin-top:4px;">Wants: ${r.changes_wanted.map(c => CHANGE_LABELS_SHORT[c] || c).join(', ')}</div>` : ''}
          ${r.notes ? `<div style="font-size:.85rem; margin-top:4px;">${r.notes}</div>` : ''}
        </div>
      </div>
      <div>
        ${r.myQuote
          ? `<span class="pill">Quoted ${money(r.myQuote.amount)}</span>`
          : `<button class="btn btn-outline" data-quote-request="${r.id}" style="padding:8px 14px; font-size:.78rem;">Send quote</button>`}
      </div>
    </div>
    <div id="quote-form-${r.id}" style="display:none; padding:0 16px 16px;"></div>
  `).join('');

  requestsCard.querySelectorAll('[data-quote-request]').forEach(btn => {
    btn.addEventListener('click', () => {
      const formEl = document.getElementById(`quote-form-${btn.dataset.quoteRequest}`);
      const showing = formEl.style.display === 'block';
      requestsCard.querySelectorAll('[id^="quote-form-"]').forEach(f => f.style.display = 'none');
      if (showing) return;
      formEl.style.display = 'block';
      formEl.innerHTML = `
        <div class="quote-form-card card">
          <div class="measure-field"><label>Your quote (GH₵)</label><input type="number" id="rq-amount-${btn.dataset.quoteRequest}" placeholder="e.g. 450"></div>
          <div class="measure-field"><label>Ready by (optional)</label><input type="date" id="rq-ready-${btn.dataset.quoteRequest}"></div>
          <div class="measure-field"><label>Note (optional)</label><input id="rq-note-${btn.dataset.quoteRequest}" placeholder="Why you're a good fit for this"></div>
          <button class="btn btn-primary" data-send-quote="${btn.dataset.quoteRequest}" type="button">Send quote</button>
        </div>`;
      formEl.querySelector('[data-send-quote]').addEventListener('click', async () => {
        const reqId = btn.dataset.quoteRequest;
        const amount = document.getElementById(`rq-amount-${reqId}`).value;
        if (!amount) { toast('Enter a quote amount'); return; }
        try {
          await api(`/api/style-requests/${reqId}/quotes`, {
            method: 'POST',
            body: JSON.stringify({
              designerId: Number(select.value), amount: Number(amount),
              readyBy: document.getElementById(`rq-ready-${reqId}`).value || null,
              note: document.getElementById(`rq-note-${reqId}`).value || null
            })
          });
          toast('Quote sent');
          loadRequests();
        } catch (err) { toast(err.message); }
      });
    });
  });
}

async function loadAvailability() {
  const designer = await api(`/api/designers/${select.value}`);
  const availCard = document.getElementById('availability-card');
  const options = [
    { key: 'accepting', label: 'Accepting orders' },
    { key: 'limited', label: 'Limited availability' },
    { key: 'booked', label: 'Fully booked' }
  ];
  availCard.innerHTML = `
    <h2 style="font-size:1.05rem; display:flex; align-items:center; gap:8px;"><span class="icon" style="width:20px;height:20px;color:var(--gold);">${ICONS.tape}</span>Availability</h2>
    <p class="muted" style="font-size:.85rem;">Let customers know if you can take new orders right now.</p>
    <div class="avail-select-row" style="margin-top:12px;">
      ${options.map(o => `<div class="avail-option ${o.key} ${designer.availability === o.key ? 'active' : ''}" data-avail="${o.key}">${o.label}</div>`).join('')}
    </div>
    <div class="measure-field" style="margin-top:12px;"><label>Capacity note (optional)</label><input id="capacity-note" value="${designer.capacity_note || ''}" placeholder="e.g. Can accept ~6 more orders this month"></div>
    <button class="btn btn-outline" id="save-availability" type="button" style="margin-top:8px;">Save</button>
  `;

  let selectedAvail = designer.availability;
  availCard.querySelectorAll('.avail-option').forEach(el => {
    el.addEventListener('click', () => {
      selectedAvail = el.dataset.avail;
      availCard.querySelectorAll('.avail-option').forEach(o => o.classList.toggle('active', o === el));
    });
  });

  document.getElementById('save-availability').addEventListener('click', async () => {
    try {
      await api(`/api/designers/${select.value}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ availability: selectedAvail, capacityNote: document.getElementById('capacity-note').value || null })
      });
      toast('Availability updated');
    } catch (err) { toast(err.message); }
  });
}

async function loadCalendar() {
  const calCard = document.getElementById('calendar-card');
  const events = await api(`/api/designers/${select.value}/calendar`);

  if (events.length === 0) {
    calCard.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.spool}</span>Nothing scheduled right now.</div>`;
    return;
  }

  const byDate = {};
  events.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });

  calCard.innerHTML = Object.entries(byDate).map(([date, evs]) => `
    <div class="calendar-day-group">
      <div class="calendar-day-label">${new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      ${evs.map(e => `
        <div class="calendar-event">
          <span class="dot ${e.type}"></span>
          <span>${e.type === 'appointment' ? `${e.time} — ` : 'Due: '}${e.title}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

async function loadCustomers() {
  const customersCard = document.getElementById('customers-card');
  const customers = await api(`/api/designers/${select.value}/customers`);

  if (customers.length === 0) {
    customersCard.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.mannequin}</span>No customers yet.</div>`;
    return;
  }

  customersCard.innerHTML = customers.map(c => `
    <div class="customer-row">
      <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:6px;">
        <strong>${c.customerName}${c.isRepeat ? `<span class="repeat-badge">Repeat customer</span>` : ''}</strong>
        <span class="muted" style="font-size:.82rem;">${c.orderCount} order${c.orderCount === 1 ? '' : 's'} · ${money(c.totalSpent)} spent</span>
      </div>
      <div class="muted" style="font-size:.82rem; margin-top:4px;">${c.customerPhone} · favorite: ${(c.favoriteGarment || '').replace('_', ' ') || '—'} · last order ${new Date(c.lastOrderDate.replace(' ', 'T') + 'Z').toLocaleDateString()}</div>
    </div>
  `).join('');
}

async function loadServices() {
  const servicesCard = document.getElementById('services-card');
  const services = await api(`/api/designers/${select.value}/services`);

  servicesCard.innerHTML = `
    <h2 style="font-size:1.05rem;">Starting prices by garment</h2>
    <p class="muted" style="font-size:.85rem;">So customers stop asking "how much?" — set your starting prices once.</p>
    <div id="services-list" style="margin:12px 0;">
      ${services.length === 0 ? `<p class="muted" style="font-size:.85rem;">No services listed yet.</p>` :
        services.map(s => `<div class="service-row"><span>${s.label}</span><span style="display:flex; align-items:center; gap:10px;"><strong>from ${money(s.price_from)}</strong><button class="btn btn-outline" data-del-service="${s.id}" style="padding:5px 10px; font-size:.72rem;">Remove</button></span></div>`).join('')}
    </div>
    <div style="display:flex; gap:10px;">
      <input id="svc-label" placeholder="e.g. Kaftan" style="flex:1; padding:10px 12px; border-radius:8px; border:1px solid var(--line);">
      <input id="svc-price" type="number" placeholder="GH₵" style="width:100px; padding:10px 12px; border-radius:8px; border:1px solid var(--line);">
      <button class="btn btn-primary" id="add-service" type="button">Add</button>
    </div>
  `;

  servicesCard.querySelectorAll('[data-del-service]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/services/${btn.dataset.delService}`, { method: 'DELETE' });
    loadServices();
  }));

  document.getElementById('add-service').addEventListener('click', async () => {
    const label = document.getElementById('svc-label').value;
    const price = document.getElementById('svc-price').value;
    if (!label || !price) { toast('Add a label and price'); return; }
    try {
      await api(`/api/designers/${select.value}/services`, { method: 'POST', body: JSON.stringify({ label, priceFrom: Number(price) }) });
      loadServices();
    } catch (err) { toast(err.message); }
  });
}

async function loadPosts() {
  const postsCard = document.getElementById('posts-card');
  const posts = await api(`/api/designers/${select.value}/posts`);

  postsCard.innerHTML = `
    <h2 style="font-size:1.05rem;">Share a quick update</h2>
    <p class="muted" style="font-size:.85rem;">New designs, fabric arrivals, behind-the-scenes — keeps your profile feeling alive.</p>
    <label class="upload-zone" for="post-upload" style="display:block; margin:12px 0;">
      <span class="icon">${ICONS.mannequin}</span><div style="font-size:.85rem;">Upload a photo</div>
    </label>
    <input type="file" id="post-upload" accept="image/*" style="display:none;">
    <div id="post-form" style="display:none;">
      <div class="measure-field"><label>Caption</label><input id="post-caption" placeholder="What's happening?"></div>
      <div class="thumb-row" id="post-preview"></div>
      <button class="btn btn-primary" id="post-save" type="button">Post</button>
    </div>
    <div class="posts-strip" style="margin-top:16px;">
      ${posts.length === 0 ? `<p class="muted" style="font-size:.85rem;">No posts yet.</p>` :
        posts.map(p => `<div class="post-card"><img src="${p.media_url}">${p.caption ? `<div class="caption">${p.caption}</div>` : ''}</div>`).join('')}
    </div>
  `;

  let uploadedUrl = null;
  document.getElementById('post-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      uploadedUrl = await uploadFile(file);
      document.getElementById('post-form').style.display = 'block';
      document.getElementById('post-preview').innerHTML = `<img src="${uploadedUrl}">`;
    } catch (err) { toast(err.message); }
  });

  document.getElementById('post-save').addEventListener('click', async () => {
    if (!uploadedUrl) { toast('Upload a photo first'); return; }
    try {
      await api(`/api/designers/${select.value}/posts`, {
        method: 'POST',
        body: JSON.stringify({ caption: document.getElementById('post-caption').value || null, mediaUrl: uploadedUrl, mediaType: 'photo' })
      });
      toast('Posted');
      loadPosts();
    } catch (err) { toast(err.message); }
  });
}

document.querySelectorAll('.dash-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.dash-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab.dataset.tab}`));
  });
});

const SUS_FIELDS = [
  { key: 'sus_offcuts', label: 'Uses fabric offcuts & production scraps', desc: 'You use leftover fabric pieces instead of only cutting from fresh yardage.' },
  { key: 'sus_recycled', label: 'Uses recycled & reclaimed textiles', desc: 'You incorporate fabric that has already had a previous life.' },
  { key: 'sus_deadstock', label: 'Uses deadstock & surplus fabrics', desc: 'You buy up unused fabric from factories or other designers rather than ordering new.' },
  { key: 'sus_upcycled', label: 'Creates upcycled garments & materials', desc: 'You transform existing garments or materials into something new.' },
  { key: 'sus_local_sourced', label: 'Sources materials locally where possible', desc: 'You buy fabric and trims from local Ghanaian suppliers when you can.' },
  { key: 'sus_low_waste_cutting', label: 'Uses low-waste cutting techniques', desc: 'You plan pattern layouts to minimize offcuts in the first place.' },
  { key: 'sus_repair_alterations', label: 'Offers repair, alteration & restoration services', desc: 'You help extend the life of garments customers already own.' }
];
const SUS_BADGE_THRESHOLD = 3;

async function loadSustainability() {
  document.getElementById('sustain-tab-icon').innerHTML = ICONS.leaf;
  const designer = await api(`/api/designers/${select.value}`);
  const card = document.getElementById('sustainability-card');

  const checkedCount = SUS_FIELDS.filter(f => designer[f.key]).length;

  card.innerHTML = `
    <p class="muted" style="font-size:.85rem; margin-top:0;">Check what you actually do — this builds your public sustainability profile and (at ${SUS_BADGE_THRESHOLD}+ practices) earns the Sustainable Designer badge. No vague claims, just what's true.</p>
    <div class="sustain-checkbox-grid" id="sus-checkboxes">
      ${SUS_FIELDS.map(f => `
        <label class="sustain-checkbox-row ${designer[f.key] ? 'checked' : ''}" data-row="${f.key}">
          <input type="checkbox" data-key="${f.key}" ${designer[f.key] ? 'checked' : ''}>
          <div><div class="label">${f.label}</div><div class="desc">${f.desc}</div></div>
        </label>
      `).join('')}
    </div>
    <div class="sustain-progress-note ${designer.sustainable_badge ? 'earned' : ''}" id="sus-progress-note"></div>
    <button class="btn btn-primary" id="save-sustainability" type="button" style="margin-top:14px;">Save sustainability profile</button>
  `;

  updateSusProgressNote(checkedCount);

  card.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.sustain-checkbox-row').classList.toggle('checked', cb.checked);
      const count = [...card.querySelectorAll('input[type="checkbox"]')].filter(c => c.checked).length;
      updateSusProgressNote(count);
    });
  });

  document.getElementById('save-sustainability').addEventListener('click', async () => {
    const body = {};
    card.querySelectorAll('input[type="checkbox"]').forEach(cb => { body[cb.dataset.key] = cb.checked; });
    try {
      const result = await api(`/api/designers/${select.value}/sustainability`, { method: 'PATCH', body: JSON.stringify(body) });
      toast(result.badge ? 'Saved — Sustainable Designer badge earned! 🌿' : 'Sustainability profile saved');
      loadSustainability();
    } catch (err) { toast(err.message); }
  });
}

function updateSusProgressNote(count) {
  const note = document.getElementById('sus-progress-note');
  if (!note) return;
  if (count >= SUS_BADGE_THRESHOLD) {
    note.classList.add('earned');
    note.textContent = `🌿 Sustainable Designer badge earned (${count} of ${SUS_FIELDS.length} practices).`;
  } else {
    note.classList.remove('earned');
    note.textContent = `${SUS_BADGE_THRESHOLD - count} more practice${SUS_BADGE_THRESHOLD - count === 1 ? '' : 's'} needed for the Sustainable Designer badge.`;
  }
}

async function loadFabricListings() {
  const card = document.getElementById('fabric-card');
  const [listings, orders] = await Promise.all([
    api(`/api/designers/${select.value}/fabric-listings`),
    api(`/api/designers/${select.value}/fabric-orders`)
  ]);

  card.innerHTML = `
    <p class="muted" style="font-size:.85rem; margin-top:0;">Got leftover fabric or offcuts? List them here instead of throwing them away — other designers, students, and craftspeople can request them.</p>

    ${listings.length ? `<div style="margin-bottom:16px;">${listings.map(l => `
      <div class="service-row">
        <span>${l.title} — ${l.quantity_meters}m ${l.fabric_type}</span>
        <span style="display:flex; align-items:center; gap:8px;"><strong>${money(l.price)}</strong><span class="pill">${l.status}</span></span>
      </div>
    `).join('')}</div>` : `<p class="muted" style="font-size:.85rem;">No fabric listed yet.</p>`}

    <button class="btn btn-outline" id="add-fabric-btn" type="button">+ List leftover fabric</button>
    <div id="fabric-form" style="display:none; margin-top:14px;"></div>

    ${orders.length ? `
    <div style="margin-top:20px;">
      <h3 style="font-size:.9rem;">Incoming requests</h3>
      ${orders.map(o => `
        <div class="order-row">
          <div>
            <strong>${o.buyer_name}</strong> (${o.buyer_type}) — ${o.listing_title}<br>
            <span class="muted" style="font-size:.82rem;">${o.buyer_phone}${o.message ? ' · ' + o.message : ''}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="pill">${o.status}</span>
            ${o.status === 'requested' ? `
              <button class="btn btn-primary" data-fabric-confirm="${o.id}" style="padding:7px 12px; font-size:.76rem;">Confirm</button>
              <button class="btn btn-outline" data-fabric-decline="${o.id}" style="padding:7px 12px; font-size:.76rem;">Decline</button>
            ` : o.status === 'confirmed' ? `<button class="btn btn-outline" data-fabric-complete="${o.id}" style="padding:7px 12px; font-size:.76rem;">Mark handed over</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>` : ''}
  `;

  card.querySelectorAll('[data-fabric-confirm]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/fabric-orders/${btn.dataset.fabricConfirm}`, { method: 'PATCH', body: JSON.stringify({ status: 'confirmed' }) });
    toast('Request confirmed'); loadFabricListings();
  }));
  card.querySelectorAll('[data-fabric-decline]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/fabric-orders/${btn.dataset.fabricDecline}`, { method: 'PATCH', body: JSON.stringify({ status: 'declined' }) });
    toast('Request declined'); loadFabricListings();
  }));
  card.querySelectorAll('[data-fabric-complete]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/fabric-orders/${btn.dataset.fabricComplete}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
    toast('Marked handed over'); loadFabricListings();
  }));

  document.getElementById('add-fabric-btn').addEventListener('click', () => {
    const formEl = document.getElementById('fabric-form');
    if (formEl.innerHTML) { formEl.innerHTML = ''; formEl.style.display = 'none'; return; }
    formEl.style.display = 'block';
    formEl.innerHTML = `
      <div class="quote-form-card card">
        <label class="upload-zone" for="fabric-upload" style="display:block; margin-bottom:12px;">
          <span class="icon">${ICONS.leaf}</span><div style="font-size:.85rem;">Upload a photo of the fabric</div>
        </label>
        <input type="file" id="fabric-upload" accept="image/*" style="display:none;">
        <div class="thumb-row" id="fabric-photo-preview"></div>
        <div class="measure-field"><label>Title</label><input id="fb-title" placeholder="e.g. Kente offcuts, mixed gold/red"></div>
        <div class="measure-field"><label>Fabric type</label><input id="fb-type" placeholder="e.g. Kente, Ankara, denim, lace"></div>
        <div style="display:flex; gap:10px;">
          <div class="measure-field" style="flex:1;"><label>Quantity (metres)</label><input id="fb-qty" type="number" step="0.1" placeholder="e.g. 3.5"></div>
          <div class="measure-field" style="flex:1;"><label>Price (GH₵)</label><input id="fb-price" type="number" placeholder="e.g. 120"></div>
        </div>
        <div class="measure-field"><label>Description (optional)</label><input id="fb-desc" placeholder="Condition, origin, suggested uses…"></div>
        <button class="btn btn-primary" id="fb-save" type="button">List fabric</button>
      </div>`;

    let uploadedUrl = null;
    document.getElementById('fabric-upload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        uploadedUrl = await uploadFile(file);
        document.getElementById('fabric-photo-preview').innerHTML = `<img src="${uploadedUrl}">`;
      } catch (err) { toast(err.message); }
    });

    document.getElementById('fb-save').addEventListener('click', async () => {
      const title = document.getElementById('fb-title').value;
      const fabricType = document.getElementById('fb-type').value;
      const qty = document.getElementById('fb-qty').value;
      const price = document.getElementById('fb-price').value;
      if (!title || !fabricType || !qty || !price) { toast('Fill in title, fabric type, quantity, and price'); return; }
      try {
        await api(`/api/designers/${select.value}/fabric-listings`, {
          method: 'POST',
          body: JSON.stringify({
            title, fabricType, quantityMeters: Number(qty), price: Number(price),
            description: document.getElementById('fb-desc').value || null, imageUrl: uploadedUrl
          })
        });
        toast('Fabric listed');
        loadFabricListings();
      } catch (err) { toast(err.message); }
    });
  });
}

async function loadEngagementAnalytics() {
  const data = await api(`/api/designers/${select.value}/engagement`);

  document.getElementById('engagement-stat-grid').innerHTML = `
    <div class="stat-card">
      <span class="icon">${ICONS.mannequin}</span>
      <div class="stat-value">${data.profileViews}</div>
      <div class="stat-label">Profile views</div>
    </div>
    <div class="stat-card">
      <span class="icon">${ICONS.spool}</span>
      <div class="stat-value">${data.totalPostViews}</div>
      <div class="stat-label">Story views</div>
    </div>
    <div class="stat-card">
      <span class="icon">${ICONS.heart}</span>
      <div class="stat-value">${data.totalPostLikes}</div>
      <div class="stat-label">Story likes</div>
    </div>
    <div class="stat-card">
      <span class="icon">${ICONS.needle}</span>
      <div class="stat-value">${data.messagesReceived}</div>
      <div class="stat-label">Messages from customers</div>
    </div>
  `;

  const postCard = document.getElementById('post-analytics-card');
  postCard.innerHTML = `
    <p class="muted" style="font-size:.85rem; margin-top:0;">
      ${data.ordersReceived} orders · ${data.appointmentsReceived} appointment requests ·
      ${data.styleRequestQuotesSent} quotes sent · ${data.fabricRequestsReceived} fabric requests
    </p>
    <div id="post-analytics-list" style="margin-top:10px;"></div>
  `;

  const listEl = document.getElementById('post-analytics-list');
  listEl.innerHTML = data.posts.length === 0
    ? `<p class="muted" style="font-size:.85rem;">No stories posted yet — post one from the Catalog tab to start tracking views and likes.</p>`
    : data.posts.map(p => `
        <div class="post-analytics-row">
          <img src="${p.mediaUrl}">
          <div>
            <div style="font-weight:600; font-size:.88rem;">${p.caption || 'Untitled update'}</div>
            <div class="post-analytics-stats">
              <span>${ICONS_TEXT_EYE} ${p.views} views</span>
              <span>♥ ${p.likes} likes</span>
              <span>${new Date(p.createdAt.replace(' ', 'T') + 'Z').toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      `).join('');
}
const ICONS_TEXT_EYE = '👁';

async function loadQrCode() {
  const designer = await api(`/api/designers/${select.value}`);
  const profileUrl = `${window.location.origin}/designer.html?id=${designer.id}`;
  const qrCard = document.getElementById('qr-card');

  qrCard.innerHTML = `
    <p class="muted" style="font-size:.85rem; margin-top:0;">Print this on packaging, a business card, or share it directly — it links straight to your atadeɛ profile.</p>
    <div class="qr-wrap">
      <div class="qr-canvas-box" id="qr-canvas-target"></div>
      <div>
        <p style="font-size:.85rem; word-break:break-all; color:var(--text-muted); margin-bottom:10px;">${profileUrl}</p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-outline" id="qr-download-btn" type="button" style="padding:8px 14px; font-size:.8rem;">Download QR code</button>
          <button class="btn btn-outline" id="qr-copy-btn" type="button" style="padding:8px 14px; font-size:.8rem;">Copy link</button>
        </div>
      </div>
    </div>
  `;

  const target = document.getElementById('qr-canvas-target');
  target.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(target, { text: profileUrl, width: 140, height: 140, colorDark: '#1F4D3D', colorLight: '#ffffff' });
  } else {
    target.innerHTML = `<p class="muted" style="font-size:.78rem; width:140px;">QR code needs an internet connection to load.</p>`;
  }

  document.getElementById('qr-copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(profileUrl).then(() => toast('Profile link copied'));
  });
  document.getElementById('qr-download-btn').addEventListener('click', () => {
    const img = target.querySelector('img');
    const canvas = target.querySelector('canvas');
    const src = img ? img.src : (canvas ? canvas.toDataURL('image/png') : null);
    if (!src) { toast('QR code not ready yet'); return; }
    const a = document.createElement('a');
    a.href = src;
    a.download = `atadee-${designer.name.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
    a.click();
  });
}

async function loadPayoutAccount() {
  const card = document.getElementById('payout-card');
  const [status, paystackStatus] = await Promise.all([
    api(`/api/designers/${select.value}/payout-status`),
    api('/api/paystack/status')
  ]);

  if (!paystackStatus.configured) {
    card.innerHTML = `<p class="muted" style="font-size:.85rem; margin:0;">Automatic payouts need Paystack configured on this server first — see the README for setup.</p>`;
    return;
  }

  if (status.connected) {
    card.innerHTML = `
      <p style="margin:0 0 4px;"><span style="color:var(--forest);">✓ Connected</span> — payouts go to <strong>${status.bankName}</strong>, •••${String(status.accountNumber).slice(-4)}</p>
      <p class="muted" style="font-size:.82rem;">Account name on file: ${status.accountName}</p>
      <p class="muted" style="font-size:.82rem;">When a customer pays, your share is sent to this account automatically — only the platform's commission stays behind.</p>
      <button class="btn btn-outline" id="change-payout" type="button" style="margin-top:8px;">Change account</button>
    `;
    document.getElementById('change-payout').addEventListener('click', () => renderPayoutForm(card));
    return;
  }

  card.innerHTML = `<p class="muted" style="font-size:.85rem; margin-top:0;">Connect your mobile money account to get paid automatically the moment a customer pays — no manual transfers needed.</p>`;
  renderPayoutForm(card, true);
}

async function renderPayoutForm(card, append) {
  let banks;
  try {
    banks = await api('/api/paystack/banks');
  } catch (err) {
    const failureHtml = `<p class="muted" style="font-size:.82rem; margin-top:10px;">Couldn't load the list of mobile money networks from Paystack — check your internet connection and <a href="#" id="retry-payout-banks">try again</a>.</p>`;
    if (append) card.insertAdjacentHTML('beforeend', failureHtml);
    else card.innerHTML = failureHtml;
    const retryLink = document.getElementById('retry-payout-banks');
    if (retryLink) retryLink.addEventListener('click', (e) => { e.preventDefault(); loadPayoutAccount(); });
    return;
  }

  const formHtml = `
    <div id="payout-form-wrap" style="margin-top:10px;">
      <div class="measure-field"><label>Mobile money network</label>
        <select id="payout-bank">
          ${banks.map(b => `<option value="${b.code}" data-name="${b.name}">${b.name}</option>`).join('')}
        </select>
      </div>
      <div class="measure-field"><label>Mobile money number</label><input id="payout-number" placeholder="0551234987"></div>
      <button class="btn btn-primary" id="connect-payout" type="button">Connect account</button>
      <div id="payout-result" style="margin-top:10px;"></div>
    </div>`;

  if (append) card.insertAdjacentHTML('beforeend', formHtml);
  else card.innerHTML = formHtml;

  document.getElementById('connect-payout').addEventListener('click', async (e) => {
    const bankSelect = document.getElementById('payout-bank');
    const bankCode = bankSelect.value;
    const bankName = bankSelect.options[bankSelect.selectedIndex].dataset.name;
    const accountNumber = document.getElementById('payout-number').value;
    if (!accountNumber) { toast('Enter your mobile money number'); return; }

    e.target.disabled = true; e.target.textContent = 'Connecting…';
    try {
      const result = await api(`/api/designers/${select.value}/payout-account`, {
        method: 'POST', body: JSON.stringify({ bankCode, bankName, accountNumber })
      });
      document.getElementById('payout-result').innerHTML = `<p style="color:var(--forest); font-size:.85rem;">Connected — confirm this is you: <strong>${result.accountName}</strong></p>`;
      toast('Payout account connected');
      loadPayoutAccount();
    } catch (err) {
      toast(err.message);
      e.target.disabled = false; e.target.textContent = 'Connect account';
    }
  });
}

function timeAgoShort(ts) {
  const diffMs = Date.now() - new Date(ts.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function loadDesignerMessages() {
  const card = document.getElementById('messages-card');
  const threads = await api(`/api/designers/${select.value}/threads`);
  const withMessages = threads.filter(t => t.lastMessage);

  if (withMessages.length === 0) {
    card.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.spool}</span>No conversations yet.</div>`;
    return;
  }

  card.innerHTML = withMessages.slice(0, 8).map(t => `
    <a href="/messages.html?orderId=${t.orderId}&as=designer" class="order-row" style="text-decoration:none; color:inherit;">
      <div>
        <strong style="${t.unreadCount ? 'color:var(--forest-deep);' : ''}">${t.customerName}</strong>
        <span class="muted" style="font-size:.8rem;"> — order #${t.orderId} · ${t.garmentType.replace('_', ' ')}</span><br>
        <span class="muted" style="font-size:.85rem; ${t.unreadCount ? 'font-weight:700; color:var(--charcoal);' : ''}">${t.lastMessage}</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
        <span class="muted" style="font-size:.76rem;">${timeAgoShort(t.lastMessageAt)}</span>
        ${t.unreadCount ? `<span class="notif-badge" style="position:static;">${t.unreadCount > 9 ? '9+' : t.unreadCount}</span>` : ''}
      </div>
    </a>
  `).join('');
}

init();

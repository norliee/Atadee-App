renderNav(null);

const STEPS = ['Personal details', 'Business details', 'Location', 'Pricing', 'Your work', 'Your workplace', 'Get paid'];
let current = 0;
const data = {};
let availableCategories = ['Wedding', 'Corporate', 'Traditional', 'Kids', 'Casual']; // fallback until loaded
api('/api/available-categories').then(cats => { availableCategories = cats.map(c => c.name); if (current === 1) renderStep(); }).catch(() => {});

function renderProgress() {
  document.getElementById('progress').innerHTML = STEPS.map((_, i) => `<div class="step-dot ${i <= current ? 'done' : ''}"></div>`).join('');
}

const wizard = document.getElementById('wizard');

function renderStep() {
  renderProgress();
  if (current === 0) {
    wizard.innerHTML = `
      <h2 style="font-size:1.05rem;">Personal details</h2>
      <div class="measure-field"><label>Your full name / brand name</label><input id="s-name" value="${data.name || ''}" placeholder="e.g. Ama Serwaa Couture"></div>
      <div class="measure-field"><label>Phone number</label><input id="s-phone" value="${data.phone || ''}" placeholder="e.g. 024 123 4567"></div>
      <button class="btn btn-primary btn-block" id="next-btn">Continue</button>
    `;
    document.getElementById('next-btn').addEventListener('click', () => {
      const name = document.getElementById('s-name').value, phone = document.getElementById('s-phone').value;
      if (!name || !phone) { toast('Fill in your name and phone number'); return; }
      data.name = name; data.phone = phone;
      current++; renderStep();
    });
  } else if (current === 1) {
    wizard.innerHTML = `
      <h2 style="font-size:1.05rem;">Business details</h2>
      <div class="measure-field"><label>Category</label>
        <select id="s-category">
          ${availableCategories.map(c => `<option ${data.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="measure-field"><label>What do you specialize in?</label><input id="s-specialties" value="${data.specialties || ''}" placeholder="e.g. Bridal gowns, kaba & slit"></div>
      <div class="measure-field"><label>About your shop</label><input id="s-bio" value="${data.bio || ''}" placeholder="A sentence or two about your work"></div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-outline" id="back-btn">Back</button>
        <button class="btn btn-primary" id="next-btn" style="flex:1;">Continue</button>
      </div>
    `;
    bindNav(() => {
      data.category = document.getElementById('s-category').value;
      data.specialties = document.getElementById('s-specialties').value;
      data.bio = document.getElementById('s-bio').value;
      if (!data.specialties) { toast('Add what you specialize in'); return false; }
      return true;
    });
  } else if (current === 2) {
    wizard.innerHTML = `
      <h2 style="font-size:1.05rem;">Location</h2>
      <div class="measure-field"><label>Where are you based?</label><input id="s-location" value="${data.location || ''}" placeholder="e.g. East Legon, Accra"></div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-outline" id="back-btn">Back</button>
        <button class="btn btn-primary" id="next-btn" style="flex:1;">Continue</button>
      </div>
    `;
    bindNav(() => {
      data.location = document.getElementById('s-location').value;
      if (!data.location) { toast('Add your location'); return false; }
      return true;
    });
  } else if (current === 3) {
    wizard.innerHTML = `
      <h2 style="font-size:1.05rem;">Pricing & turnaround</h2>
      <div style="display:flex; gap:10px;">
        <div class="measure-field" style="flex:1;"><label>Starting price (GH₵)</label><input type="number" id="s-price-min" value="${data.priceMin || ''}" placeholder="e.g. 200"></div>
        <div class="measure-field" style="flex:1;"><label>Top price (GH₵)</label><input type="number" id="s-price-max" value="${data.priceMax || ''}" placeholder="e.g. 1500"></div>
      </div>
      <div class="measure-field"><label>Typical turnaround (days)</label><input type="number" id="s-turnaround" value="${data.turnaroundDays || ''}" placeholder="e.g. 14"></div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-outline" id="back-btn">Back</button>
        <button class="btn btn-primary" id="next-btn" style="flex:1;">Continue</button>
      </div>
    `;
    document.getElementById('back-btn').addEventListener('click', () => { current--; renderStep(); });
    document.getElementById('next-btn').addEventListener('click', async (e) => {
      data.priceMin = document.getElementById('s-price-min').value;
      data.priceMax = document.getElementById('s-price-max').value;
      data.turnaroundDays = document.getElementById('s-turnaround').value;
      if (!data.priceMin || !data.priceMax || !data.turnaroundDays) { toast('Fill in pricing and turnaround'); return; }

      // The shop record gets created here — from this point on, the
      // remaining steps (work photos, workplace photo, payout account) all
      // need a real designer ID to attach to.
      if (!data.designerId) {
        e.target.disabled = true; e.target.textContent = 'Saving…';
        try {
          const result = await api('/api/designers', {
            method: 'POST',
            body: JSON.stringify({
              name: data.name, category: data.category, specialties: data.specialties,
              location: data.location, priceMin: Number(data.priceMin), priceMax: Number(data.priceMax),
              turnaroundDays: Number(data.turnaroundDays), bio: data.bio, phone: data.phone
            })
          });
          data.designerId = result.id;
        } catch (err) {
          toast(err.message);
          e.target.disabled = false; e.target.textContent = 'Continue';
          return;
        }
      }
      current++; renderStep();
    });
  } else if (current === 4) {
    renderWorkPhotosStep();
  } else if (current === 5) {
    renderWorkplacePhotoStep();
  } else if (current === 6) {
    renderPayoutStep();
  }
}

function renderWorkPhotosStep() {
  wizard.innerHTML = `
    <h2 style="font-size:1.05rem;">Show off your work</h2>
    <p class="muted" style="font-size:.85rem;">Upload at least one photo of something you've made — this is what customers see first, and it's required before your shop can go live. Add more anytime from your dashboard.</p>
    <label class="upload-zone" for="work-photo-upload" style="display:block; margin:14px 0;">
      <span class="icon">${ICONS.mannequin}</span><div style="font-size:.85rem;">Upload a photo of your work</div>
    </label>
    <input type="file" id="work-photo-upload" accept="image/*" style="display:none;">
    <div class="thumb-row" id="work-photos-preview" style="margin-bottom:10px;">${(data.workPhotos || []).map(url => `<img src="${url}">`).join('')}</div>
    <p class="muted" style="font-size:.8rem;" id="work-photo-count">${(data.workPhotos || []).length} photo${(data.workPhotos || []).length === 1 ? '' : 's'} added</p>
    <div style="display:flex; gap:10px; margin-top:10px;">
      <button class="btn btn-outline" id="back-btn">Back</button>
      <button class="btn btn-primary" id="next-btn" style="flex:1;">Continue</button>
    </div>
  `;

  data.workPhotos = data.workPhotos || [];

  document.getElementById('work-photo-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFileHelper(file);
      data.workPhotos.push(url);
      await api(`/api/designers/${data.designerId}/portfolio`, {
        method: 'POST', body: JSON.stringify({ title: 'My work', imageUrl: url })
      });
      document.getElementById('work-photos-preview').innerHTML = data.workPhotos.map(u => `<img src="${u}">`).join('');
      document.getElementById('work-photo-count').textContent = `${data.workPhotos.length} photo${data.workPhotos.length === 1 ? '' : 's'} added`;
    } catch (err) { toast(err.message); }
  });

  document.getElementById('back-btn').addEventListener('click', () => { current--; renderStep(); });
  document.getElementById('next-btn').addEventListener('click', () => {
    if (data.workPhotos.length === 0) { toast('Add at least one photo of your work to continue'); return; }
    current++; renderStep();
  });
}

function renderWorkplacePhotoStep() {
  wizard.innerHTML = `
    <h2 style="font-size:1.05rem;">Show your workplace</h2>
    <p class="muted" style="font-size:.85rem;">A photo of your studio, shop, or workspace — this helps our team verify your shop before it goes live, and helps customers trust that you're a real, working designer.</p>
    <label class="upload-zone" for="workplace-upload" style="display:block; margin:14px 0;">
      <span class="icon">${ICONS.gear}</span><div style="font-size:.85rem;">Upload a photo of your workplace</div>
    </label>
    <input type="file" id="workplace-upload" accept="image/*" style="display:none;">
    <div class="thumb-row" id="workplace-preview">${data.workplacePhoto ? `<img src="${data.workplacePhoto}">` : ''}</div>
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button class="btn btn-outline" id="back-btn">Back</button>
      <button class="btn btn-primary" id="next-btn" style="flex:1;">Continue</button>
    </div>
  `;

  document.getElementById('workplace-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFileHelper(file);
      data.workplacePhoto = url;
      await api(`/api/designers/${data.designerId}`, { method: 'PATCH', body: JSON.stringify({ workplaceImageUrl: url }) });
      document.getElementById('workplace-preview').innerHTML = `<img src="${url}">`;
    } catch (err) { toast(err.message); }
  });

  document.getElementById('back-btn').addEventListener('click', () => { current--; renderStep(); });
  document.getElementById('next-btn').addEventListener('click', () => {
    if (!data.workplacePhoto) { toast('Add a photo of your workplace to continue'); return; }
    current++; renderStep();
  });
}

async function renderPayoutStep() {
  wizard.innerHTML = `
    <h2 style="font-size:1.05rem;">Get paid automatically</h2>
    <p class="muted" style="font-size:.85rem;">Connect your mobile money account now so you're ready to receive payments as soon as your shop is approved — no need to hunt for this later.</p>
    <div id="payout-step-content"><p class="muted">Loading…</p></div>
  `;

  const content = document.getElementById('payout-step-content');
  let paystackStatus;
  try { paystackStatus = await api('/api/paystack/status'); } catch { paystackStatus = { configured: false }; }

  if (!paystackStatus.configured) {
    content.innerHTML = `
      <p class="muted" style="font-size:.85rem;">Automatic payouts aren't set up on this server yet — you can connect this later from your dashboard.</p>
      <div style="display:flex; gap:10px; margin-top:14px;">
        <button class="btn btn-outline" id="back-btn">Back</button>
        <button class="btn btn-gold" id="finish-btn" style="flex:1;">Finish — create my shop</button>
      </div>`;
    wireFinalButtons();
    return;
  }

  let banks = [];
  try { banks = await api('/api/paystack/banks'); } catch {}

  content.innerHTML = `
    ${banks.length ? `
      <div class="measure-field"><label>Mobile money network</label>
        <select id="payout-bank">${banks.map(b => `<option value="${b.code}" data-name="${b.name}">${b.name}</option>`).join('')}</select>
      </div>
      <div class="measure-field"><label>Mobile money number</label><input id="payout-number" placeholder="0551234987"></div>
      <button class="btn btn-outline" id="connect-payout" type="button">Connect account</button>
      <div id="payout-connect-result" style="margin-top:8px;"></div>
    ` : `<p class="muted" style="font-size:.85rem;">Couldn't load mobile money networks right now — you can connect this later from your dashboard.</p>`}
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn btn-outline" id="back-btn">Back</button>
      <button class="btn btn-gold" id="finish-btn" style="flex:1;">Finish — create my shop</button>
    </div>
    <button type="button" id="skip-payout" class="link-btn" style="display:block; margin:10px auto 0;">Skip for now, I'll do this later</button>
  `;

  const connectBtn = document.getElementById('connect-payout');
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      const bankSelect = document.getElementById('payout-bank');
      const bankCode = bankSelect.value;
      const bankName = bankSelect.options[bankSelect.selectedIndex].dataset.name;
      const accountNumber = document.getElementById('payout-number').value;
      if (!accountNumber) { toast('Enter your mobile money number'); return; }
      connectBtn.disabled = true; connectBtn.textContent = 'Connecting…';
      try {
        const result = await api(`/api/designers/${data.designerId}/payout-account`, {
          method: 'POST', body: JSON.stringify({ bankCode, bankName, accountNumber })
        });
        document.getElementById('payout-connect-result').innerHTML = `<p style="color:var(--forest); font-size:.85rem;">Connected — confirm this is you: <strong>${result.accountName}</strong></p>`;
        toast('Payout account connected');
      } catch (err) {
        toast(err.message);
        connectBtn.disabled = false; connectBtn.textContent = 'Connect account';
      }
    });
  }

  const skipBtn = document.getElementById('skip-payout');
  if (skipBtn) skipBtn.addEventListener('click', () => finishOnboarding());

  wireFinalButtons();
}

function wireFinalButtons() {
  document.getElementById('back-btn').addEventListener('click', () => { current--; renderStep(); });
  document.getElementById('finish-btn').addEventListener('click', finishOnboarding);
}

function finishOnboarding() {
  wizard.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.heart}</span>Welcome to atadeɛ, ${data.name}! Your shop has been created and is now waiting for review — our team checks the photos you shared before approving new shops.<div style="margin-top:16px;"><a class="btn btn-primary" href="/dashboard.html">Go to your dashboard</a></div></div>`;
  document.getElementById('progress').style.display = 'none';
}

function bindNav(validate) {
  document.getElementById('back-btn').addEventListener('click', () => { current--; renderStep(); });
  document.getElementById('next-btn').addEventListener('click', () => {
    if (validate()) { current++; renderStep(); }
  });
}

async function uploadFileHelper(file) {
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch('/api/uploads', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

renderStep();

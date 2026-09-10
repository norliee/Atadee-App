renderNav(null);

const root = document.getElementById('root');
const orderId = qs('id');
let method = 'card';
let paystackConfigured = false;
let serviceFee = 0; // flat GH₵ amount for this order's tier, 0 if already charged

async function load() {
  paystackConfigured = (await api('/api/paystack/status')).configured;
  const order = await api(`/api/orders/${orderId}`);
  if (!order.quoted_price) {
    root.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.scissors}</span>This order doesn't have a quoted price yet — payment isn't available until your designer sends a quote.</div>`;
    return;
  }
  serviceFee = order.serviceFeeCharged ? 0 : order.serviceFee;
  const remaining = order.quoted_price - order.amount_paid;
  if (remaining <= 0) {
    root.innerHTML = `<div class="empty-state"><span class="icon">${ICONS.heart}</span>This order is fully paid. Thank you!<div style="margin-top:16px;"><a class="btn btn-primary" href="/track.html?id=${orderId}">Back to order</a></div></div>`;
    return;
  }

  renderForm(order, remaining);
}

function renderForm(order, remaining) {
  root.innerHTML = `
    <a href="/track.html?id=${orderId}" class="muted" style="font-size:.85rem;">&larr; Back to order</a>
    <h1 style="font-size:1.4rem; margin-top:10px;">Pay ${order.designer.name}</h1>
    <p class="muted">Order #${order.id} · ${order.garment_type.replace('_', ' ')}</p>

    <div class="card" style="padding:22px; margin-top:16px;">
      <div class="balance-summary" style="border-top:none; padding-top:0;">
        <span class="muted">Total</span><strong>${money(order.quoted_price)}</strong>
      </div>
      <div class="balance-summary" style="padding:6px 0;">
        <span class="muted">Already paid</span><span>${money(order.amount_paid)}</span>
      </div>
      <div class="balance-summary" style="border-top:1.5px solid var(--line);">
        <span><strong>Balance due</strong></span><strong style="color:var(--forest-deep);">${money(remaining)}</strong>
      </div>

      <div class="measure-field" style="margin-top:16px;">
        <label>How much would you like to pay?</label>
        <div class="toggle-row">
          <button type="button" class="toggle-option active" id="pay-full" data-amt="${remaining}">Full balance</button>
          <button type="button" class="toggle-option" id="pay-deposit" data-amt="${Math.ceil(remaining / 2)}">Deposit (50%)</button>
        </div>
        <input type="number" id="pay-amount" value="${remaining}" style="margin-top:8px; padding:11px 14px; border-radius:8px; border:1px solid var(--line); width:100%;">
      </div>

      <div class="balance-summary" style="border-top:1px dashed var(--line); padding:10px 0 4px;">
        <span class="muted" style="font-size:.85rem;">atadeɛ Service & Protection fee</span><span id="fee-preview" style="font-size:.85rem;">${serviceFee > 0 ? money(serviceFee) : 'Already charged'}</span>
      </div>
      <div class="balance-summary" style="padding-top:0;">
        <span><strong>You'll pay today</strong></span><strong id="total-preview" style="color:var(--forest-deep);">${money(remaining + serviceFee)}</strong>
      </div>

      <div class="measure-field">
        <label>Payment method</label>
        <div class="pay-method-grid" id="method-grid">
          <div class="pay-method active" data-method="card"><span class="icon">${ICONS.tape}</span>Card</div>
          <div class="pay-method" data-method="momo"><span class="icon">${ICONS.needle}</span>Mobile Money</div>
          <div class="pay-method" data-method="paypal"><span class="icon">${ICONS.spool}</span>PayPal</div>
        </div>
      </div>

      <div id="method-fields"></div>

      <button class="btn btn-primary btn-block" id="pay-btn" type="button" style="margin-top:14px;">Pay ${money(remaining + serviceFee)}</button>
      <p class="muted" style="font-size:.72rem; text-align:center; margin-top:10px;" id="pay-disclaimer"></p>
    </div>
  `;

  renderMethodFields();

  document.getElementById('pay-full').addEventListener('click', () => setAmount(remaining, 'pay-full'));
  document.getElementById('pay-deposit').addEventListener('click', () => setAmount(Math.ceil(remaining / 2), 'pay-deposit'));
  document.getElementById('pay-amount').addEventListener('input', updatePayButtonLabel);

  document.getElementById('method-grid').querySelectorAll('.pay-method').forEach(el => {
    el.addEventListener('click', () => {
      method = el.dataset.method;
      document.getElementById('method-grid').querySelectorAll('.pay-method').forEach(m => m.classList.toggle('active', m === el));
      renderMethodFields();
    });
  });

  document.getElementById('pay-btn').addEventListener('click', () => processPayment(order));
}

function setAmount(amt, activeId) {
  document.getElementById('pay-amount').value = amt;
  document.querySelectorAll('.toggle-option').forEach(b => b.classList.toggle('active', b.id === activeId));
  updatePayButtonLabel();
}

function updatePayButtonLabel() {
  const amt = Number(document.getElementById('pay-amount').value) || 0;
  const total = amt + serviceFee;
  document.getElementById('total-preview').textContent = money(total);
  document.getElementById('pay-btn').textContent = `Pay ${money(total)}`;
}

function renderMethodFields() {
  const el = document.getElementById('method-fields');
  const disclaimer = document.getElementById('pay-disclaimer');

  if (method === 'card') {
    disclaimer.textContent = 'This is a demo payment for prototype purposes — no real card transaction is processed.';
    el.innerHTML = `
      <div class="measure-field"><label>Card number</label><input id="card-number" placeholder="4242 4242 4242 4242" maxlength="19"></div>
      <div style="display:flex; gap:10px;">
        <div class="measure-field" style="flex:1;"><label>Expiry</label><input id="card-expiry" placeholder="MM/YY" maxlength="5"></div>
        <div class="measure-field" style="flex:1;"><label>CVC</label><input id="card-cvc" placeholder="123" maxlength="4"></div>
      </div>`;
  } else if (method === 'momo') {
    disclaimer.textContent = paystackConfigured
      ? 'You\u2019ll get a prompt on your phone from your network to enter your Mobile Money PIN and approve this payment.'
      : 'This is a demo payment for prototype purposes — no real mobile money transaction is processed. (Paystack isn\u2019t configured on this server yet.)';
    el.innerHTML = `
      <div class="measure-field"><label>Network</label>
        <select id="momo-network">
          <option value="mtn">MTN Mobile Money</option>
          <option value="airteltigo">AirtelTigo Money</option>
          <option value="telecel">Telecel Cash</option>
        </select>
      </div>
      <div class="measure-field"><label>Mobile money number</label><input id="momo-number" placeholder="024 123 4567"></div>`;
  } else {
    disclaimer.textContent = 'This is a demo payment for prototype purposes — no real PayPal transaction is processed.';
    el.innerHTML = `<div class="measure-field"><label>PayPal email</label><input id="paypal-email" placeholder="you@example.com" type="email"></div>`;
  }
}

async function processPayment(order) {
  const amount = Number(document.getElementById('pay-amount').value);
  if (!amount || amount <= 0) { toast('Enter a valid amount'); return; }

  if (method === 'momo' && paystackConfigured) {
    const phone = document.getElementById('momo-number').value;
    const network = document.getElementById('momo-network').value;
    if (!phone) { toast('Enter your mobile money number'); return; }
    await processLiveMomoPayment(order, amount, phone, network);
    return;
  }

  let provider = null, payerDetail = null;
  if (method === 'card') {
    const num = document.getElementById('card-number').value;
    if (!num || num.replace(/\s/g, '').length < 12) { toast('Enter a valid card number'); return; }
    provider = 'Card'; payerDetail = `•••• ${num.replace(/\s/g, '').slice(-4)}`;
  } else if (method === 'momo') {
    const num = document.getElementById('momo-number').value;
    if (!num) { toast('Enter your mobile money number'); return; }
    provider = document.getElementById('momo-network').value; payerDetail = num;
  } else {
    const email = document.getElementById('paypal-email').value;
    if (!email) { toast('Enter your PayPal email'); return; }
    provider = 'PayPal'; payerDetail = email;
  }

  root.innerHTML = `
    <div class="card processing-overlay">
      <div class="processing-spinner"></div>
      <p>Processing your payment…</p>
    </div>`;

  await new Promise(r => setTimeout(r, 1400)); // simulated processing delay

  try {
    const result = await api(`/api/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ method, provider, amount, payerDetail })
    });
    showPaymentSuccess(result.reference, result.remaining, result.totalCharged);
  } catch (err) {
    showPaymentError(err.message);
  }
}

async function processLiveMomoPayment(order, amount, phone, network) {
  root.innerHTML = `
    <div class="card processing-overlay">
      <div class="processing-spinner"></div>
      <p>Sending a payment request to your phone…</p>
    </div>`;

  let charge;
  try {
    charge = await api(`/api/orders/${orderId}/pay-momo-live`, {
      method: 'POST', body: JSON.stringify({ amount, phone, network })
    });
  } catch (err) {
    showPaymentError(err.message);
    return;
  }

  root.innerHTML = `
    <div class="card processing-overlay">
      <div class="processing-spinner"></div>
      <p>${charge.displayText}</p>
      <p class="muted" style="font-size:.82rem; margin-top:8px;">Waiting for you to approve on your phone — this can take up to 3 minutes.</p>
    </div>`;

  // Mobile money authorization happens on the customer's phone, so we poll
  // Paystack's verify endpoint until it resolves — matches the 180-second
  // window Paystack documents for the customer to approve.
  const startedAt = Date.now();
  const poll = async () => {
    if (Date.now() - startedAt > 185000) {
      showPaymentError("We didn't hear back in time. If money left your account, it will be reflected shortly — otherwise, please try again.");
      return;
    }
    try {
      const result = await api(`/api/paystack/verify/${charge.reference}`);
      if (result.status === 'success') {
        const remaining = result.amountPaid !== undefined ? Math.max(0, order.quoted_price - result.amountPaid) : 0;
        showPaymentSuccess(charge.reference, remaining, charge.totalCharged);
        return;
      }
      if (result.status === 'failed' || result.status === 'abandoned') {
        showPaymentError(result.message || 'The payment was not completed.');
        return;
      }
    } catch { /* keep polling through transient errors */ }
    setTimeout(poll, 4000);
  };
  setTimeout(poll, 4000);
}

function showPaymentSuccess(reference, remaining, totalCharged) {
  root.innerHTML = `
    <div class="card empty-state">
      <span class="icon">${ICONS.heart}</span>
      Payment successful 🎉
      <p class="muted" style="font-size:.85rem; margin-top:8px;">Reference: ${reference}</p>
      ${totalCharged ? `<p class="muted" style="font-size:.85rem;">Charged: ${money(totalCharged)} (includes atadeɛ Service & Protection fee)</p>` : ''}
      ${remaining > 0 ? `<p class="muted" style="font-size:.85rem;">Remaining balance: ${money(remaining)}</p>` : '<p class="muted" style="font-size:.85rem;">Order fully paid.</p>'}
      <div style="margin-top:16px;"><a class="btn btn-primary" href="/track.html?id=${orderId}">Back to order</a></div>
    </div>`;
}

function showPaymentError(message) {
  root.innerHTML = `<div class="empty-state">${message}<div style="margin-top:16px;"><a class="btn btn-outline" href="/payment.html?id=${orderId}">Try again</a></div></div>`;
}

load().catch(err => { root.innerHTML = `<div class="empty-state">${err.message}</div>`; });

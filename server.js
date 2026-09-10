const express = require('express');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');
const { GARMENTS, recommendSize } = require('./garments');

// ---- .env loader (no extra dependency) ----
// Reads KEY=VALUE lines from a .env file next to server.js, if one exists,
// without overwriting any variable the shell environment already set.
(function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
})();

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ---- Paystack (real mobile money payments) ----
// Set PAYSTACK_SECRET_KEY / PAYSTACK_PUBLIC_KEY in a .env file (see
// .env.example) to enable real MTN/AirtelTigo/Telecel charges. Without
// keys configured, the app falls back to the simulated payment flow used
// elsewhere in this prototype — nothing breaks, it just isn't real money.
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PROVIDER_CODES = { mtn: 'mtn', airteltigo: 'atl', telecel: 'vod' };

function paystackRequest(apiPath, method, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.paystack.co', path: apiPath, method,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { reject(new Error('Unexpected response from Paystack')); }
      });
    });
    req.on('error', () => reject(new Error('Could not reach Paystack — check your internet connection')));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Records a confirmed Paystack payment against an order — shared by both
// the webhook handler and the manual verify-polling fallback, and safe to
// call twice for the same reference (idempotent) since webhook delivery
// and polling can both succeed for the same transaction.
//
// What the customer actually pays (amountPesewas) is the order amount
// PLUS the platform's service fee — only the order portion counts toward
// the order's balance; the fee is recorded separately as platform
// revenue, never as something the customer owes the designer.
// Cliff-style tier lookup: the order's total value picks ONE bracket, and
// that bracket's rate (or flat fee) applies to the whole order. Used for
// both the designer commission (%) and the customer service fee (flat GH₵).
function getTierValue(settingsKey, orderAmount, valueField, defaultTiers) {
  const row = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(settingsKey);
  let tiers;
  try { tiers = row ? JSON.parse(row.value) : defaultTiers; } catch { tiers = defaultTiers; }
  for (const t of tiers) {
    if (t.max === null || t.max === undefined || orderAmount <= t.max) return t[valueField];
  }
  return tiers[tiers.length - 1][valueField];
}
function getCommissionRate(orderAmount) {
  return getTierValue('commission_tiers', orderAmount, 'rate', [{ max: null, rate: 10 }]);
}
function getServiceFee(orderAmount) {
  return getTierValue('service_fee_tiers', orderAmount, 'fee', [{ max: null, fee: 5 }]);
}

function finalizePaystackPayment({ reference, orderId, amountPesewas, orderAmountPesewas, provider }) {
  const already = db.prepare('SELECT id FROM payments WHERE reference = ?').get(reference);
  if (already) return { alreadyRecorded: true };

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 'Order not found' };

  const orderAmount = Math.round((orderAmountPesewas !== undefined ? orderAmountPesewas : amountPesewas) / 100);
  const feeAmount = orderAmountPesewas !== undefined ? Math.round((amountPesewas - orderAmountPesewas) / 100) : 0;

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO payments (order_id, method, provider, amount, status, reference, payer_detail)
      VALUES (?, 'momo', ?, ?, 'completed', ?, ?)
    `).run(orderId, provider, orderAmount, reference, 'Paid via Paystack');
    if (feeAmount > 0) {
      db.prepare(`
        INSERT INTO payments (order_id, method, provider, amount, status, reference, payer_detail)
        VALUES (?, 'platform_fee', 'Service fee', ?, 'completed', ?, ?)
      `).run(orderId, feeAmount, reference + '-fee', 'In-app service fee');
    }
    const newPaid = order.amount_paid + orderAmount;
    const newStatus = order.quoted_price && newPaid >= order.quoted_price ? 'paid' : 'partial';
    db.prepare(`UPDATE orders SET amount_paid = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newPaid, newStatus, orderId);
    db.exec('COMMIT');
    notify('designer', order.designer_id, `${order.customer_name} paid GH₵${orderAmount} for order #${orderId} via mobile money 💵`, '/dashboard.html');
    return { ok: true, amountPaid: newPaid, paymentStatus: newStatus };
  } catch (err) {
    db.exec('ROLLBACK');
    return { error: 'Could not record payment' };
  }
}

// ---- Auth helpers ----
// Passwords are hashed with scrypt (built into Node's crypto module — no
// extra dependency, no native compilation). Sessions are random tokens; only
// a SHA-256 hash of the token is stored server-side, so a database leak
// alone doesn't hand out valid sessions. This is a genuine, working
// implementation for a prototype — see the README for what's explicitly
// out of scope (e.g. no HTTPS enforcement on localhost, no real Google
// OAuth, no encryption of the SQLite file at rest).

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}
function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false;
  const attempt = crypto.scryptSync(password, salt, 64).toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(attempt, 'hex'), Buffer.from(hash, 'hex')); }
  catch { return false; }
}
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}
function logAudit(userId, event, detail) {
  db.prepare('INSERT INTO audit_log (user_id, event, detail) VALUES (?, ?, ?)').run(userId || null, event, detail || null);
}
// In-app notifications only — no browser push/OS notifications, which would
// need a service worker, HTTPS, and an explicit permission prompt (all
// overkill for a prototype, and a permission popup on first visit is
// exactly the kind of nuisance this is meant to avoid). Customers only
// get notified on orders placed while logged in; designers are notified
// via whichever profile is selected on their dashboard.
function notify(recipientType, recipientId, title, linkUrl) {
  if (!recipientId) return;
  db.prepare('INSERT INTO notifications (recipient_type, recipient_id, title, link_url) VALUES (?, ?, ?, ?)')
    .run(recipientType, recipientId, title, linkUrl || null);
}
function createSession(res, userId, userAgent) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (user_id, token_hash, user_agent, expires_at) VALUES (?, ?, ?, ?)')
    .run(userId, hashToken(token), userAgent || null, expiresAt);
  res.setHeader('Set-Cookie', `atadee_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
}
function getCurrentUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.atadee_session;
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(token));
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  const user = db.prepare('SELECT id, email, name, role, auth_provider, created_at FROM users WHERE id = ?').get(session.user_id);
  if (!user) return null;
  db.prepare(`UPDATE sessions SET last_active_at = datetime('now') WHERE id = ?`).run(session.id);
  return { ...user, sessionId: session.id };
}
function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to continue' });
  req.user = user;
  next();
}

// Real backend-enforced role-based access — not just hidden UI. Each admin
// section declares which staff roles may touch it; requests from anyone
// else (including a logged-in customer) are rejected with 403 regardless
// of what the frontend shows.
const STAFF_ROLES = ['admin', 'support', 'finance', 'moderator'];
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = getCurrentUser(req);
    if (!user || !STAFF_ROLES.includes(user.role)) return res.status(401).json({ error: 'Staff sign-in required' });
    if (user.role !== 'admin' && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Your role doesn't have access to this section" });
    }
    req.staff = user;
    next();
  };
}
function logAdminAction(staffUserId, action, detail) {
  db.prepare('INSERT INTO admin_audit_log (staff_user_id, action, detail) VALUES (?, ?, ?)').run(staffUserId || null, action, detail || null);
}

// ---- Photo uploads (used by the designer dashboard to add real photos) ----

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});

app.post('/api/uploads', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

// ---- Designers ----

app.get('/api/designers', (req, res) => {
  const { category, location, minPrice, maxPrice, minRating, q, sustainable, all } = req.query;
  // `all=true` bypasses the approval/suspension filter — used only by the
  // designer dashboard's own picker, so a designer can still manage their
  // profile while pending review. Public browsing never sets this.
  let sql = all === 'true' ? 'SELECT * FROM designers WHERE 1=1' : `SELECT * FROM designers WHERE approval_status = 'approved' AND suspended = 0`;
  const params = [];

  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (location) { sql += ' AND location LIKE ?'; params.push(`%${location}%`); }
  if (minPrice) { sql += ' AND price_max >= ?'; params.push(Number(minPrice)); }
  if (maxPrice) { sql += ' AND price_min <= ?'; params.push(Number(maxPrice)); }
  if (minRating) { sql += ' AND rating >= ?'; params.push(Number(minRating)); }
  if (q) { sql += ' AND (name LIKE ? OR specialties LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (sustainable === 'true') { sql += ' AND sustainable_badge = 1'; }

  sql += ' ORDER BY featured DESC, verified DESC, rating DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.get('/api/designers/:id', (req, res) => {
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  const portfolio = db.prepare('SELECT * FROM portfolio_items WHERE designer_id = ?').all(req.params.id);
  res.json({ ...designer, portfolio });
});

app.patch('/api/designers/:id', (req, res) => {
  const { imageUrl, workplaceImageUrl } = req.body;
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  db.prepare('UPDATE designers SET image_url = COALESCE(?, image_url), workplace_image_url = COALESCE(?, workplace_image_url) WHERE id = ?')
    .run(imageUrl || null, workplaceImageUrl || null, req.params.id);
  res.json({ ok: true });
});

app.post('/api/designers/:id/portfolio', (req, res) => {
  const { title, imageUrl, garmentType, priceFrom, circularType } = req.body;
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  if (!title || !imageUrl) return res.status(400).json({ error: 'title and imageUrl are required' });

  const info = db.prepare(`
    INSERT INTO portfolio_items (designer_id, title, swatch, image_url, garment_type, price_from, circular_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, title, designer.swatch, imageUrl, garmentType || null, priceFrom || null, circularType || null);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.get('/api/categories', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM designers ORDER BY category').all();
  res.json(rows.map(r => r.category));
});

// ---- Explore Styles feed (browse by look, not just by designer) ----

app.get('/api/styles', (req, res) => {
  const { garmentType, category, q } = req.query;
  let sql = `
    SELECT p.id, p.title, p.image_url, p.garment_type, p.price_from,
           d.id AS designer_id, d.name AS designer_name, d.category AS designer_category,
           d.location AS designer_location, d.rating AS designer_rating, d.swatch AS designer_swatch,
           d.turnaround_days
    FROM portfolio_items p
    JOIN designers d ON d.id = p.designer_id
    WHERE 1=1
  `;
  const params = [];
  if (garmentType) { sql += ' AND p.garment_type = ?'; params.push(garmentType); }
  if (category) { sql += ' AND d.category = ?'; params.push(category); }
  if (q) { sql += ' AND (p.title LIKE ? OR d.name LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY d.verified DESC, d.rating DESC';

  res.json(db.prepare(sql).all(...params));
});

// ---- Garments / measurement engine ----

app.get('/api/garments', (_req, res) => {
  res.json(Object.keys(GARMENTS).map(key => ({
    key,
    ...GARMENTS[key],
    fields: GARMENTS[key].fields.map(f => ({ key: f.key, label: f.label, guide: f.guide || '' }))
  })));
});

app.post('/api/size-check', (req, res) => {
  const { garmentType, measurements } = req.body;
  const garment = GARMENTS[garmentType];
  if (!garment) return res.status(400).json({ error: 'Unknown garment type' });
  const result = recommendSize(garmentType, measurements);
  if (!result) return res.status(400).json({ error: 'Missing the measurement this garment sizes on' });
  res.json(result);
});

// ---- Orders ----

app.post('/api/orders', (req, res) => {
  const {
    designerId, customerName, customerPhone, garmentType, measurements, budgetMin, budgetMax, notes,
    orderFor, recipientName, recipientPhone, customerCountry, deliveryCountry, deliveryAddress, groupOrderId,
    referenceImageUrl, changesWanted, changesCustom
  } = req.body;

  if (!designerId || !customerName || !customerPhone || !garmentType || !measurements) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (orderFor === 'other' && (!recipientName || !recipientPhone || !deliveryAddress)) {
    return res.status(400).json({ error: "Recipient name, phone, and delivery address are required when ordering for someone else" });
  }
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(designerId);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });

  const sizeResult = recommendSize(garmentType, measurements);
  if (!sizeResult) return res.status(400).json({ error: 'Could not calculate size from measurements given' });

  const currentUser = getCurrentUser(req);

  const info = db.prepare(`
    INSERT INTO orders (
      designer_id, customer_name, customer_phone, garment_type, measurements, recommended_size, fit_note,
      budget_min, budget_max, notes, status, order_for, recipient_name, recipient_phone,
      customer_country, delivery_country, delivery_address, group_order_id, reference_image_url, customer_user_id,
      changes_wanted, changes_custom
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    designerId, customerName, customerPhone, garmentType, JSON.stringify(measurements), sizeResult.size, sizeResult.note,
    budgetMin || null, budgetMax || null, notes || null,
    orderFor === 'other' ? 'other' : 'self',
    orderFor === 'other' ? recipientName : null,
    orderFor === 'other' ? recipientPhone : null,
    customerCountry || 'Ghana',
    deliveryCountry || 'Ghana',
    orderFor === 'other' ? deliveryAddress : (deliveryAddress || null),
    groupOrderId || null,
    referenceImageUrl || null,
    currentUser ? currentUser.id : null,
    JSON.stringify((changesWanted || []).filter(c => CHANGE_OPTIONS.includes(c))),
    changesCustom || null
  );

  if (currentUser) logAudit(currentUser.id, 'measurements_shared', `Shared measurements with ${designer.name} for order #${Number(info.lastInsertRowid)}`);
  notify('designer', Number(designerId), `New order request from ${customerName} 📬`, '/dashboard.html');
  res.status(201).json({ orderId: Number(info.lastInsertRowid), recommendedSize: sizeResult.size, fitNote: sizeResult.note });
});

app.get('/api/orders/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, d.name AS designer_name, d.swatch AS designer_swatch, d.image_url AS designer_image_url, d.turnaround_days AS designer_turnaround_days
    FROM orders o JOIN designers d ON d.id = o.designer_id
    WHERE o.customer_user_id = ? ORDER BY o.created_at DESC
  `).all(req.user.id);
  res.json(rows.map(o => ({ ...o, measurements: JSON.parse(o.measurements) })));
});

// ---- Message inbox — one row per order that has at least one message,
// with the latest message preview and how many are unread, so customers
// and designers can see all their conversations in one place instead of
// having to remember which order to click into. ----

function messagePreview(m) {
  if (!m) return null;
  if (m.kind === 'photo') return '📷 Sent a photo';
  if (m.kind === 'quote') return `💰 Sent a quote — GH₵${m.quote_amount}`;
  return m.body;
}

app.get('/api/orders/mine/threads', requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, d.name AS designer_name, d.swatch AS designer_swatch, d.image_url AS designer_image_url
    FROM orders o JOIN designers d ON d.id = o.designer_id
    WHERE o.customer_user_id = ? ORDER BY o.created_at DESC
  `).all(req.user.id);

  const threads = orders.map(o => {
    const last = db.prepare('SELECT * FROM messages WHERE order_id = ? ORDER BY created_at DESC, id DESC LIMIT 1').get(o.id);
    const unread = db.prepare(`SELECT COUNT(*) c FROM messages WHERE order_id = ? AND sender = 'designer' AND is_read = 0`).get(o.id).c;
    return {
      orderId: o.id, garmentType: o.garment_type, designerName: o.designer_name,
      designerSwatch: o.designer_swatch, designerImageUrl: o.designer_image_url,
      lastMessage: messagePreview(last), lastMessageAt: last ? last.created_at : o.created_at, unreadCount: unread
    };
  });

  threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  res.json(threads);
});

app.get('/api/designers/:id/threads', (req, res) => {
  const orders = db.prepare(`SELECT * FROM orders WHERE designer_id = ? ORDER BY created_at DESC`).all(req.params.id);

  const threads = orders.map(o => {
    const last = db.prepare('SELECT * FROM messages WHERE order_id = ? ORDER BY created_at DESC, id DESC LIMIT 1').get(o.id);
    const unread = db.prepare(`SELECT COUNT(*) c FROM messages WHERE order_id = ? AND sender = 'customer' AND is_read = 0`).get(o.id).c;
    return {
      orderId: o.id, garmentType: o.garment_type, customerName: o.customer_name,
      lastMessage: messagePreview(last), lastMessageAt: last ? last.created_at : o.created_at, unreadCount: unread
    };
  });

  threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  res.json(threads);
});

app.post('/api/orders/:id/messages/mark-read', (req, res) => {
  const { as } = req.body; // 'customer' | 'designer' — marks the OTHER party's messages read
  const otherSender = as === 'designer' ? 'customer' : 'designer';
  db.prepare(`UPDATE messages SET is_read = 1 WHERE order_id = ? AND sender = ?`).run(req.params.id, otherSender);
  res.json({ ok: true });
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const designer = db.prepare('SELECT id, name, category, location, swatch, image_url FROM designers WHERE id = ?').get(order.designer_id);
  const serviceFeeCharged = !!db.prepare(`SELECT id FROM payments WHERE order_id = ? AND method = 'platform_fee'`).get(order.id);
  const serviceFee = order.quoted_price ? getServiceFee(order.quoted_price) : null;
  res.json({
    ...order, measurements: JSON.parse(order.measurements), designer, serviceFeeCharged, serviceFee,
    changes_wanted: order.changes_wanted ? JSON.parse(order.changes_wanted) : []
  });
});

app.get('/api/designers/:id/orders', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE designer_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(orders.map(o => ({ ...o, measurements: JSON.parse(o.measurements) })));
});

const STATUS_FLOW = ['requested', 'quoted', 'confirmed', 'in_progress', 'ready_for_pickup', 'completed'];

app.patch('/api/orders/:id/status', (req, res) => {
  const { status, quotedPrice } = req.body;
  if (!STATUS_FLOW.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare(`
    UPDATE orders SET status = ?, quoted_price = COALESCE(?, quoted_price), updated_at = datetime('now') WHERE id = ?
  `).run(status, quotedPrice || null, req.params.id);

  if (order.customer_user_id && status !== order.status) {
    const designer = db.prepare('SELECT name FROM designers WHERE id = ?').get(order.designer_id);
    const STATUS_NOTIFICATIONS = {
      quoted: `${designer.name} set a price for your order 💰`,
      confirmed: `${designer.name} confirmed your order! 🎉`,
      in_progress: `${designer.name} started working on your order ✂️`,
      ready_for_pickup: `Your order from ${designer.name} is ready! 📦`,
      completed: `${designer.name} completed your order! 🥳`
    };
    if (STATUS_NOTIFICATIONS[status]) {
      notify('customer', order.customer_user_id, STATUS_NOTIFICATIONS[status], `/track.html?id=${order.id}`);
    }
  }

  res.json({ ok: true });
});

app.get('/api/status-flow', (_req, res) => res.json(STATUS_FLOW));

// ---- Messages (order-scoped chat, quote cards, photo progress updates) ----

app.get('/api/orders/:id/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages WHERE order_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(rows.map(m => ({ ...m, quote_breakdown: m.quote_breakdown ? JSON.parse(m.quote_breakdown) : null })));
});

app.post('/api/orders/:id/messages', (req, res) => {
  const { sender, kind, body, photoUrl, quoteAmount, quoteBreakdown, quoteReadyBy } = req.body;
  if (!['customer', 'designer'].includes(sender)) return res.status(400).json({ error: 'sender must be customer or designer' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const messageKind = kind || 'text';
  if (messageKind === 'quote' && !quoteAmount) return res.status(400).json({ error: 'quoteAmount is required for a quote message' });
  if (messageKind === 'photo' && !photoUrl) return res.status(400).json({ error: 'photoUrl is required for a photo update' });
  if (messageKind === 'text' && !body) return res.status(400).json({ error: 'body is required for a text message' });

  const info = db.prepare(`
    INSERT INTO messages (order_id, sender, kind, body, photo_url, quote_amount, quote_breakdown, quote_ready_by, quote_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, sender, messageKind, body || null, photoUrl || null,
    quoteAmount || null, quoteBreakdown ? JSON.stringify(quoteBreakdown) : null, quoteReadyBy || null,
    messageKind === 'quote' ? 'pending' : null
  );

  const designer = db.prepare('SELECT name FROM designers WHERE id = ?').get(order.designer_id);
  if (sender === 'designer' && order.customer_user_id) {
    const MSG_NOTIFICATIONS = {
      photo: `${designer.name} shared a progress photo 📸`,
      quote: `${designer.name} sent you a quote 💰`,
      text: `${designer.name} sent you a message 💬`
    };
    notify('customer', order.customer_user_id, MSG_NOTIFICATIONS[messageKind], `/messages.html?orderId=${order.id}&as=customer`);
  } else if (sender === 'customer') {
    notify('designer', order.designer_id, `New message from ${order.customer_name} 💬`, `/messages.html?orderId=${order.id}&as=designer`);
  }

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.patch('/api/messages/:id/quote-response', (req, res) => {
  const { response } = req.body; // 'accepted' | 'declined'
  if (!['accepted', 'declined'].includes(response)) return res.status(400).json({ error: 'response must be accepted or declined' });
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!message || message.kind !== 'quote') return res.status(404).json({ error: 'Quote message not found' });

  db.prepare('UPDATE messages SET quote_status = ? WHERE id = ?').run(response, req.params.id);

  if (response === 'accepted') {
    db.prepare(`UPDATE orders SET quoted_price = ?, status = CASE WHEN status = 'requested' THEN 'quoted' ELSE status END, updated_at = datetime('now') WHERE id = ?`)
      .run(message.quote_amount, message.order_id);
  }

  res.json({ ok: true });
});

// ---- Designer dashboard analytics ----

app.get('/api/designers/:id/analytics', (req, res) => {
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });

  const revenueThisMonth = db.prepare(`
    SELECT COALESCE(SUM(quoted_price), 0) AS total FROM orders
    WHERE designer_id = ? AND status = 'completed' AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')
  `).get(req.params.id).total;

  const activeOrders = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE designer_id = ? AND status != 'completed'`).get(req.params.id).c;
  const newRequests = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE designer_id = ? AND status = 'requested'`).get(req.params.id).c;

  const dueThisWeek = db.prepare(`
    SELECT COUNT(*) AS c FROM orders
    WHERE designer_id = ? AND status != 'completed'
    AND julianday(created_at, '+' || ? || ' days') - julianday('now') BETWEEN 0 AND 7
  `).get(req.params.id, designer.turnaround_days).c;

  res.json({
    revenueThisMonth,
    activeOrders,
    newRequests,
    dueThisWeek,
    rating: designer.rating,
    reviewsCount: designer.reviews_count
  });
});

// ---- Reviews & trust stats ----

const REVIEW_CATEGORIES = ['quality', 'fit', 'communication', 'accuracy', 'value', 'on_time'];

app.get('/api/orders/:id/review', (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE order_id = ?').get(req.params.id);
  res.json(review || null);
});

app.post('/api/orders/:id/review', (req, res) => {
  const { quality, fit, communication, accuracy, value, onTime, wouldReorder, comment, photoUrl } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'completed') return res.status(400).json({ error: 'Only completed orders can be reviewed' });

  const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(req.params.id);
  if (existing) return res.status(400).json({ error: 'This order has already been reviewed' });

  const scores = { quality, fit, communication, accuracy, value, on_time: onTime };
  for (const key of REVIEW_CATEGORIES) {
    const v = Number(scores[key]);
    if (!v || v < 1 || v > 5) return res.status(400).json({ error: `${key} must be rated 1-5` });
  }

  const info = db.prepare(`
    INSERT INTO reviews (order_id, designer_id, customer_name, quality, fit, communication, accuracy, value, on_time, would_reorder, comment, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, order.designer_id, order.customer_name,
    scores.quality, scores.fit, scores.communication, scores.accuracy, scores.value, scores.on_time,
    wouldReorder ? 1 : 0, comment || null, photoUrl || null
  );

  // Roll the new review into the designer's overall rating/count so the
  // profile reflects real, verified feedback over time.
  const avgOfCategories = (scores.quality + scores.fit + scores.communication + scores.accuracy + scores.value + scores.on_time) / 6;
  const designer = db.prepare('SELECT rating, reviews_count FROM designers WHERE id = ?').get(order.designer_id);
  const newCount = designer.reviews_count + 1;
  const newRating = ((designer.rating * designer.reviews_count) + avgOfCategories) / newCount;
  db.prepare('UPDATE designers SET rating = ?, reviews_count = ? WHERE id = ?').run(Math.round(newRating * 10) / 10, newCount, order.designer_id);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.get('/api/designers/:id/reviews', (req, res) => {
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });

  const reviews = db.prepare('SELECT * FROM reviews WHERE designer_id = ? ORDER BY created_at DESC').all(req.params.id);

  const totalOrders = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE designer_id = ?').get(req.params.id).c;
  const completedOrders = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE designer_id = ? AND status = 'completed'`).get(req.params.id).c;
  const onTimeCompleted = db.prepare(`
    SELECT COUNT(*) AS c FROM orders
    WHERE designer_id = ? AND status = 'completed'
    AND julianday(updated_at) <= julianday(created_at, '+' || ? || ' days')
  `).get(req.params.id, designer.turnaround_days).c;

  const categoryAverages = {};
  REVIEW_CATEGORIES.forEach(cat => {
    categoryAverages[cat] = reviews.length ? Math.round((reviews.reduce((sum, r) => sum + r[cat], 0) / reviews.length) * 10) / 10 : null;
  });

  const wouldReorderCount = reviews.filter(r => r.would_reorder).length;

  res.json({
    reviews,
    stats: {
      verifiedReviewCount: reviews.length,
      categoryAverages,
      wouldReorderPct: reviews.length ? Math.round((wouldReorderCount / reviews.length) * 100) : null,
      completionRate: totalOrders ? Math.round((completedOrders / totalOrders) * 100) : null,
      onTimeRate: completedOrders ? Math.round((onTimeCompleted / completedOrders) * 100) : null,
      totalOrders,
      completedOrders
    }
  });
});

// ---- Group orders ----

function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

app.post('/api/group-orders', (req, res) => {
  const { designerId, title, garmentType, organizerName, organizerPhone, deadline, budgetNote } = req.body;
  if (!designerId || !title || !garmentType || !organizerName || !organizerPhone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(designerId);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  if (!GARMENTS[garmentType]) return res.status(400).json({ error: 'Unknown garment type' });

  let joinCode;
  do { joinCode = generateJoinCode(); } while (db.prepare('SELECT id FROM group_orders WHERE join_code = ?').get(joinCode));

  const info = db.prepare(`
    INSERT INTO group_orders (designer_id, title, garment_type, organizer_name, organizer_phone, deadline, budget_note, join_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(designerId, title, garmentType, organizerName, organizerPhone, deadline || null, budgetNote || null, joinCode);

  res.status(201).json({ id: Number(info.lastInsertRowid), joinCode });
});

app.get('/api/group-orders/code/:code', (req, res) => {
  const group = db.prepare('SELECT * FROM group_orders WHERE join_code = ?').get(req.params.code.toUpperCase());
  if (!group) return res.status(404).json({ error: 'Group order not found — check the code' });
  const designer = db.prepare('SELECT id, name, location, swatch, image_url FROM designers WHERE id = ?').get(group.designer_id);
  const memberCount = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE group_order_id = ?').get(group.id).c;
  res.json({ ...group, designer, memberCount });
});

app.get('/api/group-orders/:id', (req, res) => {
  const group = db.prepare('SELECT * FROM group_orders WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group order not found' });
  const designer = db.prepare('SELECT id, name, location, swatch, image_url FROM designers WHERE id = ?').get(group.designer_id);
  const members = db.prepare('SELECT * FROM orders WHERE group_order_id = ? ORDER BY created_at ASC').all(req.params.id)
    .map(o => ({ ...o, measurements: JSON.parse(o.measurements) }));
  res.json({ ...group, designer, members });
});

app.get('/api/designers/:id/group-orders', (req, res) => {
  const groups = db.prepare('SELECT * FROM group_orders WHERE designer_id = ? ORDER BY created_at DESC').all(req.params.id);
  const withCounts = groups.map(g => ({
    ...g,
    memberCount: db.prepare('SELECT COUNT(*) AS c FROM orders WHERE group_order_id = ?').get(g.id).c
  }));
  res.json(withCounts);
});

app.patch('/api/group-orders/:id', (req, res) => {
  const { status } = req.body;
  if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be open or closed' });
  const group = db.prepare('SELECT * FROM group_orders WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group order not found' });
  db.prepare('UPDATE group_orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// ---- Appointments ----

const APPOINTMENT_TYPES = ['consultation', 'measurement', 'fitting', 'fabric_selection', 'collection'];

app.post('/api/appointments', (req, res) => {
  const { designerId, customerName, customerPhone, type, slotDate, slotTime, locationType, address, notes } = req.body;
  if (!designerId || !customerName || !customerPhone || !type || !slotDate || !slotTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!APPOINTMENT_TYPES.includes(type)) return res.status(400).json({ error: 'Unknown appointment type' });
  if (locationType === 'home' && !address) return res.status(400).json({ error: 'Address is required for a home visit' });

  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(designerId);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });

  const info = db.prepare(`
    INSERT INTO appointments (designer_id, customer_name, customer_phone, type, slot_date, slot_time, location_type, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(designerId, customerName, customerPhone, type, slotDate, slotTime, locationType || 'studio', address || null, notes || null);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.get('/api/designers/:id/appointments', (req, res) => {
  const rows = db.prepare('SELECT * FROM appointments WHERE designer_id = ? ORDER BY slot_date ASC, slot_time ASC').all(req.params.id);
  res.json(rows);
});

app.get('/api/appointments/:id', (req, res) => {
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  const designer = db.prepare('SELECT id, name, location FROM designers WHERE id = ?').get(appt.designer_id);
  res.json({ ...appt, designer });
});

app.patch('/api/appointments/:id', (req, res) => {
  const { status, slotDate, slotTime } = req.body;
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  if (status && !['requested', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare(`
    UPDATE appointments SET status = COALESCE(?, status), slot_date = COALESCE(?, slot_date), slot_time = COALESCE(?, slot_time) WHERE id = ?
  `).run(status || null, slotDate || null, slotTime || null, req.params.id);
  res.json({ ok: true });
});

// ---- Ready-to-wear shop ----

app.get('/api/shop-items', (req, res) => {
  const { designerId, garmentType, inStockOnly } = req.query;
  let sql = `
    SELECT s.*, d.name AS designer_name, d.location AS designer_location, d.swatch AS designer_swatch
    FROM shop_items s JOIN designers d ON d.id = s.designer_id WHERE 1=1
  `;
  const params = [];
  if (designerId) { sql += ' AND s.designer_id = ?'; params.push(designerId); }
  if (garmentType) { sql += ' AND s.garment_type = ?'; params.push(garmentType); }
  if (inStockOnly === 'true') { sql += ' AND s.stock > 0'; }
  sql += ' ORDER BY s.stock > 0 DESC, s.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/shop-items/:id', (req, res) => {
  const item = db.prepare(`
    SELECT s.*, d.name AS designer_name, d.location AS designer_location, d.swatch AS designer_swatch
    FROM shop_items s JOIN designers d ON d.id = s.designer_id WHERE s.id = ?
  `).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

app.post('/api/designers/:id/shop-items', (req, res) => {
  const { title, imageUrl, garmentType, size, price, stock } = req.body;
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  if (!title || !size || !price) return res.status(400).json({ error: 'title, size, and price are required' });

  const info = db.prepare(`
    INSERT INTO shop_items (designer_id, title, image_url, swatch, garment_type, size, price, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, title, imageUrl || null, designer.swatch, garmentType || null, size, price, stock || 1);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.post('/api/shop-items/:id/purchase', (req, res) => {
  const { customerName, customerPhone, deliveryAddress, customerCountry, deliveryCountry } = req.body;
  if (!customerName || !customerPhone || !deliveryAddress) {
    return res.status(400).json({ error: 'Name, phone, and delivery address are required' });
  }
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.stock <= 0) return res.status(400).json({ error: 'This item is sold out' });

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE shop_items SET stock = stock - 1 WHERE id = ?').run(item.id);
    const info = db.prepare(`
      INSERT INTO orders (
        designer_id, customer_name, customer_phone, garment_type, measurements, recommended_size, fit_note,
        status, quoted_price, order_type, shop_item_id, customer_country, delivery_country, delivery_address
      )
      VALUES (?, ?, ?, ?, '{}', ?, 'Ready-to-wear listed size', 'requested', ?, 'ready_to_wear', ?, ?, ?, ?)
    `).run(
      item.designer_id, customerName, customerPhone, item.garment_type || 'ready_to_wear', item.size,
      item.price, item.id, customerCountry || 'Ghana', deliveryCountry || 'Ghana', deliveryAddress
    );
    db.exec('COMMIT');
    res.status(201).json({ orderId: Number(info.lastInsertRowid) });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Purchase failed, please try again' });
  }
});

// ---- Style requests (photo-based + reverse-matching marketplace) ----
// A customer posts a reference photo + brief; any interested designer
// can submit a quote against it, rather than the customer having to
// pick a designer first.

const CHANGE_OPTIONS = ['different_fabric', 'longer_sleeves', 'different_neckline', 'different_colour', 'less_fitted', 'add_embroidery', 'make_similar'];

app.post('/api/style-requests', (req, res) => {
  const { customerName, customerPhone, garmentType, category, referenceImageUrl, changesWanted, changesCustom, notes, location, budgetMin, budgetMax, deadline } = req.body;
  if (!customerName || !customerPhone) return res.status(400).json({ error: 'Name and phone are required' });

  const info = db.prepare(`
    INSERT INTO style_requests (customer_name, customer_phone, garment_type, category, reference_image_url, changes_wanted, changes_custom, notes, location, budget_min, budget_max, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customerName, customerPhone, garmentType || null, category || null, referenceImageUrl || null,
    JSON.stringify((changesWanted || []).filter(c => CHANGE_OPTIONS.includes(c))), changesCustom || null,
    notes || null, location || null, budgetMin || null, budgetMax || null, deadline || null
  );

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.get('/api/style-requests', (req, res) => {
  const { category, garmentType, status } = req.query;
  let sql = 'SELECT * FROM style_requests WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (garmentType) { sql += ' AND garment_type = ?'; params.push(garmentType); }
  sql += ' AND status = ?'; params.push(status || 'open');
  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params).map(r => ({ ...r, changes_wanted: r.changes_wanted ? JSON.parse(r.changes_wanted) : [] }));
  const withQuoteCounts = rows.map(r => ({ ...r, quoteCount: db.prepare('SELECT COUNT(*) AS c FROM style_request_quotes WHERE request_id = ?').get(r.id).c }));
  res.json(withQuoteCounts);
});

app.get('/api/style-requests/:id', (req, res) => {
  const request = db.prepare('SELECT * FROM style_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  const quotes = db.prepare(`
    SELECT q.*, d.name AS designer_name, d.rating AS designer_rating, d.location AS designer_location, d.swatch AS designer_swatch, d.image_url AS designer_image_url, d.verified AS designer_verified
    FROM style_request_quotes q JOIN designers d ON d.id = q.designer_id
    WHERE q.request_id = ? ORDER BY q.created_at ASC
  `).all(req.params.id);
  res.json({ ...request, changes_wanted: request.changes_wanted ? JSON.parse(request.changes_wanted) : [], quotes });
});

app.post('/api/style-requests/:id/quotes', (req, res) => {
  const { designerId, amount, note, readyBy } = req.body;
  if (!designerId || !amount) return res.status(400).json({ error: 'designerId and amount are required' });
  const request = db.prepare('SELECT * FROM style_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'open') return res.status(400).json({ error: 'This request is no longer open' });

  const existing = db.prepare('SELECT id FROM style_request_quotes WHERE request_id = ? AND designer_id = ?').get(req.params.id, designerId);
  if (existing) return res.status(400).json({ error: 'You already submitted a quote for this request' });

  const info = db.prepare(`
    INSERT INTO style_request_quotes (request_id, designer_id, amount, note, ready_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, designerId, amount, note || null, readyBy || null);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.post('/api/style-requests/:id/quotes/:quoteId/accept', (req, res) => {
  const request = db.prepare('SELECT * FROM style_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  const quote = db.prepare('SELECT * FROM style_request_quotes WHERE id = ? AND request_id = ?').get(req.params.quoteId, req.params.id);
  if (!quote) return res.status(404).json({ error: 'Quote not found' });

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE style_requests SET status = 'closed', accepted_designer_id = ? WHERE id = ?`).run(quote.designer_id, req.params.id);
    db.prepare(`UPDATE style_request_quotes SET status = 'accepted' WHERE id = ?`).run(quote.id);
    db.prepare(`UPDATE style_request_quotes SET status = 'declined' WHERE request_id = ? AND id != ?`).run(req.params.id, quote.id);
    db.exec('COMMIT');
    res.json({ ok: true, designerId: quote.designer_id });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Could not accept this quote' });
  }
});

app.get('/api/designers/:id/style-requests', (req, res) => {
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  const rows = db.prepare(`SELECT * FROM style_requests WHERE status = 'open' AND (category IS NULL OR category = ?) ORDER BY created_at DESC`).all(designer.category)
    .map(r => ({ ...r, changes_wanted: r.changes_wanted ? JSON.parse(r.changes_wanted) : [] }));
  const withMyQuote = rows.map(r => ({
    ...r,
    myQuote: db.prepare('SELECT * FROM style_request_quotes WHERE request_id = ? AND designer_id = ?').get(r.id, req.params.id) || null
  }));
  res.json(withMyQuote);
});

// ---- Designer matching quiz ("Find My Designer") ----

app.post('/api/designer-match', (req, res) => {
  const { garmentType, budgetMin, budgetMax, timeframeDays, location, stylePreference } = req.body;

  let sql = 'SELECT * FROM designers WHERE 1=1';
  const params = [];
  if (garmentType) {
    // designers don't store which garments they make directly, so match via
    // their portfolio's garment types as a proxy for capability.
    sql += ` AND id IN (SELECT designer_id FROM portfolio_items WHERE garment_type = ?)`;
    params.push(garmentType);
  }
  const candidates = db.prepare(sql).all(...params);

  const scored = candidates.map(d => {
    let score = 0;
    const reasons = [];

    if (budgetMin && budgetMax) {
      const overlap = Math.min(d.price_max, budgetMax) - Math.max(d.price_min, budgetMin);
      if (overlap >= 0) { score += 25; reasons.push('Fits your budget'); }
      else score += 5;
    } else {
      score += 15;
    }

    if (timeframeDays) {
      if (d.turnaround_days <= timeframeDays) { score += 25; reasons.push(`Can deliver in ${d.turnaround_days} days`); }
      else score += 5;
    } else {
      score += 15;
    }

    if (location && d.location.toLowerCase().includes(location.toLowerCase())) {
      score += 20; reasons.push('Near you');
    } else if (!location) {
      score += 10;
    }

    if (stylePreference && d.specialties.toLowerCase().includes(stylePreference.toLowerCase())) {
      score += 15; reasons.push('Matches your style');
    } else if (!stylePreference) {
      score += 8;
    }

    score += Math.min(d.rating * 3, 15);
    if (d.verified) { score += 5; reasons.push('Verified'); }
    if (d.availability === 'accepting') { score += 5; }
    else if (d.availability === 'booked') { score -= 15; reasons.push('Currently fully booked'); }

    return { ...d, matchPercent: Math.max(5, Math.min(99, Math.round(score))), matchReasons: reasons };
  });

  scored.sort((a, b) => b.matchPercent - a.matchPercent);
  res.json(scored.slice(0, 6));
});

// Metadata-based "similar work" matching — NOT true image recognition.
// It matches on garment type / category against what designers have
// actually made before (their portfolio), so results are real past work,
// even though the matching itself is by category rather than visual
// similarity. Used by the merged "Find a designer / post a request" flow
// when the customer uploads an inspiration photo.
app.get('/api/similar-work', (req, res) => {
  const { garmentType, category } = req.query;
  if (!garmentType && !category) return res.json([]);

  let sql = `
    SELECT p.id, p.title, p.image_url, p.garment_type, p.price_from,
           d.id AS designer_id, d.name AS designer_name, d.category AS designer_category,
           d.location AS designer_location, d.rating AS designer_rating, d.swatch AS designer_swatch, d.verified
    FROM portfolio_items p JOIN designers d ON d.id = p.designer_id WHERE 1=1
  `;
  const params = [];
  if (garmentType) { sql += ' AND p.garment_type = ?'; params.push(garmentType); }
  if (category) { sql += ' AND d.category = ?'; params.push(category); }
  sql += ' ORDER BY d.verified DESC, d.rating DESC LIMIT 6';

  res.json(db.prepare(sql).all(...params));
});

// ---- Payments (simulated — this prototype has no live payment processor
// credentials, so "processing" always succeeds after a short delay on the
// client. No real money moves. Supports full or deposit payments.) ----

function generateReference(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// Anti-scam gate: payment only unlocks once production has actually started
// (status is in_progress or later) AND the designer has shared at least one
// in-app progress photo. This stops customers being asked to pay upfront
// before any real work or communication has happened.
const PAYMENT_ELIGIBLE_STATUSES = ['in_progress', 'ready_for_pickup', 'completed'];

function checkPaymentEligibility(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { eligible: false, reason: 'Order not found' };
  if (!order.quoted_price) return { eligible: false, reason: 'This order has no quoted price yet.' };
  if (!PAYMENT_ELIGIBLE_STATUSES.includes(order.status)) {
    return { eligible: false, reason: 'Payment unlocks once your designer starts production. This protects you from paying before any work has begun.' };
  }
  const hasProgressPhoto = db.prepare(`SELECT id FROM messages WHERE order_id = ? AND sender = 'designer' AND kind = 'photo' LIMIT 1`).get(orderId);
  if (!hasProgressPhoto) {
    return { eligible: false, reason: "Payment unlocks once your designer has shared a progress photo in the chat. Message them to check in — this protects you from scams." };
  }
  return { eligible: true, reason: null };
}

app.get('/api/orders/:id/payment-eligibility', (req, res) => {
  res.json(checkPaymentEligibility(req.params.id));
});

app.post('/api/orders/:id/pay', (req, res) => {
  const { method, provider, amount, payerDetail } = req.body;
  if (!['card', 'momo', 'paypal'].includes(method)) return res.status(400).json({ error: 'Unknown payment method' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!order.quoted_price) return res.status(400).json({ error: 'This order has no quoted price yet' });

  const eligibility = checkPaymentEligibility(req.params.id);
  if (!eligibility.eligible) return res.status(400).json({ error: eligibility.reason });

  const remaining = order.quoted_price - order.amount_paid;
  if (amount > remaining) return res.status(400).json({ error: `Amount exceeds remaining balance of GH₵${remaining}` });

  const reference = generateReference(method.toUpperCase());
  // Flat, tiered fee based on the order's TOTAL value (not the amount being
  // paid right now) — and only charged once per order, even if the customer
  // pays in a deposit + balance rather than all at once.
  const alreadyChargedFee = db.prepare(`SELECT id FROM payments WHERE order_id = ? AND method = 'platform_fee'`).get(req.params.id);
  const serviceFee = alreadyChargedFee ? 0 : getServiceFee(order.quoted_price);

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO payments (order_id, method, provider, amount, status, reference, payer_detail)
      VALUES (?, ?, ?, ?, 'completed', ?, ?)
    `).run(req.params.id, method, provider || null, amount, reference, payerDetail || null);
    if (serviceFee > 0) {
      db.prepare(`
        INSERT INTO payments (order_id, method, provider, amount, status, reference, payer_detail)
        VALUES (?, 'platform_fee', 'Service fee', ?, 'completed', ?, ?)
      `).run(req.params.id, serviceFee, reference + '-fee', 'In-app service fee');
    }

    const newPaid = order.amount_paid + amount;
    const newStatus = newPaid >= order.quoted_price ? 'paid' : 'partial';
    db.prepare(`UPDATE orders SET amount_paid = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newPaid, newStatus, req.params.id);

    db.exec('COMMIT');
    notify('designer', order.designer_id, `${order.customer_name} paid GH₵${amount} for order #${order.id} 💵`, '/dashboard.html');
    res.status(201).json({ reference, amountPaid: newPaid, paymentStatus: newStatus, remaining: order.quoted_price - newPaid, serviceFee, totalCharged: amount + serviceFee });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Payment could not be recorded' });
  }
});

// ---- Real Paystack mobile money (MTN / AirtelTigo / Telecel) ----
// This is a genuine integration, not a simulation — see server.js top of
// file for the .env-based key setup. Charging is asynchronous: the
// customer authorizes on their phone, so this endpoint returns quickly
// with a "check your phone" message rather than a final result. The
// frontend then either waits for the webhook (production, public HTTPS
// URL) or polls /api/paystack/verify (works anywhere, including
// localhost, since it's an outbound request from your server to
// Paystack rather than an inbound one).

app.get('/api/paystack/status', (_req, res) => {
  res.json({ configured: !!PAYSTACK_SECRET_KEY });
});

// ---- Automatic payment splitting ----
// Each designer who sets up a payout account gets a real Paystack
// "subaccount" tied to their own mobile money number. From then on, every
// charge for their orders tells Paystack exactly how much of that specific
// payment should stay with the platform (using the commission rate active
// at that moment) — the rest routes to the designer automatically, inside
// Paystack, before it ever reaches your balance. Designers without a
// payout account set up still work exactly as before (100% comes to the
// platform, to be paid out manually) — nothing breaks for them.

app.get('/api/paystack/banks', async (req, res) => {
  if (!PAYSTACK_SECRET_KEY) return res.status(400).json({ error: 'Paystack is not configured' });
  try {
    const result = await paystackRequest('/bank?country=ghana&currency=GHS&perPage=100', 'GET');
    if (!result.body.status) return res.status(400).json({ error: result.body.message });
    res.json(result.body.data.map(b => ({ name: b.name, code: b.code })));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/designers/:id/payout-account', async (req, res) => {
  if (!PAYSTACK_SECRET_KEY) return res.status(400).json({ error: 'Paystack is not configured on this server yet' });
  const { bankCode, bankName, accountNumber } = req.body;
  if (!bankCode || !accountNumber) return res.status(400).json({ error: 'bankCode and accountNumber are required' });

  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });

  // This percentage_charge is just the subaccount's fallback default —
  // every real charge below always overrides it with the correct tiered
  // rate for that specific order via `transaction_charge`, so this value
  // is rarely if ever actually used. The smallest-order (highest) rate is
  // used here as a conservative placeholder.
  const defaultCommissionRate = getCommissionRate(0);

  try {
    const result = await paystackRequest('/subaccount', 'POST', {
      business_name: designer.name,
      settlement_bank: bankCode,
      bank_code: bankCode, // sent alongside settlement_bank — Paystack's docs are inconsistent about which name they read
      account_number: accountNumber,
      percentage_charge: defaultCommissionRate
    });
    if (!result.body.status) return res.status(400).json({ error: result.body.message || 'Could not verify that account with Paystack' });

    const data = result.body.data;
    db.prepare(`
      UPDATE designers SET paystack_subaccount_code = ?, payout_bank_code = ?, payout_bank_name = ?, payout_account_number = ?, payout_account_name = ?
      WHERE id = ?
    `).run(data.subaccount_code, bankCode, bankName || data.settlement_bank, accountNumber, data.account_name, req.params.id);

    res.status(201).json({ subaccountCode: data.subaccount_code, accountName: data.account_name });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/designers/:id/payout-status', (req, res) => {
  const designer = db.prepare('SELECT paystack_subaccount_code, payout_bank_name, payout_account_number, payout_account_name FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  res.json({
    connected: !!designer.paystack_subaccount_code,
    bankName: designer.payout_bank_name,
    accountNumber: designer.payout_account_number,
    accountName: designer.payout_account_name
  });
});

app.post('/api/orders/:id/pay-momo-live', async (req, res) => {
  if (!PAYSTACK_SECRET_KEY) return res.status(400).json({ error: 'Paystack is not configured on this server yet — add PAYSTACK_SECRET_KEY to .env' });

  const { amount, phone, network } = req.body;
  const providerCode = PAYSTACK_PROVIDER_CODES[network];
  if (!providerCode) return res.status(400).json({ error: 'network must be mtn, airteltigo, or telecel' });
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!order.quoted_price) return res.status(400).json({ error: 'This order has no quoted price yet' });

  const eligibility = checkPaymentEligibility(req.params.id);
  if (!eligibility.eligible) return res.status(400).json({ error: eligibility.reason });

  const remaining = order.quoted_price - order.amount_paid;
  if (amount > remaining) return res.status(400).json({ error: `Amount exceeds remaining balance of GH₵${remaining}` });

  // Paystack requires an email even for a mobile-money-only charge; this
  // app doesn't always have one (guest checkout), so fall back to a
  // clearly-synthetic placeholder that's never actually emailed anywhere.
  const account = order.customer_user_id ? db.prepare('SELECT email FROM users WHERE id = ?').get(order.customer_user_id) : null;
  const email = (account && account.email) || `order${order.id}@atadee-guest.com`;

  const designer = db.prepare('SELECT paystack_subaccount_code FROM designers WHERE id = ?').get(order.designer_id);

  // The customer pays the order amount PLUS a small in-app service fee
  // (covers Paystack's own processing cost and general overhead) — the fee
  // is never part of what the designer is owed for the garment. Both the
  // commission rate and the fee are looked up from the order's TOTAL value
  // (not today's payment amount) using the tiered tables set in admin →
  // Finance, and the flat fee is only charged once per order — a customer
  // paying a deposit then the balance later isn't charged it twice.
  const alreadyChargedFee = db.prepare(`SELECT id FROM payments WHERE order_id = ? AND method = 'platform_fee'`).get(req.params.id);
  const serviceFee = alreadyChargedFee ? 0 : getServiceFee(order.quoted_price);

  const orderPesewas = Math.round(amount * 100);
  const serviceFeePesewas = Math.round(serviceFee * 100);
  const totalPesewas = orderPesewas + serviceFeePesewas;

  const chargePayload = {
    email, amount: totalPesewas, currency: 'GHS',
    mobile_money: { phone, provider: providerCode },
    metadata: { orderId: order.id, orderAmountPesewas: orderPesewas }
  };

  // If this designer has connected a payout account, split automatically:
  // the designer gets their exact, full share of the ORDER amount (their
  // agreed percentage, at today's tiered commission rate) — completely
  // unaffected by the service fee or by Paystack's own processing fee.
  // Both of those are the platform's to absorb, out of its own now-larger
  // share (commission + service fee), which is the whole point of
  // charging the service fee in the first place.
  if (designer.paystack_subaccount_code) {
    const commissionRate = getCommissionRate(order.quoted_price);
    const commissionPesewas = Math.round(orderPesewas * commissionRate / 100);
    chargePayload.subaccount = designer.paystack_subaccount_code;
    chargePayload.transaction_charge = commissionPesewas + serviceFeePesewas; // platform's full cut
    // bearer intentionally left as default ('account') — the platform
    // absorbs Paystack's fee now, not the designer.
  }

  try {
    const result = await paystackRequest('/charge', 'POST', chargePayload);
    if (!result.body.status) return res.status(400).json({ error: result.body.message || 'Paystack rejected this charge' });

    res.status(201).json({
      reference: result.body.data.reference,
      status: result.body.data.status,
      displayText: result.body.data.display_text || 'Please complete authorization on your phone',
      orderAmount: amount, serviceFee: serviceFeePesewas / 100, totalCharged: totalPesewas / 100
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/paystack/verify/:reference', async (req, res) => {
  if (!PAYSTACK_SECRET_KEY) return res.status(400).json({ error: 'Paystack is not configured' });
  try {
    const result = await paystackRequest(`/transaction/verify/${encodeURIComponent(req.params.reference)}`, 'GET');
    const data = result.body.data;
    if (!data) return res.status(400).json({ status: 'unknown', error: result.body.message });

    if (data.status === 'success') {
      const outcome = finalizePaystackPayment({
        reference: data.reference, orderId: data.metadata && data.metadata.orderId,
        amountPesewas: data.amount, orderAmountPesewas: data.metadata && data.metadata.orderAmountPesewas,
        provider: (data.authorization && data.authorization.bank) || 'Mobile Money'
      });
      return res.json({ status: 'success', ...outcome });
    }
    res.json({ status: data.status, message: data.gateway_response });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/paystack/webhook', (req, res) => {
  // Ack fast — Paystack times out and retries if we take too long, and
  // long-running work here would block that. Always 200 unless the
  // signature itself is invalid.
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) return res.sendStatus(401);
  res.sendStatus(200);

  const event = req.body;
  if (event.event === 'charge.success' && event.data && event.data.metadata && event.data.metadata.orderId) {
    finalizePaystackPayment({
      reference: event.data.reference, orderId: event.data.metadata.orderId,
      amountPesewas: event.data.amount, orderAmountPesewas: event.data.metadata.orderAmountPesewas,
      provider: (event.data.authorization && event.data.authorization.bank) || 'Mobile Money'
    });
  }
});

app.get('/api/orders/:id/payments', (req, res) => {
  const rows = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(rows);
});

// ---- Designer creation & onboarding ----

app.post('/api/designers', (req, res) => {
  const { name, category, specialties, location, priceMin, priceMax, turnaroundDays, bio, phone } = req.body;
  if (!name || !category || !location || !priceMin || !priceMax || !turnaroundDays) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const swatches = ['#7A1E2B', '#1B1A55', '#C1272D', '#D4A017', '#2F6E51'];
  const swatch = swatches[Math.floor(Math.random() * swatches.length)];

  const info = db.prepare(`
    INSERT INTO designers (name, category, specialties, location, price_min, price_max, rating, reviews_count, turnaround_days, bio, swatch, ships_internationally, verified, phone_verified, availability, approval_status)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 1, 0, 1, 'accepting', 'pending')
  `).run(name, category, specialties || '', location, priceMin, priceMax, turnaroundDays, bio || '', swatch);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

// ---- Smart availability ----

app.patch('/api/designers/:id/availability', (req, res) => {
  const { availability, capacityNote } = req.body;
  if (!['accepting', 'limited', 'booked'].includes(availability)) return res.status(400).json({ error: 'Invalid availability status' });
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  db.prepare('UPDATE designers SET availability = ?, capacity_note = ? WHERE id = ?').run(availability, capacityNote || null, req.params.id);
  res.json({ ok: true });
});

// ---- Designer calendar (production schedule agenda) ----

app.get('/api/designers/:id/calendar', (req, res) => {
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });

  const orders = db.prepare(`SELECT * FROM orders WHERE designer_id = ? AND status != 'completed'`).all(req.params.id);
  const orderEvents = orders.map(o => ({
    type: 'order_due',
    date: new Date(new Date(o.created_at.replace(' ', 'T') + 'Z').getTime() + designer.turnaround_days * 86400000).toISOString().slice(0, 10),
    title: `${o.garment_type.replace('_', ' ')} — ${o.customer_name}`,
    orderId: o.id,
    status: o.status
  }));

  const appts = db.prepare(`SELECT * FROM appointments WHERE designer_id = ? AND status IN ('requested','confirmed')`).all(req.params.id);
  const apptEvents = appts.map(a => ({
    type: 'appointment',
    date: a.slot_date,
    time: a.slot_time,
    title: `${a.type.replace('_', ' ')} — ${a.customer_name}`,
    appointmentId: a.id,
    status: a.status
  }));

  const events = [...orderEvents, ...apptEvents].sort((a, b) => a.date.localeCompare(b.date));
  res.json(events);
});

// ---- Simple CRM (customer history) ----

app.get('/api/designers/:id/customers', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE designer_id = ? ORDER BY created_at ASC').all(req.params.id);
  const byPhone = {};
  for (const o of orders) {
    const key = o.customer_phone;
    if (!byPhone[key]) byPhone[key] = { customerName: o.customer_name, customerPhone: key, orders: [], totalSpent: 0 };
    byPhone[key].orders.push({ id: o.id, garmentType: o.garment_type, status: o.status, createdAt: o.created_at });
    byPhone[key].totalSpent += o.amount_paid || 0;
  }
  const customers = Object.values(byPhone).map(c => ({
    ...c,
    orderCount: c.orders.length,
    isRepeat: c.orders.length > 1,
    lastOrderDate: c.orders[c.orders.length - 1].createdAt,
    favoriteGarment: Object.entries(c.orders.reduce((acc, o) => { acc[o.garmentType] = (acc[o.garmentType] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0]
  })).sort((a, b) => b.lastOrderDate.localeCompare(a.lastOrderDate));
  res.json(customers);
});

// ---- Structured service menu ----

app.get('/api/designers/:id/services', (req, res) => {
  res.json(db.prepare('SELECT * FROM services WHERE designer_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id));
});

app.post('/api/designers/:id/services', (req, res) => {
  const { label, priceFrom } = req.body;
  if (!label || !priceFrom) return res.status(400).json({ error: 'label and priceFrom are required' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM services WHERE designer_id = ?').get(req.params.id).m;
  const info = db.prepare('INSERT INTO services (designer_id, label, price_from, sort_order) VALUES (?, ?, ?, ?)').run(req.params.id, label, priceFrom, maxOrder + 1);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.delete('/api/services/:id', (req, res) => {
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Designer stories / short posts ----

app.get('/api/designers/:id/posts', (req, res) => {
  res.json(db.prepare('SELECT * FROM designer_posts WHERE designer_id = ? ORDER BY created_at DESC').all(req.params.id));
});

app.post('/api/designers/:id/posts', (req, res) => {
  const { caption, mediaUrl, mediaType, garmentType } = req.body;
  if (!mediaUrl) return res.status(400).json({ error: 'mediaUrl is required' });
  const info = db.prepare(`
    INSERT INTO designer_posts (designer_id, caption, media_url, media_type, garment_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, caption || null, mediaUrl, mediaType || 'photo', garmentType || null);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.post('/api/posts/:id/view', (req, res) => {
  db.prepare('UPDATE designer_posts SET views_count = views_count + 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/posts/:id/like', (req, res) => {
  const { action } = req.body; // 'like' | 'unlike'
  const delta = action === 'unlike' ? -1 : 1;
  db.prepare('UPDATE designer_posts SET likes_count = MAX(0, likes_count + ?) WHERE id = ?').run(delta, req.params.id);
  const post = db.prepare('SELECT likes_count FROM designer_posts WHERE id = ?').get(req.params.id);
  res.json({ likesCount: post ? post.likes_count : 0 });
});

app.post('/api/designers/:id/view', (req, res) => {
  db.prepare('UPDATE designers SET profile_views = profile_views + 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/designers/:id/engagement', (req, res) => {
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });

  const posts = db.prepare('SELECT * FROM designer_posts WHERE designer_id = ? ORDER BY created_at DESC').all(req.params.id);
  const totalPostViews = posts.reduce((sum, p) => sum + p.views_count, 0);
  const totalPostLikes = posts.reduce((sum, p) => sum + p.likes_count, 0);

  const ordersReceived = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE designer_id = ?').get(req.params.id).c;
  const messagesReceived = db.prepare(`
    SELECT COUNT(*) AS c FROM messages m JOIN orders o ON o.id = m.order_id WHERE o.designer_id = ? AND m.sender = 'customer'
  `).get(req.params.id).c;
  const appointmentsReceived = db.prepare('SELECT COUNT(*) AS c FROM appointments WHERE designer_id = ?').get(req.params.id).c;
  const styleRequestQuotesSent = db.prepare('SELECT COUNT(*) AS c FROM style_request_quotes WHERE designer_id = ?').get(req.params.id).c;
  const fabricRequestsReceived = db.prepare('SELECT COUNT(*) AS c FROM fabric_orders WHERE designer_id = ?').get(req.params.id).c;

  res.json({
    profileViews: designer.profile_views,
    totalPostViews,
    totalPostLikes,
    postsCount: posts.length,
    posts: posts.map(p => ({ id: p.id, caption: p.caption, mediaUrl: p.media_url, views: p.views_count, likes: p.likes_count, createdAt: p.created_at })),
    ordersReceived,
    messagesReceived,
    appointmentsReceived,
    styleRequestQuotesSent,
    fabricRequestsReceived
  });
});


// ---- Sustainability profile ----

const SUS_PRACTICES = ['sus_offcuts', 'sus_recycled', 'sus_deadstock', 'sus_upcycled', 'sus_local_sourced', 'sus_low_waste_cutting', 'sus_repair_alterations'];
const SUS_BADGE_THRESHOLD = 3;

app.patch('/api/designers/:id/sustainability', (req, res) => {
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });

  const values = {};
  let count = 0;
  for (const key of SUS_PRACTICES) {
    const v = req.body[key] ? 1 : 0;
    values[key] = v;
    count += v;
  }
  const badge = count >= SUS_BADGE_THRESHOLD ? 1 : 0;

  db.prepare(`
    UPDATE designers SET
      sus_offcuts = ?, sus_recycled = ?, sus_deadstock = ?, sus_upcycled = ?,
      sus_local_sourced = ?, sus_low_waste_cutting = ?, sus_repair_alterations = ?, sustainable_badge = ?
    WHERE id = ?
  `).run(
    values.sus_offcuts, values.sus_recycled, values.sus_deadstock, values.sus_upcycled,
    values.sus_local_sourced, values.sus_low_waste_cutting, values.sus_repair_alterations, badge,
    req.params.id
  );

  res.json({ ok: true, practiceCount: count, badge: !!badge, threshold: SUS_BADGE_THRESHOLD });
});

// ---- Circular Fashion section ----

app.get('/api/circular/stats', (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM designers').get().c;
  const badgeCount = db.prepare('SELECT COUNT(*) AS c FROM designers WHERE sustainable_badge = 1').get().c;
  const practicingCount = db.prepare(`
    SELECT COUNT(*) AS c FROM designers
    WHERE sus_offcuts=1 OR sus_recycled=1 OR sus_deadstock=1 OR sus_upcycled=1 OR sus_local_sourced=1 OR sus_low_waste_cutting=1 OR sus_repair_alterations=1
  `).get().c;
  res.json({
    totalDesigners: total,
    badgeCount,
    practicingCount,
    badgePercent: total ? Math.round((badgeCount / total) * 100) : 0,
    practicingPercent: total ? Math.round((practicingCount / total) * 100) : 0,
    goalPercent: 30
  });
});

app.get('/api/circular/designers', (req, res) => {
  const { practicing } = req.query;
  const sql = practicing === 'true'
    ? `SELECT * FROM designers WHERE sus_offcuts=1 OR sus_recycled=1 OR sus_deadstock=1 OR sus_upcycled=1 OR sus_local_sourced=1 OR sus_low_waste_cutting=1 OR sus_repair_alterations=1 ORDER BY sustainable_badge DESC, rating DESC`
    : `SELECT * FROM designers WHERE sustainable_badge = 1 ORDER BY rating DESC`;
  res.json(db.prepare(sql).all());
});

app.get('/api/circular/portfolio', (req, res) => {
  const { type } = req.query; // 'upcycled' | 'offcut' | 'reworked'
  let sql = `
    SELECT p.*, d.name AS designer_name, d.location AS designer_location, d.swatch AS designer_swatch
    FROM portfolio_items p JOIN designers d ON d.id = p.designer_id
    WHERE p.circular_type IS NOT NULL
  `;
  const params = [];
  if (type) { sql += ' AND p.circular_type = ?'; params.push(type); }
  sql += ' ORDER BY p.id DESC';
  res.json(db.prepare(sql).all(...params));
});

// ---- Waste-to-Value fabric marketplace ----

app.get('/api/fabric-listings', (req, res) => {
  const { fabricType, designerId, status } = req.query;
  let sql = `
    SELECT f.*, d.name AS designer_name, d.location AS designer_location, d.swatch AS designer_swatch
    FROM fabric_listings f JOIN designers d ON d.id = f.designer_id WHERE 1=1
  `;
  const params = [];
  if (fabricType) { sql += ' AND f.fabric_type LIKE ?'; params.push(`%${fabricType}%`); }
  if (designerId) { sql += ' AND f.designer_id = ?'; params.push(designerId); }
  sql += status ? ' AND f.status = ?' : ` AND f.status = 'available'`;
  if (status) params.push(status);
  sql += ' ORDER BY f.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/fabric-listings/:id', (req, res) => {
  const listing = db.prepare(`
    SELECT f.*, d.name AS designer_name, d.location AS designer_location, d.swatch AS designer_swatch, d.phone_verified
    FROM fabric_listings f JOIN designers d ON d.id = f.designer_id WHERE f.id = ?
  `).get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  res.json(listing);
});

app.post('/api/designers/:id/fabric-listings', (req, res) => {
  const { title, description, fabricType, quantityMeters, price, imageUrl } = req.body;
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  if (!title || !fabricType || !quantityMeters || !price) return res.status(400).json({ error: 'title, fabricType, quantityMeters, and price are required' });

  const info = db.prepare(`
    INSERT INTO fabric_listings (designer_id, title, description, fabric_type, quantity_meters, price, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, title, description || null, fabricType, quantityMeters, price, imageUrl || null);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.get('/api/designers/:id/fabric-listings', (req, res) => {
  res.json(db.prepare('SELECT * FROM fabric_listings WHERE designer_id = ? ORDER BY created_at DESC').all(req.params.id));
});

app.post('/api/fabric-listings/:id/request', (req, res) => {
  const { buyerName, buyerPhone, buyerType, message } = req.body;
  if (!buyerName || !buyerPhone) return res.status(400).json({ error: 'Name and phone are required' });
  const listing = db.prepare('SELECT * FROM fabric_listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'available') return res.status(400).json({ error: 'This listing is no longer available' });

  const info = db.prepare(`
    INSERT INTO fabric_orders (listing_id, designer_id, buyer_name, buyer_phone, buyer_type, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, listing.designer_id, buyerName, buyerPhone, buyerType || 'designer', message || null);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.get('/api/designers/:id/fabric-orders', (req, res) => {
  const rows = db.prepare(`
    SELECT fo.*, fl.title AS listing_title, fl.fabric_type, fl.quantity_meters, fl.price
    FROM fabric_orders fo JOIN fabric_listings fl ON fl.id = fo.listing_id
    WHERE fo.designer_id = ? ORDER BY fo.created_at DESC
  `).all(req.params.id);
  res.json(rows);
});

app.patch('/api/fabric-orders/:id', (req, res) => {
  const { status } = req.body;
  if (!['requested', 'confirmed', 'completed', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const order = db.prepare('SELECT * FROM fabric_orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Fabric order not found' });

  db.prepare('UPDATE fabric_orders SET status = ? WHERE id = ?').run(status, req.params.id);
  if (status === 'confirmed') {
    db.prepare(`UPDATE fabric_listings SET status = 'reserved' WHERE id = ?`).run(order.listing_id);
  } else if (status === 'completed') {
    db.prepare(`UPDATE fabric_listings SET status = 'sold' WHERE id = ?`).run(order.listing_id);
  } else if (status === 'declined') {
    db.prepare(`UPDATE fabric_listings SET status = 'available' WHERE id = ? AND status = 'reserved'`).run(order.listing_id);
  }
  res.json({ ok: true });
});


// ---- Authentication ----

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) return res.status(400).json({ error: 'An account with that email already exists' });

  const { hash, salt } = hashPassword(password);
  const info = db.prepare(`
    INSERT INTO users (email, password_hash, password_salt, name, role, auth_provider) VALUES (?, ?, ?, ?, 'customer', 'password')
  `).run(normalizedEmail, hash, salt, name);

  createSession(res, Number(info.lastInsertRowid), req.headers['user-agent']);
  logAudit(Number(info.lastInsertRowid), 'signup', 'Signed up with email and password');
  res.status(201).json({ id: Number(info.lastInsertRowid), name, email: normalizedEmail });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user || user.auth_provider !== 'password' || !verifyPassword(password, user.password_hash, user.password_salt)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  if (user.suspended) return res.status(403).json({ error: 'This account has been suspended. Contact support for help.' });
  createSession(res, user.id, req.headers['user-agent']);
  logAudit(user.id, 'login', 'Logged in with email and password');
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// Real, working password-reset mechanism (secure random token, hashed at
// rest, 30-minute expiry, single use) — the only simulated part is email
// delivery, since this prototype has no mail server. The reset link is
// returned directly in the response instead of being emailed, and the UI
// says so plainly rather than pretending an email was sent.
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user || user.auth_provider !== 'password') {
    // Don't reveal whether the account exists — but since there's no real
    // email delivery to fall back on in this prototype, say so plainly.
    return res.json({ sent: false, message: 'If an account with that email exists, a reset link would be sent. (No account found for that email in this prototype.)' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hashToken(token), expiresAt);
  logAudit(user.id, 'password_reset_requested', null);
  res.json({ sent: true, resetLink: `/reset-password.html?token=${token}`, message: 'In production this link would be emailed to you. Since this prototype has no email service, here it is directly.' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 8) return res.status(400).json({ error: 'A valid token and a password of at least 8 characters are required' });
  const reset = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(hashToken(token));
  if (!reset || reset.used || new Date(reset.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired — request a new one.' });
  }
  const { hash, salt } = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, reset.user_id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id); // sign out everywhere for safety
  logAudit(reset.user_id, 'password_reset_completed', null);
  res.json({ ok: true });
});

// "Sign in with Google" — now a real integration. The browser gets an ID
// token (a signed JWT) from Google's Identity Services library; we verify
// it server-side against Google's own tokeninfo endpoint rather than
// trusting the client blindly. Three checks matter: the token is genuinely
// from Google, it was issued for *this* app (the "aud" claim must match our
// client ID), and the email on it is verified. Only then do we trust the
// email/name and create or sign in the matching account.
const GOOGLE_CLIENT_ID = '936750167312-ai5nhco6cchs8kknqk7jb0jdh9drnnaj.apps.googleusercontent.com';

function verifyGoogleToken(idToken) {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('Google could not verify this sign-in'));
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Unexpected response from Google')); }
      });
    }).on('error', () => reject(new Error('Could not reach Google — check your internet connection')));
  });
}

app.post('/api/auth/google-verify', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

  let payload;
  try {
    payload = await verifyGoogleToken(credential);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  if (payload.aud !== GOOGLE_CLIENT_ID) return res.status(401).json({ error: 'This sign-in was not issued for this app' });
  if (payload.email_verified !== 'true' && payload.email_verified !== true) return res.status(401).json({ error: 'Your Google email is not verified' });

  const normalizedEmail = String(payload.email).trim().toLowerCase();
  const name = payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(' ') || normalizedEmail.split('@')[0];

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) {
    const info = db.prepare(`INSERT INTO users (email, name, role, auth_provider) VALUES (?, ?, 'customer', 'google')`).run(normalizedEmail, name);
    user = { id: Number(info.lastInsertRowid), name, email: normalizedEmail };
    logAudit(user.id, 'signup', 'Signed up via Google');
  } else {
    logAudit(user.id, 'login', 'Logged in via Google');
  }
  createSession(res, user.id, req.headers['user-agent']);
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies.atadee_session;
  if (token) {
    const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(token));
    if (session) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
      logAudit(session.user_id, 'logout', null);
    }
  }
  res.setHeader('Set-Cookie', 'atadee_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = getCurrentUser(req);
  res.json(user);
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.auth_provider !== 'password') return res.status(400).json({ error: 'This account signs in with Google and has no password to change' });
  if (!verifyPassword(currentPassword, user.password_hash, user.password_salt)) return res.status(401).json({ error: 'Current password is incorrect' });

  const { hash, salt } = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, req.user.id);
  logAudit(req.user.id, 'password_changed', null);
  res.json({ ok: true });
});

app.get('/api/auth/sessions', requireAuth, (req, res) => {
  const cookies = parseCookies(req);
  const currentTokenHash = hashToken(cookies.atadee_session);
  const rows = db.prepare('SELECT id, user_agent, created_at, last_active_at, token_hash FROM sessions WHERE user_id = ? ORDER BY last_active_at DESC').all(req.user.id);
  res.json(rows.map(s => ({ id: s.id, userAgent: s.user_agent, createdAt: s.created_at, lastActiveAt: s.last_active_at, isCurrent: s.token_hash === currentTokenHash })));
});

app.delete('/api/auth/sessions/:id', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, 'session_revoked', `Session #${req.params.id} signed out`);
  res.json({ ok: true });
});

app.get('/api/auth/audit-log', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT event, detail, created_at FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id));
});

app.get('/api/auth/export', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.user.id);
  const orders = db.prepare('SELECT * FROM orders WHERE customer_user_id = ?').all(req.user.id).map(o => ({ ...o, measurements: JSON.parse(o.measurements) }));
  res.json({ exportedAt: new Date().toISOString(), account: user, orders });
});

app.post('/api/auth/delete-account', requireAuth, (req, res) => {
  const { password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.auth_provider === 'password' && !verifyPassword(password, user.password_hash, user.password_salt)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  // Order records are kept (as any real marketplace would for the
  // designer's business/legal records) but unlinked from the deleted
  // account, and no longer show in anyone's "My Orders."
  db.prepare('UPDATE orders SET customer_user_id = NULL WHERE customer_user_id = ?').run(req.user.id);
  db.prepare('UPDATE audit_log SET user_id = NULL WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  logAudit(null, 'account_deleted', `Former user #${req.user.id}`);
  res.setHeader('Set-Cookie', 'atadee_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

// ---- My Orders (requires login; orders placed as a guest aren't linked) ----

// ---- Notifications ----

app.get('/api/notifications', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE recipient_type = ? AND recipient_id = ? ORDER BY created_at DESC LIMIT 30').all('customer', req.user.id);
  const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0').get('customer', req.user.id).c;
  res.json({ notifications: rows, unreadCount: unread });
});

app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_type = ? AND recipient_id = ?').run('customer', req.user.id);
  res.json({ ok: true });
});

app.get('/api/designers/:id/notifications', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE recipient_type = ? AND recipient_id = ? ORDER BY created_at DESC LIMIT 30').all('designer', req.params.id);
  const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0').get('designer', req.params.id).c;
  res.json({ notifications: rows, unreadCount: unread });
});

app.post('/api/designers/:id/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_type = ? AND recipient_id = ?').run('designer', req.params.id);
  res.json({ ok: true });
});

app.patch('/api/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});


// ==================== ADMIN SYSTEM ====================
// Role split: moderator = trust & content (approvals, verification,
// portfolio/review moderation, categories, content); support = operations
// (disputes, tickets, suspicious activity, user bans, order visibility);
// finance = money (transactions, commissions, coupons, subscriptions/
// featured listings). admin = everything. Every endpoint below enforces
// this server-side via requireRole — the frontend also hides sections a
// role can't use, but that's a convenience, not the actual security.

// ---- Overview / analytics ----
app.get('/api/admin/overview', requireRole('admin', 'support', 'finance', 'moderator'), (req, res) => {
  const totalDesigners = db.prepare('SELECT COUNT(*) c FROM designers').get().c;
  const pendingDesigners = db.prepare(`SELECT COUNT(*) c FROM designers WHERE approval_status = 'pending'`).get().c;
  const totalCustomers = db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'customer'`).get().c;
  const totalOrders = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  const ordersByStatus = db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all();
  const gmv = db.prepare('SELECT COALESCE(SUM(amount),0) t FROM payments').get().t;
  const revenueThisMonth = db.prepare(`SELECT COALESCE(SUM(amount),0) t FROM payments WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`).get().t;
  const openReports = db.prepare(`SELECT COUNT(*) c FROM reports WHERE status = 'open'`).get().c;
  const openDisputes = db.prepare(`SELECT COUNT(*) c FROM disputes WHERE status = 'open'`).get().c;
  const openTickets = db.prepare(`SELECT COUNT(*) c FROM support_tickets WHERE status = 'open'`).get().c;

  // Commission is tiered now (based on each order's own total value), so
  // there's no single "the rate" to multiply GMV by — sum each order's
  // actual tier against what's actually been paid on it so far.
  const paidOrders = db.prepare('SELECT quoted_price, amount_paid FROM orders WHERE amount_paid > 0').all();
  let commissionEarned = 0;
  for (const o of paidOrders) {
    commissionEarned += o.amount_paid * getCommissionRate(o.quoted_price) / 100;
  }
  commissionEarned = Math.round(commissionEarned);
  const effectiveCommissionRate = gmv > 0 ? Math.round((commissionEarned / gmv) * 1000) / 10 : 0;

  res.json({
    totalDesigners, pendingDesigners, totalCustomers, totalOrders, ordersByStatus,
    gmv, revenueThisMonth, effectiveCommissionRate, commissionEarned,
    openReports, openDisputes, openTickets
  });
});

// ---- Designers: approvals, identity verification, portfolio moderation, featured/plan, suspension ----
app.get('/api/admin/designers', requireRole('admin', 'moderator', 'support', 'finance'), (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT d.*, (SELECT COUNT(*) FROM portfolio_items p WHERE p.designer_id = d.id) AS portfolio_count
    FROM designers d WHERE 1=1
  `;
  const params = [];
  if (status === 'pending') { sql += ` AND approval_status = 'pending'`; }
  else if (status === 'suspended') { sql += ' AND suspended = 1'; }
  else if (status === 'featured') { sql += ' AND featured = 1'; }
  sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.patch('/api/admin/designers/:id/approval', requireRole('admin', 'moderator'), (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });

  if (status === 'approved') {
    const portfolioCount = db.prepare('SELECT COUNT(*) c FROM portfolio_items WHERE designer_id = ?').get(req.params.id).c;
    const missing = [];
    if (portfolioCount === 0) missing.push('at least one photo of their work');
    if (!designer.workplace_image_url) missing.push('a photo of their workplace');
    if (missing.length) return res.status(400).json({ error: `Can't approve yet — this designer still needs to submit ${missing.join(' and ')}.` });
  }

  db.prepare('UPDATE designers SET approval_status = ? WHERE id = ?').run(status, req.params.id);
  logAdminAction(req.staff.id, 'designer_approval', `${status} designer #${req.params.id} (${designer.name})`);
  res.json({ ok: true });
});

app.patch('/api/admin/designers/:id/verify', requireRole('admin', 'moderator'), (req, res) => {
  const { phone_verified, id_verified, business_verified, portfolio_verified } = req.body;
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  db.prepare(`
    UPDATE designers SET
      phone_verified = COALESCE(?, phone_verified), id_verified = COALESCE(?, id_verified),
      business_verified = COALESCE(?, business_verified), portfolio_verified = COALESCE(?, portfolio_verified)
    WHERE id = ?
  `).run(
    phone_verified === undefined ? null : (phone_verified ? 1 : 0),
    id_verified === undefined ? null : (id_verified ? 1 : 0),
    business_verified === undefined ? null : (business_verified ? 1 : 0),
    portfolio_verified === undefined ? null : (portfolio_verified ? 1 : 0),
    req.params.id
  );
  logAdminAction(req.staff.id, 'designer_verification', `Updated verification badges for designer #${req.params.id} (${designer.name})`);
  res.json({ ok: true });
});

app.patch('/api/admin/designers/:id/suspend', requireRole('admin', 'moderator', 'support'), (req, res) => {
  const { suspended, reason } = req.body;
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  db.prepare('UPDATE designers SET suspended = ?, suspension_reason = ? WHERE id = ?').run(suspended ? 1 : 0, suspended ? (reason || null) : null, req.params.id);
  logAdminAction(req.staff.id, 'designer_suspend', `${suspended ? 'Suspended' : 'Unsuspended'} designer #${req.params.id} (${designer.name})${reason ? ': ' + reason : ''}`);
  res.json({ ok: true });
});

app.patch('/api/admin/designers/:id/marketing', requireRole('admin', 'finance'), (req, res) => {
  const { featured, plan } = req.body;
  const designer = db.prepare('SELECT * FROM designers WHERE id = ?').get(req.params.id);
  if (!designer) return res.status(404).json({ error: 'Designer not found' });
  db.prepare('UPDATE designers SET featured = COALESCE(?, featured), plan = COALESCE(?, plan) WHERE id = ?')
    .run(featured === undefined ? null : (featured ? 1 : 0), plan || null, req.params.id);
  logAdminAction(req.staff.id, 'designer_marketing', `Updated featured/plan for designer #${req.params.id} (${designer.name})`);
  res.json({ ok: true });
});

app.delete('/api/admin/portfolio/:id', requireRole('admin', 'moderator'), (req, res) => {
  const item = db.prepare('SELECT * FROM portfolio_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Portfolio item not found' });
  db.prepare('DELETE FROM portfolio_items WHERE id = ?').run(req.params.id);
  logAdminAction(req.staff.id, 'portfolio_removed', `Removed portfolio item #${req.params.id} ("${item.title}") from designer #${item.designer_id}`);
  res.json({ ok: true });
});

// ---- Reported profiles ----
app.post('/api/reports', (req, res) => {
  const { designerId, reporterName, reporterPhone, reason, detail } = req.body;
  if (!designerId || !reason) return res.status(400).json({ error: 'designerId and reason are required' });
  const info = db.prepare(`INSERT INTO reports (designer_id, reporter_name, reporter_phone, reason, detail) VALUES (?, ?, ?, ?, ?)`)
    .run(designerId, reporterName || null, reporterPhone || null, reason, detail || null);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.get('/api/admin/reports', requireRole('admin', 'moderator', 'support'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, d.name AS designer_name FROM reports r JOIN designers d ON d.id = r.designer_id
    ORDER BY r.status = 'open' DESC, r.created_at DESC
  `).all();
  res.json(rows);
});

app.patch('/api/admin/reports/:id', requireRole('admin', 'moderator', 'support'), (req, res) => {
  const { status, resolutionNote } = req.body;
  if (!['open', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE reports SET status = ?, resolution_note = ?, resolved_at = datetime('now') WHERE id = ?`).run(status, resolutionNote || null, req.params.id);
  logAdminAction(req.staff.id, 'report_resolved', `Report #${req.params.id} marked ${status}`);
  res.json({ ok: true });
});

// ---- Reviews moderation ----
app.delete('/api/admin/reviews/:id', requireRole('admin', 'moderator'), (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  const remaining = db.prepare('SELECT COUNT(*) c FROM reviews WHERE designer_id = ?').get(review.designer_id).c;
  db.prepare('UPDATE designers SET reviews_count = ? WHERE id = ?').run(remaining, review.designer_id);
  logAdminAction(req.staff.id, 'review_removed', `Removed review #${req.params.id} from designer #${review.designer_id}`);
  res.json({ ok: true });
});

// ---- Disputes / refunds (delivery issues are category='delivery') ----
app.post('/api/disputes', (req, res) => {
  const { orderId, raisedBy, category, detail } = req.body;
  if (!orderId || !category || !detail) return res.status(400).json({ error: 'orderId, category, and detail are required' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const info = db.prepare(`INSERT INTO disputes (order_id, raised_by, category, detail) VALUES (?, ?, ?, ?)`)
    .run(orderId, raisedBy || 'customer', category, detail);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.get('/api/admin/disputes', requireRole('admin', 'support', 'finance'), (req, res) => {
  const rows = db.prepare(`
    SELECT dp.*, o.customer_name, o.designer_id, d.name AS designer_name, o.quoted_price, o.amount_paid
    FROM disputes dp JOIN orders o ON o.id = dp.order_id JOIN designers d ON d.id = o.designer_id
    ORDER BY dp.status = 'open' DESC, dp.created_at DESC
  `).all();
  res.json(rows);
});

app.patch('/api/admin/disputes/:id', requireRole('admin', 'support', 'finance'), (req, res) => {
  const { status, resolutionNote, refundAmount } = req.body;
  if (!['open', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

  if (refundAmount) {
    if (!['admin', 'finance'].includes(req.staff.role)) return res.status(403).json({ error: 'Only finance or admin can issue a refund' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(dispute.order_id);
    const newPaid = Math.max(0, order.amount_paid - refundAmount);
    db.prepare(`UPDATE orders SET amount_paid = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newPaid, newPaid <= 0 ? 'unpaid' : 'partial', dispute.order_id);
    db.prepare(`INSERT INTO payments (order_id, method, provider, amount, status, reference, payer_detail) VALUES (?, 'refund', 'Platform', ?, 'completed', ?, ?)`)
      .run(dispute.order_id, -refundAmount, generateReference('REFUND'), 'Issued by ' + req.staff.name);
  }

  db.prepare(`UPDATE disputes SET status = ?, resolution_note = ?, refund_amount = COALESCE(?, refund_amount), resolved_at = datetime('now') WHERE id = ?`)
    .run(status, resolutionNote || null, refundAmount || null, req.params.id);
  logAdminAction(req.staff.id, 'dispute_resolved', `Dispute #${req.params.id} marked ${status}${refundAmount ? ` with GH₵${refundAmount} refund` : ''}`);
  res.json({ ok: true });
});

// ---- Suspicious activity (rule-based flags, not real fraud ML) ----
app.get('/api/admin/suspicious', requireRole('admin', 'support', 'moderator'), (req, res) => {
  const flaggedDesigners = db.prepare(`
    SELECT d.id, d.name, COUNT(r.id) AS report_count FROM designers d JOIN reports r ON r.designer_id = d.id
    WHERE r.status = 'open' GROUP BY d.id HAVING COUNT(r.id) >= 2
  `).all();
  const staleOrders = db.prepare(`
    SELECT o.id, o.customer_name, o.designer_id, d.name AS designer_name, o.status, o.updated_at
    FROM orders o JOIN designers d ON d.id = o.designer_id
    WHERE o.payment_status IN ('paid','partial') AND o.status NOT IN ('completed')
    AND julianday('now') - julianday(o.updated_at) > 14
  `).all();
  const repeatDisputers = db.prepare(`
    SELECT o.customer_name, COUNT(dp.id) AS dispute_count FROM disputes dp JOIN orders o ON o.id = dp.order_id
    GROUP BY o.customer_name HAVING COUNT(dp.id) >= 2
  `).all();
  res.json({ flaggedDesigners, staleOrders, repeatDisputers });
});

// ---- Customer support tickets ----
app.post('/api/support-tickets', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !subject || !message) return res.status(400).json({ error: 'name, subject, and message are required' });
  const currentUser = getCurrentUser(req);
  const info = db.prepare(`INSERT INTO support_tickets (user_id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)`)
    .run(currentUser ? currentUser.id : null, name, email || (currentUser ? currentUser.email : null), subject, message);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.get('/api/admin/support-tickets', requireRole('admin', 'support'), (req, res) => {
  res.json(db.prepare(`SELECT * FROM support_tickets ORDER BY status = 'open' DESC, created_at DESC`).all());
});

app.patch('/api/admin/support-tickets/:id', requireRole('admin', 'support'), (req, res) => {
  const { status, staffReply } = req.body;
  db.prepare(`UPDATE support_tickets SET status = COALESCE(?, status), staff_reply = COALESCE(?, staff_reply), resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE resolved_at END WHERE id = ?`)
    .run(status || null, staffReply || null, status || '', req.params.id);
  logAdminAction(req.staff.id, 'ticket_updated', `Ticket #${req.params.id} updated`);
  res.json({ ok: true });
});

// ---- User bans/suspensions ----
app.get('/api/admin/users', requireRole('admin', 'support'), (req, res) => {
  res.json(db.prepare(`SELECT id, name, email, role, suspended, created_at FROM users WHERE role = 'customer' ORDER BY id DESC`).all());
});

app.patch('/api/admin/users/:id/suspend', requireRole('admin', 'support'), (req, res) => {
  const { suspended } = req.body;
  db.prepare('UPDATE users SET suspended = ? WHERE id = ?').run(suspended ? 1 : 0, req.params.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id); // sign them out immediately if suspending
  logAdminAction(req.staff.id, 'user_suspend', `${suspended ? 'Suspended' : 'Unsuspended'} user #${req.params.id}`);
  res.json({ ok: true });
});

// ---- Orders & transactions (platform-wide view) ----
app.get('/api/admin/orders', requireRole('admin', 'support', 'finance'), (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, d.name AS designer_name FROM orders o JOIN designers d ON d.id = o.designer_id ORDER BY o.created_at DESC LIMIT 100
  `).all();
  res.json(rows);
});

app.get('/api/admin/transactions', requireRole('admin', 'finance'), (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, o.customer_name, d.name AS designer_name FROM payments p
    JOIN orders o ON o.id = p.order_id JOIN designers d ON d.id = o.designer_id
    ORDER BY p.created_at DESC LIMIT 100
  `).all();
  res.json(rows);
});

// ---- Finance: platform commission rate, coupons ----
app.get('/api/service-fee-rate', (req, res) => {
  const amount = Number(req.query.amount) || 0;
  res.json({ fee: getServiceFee(amount), commissionRate: getCommissionRate(amount) });
});

app.get('/api/admin/settings', requireRole('admin', 'finance'), (req, res) => {
  res.json(Object.fromEntries(db.prepare('SELECT key, value FROM platform_settings').all().map(r => [r.key, r.value])));
});
app.patch('/api/admin/settings', requireRole('admin', 'finance'), (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    db.prepare('INSERT INTO platform_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
  }
  logAdminAction(req.staff.id, 'settings_updated', JSON.stringify(req.body));
  res.json({ ok: true });
});

app.get('/api/admin/coupons', requireRole('admin', 'finance'), (req, res) => {
  res.json(db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all());
});
app.post('/api/admin/coupons', requireRole('admin', 'finance'), (req, res) => {
  const { code, description, discountType, discountValue, expiresAt } = req.body;
  if (!code || !discountValue) return res.status(400).json({ error: 'code and discountValue are required' });
  try {
    const info = db.prepare(`INSERT INTO coupons (code, description, discount_type, discount_value, expires_at) VALUES (?, ?, ?, ?, ?)`)
      .run(code.toUpperCase(), description || null, discountType || 'percent', discountValue, expiresAt || null);
    logAdminAction(req.staff.id, 'coupon_created', code.toUpperCase());
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch {
    res.status(400).json({ error: 'That coupon code already exists' });
  }
});
app.patch('/api/admin/coupons/:id', requireRole('admin', 'finance'), (req, res) => {
  const { active } = req.body;
  db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/coupons/:id', requireRole('admin', 'finance'), (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Category management ----
app.get('/api/available-categories', (_req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY sort_order').all());
});
app.post('/api/admin/categories', requireRole('admin', 'moderator'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM categories').get().m;
    const info = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, maxOrder + 1);
    logAdminAction(req.staff.id, 'category_added', name);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch {
    res.status(400).json({ error: 'That category already exists' });
  }
});
app.delete('/api/admin/categories/:id', requireRole('admin', 'moderator'), (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Content management (Circular page educational cards) ----
app.get('/api/content-blocks', (_req, res) => {
  res.json(db.prepare('SELECT * FROM content_blocks ORDER BY sort_order').all());
});
app.get('/api/admin/content', requireRole('admin', 'moderator'), (req, res) => {
  res.json(db.prepare('SELECT * FROM content_blocks ORDER BY sort_order').all());
});
app.patch('/api/admin/content/:id', requireRole('admin', 'moderator'), (req, res) => {
  const { title, body } = req.body;
  db.prepare('UPDATE content_blocks SET title = COALESCE(?, title), body = COALESCE(?, body) WHERE id = ?').run(title || null, body || null, req.params.id);
  logAdminAction(req.staff.id, 'content_updated', `Content block #${req.params.id} updated`);
  res.json({ ok: true });
});

// ---- Measurement standards (read-only reference — see garments.js) ----
app.get('/api/admin/measurement-standards', requireRole('admin', 'moderator'), (_req, res) => {
  res.json(Object.entries(GARMENTS).map(([key, g]) => ({ key, label: g.label, sizeField: g.sizeField, chart: g.chart })));
});


app.use((err, _req, res, _next) => {
  if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`atadeɛ running on http://localhost:${PORT}`));

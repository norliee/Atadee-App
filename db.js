const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'sewfind.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  auth_provider TEXT NOT NULL DEFAULT 'password',
  suspended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL,
  recipient_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  link_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_id INTEGER NOT NULL,
  reporter_name TEXT,
  reporter_phone TEXT,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  raised_by TEXT NOT NULL,
  category TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  refund_amount INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  staff_reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_user_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS designers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  specialties TEXT NOT NULL,
  location TEXT NOT NULL,
  price_min INTEGER NOT NULL,
  price_max INTEGER NOT NULL,
  rating REAL NOT NULL,
  reviews_count INTEGER NOT NULL,
  turnaround_days INTEGER NOT NULL,
  bio TEXT NOT NULL,
  swatch TEXT NOT NULL,
  image_url TEXT,
  ships_internationally INTEGER NOT NULL DEFAULT 1,
  verified INTEGER NOT NULL DEFAULT 0,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  id_verified INTEGER NOT NULL DEFAULT 0,
  business_verified INTEGER NOT NULL DEFAULT 0,
  portfolio_verified INTEGER NOT NULL DEFAULT 0,
  latitude REAL,
  longitude REAL,
  availability TEXT NOT NULL DEFAULT 'accepting',
  capacity_note TEXT,
  sus_offcuts INTEGER NOT NULL DEFAULT 0,
  sus_recycled INTEGER NOT NULL DEFAULT 0,
  sus_deadstock INTEGER NOT NULL DEFAULT 0,
  sus_upcycled INTEGER NOT NULL DEFAULT 0,
  sus_local_sourced INTEGER NOT NULL DEFAULT 0,
  sus_low_waste_cutting INTEGER NOT NULL DEFAULT 0,
  sus_repair_alterations INTEGER NOT NULL DEFAULT 0,
  sustainable_badge INTEGER NOT NULL DEFAULT 0,
  profile_views INTEGER NOT NULL DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'approved',
  suspended INTEGER NOT NULL DEFAULT 0,
  suspension_reason TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'free',
  paystack_subaccount_code TEXT,
  payout_bank_code TEXT,
  payout_bank_name TEXT,
  payout_account_number TEXT,
  payout_account_name TEXT,
  workplace_image_url TEXT
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  swatch TEXT NOT NULL,
  image_url TEXT,
  garment_type TEXT,
  price_from INTEGER,
  circular_type TEXT,
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  garment_type TEXT NOT NULL,
  measurements TEXT NOT NULL,
  recommended_size TEXT NOT NULL,
  fit_note TEXT,
  budget_min INTEGER,
  budget_max INTEGER,
  status TEXT NOT NULL DEFAULT 'requested',
  quoted_price INTEGER,
  notes TEXT,
  order_for TEXT NOT NULL DEFAULT 'self',
  recipient_name TEXT,
  recipient_phone TEXT,
  customer_country TEXT NOT NULL DEFAULT 'Ghana',
  delivery_country TEXT NOT NULL DEFAULT 'Ghana',
  delivery_address TEXT,
  reference_image_url TEXT,
  changes_wanted TEXT,
  changes_custom TEXT,
  customer_user_id INTEGER,
  group_order_id INTEGER,
  order_type TEXT NOT NULL DEFAULT 'bespoke',
  amount_paid INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  shop_item_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS group_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  garment_type TEXT NOT NULL,
  organizer_name TEXT NOT NULL,
  organizer_phone TEXT NOT NULL,
  deadline TEXT,
  budget_note TEXT,
  join_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  type TEXT NOT NULL,
  slot_date TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'studio',
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS shop_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  swatch TEXT NOT NULL,
  garment_type TEXT,
  size TEXT NOT NULL,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  sender TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  photo_url TEXT,
  quote_amount INTEGER,
  quote_breakdown TEXT,
  quote_ready_by TEXT,
  quote_status TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE,
  designer_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  quality INTEGER NOT NULL,
  fit INTEGER NOT NULL,
  communication INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  value INTEGER NOT NULL,
  on_time INTEGER NOT NULL,
  would_reorder INTEGER NOT NULL,
  comment TEXT,
  photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS style_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  garment_type TEXT,
  category TEXT,
  reference_image_url TEXT,
  changes_wanted TEXT,
  changes_custom TEXT,
  notes TEXT,
  location TEXT,
  budget_min INTEGER,
  budget_max INTEGER,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  accepted_designer_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (accepted_designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS style_request_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  designer_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  ready_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES style_requests(id),
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  method TEXT NOT NULL,
  provider TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  reference TEXT NOT NULL,
  payer_detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  price_from INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS designer_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_id INTEGER NOT NULL,
  caption TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'photo',
  garment_type TEXT,
  views_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS fabric_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  fabric_type TEXT NOT NULL,
  quantity_meters REAL NOT NULL,
  price INTEGER NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE IF NOT EXISTS fabric_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL,
  designer_id INTEGER NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_type TEXT NOT NULL DEFAULT 'designer',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (listing_id) REFERENCES fabric_listings(id),
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);
`);

// Seed only if empty
const count = db.prepare('SELECT COUNT(*) AS c FROM designers').get().c;
if (count === 0) {
  const insertDesigner = db.prepare(`
    INSERT INTO designers (name, category, specialties, location, price_min, price_max, rating, reviews_count, turnaround_days, bio, swatch, image_url, ships_internationally, verified, phone_verified, id_verified, business_verified, portfolio_verified, latitude, longitude, availability, sus_offcuts, sus_recycled, sus_deadstock, sus_upcycled, sus_local_sourced, sus_low_waste_cutting, sus_repair_alterations, sustainable_badge)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPortfolio = db.prepare(`
    INSERT INTO portfolio_items (designer_id, title, swatch, image_url, garment_type, price_from, circular_type) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Portrait placeholder photos (real stock photos via Picsum, seeded so they're
  // stable across restarts). Designers replace these with real portfolio photos
  // via the dashboard's upload tool.
  const img = (seed, w = 600, h = 750) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

  const designers = [
    { name: 'Ama Serwaa Couture', category: 'Wedding', specialties: 'Bridal gowns, kaba & slit, aso-ebi', location: 'East Legon, Accra', price_min: 800, price_max: 3500, rating: 4.8, reviews_count: 142, turnaround_days: 21, bio: 'Bridal specialist with 12 years designing kaba & slit and modern gowns for Accra weddings.', swatch: '#7A1E2B', image: img('atadee-ama-cover'), verified: 1,
      portfolio: [
        { title: 'Ivory lace bridal gown', garment_type: 'womens_dress', price: 2400, img: img('atadee-ama-1') },
        { title: 'Aso-ebi set for 8', garment_type: 'kaba_slit', price: 3200, img: img('atadee-ama-2') },
        { title: 'Kaba & slit, gold trim', garment_type: 'kaba_slit', price: 950, img: img('atadee-ama-3') }
      ] },
    { name: 'Kofi Boateng Bespoke', category: 'Corporate', specialties: 'Suits, shirts, corporate uniforms', location: 'Osu, Accra', price_min: 400, price_max: 1800, rating: 4.6, reviews_count: 98, turnaround_days: 14, bio: 'Tailored suiting for executives and corporate teams, trained in classic English cut.', swatch: '#1B1A55', image: img('atadee-kofi-cover'), verified: 1,
      portfolio: [
        { title: 'Navy two-piece suit', garment_type: 'mens_suit', price: 900, img: img('atadee-kofi-1') },
        { title: 'Company uniform batch (30pcs)', garment_type: 'mens_shirt', price: 180, img: img('atadee-kofi-2') },
        { title: 'Slim-fit dress shirt', garment_type: 'mens_shirt', price: 220, img: img('atadee-kofi-3') }
      ] },
    { name: 'Akosua Kente House', category: 'Traditional', specialties: 'Kente wear, smocks, festival outfits', location: 'Bantama, Kumasi', price_min: 300, price_max: 2200, rating: 4.9, reviews_count: 210, turnaround_days: 18, bio: 'Third-generation kente weavers turned designers, specializing in festival and durbar outfits. Woven scraps are pieced into smaller accessories rather than thrown away.', swatch: '#C1272D', image: img('atadee-akosua-cover'), verified: 1,
      sustainability: { sus_offcuts: 1, sus_local_sourced: 1, sus_repair_alterations: 1 },
      portfolio: [
        { title: 'Handwoven kente kaftan', garment_type: 'kaftan_agbada', price: 900, img: img('atadee-akosua-1') },
        { title: "Chief's ceremonial smock", garment_type: 'kaftan_agbada', price: 2200, img: img('atadee-akosua-2') },
        { title: 'Kente-trim agbada', garment_type: 'kaftan_agbada', price: 1400, img: img('atadee-akosua-3'), circular_type: 'offcut' }
      ] },
    { name: 'Naa Dedei Kids Wear', category: 'Kids', specialties: "Children's outfits, school events, birthdays", location: 'Dansoman, Accra', price_min: 100, price_max: 450, rating: 4.7, reviews_count: 76, turnaround_days: 10, bio: "Playful, durable outfits for kids' parties, cultural day and photoshoots.", swatch: '#D4A017', image: img('atadee-naa-cover'), verified: 0,
      portfolio: [
        { title: 'Matching sibling kente set', garment_type: 'kids_outfit', price: 320, img: img('atadee-naa-1') },
        { title: 'Birthday party dress', garment_type: 'kids_outfit', price: 280, img: img('atadee-naa-2') },
        { title: 'Cultural day smock', garment_type: 'kids_outfit', price: 180, img: img('atadee-naa-3') }
      ] },
    { name: 'Yaw Mensah Streetline', category: 'Casual', specialties: 'Streetwear, ankara shirts, casual fits', location: 'Adum, Kumasi', price_min: 150, price_max: 600, rating: 4.4, reviews_count: 54, turnaround_days: 7, bio: 'Contemporary ankara streetwear for the everyday wardrobe, built from offcuts and deadstock fabric wherever possible.', swatch: '#2F6E51', image: img('atadee-yaw-cover'), verified: 0,
      sustainability: { sus_offcuts: 1, sus_upcycled: 1, sus_local_sourced: 1, sus_low_waste_cutting: 1 },
      portfolio: [
        { title: 'Ankara bomber jacket', garment_type: 'mens_shirt', price: 400, img: img('atadee-yaw-1'), circular_type: 'upcycled' },
        { title: 'Print short-sleeve shirt', garment_type: 'mens_shirt', price: 200, img: img('atadee-yaw-2') },
        { title: 'Relaxed-fit joggers', garment_type: 'mens_suit', price: 250, img: img('atadee-yaw-3'), circular_type: 'offcut' }
      ] },
    { name: 'Efua Vogue Studio', category: 'Wedding', specialties: 'Evening gowns, bridesmaid sets, kaba', location: 'Airport Residential, Accra', price_min: 600, price_max: 2800, rating: 4.9, reviews_count: 165, turnaround_days: 20, bio: 'Editorial-style evening wear and bridal party coordination for weddings across Accra.', swatch: '#7A1E2B', image: img('atadee-efua-cover'), verified: 1,
      portfolio: [
        { title: 'Mermaid evening gown', garment_type: 'womens_dress', price: 1800, img: img('atadee-efua-1') },
        { title: 'Bridesmaid set of 6', garment_type: 'womens_dress', price: 2600, img: img('atadee-efua-2') },
        { title: 'Champagne kaba & slit', garment_type: 'kaba_slit', price: 1100, img: img('atadee-efua-3') }
      ] },
    { name: "Kwabena Agbada Line", category: 'Traditional', specialties: "Agbada, kaftan, men's traditional wear", location: 'Tamale', price_min: 350, price_max: 1600, rating: 4.6, reviews_count: 63, turnaround_days: 15, bio: 'Northern-style embroidery specialists for agbada and kaftan.', swatch: '#1B1A55', image: img('atadee-kwabena-cover'), verified: 0,
      portfolio: [
        { title: 'Embroidered agbada, 3-piece', garment_type: 'kaftan_agbada', price: 1400, img: img('atadee-kwabena-1') },
        { title: 'Formal kaftan', garment_type: 'kaftan_agbada', price: 650, img: img('atadee-kwabena-2') },
        { title: 'Wedding groomswear set', garment_type: 'kaftan_agbada', price: 1600, img: img('atadee-kwabena-3') }
      ] },
    { name: 'Abena Ready-to-Sew', category: 'Casual', specialties: 'Everyday dresses, office wear, quick turnaround', location: 'Spintex, Accra', price_min: 120, price_max: 500, rating: 4.3, reviews_count: 41, turnaround_days: 6, bio: 'Fast, reliable everyday wear for the working woman. Also takes in repairs and alterations on existing pieces.', swatch: '#2F6E51', image: img('atadee-abena-cover'), verified: 0,
      sustainability: { sus_repair_alterations: 1 },
      portfolio: [
        { title: 'Office wrap dress', garment_type: 'womens_dress', price: 280, img: img('atadee-abena-1') },
        { title: 'Ankara midi skirt', garment_type: 'womens_dress', price: 220, img: img('atadee-abena-2') },
        { title: 'Weekend jumpsuit', garment_type: 'womens_dress', price: 320, img: img('atadee-abena-3') }
      ] }
  ];

  const insertShopItem = db.prepare(`
    INSERT INTO shop_items (designer_id, title, image_url, swatch, garment_type, size, price, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    const idByName = {};
    // Approximate real coordinates for each neighborhood, for the map/location search.
    const coordsByLocation = {
      'East Legon, Accra': [5.6500, -0.1500],
      'Osu, Accra': [5.5563, -0.1969],
      'Bantama, Kumasi': [6.7093, -1.6244],
      'Dansoman, Accra': [5.5389, -0.2731],
      'Adum, Kumasi': [6.6885, -1.6244],
      'Airport Residential, Accra': [5.6052, -0.1719],
      'Tamale': [9.4008, -0.8393],
      'Spintex, Accra': [5.6357, -0.1273]
    };
    const availabilityCycle = ['accepting', 'accepting', 'limited', 'accepting', 'accepting', 'limited', 'booked', 'accepting'];
    let idx = 0;
    for (const d of designers) {
      // Badge variety: verified designers get more badges; everyone gets phone_verified
      // since that's the lowest bar (matches the PDR's tiered verification idea).
      const phoneVerified = 1;
      const idVerified = d.verified ? 1 : 0;
      const businessVerified = d.verified && d.rating >= 4.7 ? 1 : 0;
      const portfolioVerified = d.portfolio.length >= 3 ? 1 : 0;
      const [lat, lng] = coordsByLocation[d.location] || [5.6037, -0.1870];
      const availability = availabilityCycle[idx % availabilityCycle.length];
      idx++;
      const sus = d.sustainability || {};
      const susFlags = [sus.sus_offcuts, sus.sus_recycled, sus.sus_deadstock, sus.sus_upcycled, sus.sus_local_sourced, sus.sus_low_waste_cutting, sus.sus_repair_alterations].map(v => v ? 1 : 0);
      const susCount = susFlags.reduce((a, b) => a + b, 0);
      const sustainableBadge = susCount >= 3 ? 1 : 0;
      const info = insertDesigner.run(d.name, d.category, d.specialties, d.location, d.price_min, d.price_max, d.rating, d.reviews_count, d.turnaround_days, d.bio, d.swatch, d.image, 1, d.verified, phoneVerified, idVerified, businessVerified, portfolioVerified, lat, lng, availability, ...susFlags, sustainableBadge);
      idByName[d.name] = Number(info.lastInsertRowid);
      for (const p of d.portfolio) {
        insertPortfolio.run(Number(info.lastInsertRowid), p.title, d.swatch, p.img, p.garment_type, p.price, p.circular_type || null);
      }
    }

    // A handful of ready-to-wear pieces so the shop isn't empty on first run.
    const shopSeed = [
      { designer: 'Yaw Mensah Streetline', title: 'Ankara bomber jacket, ready-made', size: 'M', price: 380, stock: 2, garment_type: 'mens_shirt' },
      { designer: 'Yaw Mensah Streetline', title: 'Print short-sleeve shirt', size: 'L', price: 180, stock: 4, garment_type: 'mens_shirt' },
      { designer: 'Abena Ready-to-Sew', title: 'Office wrap dress', size: 'M', price: 260, stock: 3, garment_type: 'womens_dress' },
      { designer: 'Abena Ready-to-Sew', title: 'Ankara midi skirt', size: 'S', price: 200, stock: 1, garment_type: 'womens_dress' },
      { designer: 'Naa Dedei Kids Wear', title: 'Kente party dress, age 6-7', size: '6-7Y', price: 220, stock: 5, garment_type: 'kids_outfit' },
      { designer: 'Kwabena Agbada Line', title: 'Formal kaftan, ready-made', size: 'L', price: 600, stock: 2, garment_type: 'kaftan_agbada' }
    ];
    for (const item of shopSeed) {
      const designerId = idByName[item.designer];
      const designer = designers.find(d => d.name === item.designer);
      insertShopItem.run(designerId, item.title, img(`atadee-shop-${item.title.replace(/\s+/g, '-').toLowerCase()}`), designer.swatch, item.garment_type, item.size, item.price, item.stock);
    }

    // Waste-to-value marketplace: leftover fabric from designers who already
    // flagged offcuts/deadstock practices, so the section isn't empty on first run.
    const insertFabricListing = db.prepare(`
      INSERT INTO fabric_listings (designer_id, title, description, fabric_type, quantity_meters, price, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'available')
    `);
    const fabricSeed = [
      { designer: 'Akosua Kente House', title: 'Handwoven kente offcuts, mixed gold/red', description: 'Leftover strips from a recent commission — great for trims, bags, or patchwork pieces.', fabricType: 'Kente', quantity: 4.5, price: 180 },
      { designer: 'Yaw Mensah Streetline', title: 'Ankara deadstock, geometric print', description: 'Overordered for a batch run. Clean, uncut yardage.', fabricType: 'Ankara / African print', quantity: 6, price: 150 },
      { designer: 'Yaw Mensah Streetline', title: 'Denim offcuts, assorted sizes', description: 'Scraps from streetwear production — good for patchwork or small accessories.', fabricType: 'Denim', quantity: 2.5, price: 60 }
    ];
    for (const f of fabricSeed) {
      const designerId = idByName[f.designer];
      insertFabricListing.run(designerId, f.title, f.description, f.fabricType, f.quantity, f.price, img(`atadee-fabric-${f.title.replace(/\s+/g, '-').toLowerCase()}`));
    }

    // Staff accounts — same login system as customers, just a different
    // `role`. Password hashing here mirrors server.js's hashPassword()
    // exactly (scrypt, 64-byte key) so these seeded accounts can log in
    // through the normal /api/auth/login endpoint.
    const crypto = require('crypto');
    function seedHash(password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(password, salt, 64).toString('hex');
      return { hash, salt };
    }
    const insertStaff = db.prepare(`
      INSERT INTO users (email, password_hash, password_salt, name, role, auth_provider) VALUES (?, ?, ?, ?, ?, 'password')
    `);
    const staffSeed = [
      { email: 'admin@atadee.com', password: 'admin123', name: 'Platform Admin', role: 'admin' },
      { email: 'support@atadee.com', password: 'support123', name: 'Customer Support', role: 'support' },
      { email: 'finance@atadee.com', password: 'finance123', name: 'Finance Admin', role: 'finance' },
      { email: 'moderator@atadee.com', password: 'moderator123', name: 'Trust & Safety', role: 'moderator' }
    ];
    for (const s of staffSeed) {
      const { hash, salt } = seedHash(s.password);
      insertStaff.run(s.email, hash, salt, s.name, s.role);
    }

    const insertCategory = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    ['Wedding', 'Corporate', 'Traditional', 'Kids', 'Casual'].forEach((name, i) => insertCategory.run(name, i));

    const insertContent = db.prepare('INSERT INTO content_blocks (block_key, title, body, sort_order) VALUES (?, ?, ?, ?)');
    const contentSeed = [
      { key: 'waste_matters', title: 'Why textile waste matters', body: "Ghana's Kantamanto Market receives an estimated 15 million secondhand garments a week, and a significant share ends up as waste. Choosing designers who reuse offcuts and deadstock helps keep usable fabric out of landfill." },
      { key: 'deadstock', title: 'What is deadstock fabric?', body: 'Deadstock is leftover fabric from factories or previous production runs that would otherwise go unused — perfectly good material, just without a home yet.' },
      { key: 'upcycling', title: 'How upcycling reduces waste', body: 'Upcycling turns existing garments or fabric scraps into something new, rather than using freshly manufactured material — cutting demand for new textile production.' },
      { key: 'repair', title: 'Why repair matters', body: "The most sustainable garment is often the one you already own. Repair and alteration services extend a piece's life instead of replacing it." }
    ];
    contentSeed.forEach((c, i) => insertContent.run(c.key, c.title, c.body, i));

    const insertSetting = db.prepare('INSERT INTO platform_settings (key, value) VALUES (?, ?)');
    // Cliff-style tiers: the order's TOTAL value picks one bracket, and that
    // bracket's rate/fee applies. `max: null` means "this bracket and above".
    insertSetting.run('commission_tiers', JSON.stringify([
      { max: 499, rate: 7 },
      { max: 999, rate: 6 },
      { max: 1999, rate: 5 },
      { max: null, rate: 4 }
    ]));
    insertSetting.run('service_fee_tiers', JSON.stringify([
      { max: 299, fee: 5 },
      { max: 699, fee: 10 },
      { max: 1499, fee: 15 },
      { max: null, fee: 20 }
    ]));

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = db;

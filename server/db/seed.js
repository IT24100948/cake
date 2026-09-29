/**
 * Seeds roles, permissions, demo staff, a demo customer, categories, products and sample orders.
 * Usage: npm run seed   (run `npm run db:reset` first for a clean database)
 *
 * Demo passwords are generated randomly unless SEED_PASSWORD is set, then printed once
 * and saved to server/.seed-credentials (git-ignored).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool, query } = require('../src/config/db');
const { uploadDir, isTest } = require('../src/config/env');
const { PERMISSIONS } = require('../src/config/constants');

function makePassword() {
  if (process.env.SEED_PASSWORD) return process.env.SEED_PASSWORD;
  return `Devma-${crypto.randomBytes(4).toString('hex')}1`;
}

const ROLE_DEFS = [
  { name: 'Admin', description: 'Business owner / administrator with full access', system: true, perms: PERMISSIONS.map((p) => p.code) },
  {
    name: 'Shop Staff', description: 'Handles customers, products, orders, payments and delivery', system: true,
    perms: ['products.view', 'customers.view', 'orders.view', 'orders.update', 'orders.confirm', 'payments.manage', 'deliveries.manage'],
  },
  { name: 'Technical Support', description: 'Maintains system access and monitors audit records', system: true, perms: ['staff.manage', 'audit.view'] },
];

const CATEGORIES = [
  ['Birthday Cakes', 'CAKE', 'Classic and themed birthday cakes'],
  ['Wedding Cakes', 'CAKE', 'Elegant tiered wedding and engagement cakes'],
  ['Cupcakes & Mini Cakes', 'CAKE', 'Cupcakes, jar cakes and mini treats'],
  ['Balloons', 'DECORATION', 'Latex, foil and number balloons'],
  ['Banners & Backdrops', 'DECORATION', 'Party banners, backdrops and bunting'],
  ['Tableware & Candles', 'DECORATION', 'Candles, cake toppers, plates and cups'],
];

// [category index, name, sku, price, stock, reorder, description, color, icon]
const PRODUCTS = [
  [0, 'Chocolate Fudge Birthday Cake (1kg)', 'CK-CHOC-1KG', 4800, 8, 3, 'Rich chocolate sponge layered with fudge ganache and finished with chocolate curls.', '#6b3e26', 'cake'],
  [0, 'Vanilla Rainbow Sprinkle Cake (1kg)', 'CK-VAN-RNB', 4200, 6, 3, 'Soft vanilla butter cake with rainbow sprinkles and buttercream swirls.', '#f4a6c1', 'cake'],
  [0, 'Ribbon Cake (1kg)', 'CK-RIBBON', 3500, 10, 4, 'The Sri Lankan favourite - colourful layered ribbon cake with butter icing.', '#f7c873', 'cake'],
  [0, 'Red Velvet Cream Cheese Cake (1kg)', 'CK-REDVEL', 5200, 2, 3, 'Velvety red sponge with tangy cream-cheese frosting.', '#b3243a', 'cake'],
  [1, 'Two-Tier Floral Wedding Cake', 'CK-WED-2T', 28500, 2, 1, 'Elegant two-tier butter cake with sugar flowers. Serves about 60 guests.', '#e9dccd', 'tier'],
  [1, 'Traditional Wedding Cake Pieces (50)', 'CK-WED-PCS', 12500, 4, 2, 'Rich fruit cake pieces wrapped in gold foil, boxed for guests.', '#c9a227', 'tier'],
  [2, 'Assorted Cupcakes (Box of 12)', 'CK-CUP-12', 3000, 15, 5, 'A dozen vanilla and chocolate cupcakes with buttercream roses.', '#f2b5d4', 'cupcake'],
  [2, 'Jar Cakes (Set of 6)', 'CK-JAR-6', 2700, 0, 3, 'Layered cake in jars - biscoff, chocolate and strawberry.', '#d98e5f', 'cupcake'],
  [3, 'Pastel Latex Balloons (Pack of 25)', 'DC-BAL-PST25', 1200, 40, 10, 'Assorted pastel 12-inch latex balloons.', '#a7c7e7', 'balloon'],
  [3, 'Gold Number Foil Balloon (32")', 'DC-BAL-NUM', 950, 30, 10, 'Large gold foil number balloon - specify the number in the item note.', '#d4af37', 'balloon'],
  [3, 'Heart Foil Balloons (Set of 5)', 'DC-BAL-HRT', 1100, 6, 8, 'Red and pink heart-shaped foil balloons.', '#e0457b', 'balloon'],
  [3, 'Balloon Arch Kit (100 pcs)', 'DC-BAL-ARCH', 4500, 12, 4, 'Complete balloon garland kit with arch strip and glue dots.', '#9b8ae6', 'balloon'],
  [4, 'Happy Birthday Banner - Gold', 'DC-BAN-HBD', 850, 25, 8, 'Glitter gold "Happy Birthday" letter banner.', '#e3b448', 'banner'],
  [4, 'Sequin Shimmer Backdrop Wall', 'DC-BAN-SEQ', 6500, 5, 2, 'Rose gold sequin shimmer panels for photo backdrops.', '#e8b4a0', 'banner'],
  [4, 'Paper Bunting Flags (5m)', 'DC-BAN-BUNT', 600, 3, 6, 'Colourful paper triangle bunting, 5 metres.', '#5bc0be', 'banner'],
  [5, 'Number Candles - Gold', 'DC-TBL-CNDL', 250, 60, 15, 'Gold glitter number candle (0-9) - specify the number in the item note.', '#f0c75e', 'candle'],
  [5, 'Acrylic Cake Topper - Happy Birthday', 'DC-TBL-TOP', 750, 20, 5, 'Gold mirror acrylic "Happy Birthday" cake topper.', '#c79b3b', 'candle'],
  [5, 'Party Tableware Set (10 guests)', 'DC-TBL-SET', 1800, 18, 5, 'Plates, cups, napkins and cutlery for 10 guests.', '#7fb7be', 'plate'],
];

const ICONS = {
  cake: '<rect x="90" y="150" width="220" height="90" rx="14" fill="#fff" opacity=".92"/><rect x="90" y="150" width="220" height="26" rx="12" fill="#fff"/><path d="M90 176q27 18 55 0t55 0 55 0 55 0" stroke="COLOR" stroke-width="8" fill="none" opacity=".55"/><rect x="194" y="104" width="12" height="44" rx="4" fill="#fff"/><ellipse cx="200" cy="96" rx="8" ry="12" fill="#ffd166"/>',
  tier: '<rect x="120" y="180" width="160" height="70" rx="10" fill="#fff" opacity=".95"/><rect x="145" y="125" width="110" height="58" rx="10" fill="#fff" opacity=".9"/><rect x="170" y="80" width="60" height="48" rx="8" fill="#fff" opacity=".85"/><circle cx="200" cy="72" r="10" fill="#f28ab2"/>',
  cupcake: '<path d="M140 170h120l-18 80h-84z" fill="#fff" opacity=".9"/><path d="M130 172c0-50 30-80 70-80s70 30 70 80z" fill="#fff"/><circle cx="200" cy="86" r="11" fill="#e63946"/>',
  balloon: '<ellipse cx="170" cy="120" rx="48" ry="58" fill="#fff" opacity=".92"/><ellipse cx="238" cy="140" rx="42" ry="52" fill="#fff" opacity=".75"/><path d="M170 178q-10 40 20 80M238 192q10 30-20 66" stroke="#fff" stroke-width="3" fill="none"/>',
  banner: '<path d="M70 90q130 50 260 0" stroke="#fff" stroke-width="4" fill="none"/><path d="M92 99l24 62 22-54zM152 113l22 62 24-58zM214 116l22 60 22-62zM276 104l20 58 22-66z" fill="#fff" opacity=".9"/>',
  candle: '<rect x="150" y="120" width="26" height="120" rx="6" fill="#fff"/><rect x="224" y="120" width="26" height="120" rx="6" fill="#fff" opacity=".85"/><ellipse cx="163" cy="104" rx="9" ry="14" fill="#ffd166"/><ellipse cx="237" cy="104" rx="9" ry="14" fill="#ffd166"/>',
  plate: '<circle cx="200" cy="160" r="80" fill="#fff" opacity=".92"/><circle cx="200" cy="160" r="52" fill="none" stroke="COLOR" stroke-width="6" opacity=".4"/><rect x="92" y="95" width="10" height="130" rx="5" fill="#fff"/><rect x="298" y="95" width="10" height="130" rx="5" fill="#fff"/>',
};

function productSvg(name, color, icon) {
  const art = ICONS[icon].replace(/COLOR/g, color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".65"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#g)"/>${art}
<text x="200" y="285" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#fff" opacity=".9">${name.replace(/&/g, '&amp;').slice(0, 42)}</text>
</svg>`;
}

const fakeReq = (actor) => ({ ...actor, ip: '127.0.0.1', get: () => 'seed-script' });

async function seed({ silent = false, withSampleOrders = true } = {}) {
  const log = (...a) => !silent && console.log(...a);
  const credentials = {
    'admin@devma.lk': makePassword(),
    'staff@devma.lk': makePassword(),
    'support@devma.lk': makePassword(),
    'customer@devma.lk': makePassword(),
  };

  // ---- Roles & permissions ----
  const permIds = {};
  for (const p of PERMISSIONS) {
    const r = await query('INSERT INTO permissions (code, description, module) VALUES (?,?,?)', [p.code, p.description, p.module]);
    permIds[p.code] = r.insertId;
  }
  const roleIds = {};
  for (const def of ROLE_DEFS) {
    const r = await query('INSERT INTO roles (name, description, is_system) VALUES (?,?,?)', [def.name, def.description, def.system ? 1 : 0]);
    roleIds[def.name] = r.insertId;
    await query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [def.perms.map((c) => [r.insertId, permIds[c]])]);
  }

  // ---- Staff ----
  const staffIds = {};
  const staffRows = [
    ['Devma Owner', 'admin@devma.lk', '0771234567', 'Admin'],
    ['Nimali Perera', 'staff@devma.lk', '0712345678', 'Shop Staff'],
    ['Kasun Silva', 'support@devma.lk', '0759876543', 'Technical Support'],
  ];
  for (const [name, email, phone, role] of staffRows) {
    const hash = await bcrypt.hash(credentials[email], 10);
    const r = await query(
      'INSERT INTO staff (full_name, email, phone, password_hash, role_id, must_change_password, created_by) VALUES (?,?,?,?,?,0,?)',
      [name, email, phone, hash, roleIds[role], staffIds['admin@devma.lk'] || null]
    );
    staffIds[email] = r.insertId;
  }

  // ---- Customers ----
  const customerRows = [
    ['Tharushi Fernando', 'customer@devma.lk', '0779988776', '12 Flower Road', 'Colombo 07'],
    ['Ravindu Jayasinghe', 'ravindu@example.com', '0701122334', '45 Temple Lane', 'Kandy'],
    ['Amaya Wickramasinghe', 'amaya@example.com', '0765544332', '8 Lake Drive', 'Nugegoda'],
  ];
  const customerIds = [];
  for (const [i, [name, email, phone, address, city]] of customerRows.entries()) {
    const pw = i === 0 ? credentials['customer@devma.lk'] : crypto.randomBytes(12).toString('hex');
    const r = await query(
      'INSERT INTO customers (full_name, email, phone, address, city, password_hash) VALUES (?,?,?,?,?,?)',
      [name, email, phone, address, city, await bcrypt.hash(pw, 10)]
    );
    customerIds.push({ id: r.insertId, full_name: name, phone, address, city });
  }

  // ---- Categories & products ----
  const catIds = [];
  for (const [name, type, desc] of CATEGORIES) {
    const r = await query('INSERT INTO categories (name, type, description) VALUES (?,?,?)', [name, type, desc]);
    catIds.push({ id: r.insertId, type });
  }
  const seedImgDir = path.join(uploadDir, 'seed');
  fs.mkdirSync(seedImgDir, { recursive: true });
  const productIds = {};
  for (const [ci, name, sku, price, stock, reorder, desc, color, icon] of PRODUCTS) {
    const file = `${sku.toLowerCase()}.svg`;
    fs.writeFileSync(path.join(seedImgDir, file), productSvg(name, color, icon));
    const r = await query(
      `INSERT INTO products (category_id, name, sku, description, price, image_url, product_type, stock_quantity, reorder_level, created_by, updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [catIds[ci].id, name, sku, desc, price, `/uploads/seed/${file}`, catIds[ci].type, stock, reorder, staffIds['admin@devma.lk'], staffIds['admin@devma.lk']]
    );
    productIds[sku] = r.insertId;
    if (stock > 0) {
      await query(
        `INSERT INTO inventory_transactions (product_id, change_qty, type, reason, balance_after, staff_id) VALUES (?,?, 'INITIAL', 'Opening stock', ?, ?)`,
        [r.insertId, stock, stock, staffIds['admin@devma.lk']]
      );
    }
  }
  // One product the shop has temporarily stopped selling.
  await query('UPDATE products SET is_available = 0 WHERE sku = ?', ['CK-WED-PCS']);

  if (withSampleOrders) await seedOrders({ staffIds, customerIds, productIds });

  if (!silent) {
    const lines = Object.entries(credentials).map(([e, p]) => `  ${e.padEnd(22)} ${p}`).join('\n');
    const text = `Devma demo accounts (demo use only - generated ${new Date().toISOString()})\n` +
      `Staff portal:  http://localhost:5173/staff/login\nCustomer site: http://localhost:5173/login\n\n${lines}\n`;
    if (!isTest) fs.writeFileSync(path.join(__dirname, '..', '.seed-credentials'), text);
    log('\nSeed complete.\n');
    log(text);
    log('(Saved to server/.seed-credentials)');
  }
  return credentials;
}

/** Creates realistic sample orders through the same service logic the API uses. */
async function seedOrders({ staffIds, customerIds, productIds }) {
  const svc = require('../src/services/order.service');
  const admin = fakeReq({ staff: { id: staffIds['admin@devma.lk'], full_name: 'Devma Owner' } });
  const clerk = fakeReq({ staff: { id: staffIds['staff@devma.lk'], full_name: 'Nimali Perera' } });
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const place = (customer, payload) => svc.createOrder(fakeReq({ customer }), payload, null);
  /** Shifts an order and everything recorded against it `daysAgo` days into the past. */
  const backdate = async (orderId, daysAgo) => {
    const shift = (table, cols) => query(
      `UPDATE ${table} SET ${cols.map((c) => `${c} = IF(${c} IS NULL, NULL, DATE_SUB(${c}, INTERVAL ? DAY))`).join(', ')} WHERE order_id = ?`,
      [...cols.map(() => daysAgo), orderId]
    );
    await query(
      `UPDATE orders SET created_at = DATE_SUB(created_at, INTERVAL ? DAY), confirmed_at = IF(confirmed_at IS NULL, NULL, DATE_SUB(confirmed_at, INTERVAL ? DAY)),
              completed_at = IF(completed_at IS NULL, NULL, DATE_SUB(completed_at, INTERVAL ? DAY)) WHERE id = ?`,
      [daysAgo, daysAgo, daysAgo, orderId]
    );
    await shift('order_status_history', ['created_at']);
    await shift('payments', ['paid_at', 'created_at']);
    await shift('notifications', ['created_at']);
    await shift('inventory_transactions', ['created_at']);
    await shift('deliveries', ['completed_at']);
    await query(`UPDATE orders SET order_number = CONCAT('DCP-', DATE_FORMAT(created_at, '%Y%m%d'), '-', LPAD(id, 4, '0')) WHERE id = ?`, [orderId]);
    await query(
      `UPDATE notifications n JOIN orders o ON o.id = n.order_id SET n.message = REGEXP_REPLACE(n.message, 'DCP-[0-9]{8}-[0-9]{4}', o.order_number) WHERE o.id = ?`,
      [orderId]
    );
  };
  const [tharushi, ravindu, amaya] = customerIds;

  // 1. Completed birthday order (delivered, fully paid)
  let o = await place(tharushi, {
    items: [{ productId: productIds['CK-CHOC-1KG'], quantity: 1, notes: 'Happy 7th Birthday Senuli' },
      { productId: productIds['DC-BAL-PST25'], quantity: 2 }, { productId: productIds['DC-TBL-CNDL'], quantity: 1, notes: 'Number 7' }],
    fulfillmentType: 'DELIVERY', eventDate: day(-12),
    delivery: { address: '12 Flower Road', city: 'Colombo 07', preferredTimeSlot: '9am - 12pm' },
  });
  await svc.confirmOrder(clerk, o.id, { deliveryFee: 500, note: 'Confirmed by phone' });
  await svc.recordPayment(clerk, o.id, { amount: 3000, method: 'BANK_TRANSFER', referenceNo: 'BOC-55120' });
  for (const s of ['IN_PREPARATION', 'READY']) await svc.changeStatus(clerk, o.id, { status: s });
  await svc.updateDelivery(clerk, o.id, { type: 'DELIVERY', recipientName: 'Tharushi Fernando', contactPhone: '0779988776', address: '12 Flower Road', city: 'Colombo 07', scheduledDate: day(-12), scheduledTimeSlot: '9am - 12pm', assignedStaffId: staffIds['staff@devma.lk'] });
  await svc.changeStatus(clerk, o.id, { status: 'OUT_FOR_DELIVERY' });
  const [od1] = await query('SELECT total_amount FROM orders WHERE id = ?', [o.id]);
  await svc.recordPayment(clerk, o.id, { amount: od1.total_amount - 3000, method: 'CASH', notes: 'Paid on delivery' });
  await svc.changeStatus(clerk, o.id, { status: 'COMPLETED' });
  await backdate(o.id, 14);

  // 2. Custom wedding cake - confirmed, in preparation, partially paid, collection
  o = await place(ravindu, {
    items: [{ productId: productIds['DC-BAN-SEQ'], quantity: 1 }],
    cakeRequirement: {
      occasion: 'Wedding', flavor: 'Butter cake with chocolate layer', weightKg: 5, shape: 'Round', tiers: 3,
      icingType: 'Fondant', colors: 'White and gold', theme: 'Classic floral', messageOnCake: 'Ravindu & Dilini',
      dietaryNotes: 'No nuts', additionalDetails: 'Fresh white roses cascading down one side.',
    },
    fulfillmentType: 'COLLECTION', eventDate: day(5), notes: 'Please call before finalising the design.',
  });
  await svc.confirmOrder(admin, o.id, { cakeQuote: 32000, note: 'Design agreed with customer' });
  await svc.recordPayment(admin, o.id, { amount: 15000, method: 'ONLINE_TRANSFER', referenceNo: 'HNB-99812', notes: 'Advance' });
  await svc.changeStatus(clerk, o.id, { status: 'IN_PREPARATION' });
  await svc.updateDelivery(clerk, o.id, { type: 'COLLECTION', recipientName: 'Ravindu Jayasinghe', contactPhone: '0701122334', scheduledDate: day(5), scheduledTimeSlot: '8am - 10am' });
  await backdate(o.id, 6);

  // 3. Pending order awaiting confirmation (custom cake + decorations)
  o = await place(amaya, {
    items: [{ productId: productIds['DC-BAL-NUM'], quantity: 2, notes: 'Numbers 2 and 1' }, { productId: productIds['DC-BAN-HBD'], quantity: 1 }],
    cakeRequirement: { occasion: 'Birthday', flavor: 'Red velvet', weightKg: 2, shape: 'Heart', tiers: 1, icingType: 'Cream cheese', colors: 'Pink and white', theme: 'Minimal', messageOnCake: 'Happy 21st Amaya' },
    fulfillmentType: 'DELIVERY', eventDate: day(3),
    delivery: { address: '8 Lake Drive', city: 'Nugegoda', preferredTimeSlot: '3pm - 6pm' },
  });
  await backdate(o.id, 1);

  // 4. Pending simple order from the demo customer
  o = await place(tharushi, {
    items: [{ productId: productIds['CK-CUP-12'], quantity: 1 }, { productId: productIds['DC-TBL-SET'], quantity: 1 }],
    fulfillmentType: 'COLLECTION', eventDate: day(2),
  });

  // 5. Ready for collection, fully paid
  o = await place(amaya, {
    items: [{ productId: productIds['CK-RIBBON'], quantity: 2 }],
    fulfillmentType: 'COLLECTION', eventDate: day(1),
  });
  await svc.confirmOrder(clerk, o.id, {});
  await svc.recordPayment(clerk, o.id, { amount: 7000, method: 'CARD', referenceNo: 'POS-2231' });
  for (const s of ['IN_PREPARATION', 'READY', 'READY_FOR_COLLECTION']) await svc.changeStatus(clerk, o.id, { status: s });
  await backdate(o.id, 3);

  // 6. Cancelled order (stock restored)
  o = await place(ravindu, {
    items: [{ productId: productIds['DC-BAL-ARCH'], quantity: 1 }],
    fulfillmentType: 'DELIVERY', eventDate: day(8), delivery: { address: '45 Temple Lane', city: 'Kandy' },
  });
  await svc.confirmOrder(clerk, o.id, { deliveryFee: 1200 });
  await svc.changeStatus(clerk, o.id, { status: 'CANCELLED', note: 'Customer postponed the event' });
  await backdate(o.id, 9);

  // 7-10. A few completed orders across the last month for the dashboard charts
  const history = [[tharushi, 'CK-VAN-RNB', 1, 25], [ravindu, 'CK-CUP-12', 2, 20], [amaya, 'CK-CHOC-1KG', 1, 8], [tharushi, 'CK-RIBBON', 1, 4]];
  for (const [cust, sku, qty, ago] of history) {
    o = await place(cust, { items: [{ productId: productIds[sku], quantity: qty }, { productId: productIds['DC-TBL-CNDL'], quantity: 2 }], fulfillmentType: 'COLLECTION', eventDate: day(-ago + 1) });
    await svc.confirmOrder(clerk, o.id, {});
    const [row] = await query('SELECT total_amount FROM orders WHERE id = ?', [o.id]);
    await svc.recordPayment(clerk, o.id, { amount: row.total_amount, method: 'CASH' });
    for (const s of ['IN_PREPARATION', 'READY', 'READY_FOR_COLLECTION', 'COMPLETED']) await svc.changeStatus(clerk, o.id, { status: s });
    await backdate(o.id, ago);
  }
}

module.exports = { seed };

if (require.main === module) {
  seed()
    .catch((err) => {
      console.error('Seeding failed:', err.message);
      if (err.code === 'ER_DUP_ENTRY') console.error('The database already has data. Run "npm run db:reset" first (or "npm run setup").');
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

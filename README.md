# Devma Cake n' Party Management System

Web-based Cake and Party Decoration Management System for **Devma Cake n' Party**
(ISPM 2026 · Project ID **ISE_WE_0101_30**).

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router, plain CSS3 |
| Backend | Node.js + Express (REST API) |
| Database | MySQL 8 |
| Testing | Jest + Supertest (API), Postman collection |
| Hosting | Local (Node + your own MySQL server) · Vercel (static + serverless API) with managed MySQL and Vercel Blob |

## Quick start (one script, your own MySQL)

You need **[Node.js 20+](https://nodejs.org)** and a running **MySQL 8 server** (the one you open in MySQL Workbench). No Docker.

| Windows | macOS / Linux |
|---|---|
| Double-click **`start.bat`** | Run **`./start.sh`** (or `npm install && npm start`) |

The first run installs the dependencies, asks for the MySQL login you use in Workbench (saved to `server/.env`), creates the
`devma_cake_party` database with demo data, then starts the API and the website and opens http://localhost:5173.
Every demo login on a fresh setup uses the password **`Devma@2026`** (`admin@devma.lk`, `staff@devma.lk`, `support@devma.lk`,
`customer@devma.lk`); the exact passwords are in `server/.seed-credentials`.

The home page has **Quick links** buttons for every shop, customer and staff/admin page, and a **Staff / Admin** button in the top bar.

The step-by-step guide (starting MySQL, Workbench, a story-by-story test checklist and troubleshooting) is in **[docs/SETUP-GUIDE.md](docs/SETUP-GUIDE.md)**.

---

## 1. Prerequisites

- Node.js 22 LTS (20+ works)
- MySQL Server 8, running locally. MySQL Workbench is optional and only used to look at the data.

## 2. Setup

From the repo root (an npm workspace with `server/` and `client/`):

```bash
npm install
```

```bash
npm run setup
```

`npm run setup` (`scripts/setup.js`):

- creates `server/.env` from `server/.env.example` (random `JWT_SECRET`, and the MySQL host/port/user/password you type);
- checks the MySQL connection and explains what to fix if it fails;
- on the first run, creates the `devma_cake_party` database and all tables from `server/db/schema.sql`, and seeds roles,
  permissions, demo accounts, products and sample orders. Later runs keep your data.

To wipe everything and reload the demo data (asks you to type `yes`):

```bash
npm run db:reset
```

To choose your own demo password, set `SEED_PASSWORD` when resetting, e.g. `SEED_PASSWORD='YourPass123' npm run db:reset`.

## 3. Run

API and website together, with auto-reload (Ctrl+C stops both):

```bash
npm start
```

Or in two terminals: `npm run dev:api` (http://localhost:5000) and `npm run dev:web` (http://localhost:5173; Vite proxies `/api`
and `/uploads` to the API). `npm start` picks other ports automatically if 5000 or 5173 are taken (macOS AirPlay uses 5000).

| Area | URL | Demo account |
|---|---|---|
| Customer shop | http://localhost:5173 | `customer@devma.lk` |
| Staff portal | http://localhost:5173/staff/login | `admin@devma.lk` (Admin), `staff@devma.lk` (Shop Staff), `support@devma.lk` (Technical Support) |

Demo accounts are for local demonstration only.

## 4. Tests

The tests use a separate `devma_test` database, which is reset automatically:

```bash
npm test
```

There are 35 API tests. They cover every user story US01–US24 and the reports.

For manual API testing, import `docs/Devma.postman_collection.json` into Postman.

## 5. Deploy to Vercel

Everything runs as **one Vercel project**:

```
Browser ──► Vercel CDN ──► client/dist (React storefront + staff portal, static)
                 └─ /api/* ─► api/index.js (Express API as a serverless function)
                                   ├─► MySQL (managed: TiDB Cloud Serverless / Aiven)
                                   └─► Vercel Blob (uploaded product & cake images)
```

The storefront and API share one domain, so the login cookies work with no CORS setup.

| Piece | Where it runs | Config |
|---|---|---|
| Storefront + staff portal | Vercel static hosting | `vercel.json` → `outputDirectory: client/dist` |
| REST API | Vercel Function (`api/index.js`) | `vercel.json` rewrites `/api/*` |
| MySQL | Any managed MySQL 8 | `DATABASE_URL` (+ `DB_SSL=true`) |
| Image uploads | Vercel Blob | `BLOB_READ_WRITE_TOKEN` (set automatically) |
| CD | Vercel Git integration | Preview deploy per branch/PR, production deploy from `master` |

### One-time setup (about 15 minutes)

**1. Create a MySQL database.** Vercel doesn't host MySQL. Either free option works:
- **TiDB Cloud Serverless** (MySQL-compatible, free tier): create a cluster, then *Connect → General → Node.js*, and copy the `mysql://…` URL. It already includes TLS.
- **Aiven for MySQL** (free plan): copy the *Service URI*.

**2. Create the tables and demo data in that database**, from your machine, once:

```bash
DATABASE_URL='mysql://USER:PASSWORD@HOST:PORT/devma_cake_party' DB_SSL=true CONFIRM_DB_RESET=yes SEED_PASSWORD='ChooseAStrongPass1' npm run db:setup
```

`CONFIRM_DB_RESET=yes` is required because setup drops and recreates every table. Never run it against a database that has real orders.

**3. Import the project into Vercel:**
1. Go to vercel.com → **Add New… → Project** → import the GitHub repo `IT24100948/cake`.
2. Keep the root directory as the repo root. Framework preset *Other* is fine, because `vercel.json` sets the install, build and output settings.
3. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the URL from step 1 |
   | `DB_SSL` | `true` |
   | `JWT_SECRET` | a long random string (`openssl rand -hex 32`) |
   | `APP_TIMEZONE` | `Asia/Colombo` (optional; this is the default) |

4. Deploy.

**4. Enable image uploads:** in the Vercel project, go to **Storage → Create → Blob** and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`. Then redeploy once.

### Day-to-day flow

- **Push a branch or open a PR:** Vercel posts a **preview URL** on the PR. Run `npm test` locally first.
- **Merge to `master`:** Vercel deploys to **production** automatically.
- **Roll back:** in Vercel → *Deployments*, pick an older deployment → **Promote to Production**.

### Notes

- **Time zone:** the API pins the app clock and the MySQL session to Sri Lanka time (`APP_TIMEZONE` / `DB_TIMEZONE`), even though Vercel and managed databases run in UTC.
- **Connection pool:** each serverless instance keeps a small pool (`DB_POOL_SIZE`, default 3 on Vercel), which suits free database plans.
- **Product photos:** the demo products use free-licence Unsplash photos (listed by SKU in `server/db/productPhotos.js`), loaded from Unsplash's CDN. Staff uploads go to Vercel Blob.
- **Changing the schema later:** `db/schema.sql` recreates all tables, so it's for first-time setup only. For a live database, apply `ALTER TABLE …` changes by hand (or add a migration tool) instead of re-running setup.

---

## 6. Feature ↔ user story traceability

### EP01 – System User & Access Management
| Story | Where |
|---|---|
| US01 Create staff accounts | Staff portal → **Staff Accounts → Add staff** (temporary password; must be changed at first login) · `POST /api/staff` |
| US02 Assign roles & permissions | **Roles & Permissions** (permission matrix, custom roles) and the role dropdown on Staff Accounts · enforced on every API route by `requirePermission` |
| US03 Secure login | `/staff/login`. Passwords are hashed with bcrypt, and the session is a JWT in an httpOnly cookie. After 5 failed attempts the account locks for 15 minutes. |
| US04 Manage password | **Change password** (sidebar). Admins can use **Reset password**. A temporary password forces a change at the next login. |
| US05 Deactivate staff | **Deactivate / Activate** on Staff Accounts. A deactivated user is signed out on their next request. You can't deactivate yourself or the last administrator. |
| US06 Access & audit records | **Audit Records**: filter by access events, action, user type and date range, and expand each record's JSON details. |

### EP02 – Cake, Party Decoration Product & Inventory Management
| Story | Where |
|---|---|
| US07 Add products | **Products → Add product** (category, SKU, price, image upload, opening stock, reorder level) |
| US08 View & search products | **Products** (search, type/category/availability/low-stock filters, sort) and the product detail page |
| US09 Update product info | **Products → Edit**: price, description, image and availability. The Hide/Show toggle is in the product list. |
| US10 Manage inventory | **Inventory**: restock, stock-take (set quantity) or remove stock, each with a reason. Low-stock and out-of-stock items are highlighted, and every product has a movement history. |
| US11 Browse products | Customer **Shop**: cakes and decorations tabs, categories, search, sort, product page. Only available products are shown. |

### EP03 – Customer & Cake Order Management
| Story | Where |
|---|---|
| US12 Customer account | **Sign up** / **Log in** / **Profile** (details and password) |
| US13 Cake requirements | **Custom Cake** form: occasion, flavour, weight, shape, tiers, icing, colours, theme, message, dietary notes, reference image |
| US14 Select decorations | Add decorations from the Shop to the **Cart**, with a quantity and an optional note (e.g. a balloon number) |
| US15 Submit order | **Checkout**: required date, delivery or collection, address, time slot, notes and **payment option**. Custom cakes are pre-orders: at least 3 days' notice and online payment only. Orders without a custom cake can be *pay online* or *cash on delivery/collection*. The order gets a number like `DCP-YYYYMMDD-NNNN`. |
| US16 View customer & order details | Staff **Orders** (status tabs, search, filters), **Order detail**, **Customers** list and customer detail |
| US17 Update order details & status | Order detail → **Edit details**. Items can be changed while the order is pending; after confirmation you can change the cake requirements, quote, delivery fee, date and notes. Status changes follow the allowed flow. |
| US18 Order status & history | Customer **My Orders** (current and history tabs) and order page with a progress stepper and timeline. Customers can cancel while the order is pending. |

### EP04 – Order Confirmation, Payment & Delivery Management
| Story | Where |
|---|---|
| US19 Confirm orders | Order detail → **Confirm order**. You set the custom cake price and delivery fee, and the total is recalculated. Stock is reserved at this point, in one transaction; if stock is short, confirmation is refused. |
| US20 Record payment | **Online:** the customer must enter a card at checkout. The gateway verifies it (no money taken) and the order keeps only a token. When staff confirm the final total, the card is **charged automatically**. If that charge is declined, the customer pays from their order page with another card (see *Payments* below). **Cash on delivery:** staff use Order detail → **Record payment** when the cash is received. Online orders accept only bank/online transfers from staff, never cash. All of these appear in the **Payments** list. |
| US21 Update payment status | Updates automatically: Unpaid → Partially paid → Paid → Refunded, from the payments and refunds recorded. Cancelling or rejecting a paid order **refunds it automatically**: card payments go back to the card and cash/transfers are recorded as returned. |
| US22 Delivery / collection | Order detail → **Edit / schedule**: method, recipient, address, date, time slot and assigned staff. The **Delivery & Collection** board shows the day's work. |
| US23 Status until completion | Pending → Confirmed → In preparation → Ready → Out for delivery / Ready for collection → Completed. Online (pre-paid) orders can't start preparation until they're paid. Completion requires full payment. A failed delivery returns the order to Ready. Cancelling a confirmed order returns its stock. |
| US24 Receive status information | In-app notifications (bell with unread count, Notifications page) for every status, payment and delivery change, plus the order timeline |

### Payments (prototype, no third party)
Online payments go through **DevmaPay sandbox** (`server/src/services/paymentGateway.js`), a gateway built into the API that behaves like a real card processor but moves no money:

- **Card at checkout:** choosing *Pay online* requires card details before the order can be placed. The gateway verifies the card, without taking money, and returns a token. That token is saved in `payment_methods` with only the brand, last 4 digits and expiry. A declined card means the order is **not** placed.
- **Charge on confirmation:** confirming the order charges the saved card for the final total, including the custom cake price and delivery fee set by staff. If it's declined, the order waits for payment and the customer is told to pay from the order page.
- **Card checks:** card number (Luhn check and brand), expiry and CVC are validated on both the client and the server.
- **Test cards only:** the result depends on which test card is used. Any other card number, including a real one, is declined.

  | Card | Result |
  |---|---|
  | `4242 4242 4242 4242` (Visa), `5555 5555 5555 4444` (Mastercard) | Payment succeeds |
  | `4000 0000 0000 0002` | Declined by the bank |
  | `4000 0000 0000 9995` | Accepted at checkout, then declined when charged (insufficient funds), so it shows the "pay with another card" path |
  | `4000 0000 0000 0069` | Card expired |
  | `4000 0000 0000 0127` | Incorrect CVC |

  Any future expiry date and any 3-digit CVC work.
- **Gateway log:** every charge, decline and refund is stored in `payment_transactions` with a gateway reference. Only the card brand and last 4 digits are kept, never the full number or the CVC.
- **No double charges:**
  - each payment attempt carries an idempotency key, so a double-click or a network retry can't charge twice;
  - the order row is locked while paying, so two simultaneous payments can't both succeed;
  - the amount must match the balance due, so a total changed by staff in the meantime is caught.
- **Refunds:** refunds are stored as `payments` rows of kind `REFUND`. Net paid, revenue and the Payments list all subtract them.
- **Older databases:** `server/db/migrate.js` adds these tables and columns automatically on start.

### Management & Reporting (Solution Outline, Key Benefit 7)
The staff **Dashboard** shows:

- KPIs: pending orders, orders in progress, revenue, outstanding balances, low stock and customers;
- a sales report for a date range, with a daily revenue chart, breakdowns by payment method and product type, and custom-cake totals;
- orders by status and top products;
- orders due in the next 7 days and a low-stock list.

## 7. Storefront experience (Cake n’ Party landing)

The customer home page (`client/src/landing/`) is a premium, hands-on storefront built on the same React app. It isn't a separate demo: every action on it feeds the real ordering system above.

| Section | What it does | Wired to |
|---|---|---|
| Hero | A 3D celebration cake. It floats gently, tilts toward the cursor and turns when dragged, with inertia. The glaze highlight follows the key light, and the cake turns and moves closer as you scroll. | — |
| Icing dividers | Art-directed SVG edges between sections (`drip-down`, `cream-wave`, `piped-edge`). The glaze drips "pour" when scrolled into view. | — |
| Trust bar, Creations | The four brand promises, and five category cards (an editorial grid on desktop, a snap carousel on mobile) | Catalogue categories (`/shop?category=…`) |
| **Build Your Cake** | Choose cake, frosting, decoration and size. The 3D cake recolours, re-tiers and re-decorates live, and "See inside" slices it to show the sponge and fillings. The estimated price updates with a spring animation. **Add to Order** captures a thumbnail of your cake and flies it into the cart. | The cart's custom-cake request (US13), the real checkout (US15) and the staff quote (US19) |
| Signature, Moments, Gallery | Editorial showcase, social-proof collage and magazine-style gallery | "Reserve this cake" pre-loads the builder |
| Cart drawer | Your items and designed cake, a celebration date, and Continue to Checkout | Real cart and checkout |

**Typography:**
- **Cormorant** for display. It's a high-contrast Garamond whose calligraphic italics give the patisserie-menu feel, e.g. “*with Cake.*”
- **Jost** for UI and body. It's a geometric sans in the Futura tradition, the typeface of classic bakery boxes.
- **Pinyon Script** is the only accent. It's copperplate, the lettering style piped onto celebration cakes, and is used just for handwritten notes.

**3D:**
- The cake is procedural and parametric (`landing/three/Cake.jsx`), built with React Three Fiber:
  - lathe-turned tiers with hand-frosted wobble and a spatula-stroke bump map;
  - glossy glaze drips;
  - fluted piped rosettes;
  - seeded strawberries, sugar flowers, candles and a ceramic stand.
- The studio lighting is local (Lightformers), so no network HDRI is needed.
- The canvas lazy-loads as its own chunk, pauses rendering when off-screen, and caps the device pixel ratio at 1.75.
- `prefers-reduced-motion` turns off floating, pointer-follow, fly-to-cart and scroll camera movement.

**Swapping in a scanned cake later:** follow the steps in `client/src/landing/three/CakeModel.jsx`:
1. Drop a GLB into `client/public/models/`.
2. Uncomment the `useGLTF` component.
3. Use it in `HeroCake.jsx`.

The builder keeps the parametric cake, because it has to recolour and slice.

**Photography:** free-licence Unsplash images served from their CDN (landing photos in `landing/data.js`, product photos in `server/db/productPhotos.js`). Replace them with Devma's own photos when available. The testimonials in the Moments section are placeholders and must be replaced with real customer reviews before launch.

## 8. Roles (seeded)
| Role | Permissions |
|---|---|
| Admin | Everything. It's a system role and always keeps full access. |
| Shop Staff | View products and customers, view/update/confirm orders, manage payments and deliveries |
| Technical Support | Manage staff accounts, view audit records |

Admins can create more roles, such as a delivery-only driver role, on the **Roles & Permissions** page.

## 9. Project structure
```
start.bat / start.sh    one-click local start (reset.* wipes and re-seeds the database)
scripts/setup.js        creates server/.env, checks MySQL, creates + seeds the database
scripts/start.js        runs setup, then the API and the website together
api/index.js            Vercel serverless entry (wraps the Express app)
vercel.json             build, routing and cache rules for Vercel
server/
  db/schema.sql         MySQL schema (16 tables)
  db/seed.js            demo data (orders are created through the real order service)
  src/routes            REST routes + express-validator rules
  src/controllers       request handlers
  src/services          order workflow (confirmation, stock, payments, delivery, notifications)
  src/middleware        auth (JWT cookie, permissions), validation, uploads, errors
  tests/                Jest + Supertest API tests
client/
  src/landing           Cake n’ Party landing: sections, 3D cake (three/), builder options & pricing
  src/components/site   storefront header, cart drawer, footer
  src/pages/public      shop, product, login, register
  src/pages/customer    cart, custom cake, checkout, my orders, notifications, profile
  src/pages/staff       dashboard, orders, customers, payments, deliveries, products, inventory, staff, roles, audit
  src/components        shared UI (modal, badges, timeline, image upload…)
  src/styles            plain CSS design system
docs/Devma.postman_collection.json
```

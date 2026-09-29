# Devma Cake n' Party Management System

Web-based Cake and Party Decoration Management System for **Devma Cake n' Party**
(ISPM 2026 · Project ID **ISE_WE_0101_30**).

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router, plain CSS3 |
| Backend | Node.js + Express (REST API) |
| Database | MySQL 8 |
| Testing | Jest + Supertest (API), Postman collection |
| Hosting | Vercel (static + serverless API), managed MySQL, Vercel Blob; CI on GitHub Actions |

---

## 1. Prerequisites

- Node.js 22 (20+ works)
- MySQL 8. On macOS:

  ```bash
  brew install mysql
  ```

  ```bash
  brew services start mysql
  ```

## 2. Setup

The repo is an npm workspace (`server/` and `client/`). Install everything once, from the repo root:

```bash
npm install && cp server/.env.example server/.env
```

Edit `server/.env`:

- Set `DB_USER` and `DB_PASSWORD` for your MySQL.
- Set `JWT_SECRET` to a long random string.

Then create the database and load the demo data:

```bash
npm run db:setup
```

`npm run db:setup` does two things:

- creates the `devma_cake_party` database and all tables from `server/db/schema.sql`;
- seeds roles, permissions, demo accounts, products and sample orders.

The demo passwords are random. They're printed once and saved to `server/.seed-credentials`. To choose your own demo password instead, run:

```bash
SEED_PASSWORD='YourPass123' npm run db:setup
```

## 3. Run

Open two terminals, both at the repo root.

API on http://localhost:5000:

```bash
npm run dev:api
```

Web app on http://localhost:5173 (Vite proxies `/api` and `/uploads` to the API):

```bash
npm run dev:web
```

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

There are 35 API tests. They cover every user story US01–US24 and the reports. GitHub Actions runs the same tests on every push (see §5).

For manual API testing, import `docs/Devma.postman_collection.json` into Postman.

## 5. Deploy to Vercel (CI/CD)

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
| CI | GitHub Actions (`.github/workflows/ci.yml`) | Runs API tests on MySQL 8 and builds the client on every push/PR |
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

**5. (Recommended) Protect `master`:** on GitHub, open *Settings → Branches → Add rule for `master`* and require the **CI / API tests + storefront build** check. Vercel production then only ever receives code that passed the tests.

### Day-to-day flow

- **Push a branch or open a PR:** CI runs the tests, and Vercel posts a **preview URL** on the PR.
- **Merge to `master`:** Vercel deploys to **production** automatically.
- **Roll back:** in Vercel → *Deployments*, pick an older deployment → **Promote to Production**.

### Notes

- **Time zone:** the API pins the app clock and the MySQL session to Sri Lanka time (`APP_TIMEZONE` / `DB_TIMEZONE`), even though Vercel and managed databases run in UTC.
- **Connection pool:** each serverless instance keeps a small pool (`DB_POOL_SIZE`, default 3 on Vercel), which suits free database plans.
- **Seed images:** the demo product artwork is in `client/public/seed-images/` and is served by the CDN. Staff uploads go to Vercel Blob.
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
| US15 Submit order | **Checkout**: required date, delivery or collection, address, time slot and notes. The order gets a number like `DCP-YYYYMMDD-NNNN`. |
| US16 View customer & order details | Staff **Orders** (status tabs, search, filters), **Order detail**, **Customers** list and customer detail |
| US17 Update order details & status | Order detail → **Edit details**. Items can be changed while the order is pending; after confirmation you can change the cake requirements, quote, delivery fee, date and notes. Status changes follow the allowed flow. |
| US18 Order status & history | Customer **My Orders** (current and history tabs) and order page with a progress stepper and timeline. Customers can cancel while the order is pending. |

### EP04 – Order Confirmation, Payment & Delivery Management
| Story | Where |
|---|---|
| US19 Confirm orders | Order detail → **Confirm order**. You set the custom cake price and delivery fee, and the total is recalculated. Stock is reserved at this point, in one transaction; if stock is short, confirmation is refused. |
| US20 Record payment | Order detail → **Record payment** (amount ≤ balance, method, reference for non-cash) and the **Payments** list |
| US21 Update payment status | Updates automatically: Unpaid → Partially paid → Paid. **Change status** is available for corrections and refunds, validated against the recorded payments. |
| US22 Delivery / collection | Order detail → **Edit / schedule**: method, recipient, address, date, time slot and assigned staff. The **Delivery & Collection** board shows the day's work. |
| US23 Status until completion | Pending → Confirmed → In preparation → Ready → Out for delivery / Ready for collection → Completed. Completion requires full payment. A failed delivery returns the order to Ready. Cancelling a confirmed order returns its stock. |
| US24 Receive status information | In-app notifications (bell with unread count, Notifications page) for every status, payment and delivery change, plus the order timeline |

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

**Photography:** free-licence Unsplash images served from their CDN (IDs in `landing/data.js`). Replace them with Devma's own photos when available. The testimonials in the Moments section are placeholders and must be replaced with real customer reviews before launch.

## 8. Roles (seeded)
| Role | Permissions |
|---|---|
| Admin | Everything. It's a system role and always keeps full access. |
| Shop Staff | View products and customers, view/update/confirm orders, manage payments and deliveries |
| Technical Support | Manage staff accounts, view audit records |

Admins can create more roles, such as a delivery-only driver role, on the **Roles & Permissions** page.

## 9. Project structure
```
api/index.js            Vercel serverless entry (wraps the Express app)
vercel.json             build, routing and cache rules for Vercel
.github/workflows/ci.yml  CI: API tests on MySQL 8 + client build
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

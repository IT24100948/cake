# Devma Cake n' Party Management System

Web-based Cake and Party Decoration Management System for **Devma Cake n' Party**
(ISPM 2026 · Project ID **ISE_WE_0101_30**).

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router, plain CSS3 |
| Backend | Node.js + Express (REST API) |
| Database | MySQL 8 |
| Testing | Jest + Supertest (API), Postman collection |

---

## 1. Prerequisites

- Node.js 18 or newer
- MySQL 8. On macOS:

  ```bash
  brew install mysql
  ```

  ```bash
  brew services start mysql
  ```

## 2. Setup

```bash
cd server && npm install && cp .env.example .env
```

Edit `server/.env`:

- Set `DB_USER` and `DB_PASSWORD` for your MySQL.
- Set `JWT_SECRET` to a long random string.

Then create the database and load the demo data:

```bash
npm run setup
```

`npm run setup` does two things:

- creates the `devma_cake_party` database and all tables from `server/db/schema.sql`;
- seeds roles, permissions, demo accounts, products and sample orders.

The demo passwords are random. They're printed once and saved to `server/.seed-credentials`. To choose your own demo password instead, run:

```bash
SEED_PASSWORD='YourPass123' npm run setup
```

Install the frontend:

```bash
cd ../client && npm install
```

## 3. Run

Open two terminals.

API on http://localhost:5000:

```bash
cd server && npm run dev
```

Web app on http://localhost:5173 (Vite proxies `/api` and `/uploads` to the API):

```bash
cd client && npm run dev
```

| Area | URL | Demo account |
|---|---|---|
| Customer shop | http://localhost:5173 | `customer@devma.lk` |
| Staff portal | http://localhost:5173/staff/login | `admin@devma.lk` (Admin), `staff@devma.lk` (Shop Staff), `support@devma.lk` (Technical Support) |

Demo accounts are for local demonstration only.

## 4. Tests

The tests use a separate `devma_test` database, which is reset automatically:

```bash
cd server && npm test
```

There are 35 API tests. They cover every user story US01–US24 and the reports.

For manual API testing, import `docs/Devma.postman_collection.json` into Postman.

---

## 5. Feature ↔ user story traceability

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

## 6. Roles (seeded)
| Role | Permissions |
|---|---|
| Admin | Everything. It's a system role and always keeps full access. |
| Shop Staff | View products and customers, view/update/confirm orders, manage payments and deliveries |
| Technical Support | Manage staff accounts, view audit records |

Admins can create more roles, such as a delivery-only driver role, on the **Roles & Permissions** page.

## 7. Project structure
```
server/
  db/schema.sql         MySQL schema (16 tables)
  db/seed.js            demo data (orders are created through the real order service)
  src/routes            REST routes + express-validator rules
  src/controllers       request handlers
  src/services          order workflow (confirmation, stock, payments, delivery, notifications)
  src/middleware        auth (JWT cookie, permissions), validation, uploads, errors
  tests/                Jest + Supertest API tests
client/
  src/pages/public      home, shop, product, login, register
  src/pages/customer    cart, custom cake, checkout, my orders, notifications, profile
  src/pages/staff       dashboard, orders, customers, payments, deliveries, products, inventory, staff, roles, audit
  src/components        shared UI (modal, badges, timeline, image upload…)
  src/styles            plain CSS design system
docs/Devma.postman_collection.json
```

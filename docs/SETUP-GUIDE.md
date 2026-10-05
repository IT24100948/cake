# Devma Cake n' Party — Setup & Test Guide

Run the complete system (shop, staff portal, API and MySQL database) on your own computer
with **one script**. No Docker. It uses the **MySQL server you already manage with MySQL Workbench**.

You need two things installed:

| What | Why | Get it |
|---|---|---|
| **Node.js 20 or newer** (22 LTS recommended) | Runs the website and the API | https://nodejs.org → *LTS* installer, keep the defaults |
| **MySQL Server 8** (+ MySQL Workbench) | Stores the data | Usually already installed with Workbench. If not, see Step 1 below. |

> **MySQL Workbench is only a viewer/editor.** It connects to a *MySQL Server*. If you can open your
> *Local instance* in Workbench and run `SELECT 1;`, you already have a running MySQL Server and you're ready.

After the script finishes, the database is created and filled with demo data, the logins below work, and your browser opens.

---

## Login details

On a fresh setup every demo account uses the same password: **`Devma@2026`**
(the exact passwords are always saved in `server/.seed-credentials`).

| Who | Email | What they can do | Where |
|---|---|---|---|
| **Admin** (business owner) | `admin@devma.lk` | Everything: dashboard, orders, products, inventory, staff accounts, roles, audit log | http://localhost:5173/staff/login |
| **Shop Staff** | `staff@devma.lk` | Orders, customers, payments, delivery, view products | http://localhost:5173/staff/login |
| **Technical Support** | `support@devma.lk` | Staff accounts, audit records | http://localhost:5173/staff/login |
| **Customer** | `customer@devma.lk` | Shop, build a cake, checkout, track orders, notifications | http://localhost:5173/login |

Every page (shop, customer account, staff and admin portal) is also linked from the **Quick links** buttons on the home page,
and the **Staff / Admin** button in the top bar opens the staff portal.

> These are demo credentials for local testing only.

---

## Windows 11 — complete setup from a fresh PC (no Docker)

About 20 minutes, mostly downloads. You install three things once: **Node.js**, **MySQL Server** and (optionally) **MySQL Workbench**.

### W1. Install Node.js
1. Go to https://nodejs.org and download the **LTS** *Windows Installer (.msi)*.
2. Run it and keep every default. The *"Tools for native modules"* checkbox isn't needed.
3. Open a **new** PowerShell window and check that `node -v` prints `v20` or newer.

(Or in PowerShell: `winget install OpenJS.NodeJS.LTS`, then open a new window.)

### W2. Install MySQL Server and set it up correctly
1. Go to https://dev.mysql.com/downloads/mysql/. Choose **MySQL Community Server 8.4 LTS**, *Microsoft Windows*, and download the **MSI Installer**.
   You don't need an Oracle account: click *"No thanks, just start my download"*.
2. Run the installer and choose **Typical**. At the end, leave **"Run MySQL Configurator"** ticked.
3. In **MySQL Configurator**, use these settings:

   | Screen | Setting |
   |---|---|
   | Data Directory | keep the default |
   | Type and Networking | *Development Computer*, **TCP/IP on port 3306**, *Open Windows Firewall port* can stay **unticked** (only this PC needs it) |
   | Accounts and Roles | **set a root password and write it down**. You'll type it once into the setup script. You don't need to add other users. |
   | Windows Service | **Configure MySQL Server as a Windows Service** ✔, **Start the MySQL Server at System Startup** ✔, *Standard System Account* |
   | Server File Permissions | keep the default |
   | Sample Databases | not needed |

   Click **Execute**, then **Finish**. MySQL now runs in the background and starts with Windows. The service is called **MySQL84**.
4. Check it's running: press **Start**, type **Services**, find **MySQL84** and look for *Status: Running*.

> **MySQL 8.0 already installed** (from the old *MySQL Installer*)? That works too. Its service is **MySQL80**. Use the root password you set back then.
> **Forgot the root password?** The easiest fix on a dev PC is to uninstall MySQL Server, delete `C:\ProgramData\MySQL`, and install again.

### W3. Install MySQL Workbench (optional, to look at the data)
Download it from https://dev.mysql.com/downloads/workbench/ (MSI) and install it. If it asks for the *Visual C++ Redistributable*, install that from the link it shows.
Open it and you'll see **Local instance MySQL84** (root@localhost:3306). Double-click it and enter your root password.
You don't need to create a database or run any SQL. The app's setup script does that.

### W4. Get the project
Download the ZIP from GitHub (**Code → Download ZIP**) and extract it to a simple folder such as `C:\Devma`.
Avoid OneDrive folders such as *Desktop* or *Documents*, and avoid very long paths.

### W5. Start it: double-click `start.bat`
- If Windows shows *"Windows protected your PC"*: click **More info → Run anyway**. It's a plain script; you can read it in Notepad.
- **First run:** it installs the packages (1–3 minutes), then asks for your MySQL login:

  ```
  MySQL host [127.0.0.1]:     ← press Enter
  MySQL port [3306]:          ← press Enter
  MySQL user [root]:          ← press Enter
  MySQL password:             ← type the root password from W2 (nothing shows while typing), press Enter
  ```

  It saves the login in `server\.env`, creates the **`devma_cake_party`** database with all tables and the demo data, starts the API and the website, and opens http://localhost:5173.
- If **Windows Defender Firewall** asks about *Node.js*, click **Cancel**, or allow *Private networks* only. The app runs on this PC, so nothing needs to come in from outside.
- Keep the black window open while you use the app. **Ctrl+C** or closing the window stops it. Next time, just double-click `start.bat` again; it won't ask anything and your data is kept.
- `reset.bat` wipes the database and reloads the demo data (all logins: `Devma@2026`). It asks you to type `yes` first.

### W6. See the data
In Workbench: open **Local instance MySQL84**, click the refresh icon in *Schemas*, then expand **devma_cake_party → Tables**. Right-click a table → **Select Rows**.

### Windows problems
| You see | Fix |
|---|---|
| `'node' is not recognized` | Node.js isn't installed, or the window was opened before installing it. Install (W1), then open a **new** window. |
| *Cannot reach MySQL at 127.0.0.1:3306 (ECONNREFUSED)* | The MySQL service is stopped: **Services → MySQL84 → Start**. If you chose another port in W2, set `DB_PORT` in `server\.env`. |
| *MySQL refused the login for "root"* | Wrong password. The script asks again. Or edit `DB_PASSWORD=` in `server\.env` (open it with Notepad). |
| `npm warn EBADENGINE` during install | Harmless: the project is tested on Node 22, and newer LTS versions work. |
| `npm install` fails with *EPERM* or a path error | Move the folder out of OneDrive to `C:\Devma`, delete the `node_modules` folder, run `start.bat` again. |
| Port 5000 / 5173 in use | Nothing to do: the script picks the next free port and prints the address. |
| The window flashes and closes | Open PowerShell in the folder (Shift+right-click → *Open in Terminal*) and run `.\start.bat` to read the message. |

---

## macOS / Linux

### Step 1 — Make sure MySQL Server is running

Open **MySQL Workbench** and double-click your local connection (usually *Local instance MySQL80*, `root@localhost:3306`).

- **It opens:** MySQL is running. Remember the **user** (usually `root`) and **password** you typed. Go to Step 2.
- **"Can't connect to MySQL server on localhost:3306":** the server is installed but stopped. Start it:
  - **Windows:** press Start, type **Services**, find **MySQL80** (or *MySQL*) → **Start**.
    Or in Workbench: **Server → Startup/Shutdown → Start Server**.
  - **macOS:** **System Settings → MySQL → Start MySQL Server** (Homebrew: `brew services start mysql`).
- **No local connection / no server installed:** download **MySQL Community Server** from https://dev.mysql.com/downloads/
  (on Windows use the **MySQL Installer** and pick *Server only* or *Developer Default*). Set a **root password** during
  installation and write it down.

You do **not** need to create a database or run any SQL yourself. The setup script creates the `devma_cake_party`
database and all its tables.

### Step 2 — Get the project

- **Download ZIP:** on the GitHub page click **Code → Download ZIP**, then extract it to a simple folder such as `C:\Devma`.
- **Git:** `git clone https://github.com/IT24100948/cake.git`

> Tip (Windows): avoid OneDrive-synced folders such as *Documents* or *Desktop*. A plain folder like `C:\Devma` is the most reliable.

### Step 3 — Start it

| Windows | macOS / Linux |
|---|---|
| Double-click **`start.bat`** | In a terminal in the project folder: `./start.sh` |

The **first** time, the script:
1. installs the dependencies (`npm install`, 1–3 minutes);
2. asks for your MySQL login. Type the **same host, port, user and password you use in MySQL Workbench**
   (press Enter to accept `127.0.0.1`, `3306`, `root`). The password isn't shown while you type. It's saved in `server/.env`;
3. creates the `devma_cake_party` database with all tables and the demo data.

Then it starts the API and the website and opens your browser when you see:

```
  ============================================================
   READY:  http://localhost:5173
  ============================================================
```

Keep that window open while you use the app. **Press Ctrl+C** (or close the window) to stop.
Later starts skip the questions and keep your data.

### Everyday use
| Windows | macOS / Linux | What it does |
|---|---|---|
| `start.bat` | `./start.sh` (or `npm start`) | Start everything (your data is kept) |
| Ctrl+C in the window | Ctrl+C | Stop |
| `reset.bat` | `./reset.sh` (or `npm run db:reset`) | Delete all data and load fresh demo data (asks you to type `yes`) |

If macOS says *"permission denied"*, run `chmod +x start.sh reset.sh` once.

### Step 4 — Look at the data in MySQL Workbench (optional)

In Workbench, open your local connection and click the **refresh** icon in the *Schemas* panel. You'll see
**`devma_cake_party`** with 16 tables (`staff`, `customers`, `products`, `orders`, `payments`, …).
Right-click a table → **Select Rows** to see what the app saved, e.g. a new staff account or customer sign-up.

> Don't run `server/db/schema.sql` by hand on a database with data: it drops and recreates every table.

---

## Part C — What to test (about 20 minutes)

The demo data already contains customers, products and orders in different stages (pending, confirmed, in preparation, ready for collection, completed and cancelled), so every screen has something in it.

### 1. Customer journey — shop at http://localhost:5173
| # | Do this | You should see | Story |
|---|---|---|---|
| 1 | Open the home page, then drag the 3D cake | The cake turns and tilts | — |
| 1b | Scroll to **Quick links** under the banner | Buttons for every shop, customer and staff/admin page | — |
| 2 | **Cakes / Party Decorations**: search, filter and sort | Only available products are listed | US11 |
| 3 | Click **Sign up** and create your own account | You're logged in straight away | US12 |
| 4 | **Build Your Cake**: change cake, frosting, decoration and size, then click **See inside** | The 3D cake updates and the slice shows the layers; the price changes | US13 |
| 5 | Click **Add to Order** | The cake thumbnail flies into the cart | US13 |
| 6 | Add some balloons or candles from **Party Decorations** | The cart count goes up | US14 |
| 7 | Open the cart → **Continue to checkout** → choose delivery → pay online → enter test card `4242 4242 4242 4242` (or pick it under *Test cards*) → **Verify card & place order** | Without card details the order can't be placed, and `4000 0000 0000 0002` is declined. With a custom cake, *Cash on delivery* is disabled (pre-order, pay online) and the date must be 3+ days ahead. Decoration-only orders can choose either. An order number like `DCP-2026…` appears | US15 |
| 8 | **My Orders** → open the order | Status *Pending* and a timeline | US18 |

### 2. Staff journey — log in as `staff@devma.lk` at /staff/login
| # | Do this | You should see | Story |
|---|---|---|---|
| 1 | **Orders → Pending** → open the order you just placed | Customer, items, cake details and the reference image | US16 |
| 2 | Click **Confirm order** and enter a cake price and delivery fee | Status *Confirmed*; stock is reserved | US19 |
| 3 | Look at the order's **Payments** section | The card from checkout was charged automatically on confirmation, and the order is *Paid* | US20, US21 |
| 3b | Place another custom-cake order using card `4000 0000 0000 9995`, then confirm it as staff | Checkout accepts the card, but the charge on confirmation is declined. **Start preparation** and cash payments are blocked | US20, US23 |
| 3c | As the customer → **My Orders** → that order → **Pay now** → `4242 4242 4242 4242` | A receipt appears and the order becomes *Paid*. Staff can now **Start preparation** | US20, US21, US23 |
| 4 | **Edit / schedule** the delivery: set a date, time slot and assigned staff | Delivery status *Scheduled* | US22 |
| 5 | Move the status: **Start preparation → Mark as ready → Send out for delivery** | Progress bar advances; *Complete* stays disabled until fully paid | US17, US23 |
| 6 | **Complete order** (it was paid online in full) | Status *Completed* | US23 |
| 6b | For a *cash on delivery* order, try **Complete** before recording the cash | Blocked until the cash is recorded | US20, US23 |
| 7 | Log in as the customer again → bell icon / **Notifications** | A notification for every step | US24 |

### 3. Admin journey — log in as `admin@devma.lk`
| # | Do this | You should see | Story |
|---|---|---|---|
| 1 | **Dashboard** | KPIs, sales chart, top products, low stock | Reports |
| 2 | **Products → Add product** (with an image), then **Edit** price/availability | The product appears in the shop (or is hidden) | US07–US09 |
| 3 | **Inventory → Update stock** (restock / stock take); **History** | The stock level and the history log change | US10 |
| 4 | **Staff Accounts → Add staff**, using a temporary password | The new account is listed | US01 |
| 5 | Log in as that new account in a private window | You're forced to change the password first | US03, US04 |
| 6 | **Roles & Permissions**: create a role with only *Manage deliveries*, then assign it to that staff member | Their sidebar shrinks to Delivery only | US02 |
| 7 | **Deactivate** that account | They're logged out on their next click | US05 |
| 8 | **Audit Records** | Every login, change and order action is listed, with filters, including online payments (succeeded and failed) and refunds | US06 |
| 8b | Cancel a paid order, then open **Payments** | A *Refund* row appears (card refunds go back to the card) and the order shows *Refunded* | US21 |
| 9 | Try a wrong password 5 times for any staff account | The account locks for 15 minutes | US03 |

> To repeat the tests from a clean state, run `reset.bat` (Windows) or `./reset.sh` (macOS/Linux).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| *"Cannot reach MySQL at 127.0.0.1:3306 (ECONNREFUSED)"* | MySQL Server isn't running. Start it (Step 1), then run the start script again. If your server uses another port, change `DB_PORT` in `server/.env`. |
| *"MySQL refused the login for root"* | The password is wrong. The script asks again; or edit `DB_USER` / `DB_PASSWORD` in `server/.env` to match what works in Workbench. |
| *"Node.js is not installed"* / `node` not recognised | Install Node.js LTS from https://nodejs.org, then **open a new** terminal/window and try again. |
| Port 5000 or 5173 already used (e.g. macOS AirPlay uses 5000) | Nothing to do: the script picks the next free ports and prints the address to open. |
| Logins don't work | Check `server/.seed-credentials`, or run `reset.bat` / `./reset.sh` to restore the demo data with the password `Devma@2026`. |
| A phone number is rejected | Use a Sri Lankan number, e.g. `0771234567`, `077 123 4567` or `+94 77 123 4567`. |
| The page shows *"Cannot reach the server"* | The window running the script was closed. Run the start script again. |
| `npm install` fails on Windows | Make sure the folder path has no special characters and isn't inside OneDrive, then delete `node_modules` and try again. |

---

## What the scripts actually do
- **`start.bat` / `start.sh`** → runs `npm install` the first time, then `node scripts/start.js`.
- **`scripts/setup.js`** (run by start):
  1. creates `server/.env` from `server/.env.example` with a random `JWT_SECRET` and the MySQL login you type;
  2. connects to your MySQL server and explains what to do if it can't;
  3. on the **first** run only, creates the `devma_cake_party` database from `server/db/schema.sql` and loads the demo data
     (`server/db/seed.js`, password `Devma@2026`). Later runs keep your data. `--reset` (used by `reset.*`) recreates it.
- **`scripts/start.js`** starts the API (`server/`, Express on port 5000) and the website (`client/`, Vite on port 5173,
  which forwards `/api` to the API), picks other ports if those are busy, and opens the browser.

Developer details (tests, Vercel deployment) are in the main [README](../README.md).

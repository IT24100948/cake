# Devma Cake n' Party — Setup & Test Guide

Run the complete system (shop, staff portal, API and MySQL database) on **any computer** with **one script**.
Windows, macOS and Linux are all supported. The only thing you install is **Docker Desktop**. You don't need Node.js, MySQL or any configuration.

After the script finishes, the database is created and filled with demo data, the logins below work, and your browser opens. All that's left is testing.

---

## Login details

Every account uses the same password: **`Devma@2026`**

| Who | Email | What they can do | Where |
|---|---|---|---|
| **Admin** (business owner) | `admin@devma.lk` | Everything: dashboard, orders, products, inventory, staff accounts, roles, audit log | http://localhost:8080/staff/login |
| **Shop Staff** | `staff@devma.lk` | Orders, customers, payments, delivery, view products | http://localhost:8080/staff/login |
| **Technical Support** | `support@devma.lk` | Staff accounts, audit records | http://localhost:8080/staff/login |
| **Customer** | `customer@devma.lk` | Shop, build a cake, checkout, track orders, notifications | http://localhost:8080/login |

The database (optional, for tools like MySQL Workbench) is at host `localhost`, port `3307`, user `devma`, password `devma-db-2026`, database `devma_cake_party`.

> These are demo credentials for local testing only.

---

## Part A — Windows (starting from nothing)

### Step 1. Check your PC (1 minute)
- Windows 10 (version 22H2 or newer) or Windows 11, 64-bit, with at least 8 GB RAM.
- Virtualisation must be enabled. Open **Task Manager → Performance → CPU** and look for **Virtualization: Enabled**.
  If it says *Disabled*, turn on *Intel VT-x* or *AMD-V / SVM* in your BIOS/UEFI settings, then come back.

### Step 2. Get the project
Choose **one** of these:
- **Download ZIP:** on the GitHub page click **Code → Download ZIP**, then right-click the file → **Extract All…** to a simple folder such as `C:\Devma`.
- **Git:** run `git clone https://github.com/IT24100948/cake.git C:\Devma`
- **USB / shared folder:** copy the whole project folder to `C:\Devma`.

> Tip: avoid OneDrive-synced folders such as *Documents* or *Desktop* if OneDrive is on. A plain folder like `C:\Devma` is the most reliable.

### Step 3. Double-click `start.bat`
Open the project folder and double-click **`start.bat`**.

- If Windows shows *"Windows protected your PC"*, click **More info → Run anyway**. The script is plain text; you can open it in Notepad to check it.
- **If Docker Desktop isn't installed,** the script offers to install it for you (via `winget`). Type **Y** and press Enter, then:
  1. Restart Windows if it asks you to.
  2. Open **Docker Desktop** from the Start menu, accept the terms, and skip sign-in. Wait until the bottom-left corner says **Engine running**.
  3. If it mentions **WSL**, open *PowerShell as Administrator*, run `wsl --install` (or `wsl --update`), then restart.
  4. Double-click **`start.bat`** again.

  (You can also install Docker Desktop yourself from https://www.docker.com/products/docker-desktop/ and keep the default *Use WSL 2* option.)

### Step 4. Wait for "READY"
The **first** run downloads about 400 MB and builds the app, which takes **3–8 minutes**. Later starts take about 20 seconds.
When you see this:

```
  ============================================================
   READY:  http://localhost:8080
  ============================================================
```

your browser opens the shop automatically and the logins are printed in the window.

### Everyday use (Windows)
| Double-click | What it does |
|---|---|
| `start.bat` | Start everything (your data from last time is kept) |
| `stop.bat` | Stop everything (data is kept) |
| `reset.bat` | Delete all data and start fresh with the original demo data |

---

## Part B — macOS / Linux

1. Install Docker:
   - **macOS:** install [Docker Desktop](https://www.docker.com/products/docker-desktop/), open it once and wait for *Engine running*.
   - **Linux:** install Docker Engine with the Compose plugin: `curl -fsSL https://get.docker.com | sh`
2. Get the project (ZIP or `git clone`, as above).
3. In a terminal, from the project folder, run:

```bash
./start.sh
```

| Command | What it does |
|---|---|
| `./start.sh` | Start everything |
| `./stop.sh` | Stop (data kept) |
| `./reset.sh` | Delete all data and start fresh with demo data |

If you get *"permission denied"*, run `chmod +x *.sh scripts/*.sh` once.

---

## Part C — What to test (about 20 minutes)

The demo data already contains customers, products and orders in different stages (pending, confirmed, in preparation, ready for collection, completed and cancelled), so every screen has something in it.

### 1. Customer journey — shop at http://localhost:8080
| # | Do this | You should see | Story |
|---|---|---|---|
| 1 | Open the home page, then drag the 3D cake | The cake turns and tilts | — |
| 2 | **Cakes / Party Decorations**: search, filter and sort | Only available products are listed | US11 |
| 3 | Click **Sign up** and create your own account | You're logged in straight away | US12 |
| 4 | **Build Your Cake**: change cake, frosting, decoration and size, then click **See inside** | The 3D cake updates and the slice shows the layers; the price changes | US13 |
| 5 | Click **Add to Order** | The cake thumbnail flies into the cart | US13 |
| 6 | Add some balloons or candles from **Party Decorations** | The cart count goes up | US14 |
| 7 | Open the cart → **Continue to checkout** → choose delivery → **Place order** | An order number like `DCP-2026…` appears | US15 |
| 8 | **My Orders** → open the order | Status *Pending* and a timeline | US18 |

### 2. Staff journey — log in as `staff@devma.lk` at /staff/login
| # | Do this | You should see | Story |
|---|---|---|---|
| 1 | **Orders → Pending** → open the order you just placed | Customer, items, cake details and the reference image | US16 |
| 2 | Click **Confirm order** and enter a cake price and delivery fee | Status *Confirmed*; stock is reserved | US19 |
| 3 | **Record payment**: part of the amount by *Bank transfer* (needs a reference) | Payment status *Partially paid* | US20, US21 |
| 4 | **Edit / schedule** the delivery: set a date, time slot and assigned staff | Delivery status *Scheduled* | US22 |
| 5 | Move the status: **Start preparation → Mark as ready → Send out for delivery** | Progress bar advances; *Complete* stays disabled until fully paid | US17, US23 |
| 6 | Record the remaining payment, then **Complete order** | Status *Completed* | US23 |
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
| 8 | **Audit Records** | Every login, change and order action is listed, with filters | US06 |
| 9 | Try a wrong password 5 times for any staff account | The account locks for 15 minutes | US03 |

> To repeat the tests from a clean state, run `reset.bat` (Windows) or `./reset.sh` (macOS/Linux).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| *"Docker Desktop did not start"* | Open Docker Desktop manually and wait for **Engine running**, then run the start script again. |
| Docker says **WSL** needs updating | PowerShell as Administrator: `wsl --update`, then restart Windows. |
| *"Virtualization support not detected"* | Enable VT-x / AMD-V (SVM) in BIOS/UEFI (see Step 1). |
| Port 8080 is already used | Nothing to do: the script picks the next free port (8081, 8082…) and prints it. |
| The page doesn't load right after *READY* | Wait 10 seconds and refresh. On very slow PCs the first start can take longer. |
| You want to see what's happening | Run `docker compose logs -f app` in the project folder. |
| Logins don't work after changing things | Run `reset.bat` / `./reset.sh` to restore the demo data. |
| The script is blocked by antivirus | Allow it, or run the steps by hand: `docker compose up -d --build`, then open http://localhost:8080 |
| You want to remove everything | Run `docker compose down -v --rmi local` in the project folder. |

---

## What the script actually does
1. Checks that Docker is installed (on Windows it offers to install it) and starts the Docker engine if needed.
2. Picks free ports (8080 for the app, 3307 for MySQL, or the next free ones).
3. Runs `docker compose up -d --build`, which starts two containers:
   - **mysql**: MySQL 8.4 with its data stored in a Docker volume, so it survives restarts.
   - **app**: Node 22 running the Express API, which also serves the built React shop and staff portal.
4. On the **first** start only, the app creates all tables (`server/db/schema.sql`) and loads the demo data with the password `Devma@2026`. Later starts keep your data.
5. Waits until http://localhost:8080/api/health answers, then prints the logins and opens your browser.

Developers who want to run without Docker (Node + local MySQL, hot reload, the Jest test suite) should see the main [README](../README.md).

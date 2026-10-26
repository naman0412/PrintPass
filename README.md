# PrintPass 🖨️⚡

> **"Skip the queue. Print on time."**

PrintPass is a production-ready, multi-tenant MERN cloud print scheduling and automation platform designed specifically for college campuses and photocopy shops. Students can upload documents from anywhere, customize print options with real-time dynamic pricing and wait estimations, pay online, and reserve a guaranteed pickup slot. Photocopy shops receive a live queue counter dashboard and an autonomous background Print Agent that prints paid jobs automatically directly to physical printers without requiring staff to download or inspect student files. Files are permanently deleted immediately upon pickup.

---

## 🌟 Key Features

* **Multi-Tenant Architecture:** Works for any campus print shop. Each shop customizes its own per-page rates, duplex discounts, binding addons, operating hours, slot capacities, and operator staff.
* **3-Tap Student Ordering Flow:**
  1. Select Campus Shop
  2. Drag & Drop Document (PDF, Word, PowerPoint, Images)
  3. Customize Options & Pay (Razorpay or Mock Fallback) -> Instant Pickup Pass with QR code
* **Zero Document Retention (Privacy First):** Files are streamed directly into MongoDB GridFS. The moment an order is marked `COLLECTED`, the file is purged from the database. A 10-minute cron sweeps expired drafts, cancelled orders, and uncollected jobs.
* **No File Download for Counter Staff:** The shop dashboard intentionally forbids staff from previewing or downloading files. Only the background Print Agent can download the document using a 2-minute signed HMAC URL.
* **Autonomous Print Agent (`/agent`):** A lightweight desktop daemon for Windows workstations that polls paid jobs, spools them to physical printers via `pdf-to-printer`, handles mixed color/B&W by splitting pages, and securely wipes local scratch files.
* **Atomic Slot Capacity Engine:** Prevents overbooking under concurrent student checkouts using atomic MongoDB updates with 5-minute hold windows.
* **Real-Time Synchronization:** Socket.IO pushes order status updates across students, counter staff, and print agents instantaneously.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Clients["Frontend Clients"]
        StudentUI["📱 Student Mobile Web (React + Vite)"]
        ShopUI["🖥️ Counter Queue Dashboard (React + Vite)"]
    end

    subgraph Server["API Gateway & Services (Node 20 + Express)"]
        API["REST Gateway & Socket.IO Server"]
        Auth["JWT & Multi-Tenant RBAC"]
        Pricing["Dynamic Pricing & Wait Calculator"]
        Slots["Atomic Slot Reservation Engine"]
        FSM["Job State Machine (FSM)"]
        Cleanup["Privacy Cleanup Cron (10 min)"]
    end

    subgraph Storage["Persistence & Media Layer"]
        Atlas[("MongoDB Atlas")]
        GridFS[("MongoDB GridFS (Encrypted Binary Chunks)")]
    end

    subgraph Hardware["Counter Workstation"]
        Agent["🤖 PrintPass Agent (Daemon)"]
        Printer["🖨️ Physical Campus Printer"]
    end

    StudentUI -->|"Upload & Configure (REST)"| API
    ShopUI -->|"Verify Pickup & Live Queue (REST + WS)"| API
    API --> Auth
    API --> Pricing
    API --> Slots
    API --> FSM
    API -->|"Stream File Chunks"| GridFS
    API -->|"State & Metadata"| Atlas
    Cleanup -->|"Purge Files on Expiry"| GridFS
    Agent -->|"Poll Next Job & Report Status"| API
    API -->|"2-Minute Signed Download URL"| Agent
    Agent -->|"Spool Print Job"| Printer
```

---

## 📁 Repository Structure

```
printpass/
├── server/                 # Express backend API & Socket.IO server
│   ├── src/
│   │   ├── config/         # Database, Multer, and environment config
│   │   ├── cron/           # 10-minute privacy file cleanup daemon
│   │   ├── middleware/     # Auth, RBAC, file validation, rate limiting
│   │   ├── models/         # Mongoose schemas (User, Shop, Job, Slot, Payment, AuditLog)
│   │   ├── routes/         # Express REST API route handlers
│   │   ├── services/       # State machine, pricing, slots, payments, file service
│   │   ├── app.js          # Express app configuration & middleware pipeline
│   │   ├── server.js       # HTTP server bootstrap & Socket.IO setup
│   │   └── seed.js         # Initial demo shop, operator, and student seeder
│   └── tests/              # Jest + Supertest suites (Phases 1-4)
├── client/                 # React 18 + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/     # UI components (Upload, LiveQuoteCard, SlotPicker, etc.)
│   │   ├── context/        # Auth and Toast notification providers
│   │   ├── pages/          # Student (Home, Orders) & Shop (Queue, Settings, Earnings)
│   │   └── test/           # Vitest + React Testing Library test suites
│   ├── index.html
│   └── vite.config.js
├── agent/                  # Autonomous desktop print agent daemon
│   ├── src/                # Poller, printer wrapper, PDF splitter, shredder
│   ├── tests/              # Agent Jest unit test suite
│   └── README.md           # Windows Task Scheduler installation guide
├── docs/                   # IEEE SRS & PRD specifications
│   ├── PRD.md              # Product Requirements Document
│   └── SRS.md              # Software Requirements Specification
├── Dockerfile              # Production multi-stage Docker build with LibreOffice
├── render.yaml             # Render infrastructure blueprint
└── package.json            # Monorepo orchestration scripts
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
* **Node.js:** v20.x or higher
* **MongoDB:** Local MongoDB instance (`mongodb://127.0.0.1:27017/printpass`) or MongoDB Atlas URI.

### 2. Installation
Install all dependencies across root, server, client, and agent with one command:
```bash
npm run install-all
```

### 3. Environment Configuration
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
```
*(Default settings connect to local MongoDB with MOCK payments automatically enabled.)*

### 4. Database Seeding
Populate the database with a demo campus shop, test pricing, and test accounts:
```bash
npm run seed
```

### 5. Start Full Development Stack
Run both the Express server and Vite frontend concurrently:
```bash
npm run dev
```
* **Student App & Shop Counter:** Open `http://localhost:5173`
* **Backend API & Health Check:** `http://localhost:5000/api/health`

---

## 👥 Demo Logins

The seed script creates the following pre-configured accounts:

| Role | Email | Password | Assigned Shop | Dashboard Route |
|---|---|---|---|---|
| **Student** | `student@printpass.local` | `StudentPass123!` | *None (Any shop)* | `/` |
| **Shop Operator** | `operator@printpass.local` | `OperatorPass123!` | Campus Central Photocopy | `/shop` |
| **Shop Owner** | `owner@printpass.local` | `OwnerPass123!` | Campus Central Photocopy | `/shop/settings` |

> *Tip: The Login page features 1-Click quick login buttons for instant access to each demo role.*

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Runtime environment (`development` or `production`) | `development` |
| `PORT` | API server listen port | `5000` |
| `HOST` | Bind address | `0.0.0.0` |
| `MONGODB_URI` | MongoDB connection string (Atlas or local) | `mongodb://127.0.0.1:27017/printpass` |
| `JWT_SECRET` | Secret key for signing authentication JWTs | *(Min 32 characters)* |
| `COOKIE_SECRET` | Secret key for signing secure cookies | *(Random string)* |
| `AGENT_SIGNING_SECRET` | HMAC secret for generating 2-minute agent download URLs | *(Random string)* |
| `CLIENT_URL` | Frontend origin for CORS and Socket.IO | `http://localhost:5173` |
| `RAZORPAY_KEY_ID` | Razorpay API key ID *(leave blank to use Mock mode)* | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret | *(Secret)* |
| `RAZORPAY_WEBHOOK_SECRET`| Razorpay Webhook signature secret | *(Secret)* |
| `SMTP_HOST` | Nodemailer SMTP server host *(optional)* | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | *(Email address)* |
| `SMTP_PASS` | SMTP password / app password | *(Password)* |
| `SMTP_FROM` | Outgoing email sender string | `PrintPass <no-reply@printpass.local>` |

---

## 🤖 Print Agent Setup (`/agent`)

The agent is designed to run silently on the counter workstation connected to the physical printer.

1. Navigate to `/agent` and copy `.env.example` to `.env`:
   ```bash
   cd agent
   cp .env.example .env
   ```
2. Configure settings:
   * `SERVER_URL=http://localhost:5000` (or your Render production URL)
   * `AGENT_KEY=campus-agent-key-secret-12345` (Find this in the Shopkeeper Settings tab)
   * `PRINTER_NAME=` (Leave empty for default system printer, or specify exact name)
   * `DRY_RUN=true` (Set to `false` for real paper printing)
3. Start the agent:
   ```bash
   npm start
   ```

### Running as a Windows Background Task (Startup)
1. Open **Task Scheduler** on Windows (`taskschd.msc`).
2. Click **Create Basic Task** -> Name it "PrintPass Agent".
3. Trigger: **When I log on**.
4. Action: **Start a program**.
   * Program: `node.exe` (or path to `npm.cmd`)
   * Arguments: `src/agent.js`
   * Start in: `C:\path\to\printpass\agent`
5. Check **Run whether user is logged on or not**.

---

## 🚢 Deployment to Render.com & MongoDB Atlas

### Step 1: MongoDB Atlas Database Setup
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Network Access**, add `0.0.0.0/0` (Allow Access from Anywhere).
3. Under **Database Access**, create a user with Read & Write privileges.
4. Copy your connection string (e.g., `mongodb+srv://user:pass@cluster0.mongodb.net/printpass?retryWrites=true&w=majority`).

### Step 2: Render.com Deployment via Blueprint
1. Push your repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** -> **Blueprint**.
3. Select your GitHub repository (`printpass`).
4. Render will automatically detect `render.yaml` and configure:
   * **Runtime:** Docker (builds via multi-stage `Dockerfile` with LibreOffice + Node 20)
   * **Health Check Path:** `/api/health`
5. In the Render Environment Variables tab, fill in:
   * `MONGODB_URI`: Your MongoDB Atlas connection URI
   * `CLIENT_URL`: Your Render app URL (e.g., `https://printpass-service.onrender.com`)
   * `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` *(optional - leaves empty to run in MOCK payment mode)*
6. Click **Apply**. Render will build the Docker container and deploy the app with single-origin SPA serving and API routing.

---

## 🧪 Comprehensive Verification & Test Suites

PrintPass contains automated test suites across every workspace.

```bash
# Run all tests across the monorepo
npm test

# Run server unit & integration tests (48 tests)
npm --prefix server test

# Run client Vitest suite (9 tests)
npm --prefix client test

# Run print agent tests (9 tests)
npm --prefix agent test

# Check linting standards across the codebase
npm run lint

# Compile client production bundle
npm run build
```

---

## 📄 License
MIT License - Developed with focus on campus privacy and operational speed.

# PrintPass 🖨️⚡

> **"Skip the queue. Print on time."**

PrintPass is a modern, production-ready, multi-tenant cloud print scheduling and counter automation platform built for college campuses and photocopy shops. 

Traditional campus print shops create immense friction: students wait in 30-minute lines between lectures, hand over personal flash drives or email unencrypted documents to strangers, and have no visibility into printing costs or turnaround times. Shopkeepers are overwhelmed with manual file handling, downloading attachments, configuring printer dialogs, and dealing with crowded counters.

**PrintPass solves this completely:**
* Students upload documents from their dorm or phone, configure print options, receive instant server-calculated prices and estimated wait times, pay digitally, and get a fixed pickup slot with a QR pass.
* Shopkeepers get a live counter queue dashboard with high-contrast finishing badges and an autonomous background **Print Agent** that downloads paid jobs and prints them automatically to physical printers.
* **Complete Zero Document Retention:** Files are never previewed or downloaded by shop staff, and are permanently wiped from the database the moment the student collects their printout.

---

## 🌟 Key Highlights & Innovations

* **🏢 Multi-Tenant SaaS Architecture:** Designed for any campus shop. Each shop independently manages its operating hours, per-page B/W and color pricing, duplex discounts, binding addons (spiral, staple, 2-hole punch), slot durations, maximum capacity limits, and staff operators.
* **📱 3-Tap Student Ordering:**
  1. Select Campus Shop
  2. Upload Document (PDF, Word DOC/DOCX, PowerPoint PPT/PPTX, PNG, JPG)
  3. Customize Options & Pay (Razorpay or Mock Mode) $\rightarrow$ Receive Instant Pickup Pass with QR Code
* **🔒 Strict Privacy & Zero Document Retention:**
  * Files are stored as encrypted binary chunks in MongoDB GridFS (never on ephemeral server disks).
  * Counter staff **cannot** preview or download documents from the dashboard.
  * Only the background Print Agent can download the document using a 2-minute cryptographically signed HMAC URL.
  * The exact second an order is marked `COLLECTED`, the document is permanently shredded from GridFS.
  * A 10-minute automated cron sweeps cancelled orders, unrecoverable failures, and abandoned uploads.
* **🤖 Autonomous Desktop Print Agent (`/agent`):** A lightweight background daemon for Windows/Linux counter workstations. It polls for paid jobs, spools them to physical printers via `pdf-to-printer`, handles mixed color/B&W documents by splitting pages via `pdf-lib`, and securely wipes local temporary files.
* **⏱️ Atomic Slot Capacity & Anti-Overbooking Engine:** Uses atomic MongoDB `$expr` conditional operators to guarantee that slot capacity cannot be overbooked under heavy concurrent student checkout requests. Holds slots for 5 minutes during checkout.
* **⚡ Live Synchronization:** Real-time bi-directional status updates powered by Socket.IO rooms scoped by `jobId` and `shopId`.

---

## 🔄 How PrintPass Works (End-to-End Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor Student as 📱 Student
    participant Web as 🌐 Web Client (React)
    participant API as 🚀 Express API & GridFS
    participant DB as 🗄️ MongoDB Atlas
    participant Agent as 🤖 Desktop Print Agent
    actor Operator as 🏪 Shop Operator

    Note over Student,API: 1. Upload & Real-Time Quote
    Student->>Web: Uploads document & selects options (B/W, Duplex, Spiral)
    Web->>API: POST /api/jobs/quote (File + Options)
    API->>API: Magic-byte check, page count (pdf-lib), calculate exact price & wait
    API-->>Web: Returns Price breakdown (₹) + Estimated wait (mins)

    Note over Student,DB: 2. Atomic Slot Reservation & Payment
    Student->>Web: Selects 10:15 AM Slot & Clicks "Pay & Reserve"
    Web->>API: POST /api/jobs/hold-slot (5-minute atomic lock)
    API->>DB: Atomic decrement available capacity ($expr)
    Web->>API: POST /api/payments/create-order & /verify
    API->>DB: Transitions Job to QUEUED, generates 6-character Pickup Code & QR Token
    API-->>Web: Emits Socket.IO 'order:updated' (Status: QUEUED)

    Note over Agent,Operator: 3. Autonomous Hands-Free Printing
    Agent->>API: GET /api/agent/jobs/next (Authenticated via x-agent-key)
    API-->>Agent: Returns Job + 2-Minute Signed HMAC Download URL
    Agent->>API: Downloads document stream
    Agent->>Agent: Spools directly to physical printer (splits Color & B/W if mixed)
    Agent->>API: PATCH /api/agent/jobs/:id/status (PRINTED)
    API-->>Operator: Live Queue Dashboard updates with finishing badge (e.g. SPIRAL)

    Note over Student,Operator: 4. Pickup & Immediate Document Shredding
    Operator->>Operator: Assembles finishing (if required) & marks READY
    Student->>Operator: Arrives at counter, shows QR Code / Pickup Pass
    Operator->>API: POST /api/jobs/verify-pickup (Scans QR or enters 6-char code)
    API->>DB: Transitions Job to COLLECTED
    API->>DB: PERMANENTLY DELETES file from GridFS & records fileDeletedAt
    API-->>Student: Emits Socket.IO 'order:updated' (Status: COLLECTED)
```

---

## 🧮 Mathematical Engine & Formulas

### 1. Dynamic Server-Side Pricing Engine
Pricing is strictly calculated by the server and never trusted from the client:
$$\text{Base Cost} = (\text{BW Pages} \times \text{Shop.bwRate}) + (\text{Color Pages} \times \text{Shop.colorRate})$$
$$\text{Discount} = \text{Duplex Discount (per double-sided sheet)}$$
$$\text{Binding Cost} = \text{Shop.spiral} + \text{Shop.staple} + \text{Shop.punch}$$
$$\text{Total Price} = \left[ (\text{Base Cost} - \text{Discount}) \times \text{PaperSize Multiplier} + \text{Binding Cost} \right] \times \text{Copies}$$

### 2. Live Queue Wait Estimation
The wait time dynamically factors in current printer queue backlog, printer speed, and finishing overhead:
$$\text{Estimated Wait (min)} = \left\lceil \frac{\text{Pages Queued Ahead}}{\text{Shop Pages-Per-Minute}} \right\rceil + \text{Finishing Time} + 5\text{ min Buffer}$$

### 3. Atomic Slot Concurrency Formula
To eliminate race conditions when dozens of students click "Pay" at the same instant for the last slot, slot reservation executes via an atomic MongoDB conditional check:
$$\text{Available Pages} = \text{maxPages} - (\text{bookedPages} + \text{heldPages}) \ge \text{jobPages}$$
$$\text{Available Jobs} = \text{maxJobs} - (\text{bookedJobs} + \text{heldJobs}) \ge 1$$
If both conditions satisfy atomically, `heldPages` and `heldJobs` are incremented and a 5-minute hold timer is initialized.

---

## 🚦 Finite State Machine (Job Lifecycle)

All job transitions are enforced by a centralized service module (`server/src/services/jobStateMachine.js`). Any unauthorized or invalid transition throws an HTTP `409 Conflict`.

```
[DRAFT]
   │
   ▼
[PENDING_PAYMENT] ──(5-Min Timeout / User Cancel)──> [CANCELLED] (Capacity Released)
   │
   ▼ (Payment Signature Verified)
[QUEUED] ─────────(User Cancel Prior to Print)────> [CANCELLED] (Auto Refund Issued)
   │
   ▼ (Agent Claims Job)
[PRINTING] ───────(Paper Jam / Hardware Error)────> [FAILED] (Retry or Refund)
   │
   ▼
[PRINTED]
   │
   ├─► [FINISHING] (If Spiral, Staple, or Hole Punch required)
   │        │
   │        ▼ (Operator marks completed)
   └─► [READY] (If no binding required)
            │
            ├─► [COLLECTED] 💥 (QR / Code Verified -> INSTANT GRIDFS PURGE)
            │
            └─► [NO_SHOW]   (24h Uncollected -> Purged by Cron)
```

---

## 🛡️ Privacy & Security Architecture

1. **Zero Document Retention Policy:**
   * **On Pickup:** The exact moment a student presents their 6-character code or QR pass and the operator marks `COLLECTED`, GridFS binary chunks are deleted immediately and `fileDeletedAt` is recorded in the audit log.
   * **10-Minute Privacy Cron:** Sweeps and shreds files for `CANCELLED`, `FAILED`, and `NO_SHOW` jobs, as well as unattached uploads older than 60 minutes.
2. **Counter Screen Privacy Safeguard:**
   * The shop dashboard intentionally exposes **no** file download buttons or document preview modals. Staff only see metadata: page count, color mode, duplex option, and binding notes.
3. **2-Minute HMAC Signed Agent URLs:**
   * Print Agents authenticate using an exclusive per-shop `AGENT_KEY`.
   * Download URLs are cryptographically signed with HMAC SHA-256 (`AGENT_SIGNING_SECRET`) and expire after strictly 120 seconds.
4. **Hardened Web Security:**
   * **HTTP Cookies:** JWT session tokens stored in `httpOnly`, `SameSite=Lax`, `Secure` cookies.
   * **Magic-Byte Header Inspection:** Validates binary headers (rejects disguised executables or corrupt files).
   * **Sanitization:** `express-mongo-sanitize` prevents NoSQL injection; `helmet` configures Content Security Policy (CSP); `express-rate-limit` prevents brute-force.
   * **Multi-Tenant Shop Isolation:** Every operator and owner query is scoped strictly by `req.shopId`.

---

## 📁 Monorepo Structure

```
printpass/
├── server/                     # Express backend API & Socket.IO server
│   ├── src/
│   │   ├── config/             # DB connection, Multer, Environment variables
│   │   ├── cron/               # 10-minute privacy file shredder daemon
│   │   ├── middleware/         # Auth, RBAC, magic-byte file validation, rate limiting
│   │   ├── models/             # Mongoose schemas: User, Shop, Job, Slot, Payment, AuditLog
│   │   ├── routes/             # API routes: /api/auth, /api/jobs, /api/payments, /api/agent
│   │   ├── services/           # State Machine, Pricing, Slots, Payments, GridFS streaming
│   │   ├── app.js              # Express app pipeline, security headers, SPA fallback
│   │   ├── server.js           # Server bootstrap & Socket.IO event handler
│   │   └── seed.js             # Initial database seeder (Demo shop, staff, student)
│   └── tests/                  # Jest + Supertest suites (48 tests)
├── client/                     # React 18 + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/         # Modular UI (FileUpload, LiveQuoteCard, SlotPicker, PickupPass)
│   │   ├── context/            # AuthContext and Toast notification system
│   │   ├── pages/              # Student flow (Home, Orders) & Shop (Queue, Earnings, Settings)
│   │   └── test/               # Vitest + React Testing Library suites (9 tests)
│   ├── index.html
│   └── vite.config.js
├── agent/                      # Desktop print agent daemon
│   ├── src/                    # Poller, pdf-to-printer wrapper, PDF splitter, shredder
│   ├── tests/                  # Agent unit tests (9 tests)
│   └── README.md               # Windows Task Scheduler & printer setup instructions
├── Dockerfile                  # Production container with Node 20, fonts & LibreOffice
├── render.yaml                 # Render.com Infrastructure-as-Code blueprint
└── package.json                # Monorepo management scripts
```

---

## ⚡ Quick Start (Local Setup)

### 1. Prerequisites
* **Node.js:** v20.x or higher
* **MongoDB:** Local MongoDB instance running on `mongodb://127.0.0.1:27017/printpass` or MongoDB Atlas URI.

### 2. Installation
Install all dependencies across the entire monorepo in one command:
```bash
npm run install-all
```

### 3. Environment Configuration
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
```
*(By default, `.env.example` is ready for local execution with local MongoDB and the built-in MOCK payment simulator).*

### 4. Database Seeding
Seed the database with a demo campus shop, realistic pricing tiers, and pre-configured accounts:
```bash
npm run seed
```

### 5. Launch Full Stack
Run the Express API and Vite React frontend concurrently:
```bash
npm run dev
```
* **Student Web Application & Shop Dashboard:** Open [`http://localhost:5173`](http://localhost:5173)
* **Backend Health Check:** Open [`http://localhost:5000/api/health`](http://localhost:5000/api/health)

---

## 👥 Demo Logins

The database seeder configures the following demo credentials. The login screen also provides **1-Click Demo Login** shortcuts:

| Role | Email | Password | Assigned Shop | Features & View |
|---|---|---|---|---|
| **Student** | `student@printpass.local` | `StudentPass123!` | *Any Shop* | Document upload, live quote, slot picker, active pass & status timeline (`/`, `/orders`) |
| **Shop Operator** | `operator@printpass.local` | `OperatorPass123!` | Campus Central Photocopy | Live queue cards, colored option badges, finishing checklist, QR code verification (`/shop`) |
| **Shop Owner** | `owner@printpass.local` | `OwnerPass123!` | Campus Central Photocopy | Pricing configuration, slot capacity controls, earnings reports, agent key management (`/shop/settings`, `/shop/earnings`) |

---

## 🤖 Desktop Print Agent Setup (`/agent`)

The print agent is built to run on the print shop's counter workstation connected to physical printers.

1. Navigate to `/agent` and copy the environment template:
   ```bash
   cd agent
   cp .env.example .env
   ```
2. Configure settings:
   * `SERVER_URL=http://localhost:5000` (or your Render production URL)
   * `AGENT_KEY=campus-agent-key-secret-12345` (Retrieved from the Shop Settings tab)
   * `PRINTER_NAME=` (Leave empty to use the system default printer, or enter the exact name)
   * `DRY_RUN=true` (Set to `false` when connected to physical paper printers)
3. Launch the agent:
   ```bash
   npm start
   ```

### Running as a Windows Background Task (Startup)
1. Open Windows **Task Scheduler** (`taskschd.msc`).
2. Click **Create Basic Task** $\rightarrow$ Name it "PrintPass Agent".
3. Trigger: **When I log on**.
4. Action: **Start a program**:
   * Program: `node.exe` (or path to `npm.cmd`)
   * Arguments: `src/agent.js`
   * Start in: `C:\path\to\printpass\agent`
5. Check **Run whether user is logged on or not**.

---

## 🚢 Deploying to Render.com & MongoDB Atlas

### 1. MongoDB Atlas Setup
1. Create a free M0 cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Network Access**, add `0.0.0.0/0` (Allow Access from Anywhere).
3. Under **Database Access**, create a user with Read & Write permissions.
4. Copy your connection URI (`mongodb+srv://user:pass@cluster.mongodb.net/printpass?retryWrites=true&w=majority`).

### 2. Render.com Deployment via Blueprint
1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** $\rightarrow$ **Blueprint**.
3. Select your GitHub repository (`printpass`).
4. Render will read `render.yaml` and configure:
   * **Runtime:** Docker (builds via multi-stage `Dockerfile` with Node 20, fonts, and headless LibreOffice).
   * **Health Check Path:** `/api/health`.
5. Under Environment Variables, supply:
   * `MONGODB_URI`: Your MongoDB Atlas URI.
   * `CLIENT_URL`: Your Render application URL (e.g., `https://printpass-service.onrender.com`).
   * `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` *(optional - leave empty to run in MOCK payment mode)*.
6. Click **Apply**. Render will build the container, serve the compiled React SPA, and mount the Express API.

---

## 🧪 Comprehensive Verification & Test Suites

```bash
# Run all tests across the monorepo (66 tests)
npm test

# Run server test suites (48 tests)
npm --prefix server test

# Run client Vitest suite (9 tests)
npm --prefix client test

# Run print agent unit tests (9 tests)
npm --prefix agent test

# Run ESLint across server and client
npm run lint

# Compile client production bundle
npm run build
```

---

## 📄 License
MIT License - Designed for high-speed, privacy-first campus printing.

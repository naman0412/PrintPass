# PrintPass - Product Requirements Document (PRD)

**Version:** 1.0.0  
**Status:** Approved  
**Author:** Senior Full-Stack Engineering Team  
**Tagline:** *"Skip the queue. Print on time."*

---

## 1. Executive Summary & Vision

PrintPass is a multi-tenant cloud print scheduling and automation platform designed specifically for college campuses and academic photocopying ecosystems. 

In traditional campus photocopy kiosks, students face massive queue delays between classes, hand over private USB sticks or email unencrypted personal documents to operators, and experience uncertain wait times. Shopkeepers suffer from manual file management, crowded counters, and non-optimized printer throughput.

PrintPass eliminates the counter bottleneck by allowing students to upload documents from home or their dorms, configure print options with instantaneous server-computed quotes and queue wait estimates, pay digitally via Razorpay, and reserve a dedicated pickup time slot. Shopkeepers receive an automated, high-contrast queue dashboard and a dedicated background **Print Agent** that automatically downloads and prints paid jobs directly to physical printers without operator manual file handling. Crucially, documents are permanently deleted the moment the student collects their printout, guaranteeing complete document privacy.

---

## 2. User Personas & Problems

### 2.1 The Student (End Consumer)
* **Profile:** College student printing lecture slides, assignments, lab manuals, and theses.
* **Pain Points:**
  * 30-minute queues before morning lectures or submission deadlines.
  * Risk of malware when plugging personal USB flash drives into public kiosk PCs.
  * Complete privacy exposure (shopkeepers and other students viewing personal assignments, notes, or IDs).
  * Lack of price transparency (unexpected charges for color pages, duplexing, or binding).
* **Goals:**
  * Upload anywhere from mobile or laptop in under 3 taps.
  * Instant, guaranteed pricing and estimated completion time.
  * Pick up prints in 10 seconds using a 6-character code or QR pass.

### 2.2 The Shop Operator (Counter Staff)
* **Profile:** Front-desk employee at a high-volume campus print shop.
* **Pain Points:**
  * Constant context switching: downloading WhatsApp attachments, opening flash drives, configuring printer dialogs, managing cash change.
  * Angry students crowding the counter.
  * Difficulty tracking print finishing requirements (stapling, spiral binding, hole punch).
* **Goals:**
  * Hands-free printing: paid jobs print automatically.
  * High-visibility dashboard with clear color badges for finishing requirements.
  * 1-click verification via QR scanner or 6-character pickup code.

### 2.3 The Shop Owner (Tenant Administrator)
* **Profile:** Business owner managing one or multiple photocopy stores.
* **Pain Points:**
  * Lack of visibility into daily revenue, paper consumption, and operator performance.
  * Inability to adjust pricing dynamically based on paper/toner costs.
  * Overcrowding during peak hours without slot controls.
* **Goals:**
  * Manage shop profiles, business hours, and operator accounts.
  * Configure granular pricing per page, color discounts, and finishing fees.
  * Throttle slot capacity to prevent printer backlogs.
  * Monitor real-time earnings and volume reports.

---

## 3. Product Architecture & Multi-Tenancy

PrintPass operates as a **strict multi-tenant platform**:
* **Tenant Isolation:** Every shop is identified by a unique identifier (`shopId`) and slug (`code`). All jobs, slots, audit logs, and operator users are strictly scoped to their respective shop.
* **Operator Sandboxing:** Operators and Owners have role-based access control (RBAC) restricted exclusively to their assigned `shopId`.
* **Zero Cross-Tenant Leakage:** API endpoints enforce shop tenancy filters at the database query level.

---

## 4. Key Functional Requirements

### 4.1 Document Ingestion & Validation
* **Supported Formats:** PDF, DOC, DOCX, PPT, PPTX, JPG, PNG.
* **Size Limit:** Maximum 20 MB per file.
* **Magic-Byte Security:** File type validation inspects file header magic bytes; extension spoofing is rejected.
* **Conversion Pipeline:**
  * Images (JPG/PNG) are converted to standards-compliant PDF via `pdf-lib`.
  * Office documents (DOC, DOCX, PPT, PPTX) are converted to PDF using headless LibreOffice.
  * Graceful degradation: If LibreOffice is unavailable, PDFs and images continue to function seamlessly with user notification.
* **Page Counting:** Exact page counts are computed server-side via `pdf-lib`. Encrypted or corrupted files are rejected with informative errors.
* **Storage:** Documents are streamed directly into MongoDB GridFS chunks. Ephemeral server disks are never used for document persistence.

### 4.2 Dynamic Pricing & Wait Estimation Engine
The client NEVER calculates or dictates the price. The server provides a cryptographically authoritative quote:
* **Base Calculation:**
  $$\text{Page Base Cost} = (\text{BW Pages} \times \text{Shop.bwRate}) + (\text{Color Pages} \times \text{Shop.colorRate})$$
* **Modifiers:**
  * Duplex Discount: Applied per double-sided sheet.
  * Paper Size Multiplier: Applied for large formats (e.g., A3).
  * Finishing Addons: Spiral binding, stapling, 2-hole punch.
  * Copies Multiplier: Total cost multiplied by number of copies.
* **Estimated Wait Formula:**
  $$\text{Wait (min)} = \left\lceil \frac{\text{Total Pages Queued Ahead}}{\text{Shop Pages-Per-Minute}} \right\rceil + \text{Finishing Time} + 5\text{ min Buffer}$$

### 4.3 Slot Scheduling & Atomic Concurrency
* **Time Windows:** Configurable slot duration (e.g., 15 or 30 minutes) within shop operating hours.
* **Capacity Constraints:** Dual-gate thresholds per slot: `slotCapacityPages` and `slotCapacityJobs`.
* **5-Minute Hold Protection:** During payment checkout, slot capacity is reserved using atomic MongoDB conditional updates (`$expr`). Race conditions under concurrent student checkout requests are strictly prevented without overbooking.
* **Automatic Expiry:** Unpaid holds release automatically after 5 minutes via server cron.

### 4.4 Payment Integration & Fallback
* **Gateway:** Razorpay (Test / Production modes).
* **Order Creation & Verification:** Server creates Razorpay Order, verifies HMAC SHA256 signature upon completion.
* **Idempotency:** Payment requests require unique idempotency keys to prevent duplicate captures.
* **MOCK Provider Fallback:** When Razorpay credentials are not configured, PrintPass activates an internal `isMockPayment` simulator allowing full automated test suites and local developer onboarding.
* **Automated Refunds:** Jobs cancelled prior to the `PRINTING` stage trigger automatic full refunds.

### 4.5 Finite State Machine (Job Lifecycle)
All job state transitions are governed by a single authoritative service module (`jobStateMachine.js`). Invalid transitions return `409 Conflict`.

```
[DRAFT]
   │
   ▼
[PENDING_PAYMENT] ──(Expired Hold / User Cancel)──> [CANCELLED]
   │
   ▼ (Payment Confirmed)
[QUEUED] ─────────(User Cancel / Refund)─────────> [CANCELLED]
   │
   ▼ (Agent Claim)
[PRINTING] ───────(Printer Error)────────────────> [FAILED]
   │
   ▼
[PRINTED]
   │
   ├─► [FINISHING] (If binding required: Spiral, Staple, Punch)
   │        │
   │        ▼
   └─► [READY] (If no binding required)
            │
            ├─► [COLLECTED] (Pickup Verified -> Instant File Purge)
            │
            └─► [NO_SHOW]   (24h Unclaimed -> Cron Purge)
```

### 4.6 Strict Privacy & Zero Document Retention
* **Immediate Purge:** Upon marking `COLLECTED`, the document is immediately deleted from MongoDB GridFS, `fileDeletedAt` is stamped, and an audit entry is created.
* **Privacy Cron (Every 10 Minutes):**
  * Deletes files for `CANCELLED`, `FAILED`, and `NO_SHOW` jobs.
  * Deletes files for jobs unclaimed 24 hours past the scheduled slot.
  * Deletes orphaned uploads older than 1 hour not associated with an order.
* **No Counter Previews:** The shop dashboard UI deliberately contains **no** file download or preview capabilities. Shopkeepers see only metadata (page count, color mode, duplex, binding notes).
* **Time-Limited Agent Download:** The autonomous print agent receives a cryptographically signed HMAC download token valid for strictly 2 minutes.

### 4.7 Autonomous Print Agent (`/agent`)
* Lightweight background Node.js service installed on the print shop's counter workstation.
* Authenticates via a per-shop `AGENT_KEY`.
* Polls `GET /api/agent/jobs/next` with exponential backoff on network disruptions.
* Downloads document directly into an ephemeral directory with 2-minute signed token.
* Intelligently parses print parameters (monochrome, duplex long/short edge, paper size, page ranges).
* Handles mixed color/B&W jobs by splitting pages via `pdf-lib` and sending split jobs to designated printer trays.
* Emits execution status (`PRINTING`, `PRINTED`, `FAILED`).
* Securely shreds local temporary files upon print completion.
* Supports `DRY_RUN=true` for testing without physical paper consumption.

---

## 5. Non-Functional Requirements

| Category | Requirement | Implementation |
|---|---|---|
| **Security** | Authentication | JWT stored in `httpOnly`, `SameSite=Lax`, `Secure` cookies |
| **Security** | Request Sanitation | `helmet`, `express-rate-limit`, `express-mongo-sanitize` |
| **Security** | Input Validation | `zod` schema validation on all incoming payload routes |
| **Security** | CORS | Restrictive whitelist configured via `CLIENT_URL` |
| **Scalability** | File Storage | MongoDB GridFS chunking (no local disk dependency on cloud PaaS) |
| **Realtime** | Live Updates | Socket.IO room subscriptions scoped by `jobId` and `shopId` |
| **Deployability** | Cloud Platform | Single-container Dockerized deployment on Render / AWS ECS |

---

## 6. Success Metrics & KPIs
* **Queue Time Reduction:** Average student counter wait reduced from 15–20 minutes to < 30 seconds.
* **Kiosk Throughput:** 40% increase in daily pages printed per machine due to continuous spooling.
* **Zero Data Retention:** 100% of collected files deleted within 5 seconds of pickup verification.
* **Checkout Velocity:** End-to-end order placement achieved in 3 clicks / taps under 60 seconds.

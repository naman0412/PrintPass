# PrintPass - Software Requirements Specification (SRS)

**Standard:** IEEE 830-1998 Compliant  
**Project:** PrintPass - Multi-Tenant Cloud Print Scheduling & Counter Automation Platform  
**Version:** 1.0.0  
**Author:** Senior Full-Stack Engineering Team  

---

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for the **PrintPass** platform. It provides a formal description of the system architecture, component contracts, database schemas, state machines, API interfaces, and privacy/security protocols.

### 1.2 Scope
PrintPass provides:
1. A **Student Web Application** enabling file upload, live print option configuration, real-time price quotation, wait estimation, slot reservation with 5-minute atomic hold, digital payment, and QR/pickup code retrieval.
2. A **Shopkeeper Counter Dashboard** offering real-time job queue visualization, colored badge options breakdown, finishing checklist, walk-in entry, and 1-tap pickup verification.
3. An **Autonomous Print Agent** daemon executing on counter workstations to poll, download via signed time-limited tokens, split mixed-color PDFs, and spool jobs to local physical printers.
4. A **Zero Document Retention Engine** guaranteeing immediate file destruction upon collection and automated cron sweeps for expired or failed jobs.

### 1.3 Definitions and Acronyms
* **RBAC:** Role-Based Access Control (`student`, `operator`, `owner`).
* **GridFS:** MongoDB storage specification for files exceeding the 16 MB BSON document limit.
* **FSM:** Finite State Machine governing job lifecycle.
* **Idempotency Key:** Unique request identifier ensuring duplicate payment or transition requests yield identical, non-repeating results.
* **Duplex:** Double-sided printing (long-edge or short-edge binding).

---

## 2. Overall Description

### 2.1 Product Perspective & Monorepo Architecture
PrintPass is structured as a single cohesive monorepo:
```
printpass/
├── server/          # Node.js 20 + Express + Mongoose + Socket.IO + Multer + GridFS
├── client/          # React 18 + Vite + Tailwind CSS + Lucide + Socket.io-client
├── agent/           # Background Node.js Print Daemon + pdf-to-printer + pdf-lib
├── docs/            # PRD, SRS, Architectural guides
├── Dockerfile       # Production multi-stage Docker build with headless LibreOffice
├── render.yaml      # Render infrastructure-as-code deployment specification
└── package.json     # Monorepo management scripts
```

### 2.2 System Operating Environment
* **Server Runtime:** Node.js v20.x on Linux / Docker (Debian `bullseye-slim` or `bookworm-slim`).
* **Database:** MongoDB 6.0+ (MongoDB Atlas in cloud or standalone mongod).
* **Client Environment:** Modern Evergreen Browsers (Chrome, Firefox, Safari, Edge; Mobile Safari & Chrome).
* **Agent Environment:** Windows 10/11 x64 or Server 2019/2022 workstation with local printer drivers installed.

---

## 3. System Architecture & Data Flow

### 3.1 High-Level Architecture Diagram
```
                     +---------------------------------------+
                     |             Web Browser               |
                     |  (Student App / Shopkeeper Dashboard)  |
                     +-------------------+-------------------+
                                         |
                               HTTPS / WSS (REST & Socket.IO)
                                         |
                                         v
                     +---------------------------------------+
                     |         Express.js API Gateway        |
                     | - Helmet, Rate Limiter, MongoSanitize |
                     | - JWT Authentication & RBAC Middleware|
                     | - Shop Isolation Layer (req.shopId)   |
                     +---+---------------+---------------+---+
                         |               |               |
                         v               v               v
             +---------------+   +---------------+   +---------------+
             | Pricing &     |   | State Machine |   | File & GridFS |
             | Slot Service  |   | & Payments    |   | Stream Service|
             +---------------+   +---------------+   +---------------+
                         |               |               |
                         +---------------+---------------+
                                         |
                                         v
                     +---------------------------------------+
                     |          MongoDB Atlas Server         |
                     | - Metadata Collections (Jobs, Users)  |
                     | - fs.files & fs.chunks (GridFS Store) |
                     +---------------------------------------+
                                         ^
                                         | 2-Minute Signed URL
                                         |
                     +-------------------+-------------------+
                     |           PrintPass Agent             |
                     |  (Windows Workstation / Local Printer) |
                     +---------------------------------------+
```

### 3.2 End-to-End Data Flow Sequence
1. **Quotation & Upload:** Student uploads document. Server inspects magic bytes, calculates pages via `pdf-lib`, stores binary stream in GridFS `fs.files`/`fs.chunks`, and computes quote.
2. **Atomic Slot Hold:** Student selects slot. Server performs atomic MongoDB `$expr` decrement on available capacity, securing a 5-minute lock.
3. **Payment Execution:** Client completes Razorpay checkout (or Mock simulator). Webhook / signature verification invokes `jobStateMachine.transition(job, 'QUEUED')`. 6-character `pickupCode` and `qrToken` are generated.
4. **Agent Processing:** Print Agent queries `GET /api/agent/jobs/next`. Server generates 2-minute signed download URL. Agent downloads document, detects color/BW pages, spools to printer, and reports `PRINTED`.
5. **Shop Verification & Zero Retention:** Student arrives at shop and presents QR / pickup code. Operator validates code. Server transitions state to `COLLECTED`, instantly deletes the GridFS file, and stamps `fileDeletedAt`.

---

## 4. Finite State Machine Specification

The `Job` document adheres to the following transition graph:

| Current State | Permitted Next States | Trigger / Condition |
|---|---|---|
| `DRAFT` | `PENDING_PAYMENT`, `CANCELLED` | File uploaded, print options saved |
| `PENDING_PAYMENT` | `QUEUED`, `CANCELLED` | Successful payment verification or timeout |
| `QUEUED` | `PRINTING`, `CANCELLED` | Agent acquires job lock, or user cancels |
| `PRINTING` | `PRINTED`, `FAILED` | Agent confirms spool completion or error |
| `PRINTED` | `FINISHING` (binding required) or `READY` (no binding) | System route based on binding option |
| `FINISHING` | `READY` | Operator completes binding checklist |
| `READY` | `COLLECTED`, `NO_SHOW` | Customer pickup verified or 24h expiration |
| `CANCELLED` | Terminal | Auto refund issued |
| `COLLECTED` | Terminal | File permanently deleted from GridFS |
| `FAILED` | `QUEUED` (retry) or `CANCELLED` (refund) | Operator retry or system refund |
| `NO_SHOW` | Terminal | Unclaimed 24h past slot; file purged |

*Rule:* Any invalid transition attempts throw HTTP `409 Conflict`.

---

## 5. Database Schema & Indexes

### 5.1 `users`
* `_id`: ObjectId
* `name`: String, required
* `email`: String, unique, indexed, lowercase
* `password`: String (bcrypt hash), required
* `role`: Enum `['student', 'operator', 'owner']`, default `'student'`
* `shopId`: ObjectId -> `shops` (null for students; required for operator/owner)
* `phone`: String

### 5.2 `shops`
* `_id`: ObjectId
* `name`: String, required
* `code`: String, unique, indexed (e.g., `campus-central`)
* `address`: String
* `phone`: String
* `email`: String
* `pricing`:
  * `bwPerPage`: Number, default 2.0
  * `colorPerPage`: Number, default 10.0
  * `duplexDiscount`: Number, default 0.5
  * `spiral`: Number, default 30.0
  * `staple`: Number, default 5.0
  * `punch`: Number, default 2.0
  * `a3Multiplier`: Number, default 2.0
* `operatingHours`: `{ open: "08:00", close: "20:00" }`
* `slotMinutes`: Number, default 15
* `slotCapacityPages`: Number, default 200
* `slotCapacityJobs`: Number, default 10
* `agentKey`: String, indexed
* `agentLastSeenAt`: Date
* `isActive`: Boolean, default true

### 5.3 `slots`
* `_id`: ObjectId
* `shopId`: ObjectId -> `shops`, required
* `slotStart`: Date, required
* `slotEnd`: Date, required
* `maxJobs`: Number
* `maxPages`: Number
* `bookedJobs`: Number, default 0
* `bookedPages`: Number, default 0
* `heldJobs`: Number, default 0
* `heldPages`: Number, default 0
* **Index:** Unique compound `{ shopId: 1, slotStart: 1 }`

### 5.4 `jobs`
* `_id`: ObjectId
* `shopId`: ObjectId -> `shops`, indexed
* `studentId`: ObjectId -> `users`, indexed
* `fileId`: ObjectId (GridFS file ID)
* `fileName`: String
* `originalName`: String
* `fileMime`: String
* `pageCount`: Number
* `options`:
  * `color`: Enum `['bw', 'color', 'mixed']`
  * `colorPageRanges`: String
  * `orientation`: Enum `['portrait', 'landscape', 'auto']`
  * `sides`: Enum `['single', 'double']`
  * `copies`: Number, default 1
  * `pageRange`: String, default 'all'
  * `paperSize`: Enum `['A4', 'A3']`, default 'A4'
  * `binding`: Enum `['none', 'spiral', 'staple', 'punch']`, default 'none'
  * `notes`: String
* `pricing`: `{ total: Number, subtotal: Number, bindingCost: Number, discount: Number }`
* `slotStart`: Date
* `slotEnd`: Date
* `status`: Enum FSM, default `'DRAFT'`
* `pickupCode`: String, 6 alphanumeric characters, unique sparse index
* `qrToken`: String
* `fileDeletedAt`: Date
* `expiresAt`: Date (TTL index for automatic deletion of expired drafts)
* **Indexes:**
  * Compound: `{ shopId: 1, status: 1, slotStart: 1 }`
  * Unique sparse: `{ pickupCode: 1 }`
  * TTL index: `{ expiresAt: 1 }`

### 5.5 `payments`
* `_id`: ObjectId
* `jobId`: ObjectId -> `jobs`, unique
* `studentId`: ObjectId -> `users`
* `amount`: Number
* `currency`: String, default `'INR'`
* `provider`: Enum `['razorpay', 'mock']`
* `orderId`: String
* `paymentId`: String
* `signature`: String
* `status`: Enum `['created', 'captured', 'failed', 'refunded']`
* `idempotencyKey`: String, unique sparse
* `refundId`: String
* `refundAmount`: Number

### 5.6 `auditlogs`
* `_id`: ObjectId
* `jobId`: ObjectId, indexed
* `shopId`: ObjectId, indexed
* `actor`: `{ userId: ObjectId, role: String, ip: String }`
* `event`: String (e.g., `FILE_UPLOADED`, `PAYMENT_SUCCESS`, `PRINT_STARTED`, `FILE_DELETED`)
* `metadata`: Object (contains timestamps, reason; never file binary contents)
* `createdAt`: Date

---

## 6. External Interfaces & Security Specifications

### 6.1 Authentication & Authorization
* Access tokens are issued as JSON Web Tokens (JWT) signed with HMAC SHA-256 (`JWT_SECRET`).
* Transmitted exclusively inside `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookies.
* RBAC guards: `requireAuth`, `requireRole(['operator', 'owner'])`, `requireShop`.

### 6.2 Agent Security & Signed URLs
* Agent requests pass `x-agent-key` matching `shop.agentKey`.
* File downloads use short-lived HMAC signatures:
  `token = HMAC_SHA256(jobId + ":" + expires, AGENT_SIGNING_SECRET)`
* Downloads strictly expire after 2 minutes ($120\text{ seconds}$).

### 6.3 Input Sanitation & Attack Surface Minimization
* Multi-part uploads pass through `multer` with a 20 MB size ceiling.
* Custom middleware verifies file headers against magic byte tables (PDF: `%PDF`, PNG: `\x89PNG`, JPG: `\xFF\xD8\xFF`).
* All user input is sanitized against NoSQL injection via `express-mongo-sanitize`.
* Cross-Site Scripting (XSS) mitigated through Content Security Policy (CSP) headers via `helmet`.

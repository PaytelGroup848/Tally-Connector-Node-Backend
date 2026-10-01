# LiveKeeping Backend API

Base URL: `http://localhost:5000/api`

All JSON responses follow:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {}
}
```

Error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Human readable message",
  "code": "ERROR_CODE",
  "data": null
}
```

Validation errors additionally include `errors: [{ "field", "message" }]`.

## Auth headers

| Context | Header |
|---|---|
| Web JWT | `Authorization: Bearer <web_token>` (httpOnly cookie `lk_web_token` is also accepted) |
| Connector JWT | `Authorization: Bearer <connector_access_token>` |
| Super Admin | Same as Web JWT, but the user email must match `SUPER_ADMIN_EMAIL` and `isSuperAdmin=true` |

A connector token is never accepted on web routes, and a web token is never accepted on connector routes.

## Shared error codes

| Code | Meaning |
|---|---|
| `UNAUTHORIZED` | Missing/invalid token |
| `FORBIDDEN` | Authenticated but not allowed |
| `VALIDATION_ERROR` | Request body/query failed validation |
| `NOT_FOUND` | Resource missing |
| `CONFLICT` | Duplicate or illegal state |
| `SUBSCRIPTION_REQUIRED` | Org has no subscription |
| `SUBSCRIPTION_EXPIRED` | `status !== ACTIVE` or `toDate` has passed (no grace period) |
| `OTP_INVALID` / `OTP_EXPIRED` / `OTP_MAX_ATTEMPTS` / `OTP_COOLDOWN` | OTP flow |
| `SEAT_LIMIT_REACHED` | Member invite blocked by `plan.seatLimit + extraSeats` |
| `PLAN_NOT_FOUND` | Unknown/inactive plan |
| `INVALID_SIGNATURE` / `PAYMENT_VERIFICATION_FAILED` | Razorpay |
| `AUTH_REVOKED` | Connector refresh token revoked or mismatched |
| `CONNECTOR_NOT_FOUND` | Unknown connector |
| `COMMAND_NOT_FOUND` | Unknown command |
| `SYNC_JOB_NOT_FOUND` | Unknown sync job |
| `TALLY_LINK_REQUIRED` | Company has no linked connector |

## Permission keys

Plans store permission keys in `features[]`. Final web permission = **role permissions ∩ plan.features**. Connectors skip role and use plan features only.

```
ORG_UPDATE, MEMBER_INVITE, MEMBER_MANAGE, PAYMENT_CREATE,
COMPANY_READ, COMPANY_LINK, LEDGER_READ, CUSTOMER_READ, SUPPLIER_READ,
STOCK_READ, VOUCHER_READ, REPORTS_READ, COMMAND_CREATE, CONNECTOR_STATUS,
SYNC_MASTER, SYNC_LEDGER, SYNC_VOUCHER, SYNC_STOCK
```

Roles: `OWNER` (all keys), `ADMIN` (no billing/sync write), `ACCOUNTANT` (data + commands), `VIEWER` (read-only).

`organizationId`, `plan`, and `permissions` in request bodies are ignored. They are always derived from the token.

---

# Section 8a — Web APIs

Frontend calls these. Auth: Web JWT unless noted.

## Auth

### POST `/auth/send-otp`

- **Auth:** None (rate limited)
- **Use case:** Start email + 4-digit OTP login. No passwords.
- **Body:** `{ "email": "user@example.com" }`
- **Success `200`:** `{ "email": "user@example.com", "expiresInMinutes": 5 }`
- **Errors:** `OTP_COOLDOWN` (429), `OTP_RATE_LIMIT` (429), `VALIDATION_ERROR` (422)

### POST `/auth/verify-otp`

- **Auth:** None (rate limited)
- **Use case:** Verify OTP, issue Web JWT. Creates User + Organization (OWNER) on first login. Invited members join their existing org instead.
- **Body:** `{ "email": "user@example.com", "otp": "1234" }`
- **Success `200`:**

```json
{
  "token": "<jwt>",
  "user": { "id": "...", "email": "...", "isVerified": true, "isSuperAdmin": false },
  "organization": { "id": "...", "name": "..." },
  "role": "OWNER"
}
```

- **Errors:** `OTP_INVALID`, `OTP_EXPIRED`, `OTP_MAX_ATTEMPTS`

### POST `/auth/logout`

- **Auth:** Web JWT
- **Use case:** Clear the web auth cookie.
- **Body:** `{}`
- **Success `200`:** `null`

## Plans (public)

### GET `/plans`

- **Auth:** None
- **Use case:** Pricing page — active plans with duration/price options.
- **Success `200`:** `{ "plans": [{ "id", "name", "description", "features", "seatLimit", "pricingOptions": [{ "durationMonths", "price", "discountPercent" }], "addonPricePerSeat" }] }`

## Payments (self-serve Razorpay)

First purchase is allowed without an active subscription. Role must include `PAYMENT_CREATE` (OWNER).

### POST `/payments/create-order`

- **Auth:** Web JWT
- **Use case:** Create a Razorpay order for a plan duration and optional extra seats. Extra seats expire with the parent subscription `toDate`.
- **Body:** `{ "planId": "<id>", "durationMonths": 12, "extraSeats": 0 }`
- **Success `200`:** `{ "orderId", "amount", "currency": "INR", "keyId", "plan": { "id", "name", "durationMonths", "extraSeats" } }`
- **Errors:** `PLAN_NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`

### POST `/payments/verify`

- **Auth:** Web JWT
- **Use case:** Verify Razorpay signature, then create/update the org's single Subscription in place (`source=RAZORPAY`). `fromDate=now`, `toDate=now+durationMonths`.
- **Body:** `{ "razorpay_order_id": "...", "razorpay_payment_id": "...", "razorpay_signature": "..." }`
- **Success `200`:** `{ "subscription": { "id", "status", "fromDate", "toDate", "extraSeats", "planId", "source": "RAZORPAY" } }`
- **Errors:** `INVALID_SIGNATURE`, `FORBIDDEN`, `PLAN_NOT_FOUND`

## Organization

### GET `/organizations/me`

- **Auth:** Web JWT
- **Use case:** Current org profile, role, resolved permissions, subscription summary.
- **Success `200`:** `{ "organization": { "id", "name", "ownerId", "createdAt" }, "role", "permissions": [], "subscription": { "id", "status", "fromDate", "toDate", "extraSeats", "source", "active", "plan": { "id", "name", "seatLimit", "features" } } | null }`

### PATCH `/organizations/me`

- **Auth:** Web JWT + `ORG_UPDATE` + active subscription
- **Use case:** Update org name.
- **Body:** `{ "name": "Acme Pvt Ltd" }`
- **Success `200`:** `{ "organization": { "id", "name" } }`

## Members / roles

### GET `/members`

- **Auth:** Web JWT + `MEMBER_MANAGE`
- **Use case:** List the org's team and roles.
- **Success `200`:** `{ "members": [{ "id", "userId", "email", "role", "status", "createdAt" }] }`

### POST `/members/invite`

- **Auth:** Web JWT + `MEMBER_INVITE`
- **Use case:** Invite a sub-user by email. They log in with the same web OTP flow. Seat check: `plan.seatLimit + extraSeats`.
- **Body:** `{ "email": "a@b.com", "role": "ACCOUNTANT" }` — role: `OWNER` \| `ADMIN` \| `ACCOUNTANT` \| `VIEWER`
- **Success `201`:** `{ "member": { "id", "email", "role", "status": "INVITED" } }`
- **Errors:** `SEAT_LIMIT_REACHED`, `CONFLICT`, `SUBSCRIPTION_EXPIRED`

### PATCH `/members/:id/role`

- **Auth:** Web JWT + `MEMBER_MANAGE`
- **Use case:** Change a member's role. Last OWNER cannot be demoted.
- **Body:** `{ "role": "VIEWER" }`
- **Success `200`:** `{ "member": { "id", "role" } }`

### DELETE `/members/:id`

- **Auth:** Web JWT + `MEMBER_MANAGE`
- **Use case:** Remove a member (not yourself, not an OWNER).
- **Success `200`:** `null`

## Companies

### GET `/companies`

- **Auth:** Web JWT + `COMPANY_READ`
- **Use case:** Tally companies linked to this org.
- **Success `200`:** `{ "companies": [{ "id", "tallyCompanyName", "tallyCompanyGuid", "linkedByConnectorId", "createdAt" }] }`

### GET `/companies/:id`

- **Auth:** Web JWT + `COMPANY_READ`
- **Use case:** Single company detail.
- **Success `200`:** `{ "company": { "id", "tallyCompanyName", "tallyCompanyGuid", "linkedByConnectorId", "createdAt" } }`
- **Errors:** `NOT_FOUND`

## Dashboard / data read

Query: `page`, `limit` (max 100), `q` (name search). Vouchers also accept `voucherType`, `from`, `to`.

All scoped to the authenticated user's `organizationId`.

| Method | Route | Permission | Use case |
|---|---|---|---|
| GET | `/companies/:id/ledgers` | `LEDGER_READ` | Chart of accounts |
| GET | `/companies/:id/customers` | `CUSTOMER_READ` | Sundry debtors |
| GET | `/companies/:id/suppliers` | `SUPPLIER_READ` | Sundry creditors |
| GET | `/companies/:id/stock` | `STOCK_READ` | Stock balances |
| GET | `/companies/:id/vouchers` | `VOUCHER_READ` | Voucher list |

**Success:** `{ "items": [...], "total", "page", "limit" }`

### GET `/companies/:id/reports/:reportType`

- **Auth:** Web JWT + `REPORTS_READ`
- **Use case:** Dashboard reports from synced data.
- **`reportType`:** `trial-balance` \| `day-book` \| `pnl` \| `balance-sheet` \| `voucher-lines` (`?voucherId=` required)
- **day-book query:** `from`, `to` (ISO dates)

### GET `/connectors/status`

- **Auth:** Web JWT + `CONNECTOR_STATUS`
- **Use case:** Dashboard widget — connector online/offline, last heartbeat, last sync.
- **Success `200`:** `{ "connectors": [{ "id", "deviceId", "deviceName", "status", "lastHeartbeatAt", "tallyConnected", "connectorVersion" }], "lastSync": { "id", "type", "status", "startedAt", "completedAt", "companyId" } \| null }`

## Commands (web → Tally via polling)

The backend never calls the connector. The connector polls for PENDING commands.

### POST `/companies/:id/commands`

- **Auth:** Web JWT + `COMMAND_CREATE`
- **Use case:** Queue an action for Tally (e.g. create voucher).
- **Body:** `{ "type": "CREATE_VOUCHER", "payload": { } }`
- **Success `201`:** `{ "command": { "id", "type", "status": "PENDING", "companyId", "createdAt" } }`
- **Errors:** `TALLY_LINK_REQUIRED`, `NOT_FOUND`, `SUBSCRIPTION_EXPIRED`

### GET `/commands/:id`

- **Auth:** Web JWT + active subscription
- **Use case:** Poll command status/result from the dashboard.
- **Success `200`:** `{ "command": { "id", "type", "status", "payload", "result", "errorMessage", "createdAt", "completedAt" } }`

## Subscription (web)

### GET `/subscriptions/me`

- **Auth:** Web JWT
- **Use case:** Current org subscription + plan (or null).
- **Success `200`:** `{ "subscription": { "id", "status", "fromDate", "toDate", "extraSeats", "source", "active", "plan" } \| null }`

---

# Section 8b — Super Admin APIs

Single seeded account from `SUPER_ADMIN_EMAIL`. No signup. No sales role.

## Super admin auth

### POST `/super-admin/auth/send-otp`

- **Auth:** None (rate limited). Only `SUPER_ADMIN_EMAIL` is accepted.
- **Body:** `{ "email": "admin@yourdomain.com" }`
- **Success `200`:** `{ "email", "expiresInMinutes" }`
- **Errors:** `FORBIDDEN` if email is not the seeded super admin

### POST `/super-admin/auth/verify-otp`

- **Auth:** None
- **Body:** `{ "email", "otp" }`
- **Success `200`:** `{ "token", "user": { "id", "email", "isSuperAdmin": true } }`

Subsequent routes require Super Admin (Web JWT + seeded email).

## Organizations

### GET `/super-admin/organizations`

- **Use case:** List all client orgs with subscription summary.
- **Success `200`:** `{ "organizations": [{ "id", "name", "ownerId", "createdAt", "subscription": { "id", "status", "fromDate", "toDate", "extraSeats", "source" } \| null }] }`

### GET `/super-admin/organizations/:id`

- **Use case:** Full client detail: members, subscription history, connectors.
- **Success `200`:** `{ "organization", "members", "subscription", "connectors" }`

## Manual subscriptions

Same `Subscription` collection as Razorpay. No payment reference is stored for `MANUAL`. If the org already has a subscription, it is **updated in place** (plan change does not close-and-recreate).

### POST `/super-admin/subscriptions/manual`

- **Use case:** Sales-assisted activation: `{ email, planId, fromDate, toDate }`. Creates User/Organization if needed.
- **Body:** `{ "email": "client@co.com", "planId": "...", "fromDate": "2026-04-01", "toDate": "2027-04-01", "extraSeats": 0, "organizationName": "optional" }`
- **Success `201`:** `{ "organization", "user", "subscription": { "id", "status", "fromDate", "toDate", "extraSeats", "source": "MANUAL" } }`

### PATCH `/super-admin/subscriptions/:id`

- **Use case:** Edit dates, extra seats, or change plan on the **same** document. Logged in `history[]` and AuditLog.
- **Body (all optional):** `{ "planId", "fromDate", "toDate", "extraSeats", "status": "ACTIVE"|"EXPIRED" }`
- **Success `200`:** `{ "subscription": { "id", "planId", "status", "fromDate", "toDate", "extraSeats", "source" } }`

### GET `/super-admin/subscriptions/:id/history`

- **Use case:** Embedded history + AuditLog trail for that org's subscription.
- **Success `200`:** `{ "subscriptionId", "history": [], "audits": [] }`

## Plan catalog

### GET `/super-admin/plans`

- **Use case:** Manage dynamic plans (never hardcode names/prices in app logic).
- **Success `200`:** `{ "plans": [ ...full Plan documents ] }`

### POST `/super-admin/plans`

- **Body:**

```json
{
  "name": "Pro",
  "description": "Full sync + commands",
  "features": ["LEDGER_READ", "SYNC_LEDGER", "SYNC_VOUCHER", "COMMAND_CREATE"],
  "seatLimit": 2,
  "pricingOptions": [
    { "durationMonths": 12, "price": 9999, "discountPercent": 0 },
    { "durationMonths": 36, "price": 24999, "discountPercent": 10 }
  ],
  "addonPricePerSeat": 1499,
  "isActive": true
}
```

- **Success `201`:** `{ "plan": { ... } }`

### PATCH `/super-admin/plans/:id`

- **Body:** any subset of plan fields above.
- **Success `200`:** `{ "plan": { ... } }`

## Fleet

### GET `/super-admin/connectors`

- **Use case:** All connectors online/offline.
- **Success `200`:** `{ "connectors": [{ "id", "organizationId", "deviceId", "deviceName", "status", "lastHeartbeatAt", "tallyConnected", "connectorVersion" }] }`

---

# Section 8c — Connector APIs

**Share this section with the Python connector developer.**

The connector sits behind NAT. It always initiates HTTP calls. The backend never opens a connection to the PC.

Base: `/api/connector/...`

Auth after login: `Authorization: Bearer <accessToken>`

Access token TTL: `JWT_CONNECTOR_ACCESS_EXPIRES_IN` (default 1h).  
Refresh token TTL: `JWT_CONNECTOR_REFRESH_EXPIRES_IN` (default 90d).

## Connector auth

### POST `/connector/auth/send-otp`

- **Auth:** None (rate limited)
- **Use case:** Email + 4-digit OTP for the connector `.exe`. Context is separate from web OTP.
- **Body:** `{ "email": "owner@co.com" }`
- **Success `200`:** `{ "email": "owner@co.com", "expiresInMinutes": 5 }`
- **Errors:** `OTP_COOLDOWN` (429), `VALIDATION_ERROR` (422)

### POST `/connector/auth/verify-otp`

- **Auth:** None
- **Use case:** Bind this Windows device to the user's organization. Issues connector access + refresh tokens. Resolves plan + permissions server-side.
- **Body:**

```json
{
  "email": "owner@co.com",
  "otp": "1234",
  "deviceId": "stable-machine-guid",
  "deviceName": "ACCOUNTS-PC",
  "connectorVersion": "1.0.0"
}
```

- **Success `200`:**

```json
{
  "connector": {
    "id": "...",
    "organizationId": "...",
    "deviceId": "stable-machine-guid",
    "deviceName": "ACCOUNTS-PC",
    "connectorVersion": "1.0.0",
    "status": "ONLINE"
  },
  "plan": { "id": "...", "name": "Pro", "features": ["SYNC_LEDGER"], "seatLimit": 2 },
  "permissions": ["SYNC_LEDGER", "SYNC_VOUCHER"],
  "subscription": {
    "status": "ACTIVE",
    "fromDate": "2026-04-01T00:00:00.000Z",
    "toDate": "2027-04-01T00:00:00.000Z",
    "extraSeats": 0,
    "active": true
  },
  "accessToken": "<short-lived>",
  "refreshToken": "<long-lived>"
}
```

Store `refreshToken` securely on disk. Use `accessToken` on every subsequent request.

- **Errors:** `OTP_INVALID`, `OTP_EXPIRED`, `OTP_MAX_ATTEMPTS`

### POST `/connector/auth/refresh`

- **Auth:** None (refresh token in body)
- **Use case:** New access token without OTP.
- **Body:** `{ "refreshToken": "<long-lived>" }`
- **Success `200`:** same identity payload as verify-otp **plus** `{ "accessToken" }` (no new refresh token)
- **Errors:** `AUTH_REVOKED` (401) — force OTP login again

### POST `/connector/auth/logout`

- **Auth:** Connector JWT
- **Use case:** Revoke refresh token; mark connector OFFLINE.
- **Body:** `{}`
- **Success `200`:** `null`

## Identity / status

`organizationId` is taken only from the connector token. Do not send it in bodies.

### GET `/connector/me`

- **Auth:** Connector JWT + active subscription
- **Use case:** Call on startup to confirm still authorized.
- **Success `200`:** `{ "connector": { "id", "organizationId", "deviceId", "deviceName", "connectorVersion", "status", "lastHeartbeatAt", "tallyConnected" }, "plan", "permissions", "subscription": { "status", "fromDate", "toDate", "active" } }`
- **Errors:** `SUBSCRIPTION_EXPIRED` (402), `AUTH_REVOKED` (401)

### GET `/connector/companies`

- **Auth:** Connector JWT + active subscription
- **Use case:** Companies already linked to this org.
- **Success `200`:** `{ "companies": [{ "id", "tallyCompanyName", "tallyCompanyGuid" }] }`

### POST `/connector/company/link`

- **Auth:** Connector JWT + active subscription
- **Use case:** Register a newly discovered Tally company (idempotent on `tallyCompanyGuid`).
- **Body:** `{ "tallyCompanyName": "ABC Traders", "tallyCompanyGuid": "tally-guid" }`
- **Success `200`:** `{ "company": { "id", "tallyCompanyName", "tallyCompanyGuid" } }`
- Use returned `id` as `companyId` in sync/start.

### POST `/connector/heartbeat`

- **Auth:** Connector JWT (allowed even if subscription expired, so the dashboard can still show last seen)
- **Use case:** Keep ONLINE + `lastHeartbeatAt`. Recommend every 30–60s. Backend treats heartbeat older than 2 minutes as OFFLINE on read.
- **Body:** `{ "tallyConnected": true, "deviceInfo": { "os": "Windows 10", "tallyVersion": "TallyPrime 4" }, "connectorVersion": "1.0.0" }`
- **Success `200`:** `{ "status": "ONLINE", "lastHeartbeatAt": "...", "tallyConnected": true }`

## Sync

All writes are **upsert by** `{ organizationId, companyId, tallyExternalId }`. Retries must not create duplicates.

`entityType` values: `LEDGER` \| `CUSTOMER` \| `SUPPLIER` \| `ITEM` \| `VOUCHER` \| `VOUCHER_LINE` \| `STOCK`

Sync permission mapping:

| entityType | Required plan feature |
|---|---|
| LEDGER | `SYNC_LEDGER` |
| CUSTOMER, SUPPLIER, ITEM | `SYNC_MASTER` |
| VOUCHER, VOUCHER_LINE | `SYNC_VOUCHER` |
| STOCK | `SYNC_STOCK` |

### POST `/connector/sync/start`

- **Auth:** Connector JWT + active subscription
- **Body:** `{ "companyId": "<mongo id>", "type": "INITIAL" }` — `type` is `INITIAL` or `INCREMENTAL`
- **Success `200`:**

```json
{
  "syncJobId": "...",
  "type": "INCREMENTAL",
  "checkpoints": [
    { "entityType": "LEDGER", "lastSyncedAt": "...", "lastSyncedExternalId": "..." }
  ]
}
```

Use checkpoints to resume incremental sync. Empty array on first INITIAL sync.

### POST `/connector/sync/batch`

- **Auth:** Connector JWT + active subscription
- **Body:**

```json
{
  "syncJobId": "...",
  "entityType": "LEDGER",
  "records": [
    {
      "tallyExternalId": "guid-or-master-id",
      "name": "Cash",
      "parent": "Current Assets",
      "group": "Cash-in-hand",
      "ledgerType": "asset",
      "openingBalance": 0,
      "closingBalance": 1500,
      "gstin": ""
    }
  ]
}
```

**Customer / Supplier record fields:** `tallyExternalId`, `name`, `gstin`, `email`, `phone`, `address`, `openingBalance`, `closingBalance`

**Item:** `tallyExternalId`, `name`, `unit`, `hsn`, `rate`

**Stock:** `tallyExternalId`, `itemName` (or `name`), `itemTallyExternalId`, `godown`, `quantity`, `rate`, `value`

**Voucher (lines optional, upserted together):**

```json
{
  "tallyExternalId": "voucher-guid",
  "voucherType": "Sales",
  "voucherNumber": "INV-101",
  "date": "2026-04-12",
  "partyLedger": "Customer A",
  "amount": 11800,
  "narration": "",
  "lines": [
    {
      "tallyExternalId": "optional-line-id",
      "ledgerName": "Sales",
      "ledgerTallyExternalId": "...",
      "debit": 0,
      "credit": 10000,
      "itemName": "Widget",
      "itemTallyExternalId": "...",
      "qty": 2,
      "rate": 5000
    }
  ]
}
```

Every record **must** include `tallyExternalId`. Extra fields are stored in `raw`.

- **Success `200`:** `{ "upserted": 10, "failed": 0, "entityType": "LEDGER" }`
- Failed rows are stored as `SyncError` (job continues).
- **Errors:** `SYNC_JOB_NOT_FOUND`, `FORBIDDEN` (plan missing entity permission), `VALIDATION_ERROR`

### POST `/connector/sync/complete`

- **Auth:** Connector JWT + active subscription
- **Body:** `{ "syncJobId": "..." }`
- **Success `200`:** `{ "syncJobId", "status": "COMPLETED", "completedAt" }`

## Commands (cloud → Tally)

Poll. WebSocket can replace this later.

Statuses: `PENDING` → `SENT` (when returned by poll) → `DONE` \| `FAILED`

### GET `/connector/commands`

- **Auth:** Connector JWT + active subscription
- **Query:** `limit` (default 10, max 50)
- **Use case:** Fetch PENDING commands for this org. Returned commands are marked `SENT`.
- **Success `200`:**

```json
{
  "commands": [
    {
      "id": "...",
      "companyId": "...",
      "type": "CREATE_VOUCHER",
      "payload": {},
      "createdAt": "..."
    }
  ]
}
```

Empty `commands` array means nothing to do. Poll every few seconds.

### POST `/connector/commands/:commandId/result`

- **Auth:** Connector JWT + active subscription
- **Body:** `{ "status": "DONE", "resultPayload": { "tallyVoucherNumber": "INV-101" }, "errorMessage": null }`
- `status` must be `DONE` or `FAILED`. On failure set `errorMessage`.
- **Success `200`:** `{ "command": { "id", "status", "result" } }`
- **Errors:** `COMMAND_NOT_FOUND`

## Config / version

### GET `/connector/config`

- **Auth:** Connector JWT + active subscription
- **Use case:** Feature flags and suggested sync interval.
- **Success `200`:** `{ "syncIntervalSeconds": 300, "features": ["SYNC_LEDGER"], "flags": { "incrementalSync": true, "commandPolling": true } }`

### GET `/connector/version`

- **Auth:** Connector JWT
- **Use case:** Update check vs `CONNECTOR_LATEST_VERSION`.
- **Success `200`:** `{ "latestVersion": "1.0.0", "downloadUrl": null }`

## Suggested connector call order

1. `POST /connector/auth/send-otp` → user enters OTP  
2. `POST /connector/auth/verify-otp` → persist tokens  
3. `GET /connector/me` — if `SUBSCRIPTION_EXPIRED`, stop sync/commands  
4. Heartbeat loop: `POST /connector/heartbeat`  
5. Discover Tally companies → `POST /connector/company/link`  
6. `POST /connector/sync/start` → batches → `complete`  
7. Poll `GET /connector/commands` → execute in Tally → `POST .../result`  
8. On 401 access token → `POST /connector/auth/refresh`  
9. On `AUTH_REVOKED` → full OTP login again  

## Health

### GET `/health`

- **Auth:** None  
- **Success:** `{ "success": true, "message": "ok" }` (mounted at `/api/health`)

---

# Section 8d — My Entries (web track record of created entries)

These endpoints list and cancel **Commands** created from the web app (`POST /companies/:id/commands`). They are the user's own track record, including entries that have not synced to Tally yet.

`POST /companies/:id/commands` accepts any string `type` and a mixed `payload` (no server-side enum). The documented example type is `CREATE_VOUCHER`. Screens below filter on `type` and, for voucher screens, `payload.voucherType`.

| Screen | Query |
|---|---|
| My Vouchers | `type=CREATE_VOUCHER` |
| My Quotations | `type=CREATE_VOUCHER&voucherType=Quotation` |
| My Invoices | `type=CREATE_VOUCHER&voucherType=Sales` |
| My Parties | `type=CREATE_PARTY` |
| My Stock Items | `type=CREATE_STOCK_ITEM` |
| My eWay Bills | not implemented yet |

`voucherType` is matched against `payload.voucherType`. Synced voucher lists in this API use Tally names such as `Sales`, `Quotation`, `Receipt`, `Payment`, `Sales Order`, `Purchase`, `Purchase Order`, `Journal`, `Contra`, `Credit Note`, `Debit Note`, `Stock Journal`, `Physical Stock`, `Receipt Note`, `Delivery Note` — send the same strings the create payload used (not camelCase aliases like `SalesInvoice`).

`CREATE_PARTY` and `CREATE_STOCK_ITEM` are client-chosen `type` values; the create handler does not whitelist them.

Once a Command is `DONE`, the real record also appears in the synced data APIs (`/companies/:id/vouchers`, `/customers`, `/stock`, etc.). The connector posts `{ "status": "DONE" \| "FAILED", "resultPayload", "errorMessage" }`; `resultPayload` is stored as `result`. The documented connector example is `{ "tallyVoucherNumber": "INV-101" }`. Treat `result` as mixed — use whatever identifier the connector stored (e.g. `tallyVoucherNumber`, `tallyExternalId`, or a Mongo `_id`).

### GET `/companies/:id/commands`

- **Auth:** Web JWT + `COMMAND_CREATE`
- **Use case:** My Entries list (All / Pending / Completed tabs, date range, search, pagination).
- **Query:**
  - `type` — exact Command type (e.g. `CREATE_VOUCHER`)
  - `voucherType` — exact `payload.voucherType` (e.g. `Sales`, `Quotation`)
  - `status` — comma-separated Command statuses. Pending tab: `status=PENDING,SENT`. Completed tab: `status=DONE`. All tab: omit `status`. Optional: include `FAILED` if the UI should show failures.
  - `from`, `to` — ISO dates on `createdAt`
  - `q` — case-insensitive search in `payload.name`, `payload.partyName`, `payload.partyLedger`, `payload.voucherNumber`, `payload.itemName`
  - `page` (default 1), `limit` (default 20, max 100)
- **Success `200`:**

```json
{
  "commands": [
    {
      "id": "...",
      "type": "CREATE_VOUCHER",
      "status": "PENDING",
      "payload": { "voucherType": "Sales", "partyLedger": "Customer A", "voucherNumber": "INV-101" },
      "result": null,
      "errorMessage": null,
      "createdAt": "...",
      "completedAt": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

- **Errors:** `FORBIDDEN`, `SUBSCRIPTION_EXPIRED`, `SUBSCRIPTION_REQUIRED`

### DELETE `/companies/:id/commands/:commandId`

- **Auth:** Web JWT + `COMMAND_CREATE`
- **Use case:** Remove a not-yet-synced My Entry. Only `PENDING` commands can be cancelled (`SENT` means the connector already picked it up).
- **Success `200`:** `null`
- **Errors:** `COMMAND_NOT_FOUND`, `CONFLICT` (status is not `PENDING`), `FORBIDDEN`, `SUBSCRIPTION_EXPIRED`





1. Org Admin → Settings → "E-Way Bill Setup"
   apna GSTIN + GSP username/password (ya API key) enter karta hai
   → encrypted store hota hai backend me (per-organization)

2. User → "My eWay Bills" → "+ Generate"
   → ek existing Sales Invoice select karta hai (jo already synced/created hai)
   → transport details fill karta hai (vehicle no., transporter name/GSTIN, 
     distance, transport mode) — ye Tally se nahi aata, manually enter hota hai

3. Backend → GSP API ko call karta hai (org ke apne GSTIN credentials se)
   → GSP → NIC (government) → EWB Number + QR code + Valid-upto milta hai

4. Backend save karta hai (EwayBill collection) + QR image generate karta hai

5. Backend ek COMMAND create karta hai (jaisa "My Entries" me banaya tha) 
   taaki Connector isi EWB number ko wapas Tally me likh de 
   (Tally ka voucher "compliant" dikhna chahiye, EWB number ke saath)

6. Connector poll karega command, Tally me EWB details save karega, 
   result wapas post karega

7. GUI pe "My eWay Bills" list dikhegi — EWB Number, QR code, Valid Till, 
   Print button
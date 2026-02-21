# BevOne — Production Build Specification v3.0

> **For:** Claude Code (or equivalent agentic coding system) acting as senior full-stack + voice-systems engineer  
> **Classification:** Multi-tenant SaaS platform with real-time voice AI agents  
> **Context:** Funded. Deploying to real venues within 8 weeks. First paying customers within 5 months. This is not a demo — it's a production system that will process real orders, manage real inventory, and handle real money.

---

## 0 · OPERATING REALITY

This system will be used by bartenders mid-rush at 11pm on a Friday with a packed house, spotty WiFi, sticky fingers on an iPad, and 40 open tabs. It will be used by venue managers at 7am Monday reviewing weekend numbers with their coffee. It will be used by event coordinators juggling 6 inquiries while on the phone with a florist.

**Every architectural decision must pass this test:** *"Will this still work when the bartender is 4 hours into a Friday night rush, the WiFi drops for 30 seconds, and they have 12 open tabs?"*

### Design Principles

1. **Reliability over cleverness.** If voice goes down, the UI still works. If the internet drops, orders still process. Data never gets lost.
2. **Tenant isolation is non-negotiable.** A leaked row across tenants is a company-ending event. Postgres RLS is the last line of defense, not the only one.
3. **Latency is the product** (for voice). Every millisecond between "user stops talking" and "agent starts responding" is felt. But voice is an accelerator, not a dependency — every voice action has a UI fallback.
4. **Determinism over magic.** Every agent action is traceable: intent → tool selection → permission check → execution → result → audit log.
5. **Progressive trust.** Voice AI starts as a helper. Sensitive actions (closing orders, sending messages, creating POs) always require explicit confirmation. Earn operator trust over months, not assumptions.
6. **Offline-first for critical paths.** Tab opening, item adding, and order management MUST work during network interruptions. Sync when connectivity returns.

---

## 1 · PRODUCT OVERVIEW

**BevOne** is a multi-tenant SaaS platform that lets event venues and hospitality operators run their business with AI voice-powered web applications. Three flagship modules share a common voice runtime and tool framework, and an App Builder lets operators configure custom AI-assisted workflows.

### 1.1 Flagship Modules

| Module | Domain | Who Uses It | When |
|--------|--------|-------------|------|
| **BevPro POS** | Point-of-sale for bars/restaurants | Bartenders, servers, managers | During service — high pressure, high speed |
| **BevPro Inventory** | Inventory + procurement | Bar managers, owners | Pre/post service — counts, ordering, variance review |
| **Venue Assistant** | Booking, admin, finance, ops | Event coordinators, GMs, owners | Office hours — planning, communication, finance |

### 1.2 Platform: App Builder

Template-based app creation: choose a template → configure pages, tools, data sources, role permissions, and assistant persona → publish to a tenant-scoped route. Configuration is DB-stored; no code generation.

---

## 2 · ARCHITECTURE

### 2.1 Tech Stack

| Layer | Technology | Why This, Not That |
|-------|-----------|-------------------|
| **Frontend** | Next.js 15+ (App Router) + TypeScript 5.x + Tailwind CSS 4 + shadcn/ui | RSC for fast initial loads; App Router for nested layouts per tenant/venue/module. shadcn gives us production-quality components without design debt. |
| **Backend** | Next.js Route Handlers + standalone Node service for voice session management | Route Handlers for CRUD; dedicated long-lived process for WebSocket sideband connections (serverless would add cold-start latency to voice). |
| **Database** | PostgreSQL 16+ with Row-Level Security | RLS as defense-in-depth. `app.current_tenant_id` session variable set per transaction. |
| **ORM** | Prisma 6+ with Client Extensions | Extensions for automatic tenant context injection via `$executeRaw('SELECT set_config(...)')`. |
| **Cache / Offline** | Service Worker + IndexedDB (client), Redis (server) | Client-side: offline order queue for POS. Server-side: session cache, rate limiting, real-time data. |
| **Voice Runtime** | OpenAI Realtime API (GA, `gpt-realtime` model) via WebRTC (browser) + sideband WebSocket (server) | Native speech-to-speech. WebRTC for audio (no server hop). Sideband for secure tool execution. |
| **Voice SDK** | `@openai/agents` + `@openai/agents-realtime` (TypeScript Agents SDK) | First-party: `RealtimeAgent`, `RealtimeSession`, built-in guardrails, tool validation (Zod v4), tracing, handoffs. |
| **Payments** | Stripe Terminal (JavaScript SDK) + Stripe API | Real payment processing from day 1. Stripe Terminal JS SDK connects to readers on local network. Stripe Connect for multi-venue multi-tenant payout isolation. |
| **Auth** | NextAuth v5 (Auth.js) — Credentials + Google OAuth | JWT with `tenantId`, `venueId`, `role` in session. PIN-based fast-switch for bar staff (no re-login during service). |
| **Validation** | Zod v4 | Shared schemas: API validation, tool params, form validation. Required by Agents SDK. |
| **Email/SMS** | Resend (email) + Twilio (SMS) | Real sending for Venue Assistant communications. Not stubs — venues need to actually contact clients. |
| **Monorepo** | Turborepo | `apps/web`, `apps/voice-server`, `packages/kernel`, `packages/db`, `packages/ui`, `packages/shared` |
| **Hosting** | Docker Compose (dev) + Fly.io (production) | Fly for low-latency edge; separate process groups for web + voice-server. Postgres on Fly or Neon. |
| **Monitoring** | Sentry (errors) + Axiom or Betterstack (logs) + Checkly (uptime) | Production requires observability. Non-negotiable. |

### 2.2 Voice Architecture (Critical Path)

**Pattern:** WebRTC browser → OpenAI for audio. Sideband WebSocket from server → same session for tools/guardrails.

```
┌─────────────────┐       WebRTC (audio only)        ┌──────────────────┐
│    Browser       │ ◄──────────────────────────────► │  OpenAI Realtime │
│  (iPad/tablet    │    gpt-realtime model            │    API Server    │
│   at the bar)    │    semantic_vad                   │                  │
└──────┬──────────┘                                   └────────┬─────────┘
       │                                                       │
       │ HTTPS: ephemeral key,                                 │ WebSocket sideband
       │ session config, approval responses                    │ (wss://...?call_id=xxx)
       │                                                       │
┌──────▼───────────────────────────────────────────────────────▼───────────┐
│                        BevOne Voice Server (Fly.io)                      │
│                                                                          │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────────┐   │
│  │ Session Mgr   │  │ Tool Router   │  │ Permission Gate            │   │
│  │ (tenant-aware │  │ (Zod-typed,   │  │ + Output Guardrails        │   │
│  │  call_id map) │  │  sandboxed)   │  │ + Approval State Machine   │   │
│  └───────────────┘  └───────────────┘  └────────────────────────────┘   │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────────┐   │
│  │ Audit Writer  │  │ Decision      │  │ Memory (session + venue)   │   │
│  │ (async, non-  │  │ Trace Logger  │  │ Redis short-term           │   │
│  │  blocking)    │  │               │  │ Postgres long-term         │   │
│  └───────────────┘  └───────────────┘  └────────────────────────────┘   │
│                              │                                           │
│                     ┌────────▼─────────┐                                │
│                     │  PostgreSQL + RLS │                                │
│                     └──────────────────┘                                │
└──────────────────────────────────────────────────────────────────────────┘
```

**Session Lifecycle:**

1. Browser calls `POST /api/voice/session` with auth token
2. Voice server validates auth → resolves tenant/venue/role → calls OpenAI `POST /v1/realtime/client_secrets` with full session config (model, voice, tools, semantic_vad, persona instructions)
3. Browser establishes WebRTC peer connection to OpenAI using client secret
4. Voice server opens sideband WebSocket to `wss://api.openai.com/v1/realtime?call_id={callId}`
5. **Audio flows browser ↔ OpenAI directly** (no server hop for media = low latency)
6. Tool calls arrive on sideband → server validates permissions → executes → returns result → writes audit log
7. Output guardrails run server-side (debounced every ~100 chars) checking for PII, off-topic, policy violations
8. If tool requires approval → server emits `approval_required` event to browser via SSE/WebSocket → browser shows approval UI → user confirms → server executes

**Voice Session Config:**

```typescript
{
  type: "realtime",
  model: "gpt-realtime",
  audio: {
    input: {
      format: { type: "audio/pcm", rate: 24000 },
      turn_detection: {
        type: "semantic_vad",     // Semantic — doesn't cut off mid-sentence
        eagerness: "medium",      // Bar environment: balanced
        create_response: true,
        interrupt_response: true
      },
      noise_reduction: { type: "far_field" }  // Venues are noisy. far_field for countertop/bar iPad
    },
    output: {
      format: { type: "audio/pcmu" },
      voice: "marin"  // Configurable per assistant persona
    }
  },
  input_audio_transcription: {
    model: "gpt-4o-mini-transcribe"  // Async transcription for logs
  },
  tools: [/* injected per-module, per-role, per-venue */],
  instructions: "/* injected per-assistant persona + venue context */"
}
```

### 2.3 Offline Resilience (POS Critical Path)

The POS module MUST continue functioning during network outages. This is a hard requirement for production bar environments.

**Architecture:**

```typescript
// Client-side offline queue (Service Worker + IndexedDB)
interface OfflineAction {
  id: string;
  type: 'order.create' | 'order.addItems' | 'order.close' | 'payment.record';
  payload: Record<string, unknown>;
  createdAt: Date;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'conflicted';
  venueId: string;
  userId: string;
}

// Flow:
// 1. User action → write to IndexedDB immediately → update local UI
// 2. If online: POST to API → on success mark synced → on fail retry with backoff
// 3. If offline: queue in IndexedDB → show "offline" indicator in UI
// 4. When connectivity returns: drain queue in order → resolve conflicts → update UI
// 5. Conflict resolution: server timestamp wins, but client data is never silently dropped
```

**What works offline:**
- Opening tabs/orders
- Adding items to orders  
- Viewing current open orders (cached)
- Viewing menu (cached)
- Recording payments (queued)

**What requires connectivity:**
- Voice assistant (WebRTC needs internet)
- Stripe Terminal payment processing (needs Stripe API)
- Inventory updates
- Venue assistant operations
- Reporting / analytics

**UI indicators:** Always show connection status. When offline, show a prominent but non-blocking banner: "📡 Offline — orders are queued and will sync when connected."

### 2.4 Multi-Tenancy (Three-Layer Defense)

**Layer 1 — Application Middleware:**
```typescript
// middleware.ts — runs on every request
// Extract tenantId from session JWT
// Validate user has membership in this tenant + venue
// Reject with 403 if not authorized
// Set x-tenant-id and x-venue-id headers for downstream
```

**Layer 2 — Prisma Client Extension:**
```typescript
// packages/db/client.ts
// Every query wrapped in transaction that first runs:
// SELECT set_config('app.current_tenant_id', $1, true);
// SELECT set_config('app.current_venue_id', $2, true);
// 'true' = local to transaction (not session-wide)
```

**Layer 3 — PostgreSQL RLS:**
```sql
-- On EVERY tenant-scoped table:
ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_orders FORCE ROW LEVEL SECURITY; -- Even for table owner

CREATE POLICY tenant_isolation ON pos_orders
  FOR ALL TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Separate admin role with BYPASSRLS for platform super-admin
CREATE ROLE app_admin WITH LOGIN BYPASSRLS;
```

**DB Roles:**
- `app_owner`: Migrations only. Never used at runtime.
- `app_user`: All application connections. Subject to RLS.
- `app_admin`: BYPASSRLS for platform admin. Separate connection string.

### 2.5 Monorepo Structure

```
bevone/
├── apps/
│   ├── web/                          # Next.js frontend + API routes
│   │   ├── app/
│   │   │   ├── (auth)/               # Login, register, OAuth, PIN-switch
│   │   │   ├── (platform)/           # Authenticated shell with venue switcher
│   │   │   │   ├── admin/            # Tenant admin console
│   │   │   │   ├── v/[venueSlug]/
│   │   │   │   │   ├── pos/          # POS module (dashboard, orders, menu, reports)
│   │   │   │   │   ├── inventory/    # Inventory module
│   │   │   │   │   ├── assistant/    # Venue Assistant module
│   │   │   │   │   ├── apps/[appSlug]/ # Custom app routes
│   │   │   │   │   └── voice/        # Voice console (shared component, per-module context)
│   │   │   │   └── builder/          # App Builder
│   │   │   └── api/                  # All API routes
│   │   ├── lib/
│   │   │   ├── offline/              # Service worker, IndexedDB queue, sync engine
│   │   │   └── stripe/               # Stripe Terminal client setup
│   │   ├── public/sw.js              # Service worker for offline support
│   │   └── middleware.ts
│   │
│   └── voice-server/                 # Standalone Node process
│       ├── src/
│       │   ├── session-manager.ts    # call_id ↔ tenant context mapping, WS lifecycle
│       │   ├── tool-router.ts        # Dispatches tool calls to module handlers
│       │   ├── guardrails.ts         # Output guardrails, permission enforcement
│       │   ├── approval-broker.ts    # SSE/WS bridge for approval requests to browser
│       │   └── audit.ts              # Async structured logging (non-blocking)
│       └── Dockerfile
│
├── packages/
│   ├── kernel/                       # Agent kernel — shared AI runtime
│   │   ├── src/
│   │   │   ├── agents/               # RealtimeAgent configs per module
│   │   │   ├── tools/                # Zod-typed, permission-gated tool definitions
│   │   │   │   ├── pos/              # openTab, addItems, closeOrder, getSales, etc.
│   │   │   │   ├── inventory/        # checkStock, setPar, createPO, getVariance, etc.
│   │   │   │   ├── venue/            # createBooking, assignTask, draftMessage, etc.
│   │   │   │   └── shared/           # getCurrentTime, lookupVenueInfo, etc.
│   │   │   ├── permissions.ts        # Role → tool ACL
│   │   │   ├── memory.ts             # Session + venue memory
│   │   │   ├── decision-trace.ts     # Structured trace per tool call
│   │   │   └── types.ts
│   │   └── __tests__/
│   │
│   ├── db/                           # Prisma schema, migrations, RLS, seed
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── rls/                      # SQL for RLS policies (applied post-migration)
│   │   └── client.ts                 # Extended Prisma client
│   │
│   ├── ui/                           # Shared UI components
│   │   ├── components/
│   │   │   ├── voice-console.tsx
│   │   │   ├── tool-call-viewer.tsx
│   │   │   ├── action-approval.tsx
│   │   │   ├── hey-bev-button.tsx
│   │   │   ├── connection-status.tsx  # Online/offline indicator
│   │   │   └── pin-pad.tsx           # Fast user switch for bar staff
│   │   └── hooks/
│   │       ├── use-voice-session.ts
│   │       ├── use-offline-queue.ts
│   │       └── use-tenant-context.ts
│   │
│   └── shared/                       # Zod schemas, constants, types
│
├── docker-compose.yml                # Postgres + Redis + web + voice-server
├── fly.toml
├── turbo.json
└── README.md
```

---

## 3 · DATA MODEL

All tenant-scoped tables MUST include `tenant_id UUID NOT NULL` and appropriate `venue_id`. All have RLS enabled with `FORCE ROW LEVEL SECURITY`. All have indexes on `(tenant_id)` and `(tenant_id, venue_id)` where applicable.

> **Full Prisma schema is provided in the v2.0 spec and remains the same**, with the following production additions:

### 3.1 Production Additions to v2.0 Schema

```prisma
// === SHIFT MANAGEMENT (new for production) ===
model Shift {
  id          String   @id @default(uuid())
  tenantId    String
  venueId     String
  userId      String
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  cashStart   Decimal? @db.Decimal(10, 2)  // Starting cash drawer amount
  cashEnd     Decimal? @db.Decimal(10, 2)  // Ending cash drawer amount
  tipTotal    Decimal  @default(0) @db.Decimal(10, 2)
  salesTotal  Decimal  @default(0) @db.Decimal(10, 2)
  orderCount  Int      @default(0)
  notes       String?
  
  @@index([tenantId, venueId, startedAt])
  @@index([userId, startedAt])
}

// === PIN AUTH for bar staff fast-switch ===
// Added to User model:
// pin String? — 4-digit PIN for quick switch during service (hashed)
// pinExpiresAt DateTime? — PINs expire and must be re-set each shift

// === STRIPE INTEGRATION (new for production) ===
model StripeAccount {
  id                String   @id @default(uuid())
  tenantId          String   @unique
  stripeAccountId   String   @unique  // Stripe Connect account ID (acct_xxx)
  onboardingComplete Boolean @default(false)
  payoutsEnabled    Boolean  @default(false)
  chargesEnabled    Boolean  @default(false)
  createdAt         DateTime @default(now())
}

model StripeTerminalLocation {
  id                  String   @id @default(uuid())
  tenantId            String
  venueId             String   @unique
  stripeLocationId    String   @unique  // tml_xxx
  displayName         String
  createdAt           DateTime @default(now())
}

model StripeTerminalReader {
  id                String   @id @default(uuid())
  tenantId          String
  venueId           String
  stripeReaderId    String   @unique  // tmr_xxx
  label             String   // "Bar Reader 1", "Patio Terminal"
  status            String   @default("online")  // online, offline
  lastSeenAt        DateTime?
  
  @@index([tenantId, venueId])
}

// === UPDATED POS PAYMENT for real processing ===
// PosPayment model additions:
// stripePaymentIntentId String?  — pi_xxx
// stripeChargeId        String?  — ch_xxx  
// cardBrand             String?  — "visa", "mastercard"
// cardLast4             String?  — "4242"
// receiptUrl            String?  — Stripe receipt URL
// refundedAmount        Decimal? — partial/full refund tracking
// refundedAt            DateTime?

// === COMMUNICATIONS (real sending, not stubs) ===
// VenueMessage model additions:
// resendMessageId  String?  — Resend email ID for tracking
// twilioSid        String?  — Twilio message SID for tracking
// deliveredAt      DateTime? — Delivery confirmation timestamp
// openedAt         DateTime? — Email open tracking (Resend webhook)

// === OPERATIONAL ===
model SystemHealth {
  id          String   @id @default(uuid())
  service     String   // "web", "voice-server", "postgres", "redis", "stripe"
  status      String   // "healthy", "degraded", "down"
  lastCheckAt DateTime @default(now())
  details     Json?
  
  @@index([service, lastCheckAt])
}
```

### 3.2 Data Model — Full Schema Reference

The complete Prisma schema from the v2.0 spec (Section 3) remains canonical, with the additions above merged in. The full list of model groups:

**Core:** Tenant, Venue, User, Membership, Shift, StripeAccount, StripeTerminalLocation, StripeTerminalReader  
**Auth:** (managed by NextAuth: Account, Session, VerificationToken)  
**Audit/Agent:** AuditLog, AgentSession, AgentMessage, ToolCall  
**App Builder:** AppTemplate, App  
**POS:** PosMenuItem, PosModifier, PosOrder, PosOrderItem, PosPayment, PosInventoryLink  
**Inventory:** InventoryProduct, InventoryParLevel, InventoryCount, InventoryTransaction, PurchaseOrder, PurchaseOrderItem  
**Venue:** VenueEvent, VenueTask, VenueMessage, Invoice  
**Ops:** SystemHealth

---

## 4 · AGENT KERNEL

### 4.1 Tool Framework

Every tool is Zod-typed, permission-gated, audit-logged, approval-aware, and citation-capable. The framework from v2.0 Section 4 remains canonical. Key additions for production:

**Idempotency:** Tools that mutate state must accept an optional `idempotencyKey` to prevent duplicate execution from retries (especially critical for payment and order operations).

**Timeout:** Tools have a max execution time of 5 seconds. If exceeded, return a timeout error to the model (which can explain the delay to the user).

**Graceful degradation:** If a tool fails, the model receives a structured error and can explain the situation conversationally. Tools never throw unhandled exceptions.

```typescript
export interface ToolDefinition<TInput extends z.ZodType, TOutput extends z.ZodType> {
  name: string;
  description: string;
  module: 'pos' | 'inventory' | 'venue' | 'shared';
  parameters: TInput;
  returns: TOutput;
  requiredRoles: Role[];
  requiresApproval: boolean;
  approvalMessage?: (input: z.infer<TInput>) => string;
  timeoutMs?: number;               // Default 5000
  idempotent?: boolean;              // If true, accepts idempotencyKey
  offlineCapable?: boolean;          // If true, can queue for offline execution (POS only)
  execute: (input: z.infer<TInput>, ctx: ToolContext) => Promise<ToolResult<z.infer<TOutput>>>;
}
```

### 4.2 Permission Matrix

Same as v2.0 Section 4.4. For production, also enforce:

- **Shift-awareness:** POS tools check that the user has an active shift. No orders can be opened outside a shift.
- **Venue hours:** Optional — tools can be configured to warn (not block) outside operating hours.
- **Spending limits:** Comps and voids have per-role limits (e.g., bartender can comp up to $50, manager unlimited).

### 4.3 Agent Personas (per module)

Each module's `RealtimeAgent` gets venue-specific context injected at session start:

```typescript
// Dynamic instruction template (filled at session creation)
const posInstructions = (venue: Venue, user: User, shift: Shift) => `
You are Bev, the voice assistant for ${venue.name}'s bar POS.

## Context
- Venue: ${venue.name}
- Staff member: ${user.name} (${user.role})
- Shift started: ${shift.startedAt}
- Current time: ${new Date().toLocaleTimeString()}
- Active orders: [injected at session start]

## Personality
- Think experienced bartender who's also great with numbers.
- Concise — this is a busy bar. Confirm actions in 1-2 sentences max.
- Proactive — suggest logical next steps.

## Rules
- Always confirm totals before closing tabs.
- If a menu item is ambiguous, ask which one.
- For sales questions, give the headline number first, then offer detail.
- Never say internal IDs or database references out loud.
- If you don't know something, say so. Don't guess menu items or prices.

## Voice Style
- Keep responses under 3 sentences for operational commands.
- Natural: "Got it, two margaritas on Table 6" not "I have added 2 margaritas to order #47."
- Numbers: "twenty-three fifty" not "twenty-three dollars and fifty cents."
- Don't say "Sure!" or "Absolutely!" — just do the thing and confirm.
`;
```

---

## 5 · MODULE SPECIFICATIONS

### 5.1 BevPro POS (Highest Priority — Must Be Production-Ready First)

**Pages:**
- `/v/{venueSlug}/pos` — **Service View:** Grid of open orders/tabs, quick-add buttons, today's totals. This is the primary screen during service.
- `/v/{venueSlug}/pos/orders` — Order list with filters (open, closed, date range, staff member)
- `/v/{venueSlug}/pos/orders/[id]` — Order detail + receipt view (printable)
- `/v/{venueSlug}/pos/menu` — Menu management (CRUD items, modifiers, categories, 86'd items)
- `/v/{venueSlug}/pos/reports` — Sales reports: daily summary, hourly breakdown, top sellers, staff performance, shift summaries
- `/v/{venueSlug}/pos/shifts` — Shift management: clock in/out, cash drawer counts, shift reports
- `/v/{venueSlug}/pos/settings` — POS config: tax rates, tip settings, receipt customization, Stripe Terminal reader management

**Production POS Features:**

| Feature | Details |
|---------|---------|
| **Tab management** | Open/close, transfer between staff, merge tabs, split checks |
| **Menu 86** | Mark items as unavailable mid-service (voice: "86 the salmon") |
| **Quick-add** | Configurable quick buttons for top sellers on service view |
| **Modifiers** | Nested: "Make it a double" (+$4), "No ice", "Extra lime" |
| **Discounts** | Percentage or flat, per-item or per-order, require manager PIN for >20% |
| **Comps/Voids** | Full audit trail, require manager approval above threshold |
| **Tips** | Pre-set percentages on card payments, manual entry for cash |
| **Shift management** | Clock in → set cash drawer start → service → clock out → cash count → shift report |
| **Receipts** | Printable (thermal printer via browser print), email receipt option |
| **Stripe Terminal** | Connect to physical card reader, process real payments, handle refunds |
| **Offline mode** | Queue orders in IndexedDB, sync on reconnection, show offline indicator |

**Voice Workflows (8 minimum, all production-tested):**

| # | User Says | Tool(s) | Response Pattern |
|---|-----------|---------|-----------------|
| 1 | "Start a tab for table 6" | `pos_open_tab` | "Tab open for Table 6. What are they having?" |
| 2 | "Add 2 margaritas and a Corona" | `pos_add_items` | "Added. Table 6 is at $35 so far." |
| 3 | "Make one of those margaritas a double" | `pos_modify_item` | "One margarita upgraded to double — Table 6 now at $39." |
| 4 | "What's the total on table 6?" | `pos_get_order` | "Table 6: $39 before tax, $42.22 with tax." |
| 5 | "Close table 6, credit card" | `pos_close_order` ⚠️ | "Close Table 6 at $42.22 on card? [Approve]" → processes via Stripe Terminal |
| 6 | "86 the espresso martini" | `pos_86_item` | "Espresso Martini is 86'd. I'll let you know if anyone orders it." |
| 7 | "What's selling tonight?" | `pos_get_sales` | "Tonight: $3,240 across 67 orders. Top 3: Margarita (31), Old Fashioned (22), IPA (19)." |
| 8 | "Transfer table 6 to Sarah" | `pos_transfer_tab` | "Table 6 transferred to Sarah." |

### 5.2 BevPro Inventory

**Pages:**
- `/v/{venueSlug}/inventory` — Dashboard: low stock alerts, pending POs, recent counts, depletion rate
- `/v/{venueSlug}/inventory/products` — Product catalog with current quantities + par status
- `/v/{venueSlug}/inventory/counts` — Count sessions: start count → scan/enter quantities → submit → view variances
- `/v/{venueSlug}/inventory/orders` — Purchase orders: create from low-stock, track status, receive against PO
- `/v/{venueSlug}/inventory/vendors` — Vendor management (name, contact, products they supply)
- `/v/{venueSlug}/inventory/reports` — Variance reports, cost analysis, usage trends, waste tracking

**Production Inventory Features:**

| Feature | Details |
|---------|---------|
| **POS depletion** | When a cocktail is sold, linked inventory products auto-deplete (e.g., 1 Margarita = 2oz tequila, 1oz lime juice, 1 lime) |
| **Par alerts** | Dashboard widget + optional daily email: items below par level |
| **Count sessions** | Structured count workflow with variance calculation against expected |
| **PO workflow** | Draft → Submit → Partially Received → Received. Receiving updates inventory counts. |
| **Vendor management** | Track which vendor supplies which products, with cost per unit |
| **Waste tracking** | Record breakage/spoilage separately from sales depletion |
| **Cost analysis** | Cost-of-goods-sold per menu item, pour cost percentage |

**Voice Workflows (6 minimum):**

| # | User Says | Tool(s) | Response |
|---|-----------|---------|----------|
| 1 | "How many bottles of Patron do we have?" | `inv_check_stock` | "8 bottles. Par is 12, so you're 4 short." |
| 2 | "Set par for limes to 40" | `inv_set_par` | "Lime par updated to 40. Currently at 28 — 12 under." |
| 3 | "Record 14 bottles of Tito's" | `inv_record_count` | "Tito's counted at 14. Expected 16 — variance of 2 bottles." |
| 4 | "Create a PO for everything below par" | `inv_create_po` ⚠️ | "7 items below par, estimated $1,240. Create the PO? [Approve]" |
| 5 | "We received the Southern Wine order" | `inv_receive_po` | "PO #47 from Southern Wine — 12 line items. Want to confirm all received, or go item by item?" |
| 6 | "What's our pour cost on margaritas?" | `inv_get_cost` | "Classic Margarita: $3.42 ingredient cost on a $14 menu price — 24.4% pour cost." |

### 5.3 Venue Assistant

**Pages:**
- `/v/{venueSlug}/assistant` — Dashboard: upcoming events, overdue tasks, recent inquiries, revenue this month
- `/v/{venueSlug}/assistant/events` — Event pipeline (kanban: Inquiry → Tour → Proposal → Hold → Confirmed → Completed)
- `/v/{venueSlug}/assistant/events/[id]` — Event detail: client info, timeline, tasks, messages, invoices, documents
- `/v/{venueSlug}/assistant/calendar` — Calendar view of events + tasks
- `/v/{venueSlug}/assistant/tasks` — Task board (kanban or list, filter by assignee/due/event)
- `/v/{venueSlug}/assistant/messages` — Communications log with real send capability
- `/v/{venueSlug}/assistant/finance` — Invoices + revenue summary + payment tracking

**Production Features:**

| Feature | Details |
|---------|---------|
| **Email sending** | Real emails via Resend. Templates for follow-ups, proposals, confirmations. |
| **SMS sending** | Real SMS via Twilio. Appointment reminders, quick follow-ups. |
| **Invoice generation** | PDF invoices with venue branding, line items, payment terms. Sendable via email. |
| **Contract links** | Store URLs to external contract docs (DocuSign, PandaDoc, Google Drive) |
| **Calendar integration** | iCal feed export. Google Calendar sync (stretch goal). |
| **Revenue dashboard** | Booked revenue, collected revenue, outstanding invoices, pipeline value |

**Voice Workflows (6 minimum):**

| # | User Says | Tool(s) | Response |
|---|-----------|---------|----------|
| 1 | "Schedule a tour for the Martinez wedding, next Tuesday at 2pm" | `venue_create_booking` | "Tour with Martinez scheduled for Tuesday Feb 25 at 2pm. Want me to send a confirmation email?" |
| 2 | "Send a follow-up email to the Johnson wedding" | `venue_send_message` ⚠️ | "Draft: 'Hi Johnson family, following up on your June wedding...' Send it? [Approve]" |
| 3 | "What's on the calendar this week?" | `venue_get_schedule` | "3 events: Miller reception Friday 6pm, 2 venue tours Saturday. Plus 4 tasks due." |
| 4 | "Create a task: order linens for the Garcia event, assign to Sarah, due Thursday" | `venue_create_task` | "Task created and assigned to Sarah, due Thursday." |
| 5 | "Give me a summary of the Garcia corporate event" | `venue_get_event` | "Garcia Corp: June 14, 150 guests, cocktail package at $8,500. Deposit received. 3 tasks outstanding." |
| 6 | "How much revenue do we have confirmed for Q2?" | `venue_get_financials` | "Q2 confirmed revenue: $47,800 across 6 events. Pipeline has another $23,000 in proposals." |

---

## 6 · PAYMENTS (Stripe Terminal — Real Processing)

### 6.1 Architecture

```
Venue Owner signs up → Stripe Connect onboarding (Standard account)
  → Each venue gets a Stripe Terminal Location
  → Physical readers registered to location
  → Payments flow: POS → Stripe Terminal JS SDK → Reader → Stripe → Venue's connected account
```

### 6.2 Implementation

```typescript
// 1. Stripe Connect — tenant onboarding
// POST /api/admin/stripe/onboard → creates Stripe Connect account, returns onboarding link
// Webhook: account.updated → update StripeAccount.onboardingComplete

// 2. Terminal setup — per venue  
// POST /api/admin/stripe/locations → creates Stripe Terminal Location for venue
// POST /api/admin/stripe/readers → registers reader to location

// 3. Payment flow — during service
// a. POS creates PaymentIntent (server-side, with connected account)
// b. Stripe Terminal JS SDK collects payment method from reader
// c. PaymentIntent confirmed → POS records payment → order closed
// d. Webhook: payment_intent.succeeded → reconciliation check

// 4. Refunds
// POST /api/pos/orders/:id/refund → creates Stripe Refund on original PaymentIntent
// Supports partial refunds
```

### 6.3 Fallback

If Stripe Terminal reader is disconnected or payment fails:
- Record as "cash" or "external card" payment type
- Flag for reconciliation
- Never block order closure due to payment system issues — the bar must keep moving

---

## 7 · VOICE CONSOLE UI

Same layout as v2.0 Section 6. Production additions:

### 7.1 Production UI Requirements

- **Noise indicator:** Show mic input level so bartender knows they're being heard over bar noise
- **Connection resilience:** Auto-reconnect on WebRTC drop. Show "Reconnecting..." state with countdown.
- **Quick actions:** Physical buttons alongside voice for the most common ops (open tab, close tab) — voice is an accelerator, not the only path
- **Shift-aware:** Voice console only activates during an active shift for POS module
- **Multi-device:** Multiple iPads at the same bar, each with their own voice session, all hitting the same venue data
- **Session cost tracking:** Show estimated voice session cost in settings (tokens + audio minutes) so operators understand usage

### 7.2 "Hey Bev" — Implementation Path

**Phase 1 (now):** Button tap to activate. Hold Space on keyboard.
**Phase 2 (month 3):** Evaluate Picovoice Porcupine for client-side wake word. Architecture is ready — just swap the trigger.
**Phase 3 (month 5+):** Always-on listening with wake word detection if operator opts in.

---

## 8 · APP BUILDER

Same spec as v2.0 Section 7. Production-ready means:

- Templates include **real, tested configurations** (not empty shells)
- Published apps are **usable** — not just routable
- App config validation prevents broken states (e.g., enabling a tool without its data source)
- Apps can be **unpublished** without data loss

---

## 9 · SECURITY & COMPLIANCE

### 9.1 Application Security
- Zod validation on every API route and tool parameter
- Rate limiting: auth (5/min/IP), voice sessions (3 concurrent/user), API (200/min/user)
- CSRF protection on all mutation endpoints
- Content Security Policy headers
- No raw SQL anywhere — Prisma only

### 9.2 Payment Security
- PCI compliance via Stripe (they handle card data; we never see it)
- Stripe Terminal handles encryption at the reader level
- No card numbers stored in our database, ever
- Payment intents created server-side only

### 9.3 Agent Safety
- Model never has direct DB access — tools only
- Output guardrails (server-side, debounced) for PII, off-topic, policy violations
- Input guardrails for prompt injection detection
- All tool calls logged with full decision trace
- Sensitive actions always require user approval

### 9.4 Data
- Automated daily database backups (Fly.io Postgres or managed provider)
- Point-in-time recovery capability
- Data export capability per tenant (GDPR/privacy readiness)
- Audit logs retained for 2 years minimum

---

## 10 · MONITORING & OBSERVABILITY (Non-Negotiable for Production)

```
Sentry     → Error tracking (frontend + backend + voice server)
Axiom      → Structured logging (all services)
Checkly    → Uptime monitoring + synthetic checks
Stripe     → Payment webhook monitoring via Stripe Dashboard
Custom     → Voice session metrics: latency, duration, tool call success rate, approval rate
```

**Alerts (PagerDuty or email):**
- Error rate > 1% over 5 minutes
- API latency p95 > 2 seconds
- Voice session creation failures
- Stripe webhook delivery failures
- Database connection pool exhaustion
- Any RLS policy violation detected in logs

**Dashboard (admin console page):**
- Active venues, active sessions, orders today
- Voice usage: minutes, tool calls, cost estimate
- System health: all services green/yellow/red
- Recent errors with stack traces

---

## 11 · SEED DATA & ONBOARDING

### 11.1 Seed Script

The seed script creates a production-realistic demo environment, not toy data. It should feel like a venue that's been operating for 2 weeks.

```typescript
const seed = {
  tenant: { name: "Grand Hall Hospitality", slug: "grandhall", plan: "PRO" },
  venue: { name: "The Grand Hall", slug: "grand-hall", timezone: "America/New_York" },
  
  users: [
    { email: "alex@grandhall.com", name: "Alex Rivera", role: "OWNER", pin: "1234" },
    { email: "sarah@grandhall.com", name: "Sarah Chen", role: "MANAGER", pin: "5678" },
    { email: "mike@grandhall.com", name: "Mike Johnson", role: "BARTENDER", pin: "9012" },
    { email: "lisa@grandhall.com", name: "Lisa Park", role: "STAFF", pin: "3456" },
  ],
  
  menu: {
    // 25+ items across categories, with modifiers, realistic prices, tax rates
    // Include: signature cocktails, classics, beer (draft + bottles), wine, non-alc, food
    // Modifiers: "double" (+$4), "neat", "on the rocks", "extra shot" (+$2), dietary mods
  },
  
  inventory: {
    // 30+ products with realistic par levels, current quantities (some below par)
    // Include: spirits (8+), beer (4+), wine (3+), produce (5+), supplies (5+)
    // POS depletion links for all cocktail ingredients
    // One pending PO, one partially received PO
  },
  
  events: {
    // 8+ events across all pipeline stages
    // With tasks, messages, invoices at various stages
    // Include: 2 completed (with revenue), 3 upcoming, 2 in proposal stage, 1 new inquiry
  },
  
  historicalData: {
    // 2 weeks of order history (200+ orders) for meaningful reports
    // Shift records for all staff
    // Inventory count history showing variance trends
    // Realistic hourly distribution (busy Friday/Saturday nights)
  },
};
```

### 11.2 New Venue Onboarding Flow

When a real venue signs up:

1. **Create tenant** → name, contact, plan selection
2. **Stripe Connect** → onboarding flow to connect their Stripe account
3. **Create venue** → name, address, timezone, operating hours
4. **Import menu** → CSV upload or manual entry (voice-assisted: "Add a Classic Margarita at $14")
5. **Import inventory** → CSV upload or manual entry
6. **Invite staff** → email invites with role assignment
7. **Set up hardware** → connect Stripe Terminal reader(s), test payment
8. **Training mode** → guided walkthrough of POS, voice commands, and key workflows

---

## 12 · IMPLEMENTATION PHASES (5-Month Production Roadmap)

This isn't a demo sprint. Each phase has a **venue-testable milestone**.

### Phase 1: Foundation (Weeks 1-2)
**Milestone:** Staff can log in, see their venue, switch roles.

- Monorepo scaffolding (Turborepo, TypeScript configs)
- PostgreSQL schema + all migrations + RLS policies
- Prisma client with tenant extension
- NextAuth with credentials + Google OAuth + PIN-switch
- Tenant/venue/user admin console (CRUD)
- Middleware: auth guards, tenant context injection
- Basic UI shell: login, venue switcher, module navigation
- Docker Compose for local dev

### Phase 2: POS Core (Weeks 3-5)
**Milestone:** Bartender can open tabs, add items, close orders on an iPad. No voice yet.

- Menu management pages (CRUD, categories, modifiers, 86 status)
- Order management: open tab, add items, modify, close
- Service view: grid of open tabs with quick actions
- Shift management: clock in/out, cash counts
- Receipt generation (printable)
- Stripe Terminal integration: reader connection, payment processing, refunds
- Offline queue (IndexedDB + Service Worker) for order operations
- POS reporting: daily summary, hourly breakdown, top sellers

### Phase 3: Voice Runtime (Weeks 5-7)
**Milestone:** Voice console works end-to-end: speak → transcribe → tool call → response.

- Voice server (standalone Node process): session manager, sideband WebSocket
- Ephemeral key minting endpoint
- Voice Console UI component (shared across modules)
- WebRTC client hook with reconnection logic
- Tool router + permission gate
- Approval broker (server → browser SSE for approval requests)
- Output guardrails (PII check, off-topic detection)
- Audit logging for all tool calls
- Decision trace writer
- Latency tracking + display

### Phase 4: POS + Voice Integration (Weeks 7-9)
**Milestone:** Bartender can run full service via voice: open tabs, add drinks, close out.

- POS tool implementations (8+ tools, Zod-typed, tested)
- POS agent persona with venue context injection
- Voice workflows: all 8 from Section 5.1, tested in noisy conditions
- Shift-aware voice (only activates during active shift)
- Multi-device testing (2+ iPads hitting same venue)
- Integration tests: voice → tool → DB → audit → response
- **🎯 VENUE PILOT READY: Deploy to first test venue for POS testing**

### Phase 5: Inventory Module (Weeks 9-11)
**Milestone:** Manager can manage inventory, run counts, create POs via UI and voice.

- Inventory pages: products, counts, POs, vendors, reports
- POS → inventory depletion links and auto-depletion on order close
- Count session workflow (start → enter quantities → submit → variance report)
- PO workflow (create → submit → receive)
- Vendor management
- Inventory tools (6+) + voice workflows
- Cost analysis: pour cost per item

### Phase 6: Venue Assistant (Weeks 11-14)
**Milestone:** Coordinator can manage event pipeline, send real emails/SMS, track revenue.

- Event pipeline pages (kanban + detail view)
- Task management (board + list)
- Real email sending via Resend (templates + custom)
- Real SMS sending via Twilio
- Invoice generation (PDF) + payment tracking
- Calendar view + iCal export
- Revenue dashboard
- Venue assistant tools (6+) + voice workflows

### Phase 7: App Builder + Hardening (Weeks 14-17)
**Milestone:** Venue owner can create and publish custom apps.

- App Builder: template selection, config UI, preview, publish
- Custom app routing and rendering
- App template library (4 templates)
- End-to-end testing suite
- Performance optimization (Core Web Vitals, voice latency)
- Security audit: penetration testing on auth + tenant isolation
- Error handling polish across all modules
- Documentation: README, API docs, operator guide

### Phase 8: Production Launch (Weeks 17-20)
**Milestone:** Multiple venues actively using the platform.

- Fly.io production deployment with auto-scaling
- SSL, CDN, custom domains per tenant (optional)
- Monitoring + alerting (Sentry, Axiom, Checkly)
- Onboarding flow for new venues
- Billing implementation (Stripe Billing for SaaS subscriptions)
- Support infrastructure (help docs, in-app chat)
- **🎯 PRODUCTION: Onboard first paying customers**

---

## 13 · TESTING REQUIREMENTS

| Category | What | Tool |
|----------|------|------|
| **Unit** | Tool parameter validation, permission checks, price calculations, tax calculations | Vitest |
| **Integration** | API routes with tenant isolation, Stripe payment flows, offline sync | Vitest + Supertest |
| **RLS** | Cross-tenant query isolation, cross-venue isolation | Vitest + raw SQL assertions |
| **E2E** | Full order lifecycle, voice session lifecycle, app builder publish flow | Playwright |
| **Voice** | Tool call → response flow with mocked WebRTC | Custom harness |
| **Load** | POS under concurrent order load (50 simultaneous tabs per venue) | k6 or Artillery |
| **Offline** | Service worker interception, queue drain, conflict resolution | Playwright with network throttling |

**Minimum coverage:** All tools have parameter validation tests. All API routes have auth/tenant tests. All RLS policies have isolation tests. POS payment flow has end-to-end test.

---

## 14 · NON-GOALS (Explicit Scope Boundaries)

- **Native mobile apps** — responsive web on iPads. Architecture allows React Native wrapper later.
- **Kitchen Display System (KDS)** — future module, not MVP.
- **Loyalty programs** — future feature.
- **Multi-language** — English only.
- **On-device wake word** — button/tap trigger for now. Architecture ready for Picovoice.
- **Real-time collaboration** — single-user voice sessions (multiple users, separate sessions).
- **White-label / custom domains** — same UI, your brand. Future.
- **Accounting integration** — export capabilities only. QuickBooks/Xero integration is post-launch.

---

## 15 · DELIVERABLES CHECKLIST

### Must Ship (Phase 4 — First Venue Pilot)
- [ ] Multi-tenant auth with PIN-switch for bar staff
- [ ] POS: full order lifecycle (open → add → modify → close → pay)
- [ ] Stripe Terminal: real card payments on physical reader
- [ ] Offline mode: orders work without internet
- [ ] Voice console: working end-to-end with POS tools
- [ ] 8+ POS voice workflows tested
- [ ] Shift management: clock in/out, shift reports
- [ ] Audit logging for all mutations

### Must Ship (Phase 8 — Production Launch)
- [ ] All Phase 4 deliverables, hardened
- [ ] Inventory module: full workflow + POS depletion
- [ ] Venue Assistant: event pipeline + real email/SMS + invoicing
- [ ] App Builder: template-based creation + publishing
- [ ] Reporting across all modules
- [ ] Monitoring + alerting
- [ ] Onboarding flow for new venues
- [ ] Seed script with realistic 2-week history
- [ ] README with setup, deploy, and operator guide
- [ ] Production deployment on Fly.io
- [ ] 95%+ uptime target with monitoring

---

*Build it. Ship it. Run it in a real bar on a Friday night.*

# BevPro — Voice Agent Builder for Venues

## Overview
BevPro is a multi-tenant, no-code voice agent builder platform for event and wedding venue owners. Venue owners can create 5 types of voice agents (POS Integration, Agentic Voice POS, Inventory Manager, Venue Agent, and BevOne all-in-one). Features full voice pipeline with tool calling via OpenAI Realtime API + WebRTC. Tools are auto-enabled on agent creation. MCP endpoint available for external tool access.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS v4 + Framer Motion + Wouter routing
- **Backend**: Express.js on port 5000, PostgreSQL with Drizzle ORM
- **Auth**: Passport.js (local + Google OAuth20), bcryptjs, express-session + connect-pg-simple
- **Voice**: OpenAI Realtime API via WebRTC (ephemeral tokens from `OPENAI_API_KEY`). Primary pipeline only — no fallback.
- **AI (chat)**: OpenAI via Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`) for chat completions
- **Mobile**: Capacitor iOS app config + PWA fallback
- **Payments**: Stripe via Replit connector (stripe-replit-sync for webhook/schema/sync), products in stripe schema, org links via stripeCustomerId/stripeSubscriptionId
- **Multi-tenancy**: All data scoped by organizationId, enforced at storage and API layers
- **Plan enforcement**: Starter (2 agents, 1 venue), Pro (unlimited agents, 3 venues), Enterprise (unlimited). Checked on POST /api/agents
- **Theme**: Consistent dark theme (bg-black, glassmorphic cards) across all pages. Golden accent #C9A96E, underline inputs, no rounded-xl card grids
- **Responsive & UX**: All pages optimized for mobile (320px+) with venue-owner-friendly UX (larger text, higher contrast, bigger touch targets). Dashboard: card-based agent list with status badges, full-width CTA on mobile. DashboardLayout: mobile nav with descriptions per item, 56px touch targets, active gold-accent fill. AgentBuilder: tighter spacing (space-y-8), 16px inputs, sticky bottom step nav, 2-col voice grid, larger toggles (w-12 h-7). VenueData: card layout on mobile, 16px form fields, bigger action buttons. AppStore: single-column grid on small screens, text-base card titles, taller category tabs. Billing: 4xl usage numbers, rounded-lg plan cards, 44px-min upgrade buttons. Login/Register: py-4 inputs, text-base submit buttons, higher-contrast labels. Min text: 12px labels, 14px body. Min contrast: white/40 for labels, white/50 for descriptions.

## Data Model (shared/schema.ts)
### Core
- `organizations`: id, name, slug, plan (starter/pro/enterprise)
- `users`: id, email, password (hashed), name, role, organizationId
- `agents`: id, name, description, type, status (draft/active/paused), config (jsonb), organizationId
- `agentTools`: id, agentId, toolName, toolCategory, enabled, config (jsonb)
- `waitlist`: id, email, agentType, message

### Venue Data (all scoped by organizationId)
- `menuItems`: id, name, price, category, description, available, organizationId
- `inventoryItems`: id, name, quantity, unit, cost, reorderThreshold, supplier, organizationId
- `orders`: id, items (jsonb), total, status, paymentMethod, paymentStatus, tableNumber, customerName, organizationId
- `tabs`: id, customerName, items (jsonb), total, status, organizationId
- `bookings`: id, eventDate, eventTime, eventType, guestName, guestEmail, guestPhone, guestCount, status, notes, organizationId
- `staffMembers`: id, name, role, email, phone, organizationId
- `staffShifts`: id, staffMemberId, shiftDate, startTime, endTime, organizationId
- `guests`: id, name, email, phone, notes, visitCount, totalSpent, vipStatus, organizationId
- `tasks`: id, title, description, assignee, dueDate, status, priority, organizationId
- `wasteLogs`: id, item, quantity, unit, reason, cost, organizationId
- `suppliers`: id, name, contactName, email, phone, items, organizationId
- `ragDocuments`: id, agentId, organizationId, filename, content, contentType, sizeBytes, createdAt

### Agent Config (JSONB)
- `wakeWord`: { enabled, phrase, endPhrases[], shutdownPhrases[], levenshteinThreshold }
- `externalDb`: { enabled, type (supabase/convex/custom), connectionString }
- `rag`: { enabled, maxResults }
- `mcpEnabled`: boolean
- `fileUploadEnabled`: boolean

## Voice Agent Types
1. **BevOne** (bevone) — All-in-one comprehensive venue assistant
2. **Agentic Voice POS** (voice-pos) — Voice-controlled POS
3. **POS Integration** (pos-integration) — Square/Toast integration layer
4. **Inventory Manager** (inventory) — Stock tracking and management
5. **Venue Agent** (venue-admin) — Bookings, scheduling, operations

## 22 Real Tools (all query actual database)
### POS: square_pos_sync, toast_pos_sync, payment_processing, receipt_generation, tab_management, menu_lookup
### Voice POS: voice_ordering, split_checks, customer_lookup
### Inventory: stock_tracking, low_stock_alerts, supplier_management, waste_tracking, auto_reorder, inventory_pos_sync
### Operations: calendar_booking, staff_scheduling, financial_reports, guest_management, vendor_coordination, task_assignments
### Knowledge: knowledge_base_search (RAG — searches uploaded documents)

## Key Files
### Server
- `server/index.ts` — Express app setup
- `server/auth.ts` — Passport.js auth (local + Google OAuth20), session management, seeds venue data on registration
- `server/routes.ts` — API routes (agents CRUD, venue data CRUD, waitlist)
- `server/voice.ts` — Voice pipeline (WebRTC session, tool calls with orgId)
- `server/tools.ts` — 21 real tool implementations + auto-enable logic + system prompt builder
- `server/mcp.ts` — MCP (Model Context Protocol) JSON-RPC 2.0 endpoint
- `server/storage.ts` — Database storage interface with all CRUD methods + seedVenueData()
- `server/db.ts` — Database connection
- `server/stripeClient.ts` — Stripe SDK client (via Replit connector), publishable key, StripeSync singleton
- `server/webhookHandlers.ts` — Stripe webhook processing
- `server/seed-stripe.ts` — Stripe product/price creation script (idempotent)

### Client
- `client/src/components/BevProLogo.tsx` — Animated SVG waveform logo (BevProLogo + BevProBrand components)
- `client/src/pages/Home.tsx` — Landing page with interactive demo simulator + BevPro logo pulse
- `client/src/pages/Login.tsx` — Cinematic login page with Brighton Abbey glass chapel background, left-aligned underline form, golden CTA, floating venue glass card on desktop
- `client/src/pages/Register.tsx` — Cinematic split registration page with venue background image, left-aligned form, golden (#C9A96E) accent
- `client/src/pages/Dashboard.tsx` — Agent list as status rows (not card grid), summary stats, golden accent CTA
- `client/src/pages/AgentBuilder.tsx` — Guided step-by-step agent configuration with left sidebar (Identity → Voice & Behavior → Connections → Test & Launch), progressive disclosure, narrative flow
- `client/src/pages/AppStore.tsx` — iOS App Store-style agent marketplace
- `client/src/pages/AgentApp.tsx` — Full-screen voice interface; voice-pos type shows split-screen POS UI with live order display
- `client/src/pages/VenueData.tsx` — Venue data management (6 tabs: Menu, Inventory, Staff, Bookings, Guests, Suppliers)
- `client/src/pages/Documentation.tsx` — Public documentation/help page at /docs with 6 sections (Getting Started, First Agent, Agent Types, Venue Data, Voice Agents, Bulk Import)
- `client/src/pages/Pricing.tsx` — Pricing page (3 tiers) with real Stripe checkout for logged-in users
- `client/src/pages/Billing.tsx` — Subscription management: current plan, usage stats, upgrade/portal links
- `client/src/hooks/useAuth.ts` — Auth hook
- `client/src/hooks/useVoiceSession.ts` — WebRTC voice session hook (greeting, wake word detection, end/shutdown phrases)
- `client/src/components/VoiceTestPanel.tsx` — Voice test widget for agent builder
- `client/src/components/layout/DashboardLayout.tsx` — Dashboard sidebar layout (Agents, Venue Data, App Store)
- `client/src/components/layout/Navbar.tsx` — Landing page navbar
- `client/src/lib/agentTools.ts` — Tool catalog definitions

### Config
- `shared/schema.ts` — Drizzle schema + types + Zod validation (17 tables, incl. ragDocuments)
- `capacitor.config.ts` — Capacitor iOS app config
- `client/public/manifest.json` — PWA manifest

## API Endpoints
### Auth
- `POST /api/auth/register` — Register user + org + seed venue data
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Current user + org
- `GET /api/auth/config` — Auth config (googleEnabled boolean)
- `GET /api/auth/google` — Google OAuth initiation (only when GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET set)
- `GET /api/auth/google/callback` — Google OAuth callback

### Agents
- `GET/POST /api/agents` — List/create agents
- `GET/PATCH/DELETE /api/agents/:id` — Get/update/delete agent
- `GET/PUT /api/agents/:id/tools` — Get/set agent tools

### Voice
- `POST /api/voice/session` — Create WebRTC session (ephemeral token via OPENAI_API_KEY)
- `POST /api/voice/tool-call` — Execute tool call (with orgId)
- `POST /api/voice/chat` — Chat completions with tool calling (via Replit AI integration)
- `POST /api/voice/transcribe` — Whisper transcription for wake word detection (multipart, field: "audio", max 2MB)

### MCP (Model Context Protocol)
- `GET /api/mcp/:agentId` — Discovery endpoint (server info, tool list)
- `POST /api/mcp/:agentId` — JSON-RPC 2.0 endpoint (methods: initialize, tools/list, tools/call, ping)

### RAG Documents
- `GET /api/agents/:id/documents` — List agent's uploaded docs
- `POST /api/agents/:id/documents` — Upload file (multipart, field: "file", max 5MB, .txt/.md/.csv/.json)
- `DELETE /api/agents/:id/documents/:docId` — Delete document
- `GET /api/agents/:id/documents/search?q=` — Search documents by content

### Venue Data (all scoped by orgId)
- `GET/POST/PATCH/:id/DELETE/:id /api/venue/menu` — Menu items
- `POST /api/venue/menu/bulk` — Bulk import menu items (JSON array, max 500, per-item error reporting)
- `GET/POST/PATCH/:id/DELETE/:id /api/venue/inventory` — Inventory
- `GET/POST/PATCH/:id/DELETE/:id /api/venue/staff` — Staff members
- `GET/POST/PATCH/:id/DELETE/:id /api/venue/bookings` — Bookings
- `GET/POST/PATCH/:id/DELETE/:id /api/venue/guests` — Guests
- `GET/POST/PATCH/:id/DELETE/:id /api/venue/suppliers` — Suppliers
- `GET/POST/PATCH/:id/DELETE/:id /api/venue/tasks` — Tasks
- `GET /api/venue/orders` — Orders (read-only)
- `GET /api/venue/stats` — Revenue statistics
- `POST /api/waitlist` — Landing page email capture

### Billing / Stripe
- `GET /api/billing/config` — Stripe publishable key
- `GET /api/billing/products` — List Stripe products with prices (from stripe schema)
- `GET /api/billing/subscription` — Get current org subscription (auth required)
- `GET /api/billing/limits` — Get plan limits and usage (auth required)
- `POST /api/billing/checkout` — Create Stripe checkout session for a priceId (auth required)
- `POST /api/billing/portal` — Create Stripe customer portal session (auth required)
- `POST /api/billing/sync-subscription` — Sync subscription status from Stripe (auth required)
- `POST /api/stripe/webhook` — Stripe webhook handler (registered before express.json)

## Design
- Font: Inter (Google Fonts)
- Accent color: #C9A96E (golden champagne)
- Landing: Black background, champagne video, x.ai-inspired minimalism
- Register: Cinematic split layout — full-bleed venue background (register-bg.png), left-aligned form, underline inputs, golden CTA
- Dashboard: Dark (bg-black), sidebar nav (Agents, Venue Data, App Store)
- Agent Builder: Guided step flow with left sidebar nav (01 Identity → 02 Voice & Behavior → 03 Connections → 04 Test & Launch). Progressive disclosure, no cards — uses section dividers, underline inputs, toggle switches. Not a dashboard.
- Pricing: Dark theme (bg-black, white text, glassmorphic tier cards)
- Mobile app: Full black, iOS-native feel, safe area insets
- Query keys: All agent queries use `["agents"]` key; venue data uses `["venue", "menu"]` etc.

## Branding
- **Logo**: BevProLogo.tsx — 7-bar animated waveform SVG; `animated` prop enables Framer Motion loop; `pulseIntensity` controls animation scale
- **BevProBrand**: Logo + wordmark combo component
- **Favicon**: SVG logo at `/logo.svg` (preferred) + PNG fallback
- **PWA**: manifest.json references 192x192 and 512x512 icons

## Google OAuth
- Enabled when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables are set
- Uses passport-google-oauth20 strategy integrated with existing auth system
- First-time Google users auto-create org + user + seed venue data
- Login/Register pages show "Continue with Google" button only when configured
- `/api/auth/config` endpoint returns `{ googleEnabled: boolean }`

## iOS App Store Deployment
Capacitor is configured (`com.bevpro.app`). To build and submit:
1. **Prerequisites**: Mac with Xcode 15+, Apple Developer account ($99/yr), Node.js
2. **Build**: `npm run build` → `npx cap sync ios` → `npx cap open ios`
3. **Xcode config**: Set Bundle ID to `com.bevpro.app`, add Microphone usage description in Info.plist (`NSMicrophoneUsageDescription: "BevPro needs microphone access for voice agent interactions"`), set deployment target iOS 16+
4. **Signing**: Add Apple Developer team, enable automatic signing, create provisioning profile
5. **Icons**: Generate app icon set from logo.svg (1024x1024 required for App Store)
6. **Submit**: Product → Archive → Distribute App → App Store Connect → fill metadata (screenshots, description, privacy policy URL) → Submit for Review
7. **Key entitlements**: Microphone permission, HTTPS network access (already configured in Capacitor)

## Seed Data
New registrations auto-get: 18 menu items, 15 inventory items, 5 suppliers, 5 staff members, 4 guest profiles

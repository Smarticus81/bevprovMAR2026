# BevPro — Voice Agent Builder for Venues

## Overview
BevPro is a multi-tenant, no-code voice agent builder platform for event and wedding venue owners. Venue owners can create 5 types of voice agents (POS Integration, Agentic Voice POS, Inventory Manager, Venue Agent, and BevOne all-in-one). Features full voice pipeline with tool calling via OpenAI Realtime API + WebRTC.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS v4 + Framer Motion + Wouter routing
- **Backend**: Express.js on port 5000, PostgreSQL with Drizzle ORM
- **Auth**: Passport.js local strategy, bcryptjs, express-session + connect-pg-simple
- **Voice**: OpenAI Realtime API via WebRTC (ephemeral tokens), fallback to STT→Chat→TTS
- **AI**: OpenAI via Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`)
- **Mobile**: Capacitor iOS app config + PWA fallback

## Data Model (shared/schema.ts)
- `organizations`: id, name, slug, plan (starter/pro/enterprise)
- `users`: id, email, password (hashed), name, role, organizationId
- `agents`: id, name, description, type, status (draft/active/paused), config (jsonb), organizationId
- `agentTools`: id, agentId, toolName, toolCategory, enabled, config (jsonb)
- `waitlist`: id, email, agentType, message

## Voice Agent Types
1. **BevOne** (bevone) — All-in-one comprehensive venue assistant
2. **Agentic Voice POS** (voice-pos) — Voice-controlled POS
3. **POS Integration** (pos-integration) — Square/Toast integration layer
4. **Inventory Manager** (inventory) — Stock tracking and management
5. **Venue Agent** (venue-admin) — Bookings, scheduling, operations

## Key Files
### Server
- `server/index.ts` — Express app setup
- `server/auth.ts` — Passport.js auth, session management
- `server/routes.ts` — API routes (agents CRUD, waitlist, tools)
- `server/voice.ts` — Voice pipeline (WebRTC session, tool calls, fallback STT/TTS)
- `server/tools.ts` — Tool execution engine with mock data
- `server/storage.ts` — Database storage interface (Drizzle)
- `server/db.ts` — Database connection

### Client
- `client/src/pages/Home.tsx` — Landing page with champagne video
- `client/src/pages/Login.tsx` — Auth login page
- `client/src/pages/Register.tsx` — Auth registration page
- `client/src/pages/Dashboard.tsx` — Agent list with CRUD
- `client/src/pages/AgentBuilder.tsx` — No-code agent configuration (6 tabs)
- `client/src/pages/AppStore.tsx` — iOS App Store-style agent marketplace
- `client/src/pages/AgentApp.tsx` — Full-screen mobile voice interface
- `client/src/pages/Pricing.tsx` — Pricing page (3 tiers, UI only)
- `client/src/hooks/useAuth.ts` — Auth hook
- `client/src/hooks/useVoiceSession.ts` — WebRTC voice session hook
- `client/src/components/VoiceTestPanel.tsx` — Voice test widget for agent builder
- `client/src/components/layout/DashboardLayout.tsx` — Dashboard sidebar layout
- `client/src/components/layout/Navbar.tsx` — Landing page navbar
- `client/src/lib/agentTools.ts` — Tool catalog definitions

### Config
- `shared/schema.ts` — Drizzle schema + types + Zod validation
- `capacitor.config.ts` — Capacitor iOS app config
- `client/public/manifest.json` — PWA manifest

## API Endpoints
- `POST /api/auth/register` — Register user + org
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Current user + org
- `GET/POST /api/agents` — List/create agents
- `GET/PATCH/DELETE /api/agents/:id` — Get/update/delete agent
- `GET/PUT /api/agents/:id/tools` — Get/set agent tools
- `POST /api/voice/session` — Create WebRTC session (ephemeral token)
- `POST /api/voice/tool-call` — Execute tool call
- `POST /api/voice/transcribe` — Fallback STT
- `POST /api/voice/chat` — Fallback chat with tools
- `POST /api/voice/synthesize` — Fallback TTS
- `POST /api/waitlist` — Landing page email capture

## Design
- Font: Inter (Google Fonts)
- Landing: Black background, champagne video, x.ai-inspired minimalism
- Dashboard: Light (#f5f5f7), Apple-esque, sidebar navigation
- Mobile app: Full black, iOS-native feel, safe area insets

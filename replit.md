# BevPro — Voice Agent Builder for Venues

## Overview
BevPro is a multi-tenant, no-code platform enabling event and wedding venue owners to build five types of voice agents: POS Integration, Agentic Voice POS, Inventory Manager, Venue Agent, and an all-in-one BevOne agent. The platform features a full voice pipeline with tool calling via OpenAI's Realtime API and WebRTC, with tools auto-enabled upon agent creation. It includes an MCP endpoint for external tool access, aiming to revolutionize venue operations through voice-driven automation.

## User Preferences
I prefer simple language and clear instructions. I want iterative development where I can provide feedback at each stage. Ask before making major architectural changes or introducing new external dependencies. For the UI, I prefer a consistent dark theme with high contrast and larger touch targets, especially for mobile.

## System Architecture
BevPro uses a React, Vite, Tailwind CSS, and Framer Motion frontend with Wouter for routing. The backend is an Express.js application on port 5000, utilizing PostgreSQL with Drizzle ORM for data persistence. Authentication is handled by Passport.js, supporting local and Google OAuth20 strategies.

The voice pipeline leverages OpenAI's Realtime API via WebRTC for real-time interactions, featuring sophisticated wake word detection, VAD, and session pre-warming. AI chat functionalities are powered by OpenAI through Replit AI Integrations. Multi-tenancy is enforced at both storage and API layers, with all data scoped by `organizationId`.

**Key Architectural Decisions:**
- **UI/UX**: Dual theme system — dark mode ("Black Tie Evening": black bg, white text, gold accent #C9A96E) and light mode ("Afternoon Wedding": warm ivory #FAF8F5 bg, dark brown #2C2418 text, deeper gold accent #B08C3E). Semantic CSS classes (bg-page, text-ink, border-line, bg-surface-N, text-accent, etc.) defined via CSS variables in :root (light) and .dark (dark), registered in Tailwind v4's @theme inline. Theme persists via localStorage with system preference detection. Anti-flash script in index.html. Mobile-first design (320px+) with venue-owner-friendly UX, including larger text, higher contrast, and bigger touch targets.
- **Data Model**: Core entities include `organizations`, `users`, `agents`, and `agentTools`, with extensive venue-specific data tables (e.g., `menuItems`, `inventoryItems`, `orders`, `bookings`) all scoped by `organizationId`.
- **Voice Agent Types**: Supports five distinct agent types: BevOne (all-in-one), Agentic Voice POS, POS Integration, Inventory Manager, and Venue Agent.
- **Tooling**: Includes 22 real tools spanning POS, Voice POS, Inventory, Operations, and Knowledge (RAG), all querying the database.
- **Mobile Support**: Configured for iOS app deployment via Capacitor, with PWA fallback.
- **Plan Enforcement**: Subscription plans (Starter, Pro, Enterprise) dictate agent and venue limits, enforced on agent creation.

## External Dependencies
- **OpenAI**: Used for the Realtime API (voice pipeline) and chat completions (via Replit AI Integrations).
- **PostgreSQL**: Primary database for all application and venue data, managed with Drizzle ORM.
- **Stripe**: Integrated for payment processing, subscription management, and product catalog synchronization via a Replit connector.
- **Google OAuth20**: Optional authentication provider.
- **Capacitor**: Used for building and deploying iOS mobile applications.
- **Google Fonts (Inter)**: For typography.
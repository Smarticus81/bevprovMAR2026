# BevOne Landing Page

## Overview
BevOne is an ultra-minimalist marketing/landing page for a voice app builder platform targeting event and wedding venue owners. The design is inspired by x.ai — dark, cinematic, with a champagne-pouring video background and a central input box for lead capture.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS v4 + Framer Motion
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Database**: PostgreSQL with a `waitlist` table for capturing leads

## Key Features
- Cinematic champagne video background with radial mask effect
- 5 voice agent types selectable in the builder interface
- Waitlist/email capture API (`POST /api/waitlist`)

## Data Model
- `waitlist`: id (serial), email (text), agent_type (text), message (text), created_at (timestamp)

## File Structure
- `client/src/pages/Home.tsx` — Main landing page
- `client/src/components/layout/Navbar.tsx` — Navigation bar
- `client/src/index.css` — Global styles
- `client/src/assets/videos/champagne-bg.mp4` — Background video
- `shared/schema.ts` — Drizzle schema definitions
- `server/db.ts` — Database connection
- `server/storage.ts` — Storage interface
- `server/routes.ts` — API routes

## Voice Agent Types
1. BevOne (all-in-one)
2. Agentic Voice POS
3. POS Integration Agent (Square/Toast)
4. Inventory Manager Agent
5. Venue Agent (operations & admin)

## Design
- Font: Inter (loaded via Google Fonts)
- Color: Black background, white text, glassmorphic input
- Video: Champagne pouring, radially masked
- Style: Ultra-minimalist, x.ai-inspired

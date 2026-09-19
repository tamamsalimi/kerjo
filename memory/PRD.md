# Kerjo — Product Requirements Document

## Original Problem Statement
Build a mobile-first app "Kerjo" — a swipe-based, Bumble-style matching app connecting local
workers with nearby businesses and households offering jobs/gigs/micro-tasks in Indonesia. Covers
ALL work types (professional AND informal/manual labor). Two-way: any user toggles between
"Looking for Work" and "Hiring" from one account. Core: swipe job cards / worker profiles, mutual
right-swipe → "It's a Match!" → chat → "Mark Job as Done" → rating/review. Trust & safety layer
(verified badge, star rating, completed-jobs count, "New to Kerjo" badge, reviews). Filters:
distance, pay, experience, category, job type. Warm Indonesian red/white design.

## Architecture
- **Frontend:** Expo Router (React Native + web), react-query, reanimated + gesture-handler swipe
  deck, MaterialDesignIcons, expo-image, expo-linear-gradient, Plus Jakarta Sans fonts.
- **Backend:** FastAPI + MongoDB (motor). All routes prefixed `/api`.
- **Auth:** Emergent-managed Google OAuth (session_id → /api/auth/session → 7-day bearer token).
- **Theme:** `src/theme.ts` (Indonesian red #E62429 + white), light mode, max font weight 500.

## User Personas
- Fresh graduate seeking white-collar gigs (design, admin, web dev, tutoring).
- Informal/manual worker (pekerja kasar): cleaning, construction, delivery, cooking, driving.
- Small business / household hiring help quickly (warung owner, family, kos, EO).

## Core Requirements (static)
- Mode toggle: Cari Kerja (jobs) / Merekrut (workers).
- Swipe deck: right = apply/shortlist, left = skip; buttons + gestures.
- Deterministic mutual match → animated celebration → unlocks chat.
- Chat (poll-based) with auto-reply; "Mark Job as Done" → star rating + comment.
- Trust: verified badge, rating + completed jobs, "New to Kerjo" badge, full profile with reviews.
- Filters: distance / pay bracket / experience / category / job type.
- Onboarding worker profile + Post a Job form.

## Implemented (2026-06)
- [x] **Real two-sided matching (v2, DB-backed, multi-device)**: swipes/matches/messages persist in
      MongoDB; a match forms when a worker likes an employer's job AND the employer likes that worker's
      profile (either order). Both accounts see the same match and share one chat (verified across two
      accounts, 25/25 backend tests). Seed/bot entities still instant-match for solo demo.
- [x] Seed only-when-empty: 10 workers + 10 jobs (+~22 reviews).
- [x] Google login landing screen + auth context (mobile + web).
- [x] Onboarding worker profile (create/edit, skippable).
- [x] Swipe home: mode toggle, category chip row, filter bottom sheet, job & worker cards,
      gesture + button swipe, like/nope stamps, location permission flow, loading/empty/error states.
- [x] Match celebration overlay (animated).
- [x] Matches list + 1:1 chat (poll every 4s, auto-reply, keyboard handling).
- [x] Mark Job as Done → rating + review bottom sheet.
- [x] Worker full profile: banner, trust stats, tarif, bio, reviews.
- [x] Post a Job quick form.
- [x] Profile tab: account, worker profile, trust summary, logout.
- [x] Backend: auth, jobs/workers with filters, swipe/match, matches/messages, complete/review,
      profile, create job. Seeded 20 workers, 20 jobs, ~42 reviews.

## Backlog (prioritized)
- P1: Real distance calc from device GPS to job coords (currently seeded distances).
- P1: Persist "Hiring" mode Post-a-Job button entry point on the swipe screen header.
- P2: Undo last swipe; super-like; image upload for worker profile (Emergent Object Storage).
- P2: ID/phone verification to power the "Verified" badge for real.
- P2: Unread badge on Chat tab; push notifications (only on user request + native build).

## Next Tasks
- Gather user feedback on match rate & filter usefulness.
- Add worker profile photo upload and richer job detail.

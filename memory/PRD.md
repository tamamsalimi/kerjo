# kerjo.id — Product Requirements Document

## Original Problem Statement
Build a mobile-first app "kerjo.id" — a swipe-based, Bumble-style matching app connecting local
workers with nearby businesses and households offering jobs/gigs/micro-tasks in Indonesia. Covers
ALL work types (professional AND informal/manual labor). Every account can act as both a
job seeker and employer. Core: users swipe job cards as workers and worker profiles as employers; mutual
right-swipe → "It's a Match!" → chat → "Mark Job as Done" → rating/review. Trust & safety layer
(verified badge, star rating, completed-jobs count, "New to kerjo.id" badge, reviews). Distance,
payment, and experience are automatic card data and remain available as filters alongside category and job type.
Warm Indonesian red/white design.

## Architecture
- **Frontend:** Expo Router (React Native + web), react-query, reanimated + gesture-handler swipe
  deck, MaterialDesignIcons, expo-image, expo-linear-gradient, Plus Jakarta Sans fonts.
- **Backend:** Go (`net/http`) + GORM with direct PostgreSQL. All routes prefixed `/api`.
- **Auth:** Direct Google OpenID Connect. The frontend sends a Google ID token to
  `/api/auth/google`; the Go backend verifies its signature, issuer, and configured audience,
  then creates a 7-day kerjo.id bearer session.
- **Theme:** `src/theme.ts` (Indonesian red #E62429 + white), light mode, max font weight 500.

## User Personas
- Fresh graduate seeking white-collar gigs (design, admin, web dev, tutoring).
- Informal/manual worker (pekerja kasar): cleaning, construction, delivery, cooking, driving.
- Small business / household hiring help quickly (warung owner, family, kos, EO).

## Core Requirements (static)
- Three-way browse filter: Semua mixes jobs and workers; Pekerja and Lowongan
  show one card type. Any authenticated account can apply, shortlist, and post.
- Swipe deck: right = apply/shortlist, left = skip; buttons + gestures.
- Deterministic mutual match → animated celebration → unlocks chat.
- Chat (poll-based) with auto-reply; "Mark Job as Done" → star rating + comment.
- Trust: verified badge, rating + completed jobs, "New to kerjo.id" badge, full profile with reviews.
- Filters: category and job type only; distance, payment, and experience are automatic card data, and GPS is controlled from the header.
- Onboarding worker profile + Post a Job form.

## Implemented (2026-06)
- [x] **Real two-sided matching (v2, DB-backed, multi-device)**: swipes/matches/messages persist in
      PostgreSQL; a match forms when a worker likes an employer's job AND the employer likes that worker's
      profile (either order). Both accounts see the same match and share one chat (verified across two
      accounts, 25/25 backend tests). Seed/bot entities still instant-match for solo demo.
- [x] Seed only-when-empty: 10 workers + 10 jobs (+~22 reviews).
- [x] Google login landing screen + auth context (mobile + web).
- [x] Onboarding worker profile (create/edit, skippable).
- [x] Swipe home: dual-role browsing, category chip row, simplified filter sheet, Bumble-style job & worker cards,
      gesture + button swipe, like/nope stamps, location permission flow, loading/empty/error states.
- [x] Match celebration overlay (animated).
- [x] Matches list + 1:1 chat (poll every 4s, auto-reply, keyboard handling).
- [x] Mark Job as Done → rating + review bottom sheet.
- [x] Worker full profile: banner, trust stats, tarif, bio, reviews.
- [x] Post a Job quick form.
- [x] Profile tab: employer and worker history tabs, optional worker profile, role-based ratings, logout.
- [x] Backend: auth, jobs/workers with filters, swipe/match, matches/messages, complete/review,
      profile, create job. Seeded 20 workers, 20 jobs, ~42 reviews.

## Backlog (prioritized)
- [x] Private job/profile coordinates with server-side distance calculation from device GPS.
- P1: Persist "Hiring" mode Post-a-Job button entry point on the swipe screen header.
- P2: Undo last swipe; super-like; image upload for worker profile.
- P2: ID/phone verification to power the "Verified" badge for real.
- P2: Unread badge on Chat tab; push notifications (only on user request + native build).

## Next Tasks
- Gather user feedback on match rate & filter usefulness.
- Add worker profile photo upload and richer job detail.

## Session Changelog (June 2026 — features batch)
- P0 FIXED: legacy human-face (pravatar) URLs stripped from matches via startup migration + `clean_avatar()` read-time hardening (also blocks randomuser/unsplash). Verified /api/matches returns empty image everywhere.
- Undo swipe: `POST /api/swipe/undo`; home "Batal" FAB restores last passed/liked card (disabled after a match).
- Hiring shortcuts: home Hiring mode shows "Pelamar" (with live count) + "Pasang Kerja" buttons.
- Applicant list: `GET /api/applicants` + `/applicants` screen — workers who liked my jobs, with screening answers, "Terima & Cocokkan" to match.
- Chat unread badge: `GET /api/matches/unread-count` + per-match `unread`; `POST /api/matches/{id}/read`; Chat tab badge, cleared on open.
- Online status: `last_seen` on every authed request; `is_online` (<120s) surfaced in `GET /api/matches/{id}` → "sedang aktif" dot.
- Phone calls: worker/employer phone (resolved at read time from job/profile) → tel: call button in chat header.
- Candidate screening: jobs carry up to 3 `screening_questions`; workers answer when applying; answers shown to employer in applicants list.
- Scheduling: `POST /api/matches/{id}/schedule` + respond — "Jadwalkan" sheet (Wawancara/Tes/Hari Pertama + date + time slot + note); schedule bubbles with Terima/Tolak.
- Backend migrated from Python/FastAPI to Go in September 2026. Go unit/API tests and `go vet`
  pass; PostgreSQL migration integration tests run when `TEST_DATABASE_URL` is set.

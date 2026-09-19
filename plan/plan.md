# Kerjo — App Details

## What it is
Kerjo is a swipe-based, Bumble-style matching app that connects local workers with nearby
businesses and households offering jobs in Indonesia. It covers all kinds of work — from
professional gigs (design, admin, web dev, tutoring) to informal/manual labor (cleaning,
construction, delivery, cooking, gardening, babysitting, driving). Every account can switch
between two sides from a single login.

Tagline: "Temukan kerja terpercaya secepat swipe."

## Who it's for
- People looking for work — fresh graduates and manual/informal workers alike.
- People hiring — small businesses, warungs, households, kos owners, event organizers.

## How a person uses it
1. Sign in with Google (one account works on any device).
2. First-time users are offered a quick worker-profile form (name, category, experience,
   availability, tariff, short bio) — this is optional and skippable.
3. On the main screen a toggle switches between two modes:
   - "Cari Kerja" — swipe through JOB cards. Right = lamar (apply), left = lewat (skip).
   - "Merekrut" — swipe through WORKER profiles. Right = simpan/minat, left = lewat.
     Employers post jobs from the "Pasang" tab.
4. Tapping a card's info button opens full details; worker cards open a full profile with
   trust score and reviews.
5. When both sides like each other, an animated "It's a Match!" screen appears and a chat
   opens. Inside chat, either side can tap "Selesai" (Mark Job as Done) to leave a star
   rating + short comment.

## How matching works (the core behavior)
- A match is real and two-sided: it forms only when a worker likes an employer's job AND
  that employer likes the worker's profile (in either order).
- Both accounts then see the same match and share the same chat. A message sent from one
  device shows up for the other account on its own device.
- Everything (accounts, profiles, jobs, swipes, matches, chats, ratings) is stored in a
  real database and works across two separate devices — not a local simulation.
- Note: the built-in sample workers and sample jobs (see below) are demo entries with no
  human behind them, so swiping right on those produces an instant demo match with an
  auto-reply. True two-sided matching happens between two real signed-in accounts.

## Filters on the browse screen
- Category (broom/cleaning, handyman, driver, babysitter, construction, cook, courier,
  gardener, design, admin/social, writing, tutor, photo/video, web dev, customer service).
- Distance (<2 km / <5 km / <10 km).
- Pay bracket (in Rupiah).
- Experience (baru / 1–2 / 3–5 / 5+ years).
- Job type (Harian / Part-time / Full-time / Gig).

## Trust & safety
- "Terverifikasi" badge and a "🆕 Baru di Kerjo" badge for accounts with no history.
- Star rating + number of completed jobs shown on every card.
- Full worker profile shows all past reviews written in casual Bahasa Indonesia.

## Sample data (only when the database is empty)
- 10 worker profiles: Siti Aminah, Bambang Hartono, Dedi Kurniawan, Rina Wulandari,
  Agus Setiawan, Wati Lestari, Joko Prasetyo, Yuni Astuti, Slamet Riyadi, Nur Hidayah.
- 10 job postings: Keluarga Santoso, Toko Bangunan Jaya, Rumah Tangga Wijaya,
  Warung Bu Yanti, Kos Melati, Keluarga Pratama, Ekspedisi Cepat, Perumahan Griya Asri,
  Pak Hasan, Catering Sedap.
- Existing data is never duplicated; seeding runs only on a genuinely empty database.

## Design
- Indonesian red (#E62429) + white, warm and energetic, large friendly type, prominent
  trust badges, recognizable per-category icons, smooth swipe + match animations.
- Bottom tabs: Cari (swipe) · Chat · Pasang (post a job) · Profil.

## Trying it on two devices
1. Device A signs in (account 1) and creates a worker profile.
2. Device B signs in (account 2) and posts a job in that same category.
3. A swipes right on B's job; B swipes right on A's profile → both get the match and can
   chat live from their own device.

## Going live
- The preview link already opens across devices/browsers.
- For a permanent public URL and app-store builds: Publish (top-right) → Deploy → then
  generate iOS and Android builds. Some native features (notifications, audio, camera)
  only work on a real-device build.

## Assumptions
- Login stays Google-based (already gives one persistent account per person across devices);
  no separate email/password login is added since the two-device requirement is already met.
- Sample workers/jobs remain demo entries that instant-match for solo exploration; real
  two-sided matching is reserved for interactions between two real signed-in accounts.

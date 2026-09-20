# Kerjo frontend

Expo Router application organized by feature while keeping route files thin.

```text
frontend/
├── app/                         # Expo Router route entry points only
├── src/
│   ├── features/
│   │   ├── auth/                # Login, verification, auth context
│   │   ├── discovery/           # Jelajah, cards, swipe deck
│   │   ├── profile/             # Profile and worker profile editing
│   │   ├── jobs/                # Job posting and applicants
│   │   ├── matching/            # Swipes, matches, reviews
│   │   └── chat/                # Conversation screen and API
│   ├── components/              # Reusable cross-feature UI
│   ├── services/                # Shared HTTP and query clients
│   ├── hooks/                   # Shared React hooks
│   ├── utils/                   # Shared platform-neutral utilities
│   ├── types/                   # Shared TypeScript types
│   ├── constants/               # Shared product constants
│   └── theme/                   # Design tokens and theme helpers
└── assets/
```

Feature folders may contain `screens`, `components`, `services`, `hooks`, and
`types` when needed. Keep code local to a feature unless at least two features
reuse it.

## Commands

```sh
corepack yarn install
corepack yarn web --port 8081
corepack yarn lint
corepack yarn tsc --noEmit
```

Environment setup and backend startup are documented in the repository root
`README.md`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server (http://localhost:3000)
npm run build     # Production build
npm run lint      # ESLint check
npm run start     # Start production server
```

Install dependencies with `--legacy-peer-deps` due to a peer version mismatch between `@azure/msal-react` and React 19.2.0:
```bash
npm install --legacy-peer-deps
```

## Environment Setup

Copy `.env.local` manually — it is gitignored and never committed. Required variables:

```env
NEXT_PUBLIC_AZURE_AD_TENANT_ID=
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_AZURE_AD_SCOPES=User.Read openid profile email

NEXT_PUBLIC_ENABLE_MONGODB_LOGIN=true
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_USERNAME=
MONGODB_PASSWORD=
MONGODB_DATABASE=
MONGODB_COLLECTION=AdminUsers
MONGODB_AUTH_SOURCE=admin

NEXT_PUBLIC_ENABLE_LOCAL_LOGIN=false

NEXT_PUBLIC_REDIS_HOST=localhost
NEXT_PUBLIC_REDIS_PORT=6379
NEXT_PUBLIC_REDIS_DATABASE=0
```

Redis and MongoDB must be running locally before starting the app.

## Architecture

This is a Next.js 16 App Router app — a browser-based Redis GUI with dual authentication (Azure AD + MongoDB).

### Authentication system (`lib/`)

Authentication is layered and checked in priority order: **MongoDB session → Azure AD → unauthenticated**.

- `lib/auth-config.ts` — reads env vars; exports `isAuthenticationRequired()`, `isAzureAdConfigured()`, `isMongoDBLoginEnabled()`
- `lib/msal-provider.tsx` — `MSALProviderWrapper` is the root provider in `layout.tsx`. On mount it checks `localStorage` for a `mongodb-session`; if found, it renders `AuthProvider` without MSAL. If Azure AD is configured, it wraps with `MsalProvider`. Otherwise runs unauthenticated.
- `lib/auth-context.tsx` — `AuthProvider` + `useAuth()` hook. Exposes `isAuthenticated`, `authType` (`"azure" | "mongodb" | null`), `getAccessToken()`, `login()`, `logout()`. MongoDB sessions are stored in `localStorage` as `mongodb-session` (JWT-like object with `token` + `tokenExpiry`). Azure AD tokens are acquired silently via MSAL.
- `lib/api-auth.ts` — server-side helper. `withAuth(request, handler)` verifies Azure AD JWTs via JWKS. MongoDB tokens are opaque session tokens (not JWTs) — the middleware only checks their presence, not validity.
- `middleware.ts` — protects `/api/*` routes by requiring a `Authorization: Bearer <token>` or `token` header. Does **not** validate the token itself; that's left to individual routes via `withAuth`.

### API fetch pattern

`hooks/use-auth-fetch.ts` — `useAuthenticatedFetch()` returns `authFetch`, a wrapper around `fetch` that calls `getAccessToken()` and sets both `Authorization: Bearer <token>` and a `token` header on every request. All Redis API calls in `app/page.tsx` go through `authFetch`.

### Redis connectivity (`lib/redis-client.ts`)

`withRedis(config, fn)` — creates a per-request `ioredis` connection, runs `fn`, then disconnects. No persistent connection pool. Config (host, port, db, auth, TLS) is passed from the client on each API call, sourced from `NEXT_PUBLIC_REDIS_*` env vars and persisted in `localStorage` as `redis-ui-connection`.

### API routes (`app/api/`)

All routes follow the same pattern: receive `{ config: RedisConnectionConfig, ...params }` in the POST body, call `withRedis`, return `{ success: boolean, ... }`.

- `redis/keys` — SCAN with cursor pagination
- `redis/get` — fetch full key value + type + TTL
- `redis/set` — create/update key (string, hash, list, set, zset)
- `redis/delete` — delete one or more keys
- `redis/ttl` — set or remove TTL
- `redis/command` — execute arbitrary Redis command string
- `redis/info` — parse `INFO` output into stats object
- `redis/connect` — test connectivity
- `auth/mongodb-login` — POST `{ username, password }`, queries `AdminUsers` collection, hashes password with SHA1 (uppercase hex), returns session token valid for 15 minutes
- `auth/me` — returns current user from token

### UI layout (`app/page.tsx`)

Single-page layout with three columns: **Key List** (left, fixed 384px) → **Key Viewer** (center, flex) → **CLI Terminal** (right, togglable). Stats panel collapses. All state lives in the root `RedisUI` component; child components receive callbacks.

Components are in `components/redis/` (domain components) and `components/ui/` (shadcn/ui primitives — treat as library code, avoid modifying).

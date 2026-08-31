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

# Secret for signing MongoDB session JWTs (server-only, min 32 chars)
AUTH_JWT_SECRET=

# Trusted proxies in front of the app (0 = ignore X-Forwarded-For). Set to 1
# behind a single ALB so login rate limiting can identify clients.
TRUSTED_PROXY_COUNT=0

# Authorization — the two login methods are independent and use unrelated role
# namespaces. Empty = any authenticated user of that method may use the app.
#   Azure AD: group/app-role names from the ID token's `roles` claim, e.g.
#             APP-VF-CaaS-Rewards-NonProd-NamespaceAdmin
#   MongoDB : AdminUsers.UserRoleID values (UUID strings)
AUTH_REQUIRED_AZURE_ROLES=
AUTH_REQUIRED_MONGO_ROLE_IDS=

# Redis connection — server-side only, never sent by the client
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DATABASE=0
# REDIS_USERNAME=
# REDIS_PASSWORD=
# REDIS_USE_TLS=false

# Redis defaults shown in the UI (display only, not used to connect)
NEXT_PUBLIC_REDIS_HOST=localhost
NEXT_PUBLIC_REDIS_PORT=6379
NEXT_PUBLIC_REDIS_DATABASE=0
```

Redis and MongoDB must be running locally before starting the app.

### Authentication & connection model (security-critical)

- Every `/api/redis/*` route is wrapped in `withAuth` (`lib/api-auth.ts`), which validates **either** an Azure AD JWT (via JWKS) **or** a MongoDB session JWT (HS256, signed with `AUTH_JWT_SECRET`). A token's mere presence is not enough — it must verify.
- The Redis connection target comes from `lib/server-redis-config.ts` (`REDIS_*` env vars), **never** from the client request body. Do not reintroduce client-supplied `host`/`port` — that is the SSRF hole that was closed.
- `app/api/auth/mongodb-login` issues the signed JWT via `signMongoToken`; the client stores it in `localStorage` as `mongodb-session`. MongoDB TLS validation is **on by default** — use `MONGODB_TLS_CA_FILE` for a private CA, and `MONGODB_TLS_INSECURE=true` only for local dev (it disables cert/hostname checks and logs a warning).
- Some Redis values are **Java-serialized** (`java.io.Serializable`), not JSON — e.g. `pegaCache_*` holds an `ArrayList` of `GetNbaResponseDto`. `lib/java-value.ts` detects the stream header (`0xACED0005`) and decodes them to JSON-safe data for display. Two rules: the `get` route must use **`client.getBuffer()`**, never `client.get()` (UTF-8 decoding destroys binary bytes irrecoverably), and writes must preserve the format. Detection is by magic bytes only — never by key name; in practice a JDK-serializing Spring template means *every* value in a database can be Java-encoded. Two shapes are distinguished (`javaShape`): a top-level `java.lang.String` (the common case — services store JSON text through a serializing template) is re-encoded exactly by `encodeJavaString` on save, so it stays editable; a real object graph cannot be rebuilt and is read-only. The `set` route rejects a plain write over Java bytes with a 409 unless `javaEncode` (re-serialize) or `overwriteJava` (deliberate clobber) is passed.
- Login rate limiting (`lib/login-rate-limit.ts`) enforces a per-username limit **and** a per-IP+username limit. The per-username one is the load-bearing check: `X-Forwarded-For` is client-controlled, so it is only consulted when `TRUSTED_PROXY_COUNT` is set, and never as the sole defence. Do not key rate limiting on the request IP alone.
- **Authorization** is separate from authentication and the two login methods are gated independently: Azure AD against `AUTH_REQUIRED_AZURE_ROLES` (group names from the token's `roles` claim) and MongoDB against `AUTH_REQUIRED_MONGO_ROLE_IDS` (`AdminUsers.UserRoleID` UUIDs, embedded into the session JWT at login). The namespaces are never cross-compared, and `withAuth` decides which list applies from *which verifier succeeded*, never from a claim in the token. Unauthorized-but-authenticated returns **403**, not 401. An empty list means no restriction for that method and logs a warning once.

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
- `redis/info` — parse `INFO` output into stats object
- `redis/connect` — test connectivity
- `auth/mongodb-login` — POST `{ username, password }`, queries `AdminUsers` collection, hashes password with SHA1 (uppercase hex), returns session token valid for 15 minutes
- `auth/me` — returns current user from token

### UI layout (`app/page.tsx`)

Single-page layout with two columns: **Key List** (left, fixed 384px) → **Key Viewer** (right, flex). Stats panel collapses. All state lives in the root `RedisUI` component; child components receive callbacks.

Components are in `components/redis/` (domain components) and `components/ui/` (shadcn/ui primitives — treat as library code, avoid modifying).

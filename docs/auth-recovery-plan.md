# Auth Recovery Plan

## Goal

Replace the current brittle custom web-session flow with a production-grade authentication model that is reliable behind Caddy and easy to validate in staging before production.

## What We Keep

- RFQ domain model and workflow logic in `/Users/fatihsengor/Codex/CRM/apps/api/src/modules/rfq`
- User management and role model in `/Users/fatihsengor/Codex/CRM/apps/api/src/modules/users`
- Existing Prisma user data in `/Users/fatihsengor/Codex/CRM/apps/api/prisma`
- Main page structure and business UI in `/Users/fatihsengor/Codex/CRM/apps/web/app`

## What We Replace

- Custom cookie/session handling in `/Users/fatihsengor/Codex/CRM/apps/web/lib/session.ts`
- Login/logout implementation in `/Users/fatihsengor/Codex/CRM/apps/web/app/auth`
- Temporary diagnostics pages in `/Users/fatihsengor/Codex/CRM/apps/web/app/session-debug`
- Multi-step redirect-based auth behavior between web and API

## New Architecture

### 1. One Public App Origin

Use only one public browser origin:

- `https://rfq.gorhan.co.uk`

Proxy API traffic through the same origin:

- `https://rfq.gorhan.co.uk/api/*`

This removes cross-origin and multi-origin cookie ambiguity from the browser model.

### 2. API-Owned Server Sessions

The API becomes the single source of truth for authentication.

Add a `Session` table in Prisma:

- `id`
- `userId`
- `tokenHash`
- `expiresAt`
- `createdAt`
- `revokedAt`
- optional audit fields such as `userAgent`, `ipAddress`

Login flow:

1. Browser posts credentials to same-origin `/api/auth/login`
2. API verifies password
3. API creates opaque random session token
4. API stores only `tokenHash` in database
5. API sets one secure httpOnly cookie
6. Browser navigates normally; server reads only this session cookie

### 3. One Session Cookie

Cookie design:

- one cookie only
- opaque token, not JWT
- `HttpOnly`
- `Secure`
- `SameSite=Lax`
- host-scoped to the public app domain

Recommended name:

- `__Host-rfq_session`

### 4. Middleware / Guard Strategy

Use one shared auth guard in the web app:

- read session cookie
- call a same-origin session endpoint or server helper
- load current user once
- redirect only when session is missing or expired

Avoid ad hoc per-route auth behaviors.

## Deployment Simplification

Update Caddy so:

- `/` goes to Next web
- `/api/*` goes to Fastify API

The separate public API subdomain can remain optional for operational use, but browser traffic should not depend on it.

## Migration Sequence

### Phase 1

- add Prisma `Session` model
- add session creation, lookup, revoke logic in API
- add `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` based on opaque sessions

### Phase 2

- update Caddy to same-origin API proxy
- remove current web-side custom login/session cookie flow
- update web pages to trust the new session endpoint

### Phase 3

- remove temporary diagnostics code
- add staging deployment validation
- perform production cutover

## Testing Strategy

### Local

- login
- logout
- session persistence across page navigation
- admin pages
- London user visibility rules
- Istanbul pricing and manager permissions

### Staging

- browser matrix: Safari, Firefox, Chrome
- hard refresh
- new private window
- password reset
- file upload and download

### Production Gate

Do not cut over until staging confirms:

- session survives page navigation
- logout clears access
- all four roles behave correctly
- no unexpected redirect loops

## Immediate Next Step

Start by implementing the Prisma-backed `Session` model and same-origin `/api` proxy in Caddy. Do not continue patching the current redirect/cookie model.

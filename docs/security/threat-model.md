# Threat Model — nexus-web-page

High-level security model for the SvelteKit tracker frontend. Complements [SECURITY.md](../../SECURITY.md).

## System boundary

| In scope (this repo)               | Out of scope (other systems)            |
| ---------------------------------- | --------------------------------------- |
| Browser bundle (`VITE_*`)          | siscom-admin-api, siscom-api / comm API |
| SvelteKit routes & client stores   | PostgreSQL, device firmware             |
| Docker image build & EC2 deploy    | Identity provider infrastructure        |
| WebSocket position stream (client) | Stream broker authorization             |

## Assets

1. **User session tokens** — stored client-side (`localStorage` via auth store)
2. **Fleet, zones, alerts UI data** — rendered from API responses
3. **Public keys** — Google Maps (`VITE_GOOGLE_MAPS_API_KEY`)
4. **CI/CD secrets** — EC2 SSH, API URLs in GitHub Actions (not in repo)

## Trust zones

```text
[Browser]  --HTTPS-->  [SvelteKit Node adapter]  --HTTPS/WS-->  [Backend APIs]
   ^                           ^
   |                           |
 VITE_* (public in bundle)   Build-time embed of env vars
```

**Rule:** Never put server secrets in `VITE_*` variables — they ship to every client.

## Key flows

### Authentication

- Login calls admin API via `src/lib/services/api.js` and `src/lib/stores/auth.js`
- Tokens held in `localStorage`; refresh coordinated in `api.js`
- **Risk:** XSS exfiltrating tokens → mitigate with CSP (future), input sanitization, dependency updates
- **Risk:** Session fixation → backend responsibility; frontend redirects unauthenticated users to `/login`

### Live map & zones

- Map loads Google Maps with public API key; positions via REST/WebSocket
- Zone editor uses H3 grid overlay client-side
- **Risk:** Tampering with client-side zone geometry → server must validate zone ownership and geometry

## STRIDE summary (frontend-focused)

| Threat                 | Example                   | Mitigation                                      |
| ---------------------- | ------------------------- | ----------------------------------------------- |
| Spoofing               | Fake API responses        | HTTPS, auth headers server-validated            |
| Tampering              | Modified client requests  | Server-side authorization                       |
| Repudiation            | Denied user action        | Backend audit logs (out of scope here)          |
| Information disclosure | Secrets in git            | Gitleaks, `.env` gitignored, `SECURITY.md`      |
| Denial of service      | Heavy client map loops    | Rate limiting on API (backend)                  |
| Elevation of privilege | Access fleet without auth | API enforces roles; UI is not security boundary |

## Sensitive modules (extra review)

- `src/lib/services/api.js`
- `src/lib/services/mapService.js`
- `src/lib/services/vehiclePositionStream.js`
- `src/lib/stores/auth.js`
- `src/lib/components/ZonasPanel.svelte`
- `src/routes/dashboard/**`

## Reporting

Follow [SECURITY.md](../../SECURITY.md) for vulnerability disclosure. Do not open public issues for security bugs.

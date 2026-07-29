# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Map layers menu (Mapa / Satélite / Híbrido / Relieve + tráfico en vivo) and custom zoom controls matching app look
- Street View: custom exit control below WorkspaceSwitcher; native pegman with theme-aware background
- Map visibility sync between Unidades and Seguimiento (eye toggles + checkboxes; selecting a unit shows it on the map)

- Admin workspace for masters: Administración ↔ Seguimiento switcher, dashboard sin mapa, and unified Alertas/Zonas side panel
- H3 resolution slider on the map (theme-aware, max 10, default 8) when creating zones or showing the grid
- Close control on the tracking unit panel; panel is hidden while the H3 grid is active

- Seguimiento units UI: telemetry cards, status filters, and map visibility toggles (`MapVisibleUnitsCard`); dual light/dark panels across tracking and reports unit picker

- Map follow mode: botón "Seguir" en el panel de unidad con autoenfoque (zoom 15) y rastro en vivo con degradado

- Vitest coverage gates (`test:coverage`) with thresholds on `src/lib/**` (90/90/70/90)
- `vitest-setup.js` (happy-dom, `matchMedia`/`localStorage`/`fetch` mocks)
- Unit tests: auth stores, theme, sessionService, eventService, zoneDbMapper, alarmFormat, api passthrough
- OSV-Scanner (`scripts/osv-scan.sh`, `npm run scan:osv`) in CI `security` job
- Dependabot (npm, github-actions, docker) and `.github/CODEOWNERS`
- `docs/GOVERNANCE.md` — branch protection, coverage policy, Dependabot merge rules
- CI uploads coverage artifact; `audit` and `e2e` jobs are blocking (no `continue-on-error`)

### Changed

- npm overrides: `brace-expansion@5.0.8`, `minimatch@9→10.2.6`, `js-yaml>=5.2.2`, and `postcss^8.5.18` to clear high audit/OSV findings

- Mobile bottom tab bar respects light/dark theme
- Floating tracking panel moved to the left so map zoom/Street View stay usable on the right
- Telemetry labels standardized (Voltaje, Respaldo, Satélites, Señal) with signal color chips
- Vehicle InfoWindow regenerates with current theme when switching light/dark
- Reports charts aligned with mobile (avg + max speed; satellites area fill)

- Non-master users: hide create/edit/delete/deactivate for vehicles, zones, and alerts (view-only management UI)
- Map type control moved to left-center so it does not overlap the workspace switcher; “Ver detalles” label on unit list
- npm overrides for `js-yaml`, `fast-uri`, `tar`, and `brace-expansion` to clear high/critical audit and OSV findings

- Responsive tracking layout: tablet bottom sheet for seguimiento; floating “Unidades visibles” on desktop (lg+) only; hide vehicle InfoWindow on mobile; map initializes from saved theme (early `app.html` theme script)

- `npm run validate` runs `test:coverage` instead of plain `test`
- npm override for `js-yaml` audit advisory

- Dev container (`.devcontainer/`) with post-create setup from `.env.example`
- Vitest unit tests for `passwordValidation`, `eventUtils`, and `unitTrackingStatus` utils
- Playwright smoke e2e (`e2e/smoke.spec.js`) — onboarding redirect and sign-in UI
- ADRs (`docs/adr/0001`–`0003`) and `docs/security/threat-model.md`
- GitHub issue templates (bug, feature, security contact link)
- CI job `e2e` (informational, `continue-on-error: true`)
- Engineering foundation (PR-1): `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig`, `.nvmrc`

- Release discipline: `CHANGELOG.md`, `docs/RELEASE.md`, `scripts/setup.sh`, Husky hooks (commitlint, lint-staged, pre-push)
- CI guardrails: `ci.yml` (lint, type-check, tests, build, audit) + Gitleaks and Semgrep in `security` job
- Separate `deploy.yml` for tag-based EC2 deployments (`v*.*.*` only)
- `scripts/gitleaks-scan.sh` and `npm run scan:secrets`
- Pull request template with base-branch and validate checklist
- Split monolithic GitHub Actions workflow into `ci.yml` (quality gates) and `deploy.yml` (releases)
- `npm run validate` shortcut: lint + check + test + build
- Node.js 22 as target runtime in CI, `.nvmrc`, and `Dockerfile` base image
- Deploy passes `ORIGIN` at container runtime (required by SvelteKit adapter-node)

### Fixed

- Map alert/layers controls not showing due to race between session `isLoading` and Google Maps init
- Mobile unit selection in tracking (object vs id) and eye visibility icon updating immediately
- Partial “Seleccionar todas en mapa” state when only some filtered units are visible

- El mapa ya no pierde zoom/pan en cada actualización WebSocket de posición
- Marcadores de unidad dejan de parpadear/desaparecer en updates en vivo (clusterer usa `render()` en lugar de remove/add)
- El modo seguir se limpia al cambiar a la vista de Trayectos

- Live map positions: WebSocket stream base is derived from `VITE_COMM_API_URL` again (removed redundant `VITE_POSITION_STREAM_WS_BASE` build config)
- Zone editor: mouse wheel zoom works on desktop when creating zones (zoom lock limited to mobile viewport)
- Removed hardcoded Google Maps API key fallback from `mapService.js` (use `VITE_GOOGLE_MAPS_API_KEY` only)
- npm `overrides` for `cookie` and `esbuild` audit advisories
- Gitleaks: sanitized README token examples, baseline for pre-existing historical findings

### Security

- **Rotate** any Google Maps API key that was previously committed in git history (GCP Console → Credentials)

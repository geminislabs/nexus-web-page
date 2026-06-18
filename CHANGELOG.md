# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Vitest coverage gates (`test:coverage`) with thresholds on `src/lib/**` (90/90/70/90)
- `vitest-setup.js` (happy-dom, `matchMedia`/`localStorage`/`fetch` mocks)
- Unit tests: auth stores, theme, sessionService, eventService, zoneDbMapper, alarmFormat, api passthrough
- OSV-Scanner (`scripts/osv-scan.sh`, `npm run scan:osv`) in CI `security` job
- Dependabot (npm, github-actions, docker) and `.github/CODEOWNERS`
- `docs/GOVERNANCE.md` — branch protection, coverage policy, Dependabot merge rules
- CI uploads coverage artifact; `audit` and `e2e` jobs are blocking (no `continue-on-error`)

### Changed

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

### Changed

- Split monolithic GitHub Actions workflow into `ci.yml` (quality gates) and `deploy.yml` (releases)
- `npm run validate` shortcut: lint + check + test + build
- Node.js 22 as target runtime in CI, `.nvmrc`, and `Dockerfile` base image
- Deploy passes `ORIGIN` at container runtime (required by SvelteKit adapter-node)

### Fixed

- Zone editor: mouse wheel zoom works on desktop when creating zones (zoom lock limited to mobile viewport)
- Removed hardcoded Google Maps API key fallback from `mapService.js` (use `VITE_GOOGLE_MAPS_API_KEY` only)
- npm `overrides` for `cookie` and `esbuild` audit advisories
- Gitleaks: sanitized README token examples, baseline for pre-existing historical findings

### Security

- **Rotate** any Google Maps API key that was previously committed in git history (GCP Console → Credentials)

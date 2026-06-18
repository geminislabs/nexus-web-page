# Governance — nexus-web-page

## Branch protection (recommended for `develop`)

Configure in **GitHub → Settings → Branches → Branch protection rules**:

| Setting                     | Value                        |
| --------------------------- | ---------------------------- |
| Branch                      | `develop`                    |
| Require pull request        | Yes                          |
| Required approvals          | 1                            |
| Require status checks       | `quality`, `security`, `e2e` |
| Require branches up to date | Yes                          |
| Include administrators      | Optional (team decision)     |

## CODEOWNERS

See [.github/CODEOWNERS](../.github/CODEOWNERS). Replace `@geminislabs/engineering` with your real GitHub team slug before enforcing reviews.

## CI jobs

| Job        | Blocks merge                                  |
| ---------- | --------------------------------------------- |
| `quality`  | Yes — lint, check, coverage thresholds, build |
| `security` | Yes — Gitleaks, Semgrep, OSV-Scanner          |
| `e2e`      | Yes — Playwright smoke                        |

## Coverage policy

Vitest enforces thresholds on `src/lib/**` (excluding Svelte components, `src/routes/**`, and heavy map/stream services). Target: **≥90%** lines/statements/functions, **≥70%** branches on included files.

Excluded from coverage gates (integration-heavy): `mapService.js`, `h3GridOverlayService.js`, `vehiclePositionStream.js`, `positionService.js`, `telemetryCharts.js`, `telemetryUtils.js`, `vehicleMarkerIcon.js`, and large reactive stores (`vehicleStore`, `alertStore`, etc.).

## Release

Follow [docs/RELEASE.md](RELEASE.md). Deploy only via annotated tags `v*.*.*`.

## Dependabot

Configured in [.github/dependabot.yml](../.github/dependabot.yml).

| Ecosystem      | Schedule | Target branch | Notes                                       |
| -------------- | -------- | ------------- | ------------------------------------------- |
| npm            | Weekly   | `develop`     | Grouped patch/minor; majors as separate PRs |
| github-actions | Weekly   | `develop`     | Single grouped PR per week when possible    |
| docker         | Weekly   | `develop`     | Base images in `Dockerfile`                 |

**Merge policy for Dependabot PRs:**

1. Wait for CI checks `quality`, `security`, and `e2e` to pass.
2. Patch/minor grouped PRs: review changelog, merge if green.
3. Major version PRs (SvelteKit, Vite, etc.): manual smoke test (`npm run validate`, `npm run test:e2e`).
4. Do not auto-merge majors without human approval.

Enable **Dependabot security updates** in GitHub → Settings → Code security and analysis (complements OSV-Scanner and `npm audit`).

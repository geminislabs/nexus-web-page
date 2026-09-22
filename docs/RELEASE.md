# Release Guide — nexus-web-page

## Version source of truth

- **Package version:** `package.json` → `version` — **stale on purpose is not
  the same as stale by accident**: this field still reads `0.0.1` after sixteen
  releases, while the tags are the real version. Either bump it with each
  release or stop calling it the source of truth; right now it says something
  false.
- **Git tags:** annotated tags `v*.*.*` (e.g. `v1.0.0`)
- **Changelog:** `CHANGELOG.md` — move `[Unreleased]` entries under the new version header before tagging

## Prerequisites

- All changes merged to `develop` via PR with **CI green**
- `CHANGELOG.md` updated in the release PR or release commit
- GitHub Actions secrets and variables configured for deploy (EC2 SSH, `VITE_*` build args, `ORIGIN`)

## Release sequence

1. Sync `develop`:

   ```bash
   git checkout develop
   git pull origin develop
   ```

2. Prepare the release commit (version bump + changelog):

   ```bash
   # Edit package.json version and CHANGELOG.md [X.Y.Z] section
   git add package.json CHANGELOG.md
   git commit -m "chore(release): vX.Y.Z"
   git push origin develop
   ```

3. Fast-forward `master` to `develop`:

   ```bash
   git push origin develop:master
   ```

   **This step is not optional, and it used to be missing from this guide.**
   `master` is the default branch, and GitHub resolves three things against it
   and nowhere else:
   - **Security alerts.** A fix that lives only on `develop` leaves the alert
     open. It closes when `master` gets it.
   - **Scheduled workflows.** `schedule` and `workflow_dispatch` require the
     file on the default branch. `dependency-audit.yml` was merged on 19/09 and
     GitHub did not even register it — no cron, no "Run workflow" button — until
     the release of 22/09 moved `master`. The symptom of getting this wrong is
     that **nothing happens**, which is the failure mode that never complains.
   - **CodeQL's default-branch analysis.**

   That the push is accepted as a fast-forward — `abc123..def456`, no `+`, no
   rejection — is the signal that nobody committed to `master` directly. If it
   asks for `--force`, stop: `master` has something `develop` does not.

4. Create and push an annotated tag:

   ```bash
   git tag -a vX.Y.Z -m "release: vX.Y.Z"
   git push origin vX.Y.Z
   ```

5. **Deploy workflow** (`.github/workflows/deploy.yml`) runs automatically on `v*.*.*` tag push.

6. Verify deployment **against the log, not against the green tick**, in GitHub
   Actions and on the target server.

## CI vs deploy

| Workflow     | Trigger                         | Purpose                                        |
| ------------ | ------------------------------- | ---------------------------------------------- |
| `ci.yml`     | PR + push to `develop`/`master` | Lint, type-check, tests, build, security scans |
| `deploy.yml` | Push tag `v*.*.*`               | Docker build + EC2 deployment                  |

## Deploy secrets (GitHub environment `test`)

| Secret / var                               | Uso                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `ORIGIN`                                   | URL pública del panel (ej. `https://nexus.example.com`) — **obligatorio** en runtime |
| `EC2_SSH_KEY`, `EC2_USER`, `EC2_HOST_TEST` | SSH al servidor de prueba                                                            |
| `VITE_*`                                   | Build-args de Docker (APIs, Maps key, WebSocket)                                     |
| `PORT` (var, opcional)                     | Puerto del contenedor; default `3340`                                                |

## Rollback

1. Identify the last known-good tag.
2. Re-deploy by pushing the previous tag again, or run the deploy workflow manually with `workflow_dispatch`.
3. Document the incident in `CHANGELOG.md` under `[Unreleased]` if a hotfix follows.

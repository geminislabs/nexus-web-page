# ADR 0003: Zero-cost CI security tooling

- **Status:** Accepted
- **Date:** 2026-06-18

## Context

`geminislabs` is a GitHub organization. The `gitleaks/gitleaks-action` requires a paid license for org repos. We need secret scanning and static analysis without additional vendor cost.

## Decision

Use **open-source, self-run tooling** in CI:

- **Gitleaks CLI** via `scripts/gitleaks-scan.sh` (no `GITLEAKS_LICENSE`)
- **Semgrep OSS** with community rules (`p/javascript`, `p/typescript`, `p/secrets`)
- Local pre-push optional scan: `npm run scan:secrets`

Paid alternatives (CodeQL Advanced, Semgrep App) are out of scope unless budget is approved.

## Consequences

- **Positive:** $0 cost; same scanners runnable locally and in CI.
- **Negative:** We maintain install scripts and allowlists (e.g. `.gitleaks.toml`, `.gitleaks-baseline.json`) ourselves.
- **Neutral:** Enforcement strictness is phased (soft gates first, hard gates in a later PR).

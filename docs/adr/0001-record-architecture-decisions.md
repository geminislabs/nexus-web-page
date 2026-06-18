# ADR 0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-06-18

## Context

The tracker panel spans map/live tracking, zones (H3), alerts, and session flows. We need a lightweight way to document significant technical decisions without heavy process.

## Decision

We will use Architecture Decision Records (ADRs) in `docs/adr/` following a simple Markdown format inspired by [Michael Nygard's ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## Consequences

- **Positive:** Decisions are traceable in-repo; new contributors understand the "why".
- **Negative:** Requires discipline to write ADRs for non-trivial changes.
- **Neutral:** ADRs complement module docs in `docs/architecture/modules/`.

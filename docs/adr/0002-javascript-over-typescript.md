# ADR 0002: JavaScript over TypeScript

- **Status:** Accepted
- **Date:** 2026-06-18

## Context

The codebase is SvelteKit 2 + Svelte 5 in JavaScript with JSDoc where helpful. Migrating to TypeScript would touch most files and slow delivery without an explicit product mandate.

## Decision

Stay on **JavaScript** (`.js`, `.svelte`) for application code. Use JSDoc for non-obvious types. Any TypeScript migration requires a new ADR and team agreement.

## Consequences

- **Positive:** Lower migration cost; matches current team velocity and `AGENTS.md` conventions.
- **Negative:** Less compile-time safety than strict TypeScript.
- **Neutral:** `svelte-check` and ESLint still provide static analysis on Svelte/JS.

# @beep/canvas Goal

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

All phases (P1–P3) complete.

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-05-16
- **Updated:** 2026-05-21

## Purpose

This goal creates a canonical `@beep/canvas` Tauri desktop app slice and a minimal
scene-graph runtime that is aligned with:

- `goals/canvas/PRD_REFERENCE.md`
- `standards/ARCHITECTURE.md`
- `standards/architecture/*.md` and package-boundary law

The goal is not to implement the full Pixa-style product immediately; it is to land a
verified, doctrine-safe minimal surface that can be evolved toward the PRD inventory.

## Reading Order

- [SPEC.md](./SPEC.md) — normative contract, scope, and architecture boundaries
- [PLAN.md](./PLAN.md) — ordered implementation plan and phase gates
- [ops/manifest.json](./ops/manifest.json) — machine-readable goal metadata

## Packet Scope

- `goals/canvas/PRD_REFERENCE.md` remains the long-form feature inventory input.
- `apps/canvas` becomes the app shell (`@beep/canvas`) and hosts the Tauri 2 + React runtime.
- `packages/canvas/{domain,use-cases,server,client,ui}` are the slice implementation packages.
- `goals/canvas/ops` stores manifest and future handoff/review assets.

## Non-Negotiable Boundaries

- Product language stays in the `canvas` slice packages.
- External wrappers stay in `drivers` and app-local runtime adapters.
- `@beep/ui` is the UI primitive baseline; app-specific screens live in
  `apps/canvas` and `packages/canvas/ui`.
- Error failure shapes are translated at each boundary per
  `standards/architecture/09-errors-across-boundaries.md`.

## Current Plan Phase

- P0: complete — package-level bootstrap and architecture repair
- P1: complete — runnable Tauri + React shell and typed app command bridge
- P2: complete — create/list/get/add/remove/save/load contract proof and boundary tests
- P3: ready — next proof checkpoint or next PRD slice decision

P1/P2 evidence is captured under `history/outputs`.

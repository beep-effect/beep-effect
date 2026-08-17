# PLAN — Packet Control-Plane Core

Mutable execution plan. `SPEC.md` is normative; this file sequences the work.

## P0 — Research (COMPLETE at graduation, 2026-08-17)

Inherited whole from the parent exploration: BRIEF (operator-ratified
2026-08-13), nine align decisions, and the MAP ratified 2026-08-17 with
amendments. See `research/SOURCES.md`.

## P1 — The ratified first vertical slice

Schema first: `PacketEvent` family, tip/revision, fold, derived state — then
the `Context.Service` contracts (event store, fold, guarded writer), then
implementation inside the Goals command tree.

1. Event schema + per-event CAS store (`ops/events/<seq>-<type>-<digest>`
   shape, parent digest, expected revision).
2. Deterministic fold → `furthestStage` / `resumeStage` / tip; fork
   detection (two children of one parent) as a first-class verdict.
3. Guarded transition preview/write behind the existing `set-status`
   vocabulary; reuse the PortfolioIndexGuard commit-boundary pattern.
4. Read-only `beep explore --check` / doctor surface.
5. Trace projection binding `sourceTip` + projector version; stale detection.

**Exit:** the three proofs — golden linear stream, deliberate fork, stale
projection — pass in CI-runnable tests.

## P2 — Advisory self-hosting (D9)

Fold this goal's own stream; run the guarded writer in advisory mode on this
campaign. No fleet adoption, no blocking checks.

**Exit:** this packet's own transitions flow through the preview path and the
projection reports them truthfully.

## P3 — Yeet: PR to mergeable

`bun run beep yeet repair → verify → publish --pr → monitor` until
`merge-ready: yes`.

## P4 — Close

`/reflect` closeout under `history/reflections/`; flip lifecycle in the same
PR as final work. Fired downstream gates (candidates 2–4) reopen the parent
exploration at decompose — they do not extend this goal.

## Current blockers

None. P1 is startable.

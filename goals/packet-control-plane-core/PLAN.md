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

## P3 — Remaining core rungs

Only after the P1 proofs hold and P2 advisory self-hosting runs: risk-tier
floor/override (the `PacketRiskTier` type and operator-only override event —
tier *computation from change trees* stays in the gated design-gate
candidate), the full trace projection, and the fork-repair plan surface. Each
rung is a separate small PR; none may weaken the P1 proof fixtures.

## P4 — Yeet: PR to mergeable

`bun run beep yeet repair → verify → publish --pr → monitor` until
`merge-ready: yes` (per-rung; this phase is the terminal gate).

## P5 — Close

`/reflect` closeout under `history/reflections/`; flip lifecycle in the same
PR as final work. Fired downstream gates (candidates 2–4) reopen the parent
exploration at decompose — they do not extend this goal.

Also reuse, not reinvent: the explore check reports through the existing
`goals doctor` finding/baseline shape rather than minting a new report type.

The doctor/check surface built here is also the **rubric for the post-close
fleet campaign** (ROADMAP, Machinery lane): the convention-migration +
adversarial quality loop over all non-`completed-retained` packets uses this
check as its mechanical acceptance gate, targeting a zero inherited-findings
baseline. Build the check to *express the canonical packet convention*, not
merely to pass this packet.

## Current blockers

None. P1 is startable.

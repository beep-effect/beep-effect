# PLAN — Packet Control-Plane Core

Mutable execution plan. `SPEC.md` is normative; this file sequences the work.

## P0 — Research (COMPLETE at graduation, 2026-08-17)

Inherited whole from the parent exploration: BRIEF (operator-ratified
2026-08-13), nine align decisions, and the MAP ratified 2026-08-17 with
amendments. See `research/SOURCES.md`.

## P1 — The ratified first vertical slice (COMPLETE 2026-08-17)

Schema first: `PacketEvent` family, tip/revision, fold, derived state — then
the `Context.Service` contracts (event store, fold, guarded writer), then
implementation inside the Goals command tree.

Shipped as `packages/tooling/tool/cli/src/commands/Goals/PacketCore/`
(schemas, digest/canonical encoding, pure fold, `PacketEventStore` and
`PacketTransitionWriter` services), the `set-status --preview`/write path,
and `beep explore --check`. The three proofs live in
`packages/tooling/tool/cli/test/{goals-packet-core,goals-set-status-stream,explore-check}.test.ts`
over committed golden fixtures (`test/fixtures/packet-core/`). One deviation
from this plan's service list: the fold stayed a pure function
(`foldPacketEvents`) rather than a `Context.Service` — it has no dependencies
and no second implementation, so a service wrapper added indirection without
a contract; the store and writer are services.

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

## P2 — Advisory self-hosting (D9) (COMPLETE 2026-08-17)

Fold this goal's own stream; run the guarded writer in advisory mode on this
campaign. No fleet adoption, no blocking checks.

**Exit:** this packet's own transitions flow through the preview path and the
projection reports them truthfully.

Live: this packet opted in (`ops/events/` with genesis at P1 plus a
status-set through `set-status --preview` → write), `ops/trace.json` is the
committed projection, and `beep explore --check` reports the stream. Stage
events beyond genesis stay out of scope until a stage writer exists (P3+);
the manifest remains the phase source in advisory mode.

## P3 — Remaining core rungs

Only after the P1 proofs hold and P2 advisory self-hosting runs: risk-tier
floor/override (the `PacketRiskTier` type and operator-only override event —
tier *computation from change trees* stays in the gated design-gate
candidate), the full trace projection, and the fork-repair plan surface. Each
rung is a separate small PR; none may weaken the P1 proof fixtures.

**Rung 1 — risk-tier floor/override (COMPLETE 2026-08-17).** `PacketRiskTier`
(Light/Standard/Full), the `risk-tier-overridden` event body (tier, replaced
override, required challengeable reason), last-wins override derivation on
the linear prefix, `planRiskTierOverride` on the guarded writer, and
`beep goals set-risk-tier <slug> <tier> --reason ... [--preview]`. The
override exists only in the stream, so streamless packets refuse instead of
no-oping (unlike `set-status`, whose manifest is a fallback record); no
manifest/README/index surface is touched. Projector version stays 1: the
derivation is additive and absent on old streams, so committed traces and the
P1 fixtures are byte-identical — proved by the untouched golden fixtures plus
a new `risk-override` replay fixture. Self-hosted per D9: this packet's own
stream carries the first live override (event 3, tier `standard`).

**Rung 2 — full trace projection (COMPLETE 2026-08-17).** The PLAN phrase is
interpreted (and recorded here) as: the projection carries the packet's full
event timeline, not just the terminal derived state. `PacketTraceEntry`
embeds each linear-prefix event verbatim (seq, digest, timestamp, actor,
body); events past a fork stay out of the timeline and surface through fork
verdicts. This is the first real `PACKET_PROJECTOR_VERSION` bump (1 → 2):
every previously valid trace changes bytes, so committed v1 traces retire by
decode failure — projections are disposable derived copies, regenerated from
the stream, never upcast (`schemaVersion` stays `packet-trace/v1`; the
projector version is the evolution axis for traces). Proof: regenerated
byte-exact expected traces for both fixtures, a committed
`expected-trace.v1.json` retirement witness, and the live packet's
regenerated `ops/trace.json` (fresh under `beep explore --check`).

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

None. P1, P2, and P3 rungs 1–2 (risk-tier floor/override; full trace
projection) shipped 2026-08-17; the remaining P3 rungs (fork-repair plan
surface, and the queued idempotent-skip refinement for self-transitions) are
startable — one small PR per rung.

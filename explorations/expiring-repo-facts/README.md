# Expiring Repo Facts

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The repo collects "temporary" facts that nothing ever re-checks, such as
dependencies held back because they break `bun install`. The operator wants a
schema-checked ledger agents can add to, with re-check timers or event
triggers that wake a provider-agnostic agent to update, remove or renew each
item through a mergeable PR.

## Next Open Question

None — graduated. Work continues in
[`goals/hold-ledger`](../../goals/hold-ledger/README.md) (first, starting with the
jsdom slice) and [`goals/wake-service`](../../goals/wake-service/README.md).
Gated re-entry points (Junie adapter, wave 2 test skips, yeet wait adoption,
`llm-runtime-dispatch`) live in [`MAP.md`](./MAP.md); a fired gate reopens this
packet at `decompose`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art, skulk, capability inventory (pre-seeded).
4. [`research/ideation-2026-10-22.md`](./research/ideation-2026-10-22.md) - `/adhd` ideas, traps and three worked-out designs.
5. [`DECISIONS.md`](./DECISIONS.md) - align and shape rulings (2026-10-31).
6. [`BRIEF.md`](./BRIEF.md) - shaped pitch.
7. [`MAP.md`](./MAP.md) - candidate goals, sequencing, first slice, gates.
8. [`research/SOURCES.md`](./research/SOURCES.md) - provenance and licenses.

## Trail

- 2026-10-31: research gap check found reusable provider adapters
  (`@beep/ai-provider-cli`) and the agent-message router, plus the manual hold
  register. Align settled 12 questions in three rounds, shape was accepted,
  `MAP.md` was written, and the packet graduated to `goals/hold-ledger` and
  `goals/wake-service`.
- 2026-10-28: packet opened at capture from the 2026-10-22 request, with the
  research report, research notes, ideation and the 2026-10-27 skulk reading
  pre-seeded. The align frontier is seeded with six questions.

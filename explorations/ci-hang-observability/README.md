# CI Hang Root Cause and Observability

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Hosted CI jobs sometimes finish nearly all visible work, then remain alive until
their timeout cancels them. The immediate case is PR 764's `Lint Policy` job;
the broader itch is to make hangs diagnosable and eliminate their process,
runner, or orchestration causes instead of accepting reruns as normal.

## Next Open Question

None — graduated. Implementation lives in
[`goals/ci-step-watchdog`](../../goals/ci-step-watchdog/README.md). The only
MAP re-entry point is hosted observability (CW agent / OTel), gated on
in-job forensics proving insufficient after a captured recurrence.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-08-23: captured the operator's recurring-CI-hang concern and PR 764
  screenshot; capture is complete and the packet is ready for research.
- 2026-08-23: research complete. Four-incident census (2× `lint:docgen`
  pre-#748, 2× `lint:native-runtime` post-#748; identical six-orphan
  signature), AWS forensics (flat 1-2-core busy-spin, zero I/O, healthy
  host), full code trace (victim law is in-process ts-morph; step completion
  awaits exit ∧ EOF; #748 guard arms only after exit), 0/41 solo repro, and
  named Bun prior art (bun#27766, bun#34069 — open on 1.3.14; Bun 1.4.0
  ships sibling fixes). Wrote `RESEARCH.md`, `research/SOURCES.md`,
  `research/evidence/EVIDENCE.md`, archived three lane reports under
  `research/lanes/`. Advanced to align.
- 2026-08-23: align complete in two grilling rounds (six decisions + two
  stated defaults in `DECISIONS.md`): watchdog + Bun 1.4.0 canary + wrapper
  drop; in-job forensics only; dump-kill-retry-once; all captured step
  groups; no repro harness. Advanced to shape; `BRIEF.md` drafted, awaiting
  operator review.
- 2026-08-23: operator confirmed `BRIEF.md`. Decomposed (`MAP.md`: one goal,
  four workstreams, first slice = W1-W3 on the Lint Policy lane), passed the
  definition-of-ready, and graduated into
  [`goals/ci-step-watchdog`](../../goals/ci-step-watchdog/README.md)
  (goals doctor + index gates green). Packet status: graduated.
- 2026-08-23 (post-graduation): PR #769's routine deps refresh bumped the
  repo to Bun 1.4.0 ungated, superseding the BRIEF/MAP canary-gate framing;
  the goal's SPEC decision log records the replacement (post-bump soak
  observation). BRIEF/MAP stand unedited as dated provenance.

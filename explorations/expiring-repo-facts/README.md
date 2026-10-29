# Expiring Repo Facts

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `capture`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The repo collects "temporary" facts that nothing ever re-checks, such as
dependencies held back because they break `bun install`. The operator wants a
schema-checked ledger agents can add to, with re-check timers or event
triggers that wake a provider-agnostic agent to update, remove or renew each
item through a mergeable PR.

## Next Open Question

Is the capture complete? When the operator says the dump is done, move to
research. The research is already pre-seeded in [`RESEARCH.md`](./RESEARCH.md),
so that stage mostly needs a gap check before align. The align frontier is
seeded in the manifest `openQuestions`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art, skulk, capability inventory (pre-seeded).
4. [`research/ideation-2026-10-22.md`](./research/ideation-2026-10-22.md) - `/adhd` ideas, traps and three worked-out designs.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance and licenses.

## Trail

- 2026-10-28: packet opened at capture from the 2026-10-22 request, with the
  research report, research notes, ideation and the 2026-10-27 skulk reading
  pre-seeded. The align frontier is seeded with six questions.

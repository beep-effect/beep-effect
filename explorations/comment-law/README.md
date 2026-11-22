# Comment Law

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Agents write comments that restate code, go stale, or excuse a hack. The operator wants every comment
classified and acted on, then a ban with a ratchet, a `/delete-comment` skill, and an estimate of lines shed.

## Next Open Question

None. Graduated into four goals on 2026-11-22; reopen at decompose if a MAP gate fires.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the request, verbatim.
3. [`RESEARCH.md`](./RESEARCH.md) - census, classification, lines shed, capabilities, constraints.
4. [`DECISIONS.md`](./DECISIONS.md) - align rounds.
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch.
6. [`MAP.md`](./MAP.md) - four candidate goals.
7. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger; lane reports beside it.

## Trail

- 2026-11-22: shape confirmed; graduated into comment-law-gate, comment-census-defects, comment-law-sweep and jsdoc-lead-single-source.
- 2026-11-22: align round 2 (JSDoc leads single-sourced, ban prose + local JSDoc, four goals); BRIEF and MAP drafted.
- 2026-11-22: align round 1: purpose reframed to an assessment that tests the JSDoc system instead of exempting it; hazards absorbed under the ratchet; package `decisions/` dirs; one issue per excuse family. Local-JSDoc census bug corrected.
- 2026-11-21: packet opened; census, full classification of non-exported comments and six refuted research lanes landed. Stopped at the align round.

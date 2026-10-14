# Attorney Review Workspace

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Earlier attorney reviews confused the attorney: a sitting web page, a long question deck, a Box
review app, and correction emails, each in a different application. The operator asked how Claude
mods or existing Claude features could make review ergonomic in one place: annotation, notes,
highlighting, inline and side chat, Box sources, and integration with the Claude desktop app's
docks and tiling.

## Next Open Question

None. Graduated into [`goals/review-verdict-envelope`](../../goals/review-verdict-envelope/README.md); gated MAP rows are the
re-entry points.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json): machine state.
2. [`CAPTURE.md`](./CAPTURE.md): the operator's request.
3. [`RESEARCH.md`](./RESEARCH.md): the ergonomic bar from earlier attempts, surface capabilities,
   candidate architectures, in-repo bricks.
4. [`DECISIONS.md`](./DECISIONS.md): the align and shape rulings.
5. [`BRIEF.md`](./BRIEF.md) and [`MAP.md`](./MAP.md): the queue-first review phase, the
   `review-verdict-envelope` goal, and the gated re-entry points.
6. [`research/SYNTHESIS-2026-10-14.md`](./research/SYNTHESIS-2026-10-14.md): the full synthesis.
   Per-facet skeptic verdicts are in
   [`research/FACET-VERDICTS-2026-10-14.md`](./research/FACET-VERDICTS-2026-10-14.md).

## Trail

- 2026-10-14: graduated into `goals/review-verdict-envelope` with `bun run beep explore graduate`; goal SPEC seeded
  from the brief and reviewed independently.
- 2026-10-14: packet opened. Six-facet research with skeptics: 29 claims confirmed, 13 corrected.
  Align rounds 1–3 and the shape review settled 12 rulings:
  - queue-first;
  - a phase of `practice-claude-mod`;
  - `VerdictRow` with a projection to `ClaimDisposition`;
  - D9 widened to Box reads plus `$.prompt.fill`;
  - highlighted passages, with "Open in Box" at page level at best (Box cannot jump to lines);
  - the built-in side chat;
  - whole-sheet drawing verdicts;
  - one surface per work-product type, with a Word check for drafts;
  - no Box writes;
  - handoff by amendment plus one new goal.

# Claim Element Graph

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

IPRally's invention-graph paper ([arXiv 2610.01553](https://arxiv.org/abs/2610.01553)) made a
gap visible. beep-effect models a patent claim's number, dependency, preamble and transition, but
its `body` is one opaque string. Three pieces of work already assume a claim-element layer that
does not exist:
- the drafting ledger's ordered `ClaimLimitationSupportSet`
- `Distinction.missing_limitation`, which is free text
- the research-corpus-synthesis R2-062 consumer gate

The literature points one way: a typed claim-element graph anchored to exact source spans, built
by deterministic rules first, extended by an LLM second, and scored strictly.

## Next Open Question

None. Graduated into [`goals/claim-element-antecedent-check`](../../goals/claim-element-antecedent-check/README.md); gated MAP rows are the
re-entry points.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json): machine state, stage, and the align frontier.
2. [`CAPTURE.md`](./CAPTURE.md): the operator's request and the anchor paper.
3. [`RESEARCH.md`](./RESEARCH.md): the landscape scoped to claim elements, the in-repo bricks,
   and the constraints.
4. [`research/SWEEP-2026-10-14.md`](./research/SWEEP-2026-10-14.md): the full sweep report, with
   its post-acquisition addendum and fact-check appendix.
5. [`research/CATALOG.md`](./research/CATALOG.md): every one of the 139 papers read, with a
   tier and disposition (in scope, routed to an owner, or background).
6. [`research/SOURCES.md`](./research/SOURCES.md): the provenance ledger. It lists the 21
   sources acquired into the research library and the licenses read from each cloned repo.
7. [`research/ANCHOR-2610.01553.md`](./research/ANCHOR-2610.01553.md): the deep-dive on the
   anchor paper and its code release.
8. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md): friction receipts.
9. [`DECISIONS.md`](./DECISIONS.md): the align and shape rulings.
10. [`BRIEF.md`](./BRIEF.md) and [`MAP.md`](./MAP.md): the shaped pitch and the graduation map.

## Trail

- 2026-10-14: graduated into `goals/claim-element-antecedent-check` with `bun run beep explore graduate`; goal SPEC seeded
  from the brief and reviewed independently.
- 2026-10-14: align rounds 1–3 settled 14 rulings, all on the recommended options. The shape review
  routed findings through the shared review queue
  ([attorney-review-workspace](../attorney-review-workspace/README.md)). The map names one goal,
  `claim-element-antecedent-check`, plus gated re-entry points.
- 2026-10-14: packet opened from a 57-agent literature sweep anchored on arXiv 2610.01553. A
  15-claim refutation pass found 8 claims confirmed and 7 partly wrong; corrections are applied.
  The 21 core sources were acquired into the research library (verify: 0 missing, 0 integrity
  failures). IPRally's eval data was inspected: claims only, 13.5% US, not lemmatized, and no
  word-level gold. Research is complete, and the packet stops at the start of align.

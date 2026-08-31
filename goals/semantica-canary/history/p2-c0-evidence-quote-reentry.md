# P2 C0 evidence-quote re-entry

Date: 2026-08-30

Status: preview and annotation gates passed; live probe budget unspent.

## Candidate

The E1 capability prerequisite landed in PR #903. The lab candidate now binds
its model identity to a versioned descriptor containing the rendered prompt,
relation-contract identifier, accepted alignment tiers, and endpoint policy.
The relation contract decodes a non-empty subject, object, predicate, and
evidence quote before relation grounding. Relation evidence admits exact,
lesser, and minimal-fold alignment only. Each endpoint must align uniquely
inside the evidence quote; matching same-batch entity claims are reused and
otherwise created at the scoped endpoint offsets.

The hosted target lists the six predicate strings left in the repaired
gold-v1 relation set. Legacy responses may still carry other non-empty
predicates so the preview measures grounding rather than prompt compliance.

## E5 zero-spend preview

Command:

```sh
SEMANTICA_OFFLINE=true bun server/main.ts relation preview \
  --cases fixtures/relation-preview.json \
  --manifest fixtures/w1.manifest.json
```

The committed preview manifest selects the three breaker response cache keys.
The command validates each immutable cache entry, parses its response, loads
the verified W1 paper, and calls the production hosted-grounding boundary.
It performs no hosted-model request.

| Paper | Cached candidate | Relation candidates | Grounded | Degraded |
| --- | --- | ---: | ---: | ---: |
| `06c93f91ef3d` | first response | 16 | 0 | 16 |
| `06c93f91ef3d` | retry | 7 | 2 | 5 |
| `057e356e94f8` | review-closeout retry | 9 | 8 | 1 |

Result: 10 grounded relations on two papers. E5 passed. The first response's
invented relation sentences correctly remained ungrounded.

## E6 annotation and repair

All 13 proposed relation labels and all nine proposed abstract labels were
hydrated from canonical W1 text and reviewed.

- Dropped the `057e356e94f8` `published in proceedings of` triple whose object
  was the date `November 19, 2020` rather than a venue.
- Normalized `affiliated_with` to `affiliated with`.
- Marked the 12 surviving relation labels verified.
- Standardized abstract gold on the exact `Abstract` or `ABSTRACT` heading
  span. Six labels already followed that convention; three were corrected.
- Marked all nine abstract-heading labels verified.

All edited files were decoded against canonical text and re-encoded through
the gold codec, which recomputed their slice digests. The complete 18-file set
was rehashed and `gold.json` was refrozen with:

- verified labels: 21 / 377
- `spotCheckedFraction`: `0.05570291777188329`
- gold digest: `9321c57c92402fba398ff226a178d9bc2922bb48f116f892fd8584a44ad72f29`

## Proof

- Semantica typecheck: passed.
- Semantica tests: 12 files, 123 tests passed.
- Final E5 replay after gold and vocabulary repair: 10 relations on two
  papers, unchanged from the initial preview.

The paused packet may resume P2. The evidence-quote candidate still owns one
live probe and one retry under E8; neither was spent by this work.

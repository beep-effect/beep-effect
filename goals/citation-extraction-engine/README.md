# Citation Extraction Engine

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver an Effect-native eyecite extraction pipeline over the existing
law-practice citation taxonomy, proven by a pinned parity corpus and grounded by
verified spans plus versioned court/reporter identities.

## Launch

```text
/goal follow the instructions in goals/citation-extraction-engine/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains normative.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract.
3. [`PLAN.md`](./PLAN.md) - active plan.
4. [`ops/manifest.json`](./ops/manifest.json) - dependencies and routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance.
6. [`citation-grounding-hallucination-guard`](../../explorations/citation-grounding-hallucination-guard/README.md) - source exploration.

## Current Phase

Blocked pending `citation-verified-span-substrate` and
`court-reporter-vocabulary`. P0 may assemble the pinned parity corpus,
license/provenance inventory, and regex-safety review without freezing consumer
contracts before both dependencies land.

## Latest Evidence

Not started.

## Notes

No `eyecite-js` dependency. MPEP section patterns and the downstream
ground-before-cite guard remain separate follow-ons.

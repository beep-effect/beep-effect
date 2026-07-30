# Citation Extraction Engine

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

P0 source acquisition is evidenced. Capability-case accounting, regex review,
and dependency compatibility remain open; production contract work is blocked
by the verified-span and public reporter-vocabulary goals.

## Mission

Deliver an Effect-native citation engine with observable capability parity to
pinned official Python eyecite 2.7.6. Preserve exact verified source evidence,
use stable versioned vocabulary identities, adopt only proven TypeScript-port
extensions, and expose schema transformations with honest round-trip laws.

“Port” means capability and behavior parity. It does not require Python class
inheritance, module layout, mutability, or API signatures.

## Launch

```text
/goal follow the instructions in goals/citation-extraction-engine/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains normative.

## Read This First

1. [`GOAL.md`](./GOAL.md) — compact launcher.
2. [`SPEC.md`](./SPEC.md) — normative scope and architecture.
3. [`PLAN.md`](./PLAN.md) — single-PR execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) — dependencies and gates.
5. [`research/EYECITE_BASELINE.md`](./research/EYECITE_BASELINE.md) — verified
   pins and oracle execution.
6. [`research/CAPABILITY_LEDGER.md`](./research/CAPABILITY_LEDGER.md) —
   canonical and extension accounting.
7. [`research/SCHEMA_DISPOSITION.md`](./research/SCHEMA_DISPOSITION.md) —
   decisions for the existing value schemas.
8. [`research/PARITY_METHOD.md`](./research/PARITY_METHOD.md) — comparison and
   transformation laws.
9. [`research/SOURCES.md`](./research/SOURCES.md) — provenance and licenses.

## Reference Hierarchy

1. Pinned Free Law Project eyecite is the normative behavior oracle.
2. `eyecite-ts` and `eyecite-js` are independent differential oracles and
   extension candidates.
3. Repo architecture and Effect/schema laws determine the implementation shape.

No reference repository becomes a runtime dependency or a second public
citation hierarchy.

## Delivery

The current forms remain the first internal vertical slice. The goal stays open
until canonical parity, accepted extensions, schema transforms, corpus proof,
and closeout all land in one implementation PR. Full Bluebook-manual compliance
and later upstream drift are separate follow-ups.

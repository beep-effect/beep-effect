# Citation Extraction Engine

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

P0 source acquisition and public prerequisite compatibility are evidenced.
The 2026-10-28 run passed the pinned official and authorized donor baselines;
66 static assertion declarations produced 1,583 runtime assertion events with
none unobserved. Those events now retain normalized operands and producer
context alongside 8,488 traced iterations and 241 complete literal-loop runs.
The public-operation corpus retains 826 observations and 2,811 coordinate
records. Donor accounting now binds 197 exports and 5,285 runtime cases to
5,674 explicit disposition obligations. Supplemental probes, final gate
integration and regex review remain open before P1. The 29-field limit
policy and process-isolation mechanism are now evidenced; runtime enforcement
and family-level safety proof remain unfinished.

Current evidence:

- [Prerequisite compatibility](./history/evidence/prerequisite-compatibility.md)
- [Source baselines/discovery](./history/evidence/2026-10-28-source-baselines.md)
- [Operation corpus](./history/evidence/2026-10-28-operation-corpus.md)
- [Assertion corpus](./history/evidence/2026-10-28-assertion-corpus.md)
- [Source/case/regex ledgers](./history/evidence/2026-10-28-source-case-ledgers.md)
- [Donor accounting](./history/evidence/2026-10-28-typescript-donor-accounting.md)
- [Vocabulary mapping](./history/evidence/2026-10-28-vocabulary-version-mapping.md)
- [Limits/isolation](./history/evidence/2026-10-28-limits-isolation-contract.md)
- [Evidence presence](./history/evidence/2026-10-28-evidence-presence-audit.md)

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

`GOAL.md` is the compact launcher. Repository instructions and architecture
remain authoritative; within that boundary, `SPEC.md` is this packet's binding
product contract.

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

## Authority and Behavioral Evidence

The governing order is the one in [`goals/README.md`](../README.md): current
user objective, repository instructions and required skills, architecture and
package standards, then `SPEC.md`, `PLAN.md`, `GOAL.md`, and supporting packet
files.

Inside those constraints:

1. Pinned Free Law Project eyecite is the canonical observable-behavior oracle.
2. Published prerequisite contracts govern source anchors and vocabulary
   representation.
3. `eyecite-ts` and `eyecite-js` are differential references and extension
   candidates.

No external reference overrides repo law, becomes a runtime dependency, or
creates a second public citation hierarchy.

## Delivery

The current forms remain the first internal vertical slice. The goal stays open
until canonical parity, accepted extensions, schema transforms, corpus proof,
and closeout all land in one implementation PR. Full Bluebook-manual compliance
and later upstream drift are separate follow-ups.

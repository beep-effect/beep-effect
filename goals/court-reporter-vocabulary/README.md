# Court Reporter Vocabulary

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver deterministic, versioned courts-db and reporters-db artifacts plus
stable public court/reporter identities and a machine-readable compatibility
contract for law-practice consumers.

## Launch

```text
/goal follow the instructions in goals/court-reporter-vocabulary/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains normative.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract.
3. [`PLAN.md`](./PLAN.md) - active plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance.
6. [`court-vocabulary-resolver`](../../explorations/court-vocabulary-resolver/README.md) - source exploration.

## Outcome

Closed 2026-08-27. The pinned targets deterministically emit 2,809 court
identities and 1,262 reporter identities into package-private artifacts. The
law-practice domain exposes schema-decoded stable IDs, source-faithful
vocabulary, ambiguity-preserving lookups, an exact artifact-version gate, and
machine-readable lifecycle compatibility classification without exporting raw
source tables.

## Latest Evidence

Pinned inputs and counts are recorded in
[`research/EYECITE_DATA_AUDIT.md`](./research/EYECITE_DATA_AUDIT.md) and
[`research/SOURCES.md`](./research/SOURCES.md). Deterministic regeneration,
artifact hashes, lifecycle coverage, and the public consumer boundary are
archived under [`history/evidence/`](./history/evidence/). Closeout learning is
captured in
[`history/reflections/2026-08-27-codex.md`](./history/reflections/2026-08-27-codex.md).

## Notes

The resolver, fuzzy ranking, and SKOS projection remain queued. The citation
engine consumes only this goal's public compatibility surface, never raw files.

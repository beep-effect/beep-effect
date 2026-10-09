# Law Document Structure Office-Action Slice

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver versioned, deterministic recognition of the paired office-action
finality declaration and shortened-statutory-period block as exact verified,
schema-backed candidates at the patent-docketing intake seam.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/law-doc-structure-oa-slice/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth and dependency gate.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited implementation provenance.
6. [`history/`](./history/) - evidence and closeouts, when present.
7. [`deterministic-doc-structure-extraction`](../../explorations/deterministic-doc-structure-extraction/README.md) - source exploration.

## Current Phase

P0 complete under the Run 2 ruling. Third blind audit passes, 33/34 atomic
agreement, no unresolved labels; retained-inventory floors pass. P1 implementation
is next. No text-qualified real-OA positive performance is claimed.

## Latest Evidence

Run 2: retained-inventory floors and third blind audit pass; receipts are in
`history/p0/2026-10-09-label-reconciliation.md`. Every fixture is on the
non-blocking `history/p0/2026-10-09-attorney-spot-check.md`. See the handoff for
the final package gate and exact evidence commit.

## Notes

This packet supplies the structure-candidate seam consumed by
`law-docketing-patent-spine`; it does not parse citations, select PDF/OCR
engines, stream partial results, or perform LLM-first extraction.

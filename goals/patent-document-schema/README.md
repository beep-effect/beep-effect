# Patent Document Schema

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship schema-first patent-application section and claim structure in
`@beep/law-practice-domain`, consumed first by the practice-KG claims batch.

## Launch

```text
/goal follow the instructions in goals/patent-document-schema/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`research/SOURCES.md`](./research/SOURCES.md)

## Current Phase

Closed: the typed patent-document vertical slice shipped in PR #867, which
merged as `f1383148c6` on 2026-08-30 with every review thread resolved and the
hosted checks green. This closeout PR records the terminal lifecycle and the
reflection that were omitted when #867 merged.

## Latest Evidence

Re-proved on `main` on 2026-10-05 after the 2.11.7 catalog bump: the domain,
use-cases, and server suites pass (71, 73, and 87 tests; the opt-in
workstation-corpus test stays skipped). The suites cover the 13-section
regulatory order, preamble/transition/body retention, missing/self/forward/
cyclic dependency diagnostics, the 13-section Markdown fixture, and the
claims batch consuming `PatentApplicationDocument` without the office-action
extractor. The frozen source contract is recorded in
[`research/SOURCES.md`](./research/SOURCES.md#p0-implementation-confirmation--2026-08-27);
the reflection is in
[`history/reflections/2026-10-05-claude.md`](./history/reflections/2026-10-05-claude.md).

## Notes

This goal ships first. Later PO, SPAR, and taxonomy goals do not widen it.

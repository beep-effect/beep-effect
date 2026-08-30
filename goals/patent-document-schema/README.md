# Patent Document Schema

## Status

Lifecycle: `active`

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

P2 Verify: the domain schema, Markdown normalizer, and typed practice-KG
consumer are implemented; repository gates and hosted proof remain.

## Latest Evidence

Focused domain/use-case/server tests pass, including one 13-section Markdown
fixture persisted as three candidate claims without invoking the legacy
office-action extractor. The frozen source contract is recorded in
[`research/SOURCES.md`](./research/SOURCES.md#p0-implementation-confirmation--2026-08-27).

## Notes

This goal ships first. Later PO, SPAR, and taxonomy goals do not widen it.

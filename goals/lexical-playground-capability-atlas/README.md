# Lexical Playground Capability Atlas

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Establish a versioned, evidence-backed completeness contract for Lexical
Playground and prove the smallest schema-backed capability/profile mechanism in
`@beep/editor` and a synthetic Professional Desktop dock panel.

Graduated from
[`explorations/full-document-editor`](../../explorations/full-document-editor/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/lexical-playground-capability-atlas/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance.
6. [`../../explorations/full-document-editor/DECISIONS.md`](../../explorations/full-document-editor/DECISIONS.md) - ratified D1-D27.
7. [`history/`](./history/) - execution evidence and closeout reflections.

## Current Phase

P0 Research completed on 2026-08-24. The final atlas has 154 `verified-live`
entries, 14 `verified-source` entries, and 10 `unverified` entries covered by
user-approved Exception Ledger waivers. The exercise harness has been hermetic
since PR #793.

- [`research/capability-atlas.json`](./research/capability-atlas.json) is the
  normative `editor-capability-atlas/v1` artifact.
- [`ops/CapabilityAtlas.schemas.ts`](./ops/CapabilityAtlas.schemas.ts) defines
  its schema-first wire contract.
- [`ops/verify-capability-atlas.ts`](./ops/verify-capability-atlas.ts) checks
  schema validity, stable IDs, dependencies, evidence paths, and pinned
  inventories.
- [`research/p0-evidence-gaps.md`](./research/p0-evidence-gaps.md) is the exact
  browser-exercise remainder and points to the approved Exception Ledger.

## Latest Evidence

- [Live Chrome audit with 17 screenshots](../../explorations/full-document-editor/research/LEXICAL-PLAYGROUND-LIVE-AUDIT.md)
- [Pinned source audit](../../explorations/full-document-editor/research/LEXICAL-PLAYGROUND-SOURCE-AUDIT.md)
- [Shaped brief](../../explorations/full-document-editor/BRIEF.md)

## Notes

- Upstream baseline: Lexical Playground `0.49.0`, commit `a933222c489e7025d87b9217c2489d309fc8a3cf`.
- Goal A inventories everything but implements only the registry/resolver and a
  representative proof over already-supported document semantics.
- `@beep/md` remains the sole canonical document model. Do not add document
  semantics in this goal.
- The Notion initiative is a visual product/evidence hub; this packet is the
  normative execution contract.

# Lexical Playground Capability Atlas

## Status

Lifecycle: `completed-retained`

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

All phases are complete as of 2026-08-25; the closeout PR carries the full
`bun run beep yeet verify` proof, the reflection
([`history/reflections/2026-08-25-claude.md`](./history/reflections/2026-08-25-claude.md)),
and the Goal B handoff.

- P1 landed the ratified contract
  ([`research/P1-CAPABILITY-CONTRACT.md`](./research/P1-CAPABILITY-CONTRACT.md)):
  `@beep/editor/capability` schemas, typed resolution errors, a deterministic
  resolver, command/help/slash projections, runtime bindings with a guarded
  keybinding plugin, `CapabilityComposer`, the `minimal` and `document-proof`
  reference profiles, Storybook proof, and the closed-by-default
  `editor-proof` Professional Desktop shell panel. Lane reports live under
  [`history/p1-implement/2026-08-25/`](./history/p1-implement/2026-08-25/).
- P2 ran four recorded playwright rounds against the real dock UI; round 4 is
  `CAPTURE-GREEN` (82/82 assertions, zero app console errors) with a
  `gpt-5.6-sol` vision-judge inventory of zero findings. The round ledger,
  harness, judged round-3 and final round-4 evidence live under
  [`history/p2-qa/2026-08-25/`](./history/p2-qa/2026-08-25/).
- The atlas gained five codec-backed compatibility corrections
  (`format.strikethrough` lossless end-to-end; the case transforms and
  `transformer.highlight` unsupported for `beep-md`). The
  `interchange.canonical-json` importer waiver retired: round 4 recorded the
  canonical JSON import lifecycle and the atlas path is `verified-live`.
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

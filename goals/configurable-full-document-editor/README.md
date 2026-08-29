# Configurable Full Document Editor

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Implement every production-eligible single-user Playground document semantic,
authoring mechanic, and projection in semantic batches behind the ratified
registry.

Graduated from
[`explorations/full-document-editor`](../../explorations/full-document-editor/README.md).

## Resume condition

Paused at scaffold: authored-but-not-started. Resume when
`goals/lexical-playground-capability-atlas` satisfies its completion gate and
delivers the ratified atlas/profile contract. P0 then refreshes this packet from
that contract and enumerates the semantic batches for user ratification.

## Launch

After the resume condition is met, use:

```text
/goal follow the instructions in goals/configurable-full-document-editor/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read this first

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher and pause gate.
2. [`SPEC.md`](./SPEC.md) - normative scope and completion contract.
3. [`PLAN.md`](./PLAN.md) - pending P0-P4 execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited source corpus.
6. Goal A prerequisite contract:
   [`SPEC.md`](../lexical-playground-capability-atlas/SPEC.md).
7. Binding decisions D1-D27 and D28 pause semantics:
   [`DECISIONS.md`](../../explorations/full-document-editor/DECISIONS.md).
8. [`history/`](./history/) - later execution evidence and closeout reflection.

## Current phase

Paused before P0 Research. Do not enumerate or implement batches from the
pre-ratification packet. On resume, refresh this contract from Goal A's delivered
atlas/profile contract, then obtain user ratification of the complete batch map.

## Latest evidence

Not started. The source exploration carries the
[`pinned audits`](../../explorations/full-document-editor/research/SOURCES.md),
and Goal A owns their normalization into the executable atlas/profile contract.

## Notes

- Goal A is a prerequisite, not part of Goal B's implementation scope.
- D13 requires every production-eligible single-user capability, not a common
  word-processing subset.
- The seven remaining MAP candidates are gated successor goals and are not
  scaffolded by this packet.

## Handoff from Goal A (2026-08-25)

`goals/lexical-playground-capability-atlas` completed and delivered the
contract this goal consumes:

- The ratified atlas `research/capability-atlas.json`
  (`editor-capability-atlas/v1`, 178 entries, 12 user-approved waivers in its
  `SPEC.md` Exception Ledger — the inherited waivers listed above are
  unchanged; the `interchange.canonical-json` waiver retired on live
  evidence).
- `@beep/editor/capability`: LiteralKit domains, `CapabilityDescriptor` /
  `CapabilityCatalog` / `EditorProfile` / `ResolvedEditorProfile`, typed
  `ProfileResolutionError`s, `resolveEditorProfile`, projections
  (`projectCommands`, `projectShortcutHelp`, `projectSlashItems`), runtime
  bindings with a guarded `KeybindingPlugin`, `CapabilityComposer`, and the
  `minimal` / `document-proof` reference profiles. Design record:
  `goals/lexical-playground-capability-atlas/research/P1-CAPABILITY-CONTRACT.md`.
- Extension path: add one descriptor per atlas id (dependencies, commands,
  chords, and the `beep-md` compatibility row copied from the atlas), register
  its Lexical node/plugin/transformer in `capability/runtime.tsx`, and keep
  `packages/foundation/ui-system/editor/test/capability-catalog.test.ts` — the
  strict atlas reconciliation — green. Product profiles stay app-owned.
- Proof surfaces to extend: `stories/capability-profiles.stories.tsx` and the
  Professional Desktop `editor-proof` shell panel (`src/editor-proof/`), with
  the recorded QA harness at
  `goals/lexical-playground-capability-atlas/history/p2-qa/2026-08-25/qa-capture.mjs`.

Resume remains a user decision once the Goal A closeout PR merges.

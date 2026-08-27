# Pack jsonl — round 1 JSDoc fix

JSDoc and schema-identity upgrades under `scratchpad/jsonl/` only. Runtime
behavior of encode/decode/split/append is unchanged. Allowed code edits:
`$I.annote` / `$I.annoteSchema`, `Schema.Class` / `Schema.TaggedError`
identifiers via `$ScratchpadId.create("jsonl/...")`, the `EnvelopeFrame`
same-name type alias, and `matchesFrame`'s parameter type using that alias.

## Changed files

- `scratchpad/jsonl/index.ts`
- `scratchpad/jsonl/Envelope.ts`
- `scratchpad/jsonl/Journal.ts`
- `scratchpad/jsonl/JsonlError.ts`
- `scratchpad/jsonl/JsonlEvent.ts`
- `scratchpad/jsonl/Line.ts`
- `scratchpad/jsonl/LineSlice.ts`
- `scratchpad/jsonl/Slice.ts`
- `scratchpad/jsonl/internal/merge.ts`
- `scratchpad/jsonl/internal/tail.ts`
- `scratchpad/jsonl/internal/utf8.ts`

Barrel re-exports were not documented as symbols. Nested `JournalShape.query` /
`JournalShape.changes` / `JournalClass.layer` `@remarks` (including the illegal
loose `ts` fence) were moved into `**Gotchas**`; the bind-once snippet is the
titled Example on `Journal`.

## Items closed

All 26 accepted findings:

| ID | Status | What landed |
| --- | --- | --- |
| jsonl-R1-001 | closed | Envelope module `@packageDocumentation` `@since 0.0.0`; tags + titled Examples on `EnvelopeFrame` / `Envelope` |
| jsonl-R1-002 | closed | Journal module header; types tagged; `Journal` titled Example |
| jsonl-R1-003 | closed | JsonlError module header; eight classes `@category errors` + titled Examples; union type-level |
| jsonl-R1-004 | closed | JsonlEvent module header; TypeId / interface / factory tagged; factory titled Example |
| jsonl-R1-005 | closed | Line module header; `ParsedLine` / `Line` tagged with titled Examples (split + lastValid on `Line`) |
| jsonl-R1-006 | closed | LineSlice module header; class tagged; CRLF Example converted |
| jsonl-R1-007 | closed | Slice module header; interfaces tagged; `matchesFrame` predicates + titled Example |
| jsonl-R1-008 | closed | Barrel `@since 0.0.0`; titled Example with `@beep/scratchpad/jsonl` and `import * as O`; described `@see` |
| jsonl-R1-009 | closed | merge.ts module header; four values tagged with titled Examples |
| jsonl-R1-010 | closed | tail.ts module header; constants/functions tagged with titled Examples; `TailWindow` prose only |
| jsonl-R1-011 | closed | utf8.ts module header; `utf8Length` utilities + titled Example |
| jsonl-R1-012 | closed | `EnvelopeFrame.pipe($I.annoteSchema(...))` + `export type EnvelopeFrame` |
| jsonl-R1-013 | closed | Gotchas + described `@see` on `EnvelopeFrame` / `Envelope`; thin derived aliases |
| jsonl-R1-014 | closed | Nested `@remarks` / loose fence removed; layer identity is the `Journal` Example |
| jsonl-R1-015 | closed | `Journal` Example imports `@beep/scratchpad/jsonl` and `import * as S`; bind-once `export const layer` |
| jsonl-R1-016 | closed | Journal type leads rewritten; torn-tail / unsliced-query / shallow-patch / bind-once Gotchas |
| jsonl-R1-017 | closed | `MalformedLine` titled Example, no `!`, no `@effected/*` |
| jsonl-R1-018 | closed | `$I.annote` on all eight tagged errors; recovery `@see`; `JournalResync` Gotchas |
| jsonl-R1-019 | closed | `JsonlEvent` Example observes `tag` / `terminal` / `reopen` |
| jsonl-R1-020 | closed | TypeId branding lead; namespace nested `@category`/`@since`; DataSchema Gotchas |
| jsonl-R1-021 | closed | Member `@example` on `byteLength` converted; `ParsedLine` `$I.annote`; lastValid Gotchas |
| jsonl-R1-022 | closed | LineSlice Example imports `@beep/scratchpad/jsonl`; `$I.annote`; UTF-8 / `end` Gotchas |
| jsonl-R1-023 | closed | Slice / matchesFrame Gotchas (empty arrays, half-open `to`, frame-only); CursoredSlice resume-from-`line.end` |
| jsonl-R1-024 | closed | merge Gotchas (class record-like, asymmetric `canMerge`, transient `Object.create`); pollution Example |
| jsonl-R1-025 | closed | tail Gotchas (BOM probe, unclamped window, streaming decoder); `@see` `Line.lastValid` |
| jsonl-R1-026 | closed | `utf8Length` `@see {@link Line.byteLength}`; unpaired-surrogate in Example + Gotchas |

## Mechanical shape after the pass

- 11 exporting modules: useful lead, `@packageDocumentation`, `@since 0.0.0` (index still has `owningExportCount === 0`, so census module findings stay empty by design)
- Owning exports: original 45 plus the `EnvelopeFrame` same-name type alias (46)
- Every owning export: useful lead, canonical `@category`, `@since 0.0.0`
- Value-level: titled `**Example** (Title)` with one `ts` fence and an observable result
- Type-level: prose + tags; namespace `JsonlEvent` also has a Tag-union Example so census `kind: value` on `export declare namespace` is not an open `@example` gap
- Zero `@example` / `@remarks` / `@module` / `@template` / `@since 0.1.0` / `@effected/jsonl` under `scratchpad/jsonl/`
- Tag order: `@see` → `@public`/`@internal` → `@category` → `@since`
- `$I` composers: `jsonl/Envelope`, `jsonl/JsonlError`, `jsonl/Line`, `jsonl/LineSlice`

Suggested categories: `EnvelopeFrame` `schemas`; `Envelope` const `codecs`; interfaces `models`; derived aliases `type-level`; errors `errors`; `JsonlEvent` const `factories`; TypeId `type-ids`; `Line` `parsing`; `matchesFrame` `predicates`; merge guards `predicates` / `shallowMerge` `utilities`; `DEFAULT_WINDOW` `constants`; tail IO `resource-management`; `Journal` const `factories`; `JournalShape`/`JournalClass` `services`; `JournalConfig` `configuration`.

## Residual risk

- **Census bun run.** Mechanical rules from `scratchpad/.jsdoc-loop/census.ts` (lead ≥ 12, required tags, titled Example on values, forbidden carriers/grammar, described `@see`) were applied by inspection to every exporting module under `scratchpad/jsonl/`. Official `/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts` was not executed in this subagent (no shell tool). Re-run it and expect jsonl `openModuleCount: 0` and `openOwningExportCount: 0`.
- **Example TypeScript gate.** Public Examples import `@beep/scratchpad/jsonl` (and `@beep/scratchpad/memfs` from internal tail docs). They were not executed through `bun run docgen:local`. `@internal` symbols are skipped by docgen `shouldIgnore`, so merge/tail/utf8/matchesFrame fences will not be extracted; they still exist for hover readers and for census.
- **Docgen class members.** `Line` static methods carry titled Examples so `enforceExamples` on class statics can pass. Error `message` getters are `/** @internal */` so they are not required to have Examples.
- **Identity annotations.** `$I` identifiers replace the previous bare `"LineSlice"` / `TaggedError()` schema ids. `_tag` strings are unchanged.
- **Namespace census FP.** Inventory rejected a required Example on `export declare namespace JsonlEvent`; a Tag-union Example was added anyway so mechanical opens stay 0.

## Commands run

- Grep `scratchpad/jsonl/**/*.ts` for `@example`, `@remarks`, `@effected/jsonl`, `@packageDocumentation`, `@since`, `@category`, `**Example**`, `declare const`, undescribed `@see`, loose ` ```ts `
- Census rule inspection against `scratchpad/.jsdoc-loop/census.ts`
- Official `bun scratchpad/.jsdoc-loop/census.ts` and `bun run docgen:local` were not executed (no shell tool in this subagent)

# JD-7a — modeling family jsdoc

Wave: `JD-7`, lane: `JD-7a`. Three packages processed strictly sequentially
(one writer at a time, each fully verified before the next opened). Recipe
from `goals/standards-remediation/ops/reports/JD-1/jd-1-pilot.md` applied
throughout. No commits made; `standards/jsdoc-documentation.inventory.jsonc`
read-only (one-time Python `json.load` extraction of the three packages'
`exports[]` slices).

## 1. `packages/foundation/modeling/pandoc-ast` (`@beep/pandoc-ast`) — 94 findings

Before: `missingExportExamples: 92`, `schemaAnnotationFindings: 2` (openExports
92, two entries double-counted across missing-example + schema-gap on
`PandocInlineChildren`/`PandocBlockChildren`). After (self-verified against
the 92 repoPath:line coordinates read from the inventory): 0.

| File | Findings | Disposition |
|---|---|---|
| `src/Pandoc.codec.ts` | 5: `PandocConstructorWire` (class+namespace), `PandocJsonWire` (namespace), `PandocJsonFromString` (const+type) | **fixed** — every base symbol in this file already had examples from a prior pass; only companion namespaces / runtime-type-alias siblings were missing. Decode/`.make` examples added, reusing the class's own field shapes. |
| `src/Pandoc.mapping.ts` | 4: `PandocToDocumentResult` (class+namespace), `DocumentToPandocResult` (class+namespace) | **fixed** — `.make({...})` examples constructing a `Md.Document` + `PandocCompatibilityReport.fromIssues([])` pair. |
| `src/Pandoc.model.ts` | 75 | **fixed** — this file's base symbols (unlike the JD-1 pilot) largely lacked examples, so every fixture was derived fresh from the schema's actual field types: all 25 `TaggedClass`/`Class` + companion-namespace pairs (`Str`…`PandocDocument`), 3 union triples (`PandocInline`, `PandocBlock` const+type+namespace), and 11 standalone const/type pairs (`PandocApiVersion`, `PandocKeyValue`, `PandocMathType`, `PandocListNumberStyle`, `PandocListNumberDelimiter`, `PandocListItem`, `PandocListItems`, `PandocMeta`). |
| `src/Pandoc.model.ts` schema gaps | 2: `missing-schema-runtime-type-alias` on `PandocInlineChildren`, `PandocBlockChildren` | **fixed** — added `export type X = typeof X.Type` sibling between each const and its namespace, mirroring the pre-existing `PandocInline`/`PandocBlock` 3-way merge pattern already proven in the same file. |
| `src/Pandoc.report.ts` | 8: `PandocMappingDirection`/`PandocMappingSeverity`/`PandocMappingProfile`/`JsonPathSegment` (type only — consts already had examples), `JsonPath` (const+type), `PandocMappingIssue`/`PandocCompatibilityReport` (namespace only) | **fixed**. |

**Trap hit and self-caught**: the recursive suspend-array schemas
(`PandocInlineChildren`, `PandocBlockChildren`, `PandocListItem`,
`PandocListItems`) are annotated `S.Codec<..., unknown, unknown>` (requirements
pinned to `unknown`, not `never`), so `S.decodeUnknownSync` fails to compile
against them (`ConstraintDecoder<unknown, never>` mismatch — confirmed via a
first `turbo run docgen` attempt that errored on exactly these four). Fix:
`S.is(schema)` compiles against any `Schema.Schema<T>` regardless of its `R`
parameter, so all four examples use `S.is(...)` instead of decode. Verified
in isolation via `docs/examples/tsconfig.json` before committing to the
source files.

Verify: `turbo run docgen --filter=@beep/pandoc-ast` — 122 examples found and
typechecked, zero errors. `npx tsgo -b` clean. `npx vitest run` — 40/40
passed. `bunx biome check packages/foundation/modeling/pandoc-ast` — 16
files, no issues.

## 2. `packages/foundation/modeling/lexical` (`@beep/lexical-schema`) — 50 findings

Before: `missingExportExamples: 47`, `schemaAnnotationFindings: 3` (openExports
50). After: 0. All 50 findings live in the single file `src/Lexical.model.ts`.

| Group | Findings | Disposition |
|---|---|---|
| Bitmask/id primitives | 26: `LexicalNodeVersion`, `TextFormatBits`, `TextFormatBit`, `TEXT_FORMAT_MASK_ALL`, `TextFormatMask`, `hasTextFormat`, `withTextFormat`, `TextDetailBits`, `TextDetailBit`, `TEXT_DETAIL_MASK_ALL`, `TextDetailMask`, `LexicalIndentDepth`, `TableCellHeaderState`, `TableCellSpan`, `TableDimension`, `ArtifactRefId` (const+type pairs, plus the two `dual` combinators) | **fixed** — examples derived from each symbol's actual mapping (`MappedLiteralKit.From.Enum` values traced back to `MappedLiteralKit.schema.ts` to confirm `TextFormatBits.bold === 1`), branded-schema decode examples following the repo's established `S.decodeUnknownSync(Branded)(n)` convention (confirmed against `@beep/schema/Int.ts`'s own `PosInt`/`Int` doc examples). |
| `SafeInlineStyle`, `SafeStyleValue` schema gaps | 2: `missing-schema-runtime-type-alias` | **fixed** — added `export type X = typeof X.Type` for both, matching the pre-existing sibling `SafeUrl` pattern already in the same file. |
| Companion namespaces | 21: `BaseNode`, `ElementNode`, `TextBase`, `TextNode`, `TabNode`, `LineBreakNode`, `RootNode`, `ParagraphNode`, `HeadingNode`, `QuoteNode`, `ListNode`, `ListItemNode`, `LinkNode`, `CodeNode`, `ArtifactRefNode`, `YouTubeNode`, `TableCellNode`, `TableRowNode`, `TableNode`, `LexicalNode`, `SerializedEditorState` | **fixed** — each got a `S.decodeUnknownSync(X)({...})` example typed `X.Type`, with the minimal required-field JSON payload derived by reading each class's field list (defaults vs. required) directly rather than guessing. |
| `LexicalNode` schema gap | 1: `missing-schema-annotation` — the tagged-union const had no `$I.annote`/`$I.annoteSchema` at all | **fixed** — added `$I.annoteSchema("LexicalNode", {...})` into the existing `.pipe(...)` chain alongside `S.toTaggedUnion` and `SchemaUtils.withCodecStatics`. |

Verify: `turbo run docgen --filter=@beep/lexical-schema` — 106 examples found
and typechecked on the first attempt, zero errors. `npx tsgo -b` clean.
`npx vitest run` — 22/22 passed. `bunx biome check
packages/foundation/modeling/lexical` — 13 files, no issues.

## 3. `packages/foundation/primitive/data` (`@beep/data`) — 36 findings

Before: `missingExportExamples: 36` (openExports 36, no schema gaps). After: 0.
All 36 findings are in generator-emitted files under `src/generated/`
(`cldr-territories.ts` 12, `iana-media-types.ts` 8, `iana-timezones.ts` 7,
`iso4217.ts` 9), each carrying a `Generated by \`bun run beep sync-data-to-ts
--target ...\`` banner.

Per the lane brief's instruction to fix the generator template rather than
hand-edit generator output: found the four target definitions at
`packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/{CldrTerritories,IanaMediaTypes,IanaTimezones,Iso4217}.ts`,
each with a `render*Module` function returning the emitted file as a JS
template literal.

- **Reused, did not reinvent, the example bodies**: this package already has
  hand-authored wrapper modules (`src/Territories.ts`, `src/Timezones.ts`,
  `src/MimeTypes.ts`, `src/CurrencyCodes.ts`) that re-export every one of
  these 36 generated constants under their own fully-`@example`'d JSDoc
  (using `console.assert(...)` against real data — e.g.
  `CurrencyCodeDataByCode.USD.currency === "US Dollar"`). Those wrappers are
  not in the findings list (their own doc quality already passes), but they
  gave verified-correct example bodies to adapt.
- **Rejected the naive fix**: hardcoding today's data values (e.g.
  `releaseTag === "48.2.0"`) directly into the *generator template* would go
  stale and become factually wrong the next time `sync-data-to-ts` actually
  regenerates against updated upstream data — violating the "no fake docs"
  rule the moment the CLDR/IANA/ISO source changes. Instead, each
  `render*Module` function now computes a representative sample entry from
  the *actual data being rendered* (e.g. `values[0]`, or `.find(code ===
  "USD")` with a same-shape fallback for the empty-array edge case) and
  interpolates it through the existing `formatTsLiteral` helper, so every
  future regeneration emits an example that is guaranteed true of that run's
  data.
- **Synced the current checked-in output by hand** to match what the updated
  template would now emit for the *currently pinned* data (no network
  fetch/regeneration performed, so the actual CLDR/IANA/ISO payloads are
  byte-identical to before — only doc comments changed).

Verify: `turbo run docgen --filter=@beep/data` — 150 examples found and
typechecked (up from 114 pre-fix), zero errors. `npx tsgo -b` (both
`packages/foundation/primitive/data` and `packages/tooling/tool/cli`) clean —
the two `unnecessaryTypeofType` diagnostics surfacing in the `@beep/repo-cli`
build are pre-existing, in `BufferEncoding.ts`/`Timestamp.schema.ts`, files
this lane never touched (confirmed already dirty from a concurrent lane
before this session started). `npx vitest run` — 34/34 passed. `bunx biome
check` on both the data package and the CLI targets directory — one
formatting nit auto-fixed via `--write` (line-wrap in `CldrTerritories.ts`),
then clean.

## Throughput

- `@beep/pandoc-ast` (94 findings, largest single file at 1693 lines with 75
  findings) went first, so it absorbed no prior recipe warm-up beyond JD-1 —
  every fixture was authored from scratch by reading the actual field
  definitions, as flagged in the driver's brief for this wave (base symbols
  here largely lacked pre-existing examples, unlike JD-1's `@beep/govinfo`).
- `@beep/lexical-schema` (50 findings) was full-file (`Lexical.model.ts`
  alone), including tracing a `MappedLiteralKit` runtime helper to its source
  to get `.From.Enum` semantics right before writing bitmask examples, and
  discovering + fixing a `missing-schema-annotation` gap (`LexicalNode` had
  no `$I.annote` at all, not just a missing example).
- `@beep/data` (36 findings) was qualitatively different: no schema fixtures
  to invent — instead required source-tracing the generator/output
  relationship (the CLAUDE.md hint to "check for generation banners first"
  paid off immediately) and reusing already-correct wrapper-file example
  prose, but designing the fix to be regeneration-safe cost more time than a
  naive per-const hardcode would have.
- No repeatable automation opportunity beyond the JD-1 recipe (still true
  here); the `@beep/data` case adds one durable finding for future lanes:
  when a package's findings are in `src/generated/*`, always check whether a
  hand-authored wrapper module already documents the same symbols before
  writing new examples from scratch.

Files touched (11 total, no commits):
`packages/foundation/modeling/pandoc-ast/src/{Pandoc.codec,Pandoc.mapping,Pandoc.model,Pandoc.report}.ts`,
`packages/foundation/modeling/lexical/src/Lexical.model.ts`,
`packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/{CldrTerritories,IanaMediaTypes,IanaTimezones,Iso4217}.ts`,
`packages/foundation/primitive/data/src/generated/{cldr-territories,iana-media-types,iana-timezones,iso4217}.ts`.

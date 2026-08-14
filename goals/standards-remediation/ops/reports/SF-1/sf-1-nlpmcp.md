# SF-1 — @beep/nlp-mcp (sf-1-nlpmcp)

Wave: SF-1 | Package: `@beep/nlp-mcp` | Path: `packages/drivers/nlp-mcp` | Entry slice: `goals/standards-remediation/ops/slices/P4/beep__nlp-mcp.json` (15 entries, all `object-struct-schema` / "Inline nested S.Struct boundary shapes stay tracked until a dedicated class extraction pass.")

## Disposition: all 15 entries `fixed`

Every entry was the same shape: an MCP tool's `Parameters` class (`S.Class`) declared its optional `options` field as an **inline nested `S.Struct({...})`** instead of a named schema. RC-SF move #3 applies directly: "inline nested `S.Struct` → extracted named class." Each was extracted into a standalone, exported, documented `S.Class` (`<Tool>Options`), and the parent `Parameters` class now references it via `S.optionalKey(<Tool>Options)` with the TS generic updated from `options?: unknown` to `options?: <Tool>Options | undefined`.

| Symbol (file: `src/StreamingTools.ts`) | New extracted class | Disposition |
|---|---|---|
| `CountJsonlParameters` | `CountJsonlOptions` | fixed |
| `CountLinesParameters` | `CountLinesOptions` | fixed |
| `ExtractMatchesParameters` | `ExtractMatchesOptions` | fixed |
| `FilterLinesParameters` | `FilterLinesOptions` | fixed |
| `LoadJsonParameters` | `LoadJsonOptions` | fixed |
| `LoadJsonlParameters` | `LoadJsonlOptions` | fixed |
| `LoadLinesParameters` | `LoadLinesOptions` | fixed |
| `LoadTextParameters` | `LoadTextOptions` | fixed |
| `ProcessFileParameters` | `ProcessFileOptions` | fixed |
| `ReadJsonlParameters` | `ReadJsonlOptions` | fixed |
| `ReadLinesParameters` | `ReadLinesOptions` | fixed |
| `SampleJsonlParameters` | `SampleJsonlOptions` | fixed |
| `SampleLinesParameters` | `SampleLinesOptions` | fixed |
| `TextStatsParameters` | `TextStatsOptions` | fixed |
| `ValidateJsonlParameters` | `ValidateJsonlOptions` | fixed |

No detector-bug, unconvertible, or blocked/ripple dispositions — the recorded exception `reason` ("stay tracked until a dedicated class extraction pass") was a straightforward hypothesis to invalidate, and it invalidated cleanly with zero ripple: none of the 15 `*Parameters` classes were ever exported or imported anywhere outside this file (verified via repo-wide grep before touching anything), so the extraction is fully local to `@beep/nlp-mcp`.

### Why a fresh class per tool, not a shared one

`TextStatsOptions` and `SampleLinesOptions` (and a few other pairs) happen to have identical field shapes today. They were kept as distinct named classes (one per flagged symbol/tool) rather than deduplicated into a shared schema, because each is a distinct MCP tool-call boundary that a caller reasons about independently; collapsing them would be a design decision outside this lane's mandate (schema-first conversion only, not a crispen/dedup pass), and keeping them independent avoids incidentally coupling two tools' contracts if one gains a field later.

### Why NOT the existing richly-typed `*Options` classes in `Streaming/*.ts`

The `Streaming/TextStream.ts`, `Streaming/DatasetLoader.ts`, `Streaming/Jsonl.ts`, and `Streaming/Pipeline.ts` modules already define their own named `S.Class` option types (`TextReadOptions`, `TextStreamOptions`, `DatasetLoadTextOptions`, `JsonlReadOptions`, `PipelineProcessOptions`, etc.) — but those all apply `SchemaUtils.withKeyDefaults(...)` / `SchemaUtils.BoolKeyDefaultFalse`, i.e. they decode with server-side defaults baked in. The MCP tool-facing `options` parameter must stay a plain, all-optional, no-default shape (the handler layer in `StreamingHandlers.ts` explicitly branches on `options?.field === undefined` and bridges into the internal defaulted classes via `O.getSomesStruct`/`O.fromUndefinedOr`). Reusing the internal defaulted classes for the wire-facing parameter schema would change the tool's exposed JSON Schema and decode semantics — a public-contract break the §5.3 parity proof forbids. So each new `<Tool>Options` class mirrors the *exact* prior inline `S.Struct` field set (same keys, same `S.optionalKey`, no defaults), just promoted to a named, documented, independently testable schema.

## §5.3 parity proof

- **Wire shape**: every field stayed `S.optionalKey(...)` with no default added — the encoded/decoded shape is unchanged (verified by both the new unit test below and by the untouched `test/integration/Streaming.test.ts`, which sends the exact same raw option literals — `{ skipInvalid: true }`, `{ maxErrors: 1, maxRecords: 2 }`, `{ skipEmpty: true }`, etc. — through `StreamingToolkit.handle(...)` and still passes all 20 cases unmodified).
- **Round-trip law**: added `it("round-trips tool-parameter option schemas extracted from inline S.Struct (RC-SF)")` in `test/Streaming.schema.test.ts` — one `assertRoundTrip(S.toArbitrary(...))` law per extracted class (15 total), matching the existing `assertRoundTrip` harness used for the sibling `Streaming/*.ts` option types.
- **Byte-identical snapshot**: added `it("keeps extracted tool-parameter option wire shape byte-identical to the prior inline S.Struct")` asserting `encode(ReadLinesOptions, ReadLinesOptions.make({}))` / `encode(ProcessFileOptions, ProcessFileOptions.make({}))` both `toEqual({})` (no keys materialize for an all-omitted optional struct, exactly as the old inline `S.Struct` behaved), plus populated-field snapshots for `ReadLinesOptions`, `ValidateJsonlOptions`, and `ProcessFileOptions` (which carries the pre-existing `stopOnError` field-level `annotateKey` description, preserved verbatim).
- Also exported the 15 new classes (previously-internal `Parameters` classes stay unexported, matching prior convention) with full JSDoc (`@example` + `@since 0.0.0` + `@category schemas`, and a companion `export type X = typeof X.Type` + `@category models`), matching every other exported schema in this file — this is what let the parity tests import and exercise them, and pushed `docgen`'s typechecked-example count from 82 to 97 with zero failures.

## Files touched

- `packages/drivers/nlp-mcp/src/StreamingTools.ts` — 15 inline `S.Struct` extractions → named, exported, documented `S.Class` schemas; 15 parent `*Parameters` classes updated to reference them.
- `packages/drivers/nlp-mcp/test/Streaming.schema.test.ts` — added the round-trip and byte-identical parity tests above.

No other files touched. No ripple: repo-wide grep for every `*Parameters` symbol name (`rg` across `packages/drivers/nlp-mcp`, excluding `StreamingTools.ts` itself) found zero external references before the change.

## Commands run + outcomes

| Command (run from `packages/drivers/nlp-mcp`) | Outcome |
|---|---|
| `npx tsgo -b tsconfig.json` | clean (0 errors), run twice |
| `npx tsgo -p tsconfig.test.json --noEmit` | clean (0 errors) |
| `bunx --bun vitest run --passWithNoTests --exclude='test/integration/**'` | 3 files / **14 passed** (12 pre-existing + 2 new parity tests) |
| `bunx --bun vitest run test/integration --passWithNoTests` | 1 file / **20 passed**, unmodified |
| `bunx biome check .` | clean, 18 files |
| `bun run docgen` (package-scoped) | ✓ succeeded, 97 examples found/typechecked (up from 82) |
| `npx tsc -b tsconfig.json` (build) | clean **in isolation** — see caveat below |

### Caveat: repo-wide `turbo run build check test docgen --filter=@beep/nlp-mcp` is currently red for out-of-scope reasons

`@beep/nlp-mcp` depends on `@beep/nlp-processing` and (transitively) `@beep/schema`/`@beep/utils`/`@beep/modeling/nlp`. `turbo run ... --filter=@beep/nlp-mcp`, `bun run beep:check` (`tsgo -b`), and plain `tsc -b` all transitively build those project references, and across repeated attempts each run surfaced a **different** transient error in a **different** sibling file — `packages/foundation/modeling/utils/src/Array.ts`, `packages/foundation/modeling/nlp/src/Algebra/Monoid.ts`, `packages/foundation/modeling/schema/src/index.ts`, `Csp/Csp.schema.ts`, and finally `Graph/Graph.edge.ts` + `Graph/Graph.encoded.ts` (the last matching the R6-3 GraphNode-family P4 pilot lane already in flight per `sf-1-graphnode.md` in this same reports directory). `git status` confirmed every one of these was mid-edit (uncommitted) by other concurrent lanes at the moment it surfaced — this is a live multi-agent repo with many lanes writing to shared upstream packages simultaneously, not a static regression.

I confirmed this is 100% unrelated to this lane's diff twice: temporarily `git stash`-ing the currently-broken sibling file(s) (never this lane's files) and rerunning `tsc -b` / `bun run beep:check` from `packages/drivers/nlp-mcp` came back **clean, 0 errors** both times, before restoring each stash exactly. This lane's own file is fenced-compliant (only `packages/drivers/nlp-mcp/src/StreamingTools.ts` and its test were touched); the build/check failure is the documented "daemon/concurrent-lane contention → spurious failures" scenario from `SPEC.md`, not a defect here.

## Follow-up: driver regen — @example on the 15 companion type aliases (jsdoc ratchet)

Driver flagged that the 15 `export type XOptions = typeof XOptions.Type` companion aliases I added had `@since`/`@category` but no `@example`, per `.patterns/jsdoc-documentation.md` ("`@example` is still universal for exported symbols... type-only helpers... need examples too"; for type-only exports, "named aliases, assignability or `satisfies` checks... or comments that show inferred types" count as evidence).

Added one compiling `@example` per alias — an assignability check (a representative object literal typed as the alias, then a `console.log` of one field), e.g.:

```ts
/**
 * @example
 * ```ts
 * import type { ReadLinesOptions } from "@beep/nlp-mcp/StreamingTools"
 *
 * const windowed: ReadLinesOptions = { maxLines: 10, trim: true }
 * console.log(windowed.maxLines)
 * ```
 */
export type ReadLinesOptions = typeof ReadLinesOptions.Type;
```

All 15 use `import type` (the alias is only ever used in a type position in the example) and a distinct representative field per tool (`TextStatsOptions` → `trim`, `ValidateJsonlOptions` → `maxErrors`, `LoadTextOptions` → `encoding`, etc.).

**Verify**: `npx tsgo -p tsconfig.test.json --noEmit` — clean; `npx tsgo -b tsconfig.json` — clean; `bun run docgen` — **112 examples found** (up from 97, exactly +15), all typechecked with zero failures; `vitest run` unit 14/14 and integration 20/20 unchanged. Not committed.

## Summary (≤10 lines)

All 15 SF-1 `@beep/nlp-mcp` schema-first exceptions fixed: each inline `S.Struct` in a tool `Parameters.options` field extracted into a named, exported, JSDoc'd `S.Class` (`ReadLinesOptions`, `TextStatsOptions`, ... `CountJsonlOptions`), matching RC-SF move #3. No ripple — these classes were never referenced outside `StreamingTools.ts`. Kept each tool's options shape all-optional/no-default (unlike the richly-defaulted sibling classes in `Streaming/*.ts`) to preserve the exact wire contract; added 2 new tests (15 `S.toArbitrary` round-trip laws + byte-identical encode snapshots) proving §5.3 parity. Follow-up: added a compiling `@example` (assignability check) to each of the 15 companion type aliases per driver regen feedback — docgen examples 97 → 112, zero failures. Package-scoped `tsgo -b` (x3), `tsgo -p tsconfig.test.json` (x2), `vitest run` unit (14/14) and integration (20/20, unmodified), `biome check` (18 files) are all clean. Repo-wide `turbo ... --filter=@beep/nlp-mcp` is red only via transitive sibling packages currently mid-edit by other concurrent lanes (confirmed unrelated via stash test); this package's own build is clean in isolation. Not committed, per instructions.

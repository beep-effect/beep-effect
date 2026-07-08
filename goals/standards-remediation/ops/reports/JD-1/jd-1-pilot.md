# JD-1 pilot lane — throughput calibration for `@beep/md` + `@beep/govinfo`

Wave: `JD-1`, lane: `jd-1-pilot`. Two packages processed strictly sequentially
(one writer per package at a time, each fully verified before the next
opened). No commits made. `standards/jsdoc-documentation.inventory.jsonc`,
other `standards/*.jsonc`, and `ops/progress.json` were never opened for
writing — read only, via a one-time Python `json.load` extraction of the two
packages' `exports[]` slices (the file turned out to be plain JSON, no `//`
comments, so no jsonc-specific tooling was needed).

## 1. `packages/foundation/modeling/md` (`@beep/md`) — 48 findings

Before: `missingExportExamples: 47`, `forbiddenTagFindings: 2`,
`schemaAnnotationFindings: 5` (openExports 48). After (self-verified against
the same 48 repoPath:line coordinates read from the inventory; driver still
owns the authoritative regen): 0.

| File | Findings | Disposition |
|---|---|---|
| `src/Md.behavior.ts` | `SegmentStrategy` interface (missing `@example` + `@template`×1), `segmentInlineRuns` (`@template`×1) | **fixed** — both `@template I`/`@template B` pairs replaced with `@typeParam I`/`@typeParam B`; added a compiling `@example` to `SegmentStrategy` constructing a conforming object literal typed `SegmentStrategy<string, number>`. |
| `src/Md.model.ts` | 46 missing `@example` across 2 schema consts (`CodeFenceLanguage`, `YouTubeVideoId`), 2 type aliases (`CodeFenceLanguage`, `HeadingLevel`), 2 union type+namespace pairs (`Inline`, `Block`), 18 `TaggedClass` companion namespaces (`Text`, `RawMarkdown`, `RawHtml`, `Strong`, `Em`, `Del`, `Code`, `A`, `Img`, `Br`, `P`, `Heading`, `Li`, `Ul`, `Ol`, `TaskItem`, `TaskList`, `BlockQuote`, `Pre`, `TableCell`, `TableRow`, `Table`, `YouTube`, `Hr`, `Document`), plus 5 array/suspend schemas (`InlineChildren`, `BlockChildren`, `ListItemChild`, `ListItemChildren`, `ListChildren`, `TaskItemChildren`) each needing both a const example and a namespace example; 5 `schemaAnnotationGaps` (`missing-schema-runtime-type-alias` on `InlineChildren`, `BlockChildren`, `ListItemChildren`, `ListChildren`, `TaskItemChildren`) | **fixed** — every companion namespace got a `@example` showing a typed `X.Type` construction via the class's own `.make(...)` (or a decode for non-class schemas); every missing runtime type alias added as `export type X = typeof X.Type` (mirrors the pre-existing `Inline`/`Block` pattern already in the same file) with its own `@example`. |

**Per-symbol recipe discovered** (generalizes to every `S.TaggedClass` +
"Companion namespace for `{@link X}`" file in the repo):
1. Companion namespace missing `@example` → add one importing the *value*
   symbol and typing the constructed instance as `X.Type` (or `X.Encoded`
   where relevant): `const node: X.Type = X.make({...}); console.log(node.field)`.
2. `missing-schema-runtime-type-alias` on an array/union/suspend schema that
   already has a companion `namespace X { export type Type; export type Encoded }`
   → the fix is **not** to touch the namespace; add a sibling
   `export type X = typeof X.Type` between the const and the namespace (TS
   allows const + type + namespace merging when the namespace exports only
   types — confirmed pre-existing in the same file for `Inline`/`Block`
   before this pass, and now for the 5 newly-fixed schemas).
3. **Trap actually hit and self-caught**: writing `X.Type` inside the
   namespace's *own* doc example only compiles if the namespace itself
   declares a `Type` member. Several `@beep/govinfo` namespaces are
   `Encoded`-only (`// Companion namespace for {@link X} encoded helpers`) —
   `X.Type` there is a hard compile error (`Namespace 'X' has no exported
   member 'Type'`). The fix is to reference the sibling top-level type alias
   (`X` itself, or an aliased import `import type { X as XValue }`) instead of
   the namespace-qualified `X.Type`. Caught via `turbo run docgen` failing on
   first attempt for `Sort`/`Failure`, fixed before the final green run — no
   bad state landed.
4. `@template` → `@typeParam` is a pure token swap; only needs a compiling
   `@example` added alongside if the symbol was also missing one.

Verify: `turbo run docgen --filter=@beep/md` — 176 examples found and
typechecked, zero errors. `npx tsgo -b` clean (no output). `npx vitest run` —
16/16 passed. `bunx biome check packages/foundation/modeling/md` — checked 14
files, no issues.

## 2. `packages/drivers/govinfo` (`@beep/govinfo`) — 16 findings

Before: `missingExportExamples: 14`, `unsafeExampleFindings: 1`,
`schemaAnnotationFindings: 1` (openExports 17, one entry double-counted across
missing-example + schema-gap on `Sort`). After: 0.

| File | Findings | Disposition |
|---|---|---|
| `src/Govinfo.service.ts` | `GovinfoShape` — `no-type-assertions-in-examples` | **fixed, not deleted** — replaced `console.log({} as { search: Search })` with a real conforming object literal (`const shape: GovinfoShape = { rateLimit: Effect.succeed(O.some(RateLimitSnapshot.make(...))), search: () => Effect.die(...) }`) plus `Effect.runSync(shape.rateLimit)`; zero assertions, zero `any`. |
| `src/domain/contracts/Search/Search.contract.ts` | `Failure` namespace missing `@example` | **fixed** — reused the sibling top-level `Failure["_tag"]` indexed-access pattern already used by the type alias's own example (namespace only exports `Encoded`, so `Failure.Type` would not resolve — see recipe item 3 above). |
| 9 `domain/values/*/*.model.ts` files (`CollectionContainer`, `CollectionSummary`, `GranuleContainer`, `GranuleMetadata`, `PackageInfo`, `SearchBody`, `SearchResponse`, `SearchResult`, `SummaryItem`) | each: companion namespace missing `@example` | **fixed** — decode-based example on each outer "Companion namespace for `{@link X}` encoded helpers" block, reusing the class's own doc-comment fixture data. |
| `src/domain/values/Sort/Sort.model.ts` | `SortBase`/`SortASC`/`SortDESC` namespaces missing `@example`; `Sort` const missing runtime type alias; `Sort` namespace missing `@example` | **fixed** — 3 namespace examples added; `export type Sort = typeof Sort.Type` added between the const and the namespace; the namespace's own example uses an aliased import (`Sort as SortValue`) rather than `Sort.Type`, per recipe item 3. |

Verify: `turbo run docgen --filter=@beep/govinfo` — 71 examples found and
typechecked, zero errors. `npx tsgo -b` clean (no output). `npx vitest run` —
5/5 passed. `bunx biome check packages/drivers/govinfo` — checked 38 files, no
issues.

## Throughput calibration

- `@beep/md` was the first package in the lane, so its wall time bundles
  one-time reconnaissance that will not recur: reading `SPEC.md`'s RC-JSDOC
  card, `.patterns/jsdoc-documentation.md` in full, the
  `jsdoc-annotation-specialist` skill + `annotation-patterns.md`, and — most
  importantly — establishing via repo grep (`Type for {@link`, `Companion
  namespace for`) that the const+type+namespace declaration-merge pattern and
  the "type-level evidence" `@example` convention are load-bearing repo
  precedent, not something to invent per-file. That recipe is now written
  above and directly reusable.
- Steady-state signal (post-recipe): `@beep/govinfo`'s 16 findings across 9
  files — including discovering and fixing the namespace-`Type`-vs-alias trap
  mid-flight — went from first file read to a fully green 4-command verify
  gate in **~5 minutes** of wall-clock tool execution (docgen cache-miss runs
  timestamped `02:07:34` for `@beep/md`'s finish and `02:12:47` for
  `@beep/govinfo`'s finish). That is a rate on the order of **~190
  findings/hour** once the recipe is in hand, for packages in this
  "TaggedClass + companion namespace" shape (the dominant shape in this repo's
  domain/value-object packages, based on the identical `Companion namespace
  for {@link X} encoded helpers` boilerplate seen across all 9 `govinfo`
  value files).
- Caveat: this rate assumes the target package's existing examples already
  establish local fixture data (field names, valid sample values) that the
  new namespace/type-alias examples can reuse verbatim — true for both
  packages here since every class/const already had its own `@example` before
  this pass (only the *namespace* siblings and 2 forbidden tags were missing).
  A package where the base symbols themselves lack examples (the common case
  for the remaining ~1,200) will run slower per finding, since each needs
  fixture data invented from scratch and cross-checked against the schema
  shape, not just copy-adapted from a sibling doc block.
- No repeatable automation opportunity found beyond the recipe itself — every
  fix required reading the actual field names/types to build a compiling
  example; this is not mechanically scriptable without an LLM in the loop.

Files touched (14 total, no commits):
`packages/foundation/modeling/md/src/Md.behavior.ts`,
`packages/foundation/modeling/md/src/Md.model.ts`,
`packages/drivers/govinfo/src/Govinfo.service.ts`,
`packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts`,
`packages/drivers/govinfo/src/domain/values/{CollectionContainer,CollectionSummary,GranuleContainer,GranuleMetadata,PackageInfo,SearchBody,SearchResponse,SearchResult,Sort,SummaryItem}/*.model.ts`.

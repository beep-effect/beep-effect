# AL-1a — effect-laws allowlist challenge batch

Wave: AL-1a (P7 allowlist challenge) · Cluster: `AL-1a-nonconflicting`
Slice: `goals/standards-remediation/ops/slices/AL-1a.json`
Six entries, five packages/scripts, processed strictly sequentially.
`ui-system/ui` entry skipped (owned by another lane) and never touched.

No edit to `standards/effect-laws.allowlist.jsonc` was made (driver-owned).
No commits made.

## Disposition table

| issue | file | kind | disposition | evidence |
|---|---|---|---|---|
| `CHALK-WEAKMAP-MEMOIZATION` | `packages/foundation/capability/chalk/src/internal/ChalkRuntime.ts:114` | new-map-set | **unconvertible** | `Chalk`/`ChalkStderr` are public constructors (`internal/PublicSurface.ts:227-238`, `new Chalk(options)` → `create(options)` → `createBuilder(...)`) any downstream consumer can invoke an unbounded number of times; each call plus every subsequent style-chain access (`.red`, `.bold`, …) allocates a new `ChalkFunction` builder keyed into `builderMetaMap` by identity. Attempted swap to `MutableHashMap` (diff below, reverted): `npx tsgo -b` exit 0, `npx vitest run` 16/16 pass — neither catches the regression because neither exercises retention. Heap-growth micro-benchmark reproducing the exact module-scope-store/per-instance-key shape (200,000 discarded instances + forced GC): WeakMap-backed store retained **1.01 MB** above baseline; a strong-Map-backed store (structurally equivalent to `MutableHashMap`/`HashMap`, which hold plain strong references) retained **48.21 MB** and all 200,000 entries. Effect v4's own internals independently confirm no native alternative exists: `effect/Hash.ts:527-529` (`randomHashCache`, `hashCache`, `visitedObjects`) and `effect/MutableHashMap.ts:295` (`referentialKeysCache`) all fall back to native `WeakMap`/`WeakSet` for the identical "cache-by-identity-without-retention" problem. |
| `WINK-SIMILARITY-NATIVE-SET-BRIDGE` | `packages/drivers/wink/src/WinkSimilarity.service.ts:86` | new-map-set | **unconvertible** | Read the real shipped dependency: `node_modules/wink-nlp/utilities/similarity.js:108-133` — `similarity.set.tversky` reads `setA.size`/`setB.size` as bare properties and calls `.has()`/`.forEach()` as instance methods. Neither `HashSet` nor `MutableHashSet` (effect v4) expose `.size`/`.has`/`.forEach` as instance members (only as free functions `HashSet.size(self)`, `HashSet.has(self, v)`; there is no `.forEach` at all). Attempted conversion to `MutableHashSet.fromIterable` (diff below, reverted): compile failure `TS2740: Type 'MutableHashSet<string>' is missing the following properties from type 'Set<string>': add, clear, delete, forEach, and 6 more`. Runtime proof against the real wink-nlp module with an effect-shaped stand-in reproducing HashSet/MutableHashSet's actual instance surface: `TypeError: setB.forEach is not a function`. |
| `ECFR-OPENAPI-GENERATOR-NATIVE-COLLECTIONS` | `packages/drivers/ecfr/scripts/generate.ts` | object-method | **fixed** | `Object.values`/`Object.entries`/`Object.keys` (5 call sites: `refsOf`, `renderModel`, `operationsOf` ×2, `main`) → `R.values`/`R.toEntries`/`R.keys` (`effect/Record`). |
| `ECFR-OPENAPI-GENERATOR-NATIVE-COLLECTIONS` | `packages/drivers/ecfr/scripts/generate.ts` | new-map-set | **fixed** | `visited`/`required` native `Set` (topo-sort cycle guard + required-field lookup) → `MutableHashSet`; `[...new Set(refsOf(...))].sort()` dedup → `A.dedupe(...).sort()`. Direct precedent: `packages/drivers/box/scripts/generate.ts` already uses this exact pattern (`MutableHashSet.empty`/`.has`/`.add` for visited/visiting cycle guards, `A.dedupe` for schema dedup) cleanly. |
| `RDF-SCHEMA-METADATA-WEAKSET-TRAVERSAL` | `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:399` | new-map-set | **unconvertible** — but recorded reason is wrong; see note | The recorded reason ("needs weak-key semantics to avoid retaining visited schema nodes") is **false**: `visited` is a brand-new `WeakSet` created fresh per top-level call (`getSemanticSchemaMetadata`, line 465) and never persisted anywhere — nothing is retained either way. The real, verified constraint is different: `effect/Equal.ts`'s `compareObjects` (lines 332-346) shows Effect's default equality for plain objects/AST nodes implementing neither `Equal` nor `Hash` is **deep structural comparison**, not reference identity — so `HashSet`/`MutableHashSet` would silently swap this traversal's O(1) identity-based cycle guard for an O(subtree-size) structural-hash guard. Attempted conversion (diff below, reverted): `npx tsgo -b` exit 0, `npx vitest run` 29/29 pass (existing tests don't exercise this). Targeted micro-benchmark reproducing the exact traversal shape (linear wrapper chain, `visited.has`/`.add` at every node) at depths 200/500/1000/2000: MutableHashSet took 8.8x / 2.7x / 11.7x / 31.1x longer than WeakSet, consistent with the predicted O(n) → O(n²)-ish blowup. Corroborated by `effect/Hash.ts:527-529`'s own reliance on native `WeakMap`/`WeakSet` to hash arbitrary/possibly-cyclic object graphs safely — the same class of problem this function solves. **Recommend the driver rewrite the entry's `reason` text** to the structural-equality/complexity argument above rather than the GC-retention claim, which does not hold. |
| `PROFESSIONAL-DESKTOP-BUILD-SIDECAR-TRIPLE-INVARIANT` | `apps/professional-desktop/scripts/build-sidecar.ts:16` | native-error | **fixed** | `throw new Error(...)` → `throw new MissingTargetTripleError({...})`, a `Data.TaggedError`. Direct in-directory precedent: the sibling script `apps/professional-desktop/scripts/sync-migration-bundle.ts:15-18,84` already throws a `Data.TaggedError` instance from plain synchronous code (not wrapped in a full Effect runtime) for the identical class of "abort a one-shot Bun build script" case, refuting the recorded "matching build-tool failure conventions rather than Effect runtime error flow" justification. Verified end-to-end, not just type-checked: real run compiled the actual sidecar binary and printed the unchanged success message; a simulated-failure run (shimmed `rustc` on `PATH` to omit the `host:` line) reproduced the same uncaught-exception → non-zero-exit (code 1) behavior as the original `Error`, since `Data.TaggedError` instances are real `Error` subclasses (`Cause.YieldableError`). |

## Attempted-conversion diffs (unconvertible entries — reverted, not applied)

**Chalk** (`packages/foundation/capability/chalk/src/internal/ChalkRuntime.ts`):
```diff
+import * as MutableHashMap from "effect/MutableHashMap";
-const builderMetaMap = new WeakMap<ChalkFunction, BuilderMeta>();
+const builderMetaMap = MutableHashMap.empty<ChalkFunction, BuilderMeta>();
-const getBuilderMeta = (builder: ChalkFunction): BuilderMeta => {
-  const meta = builderMetaMap.get(builder);
-  if (P.isUndefined(meta)) { throw MissingBuilderMetadataError.make({ message: "..." }); }
-  return meta;
-};
+const getBuilderMeta = (builder: ChalkFunction): BuilderMeta =>
+  pipe(builderMetaMap, MutableHashMap.get(builder), O.getOrElse(() => { throw MissingBuilderMetadataError.make({ message: "..." }); }));
-  builderMetaMap.set(builder, { isEmpty, state, styler });
+  MutableHashMap.set(builderMetaMap, builder, { isEmpty, state, styler });
```
Compiles + passes tests; rejected on the heap-growth evidence above.

**Wink** (`packages/drivers/wink/src/WinkSimilarity.service.ts`):
```diff
+import * as MutableHashSet from "effect/MutableHashSet";
-const toNativeTermSet = (terms: ReadonlyArray<string>): Set<string> => new Set(terms);
+const toNativeTermSet = (terms: ReadonlyArray<string>) => MutableHashSet.fromIterable(terms);
```
Fails to compile: `TS2740`.

**RDF** (`packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts`):
```diff
+import * as MutableHashSet from "effect/MutableHashSet";
-const findSemanticSchemaMetadata = (value: unknown, visited: WeakSet<object>): ... => {
+const findSemanticSchemaMetadata = (value: unknown, visited: MutableHashSet.MutableHashSet<object>): ... => {
   ...
-  if (visited.has(value)) return;
-  visited.add(value);
+  if (MutableHashSet.has(visited, value)) return;
+  MutableHashSet.add(visited, value);
   ...
-O.orElse(() => O.fromNullishOr(findSemanticSchemaMetadata(schema.ast, new WeakSet())))
+O.orElse(() => O.fromNullishOr(findSemanticSchemaMetadata(schema.ast, MutableHashSet.empty())))
```
Compiles + passes tests; rejected on the measured superlinear slowdown above.

## Fixed-entry diffs (applied in the working tree, not reverted)

`packages/drivers/ecfr/scripts/generate.ts` (74-line diff; full file re-read and re-verified after edit):
- Added `import * as A from "effect/Array"; import * as MutableHashSet from "effect/MutableHashSet"; import * as R from "effect/Record";`
- `refsOf`: `Object.values(schema.properties)` → `R.values(schema.properties)`
- `topoSort`: `Object.keys(definitions).sort()` → `R.keys(definitions).sort()`; `visited = new Set<string>()` → `MutableHashSet.empty<string>()`; `.has`/`.add` → `MutableHashSet.has`/`MutableHashSet.add`; `[...new Set(refsOf(...))].sort()` → `A.dedupe(refsOf(...)).sort()`
- `renderModel`: `required = new Set(schema.required ?? [])` → `MutableHashSet.fromIterable(...)`; `Object.entries(schema.properties ?? {})` → `R.toEntries(...)`; `required.has(key)` → `MutableHashSet.has(required, key)`
- `operationsOf`: both `Object.entries` calls → `R.toEntries`
- `main`: `Object.keys(spec.definitions).length` → `R.keys(spec.definitions).length`

`apps/professional-desktop/scripts/build-sidecar.ts` (7-line diff):
```diff
 import { $ } from "bun";
+import { Data } from "effect";
+
+class MissingTargetTripleError extends Data.TaggedError("MissingTargetTripleError")<{
+  readonly message: string;
+}> {}

 const triple = (await $`rustc -vV`.text()).match(/host: (\S+)/)?.[1];
 if (triple === undefined) {
-  throw new Error("could not determine the target triple from `rustc -vV`");
+  throw new MissingTargetTripleError({
+    message: "could not determine the target triple from `rustc -vV`",
+  });
 }
```

## Commands run + outcomes

- `packages/foundation/capability/chalk`: `npx tsgo -b` (0 errors), `npx vitest run` (16/16 pass), `bunx biome check .` (clean) — baseline, unchanged.
- `packages/drivers/wink`: `npx tsgo -b` (0 errors), `npx vitest run` (45/45 pass, 9 files), `bunx biome check .` (clean) — baseline, unchanged.
- `packages/drivers/ecfr`: `npx tsgo -b` (0 errors), `npx vitest run` (3/3 pass), `bunx biome check .` (clean); `bun run generate` re-run — generated `src/_generated/Ecfr.generated.ts` is **byte-identical** to the pre-change version (confirmed via `diff`, exit 0) — the conversion is fully behavior-preserving; `git status` shows only `scripts/generate.ts` modified.
- `packages/foundation/modeling/rdf`: `npx tsgo -b` (0 errors), `npx vitest run` (29/29 pass, 2 files), `bunx biome check .` (clean) — baseline, unchanged.
- `apps/professional-desktop`: `npx tsgo -b` (0 errors); `bun run scripts/build-sidecar.ts` real run — compiled `src-tauri/binaries/sidecar-x86_64-unknown-linux-gnu`, printed `sidecar compiled → ...`, exit 0; simulated-failure run with a `rustc` PATH shim lacking a `host:` line — threw `MissingTargetTripleError`, Bun printed the error and `_tag`, exit 1 (same observable behavior as the original `Error`); `npx vitest run --exclude='test/integration/**'` (26/26 pass, 4 files); `bunx biome check scripts/build-sidecar.ts` (clean).

## Files touched (left in working tree, uncommitted)

- `packages/drivers/ecfr/scripts/generate.ts` (fixed)
- `apps/professional-desktop/scripts/build-sidecar.ts` (fixed)

Not touched (conversion attempted, reverted, original restored — confirmed via `git status --short` showing no diff):
- `packages/foundation/capability/chalk/src/internal/ChalkRuntime.ts`
- `packages/drivers/wink/src/WinkSimilarity.service.ts`
- `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts`

`standards/effect-laws.allowlist.jsonc` not touched (driver-owned). No repo-wide `turbo`/`yeet`/inventory regen run. No commits made.

## For the driver

Removable from the allowlist now: both `ECFR-OPENAPI-GENERATOR-NATIVE-COLLECTIONS` rows and `PROFESSIONAL-DESKTOP-BUILD-SIDECAR-TRIPLE-INVARIANT`.

Stay on the allowlist (evidence above holds up under attempted-conversion + measurement): `CHALK-WEAKMAP-MEMOIZATION`, `WINK-SIMILARITY-NATIVE-SET-BRIDGE`, `RDF-SCHEMA-METADATA-WEAKSET-TRAVERSAL` — but the RDF entry's `reason` text is factually wrong (claims GC-retention that cannot occur for a function-scoped, freshly-allocated-per-call `WeakSet`) and should be rewritten to the structural-equality/complexity argument in the table above.

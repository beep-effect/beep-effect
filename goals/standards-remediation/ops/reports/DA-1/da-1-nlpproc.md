# DA-1 — @beep/nlp-processing (+ @beep/wink sweep) dual-arity fixes

Lane: `da-1-nlpproc`. Writer scope: `packages/foundation/capability/nlp-processing`
plus driver-granted extension `packages/drivers/wink` (for the `addChildren`
cross-package call-site sweep pre-authorized by R12 / `p2-d5d8.md`, and wink's
own `textLengthAttribute` candidate).

## Disposition table

| # | qualifiedName | file:line | diagnostics | disposition | reason / evidence |
|---|---|---|---|---|---|
| 1 | `filterByPOSTag` | `nlp-processing/src/Graph/AnnotatedTextGraph.ts:741` | invalid-dual-source | **fixed** | `dual` was imported from `@beep/utils` (a re-export of `effect/Function`'s `dual`, confirmed identical at `packages/foundation/modeling/utils/src/index.ts:14`); switched to `import { dual } from "effect/Function"` directly. No signature/behavior change. |
| 2 | `filterEntitiesByType` | `nlp-processing/src/Graph/AnnotatedTextGraph.ts:716` | invalid-dual-source | **fixed** | Same import fix as #1 (shared import statement, one edit covers both). |
| 3 | `makeOperationResult` | `nlp-processing/src/Graph/GraphOperations/Types.ts:748` | too-many-positional-params, invalid-dual-arity | **fixed** | 5-param `dual(5,…)` collapsed to `dual(2, (executionId, options) => …)` with new `MakeOperationResultOptions<B,E>` (`originalGraph`/`newNodes`/`errors`/`metrics`). `executionId` kept as the pipeable first param (matches P2 audit's attempted+verified conversion at `ops/reports/P2-audits/p2-d5d8.md` row 2). Swept both real call sites (`Executor.ts:288`, `Executor.ts:435`) + 1 test call site (`test/Graph/GraphOperations.test.ts:166`) + the `@example` doc block. |
| 4 | `addChildren` | `nlp-processing/src/Graph/TextGraph.ts:275` | too-many-positional-params, invalid-dual-arity | **fixed** | 4-param `dual(4,…)` collapsed to `dual(2, (graph, options) => …)` with new `AddChildrenOptions` (`parentIndex`/`children`/`relation`); `graph` kept as pipeable subject. Pre-authorized by locked ruling R12 (`p2-d5d8.md` row 3: "convertible (cross-package ripple)"). Swept the `@example` doc block plus all 3 real cross-package call sites in `packages/drivers/wink/test/Graph/TextGraph.test.ts` (lines 43, 82, 94). |
| 5 | `recordNlpBackendFallback` | `nlp-processing/src/internal/observability.ts:207` | missing-dual | **fixed** | Wrapped `dual(2, <E>(cause, attributes) => …)` from `effect/Function` (already imported in this file). `cause` is the pipeable subject; data-first call site unaffected (`Backend/Composition.ts:56`). |
| 6 | `recordNlpCacheLookup` | `nlp-processing/src/internal/observability.ts:176` | missing-dual | **fixed** | Wrapped `dual(2, (hit, attributes) => …)`. `hit: boolean` is the first param; not one of RC-DUAL's excluded shapes (`message`/`options`/`config`/`status`/`severity`), so applied per the aggressive-conversion default. Data-first call site unaffected (`Backend/Composition.ts:75`). |
| 7 | `recordNlpFailure` | `nlp-processing/src/internal/observability.ts:246` | missing-dual | **fixed** | Wrapped `dual(2, <E>(cause, attributes) => …)`, same shape as #5. Data-first call site unaffected (`Tools/ToolExport.ts:319`). |
| 8 | `textLengthAttribute` | `wink/src/WinkObservability.ts:136` | missing-dual | **fixed** (driver-directed reorder) | See below. |

### #8 `textLengthAttribute` — initial detector-bug? flag, driver-challenged and resolved as fix-code

Original shape:

```ts
export const textLengthAttribute = (name: string, text: string): Record<string, string> => ({
  [`${name}_length`]: `${Str.length(text)}`,
});
```

I initially flagged this `detector-bug?`: `dual(n, body)` always makes the
first positional parameter the pipeable subject, and the first param here,
`name`, is a label string (`"text"`, `"query"`, `"document_text"`,
`"text_1"`, `"text_2"`) — structurally the same non-pipeable shape RC-DUAL
carves out. Wrapping as-is would have produced a backwards, unusable curried
form.

**Driver verdict (D-C): challenged, resolved as fix-code.** The driver agreed
the bogus as-is wrap was wrong but identified the honest conversion I hadn't
considered: **reorder** the parameters to `(text: string, name: string)` so
`text` — the real data subject — is first, then wrap with `dual`. This makes
`text.pipe(textLengthAttribute("query"))` a genuinely useful pipeable form
instead of a backwards one. Applied:

```ts
export const textLengthAttribute: {
  (text: string, name: string): Record<string, string>;
  (name: string): (text: string) => Record<string, string>;
} = dual(
  2,
  (text: string, name: string): Record<string, string> => ({
    [`${name}_length`]: `${Str.length(text)}`,
  })
);
```

Swept all 25 real call sites (mechanical `(label, value)` → `(value, label)`
argument swap, all within the already-granted `@beep/wink` scope) plus the
`@example` doc block:

- `WinkTools.service.ts` — 18 call sites (`Analyze`, `BagOfWords`,
  `BowCosineSimilarity`/`PhoneticMatch`/`TextSimilarity`/`TverskySimilarity`
  via `textPairLengthAttributes`, `ChunkBySentences`, `DocumentStats`,
  `ExtractEntities`, `ExtractKeywords`, `NGrams`, `Paragraphize`,
  `QueryCorpus`, `RankByRelevance`, `RemoveStopWords`, `Sentences`, `Stem`,
  `Tokenize`, `TransformText`, `WordCount`)
- `WinkUtils.service.ts` — 3 call sites (`runString`, `runNGrams`, `sentences`)
- `WinkTokenization.service.ts` — 4 call sites (`document`, `sentences`,
  `tokenCount`, `tokenize`)
- `WinkCorpus.service.ts` — 2 call sites (`readNormalizedTokensFromWink`,
  `query`)
- `Wink.service.ts` — 3 call sites (`getWinkDoc`, `getWinkTokens`,
  `getWinkTokenCount`)

Post-sweep full-repo grep (`rg 'textLengthAttribute\("[^"]+",\s*[a-zA-Z]'`)
confirms zero remaining literal-first call sites, and a repo-wide grep
excluding `packages/drivers/wink` confirms no consumer outside the package.

## Files touched

- `packages/foundation/capability/nlp-processing/src/Graph/AnnotatedTextGraph.ts`
- `packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Types.ts`
- `packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Executor.ts`
- `packages/foundation/capability/nlp-processing/src/Graph/TextGraph.ts`
- `packages/foundation/capability/nlp-processing/src/internal/observability.ts`
- `packages/foundation/capability/nlp-processing/test/Graph/GraphOperations.test.ts`
- `packages/drivers/wink/test/Graph/TextGraph.test.ts`
- `packages/drivers/wink/src/WinkObservability.ts` (definition + doc example)
- `packages/drivers/wink/src/WinkTools.service.ts` (18 call sites)
- `packages/drivers/wink/src/WinkUtils.service.ts` (3 call sites)
- `packages/drivers/wink/src/WinkTokenization.service.ts` (4 call sites)
- `packages/drivers/wink/src/WinkCorpus.service.ts` (2 call sites)
- `packages/drivers/wink/src/Wink.service.ts` (3 call sites)

No edits to `standards/*.jsonc`, inventories, or any file outside the two
packages named in this lane's scope.

## Commands run

| Command | Where | Outcome |
|---|---|---|
| `npx tsgo -b tsconfig.json` | `packages/foundation/capability/nlp-processing` | 0 errors |
| `npx tsgo -b tsconfig.json` | `packages/drivers/wink` | 0 errors (re-run after `textLengthAttribute` reorder sweep) |
| `npx tsgo -p tsconfig.test.json --noEmit` | `packages/drivers/wink` | 0 errors (re-run after `textLengthAttribute` reorder sweep) |
| `npx vitest run` | `packages/foundation/capability/nlp-processing` | **68/68 tests pass** (7 files) |
| `npx vitest run --passWithNoTests --exclude='test/integration/**'` | `packages/drivers/wink` | **45/45 tests pass** (9 files) — run twice: once after the `addChildren`/observability lane, once after the `textLengthAttribute` reorder sweep |
| `rg 'textLengthAttribute\("[^"]+",\s*[a-zA-Z]' packages/drivers/wink/src` | repo root | empty (no literal-first call sites remain) |
| `rg "textLengthAttribute" --glob '!packages/drivers/wink/**' ...` | repo root | empty (no consumers outside `@beep/wink`) |

No repo-wide `turbo`, no `yeet`, no inventory regen run from this lane. No
commits made (driver owns commits).

## Follow-up: schema-first findings on the two new options types

After the strengthened schema-first detector went live, two exported options
types this lane introduced surfaced as new findings — both single-consumer
options bags with no external reference (confirmed via
`rg "AddChildrenOptions|MakeOperationResultOptions"` before touching
anything: only the two definition sites, zero call-site imports):

- `AddChildrenOptions` (`TextGraph.ts`) — pure-data candidate.
- `MakeOperationResultOptions<B, E>` (`GraphOperations/Types.ts`) — new
  generic exception entry.

Driver instruction: inline the literal type directly into both dual overload
signatures and the destructured implementation parameter, deleting the
exported alias — no exported alias means no inventory entry, matching how
the utils lane handled `slice`'s options shape
(`packages/foundation/modeling/utils/src/Array.ts:349-354`, which repeats
`{ readonly start?: number; readonly end?: number }` inline in both overloads
and the impl rather than naming it).

Applied to both:

- `addChildren`'s two overloads and its `dual` implementation now each spell
  out `{ readonly parentIndex: Graph.NodeIndex; readonly children:
  ReadonlyArray<TextNode>; readonly relation: TextEdge["relation"] }` inline;
  the `export interface AddChildrenOptions { ... }` block (with its JSDoc)
  is deleted.
- `makeOperationResult`'s two overloads and its `dual` implementation now
  each spell out `{ readonly originalGraph: unknown; readonly newNodes:
  ReadonlyArray<GraphNode<B>>; readonly errors: ReadonlyArray<E>; readonly
  metrics: ExecutionMetrics }` inline (kept generic over `<B, E>`); the
  `export interface MakeOperationResultOptions<B, E> { ... }` block (with its
  JSDoc) is deleted.

No call-site sweep was needed: every call site (`Executor.ts` ×2,
`test/Graph/GraphOperations.test.ts`, `test/Graph/TextGraph.test.ts` in
`@beep/wink` ×3, and both `@example` doc blocks) already passed a plain
object literal matching the shape structurally — none imported or referenced
the type alias by name, so deleting the alias changes nothing at any call
site.

Re-verified after inlining:

| Command | Where | Outcome |
|---|---|---|
| `npx tsgo -b tsconfig.json` | `packages/foundation/capability/nlp-processing` | 0 errors |
| `npx tsgo -b tsconfig.json` | `packages/drivers/wink` | 0 errors |
| `npx tsgo -p tsconfig.test.json --noEmit` | `packages/drivers/wink` | 0 errors |
| `npx vitest run` | `packages/foundation/capability/nlp-processing` | **68/68 tests pass** (7 files) |
| `npx vitest run --passWithNoTests --exclude='test/integration/**'` | `packages/drivers/wink` | **45/45 tests pass** (9 files) |
| `rg "AddChildrenOptions\|MakeOperationResultOptions"` | repo root | empty (both aliases fully removed) |

No commits made.

## Summary

8/8 entries fixed. 2 import-source fixes (`filterByPOSTag`,
`filterEntitiesByType`), 2 options-object arity collapses
(`makeOperationResult`, `addChildren` — the latter's cross-package
`@beep/wink` call sites swept per the R12 locked ruling), 3 missing-dual
wraps (`recordNlpBackendFallback`, `recordNlpCacheLookup`, `recordNlpFailure`)
with zero call-site changes needed (all real usage stays data-first), and 1
entry (`textLengthAttribute` in `@beep/wink`) initially flagged
`detector-bug?` for a bogus as-is wrap, then driver-challenged (D-C) and
resolved as fix-code via a parameter reorder (`text` first, `name` second)
plus `dual(2, ...)`, with all 25 real call sites across 5 files swept to the
new argument order. Both packages typecheck clean (`tsgo -b`, plus wink's
`tsconfig.test.json`) and all tests pass (68/68 nlp-processing, 45/45 wink).
No ripples beyond the two authorized packages, no fences touched, no commits
made.

**Follow-up:** the two options types this lane introduced (`AddChildrenOptions`,
`MakeOperationResultOptions<B, E>`) were inlined directly into their `dual`
overload signatures and implementation params, and the exported aliases were
deleted, per driver instruction to match the utils lane's `slice`-options
precedent — no exported alias means no schema-first inventory entry. No
call sites needed changes (none referenced the aliases by name). Re-verified
green in both packages after the inline.

# DA-1 batch lane — small-package dual-arity remediation

Wave: `DA-1`, lane: `da-1-batch`. Eight packages processed strictly sequentially
(one writer per package at a time, each fully verified before the next
opened). No commits made — driver owns commits per SPEC. `standards/*.jsonc`,
inventories, and `ops/progress.json` were never opened.

## 1. `packages/foundation/capability/observability` (1 entry)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `observeHttpApiHandler` | `src/server/HttpApiTelemetry.ts:716` (pre-fix) | D8 recorded exception (legacy 3-arg overload) | **fixed** | Applied the exact P2-audit-verified fix (`goals/standards-remediation/ops/reports/P2-audits/p2-d5d8.md`, attempt #3): deleted the dead legacy 3-arg branch and its 3 now-unused predicate helpers (`isObserveHttpApiHandlerDataFirst`, `isHttpApiHandlerEffect`, and the stray `isObserveHttpApiHandlerOptions` after collapse), collapsed to `dual(2, observeHttpApiHandlerImpl)`. Both real call sites (`test/HttpApiTelemetry.test.ts:50`, `test/fixtures/server-safe.ts:59`) swept to the 2-arg `(effect, options)` form; both `@example` blocks updated to compile against the new signature. |

Files touched: `src/server/HttpApiTelemetry.ts`, `test/HttpApiTelemetry.test.ts`, `test/fixtures/server-safe.ts`.
Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run` 56/56 (15 files); `turbo run build check test docgen --filter=@beep/observability` — 22/22 tasks green, docgen 136 examples typechecked.

## 2. `packages/drivers/box` (2 entries, slice `packages_drivers_box_src.json`)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `decodeWith` | `src/internal/Box.runtime.ts:13` | too-many-positional-params (4) | **fixed** | Collapsed to `(schema, value, options: {method, reason})`, arity 3. Matches P2-audit's independently-verified convertible ruling (`p2-d5d8.md` D5#1). Swept all 6 real call sites (`Box.streaming.ts` ×4, `Box.service.ts` ×2), all same-package. |
| `diagnosticsFor` | `src/internal/Box.runtime.ts:34` | missing-dual (2 params) | **fixed** (was `detector-bug?`, driver verdict-challenge overturned it) | Driver verified `error: BoxError` is the real pipeable subject (same ruling as `@beep/wink`'s `textLengthAttribute`) — reordered to `(error, event)` and wrapped `dual(2, ...)` with both call signatures (`diagnosticsFor(event)` returns `(error) => ...`). Swept the sole call site (`logDriverFailure`, same file); no `@example` block existed to update. |

Files touched: `src/internal/Box.runtime.ts`, `src/Box.streaming.ts`, `src/Box.service.ts`.
Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run` 18/18; `turbo run build check test docgen --filter=@beep/box` — 19/19 tasks green.

## 3. `packages/foundation/modeling/identity` (2 entries)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `prefixedNameOrIri` | `src/PnLocal.ts:339` | missing-dual + third-param-not-object-like (3 params) | **fixed** | Reordered to `(local, options: {prefix, fullIri})` — `local` is the real pipeable subject (tested by `isSafeLocal`, then rendered); `prefix`/`fullIri` bundled into an options object, arity 2, `dual(2, ...)`. Swept the 1 real test call site (`test/PnLocal.test.ts:97`) and 2 doc examples (own `@example` + barrel `src/index.ts:53`). |
| `mergeVocab` | `src/Vocab.ts:426` | missing-dual (2 params) | **fixed** | `base` is the natural pipeable subject, `extension` the argument: `dual(2, mergeVocabImpl)`. Split into a private non-exported `mergeVocabImpl` plus an overloaded exported type using `ReturnType<typeof mergeVocabImpl<Base,Extension>>` per-branch (safe because `mergeVocabImpl` itself has a single, non-overloaded signature — avoids the `ReturnType<typeof self-overloaded-export>` collapse failure mode the P2 audit found for `makeChatOperations`). Literal-type preservation verified directly: `test/Vocab.test.ts`'s `expectTypeOf<Curie<typeof extended>>().toEqualTypeOf<CoreCurie \| "ex:Thing">()` still compiles. One self-caught bug during this fix: my first edit left the JSDoc `@since`/`@example` block above the new private `mergeVocabImpl` instead of the public export, which docgen correctly rejected (`Missing @since tag`) — moved the doc comment back above `export const mergeVocab` and re-verified. |

Files touched: `src/PnLocal.ts`, `src/Vocab.ts`, `src/index.ts`, `test/PnLocal.test.ts`.
Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run` 58/58 (6 files); `turbo run build check test docgen --filter=@beep/identity` — 7/7 tasks green, docgen 156 examples typechecked (after the doc-comment-placement fix).

## 4. `packages/law-practice/domain` (2 entries)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `Span.resolveOriginal` | `src/values/Span/Span.model.ts:128` | missing-dual (2 params) | **fixed** | `span` (the coordinate pair being resolved) is the natural self, `map` the context: `dual(2, (span, map) => ...)`. Zero real call sites outside this file (only the internal call from `Span.fromGroupIndex`, which is data-first and unaffected). |
| `Span.fromGroupIndex` | `src/values/Span/Span.model.ts:89` | missing-dual (3 params) | **fixed** (was `detector-bug?`, driver verdict-challenge overturned it) | Driver confirmed it IS a constructor factory (builds a brand-new `Span`), but it was tagged `@category statics` rather than `@category constructors`, so the detector's `isLegitimateConstructorFactory` exclusion (which requires the `constructors` category) never fired. Retagged `@category constructors` — semantically correct, honors the existing carve-out; no other code changed. |

Files touched: `src/values/Span/Span.model.ts`.
Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run` 14/14; `turbo run build check test docgen --filter=@beep/law-practice-domain` — 31/31 tasks green, docgen 82 examples typechecked.

## 5. `packages/tooling/library/ai-metrics` (2 entries)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `normalizedRelativePath` | `src/internal/transcript-utils.ts:79` | missing-dual + third-param-not-object-like (3 params) | **fixed** | `filePath` is the real pipeable subject; `pathApi`/`root` bundled into an options object, arity 2, `dual(2, ...)`. Swept both real call sites (`src/source-discovery.ts:378`, `src/forwarder.ts:657`), both same-package. Note: `src/retention.ts:145` has an unrelated **local, non-exported, same-named** helper (not imported from `transcript-utils.ts`) — confirmed by import trace and deliberately left untouched to avoid conflating it with the flagged export. |
| `AgentEffectivenessPhoenixSyncInput.new` | `src/agent-effectiveness.ts:1232` | third-param-not-object-like (already `dual(3,...)`, 3rd param `confirmToken?` not object-like) | **blocked: ripple** | Real call sites live outside this package: `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts:505,506` (`@beep/repo-cli`, not `@beep/repo-ai-metrics`). Per the ripple protocol, stopped without editing; driver should re-scope as a 2-package lane. |

Files touched: `src/forwarder.ts`, `src/internal/transcript-utils.ts`, `src/source-discovery.ts`.
Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run` 57/57 (3 files); `turbo run build check test docgen --filter=@beep/repo-ai-metrics` — 28/28 tasks green, docgen 255 examples typechecked.

## 6. `packages/tooling/library/ai-sync` (1 entry)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `AiSyncSourceMetadata.hasSameIdentity` | `src/models.ts:462` | missing-dual (2 params) | **fixed** | Symmetric same-type equivalence check on two `AiSyncSourceMetadata` values — canonical `dual(2, (self, that) => ...)` shape. 1 real call site (`src/drift.ts:110`), same package, already data-first (unaffected). |

Files touched: `src/models.ts`.
Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run` 10/10; `turbo run build check test docgen --filter=@beep/ai-sync` — 19/19 tasks green (including the package's own `ai-sync check` CLI validation), docgen 85 examples typechecked.

## 7. `packages/foundation/capability/mcp-kit` (2 entries)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `projectWithinBudget` | `src/FieldTier.ts:412` (pre-fix) | missing-dual (3 params, 3rd already object-like) | **fixed** | Reordered `(tiers, value, options)` → `(value, tiers, options)` so the payload (`value`) — the real self — is first, then `dual(3, ...)`. Confirmed via full-repo grep that this export has **no** call sites in `@beep/uspto-mcp` (it "deliberately reimplements a bulk variant instead", per the pre-existing crispening S4 finding below) — only the 2 in-package test call sites (`test/FieldTier.test.ts:82,104`) and 1 doc example, all swept. |
| `projectFieldTier` | `src/FieldTier.ts:179` | missing-dual (3 params) | **blocked: ripple** | Real call sites at `packages/drivers/uspto-mcp/src/UsptoDocumentTiers.ts:294,301` — a different package (`@beep/uspto-mcp`). A pre-existing `repo-crispening-orchestration` audit (`goals/repo-crispening-orchestration/ops/inventory/S4/beep__mcp-kit.json`) independently found and declined the identical reorder for exactly this reason ("2 external call sites... cross-package ripple, deferred to family-close sweep"). Left unchanged. |

Files touched: `src/FieldTier.ts`, `test/FieldTier.test.ts`.
Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run` 23/23 (6 files); `turbo run build check test docgen --filter=@beep/mcp-kit` — 19/19 tasks green, docgen 46 examples typechecked. `packages/drivers/uspto-mcp` untouched (confirmed via `git status`).

## 8. `packages/drivers/nlp-mcp` (2 entries, slice `packages_drivers_nlp-mcp_src.json`)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `head` | `src/Streaming/TextStream.ts:402` | missing-dual + third-param-not-object-like (3 params: `filePath, n, options`) | **fixed** | Merged the required `n: number` into the (previously all-optional) `TextReadOptions`-shaped options bag as a required field (`options & {readonly n: number}`), arity 2, `dual(2, ...)`. No real call sites outside the doc example. |
| `tail` | `src/Streaming/TextStream.ts:422` | missing-dual + third-param-not-object-like (3 params) | **fixed** | Same pattern as `head`. Swept the 1 real call site, `src/StreamingHandlers.ts:369` (same package): `TextStream.tail(path, options.tail, readOptions)` → `TextStream.tail(path, { ...readOptions, n: options.tail })`. |

Files touched: `src/Streaming/TextStream.ts`, `src/StreamingHandlers.ts`.
Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run` 32/32 (unit, excludes integration) + `npx vitest run test/integration` 20/20; `turbo run build check test docgen --filter=@beep/nlp-mcp` — 46/46 tasks green, docgen 82 examples typechecked.

## Cross-cutting notes

- Every fix followed the same-package call-site/test/doc-example sweep required by the fixer prompt; no `dtslint/` files referenced any touched symbol in any of the 8 packages (all empty except pre-existing `.gitkeep`s), so none needed updates.
- Two entries surfaced a real pipeable subject in the wrong position relative to the detector's flagged order (`prefixedNameOrIri`, `projectWithinBudget`, `normalizedRelativePath`, `head`/`tail`) — all reordered/restructured rather than dual-wrapped in place, since wrapping the existing order verbatim would have produced a technically-valid-but-useless pipe API.
- Two entries were blocked purely on cross-package ripple (`AgentEffectivenessPhoenixSyncInput.new`, `projectFieldTier`) — both left byte-identical, real consumer lists given above for driver re-scoping.
- No `standards/*.jsonc`, baseline, or inventory file was opened. No commits made.

## Driver verdict-challenge follow-up

The driver's verdict-challenge (D-C) overturned both initial `detector-bug?` calls and directed code fixes, applied in this same session:

- **`diagnosticsFor`** (`packages/drivers/box/src/internal/Box.runtime.ts`): reordered `(event, error)` → `(error, event)` and wrapped `dual(2, ...)`; swept the sole call site in `logDriverFailure`. `npx tsgo -b` clean, `npx vitest run` 18/18, `turbo run build check test docgen --filter=@beep/box` 19/19 tasks green.
- **`Span.fromGroupIndex`** (`packages/law-practice/domain/src/values/Span/Span.model.ts`): retagged `@category statics` → `@category constructors` (no other code changed) so the detector's existing constructor-factory exclusion fires as designed. `npx tsgo -b` clean, `npx vitest run` 14/14, `turbo run docgen --filter=@beep/law-practice-domain` clean (82 examples typechecked).

`git diff --stat` for the two packages after the follow-up:

```
 packages/drivers/box/src/Box.service.ts            |  6 ++-
 packages/drivers/box/src/Box.streaming.ts          | 10 +++--
 packages/drivers/box/src/internal/Box.runtime.ts   | 35 ++++++++++-------
 .../domain/src/values/Span/Span.model.ts           | 45 ++++++++++++++--------
 4 files changed, 62 insertions(+), 34 deletions(-)
```

Final tally for the batch: 12 fixed, 0 `detector-bug?`, 2 `blocked: ripple`. Still no commits made.

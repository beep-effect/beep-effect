# DA-2-B lane — mcp-kit / uspto-mcp / box ripples

Wave: `DA-2`, lane: `da-2-ripples`. Three packages processed strictly
sequentially (one writer, each fully verified before the next opened). No
commits made — driver owns commits per SPEC. `standards/*.jsonc`,
inventories, and `ops/progress.json` were never opened.

## 1. `packages/foundation/capability/mcp-kit` (1 entry, cross-package ripple)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `projectFieldTier` | `src/FieldTier.ts:179` (pre-fix) | missing-dual (3 params) | **fixed** | This was previously `blocked: ripple` in DA-1 (`goals/standards-remediation/ops/reports/DA-1/da-1-batch.md`) because the only real call sites live in a different package (`@beep/uspto-mcp`). DA-2 grants that cross-package scope. Reordered `(tiers, tier, value)` → `(value, tiers, tier)`, mirroring the `projectWithinBudget` reorder already applied in this file (data-first subject `value` leads), and wrapped `dual(3, ...)` with both call signatures (data-first `(value, tiers, tier)`, data-last `(tiers, tier) => (value) => ...`). |

Same-lane sweep for the signature reorder:
- In-package: the 2 internal call sites inside `projectWithinBudget` (`src/FieldTier.ts:431,436`), the `@example` doc block on `projectFieldTier` itself, and the 2 test call sites (`test/FieldTier.test.ts:93,99`).
- Cross-package (granted scope): the 2 real call sites in `packages/drivers/uspto-mcp/src/UsptoDocumentTiers.ts:294,301`.
- No dtslint content existed for either package (`mcp-kit/dtslint` and `uspto-mcp` have no `.tst.ts` files touching this symbol).

Files touched: `packages/foundation/capability/mcp-kit/src/FieldTier.ts`, `packages/foundation/capability/mcp-kit/test/FieldTier.test.ts`, `packages/drivers/uspto-mcp/src/UsptoDocumentTiers.ts`.

Verify: `npx tsgo -b` clean; `npx vitest run` 23/23 (6 files) for `@beep/mcp-kit`; `turbo run build check test docgen --filter=@beep/mcp-kit` — 19/19 tasks green, docgen examples typechecked clean.

## 2. `packages/drivers/uspto-mcp` (consumer of entry #1, no own inventory entries)

No standalone dual-arity entries assigned; this package was in scope only to
absorb the `projectFieldTier` reorder ripple (both real call sites,
`src/UsptoDocumentTiers.ts:294,301`, updated to the new `(row, tiers, tier)`
argument order — same-package usage remains data-first, no signature of its
own changed).

Verify: `npx tsgo -b` clean; `npx vitest run` 10/10 (1 file); `turbo run build check test docgen --filter=@beep/uspto-mcp` — 31/31 tasks green.

## 3. `packages/drivers/box` (1 entry, DA-1 follow-on)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `decodeWith` | `src/internal/Box.runtime.ts:14` | missing-dual (3 params, post-DA-1-collapse) | **fixed** | DA-1 already collapsed this from 4 positional params to 3 (`schema, value, options`) but did not wrap it in `dual`. `schema` is the pipeable subject (first-param, generic `S.ConstraintDecoder<A>`). Wrapped `dual(3, ...)` with both call signatures: data-first `(schema, value, options)`, data-last `(value, options) => (schema) => ...`. Generic `<A>` carried on both the object-type call signature and the `dual` body, matching the repo's `Effect.mapError`-style generic-dual pattern (`.repos/effect-v4/packages/effect/src/Effect.ts:3533`). |

Same-lane sweep: all 6 call sites (`Box.streaming.ts` ×4, `Box.service.ts` ×2)
are already data-first 3-arg calls — verified unchanged and still compiling
under the new `dual(3, ...)`-wrapped type. No dtslint reference to
`decodeWith` (it is package-internal, not part of the public `@beep/box`
surface) and no `@example` block existed to update.

Files touched: `packages/drivers/box/src/internal/Box.runtime.ts`.

Verify: `npx tsgo -b` clean; `npx vitest run` 18/18 (2 files); `turbo run build check test docgen --filter=@beep/box` — 19/19 tasks green.

## 4. Fallow follow-up — `packages/drivers/box` duplication (scope addition, hosted CI round-1 blocker)

Team lead flagged two overlapping introduced clone groups the Fallow audit
gate caught in this package:

| clone group | instances | disposition | reason / evidence |
|---|---|---|---|
| 5-line dup, ×3 | `Box.service.ts:40-44`, `Box.streaming.ts:865-869`, `Box.streaming.ts:891-895` | **fixed** | Shared literal prefix: `Effect.acquireUseRelease(Effect.sync(() => new AbortController()), (controller) => decodeWith(payloadSchema, payload, {method: methodName, reason: "request encoding"}).pipe(Effect.flatMap((decoded...`. |
| 6-line dup, ×2 | `Box.streaming.ts:865-870`, `Box.streaming.ts:891-896` | **fixed** | Overlapping superset of the above (one more line: `Effect.flatMap((decoded) => invoke(decoded, controller.signal))`), present only in the two streaming.ts instances since `Box.service.ts`'s equivalent flatMap wraps a different body (`Effect.tryPromise`). |

Extraction: added `acquireSdkCallController` to `packages/drivers/box/src/internal/Box.runtime.ts` (next to `decodeWith`, which it composes) — a small helper capturing the acquire/decode/flatMap skeleton shared by every cancellable SDK call (`AbortController` lifecycle + request-schema decode), parameterized by a `use(decoded, controller)` continuation and a `release(controller, exit)` finalizer:

```ts
export const acquireSdkCallController = <Payload, Out>(
  methodName: BoxMethodName,
  payloadSchema: S.ConstraintDecoder<Payload>,
  payload: unknown,
  use: (decoded: Payload, controller: AbortController) => Effect.Effect<Out, BoxError>,
  release: (controller: AbortController, exit: Exit.Exit<Out, BoxError>) => Effect.Effect<void>
): Effect.Effect<Out, BoxError> => ...
```

Rewired all 3 call sites to it (`Box.service.ts`'s `runSdkCall`, `Box.streaming.ts`'s `runJsonSdkCall` and `runByteStreamSdkCall`), each supplying its own divergent `use`/`release` (promise-wrapped invoke + manager/method span vs. direct-Effect invoke + method-only span vs. byte-stream mapping + abort-only-on-failure release). `runEventStreamSdkCall` was left untouched — it never used `AbortController`/`acquireUseRelease` and was correctly not part of either flagged clone group. Extraction was preferred over `fallow-ignore` suppression per instruction.

Verify (re-run fresh after the team lead's follow-up ping): `npx tsgo -b` clean (a transient failure isolated to `packages/foundation/modeling/schema/src/index.ts` — a file this lane never touched, mid-edit by a different concurrent agent in the shared worktree — was observed on an earlier pass and is gone on re-run; that file is still listed as modified in `git status` but no longer trips `tsgo -b`, consistent with the other agent finishing its edit in place). `npx vitest run` 18/18 (2 files) unchanged after the refactor. `turbo run build check test docgen --filter=@beep/box` — 19/19 tasks green.

Fallow re-check (re-run fresh): `bun run beep quality fallow audit --check --base origin/main --out .beep/fallow/audit.json --quiet` exits 1 (`findingAttributionSummary.introduced: 3`, `dirtyWorktree: true`), but parsing the full raw findings list (`.beep/fallow/raw/audit.combined.txt`, 41 total findings) programmatically for every `introduced: true` entry confirms **zero** reference any `packages/drivers/box` path — down from the original 6 introduced-duplication findings that named `Box.service.ts`/`Box.streaming.ts`. The 3 introduced findings that remain (2 duplication + 1 complexity) are all in `packages/tooling/tool/cli/src/commands/**` (`DualArity.ts`, `SchemaFirst.ts`, `JSDocDocumentationInventory.ts`) — a different package, out of this lane's scope, from another concurrent lane in this shared worktree. The exit-1 status is driven entirely by those, not box.

Files touched (this addition): `packages/drivers/box/src/internal/Box.runtime.ts`, `packages/drivers/box/src/Box.service.ts`, `packages/drivers/box/src/Box.streaming.ts`. `git diff --stat` (these files show as staged, not by this lane's own action — see driver note): 3 files changed, 82 insertions(+), 37 deletions(-).

## 5. Convergence-tail fixes — the last two dual-arity candidates in the repo

Both flagged candidates were latent findings introduced by this lane's own DA-2 fixes (regen after section 4 above surfaced them).

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `acquireSdkCallController` | `packages/drivers/box/src/internal/Box.runtime.ts:59` | too-many-positional-params (5: `methodName`, `payloadSchema`, `payload`, `use`, `release`) | **fixed** | This is the fallow-extraction helper from section 4 — never wrapped in `dual` (it's an orchestration helper with no natural pipeable subject, not a data-transform combinator), so the fix is a pure options-object redesign, not a `dual()` wrap. Collapsed to arity 2: `(request: {methodName, payloadSchema, payload}, handlers: {use, release})`. Restructured all 3 call sites it owns (`Box.service.ts` `runSdkCall`, `Box.streaming.ts` `runJsonSdkCall` + `runByteStreamSdkCall`) to pass the two grouped objects. |
| `projectFieldTier` | `packages/foundation/capability/mcp-kit/src/FieldTier.ts:180` | third-param-not-object-like (3rd param `tier: FieldTierName` is a string-literal union, not object-like or callable — R3-D2 exemption doesn't cover it) | **fixed** | Swapped positions 2 and 3 so the object-like `tiers: FieldTierSet<...>` param lands third and `tier` (the primitive) moves to position 2: `(value, tier, tiers)`, keeping `dual(3, ...)` and both call signatures (data-first `(value, tier, tiers)`, data-last `(tier, tiers) => (value) => ...`). Chosen over collapsing to `dual(2)` with a `{tiers, tier}` options object because it reads consistently with the `projectWithinBudget` sibling in the same file, whose 3rd positional param (`options`) is also always the richer object-like argument. |

Same-lane sweep for `projectFieldTier`'s reorder: the 2 internal call sites in `projectWithinBudget` (`src/FieldTier.ts:444,449`), the `@example` doc block, the 2 test call sites (`test/FieldTier.test.ts:93,99`), and the 2 granted-scope cross-package call sites in `packages/drivers/uspto-mcp/src/UsptoDocumentTiers.ts:294,301`. Confirmed via `rg -n "projectFieldTier\("` across `packages/**/*.ts` that only gitignored generated artifacts (`mcp-kit/dist/FieldTier.d.ts`, `mcp-kit/docs/examples/...`) still show the old argument order — both regenerate automatically and don't need hand edits.

Files touched (this addition): `packages/drivers/box/src/internal/Box.runtime.ts`, `packages/drivers/box/src/Box.service.ts`, `packages/drivers/box/src/Box.streaming.ts`, `packages/foundation/capability/mcp-kit/src/FieldTier.ts`, `packages/foundation/capability/mcp-kit/test/FieldTier.test.ts`, `packages/drivers/uspto-mcp/src/UsptoDocumentTiers.ts`.

Verify (all fresh):
- `npx tsgo -b` clean for all three packages (box, mcp-kit, uspto-mcp).
- `npx vitest run`: box 18/18, mcp-kit 23/23, uspto-mcp 10/10.
- `turbo run docgen --filter=@beep/box --filter=@beep/mcp-kit --filter=@beep/uspto-mcp` — 11/11 tasks green, all three print "Docs generation succeeded" (every `@example` typechecks against the new signatures).
- `turbo run build check test docgen --filter=@beep/box --filter=@beep/mcp-kit --filter=@beep/uspto-mcp` — first pass hit one unrelated transient failure (`@beep/test-utils#check`, a corrupted `packages/foundation/modeling/schema/dist/TerritoryCode.d.ts` from a concurrent agent's in-flight build write in this shared worktree); re-run immediately after was 36/36 green, confirming the failure was a build-race artifact and not caused by these changes.
- `bun run beep quality fallow audit --check --base origin/main --out .beep/fallow/audit.json --quiet` — **exit 0**, zero findings at all this run (the repo-wide gate is fully clean; other lanes' pending fixes have also landed since the section-4 check). Re-confirmed programmatically: zero introduced findings reference `packages/drivers/box`, `packages/foundation/capability/mcp-kit`, or `packages/drivers/uspto-mcp`.

---

## 6. Final fix — `acquireSdkCallController` merged to arity 1 (last dual-arity entry in the repo)

The section-5 arity-2 form (`request`, `handlers`) still tripped the detector: the first param's name (`request`) is on the pipeable-name list, so a 2-param helper carrying that name reads as `missing-dual` even though it isn't a real pipeable combinator. Driver's called fix: merge both bags into a single `spec` parameter, arity 1 — below the candidate floor, no renaming games.

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `acquireSdkCallController` | `packages/drivers/box/src/internal/Box.runtime.ts:59` | missing-dual (2-param helper whose first-param name `request` matches the pipeable-name heuristic) | **fixed** | Collapsed `(request, handlers)` into one `spec: {methodName, payloadSchema, payload, use, release}` parameter, arity 1. Rewired the 3 call sites it owns (`Box.service.ts` `runSdkCall`; `Box.streaming.ts` `runJsonSdkCall` + `runByteStreamSdkCall`) to pass a single object literal instead of two. |

Verify (fresh):
- `npx tsgo -b` clean in `packages/drivers/box`.
- `npx vitest run` 18/18 (2 files), unchanged.
- `bun run beep quality fallow audit --check --base origin/main --out .beep/fallow/audit.json --quiet` — exit 0, zero introduced findings anywhere in the repo; programmatically confirmed zero reference `packages/drivers/box`.
- `bun run beep laws dual-arity --check` (read-only, driver owns the write/regen): `live_entries=0`, `missing_entries=0`, `enforced_candidates=0`, `invalid_exceptions=0`, `excluded_legitimate=118`. The only non-zero counter is `stale_entries=1`, naming `acquireSdkCallController` — this is the previous tracked-inventory record for the now-superseded arity-2 signature, not a live candidate; it clears on the driver's next inventory regen.

Files touched (this addition): `packages/drivers/box/src/internal/Box.runtime.ts`, `packages/drivers/box/src/Box.service.ts`, `packages/drivers/box/src/Box.streaming.ts`.

---

Summary: 5 dual-arity entries fixed total (`projectFieldTier` cross-package
ripple + its own-fix third-param-not-object-like follow-up, `decodeWith` dual
wrap, `acquireSdkCallController` arity-5→2 options-object redesign, then
arity-2→1 single-spec-parameter final collapse) plus 1 fallow duplication
scope addition (2 overlapping clone groups collapsed via
`acquireSdkCallController`), 0 unconvertible, 0 blocked, 0 detector-bug?. All
three packages (`@beep/mcp-kit`, `@beep/uspto-mcp`, `@beep/box`) verified via
`npx tsgo -b`, `npx vitest run`, `turbo run docgen --filter=<pkg>`, and
`turbo run build check test docgen --filter=<pkg>` — all green on final
re-run. The repo-wide fallow audit exits 0 with zero findings, and the
repo-wide dual-arity check (`bun run beep laws dual-arity --check`, read-only)
shows `live_entries=0` — zero live dual-arity candidates remain in the entire
repo; the sole remaining counter is a stale tracked-inventory record awaiting
the driver's regen. No commits made.

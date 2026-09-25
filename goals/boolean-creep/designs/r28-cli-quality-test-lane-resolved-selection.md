# r28-cli-quality-test-lane-resolved-selection

P2 source refresh, 2026-09-22, at
`0be1f13d62fa00cb65e34ff69ec99043380f8d81`. This remains derived/internal,
Tier 1, 4 representable / 3 legal states, status designed. No implementation,
independent P3 approval, or dry-round credit is claimed. All Tasks.ts anchors
below refer to `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` at this
head; test anchors refer to `packages/tooling/tool/cli/test/quality-tasks.test.ts`.

## Current shape

The actual return at Tasks.ts:318–322 contains required Boolean `unit` and
`integration`, plus the complete ordered `args` array. The named
`TestLaneSelectionState` at 233–237 also types the independent raw accumulator,
whose false/false value at 265–269 is legitimate. Keep that raw D1 contract.
The reducer at 310–316 consumes exact selector tokens independently; only the
normalized return is qualified here.

The parser at 309–323 is also exposed by the existing
`parseTestLaneSelectionForTesting` alias at 341 and documented example 334–335.
Its runtime consumer is `runRootTestTask` at 3573–3619. Static planning at
3188–3203 returns no test/coverage steps; obsolete static builders are not
migration sites. Repository-wide discovery additionally finds a diagnostic
consumer outside the package: `goals/turborepo-task-qualification/research/
refresh-root-quality-plans.ts:26–38` serializes parser selections into a local
planner observation. Ignored output does not make that encoding unobservable.

## Cardinality gap

| Raw selectors after one leading delimiter removal | Resolved pair | Target mode |
| --- | --- | --- |
| unit only | true/false | unit |
| integration only | false/true | integration |
| both, in either order | true/true | all |
| neither | true/true | all |

`hasLane`317 and fallback assignments 319–320 exclude false/false from every
successful resolved result: 4 representable / 3 legal pairs. The argument
array is required payload, not an additional finite axis. Repeated selectors
are idempotent; a later `--` is retained but does not stop the reducer from
consuming later exact selector tokens. Substrings such as `--unit=false` are
ordinary preserved arguments.

A bounded execution probe of the current exported parser covered all 1,555
sequences of length 0–4 over six tokens (`--unit`, `--integration`, `--`, empty
string, `--affected`, `--concurrency=2`). Every result matched the three-state
truth table and exact ordered remainder. This is parser-only evidence, not
runtime orchestration or an exhaustive argument-language test.

## Target schema

Retain the proposed private role
`commands/Quality/internal/TestLaneSelection.schemas.ts`; run the architecture
workflow before creating it at implementation. Define
`RootTestLaneMode = LiteralKit(["unit", "integration", "all"])`, with its
same-name derived type, repo identity annotations and retained kit helpers.
If annotation rebuilds the schema, use an unannotated base followed by
annotations and `withLiteralKitStatics(base)` to retain `.Enum`/`.is`.
Use an annotated `S.Class` for the resolved value with exactly
`mode: RootTestLaneMode` and `args: S.Array(S.String)`. Strings are arbitrary
CLI passthrough tokens; do not trim, default, constrain nonempty or reinterpret
them. No parallel resolved Boolean pair, Option fields or compatibility bag.

Keep the raw reducer and its named type. Replace its final normalization with
one mode classification and construct the class with the same ordered array.
Use kit-derived mode guards for the two runtime selection decisions. The
existing exported parser alias returns this class and documents the new
result; no old-shape adapter on that alias. Keep schema symbols out of the
wildcard-exported `Quality.schemas.ts` (Quality/index.ts:56) and retain existing
package exports. Direct schema tests can use the existing source-only
`src/test/Quality.test-kit.ts` facade, which already exports Tasks at 58.

## Migration inventory

| Current site | Required migration or preserved behavior |
| --- | --- |
| Tasks 233–237,265–269,310–316 | Retain raw independent selectors and false/false. |
| Tasks 296–302,309–323 | Strip only one initial `--`; consume every exact selector anywhere thereafter; preserve all other strings and order. Return mode plus args. |
| Tasks 326–341 | Preserve alias name and input API; migrate decoded output and example. |
| Tasks 3577–3582 | Unit/all creates the existing `test:unit` Turbo step running task `test`, with bounded args; collect its step failures before integration. |
| Tasks 3584–3606 | Integration/all runs workspace parallel selection, then optional unsplit step. Explicit affected/scope args bypass workspace filter discovery and suppress unsplit discovery. Preserve argument prepend/order, labels and concurrency. |
| Tasks 3607–3618 | Resolve serial workspace args before SQL acquisition inside the same scope, collect serial failures, release on scope exit, concatenate parallel then serial failures after unit failures. |
| Tasks 3621–3649 | Retain root dispatch and unrelated routes. |
| Tasks 3188–3240 | Preserve empty static test/coverage plans and both rootQualityStepsForTesting call forms. |
| test 23,7668–7686 | Migrate exact parser result expectations and retain complete argument payloads. |
| Quality test facade 58; package exports | Existing alias remains observable; direct schema exports only through source-only test facade if needed. No production barrel expansion. |
| `goals/turborepo-task-qualification/research/refresh-root-quality-plans.ts:26–38` | Keep current diagnostic JSON shape by projecting mode to unit/integration only at this existing serialization boundary. Keep args unchanged; no second semantic state. Verify the five current observations reproduce their old serialized objects. |

The source-wide parser/type search found these live code consumers. Historical
review requests bind source hashes and local observation hashes; do not rewrite
historical receipt hashes or pretend they prove the migrated source. If the
other campaign needs current receipts, create fresh observations under its own
workflow. The existing output projection is a boundary preservation, not a
reason to retain two flags in the normalized owner.

## Guard-deletion accounting

Delete `hasLane`317 and the two fallback Boolean assignments 319–320. Replace
exactly two runtime semantic reads (`lanes.unit`3579,
`lanes.integration`3584) with finite-mode decisions. Do not count removed
upstream static builders, changed test assertions or diagnostic projection as
runtime guard deletion. Keep raw fields, optional step enablement, unsplit
nonempty checks, explicit scope detection, workspace discovery and SQL lifetime.

Preserve current failure distinctions. Collected process failures from unit
steps do not prevent integration; collected parallel/unsplit failures do not
prevent serial. Workspace discovery, SQL acquisition, observer/ledger and other
Effect failures can short-circuit the pipeline; this migration does not turn
them into accumulated process failures or promise serial execution after them.
Do not add an unconditional finalizer for a resource never acquired.

## Encoded-side impact

The parser's decoded testing API changes, with atomic caller migration. The
existing local planner observation is an actual encoded-side surface: preserve
its `{ unit, integration, args }` member shape with a one-way projection at the
writer, using mode-derived values. The internal owner remains `{ mode, args }`.
No decoder or compatibility Boolean bag is added to the parser. This replaces
the prior incorrect blanket claim that no result ever enters a file.

Preserve CLI selection/defaults, exact planned command fields, env/cwd,
passthrough args and diagnostics. Current main additionally rejects
caller-provided cache identity at Tasks 1294–1296 and 2392–2394; actual executions
pass through `cacheRuntimeStep` at 1319,1400,2397. The wrapper in
`commands/Cache/Cache.runtime.ts:167–197` can change planned bunx Turbo execution
to `bun --no-env-file ... cache execute -- ...` and preserves an `op` prefix.
Do not undo it or assert actual spawned argv equals the old planned argv.
Existing fresh-execution policy for `REGEN_GOLDENS=1`, cache inspection bypass,
quarantine, ledger and secret session behavior remain in place. No credentials
are inspected or recorded. Package-audit SQL overrides remain a separate route.

## Test impact

Migrate parser fixtures 7668–7686 to complete new objects. Include both orders,
repetition, two leading delimiters, empty string, non-selector substrings and
selectors after retained delimiters. Assert raw false/false stays accepted
before normalization. Assert the diagnostic writer's five existing scenarios
still produce exact old JSON objects through its boundary projection.

Keep the empty static-plan fixture 3218–3221. Use existing runtime spawner/SQL
harnesses to test all three modes, unit failure followed by integration,
parallel failure followed by serial, explicit-scope discovery suppression,
serial release on child failure, discovery/acquisition failure short-circuiting,
and final unit/parallel/serial failure order. Existing SQL step/env/resource
fixtures 6920–7024 are supporting coverage, not proof of all root orchestration.
Assert complete planned fields and current cache-wrapped spawn argv separately.
Preserve labs filtering and argument-order policy in actual runtime helpers.

Implementation runs focused Quality task tests, full repo-CLI package verify,
and the required Tier1E Yeet gates. This P2 audit ran only the bounded pure
parser probe, not package tests or production execution. Apply release policy
at implementation based on the actual decoded API change; no blanket
private-file exemption or unconditional changeset is asserted here.

## Risk

The 4/3 qualification survives current main. The important corrections are the
newly discovered diagnostic encoding boundary, exact source anchors, cache
runtime wrapper preservation, and distinction between accumulated process
failures and aborting Effect failures. Implement schema, parser, runtime reads,
alias docs/tests and diagnostic writer atomically, coordinating shared Tasks.ts
edits with coverage/proof owners. Independent P3 remains required.


## R39 source and test reconciliation (authoritative current map)

Bound to HEAD `220d9426dad4b708807b6297cb71d75449288749`. This appendix supersedes older numeric
locations for the files listed here; it preserves earlier design semantics and
immutable historical evidence. It grants no blanket P3, implementation or dry credit.

Retain normalized 4/3 and raw independent false/false accumulator. Strip only one leading delimiter; consume exact selector tokens even after retained delimiters; preserve every other token in order. Preserve unit/parallel/serial failure accumulation versus aborting Effect failures and SQL acquisition/release. Keep diagnostic writer projected old JSON, current cache-runtime wrapper and Crypto requirements.

Current Tasks.ts landmarks: raw test state239, parser315-329, normalized writes324-326, alias347; coverage carrier256-264, raw parser644-654, nonaffected resolver685-699, resolver862-955, selected/noop writers933-951, validator975-977, coverage step2543, selected adapter3396, raw step adapter3457, selected executor3535, root coverage3551, root test3620, root dispatch3669. Proof outcome2021-2028, session preparation2035-2037, phase locals2038-2039, reuse2044-2059, executed outcome2070-2079, persistence2082-2102, wave2116, ordered fold2141-2152, wave collector2210, public runner2381 and test alias3895. These are symbol/branch anchors, not a uniform offset.

Tests retain their existing Effect-based harness and NodeCrypto layer. In quality-tasks.test.ts, legacy lane/report inputPackages decoding is1241-1274; crypto failure distinctions are2014-2050; concurrent ordered journaling2520 and next-chunk stop2576. Coverage scoped replacement fixture is near3902; normalized selection fixtures7846/7855; SQL fixtures7097/7142/7165. Existing tests are supporting inventory, not execution evidence for this migration. Complete test-name locations follow.

### Current named test locations

- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3266` — leaves test and coverage without a static root plan
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7097` — builds the integration lane command with shared SQL environment
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7142` — forwards shared SQL env vars to the integration child process
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7165` — fails nonzero integration children and releases the shared SQL resource
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7538` — limits root integration test filters to script-owning workspaces
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7846` — selects the flagged lanes and keeps the remaining arguments in order
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7855` — runs both lanes when no lane flag is present

The private review also supplies source-location-maps.json with exact unchanged
line blocks and explicit changed blocks, plus symbol-locations.json/test-locations.json.
Use named sites for implementation; never apply a uniform offset across changed code.
No tests were executed for this read-only reconciliation.

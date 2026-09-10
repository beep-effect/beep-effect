# R28 provisional: resolved root test lanes

Native P2 proposal for `r28-cli-quality-test-lane-resolved-selection`; Tier 1,
one record per implementation PR. Frozen HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. No independent P3 or canonical
admission is claimed. All source references below are under
`packages/tooling/tool/cli/`.

## Current shape

`src/commands/Quality/Tasks.ts:307-321` returns an actual object carrying
`unit`, `integration`, and the complete required `args: ReadonlyArray<string>`.
The owner is the successful return object of `parseTestLaneSelection`, anchored
at its first Boolean field at317. It is not a synthetic `.resolved` property,
Flag descriptor, callback parameter grouping, or a pair of predicate functions.

The return annotation reuses `TestLaneSelectionState` at232-236. That named
type also owns the raw accumulator: `emptyTestLaneSelection` at263-267 has
false/false, and the reducer at308-314 independently sets each flag. Preserve
the existing `quality-test-lane-selection` D1 for that full accumulation owner.
The final return at316-320 always enables at least one lane.

`stripPassthroughDelimiter` at294-300 removes one leading `--` only. Exact
`--unit` and `--integration` tokens are consumed; every other argument is
appended in order. Repetition, empty strings, unrecognized flags, later `--`
tokens, selectors and concurrency arguments are payload, not presence axes.

## Cardinality gap

The declared Boolean pair represents four tuples; this return object supports
three. Required `args` contributes no extra finite Boolean dimension.

| Raw lane selectors | Returned unit | Returned integration | Operation |
| --- | --- | --- | --- |
| unit only | true | false | unit |
| integration only | false | true | integration |
| neither or both | true | true | all |

`hasLane = selected.unit || selected.integration` at315 followed by the two
defaults at317-318 proves false/false cannot escape. All three rows have direct
raw argument witnesses. This is4/3 for the resolved owner, not a claim that the
earlier named accumulator has an impossible state.

## Target schema

Add a named `RootTestLaneMode = LiteralKit(["unit", "integration", "all"])`
and a schema class for the resolved result with `mode: RootTestLaneMode` and
`args: S.Array(S.String)` in the existing `Quality.schemas.ts` role. Follow its
current `RootAuditMode` at224 and existing identity/schema annotations; annotate
the schema and its field collection according to schema-first guidance. No
new role file, primitive Boolean aliases, defaults or request codec is needed.

Return that class from `parseTestLaneSelection`. Keep the raw accumulator and
its independent fields. Normalize the final selection once: unit only maps to
unit, integration only to integration, and neither/both to all. Pass through
the exact argument array. Use literal matching or derived kit guards at
readers; do not reconstruct a stored pair of lane Booleans beside the mode.

## Migration inventory

- `Tasks.ts:232-236,263-267,308-314`: retain the raw accumulation contract,
  including its legitimate false/false initial state and argument reducer.
- `Tasks.ts:307,315-320`: change only the resolved return type and producer;
  remove its two Boolean properties and replace the fallback construction.
- `Tasks.ts:2399-2406`: `rootUnitTestSteps` must accept the resolved schema and
  select the unit step for unit/all. Keep label `test:unit`, script `test`, and
  `boundedRootTurboArgs(lanes.args)` exactly.
- `Tasks.ts:2408-2434`: migrate the pure plan's two integration decisions for
  integration/all. Preserve unit, parallel, serial order; the parallel label
  and command; and serial `--concurrency=1` followed by the exact output of
  `withoutTurboConcurrencyArgs`.
- `Tasks.ts:2725,2755`: root task dispatch and exported dual
  `rootQualityStepsForTesting` continue to expose the same step arrays. Their
  argument APIs do not change.
- `Tasks.ts:3055-3102`: migrate runtime unit selection and the integration
  branch together with the pure planner. Unit failures are collected before
  integration; they do not prevent its execution. Preserve workspace argument
  discovery, the explicit-scope rule for unsplit filters, parallel and optional
  unsplit steps, then the scoped serial SQL resource acquisition and step.
  Append parallel then serial failures, and finally unit then integration
  failures, before `failQualityTaskFailures`.
- `Tasks.ts:3104-3110`: `runRootTask` continues routing test invocations through
  this runtime path. Preserve invocation decoding and every other task route.
- `Quality.schemas.ts` and its existing source/test facades: expose only what
  the current schema/test topology requires. `Quality/index.ts` exports the
  Quality schema role, but its only direct Tasks export is runRootLintPolicyTask;
  `src/test/Quality.test-kit.ts:57` exports Tasks through the existing source-only
  test surface. Preserve the direct source subpath and existing documented API.
  Do not add an unrelated package export or compatibility alias.

Graft identifies two direct calls to `parseTestLaneSelection`; exact source
also establishes the indirect `rootUnitTestSteps` consumer. No graph edge is
used as proof that runtime dispatch or exports are absent.

## Guard-deletion accounting

Delete exactly two resolved fields and their two fallback assignments at
317-318. Replace the redundant `hasLane` Boolean and those fallback branches
with a single finite-mode classification. Migrate five decoded Boolean reads:
unit at2403 and3061, integration at2414,2424 and3066. Existing
`optionalQualityTaskStep.enabled` arguments remain scalar decisions about a
step; they are not another stored resolved lane pair.

Do not claim deletion of raw accumulator fields, optional-step infrastructure,
the unsplit-filter presence gate at3079, concurrency stripping, workspace
discovery, resource acquisition or failure aggregation. No coverage resolver
guard belongs to this record, although it shares Tasks.ts with the separately
admitted coverage work.

## Encoded-side impact

The resolved object is private in-process state and is not itself encoded.
No new operation key enters CLI JSON, scheduler receipts, process plans or
artifacts. The public/testing plan output remains the same complete
`QualityTaskStep` objects: labels, scripts, ordered arguments, cwd, environment
and all sibling metadata. Keep the parser's accepted flags and no-selector
default; do not reject the raw absence case now that resolved absence is gone.

## Test impact

Extend the existing `test/quality-tasks.test.ts` plan fixtures with none,
unit-only, integration-only, both orders, repeated selectors and passthrough
arguments. Assert complete steps, not only selected labels. Existing parallel
before serial cases at5299-5307, concurrency stripping at5310-5318 and default
lab exclusions at5860-5863 remain acceptance fixtures.

Exercise runtime selection through existing spawner/quality-task harnesses:
unit failure still permits integration, parallel failure still permits serial,
explicit scope suppresses unsplit discovery, serial SQL resources remain
scoped, and final failure ordering is unchanged. Check that three schema modes
are accepted and arbitrary string-array payloads survive unchanged. Do not
add a test asserting that the raw accumulator rejects false/false.

When implemented, run the focused quality-task tests and required repo-CLI
package verification. No product tests or package commands were run in P2.

## Risk

The main risk is confusing the raw accumulation type with the normalized
return owner, or migrating only the pure planner while leaving runtime
selection inconsistent. The same PR must cover both consumers and their
shared helper. Coordinate Tasks.ts edits serially with the coverage and lane
proof work; this singleton does not implement those records. Parent admission
and independent P3 remain separate from this source-backed native proposal.

# r28-cli-quality-coverage-resolved-operation

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 16/7. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `resolveCoverageTaskOptions` at `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:791`,
with members `replaceAll`, `scoped`, `skip`, `writeBaseline`.
Storage/exposure: derived/internal; target: literalkit.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/r28-cli-quality-coverage-resolved-operation.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

## Current shape

`Tasks.ts:249–256` declares the named `CoverageTaskOptions` with four required Booleans and two required string-array payloads:

```ts
type CoverageTaskOptions = {
  readonly args: ReadonlyArray<string>;
  readonly expectedPackageNames: ReadonlyArray<string>;
  readonly replaceAll: boolean;
  readonly scoped: boolean;
  readonly skip: boolean;
  readonly writeBaseline: boolean;
};
```

This type currently serves two different contracts. `parseCoverageTaskOptions` at `Tasks.ts:618–628` accepts raw write/replacement/scope combinations and always sets `skip: false`. The pure planner `rootCoverageSteps` at `:2714–2716`, exposed through `rootQualityStepsForTesting` at `:2757`, consumes this result without runtime validation. For example, `--replace-all` without `--write-baseline` legitimately produces a ratchet plan in this pure API; combining replacement and a scope selector is also a supported raw planning input. Preserve these inputs and their current plan output.

The proposed owner is the separate **successful resolved output** at `Tasks.ts:715–808`. Its paths are the nonaffected helper return at `:731` (helper `:659–668`), affected full fallback at `:776–778`, selected object at `:788–795`, and noop object at `:798–805`. These are actual returned data, not the `Effect.fn` callable, a flag descriptor, an invented schema name, or an anonymous function parameter declaration. The result is consumed by `runRootCoverageTask` at `:2992` and returned by `validateCoverageTaskArgsForTesting` at `:828–831`.

The resolver rejects replacement plus scope at `:720–724` **before** replacement without writing at `:725–729`. The scope predicate used by the parser at `:624` includes `--affected`; therefore neither selected nor noop may successfully copy `replaceAll: true`. At `:733–737`, an affected request combined with explicit `--filter`/`--since` fails before base lookup and affected planning. Required string and array payloads do not add Boolean axes.

The integration supersedes the overlapping `coverage-baseline-write-mode`
qualification with this resolved owner. The raw request is retained as D1;
its exact previous row and current design are archived under
`data/r28-cli-l-q-integration.json`. The pre-main design archive remains
unchanged. This is the sole qualified design for resolved coverage operation
state and its guard-deletion accounting.

The related D records `quality-coverage-task-options` and `r26-cli-commands-l-q-coverage-replace-all-skip` require reconciliation and may retire as overlapping subsets when the full owner is admitted. Retain the raw `replaceAll/scoped` D1 contract under `r25-cli-commands-l-q-coverage-replace-all-scoped`, with the corrected explanation that raw parsing and pure planning support both true; successful runtime resolution does not. Their original rows are archived in the integration receipt; supported raw request rows remain in the census.

## Cardinality gap

The successful return carrier exposes a four-Boolean product of 16 combinations, but its complete producer flow supports exactly seven. The tuple order below is `(replaceAll, writeBaseline, scoped, skip)`.

| Legal tuple | Proposed operation | Supported source path |
| --- | --- | --- |
| `(false, false, false, false)` | `unscoped-ratchet` | Nonaffected empty/control-free request, `Tasks.ts:731`; affected full fallback without write, `:778`. |
| `(false, true, false, false)` | `unscoped-write` | Nonaffected `--write-baseline`, `:731`; affected full fallback with writing, `:778`. |
| `(true, true, false, false)` | `unscoped-replace-all` | Nonaffected write plus replacement, both ordered guards pass, `:720–731`. |
| `(false, false, true, false)` | `scoped-ratchet` | Nonaffected explicit scope, `:731`, or affected selected result, `:788–795`. |
| `(false, true, true, false)` | `scoped-write` | Exact explicit coverage-owner filters, `:665–666`, or affected selected result, `:788–795`. |
| `(false, false, true, true)` | `noop-ratchet` | Affected noop result without writing, `:798–805`. |
| `(false, true, true, true)` | `noop-write` | Affected noop result with the write control, `:798–805`. |

E4 is the resolved implication `replaceAll ⇒ writeBaseline && !scoped`, established by `Tasks.ts:720/:725`. E1 is the sole skip-true producer at `:798–805`, which writes scope true after replacement was rejected. E2 is the ordered consumer policy at `:2993–3019`: report-only eligibility, noop exit, executor selection, then write/compare. These observations establish a state relation, not an assumption based on TypeScript representability.

There is no eighth successful tuple. Parser-origin results have skip false; full fallback strips affected and cannot carry replacement past the earlier guard; selected/noop write scope true and can only receive replacement false. The mixed raw/resolved named type cannot be relabeled 16/7 because its raw producer supports additional tuples. This is why the proposal uses the new ID and actual returned owner.

Both noop variants must survive. `noop-ratchet` under `VITEST_COVERAGE_REPORT_ONLY=1` fails at `:2993–2996`; `noop-write` passes that policy check and exits at `:2999–3001` without cleaning, measuring, comparing, or writing. Collapsing them would alter behavior and the newly observable testing result.

`args` and `expectedPackageNames` retain full required arrays. They are not presence axes, and this design introduces no `Option`, null, undefined, nonempty-array, deduplication, or string-narrowing contract. Specific constructors still preserve their current empty or ordered arrays. The seven-state table proves source reachability; no claim is made that all seven resolver fixtures have already been executed.

## Target schema

Introduce the following two schemas in a small private role file, `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageOperation.schemas.ts`. This is a proposed implementation file, not a file created during P2. Load the repository architecture workflow before creating that role in the implementation phase. Keep the existing affected-scope planner (`full/selected/noop`) unchanged; its scope vocabulary does not encode baseline intent.

```ts
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Quality/internal/CoverageOperation.schemas");

export const CoverageResolvedOperation = LiteralKit([
  "unscoped-ratchet",
  "unscoped-write",
  "unscoped-replace-all",
  "scoped-ratchet",
  "scoped-write",
  "noop-ratchet",
  "noop-write",
]).annotate(
  $I.annote("CoverageResolvedOperation", {
    description: "Successful coverage operation after request and affected-scope validation.",
  })
);

export type CoverageResolvedOperation = typeof CoverageResolvedOperation.Type;

export class ResolvedCoverageTaskOptions extends S.Class<ResolvedCoverageTaskOptions>(
  $I`ResolvedCoverageTaskOptions`
)(
  {
    operation: CoverageResolvedOperation,
    args: S.Array(S.String),
    expectedPackageNames: S.Array(S.String),
  },
  $I.annote("ResolvedCoverageTaskOptions", {
    description: "Resolved coverage operation with its complete Turbo arguments and expected package owners.",
  })
) {}
```

The fields are required and receive no new defaults. The arrays remain broad deliberately: they carry existing caller/planner strings, including empty arrays, with their exact existing order. Use `.make(...)` at trusted successful producers; do not add a generic decoder ahead of the custom request checks. Full schema validation of arbitrary raw flags would change the pure planner and error contract.

This is one seven-value literal taxonomy and one payload class. Every operation has the same payload layout, so seven tagged classes, a nested scope/write cross-product, an `unknown` validator, or a Boolean compatibility model would add no useful precision. Use `CoverageResolvedOperation.Enum`, its exhaustive `$match`, and schema-derived subset guards where a grouped decision is genuinely needed. A grouped guard may use `S.is(S.Literals(CoverageResolvedOperation.pickOptions([...])))` with the selected kit members supplied; it must derive members from this kit, not introduce a second literal vocabulary. The exact v4 mechanisms are supported by `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:558–590,697–705,730–770` and `.repos/effect/packages/effect/src/Schema.ts:4779,13973–13988`. Do not retain four derived Boolean siblings in a new object or throughout the runtime pipeline.

Keep `CoverageTaskOptions` restricted to the existing raw parser/pure-planner contract. Change the resolver's success type to `ResolvedCoverageTaskOptions`; after the ordered validations, construct the corresponding operation at **every** successful exit, including the nonaffected helper and full fallback currently returning raw parser results. Selected and noop constructors choose only their two nonreplacement operations. The test selected-step adapter at `Tasks.ts:2896–2903` constructs `scoped-write` or `scoped-ratchet` from its existing input.

Keep producer control flow and effects in `Tasks.ts`. The schema role owns data, not filesystem discovery, service access, errors, or execution. No new Effect service, layer, facade, persistence codec, or wrapper planner is required. Existing `QualityTaskConfigurationError` and `QualityTaskEnvironment` remain unchanged.

Use operation matching for resolved policy and execution, while retaining scalar projections at existing step/baseline APIs. Concretely, narrow `coverageStep` to its real inputs `(cwd, args, writeBaseline)`; the raw planner supplies its raw scalar and the resolved dispatcher supplies a case-derived scalar. This shares the existing label/args/env construction without rebuilding four flags. Likewise, make the existing selected-weight helper operate on `expectedPackageNames` only after selection of a scoped ratchet operation. Its nonempty/weight checks remain real workload checks.

| Operation | Report-only env allowed? | After policy | Baseline terminal action |
| --- | --- | --- | --- |
| `unscoped-ratchet` | No | Clean; existing full shard executor | Compare with `scoped=false` and full expected-owner array. |
| `unscoped-write` | Yes | Clean; existing full shard executor | Write with `scoped=false`, `replaceAll=false`, full expected-owner array. |
| `unscoped-replace-all` | Yes | Clean; existing full shard executor | Write with `scoped=false`, `replaceAll=true`, full expected-owner array. |
| `scoped-ratchet` | No | Clean; selected narrow/weighted execution | Compare with `scoped=true` and exact expected owners. |
| `scoped-write` | Yes | Clean; selected sharded execution even for a narrow selection | Write with `scoped=true`, `replaceAll=false`, exact expected owners. |
| `noop-ratchet` | No | Existing no-work log and return | None. |
| `noop-write` | Yes | Existing no-work log and return | None; the name preserves request intent, not a scheduled write. |

Policy evaluation remains before the noop return. Match the operation once per required decision or use kit-derived grouped guards; preserve the common cleanup/measurement sequence without a seven-way duplication of the orchestration body. Existing hosted/scalar executor APIs may retain their signatures; do not repurpose this design to remove unrelated helpers.

## Migration inventory

The additional package-script-policy merge adds two existing root lint steps
at `Tasks.ts:2548-2549`: `lint:package-scripts` runs
`["lint", "package-scripts", "--check"]`, followed by `lint:policy-fingerprint`
with `["lint", "policy-fingerprint", "--check"]`, before typos. Preserve their
labels, exact argument order, inherited cwd/environment/timeout construction,
and blocking failure behavior. They are independent quality gates, with zero
guard-deletion credit for this carrier. All downstream Tasks.ts citations have
been relocated by the two inserted lines; earlier owner/proof code is unchanged.
Keep the corresponding complete root-plan lists and argument assertions at
`test/quality-tasks.test.ts:2798-2799,2836-2847`. Existing ambient proof identity,
volatile-security policy, lane topology, report codecs and raw planner inputs
remain unchanged by this additional delta.

All migrations below belong to the ordered Tier 1E subsystem batch after independent P3 acceptance and packet ratification. Coordinate shared Tasks.ts changes serially.

| Source / consumer | Required migration and behavior preserved |
| --- | --- |
| New `internal/CoverageOperation.schemas.ts` | Own the literal kit, same-name derived type, and payload class. Apply annotations and exported-symbol JSDoc with titled examples. No nullable fields or compatibility bag. |
| `Tasks.ts:249–256,618–628` | Keep the existing raw parser contract and its pure planner uses. Preserve passthrough delimiter stripping, writer-control removal, scope classification, false skip default, and empty expected owners. Do not route this parser through the resolved model. |
| `Tasks.ts:579–598,630–668` | Preserve inline/paired exact-filter extraction, deduplication order, coverage-owner discovery, and both exact-selector error messages. Preserve arbitrary scoped ratchet inputs; exact-owner validation remains conditional on writing plus scope. Construct the final resolved mode after successful nonaffected validation. |
| `Tasks.ts:715–737` | Preserve rejection order: replacement with scope, replacement without write, then affected plus explicit scope. Keep the existing `QualityTaskConfigurationError` messages and environment/error types. |
| `Tasks.ts:739–778` | Preserve optional base lookup, missing-base error, changed-file collection error mapping, baseline row delta `Option` with full present/removed arrays, provenance-only log, scope planner, reasons/dependents, and full-fallback log. Convert the full-fallback parser output to an unscoped resolved operation without changing its payloads. |
| `Tasks.ts:788–805` | Replace the two explicit four-bit objects with `.make(...)`. Preserve selected appended filter arguments and exact package list; preserve both empty noop arrays and noop write distinction. Replacement cannot enter either branch. |
| `Tasks.ts:828–831` | `validateCoverageTaskArgsForTesting` returns the new decoded class. This was already a returned value at the frozen HEAD, not void. Migrate inferred-return callers atomically; preserve `args` and `expectedPackageNames` access and values. |
| `Tasks.ts:2122–2135,2714–2716,2757` | Reduce `coverageStep` to the scalar/array inputs it consumes. Preserve raw planning for all write/replacement/scope spellings, baseline versus ratchet label, report-only env, exact Vitest suffix, command, cwd, step order, and both pure planner invocation forms. |
| `Tasks.ts:2137–2167,2766–2794` | Preserve full prebuild/shard construction, package filters, passthrough arguments, cache controls, file parallelism, worker caps and baseline report-only settings. Downstream Boolean parameters remain boundary projections. |
| `Tasks.ts:2813–2845` | Consume the resolved operation or case-narrowed payloads. Selected writes always use the existing shard path. Selected ratchets retain the existing nonempty-list and weight-threshold decision. The `scoped` flag check disappears only because dispatch already selects a scoped operation. |
| `Tasks.ts:2874–2906` | Preserve both dual forms and the anonymous `{ hosted, writeBaseline }` testing input exactly. Construct a scoped resolved case at `:2896`, keep package-filter normalization, and retain `usesShardedCoverageExecutor` arguments/behavior. Do not narrow this testing request or claim its function parameter is a census owner. |
| `Tasks.ts:2927–2969` | Full-step testing API, workspace coverage-owner discovery, lab exclusion, no-owners error, prebuild-first ordering, shard logs, and parallel runner/cap remain unchanged. |
| `Tasks.ts:2972–2986` | Dispatch selected write/ratchet cases with unchanged weighted/narrow behavior and distinct current baseline-regeneration versus weighted-ratchet log messages. Preserve single-step versus shard-step execution. |
| `Tasks.ts:2988–3019` | Apply the operation table above. Preserve report-only rejection before skip, no-work return before cleanup, cleanup before measurement, full/selected dispatch, and write/compare only after successful measurement. Project replacement true only for `unscoped-replace-all`. |
| `internal/CoverageRegression.ts` consumers | Preserve existing baseline writer/compare signatures and implementation. Supply their existing scalar `scoped` and `replaceAll` inputs at the call boundary with unchanged complete expected-owner arrays. No baseline schema/version change. |
| `index.ts:49`, CLI `package.json:49,63,66` | Do not put exported resolved schemas in wildcard-exported `Quality.schemas.ts`, which would silently extend the Quality facade. Use the private internal role: `./commands/Quality/internal/*` is blocked. No production facade, package root, or package export change. |
| `src/test/Quality.test-kit.ts:57–60` | Existing Tasks wildcard exposes the changed validator result. Explicitly re-export the two new schemas through this source-only test facade for the planned schema/property tests; no production facade re-export. Existing coverage scope/regression test exports stay intact. |
| `test/quality-tasks.test.ts:114,3090–3139,4371` | All indexed direct validator consumers. Existing failure assertions remain, exact-owner result access at `:3125` remains, and new operation expectations use the same test facade. Extend the existing resolver fixtures for all seven cases rather than creating an alternate mock resolver. |
| `test/quality-tasks.test.ts:2927–3144,4020–4103,4331–4381,4714,5151–5300` | Preserve pure planner behavior, cache/env settings, errors, exact filters, narrow baseline shards, hosted/local equivalence, affected planning and persisted baseline fixtures. Add only behavior-sensitive operation regressions. |

The completed audit traced the entire producer/reader family, including exported testing adapters. Targeted current Graft queries confirm the named type's consumers and the validator's direct test references; the absent graph edges for `Effect.fn` are not an absence proof. The new type/kit names have no current indexed definition. Recheck exhaustive live source references immediately before implementation because this design is pinned to a frozen corpus.

## Guard-deletion accounting

The eradicated state is the **resolved carrier's four independent Boolean members**, not the raw request grammar. Every successful resolver return and the selected-step test adapter stops storing/copying those four members. The legacy named raw type still contains its supported request fields; do not claim four declarations disappeared repo-wide while retaining that raw type.

| Existing site | Accounting |
| --- | --- |
| `Tasks.ts:731/:778/:788–805` | Replace all successful raw-bag pass-through/copy/literal writes with one required operation. Remove resolved `replaceAll/scoped/skip/writeBaseline` members. |
| `Tasks.ts:2124/:2128/:2133` | Remove reads through a whole resolved options object; preserve the three output choices through one scalar builder input. These branches still set required label/args/env behavior, so do not count them as eliminated behavior or as three removed validation guards. |
| `Tasks.ts:2821/:2834/:2843` | Replace the stored write read with case-derived shard input; eliminate the redundant scoped-state check after scoped dispatch; replace the write-or-wide selector with operation dispatch plus the existing workload predicate. Do not delete the nonempty/weight checks. |
| `Tasks.ts:2899–2902` | Remove the selected adapter's four-member object. Its one supported write input still chooses between the two scoped cases. |
| `Tasks.ts:2976/:2979` | Replace resolved write member reads with operation-derived scalar/log selection. Retain selected step-count and actual executor decisions. |
| `Tasks.ts:2993/:2999/:3005/:3011/:3013` | Remove all four member reads and their Boolean relation reconstruction. Exhaustive operation selection owns policy eligibility, noop, scope, baseline intent and the final replacement projection. The report-only policy/error, noop exit, execution and baseline side effects remain in the same order. |

**Zero guard-deletion credit** is assigned to the raw validations at `Tasks.ts:720/:725/:733`, exact coverage-owner validation at `:635/:650`, base/error checks, filesystem discovery, full-owner/lab filtering, independent report-only environment setting, step-count dispatch, workload weights, or baseline file validation. These enforce external requests or independent payload/runtime facts.

Scalar Booleans passed to the existing shard and baseline APIs are intentional terminal projections. A local implementation that reconstructs `{ replaceAll, writeBaseline, scoped, skip }`, exposes compatibility getters on the resolved class, or carries four equivalent derived sibling locals through the pipeline fails this design. A second independent baseline-pair design must not claim these deletions again.

## Encoded-side impact

The resolved operation is in-process data; current source does not encode it to a persisted or wire format. No codec/version migration follows from adding its schema. Preserve CLI flags, defaults, rejected spellings, exact custom error text/order, passthrough delimiter/control stripping, argument order, complete selector payloads, and all console messages.

The new decoded return from `validateCoverageTaskArgsForTesting` is an observable TypeScript API migration. The existing test at `test/quality-tasks.test.ts:3125` already inspects `expectedPackageNames`; it must continue receiving the identical ordered list. Tests/new consumers inspecting mode use `operation` rather than compatibility flags. This is not a claim of serialized backward compatibility or a reason to erase the returned value.

Preserve the current worker topology for every baseline measurement, including a narrow selected write. Preserve baseline JSONC schema, version, keys, complete package/file rows, provenance, expected-owner verification, atomic write procedure, and comparison semantics in `internal/CoverageRegression.ts`. Preserve writer controls in raw parsing but remove them from Turbo args exactly as today. Do not change full-run lab exclusion, cache/environment policy, Node options, Vitest seed, report-only env injection, or selected/full runner behavior while introducing the operation.

For noop cases, the current constructor still writes both arrays as empty and retains the request's write choice in its operation. `noop-write` creates no file, emits no baseline success, and performs no cleanup. `noop-ratchet` retains the earlier report-only rejection. No normalization of these two operations is permitted.

## Test impact

Use the existing `@beep/repo-cli/test/Quality` source-only alias and fixtures. Add any schema test exports explicitly through that test facade; do not import private source with a new package subpath. All test execution below belongs to implementation validation, not this P2 turn.

1. **Seven successful resolver cases.** Extend scoped resolver fixtures through `validateCoverageTaskArgsForTesting`. Exercise empty/unscoped ratchet, unscoped write, unscoped replacement, scoped ratchet, exact-filter scoped write, affected noop ratchet, and affected noop write. Also exercise affected full fallback and selected plans with both write choices. Assert operation and full ordered arrays, including the two exact empty noop arrays. This establishes producers rather than merely constructing seven schema values.
2. **Raw planner remains total over its existing inputs.** Exercise all raw write/replacement combinations with and without scope through `rootQualityStepsForTesting`, including replacement without write and replacement plus scope. Assert existing command/label/args/env output, no runtime resolver invocation, and both dual invocation forms. Do not add rejection expectations to this pure planner.
3. **Ordered diagnostics.** Retain the current `:3087–3110` replacement rejection test. Add a request that violates both replacement rules (`--replace-all` plus scope without writing) and assert the scope diagnostic wins. Preserve rejection for affected plus explicit scope, missing base, unsupported exact owners, and scoped baseline requests with no valid exact selectors. Keep inline, paired, duplicate, missing-value and invalid selector fixtures faithful to `explicitTurboFilterValues` rather than applying new string checks in the schema.
4. **New returned owner list.** Preserve `:3114–3126`: inline and paired selectors plus a duplicate yield exactly `[@beep/repo-cli, @beep/ui]` in that order. Preserve `:3130–3141` unsupported-range rejection. Add operation assertions beside this existing return-value observation.
5. **Policy before noop.** Under report-only env, noop ratchet must fail with the same message; noop write must log no-work and exit. Assert no cleanup, measurement, compare, or writer call for either successful noop. In the normal env, both noop variants exit without work while remaining distinguishable in the validator result.
6. **Topology and downstream effects.** Preserve `:4032–4043` narrow selected baseline shards, wide selected local/hosted consistency, shard ordering, prebuild filters, worker budgets, full lab exclusion, and no-coverage-owner failure. Assert replacement true reaches the writer only for the unscoped replacement case. Scoped writing preserves exact expected owners; ratchets compare after measurement; failures do not advance to write/compare.
7. **Schema contract without invented restrictions.** Derive operation/schema checks or arbitraries from the production schemas exposed through the test facade. Confirm exactly seven operations and retention of arbitrary full string-array contents; reject unknown operations. Do not use generic constructor permissiveness as a reachability proof, nor constrain all schema arrays to the particular empty arrays of noop fixtures. Existing encoded baseline/provenance fixtures remain byte-equivalent.

Run focused coverage planner/resolver/executor tests for the touched behavior, then the required `bun run beep quality package-verify @beep/repo-cli` during the implementation handoff. Follow the canonical Yeet checks for the eventual Tier 1 batch. This provisional document runs no package command, test, generator, browser, or service and reports no test pass.

## Risk

Tier 1 applies because the model change is internal/derived with an explicit decoded testing API migration, not persisted state. The principal risks are narrowing the raw planner, reversing error precedence, copying unreachable replacement into affected results, erasing noop write intent, moving report-only validation after skip, changing narrow-write shards, or dropping exact expected-owner arrays.

The private schema role is deliberate: `Quality/index.ts:49` exports all of `Quality.schemas.ts`. Adding the new models there would expose them publicly. The proposed internal file has no production export, and the test facade exposes the schemas only for package-local tests. Review the emitted/inferred return type through the existing validator facade; do not describe the returned decoded shape as unobservable merely because its schema file is private.

The integration admits `r28-cli-quality-coverage-resolved-operation`, demotes the raw `coverage-baseline-write-mode` request to D1, and archives both covered skip subsets. Only this resolved owner claims its migration; the supported raw replacement/scope D1 contract remains. Preserve every R27 receipt and the pre-main design archive. Independent P3 review still must examine taxonomy, source reachability, raw-versus-resolved fidelity, export/test exposure, guard accounting and encoded preservation.

The original provisional validation is historical evidence. Current P2 integration changes packet artifacts only and provides no product test or independent P3 acceptance claim.

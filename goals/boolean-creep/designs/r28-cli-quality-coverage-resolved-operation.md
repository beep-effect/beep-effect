# r28-cli-quality-coverage-resolved-operation

Current P2 refresh, 2026-09-22, bound to source
`0be1f13d62fa00cb65e34ff69ec99043380f8d81`. The exact earlier seven-state design
is archived at
`history/designs/2026-09-14-pre-resume-r28-cli-quality-coverage-resolved-operation.md`.
The current successful resolver admits nine states. Status remains `designed`,
Tier 1, derived/internal, with replacement independent P3 review pending.
Product paths below are relative to `packages/tooling/tool/cli/`.

## Current shape

The prior September 14 design is preserved in
`history/designs/2026-09-21-before-coverage-refresh-r28-cli-quality-coverage-resolved-operation.md`.
Exact line comparisons against the September 21 source confirm the owner, raw
parser, resolver, test adapters, coverage step, selected execution and root
coverage dispatch are unchanged except for mapped line offsets. CoverageRegression
and CoverageScope remain byte-identical. The private audit binds the full inputs
and records these mappings. Current test changes preserve scoped replacement
and add signing-independent Git fixtures, live-clock policy tests and cache
launcher assertions; they are not evidence that this proposed migration ran.

Current Tasks.ts execution now rejects caller-provided cache runtime identity
and routes governed commands through `cacheRuntimeStep` in runStep,
runStepCapturedForQuarantine and collectResolvedStepOutput. Preserve that launch
wrapper, environment overrides, error mapping and logical-command logging. Step
plans still describe bunx Turbo commands; actual process execution uses the
existing cache launcher. Do not inline or bypass it while migrating operations.

Shared Turbo argument construction now inserts `--force` when `REGEN_GOLDENS=1`,
removes conflicting force options before the passthrough delimiter, and retains
arguments after that delimiter. Preserve this existing policy when simplifying
coverage step inputs. The other Tasks.ts change clears unresolved SQL references
for package audit children; that unrelated behavior is outside this migration.


`src/commands/Quality/Tasks.ts:250–258` defines CoverageTaskOptions with four
Boolean members: replaceAll, scoped, skip and writeBaseline. It also carries
required args and expectedPackageNames arrays and an optional
`topologyPackageNames` array. These payloads retain their full string-array
domains and order; an absent topology array differs from an explicitly empty one.

The same type currently serves raw parsing and validated resolution. This
qualification covers the successful resolved carrier, including the exposed
`validateCoverageTaskArgsForTesting` result at :967–974. The raw parser at
:638–648 intentionally accepts contradictory request flags and remains a
separate, unrestricted request boundary. Its pure `coverageStepForTesting`
consumer at :3410–3424 does not run the resolver or its guards.

Resolution at :856–949 rejects replacement without writing at :864–868.
Non-affected resolution at :679–689 preserves parsed flags; scoped writes must
resolve exact coverage-owner filters, while other requests derive the optional
topology owner list. Affected resolution rejects explicit selectors at :872–876,
then resolves its base, changed files, optional baseline-row delta and planner
scope. Full fallback parses passthrough arguments; selected and noop results
at :927–946 preserve the caller's replacement and writing intent.

Current main deliberately permits scoped replacement. The prior restriction
`replaceAll && scoped` was removed, and affected selected/noop writers now retain
replaceAll. The current source comment :861–863 and the public resolver fixture
`test/quality-tasks.test.ts:3844–3875` establish this supported behavior.

## Cardinality gap

The member order here is `(replaceAll, scoped, skip, writeBaseline)`.

| Tuple | Proposed operation | Supported producer/input |
| --- | --- | --- |
| F F F F | full-ratchet | Unscoped measurement/comparison request |
| F F F T | full-write | Unscoped baseline write without replacement |
| T F F T | full-replace | Unscoped baseline write with replacement |
| F T F F | scoped-ratchet | Explicit or affected selected comparison |
| F T F T | scoped-write | Exact-filter or affected selected baseline write |
| T T F T | scoped-replace | Exact-filter or affected selected replacement |
| F T T F | noop-ratchet | Affected no-op without writing |
| F T T T | noop-write | Affected no-op preserving writing intent |
| T T T T | noop-replace | Affected no-op preserving replacement and writing intent |

All 16 Boolean combinations are representable. Successful resolution enforces
`replaceAll implies writeBaseline` and `skip implies scoped`. Their conjunction
admits exactly nine combinations, and the producer paths above witness each.
Noop-replace is a source-supported producer state, not a claim that its dedicated
TypeScript fixture has already run. It must remain distinguishable in the public
resolved value even though it performs no measurement or write.

The old 16/7 count and `replaceAll implies !scoped` are invalid on current main.
Do not reintroduce that rejection or erase replacement from selected/noop results.
Generic private construction is not the proof; ordered guards and complete
successful producer branches establish the current relation.

## Target schema

Retain the raw request type and parser. Introduce one private annotated
`CoverageOperation = LiteralKit([...])` using the nine names above, with the
schema-derived same-name Type alias. Use a schema-first resolved class containing:

- required operation: CoverageOperation;
- required args: S.Array(S.String);
- required expectedPackageNames: S.Array(S.String);
- topologyPackageNames as an Option of the complete string array, decoded from
  the existing optional key with the repository's Option/default helpers.

Preserve None versus Some(empty array) versus Some(nonempty array). Required
arrays receive no empty default or nonempty refinement. Do not infer topology
owners from expected owners when an explicit topology array is present. The
internal decoded API migrates atomically; no persisted or JSON carrier is added.

Construct this resolved class only after applicable raw validation succeeds.
Use exhaustive matching or schema-derived LiteralKit subsets for actual write,
replacement, scoped and noop decisions. Do not store four derived capability
Booleans alongside the operation, create a compatibility getter bag, or accept
old malformed resolved tuples through a new adapter.

Keep raw `coverageStepForTesting` permissive. Reduce the single-step helper to
its actual inputs: writing intent, args, expected owners and optional topology
owners. Raw callers supply their original writing flag; resolved callers derive
that scalar from operation. This is an existing behavioral function boundary,
not a second stored model. Its topology precedence remains explicit topology,
otherwise nonempty expected owners, otherwise filter extraction from args.

The selected-step test adapter accepts independent hosted/writeBaseline request
options. Map its successful resolved construction to scoped-write or
scoped-ratchet without narrowing that public helper's arrays or either call form.
Its current executor helper always returns true; do not restore an older
host-dependent executor policy as part of this migration.

## Migration inventory

| Current source / consumer | Atomic migration and behavior preserved |
| --- | --- |
| Tasks.ts:250–258,638–648 | Separate the raw request carrier from the new resolved class. Preserve delimiter stripping, raw controls, skip=false, empty expected owners and optional topology presence. |
| Tasks.ts:650–689 | Keep exact-filter extraction, coverage-owner validation and diagnostics. Scoped replacement follows the same selector checks as other scoped writes. Preserve independently derived topologyPackageNames on non-writing or unscoped paths. |
| Tasks.ts:856–914 | Preserve missing-write rejection before affected selector validation, base/error handling, optional baseline-row deltas, complete present/removed arrays, planner logs and scope resolution. Remove no valid diagnostic. |
| Tasks.ts:915–948 | Map full/selected/noop success to the nine operations. Selected results retain complete appended filters and owner arrays; noop retains both empty arrays and replacement intent. Full fallback retains parser passthrough behavior. |
| Tasks.ts:967–974 | Return the resolved class from the existing validator. Migrate decoded assertions atomically; preserve services, typed errors and diagnostic ordering. |
| Tasks.ts:2496–2514 | Reduce coverageStep to actual inputs. Preserve topology precedence, bunx, cwd, ratchet/baseline label, complete Turbo/Vitest args and report-only environment. |
| Tasks.ts:3288–3320 | Preserve selected prebuild/weighted shards, exact owner filters, nonempty-owner and weight tests, and baseline-write sharding. Derive the scoped/write decisions from operation without changing executor policy. |
| Tasks.ts:3348–3381 | Migrate coverageSelectedStepsForTesting's constructed resolved object. Preserve hosted/writeBaseline inputs, both dual forms, full arrays and filter normalization. |
| Tasks.ts:3410–3424 | Keep both coverageStepForTesting forms and optional owners input. Its raw parser route still supports replacement without writing and selector strings the resolver would reject. Preserve optional topology-owner derivation. |
| Tasks.ts:3488–3535 | Preserve selected-step count dispatch and logs. Check report-only eligibility before noop; noop exits before cleanup; cleanup precedes executor selection; write/compare follows successful measurement. Both full-replace and scoped-replace pass replaceAll=true at the existing writer boundary. |
| CoverageRegression.ts:1450–1460,1531–1593,2469 onward | Preserve current independent baseline-write options, scoped carry of unmeasured rows, measured-row adoption, dependent-owner behavior, lost-live-row prevention, schema/version checks, provenance, reports and atomic writes. No baseline format or coverage floor change belongs to this design. |
| CoverageScope.ts and current test facade | Preserve the scope model, full owner/row payloads and exported validator/helpers. Use the current source-only Quality test route for necessary schema tests; introduce no production resolved-model export. |
| test/quality-tasks.test.ts | Migrate resolved Boolean assertions to operation checks while keeping complete args/owner/topology assertions, diagnostics, execution plans and baseline outputs. Existing raw-helper tests retain their request flags. |

Static root coverage/test planning remains empty as already implemented upstream;
do not resurrect the deleted rootCoverageSteps. Keep source selection, worker
caps, cache policy, dependency prebuilds and report-only child environments.
Changes to shared Tasks.ts are serial within the Tier1E tooling batch.

## Guard-deletion accounting

Replace four resolved Boolean fields with one operation at every successful
resolver return and the selected-step adapter. The raw parser's four request
fields remain; there is no claim of deleting them repository-wide.

Replace repeated resolved checks in selected dispatch and runRootCoverageTask
with operation matches or named schema-derived subsets. Remove the redundant
Boolean relation from the representation, while preserving each actual side
effect and branch outcome. Skip is represented by the three noop operations;
writing intent still distinguishes report-only eligibility before early return.

Keep the raw replacement-without-writing guard, exact-owner checks, affected
selector conflict, missing-base errors and scope planning. The former
replacement-with-scope guard is already absent upstream and earns no deletion
credit. Retain topology fallback, nonempty/weight checks, coverage completeness,
row adoption, baseline/version/provenance checks, lost-row protection and atomic
writes. These validate real inputs and resources.

## Encoded-side impact

The resolved object is internal process data with a decoded testing API. There
is no supported persisted encoding requiring a compatibility codec. All public
CLI flags, accepted raw requests, labels, diagnostics, logging, environment and
ordered plan arrays remain exact. Baseline schemas, field names/defaults and
legitimate package rows are untouched.

Preserve current scoped replacement semantics: it adopts measured rows while
carrying unmeasured committed rows; replacement does not imply unscoped execution
or permission to erase unmeasured packages. CoverageBaselineWriteOptions is an
independent two-knob boundary, not this resolved operation model. A single writer
call's correlation does not justify deleting either of its legal options.

## Test impact

At implementation, add a complete nine-operation resolver matrix with existing
workspace/scope fixtures. Exercise all affected full/selected/noop routes with
ratchet, write and replacement intent. Retain the current scoped-replacement
fixture at test/quality-tasks.test.ts:3844–3875, including the rejected --since
selector and accepted exact filter. Add direct noop-replace coverage through the
real resolver; do not fabricate only a final class instance.

Verify report-only rejects every ratchet operation before a noop return, accepts
write/replace intent, and causes no cleanup/measurement/write for any noop.
Preserve ordered diagnostics and prove execution dispatch for full and selected
write/replace modes. Keep exact label, argv, environment, shard/prebuild and
scope payload assertions for both helper call forms.

Test absent, explicitly empty and populated topology owners. Preserve wildcard,
dependency and dependents selector behavior through the existing optional graph
argument; a helper call must not acquire runtime services merely to validate a
raw request. Keep the broader raw replacement-without-writing step fixture.

Retain baseline planner tests for all four carryUnmeasured/replaceAll pairs,
especially scoped replacement at :6864–6880. Assert measured rows are adopted and
unmeasured committed rows remain. No baseline regeneration or ratchet lowering
is part of this migration.

Run focused quality task tests and required
`bun run beep quality package-verify @beep/repo-cli`, then the ordered campaign
and full Yeet gates. Tests are specified here; this P2 refresh performed source-delta and finite
projection checks only, not product tests, measurement jobs or independent P3 review.

## Risk

The highest risk is reapplying the archived seven-state contract and thereby
rejecting supported scoped replacement. Another is collapsing the optional
topology array and silently changing Vitest worker scheduling and coverage.
The nine operations preserve all resolved flag states, while explicit payloads
retain those scheduling distinctions.

Raw request diagnostics remain outside the resolved model. Do not send the pure
step helper through runtime validation or infer that all possible raw tuples
are legal resolved states. Noop replacement retains intent even without IO.
Revalidate exact source, callers and tests before P3 or implementation if main
moves again. This design supplies no independent review, dry-round or gate credit.


## R39 source and test reconciliation (authoritative current map)

Bound to HEAD `220d9426dad4b708807b6297cb71d75449288749`. This appendix supersedes older numeric
locations for the files listed here; it preserves earlier design semantics and
immutable historical evidence. It grants no blanket P3, implementation or dry credit.

Retain 16/9 successful resolved domain: replaceAll implies writeBaseline; skip implies scoped. Scoped replacement and noop replacement remain supported. Raw parser/step adapters remain permissive. Preserve absent versus present-empty topology arrays, report-only rejection before noop, cleanup after noop guard and before execution, full/sharded dispatch, exact diagnostics, cache-runtime wrapping and current Crypto requirements.

Current Tasks.ts landmarks: raw test state239, parser315-329, normalized writes324-326, alias347; coverage carrier256-264, raw parser644-654, nonaffected resolver685-699, resolver862-955, selected/noop writers933-951, validator975-977, coverage step2543, selected adapter3396, raw step adapter3457, selected executor3535, root coverage3551, root test3620, root dispatch3669. Proof outcome2021-2028, session preparation2035-2037, phase locals2038-2039, reuse2044-2059, executed outcome2070-2079, persistence2082-2102, wave2116, ordered fold2141-2152, wave collector2210, public runner2381 and test alias3895. These are symbol/branch anchors, not a uniform offset.

Tests retain their existing Effect-based harness and NodeCrypto layer. In quality-tasks.test.ts, legacy lane/report inputPackages decoding is1241-1274; crypto failure distinctions are2014-2050; concurrent ordered journaling2520 and next-chunk stop2576. Coverage scoped replacement fixture is near3902; normalized selection fixtures7846/7855; SQL fixtures7097/7142/7165. Existing tests are supporting inventory, not execution evidence for this migration. Complete test-name locations follow.

### Current named test locations

- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1510` — rebuilds an unscoped lane report from an unscoped artifact
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2776` — falls back to diff-scoped audit when Fallow cannot create the base worktree
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2819` — includes untracked files in the diff-scoped audit input
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3105` — plans package-owned tsgo tasks without filesystem-dependent coverage
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3266` — leaves test and coverage without a static root plan
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3634` — runs combined root coverage tasks in ratchet mode
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3663` — resolves Turbo selector sets and their matching worker topology
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3720` — ends every coverage producer's argv with one Vitest topology
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3764` — builds the coverage invocation as the ratchet gate by default
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3795` — reduces coverage children to the pull-request Turbo posture whatever the host carries
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3816` — never hands a coverage turbo run a generated remote cache argument
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3837` — preserves existing Node options when disabling experimental Web Storage for coverage
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3848` — honors an explicit fast-check seed for exploratory coverage runs
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3859` — keeps report-only coverage reserved for baseline regeneration and strips writer controls
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3892` — rejects replace-all without baseline writing and accepts it on a scoped write
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3924` — resolves exact explicit baseline filters into verifier-equivalent shard owners
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3940` — rejects scoped baseline selectors that are not exact coverage owners
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3955` — compares coverage snapshots with fail-on-drop and warning-only new package semantics
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3995` — decodes per-file summary entries into stable repo-relative baseline paths
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4098` — bounds coverage-summary decode diagnostics while retaining the typed parse cause
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4125` — rejects internally inconsistent Vitest coverage summary counts
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4157` — rejects current coverage baselines without per-file provenance
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4270` — keeps every committed coverage package on schema v2 with file provenance
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4312` — refuses scoped v1 writes and migrates a full regeneration to schema v2
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4512` — only fails missing baseline-package summaries for unscoped coverage runs
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4521` — excludes the coverage baseline artifact only from writer change-set planning
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4531` — keeps rendered coverage diagnostics free of terminal control characters
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4607` — requires every workspace package to have coverage or a named exemption
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4617` — fails when an exact selected coverage owner omits its summary
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4627` — selects only directly changed coverage owners for an affected coverage run
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4673` — selects every transitive coverage-bearing dependent of a changed owner's source
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4681` — keeps a test-only change scoped to its own owner
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4697` — lets a package without a coverage task seed its coverage-bearing dependents
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4707` — walks through lab and coverage-less dependents without selecting them, and never seeds from a lab
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4836` — falls back to a full run when a repository fixture's configured owner cannot measure coverage
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4855` — treats the ciops extraction tree as coverage-inert
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4870` — rejects a registered fixture consumer in labs even with a coverage script
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4883` — registers only coverage-executed drizzle fixture consumers
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4959` — uses verifier-equivalent shards for narrow baseline writes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5010` — uses the same shard topology for wide local ratchets and baseline writes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5149` — pins comparison reads to TURBO_SCM_BASE instead of the branch baseline
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5224` — reads the workspace baseline when TURBO_SCM_BASE is absent
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5253` — fails clearly when the configured comparison baseline cannot be read
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5567` — keeps the base floor when a global coverage input changed
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5848` — resolves an affected run from a dirty row-only baseline edit against the workspace
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5905` — selects the packages named by a row-only baseline edit instead of the full workspace
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5959` — treats standards documentation as coverage-inert but keeps policy inputs global
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6084` — falls back to full coverage for global, unknown, manifest, or shared test-kit inputs
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6116` — skips affected coverage for docs-only and packages without a coverage task
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6130` — assigns every full-run coverage owner to exactly one stable weighted shard
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6185` — preserves caller Turbo flags while overriding full-coverage shard controls
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6246` — uses the hosted shard worker shape for full baseline regeneration
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6276` — separates a percentage drop caused by deleting covered code from one caused by losing coverage
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6323` — detects coverage lost in one file when deleting unrelated uncovered code offsets package totals
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6386` — detects a surviving file's coverage loss when uncovered counts rise
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6562` — fails closed when a covered baseline path disappears despite improving package totals
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6598` — fails closed when a removed path and package drop could hide offset coverage loss
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6683` — splits selected baseline rows into replaced, held, added, and pruned dispositions
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6734` — holds every existing measured row for a no-op baseline change set
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6811` — removes the coverage output directory of every workspace package that declares a coverage script
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6869` — holds a measured package a scoped write never changed and carries every unmeasured row
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6923` — adopts dependents on a scoped write only, keeping the unscoped writer on direct owners
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6961` — names the adopted packages a scoped filter run never measured
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:6991` — carries nothing on an unscoped write, which prunes unmeasured rows instead
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7013` — stays quiet when a scoped write measured every package it adopts
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7041` — adopts every measured package when a scoped write passes replace-all
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7058` — says so loudly when a scoped write held every package it measured
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7074` — names the live baseline entries an unscoped replacement would delete
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7653` — ends lint and scoped coverage argvs with the labs exclude
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7676` — keeps the labs exclude ahead of the coverage vitest passthrough and inside every shard

The private review also supplies source-location-maps.json with exact unchanged
line blocks and explicit changed blocks, plus symbol-locations.json/test-locations.json.
Use named sites for implementation; never apply a uniform offset across changed code.
No tests were executed for this read-only reconciliation.

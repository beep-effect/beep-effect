# r28-cli-quality-coverage-resolved-operation

Current P2 refresh, 2026-09-21, bound to source
`7536a751b40b8560706dfe8cfa451591b11b025d`. The exact earlier seven-state design
is archived at
`history/designs/2026-09-14-pre-resume-r28-cli-quality-coverage-resolved-operation.md`.
The current successful resolver admits nine states. Status remains `designed`,
Tier 1, derived/internal, with replacement independent P3 review pending.
Product paths below are relative to `packages/tooling/tool/cli/`.

## Current shape

The prior September 14 design is preserved in
`history/designs/2026-09-21-before-coverage-refresh-r28-cli-quality-coverage-resolved-operation.md`.
Exact line comparisons confirm the owner, raw parser, resolver, test adapter,
coverage step, selected execution, root dispatch, and cited scoped-replacement
fixtures remain unchanged. CoverageRegression, CoverageScope, and the Quality
test facade are byte-identical to the prior binding. The accompanying receipt
records the mapped ranges and hashes.

Shared Turbo argument construction now inserts `--force` when `REGEN_GOLDENS=1`,
removes conflicting force options before the passthrough delimiter, and retains
arguments after that delimiter. Preserve this existing policy when simplifying
coverage step inputs. The other Tasks.ts change clears unresolved SQL references
for package audit children; that unrelated behavior is outside this migration.


`src/commands/Quality/Tasks.ts:249–257` defines CoverageTaskOptions with four
Boolean members: replaceAll, scoped, skip and writeBaseline. It also carries
required args and expectedPackageNames arrays and an optional
`topologyPackageNames` array. These payloads retain their full string-array
domains and order; an absent topology array differs from an explicitly empty one.

The same type currently serves raw parsing and validated resolution. This
qualification covers the successful resolved carrier, including the exposed
`validateCoverageTaskArgsForTesting` result at :966–973. The raw parser at
:637–647 intentionally accepts contradictory request flags and remains a
separate, unrestricted request boundary. Its pure `coverageStepForTesting`
consumer at :3400–3414 does not run the resolver or its guards.

Resolution at :855–948 rejects replacement without writing at :863–867.
Non-affected resolution at :678–688 preserves parsed flags; scoped writes must
resolve exact coverage-owner filters, while other requests derive the optional
topology owner list. Affected resolution rejects explicit selectors at :871–875,
then resolves its base, changed files, optional baseline-row delta and planner
scope. Full fallback parses passthrough arguments; selected and noop results
at :926–945 preserve the caller's replacement and writing intent.

Current main deliberately permits scoped replacement. The prior restriction
`replaceAll && scoped` was removed, and affected selected/noop writers now retain
replaceAll. The current source comment :860–862 and the public resolver fixture
`test/quality-tasks.test.ts:3825–3856` establish this supported behavior.

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
| Tasks.ts:249–257,637–647 | Separate the raw request carrier from the new resolved class. Preserve delimiter stripping, raw controls, skip=false, empty expected owners and optional topology presence. |
| Tasks.ts:649–688 | Keep exact-filter extraction, coverage-owner validation and diagnostics. Scoped replacement follows the same selector checks as other scoped writes. Preserve independently derived topologyPackageNames on non-writing or unscoped paths. |
| Tasks.ts:855–913 | Preserve missing-write rejection before affected selector validation, base/error handling, optional baseline-row deltas, complete present/removed arrays, planner logs and scope resolution. Remove no valid diagnostic. |
| Tasks.ts:914–947 | Map full/selected/noop success to the nine operations. Selected results retain complete appended filters and owner arrays; noop retains both empty arrays and replacement intent. Full fallback retains parser passthrough behavior. |
| Tasks.ts:966–973 | Return the resolved class from the existing validator. Migrate decoded assertions atomically; preserve services, typed errors and diagnostic ordering. |
| Tasks.ts:2486–2504 | Reduce coverageStep to actual inputs. Preserve topology precedence, bunx, cwd, ratchet/baseline label, complete Turbo/Vitest args and report-only environment. |
| Tasks.ts:3278–3310 | Preserve selected prebuild/weighted shards, exact owner filters, nonempty-owner and weight tests, and baseline-write sharding. Derive the scoped/write decisions from operation without changing executor policy. |
| Tasks.ts:3338–3371 | Migrate coverageSelectedStepsForTesting's constructed resolved object. Preserve hosted/writeBaseline inputs, both dual forms, full arrays and filter normalization. |
| Tasks.ts:3400–3414 | Keep both coverageStepForTesting forms and optional owners input. Its raw parser route still supports replacement without writing and selector strings the resolver would reject. Preserve optional topology-owner derivation. |
| Tasks.ts:3478–3525 | Preserve selected-step count dispatch and logs. Check report-only eligibility before noop; noop exits before cleanup; cleanup precedes executor selection; write/compare follows successful measurement. Both full-replace and scoped-replace pass replaceAll=true at the existing writer boundary. |
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
fixture at test/quality-tasks.test.ts:3825–3856, including the rejected --since
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
especially scoped replacement at :6838–6854. Assert measured rows are adopted and
unmeasured committed rows remain. No baseline regeneration or ratchet lowering
is part of this migration.

Run focused quality task tests and required
`bun run beep quality package-verify @beep/repo-cli`, then the ordered campaign
and full Yeet gates. Tests are specified here; this P2 refresh ran only packet
validators, not product tests, measurement jobs or independent P3 review.

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

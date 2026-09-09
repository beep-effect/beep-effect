# r28-cli-quality-coverage-resolved-operation

**Current source-forward binding (P2 only)**

Revalidated against HEAD `4509872869eb87071250c67717769260f850bcf5` and merged main
`d68f1a11dd41579660a6c72f3d3e060d6b61352d`, after the R30 packet commit
`578b25de24f325a7240ed5321d708531c6d55536`. Native continuation uses
`gpt-6-astra` / `xhigh`; it preserves the original job provenance below.
This is a bounded source rebind, not another design or a P3 approval.
The canonical inventory at admission was 738 records /146 qualified, SHA256
`ea376cff64c549eb542d8bc4dc10c5aec519246b0f20a6720a8f9ad5c64a98d1`.

The full eight-section design below is retained byte for byte from the canonical
packet at this HEAD. Its prior source header and numbered locators describe
main `bed30c6adf3beed7de8538209fbdc84d26a3b8ce`. Apply the following exact
source-location mappings when reading it against d68; these mappings and the
current preservation notes govern this rebind. Equal source slices, full source
copies, consumer search, dependency bindings, and proposal hashes are frozen in
the private `pre-r31-main-d68-quality-designs` handoff. No product test or
independent review ran, and source implementation remains pending.

| Retained locator file | Exact current mapping |
| --- | --- |
| `Tasks.ts` | Old1–2578 stays identical. Old2579–2671 maps +3; old2673–3532 maps +3. The unrelated old2672 lint inventory log is replaced at2675. |
| `Quality.command.ts` | Old1–2074 stays identical; old2075–2081 maps +10; old2085–3938 maps +11. The only changed prior lines2082–2084 belong to local Effect plugin resolution, not these designs. |
| `internal/GithubChecks.ts` | Old1–421 stays identical; old422–507 maps +11; old508–891 maps +20. Two additional lane entries cause the shifts. |
| `test/quality-tasks.test.ts` | Old1–832 stays identical; old837–933 maps +11; old934–1024 maps +12; old1025–1029 maps +13; old1031–2926 maps +14; old2927–2964 maps +15; old2965–6197 maps +16. Changed earlier expectations are listed below. |

Qualification and target remain 16/7, derived/internal LiteralKit, designed/Tier1.
The raw parser, ordered guards, resolver producer, required array payloads,
and exported validator at Tasks249–850 are exact. The runtime body is also
byte-identical after the +3 shift: current runRootCoverageTask3087–3118;
report-only policy3092 precedes skip3098, cleanup3103, executor selection3104,
and write3110/compare3117. Current raw coverageStepForTesting is2998–3005,
selected adapter2938–2970, and root static empty-plan range2777–2828.
No new mode, narrowed raw input, payload projection, or guard credit is added.

Current replacement/selector fixtures are test3282–3337, affected row-only
fixtures4526–4576, and all later coverage references map +16. Preserve the raw
helper's replacement-without-write and replacement-with-scope behavior and its
both dual forms. Current CLI Vitest globalSetup uses a file URL; fileParallelism
remains false. The TurboCache change is documentation of hosted cache policy,
not a coverageEnvironment implementation change. Preserve the actual new hosted
policy in scripts/ci-job-env.mjs and existing lane env scrubbing without reading
or emitting runtime secrets. Root lint's tsconfig-overlay and new GitHub lanes
are unrelated behavior to preserve, with no changes to the seven-state design.

**Retained design and original provenance**

Native P2 refresh bound to HEAD `e7b1e907726421c7d2a2e1cdd140280df47f2353` and immutable main
`bed30c6adf3beed7de8538209fbdc84d26a3b8ce`, compared with main
`3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`. Prepared by Codex
`gpt-6-astra` / `xhigh` under the user's current AGENTS instructions.
Status remains `designed`; cardinality remains 16/7. Tier 1: ordered Tier1E subsystem batch, with serial shared-file edits.
This document supplies no implementation or independent P3 approval.
Short source paths are relative to `packages/tooling/tool/cli/src/commands/Quality/`;
`src/` and `test/` paths are relative to the CLI package.

## Current shape

`CoverageTaskOptions`, `Tasks.ts:249–256`, declares four required Booleans
`replaceAll`, `scoped`, `skip`, `writeBaseline`, plus required complete
`args` and `expectedPackageNames` string arrays. This named type serves two
contracts. The admitted owner is the successful returned data from
`resolveCoverageTaskOptions` at733–826, anchored at809 in the selected object.
The other contract is the broader raw parser at636–646, which accepts every
write/replacement/scope combination and sets skip false. Do not narrow it.

Upstream removed `rootCoverageSteps`; static `rootQualityStepsForTesting`
returns [] for coverage/test at2774–2825. The new dual
`coverageStepForTesting` at2995–3002 now exposes the raw parser's single-step
construction directly. Replacement without writing and replacement with scope
are still supported raw helper inputs: this helper calls no resolver. Their
output depends on the original args and write intent, with writer controls
stripped. Preserve that behavior; do not restore the removed static plan.

The resolved owner is returned by the nonaffected helper at677–686, the full
fallback at794–797, the selected constructor at806–814 and noop at815–823.
`validateCoverageTaskArgsForTesting` at846–850 exposes its decoded result and
`runRootCoverageTask` at3084–3115 consumes it. It is actual returned data, not a
callable, named raw type relabeling, or an invented predicate axis.

## Cardinality gap

The successful output represents16 combinations but supports exactly7.
Tuple order here is `(replaceAll, writeBaseline, scoped, skip)`.

| Legal tuple | Operation | Concrete successful path |
| --- | --- | --- |
| FFFF | unscoped-ratchet | Empty nonaffected request; affected full fallback without write. |
| FTFF | unscoped-write | Nonaffected --write-baseline; affected full fallback with write. |
| TTFF | unscoped-replace-all | Nonaffected --write-baseline --replace-all, without a scope selector. |
| FFTF | scoped-ratchet | Nonaffected explicit scope; affected selected without write. |
| FTTF | scoped-write | Exact explicit coverage-owner filters with write; affected selected with write. |
| FFTT | noop-ratchet | Affected no-work scope without write. |
| FTTT | noop-write | Affected no-work scope with write. |

E4: the resolver rejects replacement+scope at738 before missing-write at743,
then affected+explicit-scope at751. The parser's scope includes --affected;
replacement can enter neither selected nor noop. E1: the only skip-true producer
at815–823 always sets scope true. Thus replaceAll implies write and unscoped;
skip implies scoped and no replacement. Parser-origin/full results have skip
false, selected has scope true/skip false, and noop has scope true/skip true.
All write choices in the table are real paths, and there is no eighth success.

The report-only policy at3089 precedes skip3095. `noop-ratchet` must reject
`VITEST_COVERAGE_REPORT_ONLY=1`; `noop-write` passes that check then exits with
no cleanup, measurement or baseline write. Keep them distinct. Required arrays
are payloads, not finite presence axes. They retain arbitrary strings and exact
existing order, with the two explicitly empty noop arrays preserved. No new
nonempty, nullable, Option, deduplication or string-refinement contract is added.

Fixtures at `test/quality-tasks.test.ts:3266–3321` exercise replacement guards,
inline/paired/deduplicated exact owner selection and rejected range selectors;
4510–4560 checks affected row-only baseline resolution. Coverage scope fixtures
at3993–4280 and4731–4776 provide selected/full/noop planning witnesses. The source
proves the complete seven successful paths; this P2 does not claim that seven
new end-to-end tests have already run.

## Target schema

Keep the previously proposed private role
`internal/CoverageOperation.schemas.ts` (architecture workflow required before
creating it in implementation), with an annotated
`CoverageResolvedOperation = LiteralKit(["unscoped-ratchet", "unscoped-write",
"unscoped-replace-all", "scoped-ratchet", "scoped-write", "noop-ratchet",
"noop-write"])`, same-name derived type, and annotated schema class
`ResolvedCoverageTaskOptions` carrying required `operation`, `args: S.Array(S.String)`
and `expectedPackageNames: S.Array(S.String)`. Use repo identity, schema defaults
only where already part of the contract (none for these fields), and titled
exported examples. No production barrel/export-map changes.

This is one seven-literal taxonomy and one common payload class. Seven tagged
classes, a second scope/write vocabulary or a generic unknown guard wall add
no precision. Keep the existing affected-scope full/selected/noop model: it
carries reasons, packages and dependencies and has a different responsibility.
Use the kit's Enum/match/derived subset guards; do not reproduce four equivalent
resolved Boolean siblings or compatibility getters.

Retain raw `CoverageTaskOptions` for the parser and raw single-step helper.
Only successful resolution returns the new class. Construct its operation at
all exits, including the nonaffected helper and full fallback now passing a
raw parser result. Preserve custom raw diagnostics before constructing a class;
a generic schema decode must not precede those checks. Selected and noop choose
only their two nonreplacement cases. The selected-step test adapter at2955–2966
constructs scoped-write or scoped-ratchet while preserving its input API.

Keep orchestration, filesystem effects and errors in Tasks.ts. No new service,
Layer, codec or wrapper planner. Narrow existing `coverageStep` at2213–2226 to
its actual scalar/array inputs `(cwd, args, writeBaseline)` so the raw helper and
resolved runner share identical labels, arguments and environment without
reconstructing the four-field bag. Selected weight calculation can consume the
full expected-owner array after scoped-ratchet dispatch; retain its nonempty
and weight-threshold checks.

| Operation | Report-only allowed | Execution after policy | Terminal baseline action |
| --- | --- | --- | --- |
| unscoped-ratchet | no | Clean, full shard executor. | Compare scoped=false with complete expected owners. |
| unscoped-write | yes | Clean, full shard executor. | Write scoped=false, replaceAll=false. |
| unscoped-replace-all | yes | Clean, full shard executor. | Write scoped=false, replaceAll=true. |
| scoped-ratchet | no | Clean, narrow single-run or weighted selected shards. | Compare scoped=true with exact expected owners. |
| scoped-write | yes | Clean, selected shards even for narrow selection. | Write scoped=true, replaceAll=false. |
| noop-ratchet | no | Existing no-work log and return. | None. |
| noop-write | yes | Existing no-work log and return. | None; intent is retained without scheduling a write. |

`usesShardedCoverageExecutor` at2892 currently always returns true for every
supported hosted/write input. Preserve that policy and both testing input
values rather than treating hosted false as permission for a different baseline
topology. Keep common cleanup/measurement orchestration without duplicating it
seven times. Project scalar arguments only at existing terminal helper APIs.

## Migration inventory

| Source / consumer | Atomic migration and behavior preserved |
| --- | --- |
| `Tasks.ts:249–256,636–646` | Keep raw parser contract, delimiter stripping, control removal, scope classification, skip=false and empty expected owners. |
| `Tasks.ts:597–616,648–686` | Preserve inline/paired filter extraction and deduplication order, exact-owner discovery, both selector diagnostics, and validation conditional on write+scope. Scoped ratchets retain arbitrary accepted scope inputs. Construct the resolved mode only after successful validation. |
| `Tasks.ts:733–755` | Preserve diagnostic order: scope before missing-write, then affected+explicit scope. Keep exact typed errors and service requirements. |
| `Tasks.ts:757–797` | Keep base Option/missing-base error, changed-files error mapping, baseline row delta Option with complete present/removed arrays, provenance-only/reasons/dependents logs, planner and full fallback. Convert final parser data without dropping payloads. |
| `Tasks.ts:806–823` | Replace four-bit selected/noop objects. Preserve appended exact filters, full expected owners, both empty noop arrays and write intent. |
| `Tasks.ts:846–850` | Validator still returns a value. Migrate decoded API to the class; preserve ordered arrays and all typed failures. |
| `Tasks.ts:2213–2258,2995–3002` | Reduce coverageStep to its real inputs; adapt both forms of new coverageStepForTesting using raw parsing. Preserve ratchet/baseline labels, bunx, cwd, complete Turbo args, Vitest suffix and env. No resolver is invoked by this pure helper. |
| `Tasks.ts:2774–2825` | Keep static test/coverage plans empty and both rootQualityStepsForTesting invocation forms. Upstream-deleted rootCoverageSteps is not restored or credited as this implementation. |
| `Tasks.ts:2827–2906` | Preserve prebuild first, stable weighted shards, empty-shard exclusion, exact filters, passthrough controls, lab exclusion, worker caps and report-only env. Selected writes always shard; ratchets keep nonempty-owner and weight checks. Scope relation is handled by operation dispatch. |
| `Tasks.ts:2935–2967` | Preserve both selected-step dual forms and anonymous hosted/writeBaseline input. Map to a scoped operation; keep full packageNames/args and filter normalization. |
| `Tasks.ts:3023–3066` | Keep full-step testing API, discovered coverage owners/lab exclusion, no-owners error, shard logs and ten-shard concurrency policy. |
| `Tasks.ts:3068–3115` | Preserve narrow/sharded step-count dispatch and distinct logs; report-only check before noop, noop before cleanup, cleanup before measurement, then write/compare only after success. Only unscoped replacement supplies replaceAll=true. |
| `internal/CoverageRegression.ts`, `internal/CoverageScope.ts` | Retain baseline and scope codecs, full values, APIs and implementations. Pass existing scoped/replaceAll scalars at the boundary; retain expected-owner verification, source/row provenance, atomic writes and comparisons. |
| `src/test/Quality.test-kit.ts:58,60–61`, `index.ts:49`, package exports49/63/66/68 | Tasks wildcard exposes the validator and new raw step helper. If direct schema tests need the private kit/class, explicitly re-export only through this source-only facade. Quality.schemas wildcard remains unchanged; no production resolved-model export. |
| `test/quality-tasks.test.ts:117,3269,3278,3296,3313,4550` | All direct validator references; migrate any resolved field assertions while retaining exact owner arrays, args and diagnostics. |

The raw request D1 remains under `r25-cli-commands-l-q-coverage-replace-all-scoped`.
This resolved owner already superseded `coverage-baseline-write-mode` and the
covered skip subsets in the R28 integration. They are historical dispositions,
not pending new retirements or simultaneous qualified designs. Only this owner
claims the resolved migration. Parent handles unrelated D metadata refresh.

Graft discovery and exhaustive package source/test search establish the named
raw/resolved family and testing routes. Existing new upstream lint gates at
2600–2601, changed root-check ownership at2471 onward and other Tasks.ts batches
retain their source behavior with zero guard credit here. Shared edits are serial.

## Guard-deletion accounting

Remove the resolved carrier's four independently stored bits from every success
path749/796/806–823 and selected adapter2955–2966. Retain the raw type and flags;
this does not delete four declarations repo-wide.

- Replace coverageStep whole-bag reads2215/2219/2224 with one existing semantic
  write scalar. The label/args/env choices remain, so these are not three removed
  behavior or validation guards.
- Replace selected write read2882, redundant scoped check2895 after scoped
  dispatch, and write-or-wide relation2904 with operation selection plus the
  unchanged nonempty/weight decision2896–2897.
- Replace runtime write/log choices3072/3075 and the resolved reads3089/3095/
  3101/3107–3110 with operation-based policy/dispatch/terminal projections.
  Preserve the actual checks and side effects in their original order.

Zero deletion credit belongs to raw guards738/743/751, exact-owner validation
653/668, base/error checks, scope planning, array contents, workspace/lab filters,
report-only environment state, step-count decision, workload weights or baseline
validation. No deleted upstream static planner is campaign credit. Returning a
new class while reconstituting the four siblings or compatibility getters fails
this design; a second baseline-pair design cannot double-count the same work.

## Encoded-side impact

The resolved object is in-process; no new operation enters serialized CLI output,
planner steps, scheduler artifacts or baseline JSONC. The exported validator's
inferred return changes and must be migrated honestly. Its current exact-owner
assertion at test3304 continues receiving the same ordered list. Public raw
coverageStepForTesting arguments/results remain unchanged, including otherwise
runtime-invalid replacement combinations and both dual forms.

Preserve all CLI flags, defaults, string spellings, error text/order, delimiter
and writer-control stripping, ordered selector/passthrough arrays and logs.
`coverageEnvironment` at1016–1027 retains CI=true, remote-cache credential
scrubbing, Node options and fast-check seed. Preserve report-only injection,
prebuild filters, worker topology for every write, full-run lab exclusion,
baseline schema/version/key order, package/file rows, provenance and atomic
write semantics. No digest, path, payload or required array becomes a Boolean.

Noop-write emits no baseline-success log/file and does no cleanup. Noop-ratchet
still fails the report-only environment policy before skip. The same seven
operations preserve those distinctions without storing redundant flags.

## Test impact

Use existing @beep/repo-cli aliases and real scope/repository fixtures; no new
package or mock resolver. Implementation validation must cover:

1. All seven successful resolver operations, including selected and full fallback
   with both write choices and distinct noops. Assert full ordered arrays, not
   only mode. Extend the existing validator harness and affected fixtures.
2. Raw helper totality: all write/replacement combinations with/without scope
   through both coverageStepForTesting forms, including replacement without
   write and plus scope. Assert current command/label/args/env and no runtime
   validation. Keep test2864–2874 proving static root test/coverage plans are [].
3. Ordered errors: existing3266–3321 plus simultaneous scope+missing-write
   violation must report scope first. Preserve affected+explicit scope, missing
   base, invalid/range/missing selectors, inline/paired/deduplicated exact owners
   and arbitrary scoped ratchet inputs. No new schema restriction substitutes
   for these typed diagnostic paths.
4. Returned arrays: exact owners [@beep/repo-cli,@beep/ui] at3292–3305 retain order;
   affected row-only baseline resolution4510–4560 retains full source payloads.
5. Policy before noop: report-only noop-ratchet errors, noop-write succeeds
   without cleanup/measurement/compare/write, normal-env noops both return no-work.
6. Existing coverage env3142–3264, narrow selected baseline shards4211 onward,
   local/hosted equivalence4262 onward, owner discovery/full/noop4731 onward,
   weighted/full controls4777–4915, baseline replacement/held rows5330–5465 and
   actual lab exclusions6019 onward retain their complete outputs.
7. Schema-derived checks/arbitraries cover exactly seven operations and arbitrary
   full string arrays without new nonempty restrictions. Unknown operations fail.
   Fixture reachability is established by producers, not class permissiveness.

Run focused coverage tests and required `bun run beep quality package-verify
@beep/repo-cli`, then canonical Yeet verification at implementation. This native
P2 refresh runs no tests, generator, browser, service or census.

## Risk

The qualification survives unchanged; its consumer/API map materially changed.
Risks are narrowing the new raw helper, reviving obsolete shadow plans,
reversing error precedence, copying replacement into affected results, collapsing
noop intent, changing narrow-write shards or losing expected-owner arrays.
Preserve the private schema role and acknowledge the exported decoded validator
migration. Pass the existing resolved args unchanged to runFullShardedCoverage;
coverageFullSteps2857–2868 retains its present derivation from those args. Do not
reinsert stripped writer controls or change full-step environment policy as an
incidental repair in this state-model refactor. Coordinate the three Tasks.ts designs in the ordered Tier1E batch.
Independent P3 and implementation acceptance remain pending.

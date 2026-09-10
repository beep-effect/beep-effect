# R28 quality and scheduler source/design impact

Frozen source: `93217d998f851e2e93d9864e2b5315552eaa58a7`.
Corpus main: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.
Compared with source `8f266b878445ca8a7f751f9248da428a4dde39a1` and main
`663904610cce2a38c06b0619a8c414646b69361c`.

This is a native P2 audit, not independent P3, an R28 census result, a product
test run or an inventory/status mutation. R27 remains complete/wet and
immutable. The impact-map membership is from `main-d1b4d7-impact.json`;
qualification below comes from exact source and consumers, not that map.
The source comparisons used bounded read-only `git diff` and `git show`,
explicitly authorized by the parent. No git state was changed.

Four designs were refreshed: admission attempt, promotion tick, OSV expiry and
GitHub lane-proof disposition. Two canonical designs were deliberately left
byte-identical to their pre-merge archive: protocol eviction mode and coverage
baseline write mode. Their owner/qualification defects require adjudication;
replacing them with an eight-section hold would obscure the historical design.
The conditional full coverage operation design is below, in this audit only.

Short `Tasks.ts`, `Quality.command.ts`, `Quality.osv-ignore.ts`,
`Quality.schemas.ts` and `internal/GithubChecks.ts` / `internal/LaneProofReuse.ts`
paths refer to `packages/tooling/tool/cli/src/commands/Quality/`.
`QualityScheduler.ts` / `AdmissionJournal.ts` refer to
`packages/tooling/tool/cli/src/internal/repo-run/`.
`test/` and `src/test/` paths refer to the CLI package root.

## Exact changed and unchanged proof

The complete named blocks below were compared, not just the Boolean lines.
Line drift alone is not a behavior change.

| Block | Prior source lines | Current source lines | Result |
| --- | --- | --- | --- |
| `AdmissionAttempt<OriginLease>` | QualityScheduler 1569–1572 | 1600–1603 | Byte-identical; SHA-256 `1e5ac2b920120cfd761427732c425e1e60c1274351a825cf4ca8e03d5414ca48`. |
| `tryAdmitSelf` | QualityScheduler 1574–1609 | 1605–1640 | Byte-identical; origin-busy/None, rejected/None and not-busy/Some remain the only outcomes. |
| `PromotionTick<OriginLease>` | QualityScheduler 1720–1724 | 1751–1755 | Byte-identical. |
| `tryPromoteTicket` | QualityScheduler 1726–1758 | 1757–1789 | Byte-identical, including pre-scan clock and error-path gate release. |
| `waitForAdmission` | QualityScheduler 1827–1864 | 1858–1895 | Byte-identical, including masked promotion, restored sleep and sticky blocked clock. |
| `runGithubCheckWave` | Tasks 1613–1685 | 1675–1747 | Byte-identical; SHA-256 `c3d66dddf4242fcde12b24acc2c3b5e566b188df8694b3687642d4e6104ca431`. |
| `schedulerProtocolCommand` | Quality.command 3408–3438 | 3434–3464 | Byte-identical descriptors, callback, conflict diagnostic, branch selection and output. |
| `runBunAudit` | Quality.command 757–784 | 778–805 | Byte-identical; SHA-256 `e8b89ef947376bb40ecc67214d5b213179b0544557f83b2cbba3209a5e8664f4`. |
| Complete `Quality.osv-ignore.ts` | Same file | Same file | Byte-identical; SHA-256 `2fb0b94c3ea05a928bab78bcf94dd3d392ddc32f1abca93bd0f00abb5958113a`. |

The changed dependencies are material even though these outcome blocks did not
change:

- `AdmissionJournal.ts:119-134,395-613` advances the marker to
  `yeet-admission-protocol/v2`, retains v1/v2 event decoding and adds v3
  enqueue, withdrawal, attributed release and attributed eviction variants.
  Versions reuse tags; the new guards are schema unions across versions.
  Do not apply a duplicate-discriminant `toTaggedUnion` to this event family.
- `AdmissionJournal.ts:638-674,1551-1629` adds a reader service for simulating
  older fleet knowledge and retains opaque lines byte-for-byte. Known history
  is bounded to 2,400 rows while reserving the newest 200 admissions. Required
  arrays and retention numbers are payloads, not fresh presence/Boolean axes.
- `QualityScheduler.ts:765-792,1943-1960,1965-1992,2102-2124` writes v3
  eviction/release/enqueue/withdrawal events. A ticket finalizer acknowledges
  withdrawal only after actual ticket removal and only when no durable lease
  exists; an existence-read failure fails closed on withdrawal. A failed
  promotion cleanup may therefore retain lease/promotion recovery with no
  withdrawal row. Preserve all paths, clocks, errors and release ownership.
- `Tasks.ts:579-598,630-668,730-731` extracts/deduplicates inline and paired
  explicit package filters, rejects non-exact coverage owners for scoped
  baseline writes, and fills `expectedPackageNames`. The validation testing
  export at `:828-831` now returns the resolved value instead of void.
  `:2841` now shards every selected baseline write, even a narrow selection;
  `:2977-2979` has distinct baseline and weighted-ratchet messages.
- `LaneProofReuse.ts:124-139` hashes the entire inherited environment for
  local-env or ambient-extending commands, and omits that contribution for
  isolated spawns. Preserve the exact nested hash, explicit lane env, platform
  and runtime identity; never revert to the former selected-variable list.
  `src/internal/cli/EnvConfig.ts:519` supplies the same ambient-extension
  predicate used by spawn sites `Tasks.ts:1179,1260,2033`.
- `GithubChecks.ts:493-498` adds blocking `fallow:health` in preflight after
  audit/dead-code. `Quality.command.ts:1034-1054` runs the ONNX mitigation proof
  before Docker OSV and stops there on failure. The volatile security lane
  remains non-reusable. The OSV-ignore parser belongs to Bun audit, not this
  Docker route; it has no new parser consumer here.
- `Quality.command.ts:591-610` exposes existing primitive adapters for
  deterministic tests. `src/test/Quality.test-kit.ts:58` adds the unrelated
  Fallow diagnostic export; existing Tasks/LaneProofReuse test exports remain
  relevant consumers. Neither addition changes the four outcome carriers.

`noteAdmissionWaitForTesting` at `QualityScheduler.ts:1852` existed before this
merge. Its shifted location is not a new seam. Likewise the pre-existing
weighted wide-selection predicate must not be described as newly introduced.

## Four surviving design/row proposals

These are integration proposals only. Keep each stable ID, member set,
cardinality 4/3, target and Tier 1. Keep current lifecycle status; this audit
does not supply a reviewed/applied transition.

| ID | Current anchor / evidence | Design changes |
| --- | --- | --- |
| `scheduler-admission-attempt-origin` | QualityScheduler 1600; E1 1618/1628/1630 and E2 1781 | Refresh full release/finalizer/journal map and exact source references. `originBusy` has three literal writes, not two. |
| `scheduler-promotion-tick-origin` | QualityScheduler 1751; E1 1778/1782/1788 and E2 1882/1891 | Preserve independent info, pre-scan clock, sleep/heartbeat order and sticky rejected-state clock. Count attempt Option branch deletion only in admission design. |
| `r26-cli-commands-l-q-osv-ignore-expiry` | Quality.osv-ignore 20; E3/E4 58–63, reader 71–84 | Owner bytes unchanged. Preserve regex-matched-token semantics, full DateTime and exact audit command behavior; refresh command/test references. |
| `r27-cli-commands-l-q-github-check-lane-proof-reuse` | Tasks 1694; E4 1695, E2 1696/1699 | Refresh changed environment/lane/security dependencies and tests. Preserve all v2 proof identities, successful-only persistence and both report codecs. |

Admission and promotion share one private generic outcome and land atomically
in their Tier 1 batch. No multiple-record Tier 2 singleton is created. The
opaque origin lease has no arbitrary-input codec: local Effect v4
`Schema.ts:435-562` distinguishes `declareConstructor` from `declare` and does
not provide a free generic validator. The updated design explicitly requires
P3 to check the concrete generic construction; an always-true unknown guard,
an erased lease or a new mandatory caller codec would violate the design.

## Protocol owner eligibility: proposed withdrawal

`scheduler-protocol-eviction-mode` currently points at
`schedulerProtocolCommand`. Its object at `Quality.command.ts:3436-3445`
contains two **Flag descriptor objects**, not two Boolean values. The Boolean
names at `:3446` are destructured callback parameters; no source-owned Boolean
request object is assigned, constructed, stored or returned by this command.
The actual local result at `:3454` is an `AdmissionProtocol` with the existing
`off | on` literal and version string. These are not Boolean axes either.

Eligibility therefore fails before 4/3 cardinality. Proposed action: archive
and withdraw this seed from the live census as OUT OF NET, preserving its
previous row/design/receipt. Do not reclassify a descriptor/parameter owner
as D1 merely because its parser accepts four request spellings. A different,
actually instantiated request object would need its own source evidence.

The successful-operation projection remains true: inspect, enable and disable
are the three actions; combined true returns `QualityScriptCommandError`
before protocol I/O, with the exact message, command and exit code at
`:3447-3452`. `test/quality-scheduler.test.ts:2621-2630` exercises the three
successful spellings and deliberate conflicting request. This is a required
diagnostic, not a fourth successful protocol action. The existing design keeps
both flags and the conflict check, replacing only a ternary with a new mode;
it deletes zero existing Boolean fields. That is a second reason not to count
it as Boolean-creep eradication of this owner.

Preserve current help text even though it still says “v2 eviction rows” at
`:3439/3443`; the actual current protocol-v2 fence authorizes v3 event writers.
Fixing that prose is outside this audit's source-mutation scope. Preserve
`admissionProtocolStatus` / `setAdmissionEvictionProtocol` at
`QualityScheduler.ts:499/515`, journal locking at
`AdmissionJournal.ts:1481`, default-off handling of older markers and exact
CLI output. The original design remains unchanged pending parent adjudication.

## Coverage owner split and conditional coordinated design

### Current shape

The actual named `CoverageTaskOptions` at `Tasks.ts:249-256` has four required
Boolean fields (`replaceAll`, `writeBaseline`, `scoped`, `skip`) and two required
string-array payloads (`args`, `expectedPackageNames`). It serves both raw
argument planning and resolved runtime operation; those contracts differ.

`parseCoverageTaskOptions` at `:618-628` accepts all write/replace/scope request
combinations and sets skip false. It feeds both the validator at `:719` and
the pure `rootCoverageSteps` at `:2712-2714`. The latter reaches
`rootQualityStepsForTesting` at `:2755` without runtime validation. Thus the
named type as a whole does not promise the 16/7 resolved invariant. In
particular, raw `--replace-all` without `--write-baseline` still plans a ratchet
step; refusing that pure planning input would change its existing contract.

The actual **successful return-object flow** is
`resolveCoverageTaskOptions` at `:715-808`, including the explicit return
objects at `:788-795` and `:798-805`, the nonaffected path at `:731`, and full
fallback at `:778`. It is consumed as the local `options` at
`runRootCoverageTask`, `:2990`, and now returned by the test facade at `:830`.
This is a real constructed/returned Boolean carrier, not the Effect function
value, a predicate function or an anonymous parameter signature. Anchor a
potential new record to this return-object flow, without pretending a new
`ResolvedCoverageTaskOptions` schema already exists in source.

The ordered guards at `:720` and `:725` reject scoped replacement before
replacement-without-write. `scoped` is computed with
`isExplicitTurboAffectedOrScopeArg` at `:624`, which includes `--affected`.
Consequently selected/noop copies at `:791/:801` **cannot** contain true
replaceAll through the resolver. Constructor permissiveness and copying a
field do not prove that value reaches the branch. The old designs/D1 notes
claiming a supported affected replacement path are incorrect at both pins.

### Cardinality gap

Only after selecting the successful resolved owner does the four-bit product
have cardinality 16 representable / 7 legal:

| replaceAll | writeBaseline | scoped | skip | Operation and source path |
| --- | --- | --- | --- | --- |
| false | false | false | false | Unscoped ratchet: no controls, `:731`; also full affected fallback `:778`. |
| false | true | false | false | Unscoped baseline write: write control, `:731`; also full fallback. |
| true | true | false | false | Unscoped replacement: both controls, both guards pass, `:731`. |
| false | false | true | false | Scoped ratchet: explicit selector `:731` or selected affected plan `:788`. |
| false | true | true | false | Scoped write: valid exact explicit owners `:665-666` or selected affected plan. |
| false | false | true | true | Affected noop ratchet: noop branch `:798`, no replacement reaches it. |
| false | true | true | true | Affected noop baseline request: same noop branch preserves write selection. |

E4: replacement implies writing and unscoped operation. E1: skip is true only
in the noop producer, which also writes scoped true and can only receive
replaceAll false. E2: the root reader at `:2991-3017` checks report-only policy,
then skip, then executor scope, then write/compare in that order. There is no
eighth successful tuple: all parser-origin results have skip false, all full
fallbacks are unscoped without replacement, and selected/noop can only copy a
nonreplacement request. Write true/false remains preserved in noop even though
both return before measurement/write; it affects the earlier report-only
guard and is part of the returned public test value.

`args` and `expectedPackageNames` retain their complete arrays in every case.
Array emptiness, the weighted planner number, timing values and required
strings are not extra Boolean/presence axes. This table is source-proven
reachability, not an assertion that all seven cases have been executed here.

### Target schema

Conditional on independent confirmation and parent reconciliation, define one
private schema-first resolved model with a seven-value LiteralKit operation:

```text
unscoped-ratchet       unscoped-write       unscoped-replace-all
scoped-ratchet         scoped-write
noop-ratchet           noop-write
```

The model contains `operation`, `args` and `expectedPackageNames`; use the
existing file-role/import conventions and one derived runtime type. Both
arrays remain full required arrays with the existing contents and ordering,
without inventing nonempty or payload-absence restrictions. Seven payload-free
operation literals are sufficient; no seven object classes or nested tag
cross-product is required. If a shared scope/mode schema is chosen instead,
its admitted product must still be exactly 3+2+2, not 3×3.

Split the raw parser model from this successful output. Retain the raw
Boolean request fields and the current ordered custom errors. Construct the
operation at each successful resolver return; construct replacement only on
the unscoped path. Do not independently implement the old write/replace pair
design and then a scope pair design on the same connected state machine.

The raw pure planner remains a raw consumer and retains false-write precedence
regardless of replaceAll. Its needs do not justify reintroducing a Boolean
compatibility bag in the resolved production path. Scalar booleans accepted by
existing shard builders and the baseline writer are downstream API projections,
not parallel stored operation state; derive them at those boundaries.

### Migration inventory

| Writer/reader/export | Conditional migration and preservation |
| --- | --- |
| `Tasks.ts:249-256,618-628` | Separate the raw parser type and canonical result. Keep raw controls, false skip default, passthrough normalization and arrays. |
| `Tasks.ts:630-668,715-808` | Keep filter extraction/deduplication, coverage-owner discovery, exact error text/order, affected/base discovery, changed-file reads, row-delta and scope logs. Construct one operation on nonaffected/full/selected/noop returns. |
| `Tasks.ts:828-831` | The test facade now returns the resolved value. Migrate its decoded TypeScript return and callers atomically; do not call it void or hide a new Boolean compatibility return. |
| `Tasks.ts:2122-2167,2712-2714,2755` | Preserve pure raw planning behavior; retain label, control stripping, report-only args/env, both dual invocation forms and step order. A shared step builder may accept the exact mode it needs, avoiding a recreated four-bit resolved bag. |
| `Tasks.ts:2764-2792,2811-2843,2872-2904` | Preserve prebuild package filters, shard assignments, expected owners, weight threshold and worker topology. Selected writes always shard. Retain the existing anonymous hosted/writeBaseline test parameter contract; it is not a census owner. |
| `Tasks.ts:2970-2984` | Dispatch selected write versus narrow/wide ratchet with unchanged logs and executor behavior. Do not turn noop-write into an actual write. |
| `Tasks.ts:2986-3018` | Keep report-only rejection before noop exit, cleanup before measurement, full versus selected execution and compare/write order. Derive the existing writer's scalar `replaceAll` only for unscoped-replace-all. |
| `Quality/index.ts`, `src/test/Quality.test-kit.ts:57` | Root runtime task and existing test facade exports remain; migrate callers of the changed decoded test return. No new public compatibility alias or persisted codec is required. |
| `test/quality-tasks.test.ts:2917-3134,4010-4093,4321-4371,4704,5141-5290` | Preserve raw planning, ordered validation, returned exact owner lists, narrow baseline shards, wide local/hosted equality, affected planning and baseline write/ratchet bytes. |

Graft found the named type with no incoming edges but its exhaustive text
index found the producer/reader family and testing export. The audit read the
complete resolver and all Boolean reads rather than treating absent edges as
proof of no consumers.

### Guard-deletion accounting

Remove all four Boolean members from the resolved model, their duplicated
literal/copy writes at successful return sites, and downstream member reads.
The exact deletion sites are the baseline label/args/env decisions at
`:2124/:2128/:2133`, selected shard argument at `:2819`, scope reconstruction
at `:2832`, write-or-wide selector at `:2841`, selected-run topology/log reads
at `:2974/:2977`, report-only check at `:2991`, skip gate at `:2997`, unscoped
gate at `:3003`, write/compare split at `:3009` and replacement projection at
`:3011`. Exhaustive operation matching owns those choices. Retain the
independent package-weight predicate, external environment guard, payload
arrays and scalar builder/writer API parameters.

The raw validation guards at `:720/:725/:733` remain to preserve accepted
request grammar and custom diagnostics. No deletion credit is assigned to
them. If implementation keeps `options.writeBaseline`, `options.scoped`,
`options.skip` and `options.replaceAll` as derived siblings throughout the
resolved pipeline, it has recreated the same carrier and fails this design.

### Encoded-side impact

The resolved operation is in-process and is not serialized. Preserve CLI
grammar and defaults, control stripping and argument order, all env values,
console text, coverage JSONC schema/version/keys and full rows, provenance,
atomic baseline writes and comparison semantics. Preserve current shard
topology, including verifier-equivalent workers for narrow baseline writes.
No snapshot or schema version increment follows from this internal model.

The public test facade's newly observable decoded return shape is an explicit
TypeScript migration within the existing testing API, not a wire-compatibility
claim. Tests that inspect arrays must keep receiving the same arrays; tests or
callers inspecting operation fields migrate to the new schema atomically.

### Test impact

Pin all seven resolved tuples through existing scoped resolver fixtures and
all raw write/replace pairs through the pure planner. Cover both scope-error
precedence and missing-write diagnostics. Pin absent/invalid/duplicate paired
and inline filters, unsupported exact owners, affected full/selected/noop,
report-only rejection before noop, unchanged no-work behavior and the public
test result arrays. Retain newly added `quality-tasks.test.ts:3104-3134` exact
filter tests and `:4022-4033` narrow baseline shard proof; preserve wide local
ratchet behavior and encoded baseline fixture comparisons. Use existing
package aliases and fixtures. No product tests were run for this audit.

### Risk

This conditional operation design is Tier 1 because it changes internal
resolved TypeScript state, with an explicit test-facade migration. The largest
risks are losing refused raw requests, changing guard precedence, erasing the
noop write selection, reviving unreachable affected replacement, or dropping
the newly enforced shard topology. Qualification and overlap reconciliation
must happen before this design replaces the current named-type design.

Proposed new canonical owner, **only after independent confirmation**:
`r28-cli-quality-coverage-resolved-operation`, file
`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`, line `788`, symbol
`resolveCoverageTaskOptions`, kind `object-literal`, members
`[replaceAll, writeBaseline, scoped, skip]`, derived/internal, 16/7,
LiteralKit, Tier 1. The symbol is the actual enclosing producer, not an
invented schema name. Evidence anchors: E4 `:720/:725`, E1 `:788/:798`, E2
`:2991-3017`. Do not add it alongside an overlapping qualified baseline-pair
record on the same successful flow. The parent must choose an archived
supersession or justified stable-ID migration; this audit does not select or
mutate canonical identity/status.

## Relevant disqualified-row revalidation proposals

This accounts for every D1/D2 impact row in the assigned exact source files.
`FallowQuality.command.ts` is a different owner and is outside this lane.
OUT OF NET rows should be archived/withdrawn, not retained as D1. No count
change below is applied by this audit.

| Existing row | Proposal and exact source reason |
| --- | --- |
| `quality-test-lane-selection` | Retain D1 at Tasks 232 for the **whole named accumulation owner**. FF is deliberately constructed at 263–267, TF/FT by reducers 310–311, TT by combining selections. The final default-both result at 315–320 does not erase the legitimate earlier FF state. Correct notes that imply FF reaches execution. |
| `quality-coverage-task-options` | Reopen D1 `[scoped,skip,writeBaseline]`: skip is constructed true only with scoped true at 798–805. Broad independence is false even on the mixed raw/resolved owner. Do not independently add an overlapping 8/6 subset while deciding the full resolved 16/7 owner. |
| `r25-cli-commands-l-q-coverage-replace-all-scoped` | Retain D1 only for the named mixed/raw owner after correcting its note: raw parse accepts both; the pure planner can consume both. **No** successful resolver result combines replacement and scoped, because 624 includes affected and 720 rejects before planning. If reanchored to the resolved owner, this pair belongs to the full cluster instead. |
| `r26-cli-commands-l-q-coverage-replace-all-skip` | Reopen D1: the sole skip-true producer is reached after replacement+scope rejection; no raw parser produces skip true. Its claim of a supported noop replacement is false. This relation belongs to the proposed full operation cluster, not an independent subset PR. |
| `r3-tooling-quality-scheduler-admission-probes` | Withdraw OUT OF NET. `hasLegacySameOriginLease`, `hasLegacySameOriginTicket`, `hasLegacySameOriginOwner`, `hasSameCheckoutLease` at QualityScheduler 1341–1368 are callable predicates, not stored Boolean members of `isTicketSkippable`. |
| `r3-tooling-coverage-owned-arg-kinds` | Withdraw OUT OF NET. Tasks 670/675/683/686 compose callable predicates; `isCoverageFullOwnedArg.argKinds` is not a source-owned Boolean object. |
| `r3-tooling-dead-lease-scope-plan-guards` | Withdraw OUT OF NET. QualityScheduler 2252–2253 aliases `.guards.retain/.stop`; these are callable schema-derived guards consumed by filters at 2288/2296. |
| `r3-tooling-quality-tasks-env-arg-gates` | Withdraw OUT OF NET. `isLintFixAggregateArg` at Tasks 834 and `isCi` at 846 are functions, not Boolean values of a `QualityTasks.envArgGates` owner. |
| `r3-tooling-coverage-selected-steps-options` | Withdraw OUT OF NET. Tasks 2876/2882/2890 declare anonymous function parameter signatures with hosted/writeBaseline. They are not a named source data owner. The constructed canonical object at 2894 has only writeBaseline from this pair; hosted is consumed as a scalar and not retained in that object. |
| `quality-tmpfs-reap-apply-json` | Withdraw OUT OF NET. Quality.command 3555/3559 are Flag descriptors; apply/json at 3564 are callback parameters. Actual `runTmpfsReap({apply})` at 3565 contains one Boolean and does not carry json. |
| `r25-cli-commands-l-q-github-checks-failure-policy` | Withdraw OUT OF NET. Quality.command 2899/2903 are Flag descriptors; Boolean callback parameters at 2909 are normalized to the existing failurePolicy literal in the actual object at 2911–2915. No two-Boolean runtime object is constructed here. |
| `r25-cli-commands-l-q-residue-reap-apply-json` | Withdraw OUT OF NET. Quality.command 3650/3654 are descriptors and 3671 is the callback signature. The actual object passed to runResidueReap at 3672 retains apply plus arrays/numbers, with no json Boolean. Do not treat those required payloads as axes. |
| `r27-cli-commands-l-q-effect-tsgo-readme-parser` | Retain D2 at Quality.command 355–358. The literal Boolean parser options are a real object but owned by the external XML parser contract. No internal canonical Boolean phase follows from those settings. |
| `r27-cli-commands-l-q-tsgo-smoke-compiler-options` | Retain D2; update anchor to Quality.command 2653–2657. The actual nested JSON compilerOptions object has composite/incremental/noEmit, owned by TypeScript configuration. Required include/exclude arrays are not added axes. |

On the whole mixed `CoverageTaskOptions` owner, a mechanical producer union
would include eight raw tuples with skip false plus the two noop tuples,
whereas the successful resolver has seven. This illustrates why the full
16/7 claim cannot simply be pasted into the existing named-type record. It is
not a separately admitted new cardinality or an authorization to widen the
existing baseline-pair design. The independent R28 census must reconcile
actual owner, complete producer flow and overlapping rows before ratification.

## Test and preservation inventory

Source-inspected changed tests: `quality-scheduler.test.ts` adds/updates v3
lifecycle assertions (`981-1120`), versioned codec/older-reader preservation
(`1122-1227`), bounded churn (`1247-1303`), protocol fence and interrupted
recovery (`2497-2596`), withdrawal on interruption (`3156-3196`), attributed
evictions (`3318-3332`) and surviving durable promotion (`4818-4860`). Preserve
all their named fields, encoded omission and exact event ordering.

`quality-tasks.test.ts` adds complete ambient/local/isolated proof identity
tests (`1690-1791`), mixed-cwd persistence guard (`1626`), promoted health-lane
expectations, exact coverage owner/filter tests (`3104-3134`) and narrow-write
shards (`4022-4033`). It also changes a broad provenance test's report-only
skip policy; that is preserved, not rewritten by the proposed operation model.
`quality-command-dispatch.test.ts:105-140` expects mitigation-first security
execution and failure before Docker. These test files are consumers and
regression evidence; they do not become census roots.

## Scoped validation and handoff

Only the four surviving design files and this new audit were written. The
two questioned canonical designs were not rewritten. All six owned design
files retain the eight required section strings. All six pre-main archive
files are checked against `main-d1b4d7-impact.json` SHA-256 values; the two
unchanged current designs match their respective archive bytes. No archive,
R27 receipt, source, test, inventory, status, service, dependency or git state
was modified by this lane. No package command or product test ran.

Graft was used before source discovery and its exhaustive search resolved
missing Effect.fn graph edges. Savings are estimates, not verification proof.
The four design updates are ready for parent integration; protocol withdrawal
and the coverage/overlap proposals remain native P2 findings for independent
R28 adjudication. The census can supersede these findings with better actual
owner evidence without altering the frozen R27 receipts.

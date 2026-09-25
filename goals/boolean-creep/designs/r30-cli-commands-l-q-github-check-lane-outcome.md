## R37 exact-source locator refresh (authoritative)

This section supersedes every earlier numeric source/test locator in this document. Earlier source identities are historical provenance; current binding is HEAD84058d6470137e35f108d13c7dba52129db9a301/main9a1bd3805574bca087d4da09ece4a628038afb27. Full4/3 contribution design, all payload/Option obligations, encoded compatibility and behavior tests above remain unchanged.

Current Tasks.ts: complete six-field type2021-2028 contains lane,session,laneRun,failures,reused,stopAfterRed. Reuse producer2044-2059 preserves original lane/session plus Some run with commandText and absent timing/defaults, emptyfailures, reused2057=true and stopAfterRed2058=false. Executed producer2070-2079 keeps result payloads, reused2075=false and stopAfterRed2076-2078 from failure+present stopping decision. Both real Boolean fields coexist; no inherited/spread fields add axes. No callable-parameter or cross-expression owner is invented.

Current consumer sites: persistGithubCheckLaneProof2082-2103 with reused/failure exclusion2085, optional duration fallback2088-2092 and optional session2093 onward. runGithubCheckWave concurrently produces outcomes2138-2140, then folds declaration order2141-2152: reuse attribution2142, optional run journal2145-2147, failures2149, failFast stop latch2150 and proof persistence2151. Preserve this exact event order and common work. The earlier private type anchors1980 and writers2014/2032 are obsolete.

Implement the existing single contribution classifier at this exact private carrier; retain all four payloads and Option absence. Reused run commandText must survive, ran may contain imprecise failures, missing decision/run maps defensively to ran, and missing duration remains0. Do not infer successful proof eligibility from ran alone. Keep proof policy, session identity, warning behavior, serial persistence and skipped-tail scheduling. Existing R27 pre-execution owner receives no duplicate guard credit. Run the existing scenario tests by symbol rather than stale test line numbers, retaining precise/imprecise/estimate-less red, collect-all, proof reuse and declaration-order concurrent journaling.

This is a source-location refresh, not new cardinality, input narrowing, implementation or P3 proof. Full prior design text is preserved for semantic requirements; exact input hashes and old design bytes are captured in the private audit for integration archival.

# r30-cli-commands-l-q-github-check-lane-outcome

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Designed, Tier 1, derived/internal, LiteralKit target, 4 representable / 3 legal.
Current source replaces historical locator overlays. No implementation, P3,
census or package-test credit. Source paths below are relative to
`packages/tooling/tool/cli/`; short Quality paths mean `src/commands/Quality/`.

## Current shape

`Tasks.ts:1980–1987` declares a module-private carrier with lane,
Option<LaneProofSession>, Option<QualityTaskLaneRun>, failures, reused and
stopAfterRed. These are real sibling Boolean properties. Both are derived from
completed execution evidence; there is no external decoder, independent mutation
or durable storage for them. Retain all four payload fields, not just the flags.

The reuse writer at 2001–2016 emits the original lane/session, Some reused run,
empty failures, reused=true and stopAfterRed=false. Its run retains id, label,
inputDigest None and commandText Some(actual command and args). Timing, exitCode
and scheduling decision use existing absent defaults. The execution writer at
2027–2036 emits lane/session, optional first run and complete failures, fixes
reused=false and derives stop from nonempty failures plus a present stopping
scheduling decision. `qualityTaskLaneRunFromOutcome` at 1819–1842 emits only
passed/failed for executed work and gives scheduling decisions only to failures.
`redSchedulingDecision` at 1865–1875 stops precise/estimate-less reds and continues
imprecise reds.

Readers are persistence exclusion at 2042, reuse attribution at 2099 and stop
accumulation at 2107. The concurrent producer call is at 2095–2097; the wave folds
results once in declaration order. R27 owns reusable/activeReuse at 1995–1996
and their pre-execution hit/bypass readers. No duplicate credit belongs here.

## Cardinality gap

| reused | stopAfterRed | Meaning |
| --- | --- | --- |
| false | false | Ran without stopping contribution: pass, imprecise failure, or defensive missing run/decision. |
| true | false | Active exact proof reused. |
| false | true | Executed failure with present stopping decision. |
| true | true | Impossible under both current producers. |

The reuse writer fixes stop false; the executed writer fixes reused false. E1
therefore gives 4/3. Payloads are not three uniform success states. `ran` includes
imprecise failure and must never imply permission to write a successful proof.
Active mode can miss, shadow can hit and execute, and empty failures cannot
distinguish passed execution from reuse. Missing run/decision maps to ran; missing
duration retains fallback zero. Preserve those defensive cases without claiming
they are all produced by the normal singleton collector. Collect-all still
ignores a stopping contribution for scheduling.

The fresh private finite model covers nine admitted/defensive payload abstractions,
two policies and two prior-latch states (36 checks). It compares old/new reuse
attribution, stop latch, proof-attempt eligibility and event ordering. It is a
standalone model, not product execution or coverage of arbitrary synthetic bags.

## Target schema

Add annotated `GithubCheckLaneContribution` and its same-name derived type in
`Quality.schemas.ts`, using an unannotated
`LiteralKit(["reused", "ran", "stop-after-red"])` base and
`withLiteralKitStatics(base)` after annotation to preserve helper access. Supply
normal exported JSDoc. The current `Quality/index.ts:56` wildcard exposes the
literal intentionally; the carrier remains private.

Reuse `GithubCheckLaneRunStatus.is.reused` and
`GateRedSchedulingDecision.is["stop-after-red"]` to classify payloads.
The status kit cannot represent continuing versus stopping failure; the red-decision
kit cannot represent successful execution or reuse. R27's pre-execution disposition
is a different owner. Do not alias those domains or invent another Boolean bag.

Replace the private type with an annotated S.Class at its current Tasks owner,
using exactly these common fields:

```ts
{
  lane: S.toType(GithubCheckLaneSpec),
  session: S.Option(S.toType(LaneProofSession)),
  laneRun: S.Option(S.toType(QualityTaskLaneRun)),
  failures: S.Array(S.toType(QualityTaskFailed)),
}
```

Import GithubCheckLaneSpec as a runtime schema and upgrade the current type-only
LaneProofSession import. Tasks already imports $RepoCliId; establish one local
composer for the carrier rather than adding a duplicate identity import. Reuse
existing S, run and failure schemas. The local Effect reference Schema.ts:2468–2502
confirms type-side extraction; 13459–13518 confirms runtime Option validation.
This is a technical transfer carrier at its sole implementation owner. Its private
placement is explicit for P3 review; do not quietly export proof-session internals
or add a role file during implementation. The reusable literal stays in the
existing schema role. No boundary codec or normalization is introduced.

Both producers construct the complete four-field class. Derive a contribution
once at the start of each serial outcome fold using a private pure view: present
reused laneRun => reused; otherwise nonempty failures plus present stopping
red decision => stop-after-red; otherwise ran. Use schema/Option/Array helpers.
Do not store the contribution back on the carrier or reconstruct two flags.
The classification relies on the inspected producer invariant that only active
reuse produces reused run status and that branch has empty failures. It is not a
new contract for arbitrary inconsistent synthetic outcome objects.

## Migration inventory

| Current location | Required change and preservation |
| --- | --- |
| `Quality.schemas.ts`; `Quality/index.ts:56` | Add only the documented contribution kit/type to the existing schema role and automatic export. |
| `Tasks.ts:1980–1987` | Replace the private two-bit carrier with complete four-field schema class and private derived view. |
| `Tasks.ts:2001–2016,2027–2036` | Delete the two Boolean writes from each producer; retain every payload and existing execution/preparation/logging behavior. |
| `Tasks.ts:2039–2059` | Remove the reused side of the persistence OR guard. Only ran dispatch reaches this helper; keep the independent nonempty-failure return, Option session and duration fallback, unchanged persist call and caught warning. |
| `Tasks.ts:2098–2108` | Compute contribution once. Match reused for active ID attribution, retain common optional journal append then failure accumulation, match stop for policy latch, and finally dispatch proof attempt only for ran. No early return skips common work. |
| `Tasks.ts:2073–2097,2111–2130` | Retain chunk concurrency, sequential chunks, stopped-tail journals, ordered results and skipped/reused/failed/passed precedence. |
| `Tasks.ts:2167–2243,2337–2344,3848` | Preserve inter-wave stopping, complete reports/firstRed/skipped counts, public default concurrency 1 and test collector mode-before-concurrency signature. |
| `Quality.command.ts:774–794`; lane specifications | Retain tier concurrency, evidence order, lane IDs/step labels, tier metadata, arguments and failure policy. |
| `internal/LaneProofReuse.ts:86–96,202–339` | Import session schema; no proof model/API change. Keep all seven identity fields, applicable full ambient hashes, volatile exclusions, refreshed identity comparisons and atomic merge writes. |
| `Quality.errors.ts:191–222` | Reuse full QualityTaskFailed including label, command and exitCode; preserve error values and rendering. |
| Existing Quality test facade | Keep collector seam. If testing the literal directly, add it to the current explicit schema export list; do not export the carrier/view just for tests. |

All source payloads remain Options/arrays as before. Do not narrow session/run to
Some, strip failure fields, fabricate a default run, or invent per-case payload
restrictions. A wrapper that internally skips work still reports its ordinary
executed result; it does not become reused or unlaunched-tail merely because no
underlying work was selected. No manifest/dependency/lockfile changes are needed.

## Guard-deletion accounting

Delete the two declarations at 1985–1986 and four write slots at 2014–2015 and
2032–2035. Remove the reused Boolean read in persistence's OR gate at 2042,
the reuse gate at 2099 and outcome.stopAfterRed at 2107. Exhaustive literal dispatch
retains attribution, proof eligibility and policy behavior.

The legitimate nonempty-failure/optional-red classification moves once from the
execution writer into the pure view; it is not deleted logic. Keep failure-only
proof exclusion for ran, because imprecise failed lanes continue but cannot
persist success. Keep optional run/session/duration handling, previous stop latch,
fail-fast policy, exact proof checks, warning handling and skipped-chunk behavior.
No fictional coherence filter or combined-true normalizer receives credit.
R27's pre-execution conjunction/log/bypass receives zero credit here.

## Encoded-side impact

The private carrier and derived contribution never enter a codec. Preserve
`github-check-run/v1`, `quality-task-lane-run/v1`, `yeet-lane-proofs/v2`, all lane
IDs, stage/wave/status and every nested field. Reused run retains commandText,
absent timing/exitCode/red decision and inputDigest None (encoded null). Executed
runs retain actual timing, exit code, commandText and observed red decision.
Other absent optional keys stay omitted by the existing codecs.

The fold order remains reuse attribution, optional journal/run append, failures,
stop latch, proof attempt. A reused or stopping contribution skips successful
proof persistence; ran still checks failures. Non-stopping failed work therefore
remains failed and does not gain a proof. Session/identity refresh may reject an
otherwise eligible success. Preserve nonfatal warning behavior. Concurrent logs
may interleave, but journals and proof writes remain serial in declaration order.
S.Class construction adds validation over schema-produced inputs; implementation
must verify payload equality and error behavior rather than adding new narrowing
or defaults. Apply actual release policy to the intentional additive schema
export; do not infer a blanket bump or blanket exemption from this design.

## Test impact

Retain current fixtures: precise red (1772), imprecise red (1824), estimate-less
red (1859), collect-all (1885), exact proof marker (1909), fallbacks and environment
identities (1942–2184), missing base/cross-wave/history/tree/volatile/mutation/
linked-worktree cases (2187–2410), failed proof rejection (2414), declaration-order
concurrent journaling (2473), and next-chunk stopping (2529).

Add behavior assertions for reused commandText in returned lane report and journal;
compare precise and imprecise failures so both remain failed while only one stops
fail-fast scheduling. Add imprecise failure repeat execution proving ran does not
persist success. Exercise a concurrent chunk mixing reused/pass/imprecise failure/
stopping failure and a later tail under fail-fast and collect-all; preserve actual
overlap, first-declared red, failure order, complete journals and serial proof merge.
A run has one proof-mode override; cover shadow execution separately.

The fresh finite model includes missing run, missing decision and missing duration
abstractions without widening the public API for tests. Product-level equivalence
must still be checked through real fixtures and existing report/ledger codecs,
with controlled clocks where byte comparisons depend on time. A three-literal
schema test can supplement behavioral tests but cannot substitute for them.
After P3 and campaign admission, run focused Quality tests, full
`bun run beep quality package-verify @beep/repo-cli`, then canonical Yeet proof
for the ordered Tier1E batch. This P2 audit ran no package tests.

## Risk

The dangerous shortcuts are classifying by session policy, equating ran with
success, treating every failed run as stopping, narrowing Option absence, losing
commandText, or moving persistence into concurrent workers. The source-bound
classification and explicit event order prevent those design errors. A future
producer emitting new run statuses must trigger re-audit; arbitrary unsupported
synthetic carriers are not covered by this equivalence argument. Private carrier
placement and constructor validation remain explicit P3 review points. No P3,
implementation or completion is claimed.


## R39 current payload preservation supplement

This supplement binds the source at `220d9426dad4b708807b6297cb71d75449288749`
(the relevant source bytes equal the original R39 census snapshot). Preserve
all earlier semantic obligations and historical receipt bindings. This is a P2
proposal, not independent review or implementation approval.

The complete `QualityTaskLaneRun` at `Quality.schemas.ts:1304–1321` now also
carries `inputPackages`. Its `LaneInputPackages` schema at1257 defaults to an
empty string array on construction and decoding. Active reuse at
`Tasks.ts:2044–2059` omits this field and must retain that existing empty default.
Executed lane runs at1834–1859 receive both `inputs.inputDigest` and
`inputs.inputPackages`; preserve the complete nested lane run through the
outcome migration and report/journal writers. Never project it down to the
previously enumerated fields or remove package scope from encoded reports.

Current input-resolution helpers at1900–1954 retain the digest and package
scope together. Declared inputs, failed steps and missing digest sources keep
an empty scope; successful Turbo digest reads supply the existing derived
package list. Do not add package scope to the reuse identity or invent
additional validation constraints in this boolean migration. This independent
payload evolution does not change either owner's four/three Boolean relation.

Preparation at2035–2037 now maps errors to `QualityTaskConfigurationError`.
Keep the wrapper and diagnostic. Reusable/activeReuse remain2038–2039;
hit logging2040–2042 and bypass2043–2059 preserve their prior meanings.
Completed outcome type2021–2028 and writers2044–2059/2070–2079 retain their
separate ownership and guard accounting.

Implementation verification must include package-scope preservation for an
executed run, existing empty default for active reuse, and decoding an older
report without inputPackages. Confirm exact report and journal payloads using
the current fixtures. This supplement does not claim those tests have run;
current test-location reconciliation and independent review remain pending.


## R39 source and test reconciliation (authoritative current map)

Bound to HEAD `220d9426dad4b708807b6297cb71d75449288749`. This appendix supersedes older numeric
locations for the files listed here; it preserves earlier design semantics and
immutable historical evidence. It grants no blanket P3, implementation or dry credit.

Retain 4/3 completed owner and full Option laneRun/session/failure payloads. Parent supplement preserves nested inputPackages/defaults and preparation mapping. Preserve Crypto-backed preparation/persistence distinctions described for the R27 companion, and fold order: reused attribution, optional journal, failures, stop latch, proof attempt. An imprecise failed ran contribution cannot persist success. Reused and stopping contributions stay distinct from ran; collect-all scheduling retains its policy.

Current Tasks.ts landmarks: raw test state239, parser315-329, normalized writes324-326, alias347; coverage carrier256-264, raw parser644-654, nonaffected resolver685-699, resolver862-955, selected/noop writers933-951, validator975-977, coverage step2543, selected adapter3396, raw step adapter3457, selected executor3535, root coverage3551, root test3620, root dispatch3669. Proof outcome2021-2028, session preparation2035-2037, phase locals2038-2039, reuse2044-2059, executed outcome2070-2079, persistence2082-2102, wave2116, ordered fold2141-2152, wave collector2210, public runner2381 and test alias3895. These are symbol/branch anchors, not a uniform offset.

Tests retain their existing Effect-based harness and NodeCrypto layer. In quality-tasks.test.ts, legacy lane/report inputPackages decoding is1241-1274; crypto failure distinctions are2014-2050; concurrent ordered journaling2520 and next-chunk stop2576. Coverage scoped replacement fixture is near3902; normalized selection fixtures7846/7855; SQL fixtures7097/7142/7165. Existing tests are supporting inventory, not execution evidence for this migration. Complete test-name locations follow.

### Current named test locations

- `packages/tooling/tool/cli/test/quality-tasks.test.ts:838` — routes explicit and legacy github audit modes to script checks
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:952` — maps repo-quality github checks as independent collector lanes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:999` — plans every deterministic cheap gate in one preflight wave
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1041` — names every registered lane after its command with the label as its log prefix
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1072` — dispatches every replayable required lane through the hosted beep ci lane argv
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1104` — carries a quarantine package filter into the nested check lane's Turbo invocation
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1137` — pins direct CI Turbo lanes to a requested local-only cache
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1160` — keeps the ts2589 flake quarantine on the dispatched check lane
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1171` — maps repo-sanity github checks as collector lanes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1219` — decodes the failure policy and wave report schemas
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1241` — decodes legacy lane rows and encodes unknown input digests as null
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1275` — records timings, exits, and only executor-provided lane digests
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1299` — tolerates an outcome whose mutable lane source disappears while the step runs
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1316` — emits machine-readable lane reports from both wrapper writers
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1335` — hands a wrapper lane a ledger and records the digest its child declared
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1471` — appends schema-versioned lane rows and ignores malformed side-channel rows
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1510` — rebuilds an unscoped lane report from an unscoped artifact
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1558` — falls back when a lane artifact is missing or belongs to another parent
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1605` — retains each completed inner lane when its wrapper is interrupted
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1656` — retains completed streaming lanes before the group returns
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1706` — property: the wave report schema round-trips arbitrary reports
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1719` — must-fail fixture: changing the seed changes order and unknown lanes retain declaration order
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1868` — stops later quality-mode waves after an estimate-less red
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1894` — runs later waves under collect-all
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1917` — reuses only exact lane proofs and invalidates them when the virtual tree changes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1950` — isolates lane-proof defaults and persistence guards from the parent process environment
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:1986` — disables lane-proof reuse when the virtual tree cannot be created
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2014` — surfaces platform crypto failures while identifying and staging lane proofs
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2052` — invalidates a lane proof when the property-test run floor increases
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2081` — invalidates ordinary lane proofs when inherited execution settings change
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2129` — invalidates a lane proof when an inherited ambient input changes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2159` — includes the complete ambient environment for local-env lanes with an isolated spawn
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2197` — omits ambient inputs from proof identity when the lane spawn is isolated
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2234` — runs the lane when the configured proof base cannot be resolved
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2266` — merges successful lane proofs across waves
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2294` — invalidates history-sensitive proofs after a same-tree history rewrite
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2338` — rechecks a later-wave proof after an earlier wave changes the tree
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2381` — never reuses volatile OSV security proofs
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2404` — refuses to persist a proof when the lane changes the virtual tree
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2433` — uses a temporary proof index from a linked worktree git path
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2460` — does not persist a proof for an injected lane failure
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2520` — keeps wave-order attribution and journaling when cheap gates run concurrently
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2576` — stops fail-fast scheduling at the next chunk boundary when lanes run abreast
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2613` — runs every cheap gate through the collected runner when all lanes pass
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2705` — collects multiple failures through the cheap-gates runner without stopping later lanes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2761` — accepts the current packet state with audit, dead-code, and health as promoted pre-push lanes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2854` — keeps wired pre-push Fallow lanes in parity with authoritative promoted matrix lanes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2878` — does not wire removed Fallow dupes or reuse clone lanes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2955` — rejects a wired Fallow lane whose matrix row is not promoted
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:3049` — includes repo-level tsgo diagnostics for affected root check lanes
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4284` — rejects legacy schema versions after the per-file migration
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:4974` — shards a wide selection like the full lane, prebuilding only the selected owners
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5308` — fails a raised file row the lane does not reach and names both numbers
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5331` — passes a raised row the lane reaches
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5374` — fails raised rows whose file the lane did not measure
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5414` — passes a raised package total the lane reaches
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5537` — adds a tighten advisory when the lane measures above the lowered floor
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:5671` — fails when the pull request removes a row for a package the lane still measures
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7097` — builds the integration lane command with shared SQL environment
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7326` — quarantines distinct TS2589 tasks exposed by resumed lane runs
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7524` — delegates affected root lint only to the affected aggregate repo lint lane
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7846` — selects the flagged lanes and keeps the remaining arguments in order
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:7855` — runs both lanes when no lane flag is present

The private review also supplies source-location-maps.json with exact unchanged
line blocks and explicit changed blocks, plus symbol-locations.json/test-locations.json.
Use named sites for implementation; never apply a uniform offset across changed code.
No tests were executed for this read-only reconciliation.

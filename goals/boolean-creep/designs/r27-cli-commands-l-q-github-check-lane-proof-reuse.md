# r27-cli-commands-l-q-github-check-lane-proof-reuse

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Status remains designed, Tier 1, derived/internal, 4 representable / 3 legal.
This replaces historical locator overlays with current source anchors. It grants
no implementation, independent review, or census credit. Paths below are relative
to `packages/tooling/tool/cli/` unless stated otherwise.

## Current shape

`src/commands/Quality/Tasks.ts:1989–2037` owns `runGithubCheckLane`.
After preparation at 1994, it derives `reusable` at 1995 and
`activeReuse = reusable && O.exists(session, prepared => prepared.mode === "active")`
at 1996. These are actual simultaneously scoped Boolean values, not function
parameters or callable predicates. Readers at 1997–2000 choose hit logging and
execution bypass. The optional session retains records, identities, mode and path.
The pair is neither stored nor encoded.

`GithubCheckLaneOutcome` at 1980–1987 is a distinct completed-work owner. Its
`reused` and `stopAfterRed` migration belongs to the R30 companion design, not
this pre-execution pair. The three-way disposition does not replace that outcome.

## Cardinality gap

| reusable | activeReuse | Legal meaning |
| --- | --- | --- |
| false | false | Miss: absent preparation, absent exact record, or excluded volatile lane. |
| true | false | Shadow hit: exact record under shadow mode; execute the command. |
| true | true | Active reuse: exact record under active mode; bypass the command. |

False/true contradicts the sole producer at 1996. Four Boolean pairs therefore
represent three legal states. An active session may miss: policy mode is not the
result domain. `internal/LaneProofReuse.ts:202–255,279–287` provides actual
preparation/lookup; `test/quality-tasks.test.ts:1909–1939` contains a real Git
repository and marker fixture for initial execution, active reuse, shadow execution,
and changed-tree invalidation. This audit inspected the fixture; it did not run it.

## Target schema

Define `GithubCheckLaneProofDisposition` in the existing `Quality.schemas.ts`
role as `LiteralKit(["miss", "shadow-hit", "reused"])`, with identity annotation,
same-name derived type, and exported-symbol JSDoc. Keep an unannotated base and
reattach the required literal helpers with `withLiteralKitStatics(base)` after
annotation. Use its Enum/is or match helpers instead of duplicating literals and
predicates. Existing `commands/Quality/index.ts:56` wildcard intentionally exposes
this schema; no new barrel alias, role file, service or package is needed.

Existing `LaneProofMode` expresses off/shadow/active input policy;
`GithubCheckLaneRunStatus` expresses completed outcomes; Yeet's `ProofReuseDecision`
is a different payload-bearing ledger protocol. None is a substitute for this
three-case pre-execution decision.

Immediately after session preparation, derive one disposition with Option matching
and exactly one existing `hasReusableLaneProof` observation for a present session.
None or a failed lookup yields miss; a successful lookup yields shadow-hit or
reused according to the session mode. Retain the original session payload. Remove
both Boolean aliases. A literal is sufficient: no payload-bearing tagged classes,
compatibility Boolean bag, new codec, or unrelated outcome refactor is needed.

## Migration inventory

| Current owner / consumer | Required preservation |
| --- | --- |
| `Tasks.ts:1994–2018` | Replace only decision derivation and readers. Active reuse returns the same lane/session, Some lane run, empty failures and completed-outcome semantics. |
| `Tasks.ts:2005–2012`, `Quality.schemas.ts:1247–1260,1293–1309` | Reused run keeps id, label, status reused, inputDigest None, commandText Some(actual command and args), and absent timing, exitCode and redSchedulingDecision defaults. |
| `Tasks.ts:2019–2037` | Miss and shadow share the existing live execution path, per-lane collector concurrency 1 and ignored lane observer. Retain A.head optional run, all failures and precise-red decision. |
| `Tasks.ts:2039–2059` | Completed-work persistence stays successful-only, excludes reused outcomes, preserves optional duration fallback 0 and optional session, and catches persistence errors as nonfatal warnings. R30 owns these outcome guards. |
| `Tasks.ts:2073–2112` | Keep chunk size Math.max(1, concurrency), concurrent members, sequential chunks, declaration-order fold, serial journal append and serial persistence. Already-started members finish; precise reds stop only subsequent chunks. Skipped chunks do not prepare sessions. |
| `Tasks.ts:2114–2130,2167–2243` | Keep skipped/reused/failed/passed precedence, inter-wave stopping, complete reports, firstRed and skipped counts. |
| `Tasks.ts:2337–2344,3848` | Preserve public runner default concurrency 1 and test signature (label,waves,policy,mode?,concurrency=1). |
| `Quality.command.ts:774–794` | Keep configured tier concurrency and evidence-ordered caller. Do not change lane IDs, declared order, tier metadata, command args or wrapper success semantics. |
| `internal/LaneProofReuse.ts:22–28,202–255,257–339` | Preserve off fallback, mixed-cwd/empty/failing-Git fallbacks, exact lookup, volatile exclusions, refreshed identity equality, record merge and atomic rename. |

The exact identity remains laneId, commandHash, inputHash, mergedTreeSha,
headSha, baseSha and envProfileHash. Same tree with changed history still invalidates
history-sensitive proofs. Virtual-tree preparation uses a temporary Git index
resolved through the checkout Git path, including linked worktrees. Proof records
remain `yeet-lane-proofs/v2`. Failed commands and tree-mutating commands cannot
create a reusable proof; later waves prepare against their then-current tree.

`LaneProofReuse.ts:124–139` hashes the complete inherited environment when
useLocalEnv is true or the spawn extends ambient environment. Isolated spawns omit
that contribution; explicit lane environment, platform, architecture and Bun/Node
versions remain. `src/internal/cli/EnvConfig.ts:544–547` supplies the existing
spawn predicate. Preserve it; never persist raw environment values. The excluded
IDs remain quality:security and repo-sanity:bun-audit because advisory data is live.

## Guard-deletion accounting

Remove the two local Boolean aliases at 1995–1996. Replace the hit gate and log
ternary at 1997–1998 with disposition dispatch; replace the active branch at 2000
with the derived reused case. Share the miss/shadow execution path. No schema
coherence filter or normalization guard exists here, so none can be credited.

Do not double-count the separate outcome's reused branch at 2099 or its persistence
guard at 2042. Do not delete failure policy, stop state, optional-run handling,
proof identity checks, exclusion rules, or persistence guards. Do not recreate the
two sibling flags under different names after introducing the literal.

## Encoded-side impact

The disposition remains transient and adds no report or ledger key. Preserve
`github-check-run/v1`, `quality-task-lane-run/v1` and `yeet-lane-proofs/v2`.
InputDigest None still encodes as null; OptionalLaneRun fields retain their omission
semantics. Preserve actual commandText in both returned report and journal. Keep
lane IDs, stage/wave/status, payload Options and journal order.

Logs remain exactly `[lane-proof] shadow hit for exact lane proof: <lane-id>` and
`[lane-proof] reusing exact lane proof: <lane-id>`. A miss emits neither. Concurrent
logs may interleave; do not impose global log ordering. Journals and ledger writes
stay serial in declaration order. Active reuse does not execute or repersist a
new success; shadow execution can fail and must report that real failure. Preserve
persistence-warning text and timing. The additive schema export is intentional;
apply actual release policy at implementation, without assuming a version bump.

## Test impact

Retain the existing marker fixture at 1909–1939 and add exact hit-log, command
bypass, returned commandText and journal commandText assertions. Add a shadow-hit
failure using the real repository fixture so a hit never fabricates success.
Retain preparation fallbacks (1942–2003), explicit/ambient/local/isolated environment
identity tests (2006–2184), missing base (2187), cross-wave merge (2220), same-tree
history rewrite (2248), later-wave tree refresh (2292), volatile exclusion (2335),
mutation (2358), linked worktree (2387) and failed-proof rejection (2414).

Preserve concurrent wave-order/first-red/journal tests at 2473–2527 and next-chunk
fail-fast at 2529–2564. Cover mixed reused/live members while preserving serial
proof writes. A single run has one proof-mode override; do not invent a fixture
requiring shadow and active modes simultaneously within that same run. Test
shadow/live and active-reuse/live mixtures separately. Preserve tier concurrency
and lane topology assertions.

Implementation must run focused Quality tests, full
`bun run beep quality package-verify @beep/repo-cli`, then canonical Yeet checks
for its ordered Tier1E batch. This P2 audit ran no product/package tests and makes
no green implementation claim.

## Risk

Confusing mode with disposition would reuse misses. Confusing shadow with active
would bypass required commands. Moving journal or ledger writes into the concurrent
lane body would lose ordering and atomic merge safety. Dropping commandText or
collapsing an Option would alter repair/report behavior. Keep the pre-execution
literal and completed outcome separate while their coordinated batch replaces
both owners. Independent P3 and the campaign implementation gates remain pending.


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

Retain 4/3 pre-execution disposition; an active session can miss, and shadow still executes. Retain complete session/lane payloads. Parent payload supplement is accepted: inputPackages default [] for reused rows, full executed package scope, and preparation configuration-error wrapper. LaneProofReuse now uses Effect Crypto: index identity/virtual-tree failure remains None fallback; command/input/environment digest failures surface typed errors; staging identity failure is caught by the existing nonfatal persistence warning. Preserve Crypto requirements, sequential identity effects and source failure boundaries; do not broaden all preparation errors into cache misses.

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

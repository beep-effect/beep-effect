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

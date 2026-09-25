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

# P0f round 1 integration evidence

Status: open. Focused handoffs are accepted, but the canonical scanner misses
D4's timing bound. No baseline or generated packet inventory has been refreshed.

## Accepted focused handoffs

The initial detector and its same-session follow-up are terminal 0 and joined.
The final follow-up passes 93 tests across four suites (Node 24.20.0, 19.66s),
focused tsgo and read-only Biome. Root verifies the fourteen final input hashes,
all retained command/log hashes, and the runner's five input hashes. Across
883 source/config inputs there is no unexpected drift since the accepted P0e
source surface. The graph differs in exactly three entries, retaining the other
82 entries, all pin fields and all source anchors.

Runner Node and actual primary-pin Bun 1.4.1 focused proof remain accepted. Its
wider private fixture compiler has 22 attributed inherited diagnostics; this
receipt does not recast that check as green. Actual package verification is
still required. See history/2026-09-09-p0f-runner-validation.md.

## Full-scan timing failure

Root ran the real scanner with --rows targeting private evidence. It exits 0
and scans 1,075 files, but takes 34.197s process wall / 32.089s scanner time,
exceeding the ten-second bound. Cumulative discovery/project/detection times
are 77.8ms / 862.5ms / 31,707.3ms. Child CPU is 49.855s. CPU and memory pressure
are near zero; nonzero host I/O pressure is retained without claiming it
explains the detector CPU cost. Source hashes and every canonical artifact
hash remain unchanged. This successful exit does not pass D4.

The same Codex CLI conversation is now profiling the combined occurrence-anchor
and helper-reachability surface. The contribution of each is not yet known.
It owns the existing detector files/tests and a new private evidence directory;
the graph is frozen. Private representative scans are allowed, but no
canonical writer, package audit, dependency or policy change. Correctness,
syntax-only analysis and all 93 tests must be preserved. Root will verify
final output equivalence and rerun the timing gate before package acceptance.

## Preliminary artifact delta disposition

The schema-decoded preview contains 7,417 distinct IDs and canonical keys, all
open and all carrying v2 anchors. The unchanged bootstrap baseline contains
5,016 open rows and no anchors/exceptions. This is increased detector coverage,
not test migration or an exception waiver.

The actual membership comparator reports 3,514 introduced and 1,113 resolved
rows. Of these, 1,120 introduced and 1,112 resolved rows retain a legacy
fingerprint but require multiplicity/identity review under the explicit v2
transition. There are 2,394 newly exposed fingerprints. Root reviewed their
rule/class/mechanization digest: the largest additions are 1,050 unresolved
provider judgments, 438 data assertions, 270 layer-hook timeout judgments,
192 platform candidates and 148 wrapper definitions. The additions align with
the repaired provenance, callback and helper coverage. Six shared TestClock
judgments now exercise EV015 in the live repository.

Exactly one old fingerprint disappears: DuckDb.service.test.ts line 644's
interruption-subject sleep. The same operation remains as an open
controlled-clock-wait judgment, matching the R1-004 disposition. No existing
finding is silently excused. Uniquely matched legacy rows have zero semantic
field changes; two import findings move by one line after test edits, and two
EV014 hints gain the standalone timeout alternative from R1-013.

This preliminary delta is consistent with the intended repairs and can be
retained as the optimization-preservation reference. It is not yet an
authorization to refresh canonical artifacts: final optimized output must
match it (or explain each additional delta), the timing and package gates must
pass, and the canonical writer/default ratchet/census audit must be completed.
All judgments remain open for the later lens inventory; no P1/P2 work begins.

Private evidence: p0f-round1-integration-handoff-check.json,
p0f-round1-preview.json/.log, p0f-round1-preview-rows/,
p0f-round1-preview-delta.json and p0f-round1-preview-delta-digest.json under
~/.cache/beep/effect-vitest-canon/.


## Profile attribution checkpoint

The unchanged-input profile independently reproduces the slowdown at 34.697s
process wall / 31.077s scan. Root verifies all fourteen before/after hashes
against its pre-optimization handoff, the scan log hash, and exact equality of
all 7,417 row payloads with the original preview. Sampled inclusive cost for
resolveEffectVitestBinding is 10.784s; helper reachability is 2.597s and
occurrence anchoring is 2.393s. Those costs overlap and must not be added.
The lane is optimizing repeated lexical resolution within each file's analysis
context. A fast final scan with preserved output remains required.


## Workstation load and benchmark interpretation

Benjamin asked whether these measurements account for workstation load. They
retain host context, but are not isolated or numerically normalized benchmarks.
The supplied hardware inventory and live CPU identity confirm a 32-core /
64-thread Threadripper workstation; high peak specifications do not eliminate
scheduling, memory-bandwidth, cache, storage or power-state effects. The scanner
is primarily a sequential syntax walk and does not use the GPUs.

The original run recorded load averages around 7-13, near-zero CPU/memory
pressure and nonzero system-wide I/O pressure. Load average is not utilization.
The 34.197s run consumed 49.855 child CPU seconds; candidate4 consumed 17.372
child CPU seconds in 11.356s wall time. The profiles identify removed compiler
and structural-equality work, supporting a real implementation improvement,
without claiming a controlled machine-independent speed ratio.

Independent final timing and each canonical writer/ratchet step now record
CPU affinity/nice, visible ancestor CPU quotas/throttling, memory constraints
and events, available memory, child RSS/page faults/block I/O/context switches,
and the existing wall/CPU/phase/pressure metrics. Shared cgroup counters remain
context rather than scanner-only attribution. No system setting, other job,
cache state, timing threshold or source policy was changed. Near-threshold
results must be judged with these receipts; startup and scanner durations
remain separate measurements.

## Retained-output comparison checkpoint

Root independently compared fifteen completed performance/profile outputs
against the sealed 7,417-row preview. All fifteen log hashes and fourteen-input
before/after hash comparisons are valid. Thirteen outputs match every original
row payload exactly. The two other outputs, final-first and final-traversal,
retain every original payload and add the same single EV006 finding: the new
occurrence-digest regression initially asserted Option presence with assertTrue.
Its assertion now uses assertSome on the exact expected occurrence digest.
The later final-parameter-filter and isolated-context outputs again match all
7,417 original payloads, with zero additions, removals or changes. This resolves
the output delta by using the canonical assertion; no detector exception or
scope reduction was introduced.

Private Root receipts are p0f-round1-performance-root-retained-output-check.json
and p0f-round1-performance-root-extra-row-attribution.json. The performance
writer remains live, so this checkpoint accepts historical output attribution
only. Its first 96-test run passed; subsequent implementation edits still need
final focused proof, independent timing and package verification.

PLAN.md now records the same resource-context requirements for P1/P2 package
timings: exact runtime and concurrency settings, source identity, raw durations,
separate queue time and retained inconclusive measurements. The existing timing
summary shape and Benjamin's phase gates are unchanged.

## Engine-constraint correction

The performance experiment subsequently replaced the mandated ts-morph Project
with direct parser calls. Root rejected that change against D4, snapshotted all
fourteen scoped inputs, and gracefully interrupted the exact owned CLI process.
The CLI ended with exit 1 and its supervisor was joined; this is an intentional
Root intervention, not a passing handoff or an unexplained command failure.

The same detector conversation is resumed with a bounded correction: restore
the accepted Project/addSourceFilesAtPaths engine, preserve valid Syntax and
Detectors optimizations and all 96 tests, then provide final focused and timing
evidence. The isolated-context/direct-loading experiments remain historical
measurements and are not accepted engine proofs. Root's unlaunched independent,
package and canonical drivers now wait for the corrected terminal handoff;
timing and artifact approval gates are retained. The correction snapshot and
interruption receipt are under private p0f-round1-performance-d4-correction-root/.

## Corrected focused handoff and independent timing

The corrected lane is terminal with exit 0 and its supervisor is joined. Root
verified all fourteen final inputs against their snapshots and focused-command
hashes, all 883 retained source/config inputs, 5,136 non-owned source hashes,
the five runner inputs and every existing canonical artifact hash. Only the
four intended Syntax/Detectors/test inputs differ from the prior focused
handoff. Scan.ts exactly matches the accepted Project engine. All 96 tests,
focused tsgo and read-only Biome pass on these bytes. Root accepts this focused
handoff in p0f-round1-performance-handoff-check.json; it does not grant timing
or package acceptance. A private verifier initially assumed the detector
manifest shape for the runner manifest; its adapter was corrected before any
acceptance was written, without changing source or validation requirements.

The lane's final canonical command took 10.452936s process wall / 8.4606s scan.
Root's independent command took 10.885s wall / 8.947s scan and consumed 16.748
child CPU seconds. Both retain all 7,417 original full finding payloads. Root
also verified zero row additions, removals or modifications, unchanged source
hashes and unchanged canonical artifacts. The command exits 0, but the Root
proof harness exits 1 because its complete-process ten-second bound fails.
This near-threshold result is retained rather than rerun until favorable.

The independent run had 64 allowed logical CPUs, no finite quota in the five
visible cpu.max values, no observed quota-throttling delta and zero child major
page faults. Host CPU pressure averaged about 2.85-3.44 percent over the recent
ten-second windows, with nonzero I/O pressure and roughly 68-73 GiB available
memory. These are measured context, not proof that contention explains the
timing miss. The 1.938s outside-scanner difference is not independently measured
startup time. Full counters are retained in
p0f-round1-performance-root-proof-status.json.

Benjamin has been asked to clarify the packet's full-scan versus complete-lint
timing wording. Until he specifies otherwise, the stricter complete-command
gate remains. The same CLI conversation is now performing one read-only
residual-cost profile, with no source edits, in p0f-round1-residual-profile/.
Package verification and canonical writes remain pending. The prepared final
artifact audit adds independent census owner/byte/line and approved-payload
checks after those gates; it has not run yet.


## Residual profile accepted; final bounded cache candidate

Root independently verified the single residual profile, all 14 scoped source
snapshots, protected source hashes and exact 7,417-row output. The profile
identified role indexing and lexical resolution as bounded candidates; inclusive
costs overlap and do not establish predicted savings. The full attribution is
in history/lanes/p0f-round1-detectors.md and the private residual-profile receipt.

The public kind-query implementation passed its focused proof but regressed to
13.368339s complete command / 11.3473s scanner, so that source change was restored.
The second candidate caches lexical scope/name results, including misses, while
retaining the existing scope walk and binding table builder. It records 98
passing focused tests, compiler/Biome exits 0, and 9.459970s full command / 7.6438s
scanner. All existing 96 tests remain; two regressions cover role-array order and
shared-cache resolution versus fresh lookups in either reference order. Scan.ts,
Detectors.ts and the primitives graph retain their frozen hashes.

The complete-row comparison retains all 7,417 canonical identities. Exactly two
existing EV006 findings in the owned detector test move from lines 302/312 to
307/317 because its import section gained five lines. Their IDs reflect those
locations; all other fields, including full occurrence anchors, are identical.
The other 7,415 complete rows and 132 of 133 JSONL files are byte/payload unchanged.
Root has inspected the source diff and prepared an explicit two-row attribution
check; this is not an assertion of byte equality with the original preview.

The candidate timing is one unprofiled canonical observation. CPU PSI some avg10
was 0.83 to 0.30%, memory 0.13 to 0.04%, and I/O 0.02 to 0.00%; these host counters
qualify the result and cannot numerically explain its difference from prior runs.
Independent Root timing on the terminal final handoff, full package validation
and reviewed canonical refresh remain separate gates. The old 10.885s miss and
all rejected candidate receipts remain available.

A private draft for round 2 selects 20 tests not reviewed in round 1, across 18
owners (5 app, 2 infrastructure and 13 package files), including all 15 detector
classes and zero-row controls. Three unavailable census-feature strata use the
recorded deterministic negative-control fallback. Selection totals 287,584 bytes
and 209 existing detector rows. Source and row inputs must be resealed after
round 1 closure; no round 2 reviewer has started.


## Final focused acceptance and unchanged-source variability

The role-cache CLI lane exited 0 and was joined. Root independently accepted
its 98-test/compiler/Biome handoff, verified all 14 final input bytes, 5,136
retained non-owned sources and five runner inputs, and proved that the only
output changes from the original preview are the two reviewed import-only
location shifts. Existing test bodies are unchanged; the additional regressions
are appended. Receipt: p0f-round1-role-index-handoff-check.json.

Independent canonical timing exited 0 for the command but 1 for its timing
assertion: 11.130s complete command / 8.9749s scanner, 17.162s aggregate child CPU.
Its 7,417 full payloads exactly match the accepted final candidate, with no source
or canonical artifact change. The process had 64 allowed logical CPUs, no visible
quota-throttling or memory high/max/OOM event delta, 122 major faults, and about
65.98-66.78GiB available host memory. Historical swap occupancy by itself does not
prove active swapping; this receipt did not capture swap-in/out deltas.

Root then ran a predefined three-observation variability sample, preserving all
results and adding host vmstat deltas to the existing resource context. It used
the same Bun 1.4.1/Node 24.20.0 runtime and accepted source bytes. All three
commands exited 0, with source/artifact integrity and exact full payload equality.

| Final-source observation | Full command seconds | Scanner seconds | Child CPU seconds | Child major faults |
| --- | ---: | ---: | ---: | ---: |
| Implementation lane | 9.459970 | 7.6438 | 15.078981 | not captured in that receipt |
| Independent Root proof | 11.130 | 8.9749 | 17.162 | 122 |
| Fixed sample 1 | 13.842003 | 11.4883 | 21.268326 | 55 |
| Fixed sample 2 | 16.885761 | 13.7969 | 24.346658 | 116 |
| Fixed sample 3 | 13.914645 | 10.3767 | 20.699881 | 45 |

Across the three sampled runs, before/after CPU PSI some avg10 ranges 3.61-5.66%,
memory 0.20-0.62%, I/O 0.54-0.93%, and available memory 56.47-65.85GiB. Every run
records increasing host pswpin/pswpout and page-reclaim counters, so active
swapping and reclaim are observed. These counters cover the host and do not
quantify delay attributable to this command. The differing wall and child CPU
values establish runtime variability, not a load-normalized speedup or a precise
causal allocation. No process or system/cache/runtime policy was changed.

Evidence: p0f-round1-role-index-root-proof-status.json and
p0f-round1-role-cache-variability/run-{1,2,3}/receipt.json. All original receipts
remain retained. The fixed sample driver exited 0 for successful collection;
that status is explicitly not a timing acceptance. Both the full-command and
scanner-only bounds are exceeded in the three sampled observations.

The timing gate remains open. Full package correctness checks are now running
sequentially on the accepted frozen source, because that evidence is independently
useful while timing conditions are unresolved. Their driver requires the focused
handoff and mandated engine; canonical writes and final phase acceptance still
require the separate genuine timing approval. This separates independent proof
obligations without lowering the timing threshold. No new source optimization,
canonical inventory write, P0f closure or P0g publication has been accepted.


## Package audit failure retained; attribution in progress

The first full package command, `bun run beep quality package-verify
@beep/test-utils`, exited 1 after 63.302s with all source hashes stable. Docgen
passed (4.9s); audit failed (55.7s). The test result is 70 passed, one failed,
one expected fail, nine skipped and four todo across ten files. The failure is
`uses one absolute deadline and one lifecycle for a complete property run` in
Vitest.runtime.test.ts:212: child output lacks the expected `seed: 4242` text.
Its JSON reporter records a generic runner Error stack and duration 204.090641ms
for a fixture with a 180ms timeout. This evidence alone does not prove which
runtime timer fired or make the failure environment-only.

The sequential driver stopped after this failure; @beep/repo-cli has not run.
The exact log and failed receipt are immutable. Root resumed the existing runner
CLI conversation for bounded read-only attribution: inspect pinned deadline,
fast-check and reporter behavior, at most two focused unchanged-source
reproductions, then report a precise cause or limitation and a deterministic
repair plan. No source/test/timeout/floor changes are authorized in that lane.
New evidence belongs in p0f-round1-runner-audit-attribution/ and its corresponding
history/lanes report. Timing and package gates both remain open.


## Merged reconnaissance limitation correction

Root's round 2 sample check found that 50 merged class reports had split the
apps/infra lane's limitation string into characters. The package lane emits an
array; the original private aggregator iterated both shapes identically. Root
corrected that boundary and reprojected only those 50 `limitations` fields from
the unchanged raw lane inputs. No test-file membership, class count, evidence row,
method, source byte, detector inventory or canonical census was changed. The
original immutable round 1 corpus remains available with its original hashes.

The receipt and all 50 preimages are in the private
p0f-round1-census-limitations-repair/ directory. The repair independently checks
all non-limitation fields and all other reconnaissance files byte-for-byte,
plus the accepted 883 source hashes and canonical artifact hashes. This is an
additional Root artifact correction, not an invented Grok finding or a waiver.
Round 2 must receive the corrected merged reports when its inputs are sealed.


## Attribution accepted; bounded deadline correction dispatched

The read-only runner attribution exited 0 and was joined. Root independently
verified its 34 input/reference entries, all 883 accepted source hashes, the
immutable failed package artifacts, and both focused reproductions (one named
parent test passing under Node and Bun; eleven name-filtered registrations each).
The reporter information-loss path and sample/arming gap are accepted source
findings; the original failure trigger remains unproven. Receipt:
p0f-round1-runner-audit-root-acceptance.json.

Root chose the existing source-only test-kit convention for controlled watchdog
access, with an explicit source export and a null publish export. The public
Vitest surface, captured production live clock, TestEnv, timeout values, floors
and original behavioral assertions remain fixed. The new dated DECISIONS entry
records that boundary. The architecture command exits 0 before the new role file.

The same runner conversation is implementing the arming-time read, test-only raw
Vitest diagnostics and the controlled aggregate deadline regression. It must
prove a deterministic negative control for the former sampling logic, run both
full runner-focused suites under Node/Bun, then run the actual full test-utils
package verification before handoff. Its ownership includes the two private
instrumentation/runtime files, explicit test-seam package export entries, two
existing tests, existing runtime fixture and the named new test-kit/reporter
fixture. Every detector/scanner file and canonical artifact is frozen.

Previous package and scanner receipts remain immutable. New source inputs will
require a fresh protected-source reconciliation and private detector-row delta
review before canonical approval; old all-source proof hashes are not reusable
across this implementation. The pending canonical writer guards still require
real timing approval and both package proofs. Round 2 remains unstarted.

## Startup attribution accepted; upstream and test-alias integration prepared

The read-only startup lane exited 0 and Root joined its supervisor. Independent
verification matched all 2,236 unique current inputs, 181 original evidence files
and 16 new receipt hashes; the retained profile evidence path set is unchanged.
The report identifies one possible CLI bootstrap fast path through the existing
command, but required filesystem and workspace utilities still reach the schema
barrel. No speedup, source change, timing acceptance or package proof is implied.
Receipt: p0f-round1-cli-startup-root-acceptance.json. A new routing experiment is
not yet dispatched; final runner integration and base reconciliation come first.

The refreshed origin/main is 702e815971a4030806cdbd9e8f6aa9260d0d3b62. It includes
the merged filesystem PR and uses Bun 1.4.2, while this source checkout still uses
1.4.1. Effect and @effect/vitest remain pinned to 4.0.0-rc.112. The ordinary
committed-base merge preview reports conflicts, but HEAD's tree exactly matches
the historical main ancestor b24f7a93d99e79ca41ca48a3881d10655a481d12. A read-only
merge-tree preview using that verified ancestor exits 0 and produces exactly the
current main tree. This distinguishes history-related conflicts from the real
uncommitted goal delta; it does not authorize discarding either.

No working tree, index, branch or commit was changed by those previews. Once the
runner writer is terminal, preserve all dirty and untracked goal work with a
recoverable snapshot before reconciling main in this same feature worktree.
Refresh the census, runtime and full proofs after reconciliation; Bun 1.4.1
receipts cannot be presented as proof for 1.4.2. Private evidence:
p0f-round1-upstream-impact-20260909T1537.json,
p0f-round1-upstream-base-preview/receipt.json and
p0f-round1-upstream-equivalent-base-preview.json.

The runner's new explicit source-only test export currently loses to the frozen
workspace wildcard alias during child collection. The canonical command
`bun run beep tsconfig-sync --dry-run --filter @beep/test-utils` exits 0 and plans
exactly one root alias addition, with no updates or removals. Root made no config
write while the worker's tests were in flight. Source inspection also corrects
the earlier handoff assumption: this checkout's tsconfig-sync updates root paths
but does not regenerate vitest.aliases.generated.json. The quality check requires
that file to equal the complete compilerOptions.paths map. Scoped export
projection must be completed and checked after the writer stops; do not change
Vitest settings or alias matching semantics. Private-config diagnostic runs are
supporting evidence only until the canonical package configuration resolves the
entry and actual package verification passes.

## Final runner verification found a separate parent timeout

The first normal-configuration package proof for the deadline correction exits
1 in 49.011s: 70 ordinary passes, one expected failure, three alias collection
failures, nine skips and four todos. Audit fails; docgen passes. This evidence is
retained separately from the earlier one-failure package receipt.

The later final-byte Node run also hits the unchanged 30-second parent timeout
in the trace-gating test that launches four child fixtures. Three children
completed successfully; the fourth left no retained evidence. Root inspected
the final JSON: four failed parents under Node, three under Bun. The extra Node
failure is not another alias finding, and its startup-delay cause is unproven.
The still-live runner writer is simplifying raw-error reporting to use the
parent's existing filesystem service and retain partial evidence on cancellation.
Do not integrate main or write aliases while these source edits/checks continue.

The structural preservation check reports all 120 original assertion calls,
registration names, timeout/seed assignments and fcRuns calls retained. Controlled
positive and negative runs support the arming-time correction; they do not prove
the evolving final harness or canonical package configuration is accepted.
The final export audit also exposed an alternate role-filename publish route;
DECISIONS now requires the existing `./test/*: null` convention to complete the
source-only boundary, followed by isolated Node/Bun consumer checks.

Root refreshed main to a2030c8bd9124d1f0de8ae03a1eebbf5f1fa621f after the Atlas
reporting fix landed. The verified historical-tree merge preview remains clean
and produces exactly that main tree. The private main-integration preflight and
guarded dirty-file snapshot/projection scripts are prepared, not executed.
No stash, merge, branch switch, source/config write or commit has occurred.
Current packet doctor/index checks pass across 177 packets with no blocking
findings and four unrelated advisories; GOAL.md is 2,775 characters.


## Main integration and canonical alias completed

The prior runner finished on its own and was joined; Root sent no interruption.
Its final handoff was accepted for integration only. Normal Node/Bun/package
checks still failed the three missing aliases, and test/fixture diagnostics
remained unresolved. Every old failed receipt remains retained.

Root merged main e7b7d03e61 into the feature branch as 1d7993cee with ordinary
Git merge and all commit hooks enabled. The committed merge tree exactly equals
main before restoring the uncommitted goal. Frozen Bun 1.4.2 install exits 0 and
preserves the lockfile; installed Effect/@effect/vitest remain rc.112, Vitest is
4.1.11, and Node is 24.20.0. Main now includes the promoted filesystem and the
new declaration-based check overlays.

The recoverable snapshot and named stash remain retained. All 410 original
untracked files are byte-identical after restoration. Eleven nonconflicting
tracked paths match an independently reproduced clean three-way merge; the
remaining three match reviewed resolutions. Lint.errors retains main's new
TsconfigOverlayReadError plus both goal errors. GithubChecks and its test retain
main's current lane structure and add only lint:effect-vitest with the current
tier argument. No unmerged or staged entries remain. The two focused CLI tests
for cheap-gate planning and lint routing pass in 6.458 seconds.

Current canonical tsconfig-sync dry-run and execution both exit 0, adding one
root alias. The generated Vitest map was projected from root paths, formatted
with Biome, and verified semantically equal; all other aliases and all Vitest
settings/matching semantics are unchanged. Each config diff is three added lines.
The final formatted identity is recorded separately from the initial projection.

The same Codex runner task is now continuing the bounded canonical integration:
finish goal-authored test/fixture diagnostics, close alternate published test
paths, prove raw diagnostics on interrupted fixture scope exit, and run final
Node/Bun positive/negative, compiler and full test-utils package proof. Root is
not running a scanner proof against the live writer. New-main census/input
reconciliation, repo-cli package proof, timing acceptance and canonical artifact
writes follow a reviewed terminal handoff. Prior 883-input/7,417-row receipts are
historical and must not be relabelled as current proof.

Private receipts: p0f-round1-main-integration/{merge-commit,
goal-restoration-verification,goal-conflict-resolution,main-install,
tsconfig-sync,runtime-and-final-alias,quality-conflict-focused}.json;
p0f-round1-runner-deadline-root-handoff.json. The current continuation prompt
includes these actual integration preconditions.


## Current runner integration has green terminal proof

On the final formatted candidate, source, test and copied-fixture compiler
checks pass with no diagnostics. All 120 original assertions are retained;
172 are now present. Original timeout values, seeds, property floors and
registration modes remain, with only the equivalent positive-infinity spelling
normalized in the preservation comparison. No rule suppression was added.

Terminal complete Node and Bun runner suites pass in 89.536s and 52.818s,
each with 31 ordinary passes, one expected failure, two skips and four todos.
The deliberate old-deadline control fails the intended setup-budget assertion;
exact source restoration and the corrected control pass. Isolated final-source
and published-export consumers pass under both runtimes.

Full `bun run beep quality package-verify @beep/test-utils` exits 0 in 70.966s:
audit passes in 64.6s and docgen in 4.1s. Root independently verified 61 command
receipts/logs and the 887 protected inputs; changes are limited to authorized
runner paths. These receipts clear the previous compiler/alias/package failure
on the candidate, while earlier failures remain immutable.

The new cancellation test interrupts the parent fixture scope after its child
finishes and before temporary-directory finalization. It verifies retained raw
errors, monotonic abort phases and cleanup at that boundary. It does not
reproduce or attribute the earlier timeout during an unfinished child process.

The source task is assembling its final report/manifest. Root will join it and
recheck exact final hashes before accepting the handoff. New guarded preview
and CLI package drivers are prepared for Bun 1.4.2; neither has run. They retain
a complete live census/path-set comparison and full per-file finding deltas,
without writing canonical artifacts or granting timing acceptance. The scanner
timing gate, CLI package proof and remaining round-one closure are still open.

## Terminal acceptance, current package proof and scanner evidence

The source task finished with exit 0 and was joined. Root verified all eight
final source hashes, 1,608 private artifacts and 62 command receipts/logs before
accepting its final handoff. Earlier manifest-assembly status above is historical.
No source writer remains, and the green runner proofs were not repeated.

The first current preview stopped before scanning because the operator's Git
input snapshot omitted 27 ignored declarations returned by the unchanged D9
glob. The old canonical census already included 26 of these declaration files.
The omitted inputs and two private hash-helper preflight errors were retained
and recorded in OPPORTUNITIES; none was treated as a test or detector failure.
The proof order was corrected to finish package generation before freezing the
complete scanner input set, without changing discovery or excluding declarations.

Full `bun run beep quality package-verify @beep/repo-cli` exits 0 in 450.673s:
audit 431.3s, docgen 17.6s. Authored inputs and canonical artifacts are unchanged.
Three generated dist/test declaration outputs changed, including one newly
emitted support path. Root read and verified those outputs, then joined the
package supervisor. The final preview includes their actual post-package bytes.

The complete current census is 1,101 files: 991 tests and 110 support modules.
There are 26 additions, no removals and 393 byte-count changes relative to the
historical census; 368 of those also change line counts. No existing owner or
kind changes. The private detector output contains 7,580 findings, up from 7,417.
Identity-based comparison yields 4,069 additions, 3,906 removals and 200 changed
rows across 353 files. No affected file has both unchanged known source bytes
and unchanged owner. This does not by itself explain each row change.

The fresh full canonical command takes 9.221s (scanner 7.4296s). A predeclared
three-run sample then takes 9.963s, 9.557s and 9.395s; corresponding scanner times
are 7.9822s, 7.7099s and 7.6275s. All complete row payloads and source hashes match.
Root accepts this bounded current-source sample against the stricter full-command
ten-second target. No observation was discarded and no load correction was
applied. Older slower Bun 1.4.1 receipts remain historical evidence; these runs
use Bun 1.4.2 and integrated-main inputs. Resource pressure is retained, and the
small timing margin does not establish a bound under arbitrary contention.

Root recovered exact historical bytes for every known affected input, including
the earlier runner test, and saved current bytes for all 419 census/row affected
paths. Most match integrated main; the remaining goal/generated paths are
explicit. The existing detector task is now performing a read-only reconciliation
of all census and complete-row deltas using these hash-verified snapshots.
Canonical-write approval and round-one closure await that reviewed result and
final deterministic artifact/default-ratchet proof.

Private evidence: p0f-round1-current-runner-root-acceptance.json,
p0f-round1-current-cli-package/, p0f-round1-current-preview-complete-scope/,
p0f-round1-current-variability/, p0f-round1-current-source-provenance/ and
p0f-round1-current-integrated-proof-review.json. No initial goal PR or P1 audit
has begun; PR #1047 remains merged and requires no further remediation.

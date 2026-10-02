# Watch-mode private migration qualification

This candidate is not applied to the repository. Current source has 42 manual
provider boundaries and 31 live registrations; the prepared candidate uses the
instrumented runner and public layer registrations with bounded layer setup.
Per-test console capture is isolated where fixture helpers consume it.
Cleanup removal defects propagate instead of being ignored. Earlier cleanup
negative controls are retained in the private qualification directory.

## Clock evidence

All polling fixtures use zero intervals. Installed TestClock.sleep returns
immediately when the target timestamp does not exceed the current timestamp.
The default test services therefore suffice; no live clock or manual clock
driver is required. Both runtimes passed all 50 tests with CI tracing enabled
and a two-second per-test timeout. The trial fork/adjust helper was discarded.
Removing adjustment did not fail and is not credited as a negative control.

## Filesystem evidence

Two snapshot tests write closeout JSON through FileSystem and inspect the
resulting snapshot: these now use MemoryFileSystem. The snapshot collector
reads that artifact through FileSystem, while the gh responses are scripted.
The command helper now accepts an explicit platform layer; all 16 snapshot
registrations select Memory, so a nested native provider cannot shadow it.
Node passed all 50 tests in 3.72 seconds; Bun passed all 50 in 2.47 seconds.
A private provider control asserts that each of the two closeout fixture roots
exists through FileSystem but not through node:fs. Both controls pass on Node
and Bun; restoring the native helper provider fails both. Earlier runs with
the shadowing provider prove behavior only and are superseded for Memory credit.
Typechecking passed. The AST comparison preserves 48 literal registration names
and 186 assertions; template registrations account for the runtime count.
These timings are focused qualification receipts, not comparative benchmarks.

The streaming suites still require individual filesystem review before final
disposition. The shared convergence path invokes inbox persistence, whose
contained-file append uses the abstract filesystem, but its active-index update
uses Bun.spawnSync with native flock. Preserve those
resource boundaries when they are the subject; do not classify every streaming
fixture as a native exception solely because they share one platform layer.
The previous formatted copy predates the provider correction and is stale.

## Remaining before promotion

Complete the per-stream filesystem disposition, reconcile detector and human
lens rows without deleting their historical evidence, apply the final candidate,
run repository ratchets and the full package proof, and publish its receipts.

## Four reviewed stream promotions

The later-poll failure, initially green terminal snapshot, checkless timeout,
and already-merged snapshot now explicitly select Memory. Their scripted
observations contain no failing checks, unresolved threads, or base conflicts,
so they do not require native active-index persistence. All 50 cases passed
on Node (3.48s) and Bun (2.14s); typechecking and assertion parity passed.
A private service control passes in all four, checking each fixture root exists
through FileSystem but not node:fs. Restoring native providers fails all four.

An all-Memory trial passed 49 cases and failed the symlink/active-index failure
case. This trial receives no promotion credit: best-effort persistence paths
can tolerate the missing native active index without violating narrow output
assertions. Remaining streaming dispositions require review of those paths.

## Completed streaming filesystem disposition

The final private review covers all 30 streaming registration sites (31 runtime
cases). Fifteen sites use Memory; fifteen remain native, with one parameterized
site producing two cases. Every native site supplies a failed check outcome,
BEHIND base state, or unresolved review thread. Converge dispatches all failed
check outcomes, including optional ones, to native active-index updates. The
symlink failure case also deliberately asserts the persistence failure.

Memory sites cover comment streams, registration/timeout control flow, poll
failures, merged/terminal snapshots, and heavy admission. DIRTY changes settle
state but does not satisfy Converge's BEHIND-only base-drift dispatch predicate.
Comments in these fixtures are bot-authored; their watermark storage uses the
abstract FileSystem. Per-case reasons are saved in the filesystem receipt.

Final private Node and Bun runs passed all 50 tests (7.59s and 6.03s); types
and all 186 original assertions pass. A private provider-control run adds
host-absence/Memory-presence checks to all 15 Memory stream cases and passes
all 50 tests. Restoring native providers fails exactly those 15 cases while
the other 35 pass. The control fixture was restored to the qualified candidate.
The earlier full-control parse failure was a duplicate local variable in the
private injected control, fixed before these results; it is not source evidence.

Filesystem disposition is complete for this candidate. Final formatting,
repository application, detector/human ledger reconciliation and package proof
remain pending. No candidate source has been applied to the published branch.

## Final candidate and property repair

The authoritative private file is now `yeet-watch-mode.final.next.ts`; the
prior memory and formatted files are intermediate versions. Biome safe fixes
formatted the candidate and sorted/type-separated imports. The repeated-red
persistence test now asserts Some before the original conditional capsule-count
check (existing L-PROP-04). A missing-wave mutation fails; removing only this
new guard lets the broken case pass, demonstrating the previous vacuous path.
Final Node/Bun runs pass 50 tests (4.61s/3.22s), and typechecking passes.
The AST audit preserves 48 literal registrations and all 186 original
assertions; its call-expression counter does not count an assertion function
reference passed to pipe, so the added presence guard is recorded separately.

The historical resource row L-RES-02 is addressed by visible cleanup failure,
and the flake no-finding record remains historical evidence rather than a
blanket exception. A private ledger application plan preserves every row id
and original status until repository application supplies the real fix commit.

## Applied eight-file batch, 2026-10-01

This candidate is now applied in the authoritative inventory-next worktree. Full `bun run beep quality package-verify @beep/repo-cli` completed exit 0: audit 676.6 seconds, docgen 24.4 seconds. Applied CI=true eight-suite proof passes 218/218 tests on Node 22.22.3 (31.01 seconds) and Bun 1.4.2 (16.57 seconds). These are focused correctness timings, not controlled package performance comparisons or hosted proof. Formatting preserves the seven prepared candidate body ASTs. Source commit and ledger reconciliation follow this proof checkpoint; historical private-only statements above describe their original qualification stage.

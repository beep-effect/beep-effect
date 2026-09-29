# JSDoc inventory and model-store migration preparation

The preparation below was applied as source 37e76036e5 after the preceding
identity/tsconfig full CLI proof passed. See
cli-jsdoc-model-store-runtime-resource-proof.md for applied evidence.

Each file has 13 whole-callback runPromise boundaries and 13 terminal resource
wrapper uses. The drafts preserve the instrumented tester, use serial public
it.layer fixtures with 20-second hook timeouts, provide fresh callback consoles,
and retain all test options. Four synchronous JSDoc parser cases remain plain.
The JSDoc constructor registers directory release before fallible setup writes;
the model-store constructor owns only its directory and does not change cwd.
No Memory filesystem promotion is claimed.

Extracted original JSDoc controls reproduce a directory leak on setup failure.
Draft controls remove it. Original model-store controls reproduce ignored
cleanup failure as a successful Exit with residue; the draft fails visibly.
Both originals and drafts were exercised under Node and Bun, with success,
body failure, interruption and cleanup failure, plus JSDoc setup failure.
Every control harness removes its own intentional residue. These extracted
controls do not substitute for actual-suite verification after application.

The unchanged baseline passes all 30 cases under Node and Bun, with stable
source and zero temporary residue. Whole-command observations are Node
10.232 seconds and Bun 5.423 seconds, with dedicated TMPDIR, runtime versions,
load and pressure retained. The concurrent full package proof prevents a
controlled performance comparison.

Parsed draft assertion trees preserve 76 JSDoc and 24 model-store assertions,
100 total with zero exclusions. Preview detection removes 26 runtime findings
and two wrappers, introducing none; both native-platform judgments remain.
No ledger status has changed during preparation.

The JSDoc inventory's topology discovery reaches topoSortPackageNames and
runCaptured. All 13 inventory callbacks therefore draft TestClock.withLive
for native capture drain/reap deadlines. The four synchronous parser cases
need no override. Model-store cases use a no-download HttpClient that dies
on any unexpected request; their corrupt/missing/aliased artifact paths do
not exercise download retry delays. That draft retains the standard test clock.
After application, verify live-clock behavior and preserve the no-download
contract rather than relying only on passing ordinary cases.

Next: after the active package proof terminates, apply source-hash guarded
drafts, format, run the matching 30-case cohort, actual type diagnostics and
root ratchet, and exercise actual-suite resource, console and clock controls.
Reconcile exact historical lineage only after committed-source proof. The
cleanup failure transition must remain documented and tested.

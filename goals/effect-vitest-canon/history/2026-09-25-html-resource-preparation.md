# HTML resource preparation

The isolated HTML worktree starts from main at 5201b02fe5. All 18 test/support
files match the previously reviewed frozen inventory source; no full recensus
was used to replace the existing work queue.

Before edits, the Node suite passed 193 tests with no failures or skips. The
observed command took 8.67s with stable source hashes; private evidence retains
runtime versions, resource limits, load and pressure. This is an observational
baseline, not a causal benchmark.

Both browser-import and entrypoint import tests now acquire their real child in
the existing Effect test scope. Stderr draining starts at acquisition. Cleanup
terminates a still-running unsignalled child and awaits process exit and stderr
settlement. The original process.execPath, cwd, import scripts, SharedArrayBuffer
deletion and exact zero-exit/empty-stderr assertions are retained. No runtime,
filesystem subject or timeout was replaced.

The initial check rejected an async cleanup function under the Effect language
service rule; cleanup now returns its promise from Effect.promise without an
async function. Full corrected package verification passed: audit 17.5s and
docgen 13.6s. This is a resource-stage checkpoint. Direct interruption controls,
remaining property/observability lenses, detector migration and final timing
and publication remain; inventory statuses have not been prematurely closed.

## Interruption controls and property witnesses

Both real acquisition/release expressions passed independent interruption probes.
Each probe substituted a held native child for the import script, waited for an
acquisition barrier, interrupted the owning scope, and asserted SIGKILL plus
completed stderr draining before interruption returned. Replacing the release
with Effect.void failed each corresponding negative control. An independent
finally block killed and awaited the negative-control child. Both original
source files remained byte-identical; temporary probe files were removed.
These controls prove cleanup; the unchanged package tests prove import behavior.
Private evidence: html-interruption-receipt.json and its four per-case logs.

The proof-provenance test now explicitly asserts the issued fragment tag before
its existing narrowed child-freeze checks. Every mutation and serialized-byte
assertion is retained. The source-size determinism law adds equality derived
from the production SourceSizeAnalysis and SourceSizeIssue schemas over the
complete Result, retaining the branch and first-code checks, maximum string
length 256, and fcRuns(250). This includes both success fields and the complete
ordered failure array with every code, entryIndex, and message.

Full package verification after these edits passed: audit 16.4s and docgen
13.9s (html-property-package-001.log). Resource exception review, observability,
detector migration, final timing and publication remain. This is a checkpoint,
not package-wave completion or a goal acceptance claim.

## Native boundaries and runner adoption

The remaining resource findings retain their intentional subjects. The ledger
suite validates actual package artifacts through validateConformanceLedgerArtifacts;
the annotation suite compares the selected production proof annotations with
those artifacts. The jsdom suite uses disconnected DOM elements, innerHTML and
namespace observations as an independent emulator parser oracle. Replacing these
with memory filesystem fixtures or production predicates would remove the
integrity/independence claims. This is not real-browser execution evidence.

All 18 test suites now import it from the public @beep/test-runner entrypoint.
Plain describe/expect imports remain on @effect/vitest. The two child tests have
spawn, import, exit, drain and cleanup spans with constant names and no captured
environment values. Their scopes, TestEnv, original process arguments and final
zero-exit/empty-stderr assertions are preserved. Dependency installation changed
only the HTML lockfile workspace entry; filtered tsconfig-sync generated the two
HTML reference updates.

Full package verification passed (html-runner-package-001.log): audit 18.2s,
docgen 13.8s. Temporary probes in both native child tests observed the runner's
start diagnostic through TestConsole.logLines with BEEP_TEST_TRACE=1. With
BEEP_TEST_TRACE=0 and CI=false, both otherwise identical trace assertions failed.
The original source bytes were restored in finally. Private evidence is
html-trace-receipt.json and html-trace-{positive,negative}.log. Detector migration,
ledger reconciliation, cache metadata, final timing and publication remain.

## Canonical property declarations

Migrated all 19 native Arbitrary.checkEffect wrappers in the eight affected
suites to it.prop or it.effect.prop. The installed/reference public API accepts
the same native Arbitrary values and CheckOptions under the arbitrary option.
Every original fcRuns setting (25, 50, 100, 250 and 500) is retained, with no
new filtering, reduced domains or seed override. Inline language-tag and URL
arbitraries preserve their original construction. The input/button laws now
have separate property declarations, and the URL representative examples and
invalid enumerated keywords retain separate explicit tests. This adds three
test declarations without dropping assertions.

Canonical TypeScript AST printing confirmed every property callback unchanged
apart from formatting. Private receipts: html-property-callback-parity.json and
html-property-run-floor-parity.json. The preliminary scanner-based comparison
misread template literal tails as trivia-bearing tokens; the AST printer check
resolved that diagnostic issue without changing callbacks.

The final package verification passed: audit 16.8s and docgen 14.1s, recorded in
html-properties-package-002.log. The remaining ordinary Effect runtime-boundary
and specialized-assertion detector findings are still queued; no baseline rows
have been removed merely because this property subset passes.

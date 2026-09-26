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

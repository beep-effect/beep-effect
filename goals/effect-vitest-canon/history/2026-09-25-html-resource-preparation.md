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

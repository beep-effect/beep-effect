# Desktop instrumented runner import migration

All 57 current Desktop test files now register tests through the instrumented
runner. Two already used it; the import pass changed 55 files, routing existing
standalone layer calls through the instrumented `it.layer` entry point.
A post-format structural comparison preserves 986 original assertion calls and
all non-import statements except six equivalent explicit layer hook budgets.
Those budgets retain the shared configuration's ten seconds normally and five
minutes during coverage or a deep property sweep; no test body deadline changed.

Four files retain a direct `vi` import from Vitest: chat-ui, intake-atoms,
tauri-ipc-socket and youtube-watch-opener. Re-exporting that API through
`@effect/vitest` reproduces the hoisted-mock resolution error in all four suites.
Their registration uses the instrumented runner and their remaining helpers use
`@effect/vitest`. The four detector exceptions record this tested restriction;
globals were not enabled and mock behavior was not rewritten.

The Bun integration run passes 30 tests. Node runs 19 integration tests but four
suites fail during import with `Cannot find package 'env'` from PGlite's initdb
Wasm module. The pre-migration Pglite equivalence file reproduces this Node loader
failure, so it is inherited rather than caused by the runner import. This remains
an open Node integration compatibility task. Opt-in sidecar/provider scenarios
are not claimed as executed merely because their files were collected.

The Desktop lifetime, property, assertion and observability inventory remains
separate work; this import pass is not package or goal closeout.

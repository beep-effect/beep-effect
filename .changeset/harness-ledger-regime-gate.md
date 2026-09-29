---
"@beep/repo-ai-metrics": patch
"@beep/repo-cli": patch
---

Scope harness-ledger pruning evidence to the current harness regime
(harness-evidence-ledger). `@beep/repo-ai-metrics` adds `deriveHarnessHash` and
an optional `harnessHash` stamp on `SessionStart` hook-pulse rows. `beep
harness-ledger prune-proposals` counts only sessions stamped with the current
hash, reports the sessions it skipped, writes with `--write` once the window is
full, and leaves alone a surface that has an open proposal or a decision under
the current hash. The eval scorer runs its law lanes in a scorer-owned sandbox,
reports a lane that could not measure the fixture as an environment failure,
and counts every staged file a lane did not measure as a violation. `beep lint
schema-first` gains `--report-scanned-files`.

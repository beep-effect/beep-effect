# Cache baseline review: repo-cli test inputs after #2771 and #2777 (2026-11-06)

Reviewer: Claude Opus 5.5 (`fix/coverage-ownercheckpoint-rows`). No qualification is granted.

#2771 re-recorded the `@beep/repo-cli` subject for its five new workspace dependencies. #2777 merged right after
it and extended the `test` and `test:property` inputs in `packages/tooling/tool/cli/turbo.json`. The new inputs are
the two `native-dependency-diagnostics` Python files in `goals/turborepo-cache-trust-observability/research/`,
plus the architecture-lab package and app globs on `test:property`. The baseline still held #2771's record, so
`bun run beep quality cache-policy` reports `configuration-drift` on `@beep/repo-cli#test` and
`@beep/repo-cli#test:property` for every branch cut from `main`.

The change only adds inputs. It changes no flag, output or environment variable, and it makes the cache key
stricter, never looser. Re-recording the subject adopts #2777's reviewed inputs on top of #2771's dependency edges.

## `//` (root)

The root subject's projected sources changed together with #2777's new root-level research inputs (the Python
diagnostics and their test, referenced through `$TURBO_ROOT$`). Root `turbo.json` itself is unchanged since #2753.
Re-recording `//` adopts those sources. Nothing about flags, outputs or environment changes.

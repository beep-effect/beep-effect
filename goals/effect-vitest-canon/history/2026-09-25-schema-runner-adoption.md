# Schema instrumented runner adoption

All 78 schema test files now import it from @beep/test-runner. Assertions and
suite helpers remain from @effect/vitest. The runner is a development dependency;
lockfile, both generated TypeScript references and Fallow dependency permissions
were regenerated. Cuid layer acquisition now has an explicit five-second timeout.

The reviewed cache refresh changes only dependency edges on nine schema tasks:
audit, build, check, coverage, doctest, lint:deprecated-apis,
package-test-typecheck, test and test:property. Commands, configurations, unrelated
nodes, global configuration, source hashes, qualification scope, profile and epoch
are unchanged. Cache policy reports zero blockers after refresh.

Local package audit and docgen pass. Full Node and Bun test runs each pass
725 tests in 78 files with the instrumented runner.

The package-only single-worker coverage run fails: 60 failed, 665 passed across
78 files, reporting TestContextUnavailable from instrumented property callbacks.
This branch still carries the runner implementation before PR #1241's per-suite
context fix. Integrate that prerequisite after Benjamin merges it, then rerun the
same coverage command. Do not call coverage green or substitute isolated unit
proof for it. No root coverage command was run.

Ledger reconciliation, final timings, publication and hosted readiness remain.

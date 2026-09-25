# Utils instrumented runner adoption

All sixteen current utils test files import `it` from `@beep/test-runner`.
Assertions and suite helpers continue to come from `@effect/vitest`; canonical
Option assertions use its utils module. The runner is a development dependency.

Generated metadata changed only the utils lockfile dependency, its two TypeScript
reference lists, and the utils Fallow allow/allowTypeOnly lists. The cache
projection adds runner dependency edges to nine utils computations: six cached
ones and three uncached ones (audit, coverage, package-test-typecheck). A structural
comparison confirms that all task commands, task configuration, unrelated nodes,
global configuration, source hashes, qualification scope, profile and epoch are
unchanged. Cache policy passes after the reviewed refresh.

## Local proof

- Full utils package audit under Bun: passed (5.4 seconds); docgen passed
  (2.7 seconds).
- Node `CI=true bunx vitest run`: 189 tests across 16 files passed.
- Package-only `CI=true bun run coverage -- --fileParallelism=true --maxWorkers=1`:
  the same 189 tests across 16 files passed. Statement coverage 84.4%, branch
  coverage 88.96%, function coverage 77.66%, line coverage 87.35%.
- Effect/Vitest detector ratchet: zero introduced findings.

These are pre-integration local checks on the existing runner with utils file
isolation enabled. PR #1241 fixes the separate shared-worker runner context bug;
merge that prerequisite before final Wave B publication and timing collection.
No repository-wide local coverage proof was run. Inventory fix-SHA updates,
final timings, publication and hosted readiness remain outstanding.

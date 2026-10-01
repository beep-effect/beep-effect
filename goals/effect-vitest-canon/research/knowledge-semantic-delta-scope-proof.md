# Knowledge semantic-delta fixture qualification

The source migration is applied after the preceding CI-lane/worktree package
proof passed and its source was committed as `1d61d8fae2`. No campaign rows are
closed by this receipt; full package proof passes: audit 981.4 seconds and docgen 33.6 seconds.

The canonical candidate replaces hidden service provisioning with 63 explicit
instrumented runner layer registrations. It removes 13 whole-callback scopes;
the event-payload helper retains its shorter resource scope. All 64 test names
and 212 complete assertion expressions retain structural parity with source.

The initial native candidate passes 64 tests on Node (13.41 seconds) and Bun
(11.43 seconds). A private type project extending the root config passes through
the repository compiler. Cleanup instrumentation captures all ten scoped temp
acquisition sites and asserts every captured root is absent after the suite:
64 tests pass on Node (12.89 seconds) and Bun (11.14 seconds).

The final private candidate promotes only seven event-policy registrations to
MemoryFileSystem plus NodePath. Those cases read synthetic event JSON and do
not execute subprocesses. Missing paths, malformed JSON, missing repository
identity, same-repository and fork decisions retain their original assertions.
Real archive, command-surface, Git and Bun probes keep their native services.
The complete mixed suite passes 64 tests on Node (55.07 seconds) and Bun
(53.28 seconds); private types and assertion parity also pass. These timings
were observed during concurrent proof work and are not a speed comparison.

Applied verification passes 64 tests on Node (38.81 seconds) and Bun
(37.20 seconds). Authoritative root test types pass, and the formatted applied
source retains all 64 names and 212 assertions. Baseline reconciliation retains
historical rows, refreshes platform-import metadata, and reviews the newly
fingerprinted shorter policy helper scope. Full package proof passes: audit 981.4 seconds and docgen 33.6 seconds.
Private candidate hashes and logs are retained in the operator cache; they are
not a substitute for committed source proof.

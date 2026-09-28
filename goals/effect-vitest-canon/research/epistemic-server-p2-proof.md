# Epistemic Server P2 proof

The batch consumes 89 saved actions: 82 detector findings, three resource
findings and four flake findings. The adjacent driver-failure test and the new
shared PostgreSQL observer also receive explicit review. Inventory reconciliation
is pending; these counts are not a claim that the full goal is complete.

## Behavior and preservation

All 15 test files register through the instrumented runner. Public layer hooks
own static services with explicit budgets. The observability suite keeps fresh
recording tracers and separate success/failure services. Persistent PGlite tests
retain actual native storage and the shorter close/reopen lifetimes inside their
outer platform-service layer. No restart assertion is promoted to a crash or
fsync guarantee.

A source comparison against `5c6bd1aba28c7d5d54b56271299abe56427647a7`
accounts for 437 original assertions, 92 static titles, 63 selected fixture
initializers and every original body deadline. The waiter assertion moves into
the shared helper. Two intentional oracle corrections are separately justified:

- ContradictionTriage's locked applicability check rejects the losing review as
  `ContradictionReviewConflict` with reason `stale-candidate`, before the edge
  superseder runs. The untouched native PostgreSQL test failed its former
  `SupersessionConflict` expectation. The replacement requires the exact type
  and reason.
- EdgeAuthority's public ID derives from logical key and version. Its unique
  index is a fourth equivalent concurrency backstop, but the production mapper
  omitted it. The untouched native PostgreSQL race reproduced the wrong
  `EdgeConstraintViolation` classification. The exact index now maps to
  `SupersessionConflict`; the test retains its typed winner/loser assertions
  and accepts the four equivalent diagnostic names without assuming index order.

The production repair is covered by the user's standing authorization and the
package changeset. It does not broaden arbitrary database errors into conflicts.

## Controlled regressions

| Subject | Positive evidence | Negative control |
| --- | --- | --- |
| Dispatch ordering | Explicit started acknowledgements tolerate a 20-yield startup delay and retain reverse settlement/hash binding | Former yield-only synchronization fails |
| Append-only triggers | Guaranteed restoration survives defects and interruption for both decision and outcome triggers | Disabling restoration fails all four actual trigger-existence checks |
| Contradiction PostgreSQL contention | Known distinct backend IDs both enter Lock state before blocker release, including 800 ms delayed startup | Former 250 ms observation fails with that delay |
| Edge PostgreSQL contention | Two pinned writer transactions acknowledge their PIDs; both must be observed waiting | Withholding the second distinct witness fails |
| Filtered database race | Race A passes alone on a fresh database after suite setup performs migration | Original first-test setup fails with a missing relation |
| Driver-failure cleanup | Real rollback passes; ensuring owns cleanup and rollback errors remain visible | An invalid replacement rollback passed all three old tests and fails the repaired suite |
| Instrumented runner | Trace-enabled failure emits case name, start, failure outcome and duration | Trace-disabled execution emits none of those diagnostic records |

Temporary probes are restored or removed. Native PostgreSQL proofs use a
dedicated disposable server and separate databases for the two destructive
suites. Six native cases pass on both Node and Bun. The persistent PGlite
close/reopen tests also pass on both runtimes. Unit timings explicitly exclude
integration tests and cannot substitute for these native proofs.

## Additional file review

`EpistemicRepositoryDriverFailure.pglite.test.ts` uses an intentionally
unmigrated, fresh PGlite layer in a serial suite. Its fixed inputs exercise
adapter error mapping, not codec laws. Exact error types and operation names
remain the assertion subjects. Review found ignored rollback failures; the
controlled regression above establishes the repaired cleanup gap. The named
cleanup function and runner preserve failure attribution without logging driver
payloads. The isolated in-memory case still checks an empty repository.

`PostgresLock.test-kit.ts` acquires no resource. The caller owns its blocker
transaction and connection identities. Polling refreshes the database statistics
snapshot, requires exactly two identified Lock waiters, and has both an attempt
bound and a narrow live watchdog. It does not retry the race, substitute
TestClock for database time, or introduce a schema-law property. The named
Effect function supplies attribution; no backend PID logging is added. Positive
delayed-start and missing-witness controls exercise its success and rejection.

## Verification and remaining closeout

Full package verification after the adjacent cleanup repair passes: audit
12.3 seconds and docgen 4.7 seconds. The six root policy commands passed after
reconciling six relocated schema-first inventory anchors. Only their line
positions changed; dispositions and reasons are preserved. The post-repair
oxlint check also passes.

Runner dependency, generated TypeScript references and Fallow edges are updated.
The cache review covers 14 owned nodes and adds the runner edge to nine dependency
lists without changing commands, qualification, configuration or unrelated nodes.
See [cache review](epistemic-server-runner-cache-review.md).

Final timings, ledger/census reconciliation and remote publication remain open.
Host load and pressure accompany timings; a single before/after observation
cannot establish a causal performance improvement. This batch does not satisfy
the goal's final empty-baseline, adversarial-review or hosted closeout gates.


## Publication boundary

The user requested that PR #1307 remain at its published head while its remaining
heavy jobs finish, so they can merge it. PR #1307 is now merged as `c2b75455dff12367794abd4ebf52136f52553c15`.
All 29 pending files transferred to a new sibling worktree with matching hashes.
This batch belongs to `codex/effect-vitest-followup`; the goal remains active.

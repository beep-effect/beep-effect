# Qualification test resource boundaries

The Effect Vitest detector flags syntax for review; native service imports do
not by themselves establish an inappropriate filesystem or lifetime choice.
This review admits six exact, anchored occurrences. It does not exempt files,
rules, future occurrences, or other findings on the same tests.

| Test | Reviewed finding | Required behavior |
| --- | --- | --- |
| `cache-protocol-fixture.test.ts` | Inner scope | Close the listening socket before asserting that another read fails. The outer test scope closes too late. |
| `cache-accept-cli.test.ts` | Native service import | Share private issuer files with a real CLI subprocess and verify authenticated persisted bytes. |
| `cache-acceptance.test.ts` | Native service import | Verify native file modes, replacement, persistence and issuer revocation. |
| `cache-operational-acceptance.test.ts` | Native service import | Exercise real fingerprints, private stores and ledger bytes; control only census/toolchain observations. |
| `cache-producer.test.ts` | Native service import | Exercise permission bits, symlinks, hard links, revocation markers and reopen behavior. |
| `cache-workflow.test.ts` | Native service import | Exercise real Git worktrees, executable bits, aliases, ignored files and containment. |

The producer, acceptance and workflow suites use explicit service layers.
Import-provenance exceptions do not resolve separate provider-lifetime or clock
findings. The CLI and operational tests still require review of their live clock,
outer scope and nested property lifetimes. Shared suite clock changes remain open.

Evidence: the focused producer/protocol/workflow run passed all 49 tests after
resource cleanup. Acceptance passed all nine tests. Operational acceptance passed
at 400 and 1,000 generated runs. These checks establish component behavior, not
native cache qualification. Removing the socket's shorter scope or replacing
native files with simulated storage would erase behavior these tests must prove.

Exceptions must be re-reviewed when the anchored code changes. Retire each import
exception if the detector learns the provider's provenance, or if the test stops
exercising the corresponding native behavior. Retire the inner-scope exception
only when another test still proves release before the failed read.

## Per-case and transaction lifetimes

Two provider findings are resolved by inspecting the named helper: census uses
`provideScopedLayer(NodeCrypto.layer)` per generated case; dispatch supplies its
platform/console test layer inside each generated case. Both use native property
registration. The dispatch fixture's request files and captured console belong
to that case, rather than to the entire property run. Retain those boundaries;
re-review when the helper or layer changes.

The CLI and operational integration tests retain inner property loops. They
mutate references or runtime identity against one provisioned transaction and
assert that its marker or ledger remains unchanged. The surrounding transaction
also tests revocation. Repeating a new transaction per generated value would
change that invariant. Both loops retain `fcRuns`, seeds, shrinking and an explicit
`Passed` assertion. The integration tests pass at the 400-run floor after moving
the services into explicit test layers. Re-review if setup stops being shared or
the properties cease checking the same stored bytes.

## Serial expiry tests

The acceptance and closed-producer suites now declare `concurrent: false` on
their owning layers. Each test creates new issuer state and expiry times relative
to its current clock. No test depends on an absolute zero timestamp or reuses a
previous test's issuer. Advancing 25 hours is the behavior being tested; a reset
would not prove concurrency isolation. All 36 tests across acceptance, producer,
CLI and operational acceptance pass. Re-review these exceptions if concurrency,
absolute-time assumptions, or shared issuer state changes.

The reviewed inventory contains six additional anchored rows for these specific
provider, property and clock observations. The explicit layers remove the live
and outer-scope findings; those findings are not covered by exceptions.

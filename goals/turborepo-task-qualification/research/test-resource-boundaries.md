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

### Signed supervisor adapter tests

`cache-signed-runner.test.ts` uses explicit NodeFileSystem, NodePath and
NodeCrypto layers with scoped temporary files. Real path resolution, file
containment, issuer mutation and bounded report reads are the tested boundary.
The scheduler and captured-process functions are controlled doubles; the native
process service fails closed if accidentally reached. Each negative asserts its
specific refusal. These tests do not replace native sandbox or issuer approval
evidence. EV010 is a reviewed filesystem-provenance exception for this file.

### Protocol worker and supervisor tests

`cache-protocol-runner.test.ts` uses real scoped directories and the local HTTP
fixture with explicit filesystem, path, crypto and HTTP layers. Real-clock test
services let socket exchanges and deadlines progress. The process double writes
native-shaped summaries and outputs while the real worker validates capture
bounds, credential exclusion, exact summary selection and output containment.
The separate supervisor cases in `cache-signed-runner.test.ts` verify report
binding and sandbox command construction. Neither suite claims native Turbo
execution. EV010 for the protocol worker is a reviewed filesystem boundary.

### Protocol fixture transport failures

The fixture server suite uses real clocks for live HTTP progress and socket
release. Its body-read negative temporarily rejects the native Request reader;
an Effect finalizer restores that method even if an assertion fails. The test
requires an HTTP 400, a sanitized rejection event, and no installed artifact.
The existing real oversized-upload test still proves the independent size bound.
This controlled transport error establishes handler behavior, not native client
qualification. No additional inventory exception is required.

### Supervised workflow issuance

The workflow tests retain real temporary Git repositories, source hashing and
private issuer storage. Explicit FsUtils and deterministic MemoryStats providers
complete the service context alongside the existing platform layers. Toolchain
and linked-tool observations, admission, and signed/protocol runner results are
controlled at their existing module boundaries. A scoped realPath mapping admits
the temporary checkout for the issuance tests; the separate location test still
checks that the actual loaded supervisor rejects another checkout.

The success case authenticates the returned bundle with the real verifier and
checks four tool observations: initial approval plus checks before execution,
after the signed pilot and after the protocol phase. Drift cases fail before
issuance and check which runners were allowed to execute. A schema-derived
property binds every generated source digest to the workflow identity. These
fixtures prove supervisor coordination; the frozen native receipts retain sole
authority for real sandbox and client execution. No additional provider exception
is needed.

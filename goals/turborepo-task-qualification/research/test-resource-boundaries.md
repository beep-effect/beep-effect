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

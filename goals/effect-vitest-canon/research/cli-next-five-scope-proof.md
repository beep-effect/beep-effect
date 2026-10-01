# Five-suite scope review under the Effect 4 snapshot

Prepared on source base `1710f6d3cf`. The five migrations cover agent-effectiveness
commands, law evaluation, metrics commands, corpus preservation, and tmpfs reap.
All original 116 tests pass under Node and Bun (55.13 and 40.75 seconds).
The authoritative root test-type gate subsequently identified three diagnostics;
those were repaired without weakening assertions. The affected 73 tests pass
again on Node and Bun (25.25 and 20.79 seconds). The root test-type gate passes.
Full CLI package verification passed: audit 674.4 seconds and docgen 25.5
seconds. No campaign ledger closure is claimed yet.

## Retained scope lifetimes

- Four tmpfs tests start five real children holding cwd, open-file, or flock
  references. Their inner scopes release those children before the outer
  temporary-directory fixture releases its root. Reference-count and skip-reason
  assertions remain. The earlier qualification probe verified all five child
  PIDs exited and all 29 temporary roots disappeared on both runtimes.
- The fake law runner closes its fixture and repository directories before
  returning captured commands and configs. Each invocation owns those resources;
  the shared platform layer does not own a mutable test fixture.
- Each metrics sink builds `NodeHttpServer.layerTest` inside its own short scope.
  The callback completes before server shutdown and control returns to the test.
  A separate after-suite probe observed exactly five URLs and verified requests
  failed against every URL after scope closure. All 45 tests plus that probe pass
  on Node (9.17 seconds) and Bun (7.69 seconds). The source suite has no probe code.

The scope fingerprints changed when providers and fixture construction moved.
The five existing scope entries retain their historical identifiers; only their
current metadata and explicit lifetime judgments change. The metrics scope is a
new reviewed entry replacing the old manual server wrapper. Unrelated baseline
rows and existing coverage floors are untouched. Historical campaign rows still
require their own lineage reconciliation and full package proof.

## Historical lineage and assertion preservation

All 227 open historical detector rows have exact source-evidence matches: 211
in the preparation base and 16 in older Git blobs. Every matched named test
still has a current registration. The accompanying lineage receipt separates
module/helper rows and unchanged evidence from test-body replacements; none of
these classifications alone closes a ledger row.

An AST assertion audit found 559 substantive assertions after migration. Three
outer `Passed` result assertions are replaced by native property-runner failure
handling; their property-body assertions remain. Other changes are canonical
`assertSome`/`assertTrue` equivalents, retrieval of the same manifest-store
service from its already-built context, direct ConfigProvider service provision,
and formatting. Expected payloads, polarity, property run counts, and five
metrics coverage-mode skip conditions are preserved.

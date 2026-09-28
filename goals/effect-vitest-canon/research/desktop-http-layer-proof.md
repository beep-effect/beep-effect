# Ontology HTTP fixture ownership

All twelve withHttpServer calls and the generic provider wrapper are removed.
The helper now exports makeHttpServerLayer and a typed HttpServerFixture service
containing the workspace root, ontology path, and transport mode. Both the
in-process web handler and loopback server retain their original configuration,
filesystem/path bridge, MCP session negotiation, and resource finalizers.

Four static ontology cases use independent public it.layer fixtures with an
explicit thirty-second resource hook budget. Eight dynamic calls retain explicit
shorter scopes: they consume a test-local ledger or egress probe, return a read
window, or close a server before the following ledger observations. Each builds
its own layer, reads its own fixture service, and supplies the resulting Context
to the original body. The Effect.provide argument is a built Context, not a
Layer constructor. The outer platform/PGlite services remain owned by public
fixtures; those eight inner lifetimes are not hoisted into suite-wide servers.

This covers four additional ontology calls and four execution-authority calls
that the original direct-wrapper detector did not report. The generic wrapper's
scope is now visible at each call site. The resulting Context-provision and
short-scope candidates receive individual reasons instead of being hidden behind
another higher-order helper.

## Preserved behavior and proof

AST comparison preserved thirteen test titles and 238 assertion call expressions,
including nested expressions. The production schemas, property floors, tool
requests, authentication headers, policy options, ledger probes, egress stubs,
and original timeouts remain intact. Existing transport-mode selection remains
controlled by BEEP_TEST_ONTOLOGY_MCP_SOCKET.

Node and Bun each passed all thirteen cases in both in-process and real loopback
socket modes. Full Desktop package verification passed audit and docgen after
correcting two refactor issues: inlining redundant nested generators in the four
static bodies and using the deterministic key required for the fixture service.

Temporary probes exercised all twelve original server lifetimes plus two extra
initialized fixtures that completed successfully or failed intentionally. In
each of the four runtime/mode combinations, the probes confirmed fourteen unique
workspace roots, fourteen independent MCP session references, and removal of all
workspace roots after finalization. In-process mode disposed all fourteen web
handlers; socket mode closed all fourteen native listeners. The added failure
case asserted the original injected Cause after the short scope closed. Every
probe and the temporary test file were removed in a finally block.

The removed callback abstraction did not make shared services or timing windows
interchangeable. Final Desktop lens-ledger reconciliation and package-wide timing
proof remain separate work.

Schema-first, Biome, and strict packet validation passed. The packet contains
5,022 unique root IDs and 15,270 unique ledger rows after recording the sixteen
newly explicit Context/scope judgments. The ratchet reports zero introduced
findings, 246 resolved against the retained baseline, and 4,776 live findings.
The final Desktop scan has zero open candidates and 49 reasoned exceptions.
This does not close the historical detector rows or the four per-file lens
ledgers, and it does not establish an empty repository-wide baseline.

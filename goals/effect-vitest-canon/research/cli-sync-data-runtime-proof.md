# Sync-data runtime, fixture and cleanup proof

The suite now uses the public instrumented tester and a serial shared platform
fixture. Eight direct test runtimes return Effects. The two synchronous HTTP
fixture responders and their adapter no longer open three nested runtimes;
Effect.try maps native request/response construction failures to the typed
HttpClientError/TransportError channel. The caller audit found only these two
local responders, with no async handler requirement.

All 24 Effect callbacks receive fresh consoles. Eight repository cases consume
the shared scoped cwd resource, followed by .git creation. Directory and cwd
finalizers therefore exist before that setup step can fail. The single dynamic
target registration uses scoped acquisition with its original removal rule.
The local layer wrapper and both callback resource wrappers are removed.
The six plain tests, three native archive fixtures, property-independent input
cases and every test title/timeout argument are retained.

The exercised writers use direct filesystem operations; source acquisition
uses the provided in-process HTTP fixtures. The inspected command subtree has
no Effect timer/retry path. Existing archive cases already run on the test
clock. All cases retain the test clock; native filesystem provenance remains
open, including tar construction and archive extraction.

Applied evidence:

- Node and Bun each pass all 30 ordinary tests. All 93 assertion trees and
  registration multiplicities match the original. Source hashes remain stable
  during ordinary runs, with zero isolated temporary residue.
- Actual test-type diagnostics are empty with exitCode 0. Two initial chained
  pipe diagnostics were fixed before this proof; the wrapper's zero exit was
  not treated as a clean type result. Root Oxlint passes.
- The root Effect Vitest ratchet scans 1,217 files and reports 2,909 findings,
  zero introduced and 2,113 resolved against the unchanged baseline. This file
  removes nineteen findings; the native-platform review stays open.
- Repository body failure, interruption and .git setup failure each produce
  exactly eight intended failures plus 22 passes on each runtime. Every test
  checks cwd and registry restoration, and each run leaves no temporary residue.
- Registry failure/interruption each produce one intended failure plus 29
  passes. Archive failure/interruption each produce three intended failures
  plus 27 passes. These controls distinguish registry, cwd and directory cleanup.
- Console probes pass 31 cases and observe 24 distinct services per runtime.
- HTTP probes pass 32 cases, verifying request method, headers and URL, response
  status/body, and typed transport mapping of a synchronous construction error
  with its underlying cause retained.
- All eighteen phase/runtime probe runs reject unexpected assertion failures
  and restore the exact source bytes afterward.

A source-extracted simulated-service control also runs on Node and Bun: the old
acquisition leaves cwd changed and never removes its directory if .git setup
fails, while the scoped replacement restores both. The applied native-file
setup-failure probes above establish that the repair also works in the actual
suite; the simulated control alone was not used as that proof.

Whole-command observations are Node 3.719 -> 3.870 seconds and Bun
1.767 -> 2.018 seconds. Private receipts preserve versions, source hashes,
load and pressure; shared workstation activity prevents causal speed claims.

Historical matching identifies ten runtime/helper and six provider rows.
Helper identity disambiguates runtimes outside named test callbacks. Three
wrapper rows match their original occurrence/evidence exactly. Full grouped
CLI package proof is pending; this is not goal-wide or hosted acceptance.

Source commit: `81f4119e9c09f6514f49505f23cd33328c9bba42`.
Reconciliation closes exactly nineteen historical rows, adds none, and preserves
all unrelated rows. Strict validation passes for 3,495 CLI and 687 schema rows.
CLI totals are 1,936 fixed, 12 exceptions and 1,547 open. The grouped package
proof is running and must finish before package handoff.

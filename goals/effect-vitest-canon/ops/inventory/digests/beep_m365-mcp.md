# @beep/m365-mcp — P1 source audit digest

Root-reviewed P1 source inventory. All rows remain open judgments; P2 remains gated.

All 2 assigned census files were reviewed completely: 8 human rows, 4 review proposals and 4 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

Severity: 4 info, 2 major, 2 minor.

 3 unchanged mechanical candidates are separate from independent human coverage.

Top files (all have four rows; source-order tie, at most ten):

- `packages/drivers/m365-mcp/test/SanitizedSpan.test.ts`: 0 proposals; full lines 1–114, test.
- `packages/drivers/m365-mcp/test/Server.test.ts`: 4 proposals; full lines 1–297, test.

The sanitized-span block merges the real MCP registry/handlers with pure M365/client doubles; the recorder is per-test. The handler block is synthetic. The stdio protocol case builds and launches a server over Stdio.layerTest Queue/Ref/Deferred, then detaches both work and interruption. This is a concrete scope/teardown concern, not a request to acquire a process. No MemoryFS or network subject exists. No layer rebuild timing or speedup is claimed.

Review proposals:

- `L-RES-02` `Server.test.ts:283`: The stdio server is forkDetach-owned, and its interruption is itself detached at line 288. Failure or interruption while awaiting ready bypasses the explicit cleanup, and normal completion does not await finalizers. Tie the server to the test scope with a child/scoped acquisition and await its interruption on every exit. Preserve the Queue/Deferred handshake and all protocol ID, tool and DriveId assertions; this is in-memory Stdio.layerTest, not a real process.
- `L-FLAKE-03` `Server.test.ts:288`: Detached interruption allows the test to complete before server teardown; a stalled ready await can leave the detached server alive. Prove awaited teardown for normal, failed and interrupted exits after fixing scope ownership. Retain event-driven readiness rather than adding sleeps, retries or a shared TestClock reset. This is the flake view of the same resource risk, not a reproduced timing failure.
- `L-PROP-04` `Server.test.ts:260`: The handler test checks Some and isFailure=false but never compares the returned GraphSite payload. A successful empty or wrong-site result can satisfy those assertions. Compare the successful handler payload through its actual output shape to the existing site fixture, preserving the Some/non-failure checks and exact siteId input. Do not invent expected error/Cause values or replace the stdio assertions.
- `L-OBS-01` `Server.test.ts:286`: If initialize/list/call processing stalls, Deferred.await never reaches the existing stdout assertions. Record the last completed stage and sanitized protocol request ID through the accepted opt-in runner context so a watchdog failure identifies the stalled handshake. Preserve TestEnv, response assertions and joined teardown; do not log credentials or arbitrary tool arguments.

Completed Root baseline: 6 registered tests passed, zero failed; whole command 5.766251357 seconds, reporter file-span total 5430.946533 ms (different boundaries). All assigned files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. No timing was rerun. Passing once does not prove full package proof, coverage or absence of rare failures. Across the campaign, 139 first attempts are complete: 132 full-file-representation baselines, four configured subsets and three failures. Known failed Node cohorts remain failures; no baseline is rewritten.

Hosted evidence: 0 mapped observations across 0 jobs. Zero mapped observations does not establish no historical failures.

Campaign history covers 527 failed runs, including 21 unavailable logs and one unresolved cause. Historical production paths were not compared for introduced/inherited causal attribution in this lane.

After separate P2 authorization: Join test-owned server teardown on every exit, preserve the event-driven Stdio.layerTest protocol, strengthen the handler payload assertion, then add sanitized stage diagnostics. The resource and flake rows describe one ownership risk. Preserve original assertions, generator inputs and replay options. The inherited ratchet additions remain untouched.

Pin: Effect/adapter 4.0.0-rc.113 at d3b837aee836f35d625d55205f7d6e61305fc198; adopted graph100. Vitest4.1.11 is the recorded runtime, not a supported rc113 peer assertion. Strict public decoder accepted every row. Exact read/source/contract hashes and full rows are private evidence; Root alone verifies and assembles canonical inventory. Remaining uncertainty is runtime reproduction and causal historical attribution, not missing assigned source reads.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

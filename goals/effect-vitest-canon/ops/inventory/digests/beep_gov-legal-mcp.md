# @beep/gov-legal-mcp — P1 source audit digest

Root-reviewed P1 source inventory. All rows remain open judgments; P2 remains gated.

All 2 assigned census files were reviewed completely: 8 human rows, 2 review proposals and 6 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

Severity: 6 info, 2 minor.

 10 unchanged mechanical candidates are separate from independent human coverage.

Top files (all have four rows; source-order tie, at most ten):

- `packages/drivers/gov-legal-mcp/test/GovLegalMcp.equivalence.test.ts`: 1 proposals; full lines 1–119, test.
- `packages/drivers/gov-legal-mcp/test/Server.test.ts`: 1 proposals; full lines 1–691, test.

Named MCP suites share their registry/driver layers within each block; real GovInfo/eCFR handlers use synthetic HTTP plus in-memory rate limiter stores. A separate failing GovInfo double exercises sanitized envelopes. The NodeServices artifact block owns scoped temporary files and reads the checked-in generated report; preserve that input boundary. This is not a container/server startup proof or measured reuse speedup. No layer rebuild timing or speedup is claimed.

Review proposals:

- `L-OBS-01` `GovLegalMcp.equivalence.test.ts:94`: Both direct native checkEffect callbacks throw expect before returning true and the caller matches only Passed. Use the adapter property registration so thrown codec/assertion failures retain normalized counterexample/replay diagnostics. Preserve both production schemas, declared comparator laws and fcRuns(25) options; this adds actual failure-context reasoning beyond EV007 syntax.
- `L-RES-04` `Server.test.ts:644`: The NodeServices block checks real temporary file bytes against the checked-in generated artifact, with makeTempDirectoryScoped inside the test. Preserve test-owned temp cleanup and the committed-file comparison when reviewing EV010. A MemoryFS-only replacement cannot read the tracked artifact without an explicit faithful input boundary. Other MCP layers inject synthetic HTTP or sanitized failure doubles; do not turn them into network tests or treat their opaque factory names as proof of acquisition cost.

Completed Root baseline: 18 registered tests passed, zero failed; whole command 18.242209581 seconds, reporter file-span total 16954.095215 ms (different boundaries). All assigned files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. No timing was rerun. Passing once does not prove full package proof, coverage or absence of rare failures. Across the campaign, 139 first attempts are complete: 132 full-file-representation baselines, four configured subsets and three failures. Known failed Node cohorts remain failures; no baseline is rewritten.

Hosted evidence: 3 mapped observations across 1 jobs. These are production coverage-ratchet records, not named failing tests or unique flakes:

- `packages/drivers/gov-legal-mcp/src/ToolNames.ts` — Measured functions: 81.81 < 84.21; not test flakiness.
- `packages/drivers/gov-legal-mcp/src/ToolNames.ts` — Measured lines: 92.59 < 93.54; not test flakiness.
- `packages/drivers/gov-legal-mcp/src/ToolNames.ts` — Measured statements: 92.85 < 93.81; not test flakiness.

Campaign history covers 527 failed runs, including 21 unavailable logs and one unresolved cause. Historical production paths were not compared for introduced/inherited causal attribution in this lane.

After separate P2 authorization: Preserve scoped native temp files and the committed artifact oracle, then improve property failure diagnostics without changing schema/equivalence laws or 25-run floors. Preserve original assertions, generator inputs and replay options. The inherited ratchet additions remain untouched.

Pin: Effect/adapter 4.0.0-rc.113 at d3b837aee836f35d625d55205f7d6e61305fc198; adopted graph100. Vitest4.1.11 is the recorded runtime, not a supported rc113 peer assertion. Strict public decoder accepted every row. Exact read/source/contract hashes and full rows are private evidence; Root alone verifies and assembles canonical inventory. Remaining uncertainty is runtime reproduction and causal historical attribution, not missing assigned source reads.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

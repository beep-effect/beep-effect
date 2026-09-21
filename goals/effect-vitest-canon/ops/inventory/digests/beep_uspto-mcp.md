# @beep/uspto-mcp — P1 source audit digest

Root-reviewed P1 source inventory. All rows remain open judgments; P2 remains gated.

All 1 assigned census files were reviewed completely: 4 human rows, 2 review proposals and 2 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 1 |
| flake | 1 |
| property | 1 |
| observability | 1 |

Severity: 2 info, 2 minor.

 7 unchanged mechanical candidates are separate from independent human coverage.

Top files (all have four rows; source-order tie, at most ten):

- `packages/drivers/uspto-mcp/test/Server.test.ts`: 2 proposals; full lines 1–343, test.

Three scoped synthetic MCP environments provide HttpClient/configuration/client context, with no real USPTO call. The 200-document field-tier response and credential-gate behavior are the subjects. The production estimate currently counts characters; the test byte-budget claim needs Root contract review with Unicode evidence. No live provider or filesystem is justified. No layer rebuild timing or speedup is claimed.

Review proposals:

- `L-PROP-02` `Server.test.ts:241`: The 200-document budget test checks raw.length with ASCII fixtures, so it cannot establish the advertised byte budget for Unicode. FieldTier.estimateJsonSize currently uses JSON.stringify(value).length and projectDocumentsWithinBudget uses that estimate; a multibyte payload can have more UTF-8 bytes than code units. Add valid multibyte document fields and an encoded-byte oracle while preserving 200 documents, 8000 budget and named-tier assertions. Root must resolve the documented byte-versus-character contract before any production change; this lane does not silently redefine the budget.
- `L-OBS-01` `Server.test.ts:170`: The direct round-trip helper runs encode/decode synchronously inside native checkEffect and reduces the result to Passed. A false law loses the structured falsified input/replay context; a thrown codec error bypasses adapter normalization. Use the pinned property registration/formatter, preserving the exact Equal law and fcRuns(options.runs ?? 20), including explicit overrides. Keep existing assertSchemaArbitraryDecodesToSelf callers and their floors intact.

Completed Root baseline: 11 registered tests passed, zero failed; whole command 5.917924448 seconds, reporter file-span total 5567.820801 ms (different boundaries). All assigned files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. No timing was rerun. Passing once does not prove full package proof, coverage or absence of rare failures. Across the campaign, 139 first attempts are complete: 132 full-file-representation baselines, four configured subsets and three failures. Known failed Node cohorts remain failures; no baseline is rewritten.

Hosted evidence: 0 mapped observations across 0 jobs. Zero mapped observations does not establish no historical failures.

Campaign history covers 527 failed runs, including 21 unavailable logs and one unresolved cause. Historical production paths were not compared for introduced/inherited causal attribution in this lane.

After separate P2 authorization: Resolve the documented byte-versus-character budget using valid Unicode examples before any production change. Preserve the 200-document/8000-budget case and named tiers, and retain property floors/seeds and replay diagnostics. Preserve original assertions, generator inputs and replay options. The inherited ratchet additions remain untouched.

Pin: Effect/adapter 4.0.0-rc.113 at d3b837aee836f35d625d55205f7d6e61305fc198; adopted graph100. Vitest4.1.11 is the recorded runtime, not a supported rc113 peer assertion. Strict public decoder accepted every row. Exact read/source/contract hashes and full rows are private evidence; Root alone verifies and assembles canonical inventory. Remaining uncertainty is runtime reproduction and causal historical attribution, not missing assigned source reads.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

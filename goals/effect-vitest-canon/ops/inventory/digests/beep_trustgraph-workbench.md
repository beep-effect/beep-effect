# @beep/trustgraph-workbench — P1 source audit digest

Root-reviewed P1 source inventory. All rows remain open judgments; P2 remains gated.

All 1 assigned census files were reviewed completely: 4 human rows, 1 review proposals and 3 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 1 |
| flake | 1 |
| property | 1 |
| observability | 1 |

Severity: 1 minor, 3 info.

 0 unchanged mechanical candidates are separate from independent human coverage.

Top files (all have four rows; source-order tie, at most ten):

- `apps/labs/trustgraph-workbench/test/App.test.tsx`: 1 proposals; full lines 1–25, test.

The two synchronous tests render React into jsdom and inspect the hoisted document head. There is no Effect layer or service acquisition. Explicit per-render DOM ownership is missing under the inspected globals:false/RTL auto-cleanup contract. Preserve real React head-hoisting and asset imports; MemoryFS is unrelated. No layer rebuild timing or speedup is claimed.

Review proposals:

- `L-RES-03` `App.test.tsx:7`: Both tests render into the shared jsdom document without an explicit unmount/cleanup. Installed RTL only auto-registers cleanup when global afterEach/teardown exists; the package inherits Vitest globals:false and its config/setup supplies no cleanup hook. Give each render an explicit test-owned unmount/cleanup boundary, preserving React 19 head hoisting, branding and every role/head assertion. Avoid a global cleanup hook racing concurrent cases. This is missing ownership protection, not a reproduced failed test.

Completed Root baseline: 2 registered tests passed, zero failed; whole command 5.617128346 seconds, reporter file-span total 4871.910889 ms (different boundaries). All assigned files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. No timing was rerun. Passing once does not prove full package proof, coverage or absence of rare failures. Across the campaign, 139 first attempts are complete: 132 full-file-representation baselines, four configured subsets and three failures. Known failed Node cohorts remain failures; no baseline is rewritten.

Hosted evidence: 0 mapped observations across 0 jobs. Zero mapped observations does not establish no historical failures.

Campaign history covers 527 failed runs, including 21 unavailable logs and one unresolved cause. Historical production paths were not compared for introduced/inherited causal attribution in this lane.

After separate P2 authorization: Give each render explicit test-owned cleanup while retaining React head hoisting and all existing DOM assertions. Browser interaction proof remains a separate scope. Preserve original assertions, generator inputs and replay options. The inherited ratchet additions remain untouched.

Pin: Effect/adapter 4.0.0-rc.113 at d3b837aee836f35d625d55205f7d6e61305fc198; adopted graph100. Vitest4.1.11 is the recorded runtime, not a supported rc113 peer assertion. Strict public decoder accepted every row. Exact read/source/contract hashes and full rows are private evidence; Root alone verifies and assembles canonical inventory. Remaining uncertainty is runtime reproduction and causal historical attribution, not missing assigned source reads.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

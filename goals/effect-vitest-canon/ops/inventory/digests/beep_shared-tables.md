# @beep/shared-tables — P1 source audit digest

Root-reviewed P1 source inventory. All rows remain open judgments; P2 remains gated.

All 1 assigned census files were reviewed completely: 4 human rows, 0 review proposals and 4 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 1 |
| flake | 1 |
| property | 1 |
| observability | 1 |

Severity: 4 info.

 3 unchanged mechanical candidates are separate from independent human coverage.

Top files (all have four rows; source-order tie, at most ten):

- `packages/shared/tables/test/OrganizationTable.test.ts`: 0 proposals; full lines 1–72, test.

The test inspects Drizzle table/index metadata, without SQL execution. There are no connection, transaction, layer rebuild or MemoryFS costs. Preserve intentional absent indexes and plain projected metadata assertions; SQL integration would be a different scope. No layer rebuild timing or speedup is claimed.

Review proposals:

No additional human review item was established beyond the file-specific coverage explanations and preserved mechanical candidates.

Completed Root baseline: 4 registered tests passed, zero failed; whole command 6.920493416 seconds, reporter file-span total 6511.327148 ms (different boundaries). All assigned files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. No timing was rerun. Passing once does not prove full package proof, coverage or absence of rare failures. Across the campaign, 139 first attempts are complete: 132 full-file-representation baselines, four configured subsets and three failures. Known failed Node cohorts remain failures; no baseline is rewritten.

Hosted evidence: 8 mapped observations across 1 jobs. These are production coverage-ratchet records, not named failing tests or unique flakes:


Campaign history covers 527 failed runs, including 21 unavailable logs and one unresolved cause. Historical production paths were not compared for introduced/inherited causal attribution in this lane.

After separate P2 authorization: Preserve the table/index metadata oracle and intentional absent indexes when addressing mechanical candidates. No additional human defect or SQL integration requirement was established. Preserve original assertions, generator inputs and replay options. The inherited ratchet additions remain untouched.

Pin: Effect/adapter 4.0.0-rc.113 at d3b837aee836f35d625d55205f7d6e61305fc198; adopted graph100. Vitest4.1.11 is the recorded runtime, not a supported rc113 peer assertion. Strict public decoder accepted every row. Exact read/source/contract hashes and full rows are private evidence; Root alone verifies and assembles canonical inventory. Remaining uncertainty is runtime reproduction and causal historical attribution, not missing assigned source reads.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

Exact historical coverage paths and generated-output names are preserved in the
[reference evidence receipt](../../../history/2026-09-21-p1-reference-evidence/README.md).
They identify captured observations, not current tracked source files.

# @beep/workspace-use-cases — P1 source-only digest

Root-reviewed P1 source inventory; P2 remains gated.

2 complete files, 8 rows: 1 review / 7 coverage.

| Lens | Rows |
| --- | ---: |
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

Severity: 7 info, 1 minor.

 Mechanical candidates remain separate open evidence.

Top files (all files, at most ten; descending review count):

- `packages/workspace/use-cases/test/ThreadTimeline.test.ts`: 1 reviews; full lines 1–260.
- `packages/workspace/use-cases/test/TaggedError.equivalence.test.ts`: 0 reviews; full lines 1–83.

Timeline schemas, branch selection and tagged-error equivalence are pure data. Store/vault error messages do not acquire those services. The twelve-schema loop needs identifiable failure context while preserving fcRuns(5); fixed branch truncation and corrupt-parent controls remain unchanged. No resource-bearing layer or measured rebuild cost exists.

Review proposals:

- `L-OBS-01` `ThreadTimeline.test.ts:161`: The loop runs native checkEffect over twelve schemas, checks only Passed and supplies no schema identifier on failure. Use pinned property diagnostics with separately identifiable schemas while retaining schema-derived equivalence and fcRuns(5). Preserve all fixed branch-history and encoded-shape assertions; do not raise/lower the run floor or replace the real law with a trivial validity check.

Retained Root baseline: 13 registered, zero failed; 4.370990121 whole-command seconds. All assigned files represented. Reporter SHA256 840888ba9d253f573701447d562c7667d680d840fcc27fd0c5e01a2382fd9467. No runtime proof was executed by this lane.

Hosted evidence: 0 mapped observations in 0 jobs. Zero mapped observations does not establish absence of failures. Runtime Node22.22.3/Bun1.4.2/Vitest4.1.11. Campaign timing is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets, three failures. Hosted evidence has 527 failed runs, 21 unavailable logs and one unresolved cause. Observations are not unique flakes; production coverage paths are not named test failures. A passing attempt does not prove full package proof, coverage or absence of rare failures. No collection was rerun.

After separate P2 authorization: Make all twelve timeline schema laws identifiable on failure while preserving fcRuns(5), fixed branch-history/encoded-shape controls and pure data scope. Do not lower run floors, widen optional gates or rewrite inherited failure evidence.

Exact Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198; graph100. Vitest4.1.11 is recorded runtime, not a supported-peer claim. Strict public decoding passed every row. Remaining uncertainty: runtime reproduction of source-derived risks and historical causal attribution; these tests do not acquire native integrations. Root alone accepts and assembles canonical inventory.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

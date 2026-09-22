# @beep/agents-tables — P1 source-only digest

Root-reviewed P1 source inventory; P2 remains gated.

1 complete files, 4 rows: 1 review / 3 coverage.

| Lens | Rows |
| --- | ---: |
| resource | 1 |
| flake | 1 |
| property | 1 |
| observability | 1 |

Severity: 3 info, 1 minor.

 Mechanical candidates remain separate open evidence.

Top files (all files, at most ten; descending review count):

- `packages/agents/tables/test/ProviderInstanceTable.test.ts`: 1 reviews; full lines 1–143.

Drizzle metadata, token-free column membership and row converters operate on values. The binary/home fields are synthetic data; no database or provider is acquired. No suite layer or measured rebuild cost exists. Keep the full 50-run schema equivalence law.

Review proposals:

- `L-OBS-01` `ProviderInstanceTable.test.ts:124`: The native converter property throws expect inside checkEffect and reduces the result to Passed. Use pinned adapter property registration/formatting to retain counterexample and replay diagnostics, preserving the full ProviderInstance equivalence, null/Option conversion, inserted ID omission and fcRuns(50). This concerns failure context beyond runtime syntax.

Retained Root baseline: 5 registered, zero failed; 6.672933817 whole-command seconds. All assigned files represented. Reporter SHA256 da552889eb2d86fd47ab23012e00da90526805dcf6eed1605eb79a89a67e6407. No runtime proof was executed by this lane.

Hosted evidence: 0 mapped observations in 0 jobs. Zero mapped observations does not establish absence of failures. Runtime Node22.22.3/Bun1.4.2/Vitest4.1.11. Campaign timing is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets, three failures. Hosted evidence has 527 failed runs, 21 unavailable logs and one unresolved cause. Observations are not unique flakes; production coverage paths are not named test failures. A passing attempt does not prove full package proof, coverage or absence of rare failures. No collection was rerun.

After separate P2 authorization: Preserve pure table/converter values and the full 50-run ProviderInstance law while improving counterexample/replay diagnostics. Do not lower run floors, widen optional gates or rewrite inherited failure evidence.

Exact Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198; graph100. Vitest4.1.11 is recorded runtime, not a supported-peer claim. Strict public decoding passed every row. Remaining uncertainty: runtime reproduction of source-derived risks and historical causal attribution; these tests do not acquire native integrations. Root alone accepts and assembles canonical inventory.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

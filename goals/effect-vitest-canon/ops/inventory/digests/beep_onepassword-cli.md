# @beep/onepassword-cli — P1 source audit digest

Root-reviewed P1 source inventory. All rows remain open judgments; P2 remains gated.

All 2 assigned census files were reviewed completely: 8 human rows, 1 review proposals and 7 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

Severity: 7 info, 1 minor.

 2 unchanged mechanical candidates are separate from independent human coverage.

Top files (all have four rows; source-order tie, at most ten):

- `packages/drivers/onepassword-cli/test/OnePasswordCli.equivalence.test.ts`: 0 proposals; full lines 1–24, test.
- `packages/drivers/onepassword-cli/test/OnePasswordCli.service.test.ts`: 1 proposals; full lines 1–254, test.

Both service blocks use makeLayerFromRunner, a pure Layer.succeed around deterministic synthetic outputs. Native runNative separately scopes a child process and concurrent stdout/stderr/exit drains but is not invoked by these files. Do not acquire op or secrets to audit them. The Unicode proposal exercises only the injected runner and preserves production UTF-8 semantics. No layer rebuild timing or speedup is claimed.

Review proposals:

- `L-PROP-02` `OnePasswordCli.service.test.ts:234`: The probe byteLength assertion uses an ASCII token and string.length; that misses a regression from UTF-8 byte count to code-unit count. Production probeReference correctly uses TextEncoder. Add valid synthetic non-ASCII runner outputs and compare TextEncoder byteLength while retaining exact Redacted read contents, reference/status fields and the existing ASCII case. Preserve all fcRuns(50) codec laws and opaque-cause exclusions; no real secret or process is needed.

Completed Root baseline: 6 registered tests passed, zero failed; whole command 17.817631839 seconds, reporter file-span total 16425.437012 ms (different boundaries). All assigned files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. No timing was rerun. Passing once does not prove full package proof, coverage or absence of rare failures. Across the campaign, 139 first attempts are complete: 132 full-file-representation baselines, four configured subsets and three failures. Known failed Node cohorts remain failures; no baseline is rewritten.

Hosted evidence: 0 mapped observations across 0 jobs. Zero mapped observations does not establish no historical failures.

Campaign history covers 527 failed runs, including 21 unavailable logs and one unresolved cause. Historical production paths were not compared for introduced/inherited causal attribution in this lane.

After separate P2 authorization: Add a synthetic Unicode byte-count witness to the injected runner tests while preserving correct production TextEncoder semantics, the ASCII case, redacted value assertions and 50-run floors. No secret or native process is required. Preserve original assertions, generator inputs and replay options. The inherited ratchet additions remain untouched.

Pin: Effect/adapter 4.0.0-rc.113 at d3b837aee836f35d625d55205f7d6e61305fc198; adopted graph100. Vitest4.1.11 is the recorded runtime, not a supported rc113 peer assertion. Strict public decoder accepted every row. Exact read/source/contract hashes and full rows are private evidence; Root alone verifies and assembles canonical inventory. Remaining uncertainty is runtime reproduction and causal historical attribution, not missing assigned source reads.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

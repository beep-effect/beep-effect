# @beep/ontology-domain — P1 source audit digest

Root-reviewed P1 source inventory. All rows remain open judgments; P2 remains gated.

All 2 assigned census files were reviewed completely: 8 human rows, 1 review proposals and 7 coverage rows.

| Lens | Rows |
| --- | ---: |
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

Severity: 7 info, 1 minor.

 0 unchanged mechanical candidates are separate from independent human coverage.

Top files (all have four rows; source-order tie, at most ten):

- `packages/ontology/domain/test/Session.test.ts`: 1 proposals; full lines 1–196, test.
- `packages/ontology/domain/test/TaggedError.equivalence.test.ts`: 0 proposals; full lines 1–27, test.

Session changes and partition derivation are pure RDF data operations, not a persistent store. Error equivalence is pure. There are no outer layers or measured rebuild costs; the review item strengthens exact quad identity rather than adding a database fixture. No layer rebuild timing or speedup is claimed.

Review proposals:

- `L-PROP-04` `Session.test.ts:190`: The applied batch asserts one added quad, one removed quad and one remaining asserted quad, but not their identities. A wrong one-for-one replacement would pass. Compare the actual added knows quad, removed name quad and remaining knows quad using serializeQuad or the established RDF equivalence, retaining all three counts. Session uses serialized-quad identity for add/remove. Extend partition-preservation checks with seeded unrelated partitions rather than claiming the current empty partitions prove non-mutation.

Completed Root baseline: 8 registered tests passed, zero failed; whole command 0.865701416 seconds, reporter file-span total 529.287354 ms (different boundaries). All assigned files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. No timing was rerun. Passing once does not prove full package proof, coverage or absence of rare failures. Across the campaign, 139 first attempts are complete: 132 full-file-representation baselines, four configured subsets and three failures. Known failed Node cohorts remain failures; no baseline is rewritten.

Hosted evidence: 0 mapped observations across 0 jobs. Zero mapped observations does not establish no historical failures.

Campaign history covers 527 failed runs, including 21 unavailable logs and one unresolved cause. Historical production paths were not compared for introduced/inherited causal attribution in this lane.

After separate P2 authorization: Strengthen exact added/removed/remaining quad identity and seeded partition preservation while retaining the existing counts and pure RDF subject. Preserve original assertions, generator inputs and replay options. The inherited ratchet additions remain untouched.

Pin: Effect/adapter 4.0.0-rc.113 at d3b837aee836f35d625d55205f7d6e61305fc198; adopted graph100. Vitest4.1.11 is the recorded runtime, not a supported rc113 peer assertion. Strict public decoder accepted every row. Exact read/source/contract hashes and full rows are private evidence; Root alone verifies and assembles canonical inventory. Remaining uncertainty is runtime reproduction and causal historical attribution, not missing assigned source reads.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

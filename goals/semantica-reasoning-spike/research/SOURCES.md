# Semantica Reasoning Spike: Sources and Provenance

- **Source exploration:**
  [`explorations/semantica-lab`](../../../explorations/semantica-lab/README.md)
- **Primary ledger:**
  [`explorations/semantica-lab/research/SOURCES.md`](../../../explorations/semantica-lab/research/SOURCES.md)
  — this file is the goal-side mirror; when the two disagree, the exploration
  ledger wins and this copy is corrected.
- **Decision authority:**
  [`explorations/semantica-lab/DECISIONS.md`](../../../explorations/semantica-lab/DECISIONS.md)
  (Current law table; 2026-09-03 ratification grill R0.a, R1.g, R2.a–R2.g).
- **Design sources:**
  [`MAP.md` §R](../../../explorations/semantica-lab/MAP.md#r-semantica-reasoning-spike--the-fixture-is-the-spikes-first-slice-not-its-gate)
  v1.1;
  [`research/adhd-reasoning.md`](../../../explorations/semantica-lab/research/adhd-reasoning.md)
  (D15 opportunity space, §Focus 1–3);
  [`research/grounding-v3-logos.md`](../../../explorations/semantica-lab/research/grounding-v3-logos.md)
  (v3 salvage verdict); adversarial review
  [`reviews/2026-09-03-sol-reentry-review.md`](../../../explorations/semantica-lab/research/reviews/2026-09-03-sol-reentry-review.md).
- **Carry-forward date:** 2026-09-03

The tables below reproduce the rows of the exploration's corpus this spike
composes. Machine-local paths are rendered as out-of-repo locations by name.

## 1. Mined source corpus

The D5 extraction IR is not on this spike's path. The upstream tracker sweep
([`upstream-tracker-mining.md`](../../../explorations/semantica-lab/research/upstream-tracker-mining.md),
[`tracker/inventory.jsonl`](../../../explorations/semantica-lab/research/tracker/inventory.jsonl))
recorded the STRENGTHENED demand for proof-bearing, LLM-free reasoning that
keeps the O4 `reasoning-package` gate alive; T2 forbids waiting on the
overlapping upstream RETE PR #1077 and its catalog twins.

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What this spike takes |
| --- | --- | --- | --- |
| `beep-effect-logos` (out-of-repo archived v3 beep-effect, recorded under a workstation projects root) | Apache-2.0 (verified in its LICENSE on 2026-08-24). **Absent from the recorded path on 2026-09-03; reference-only until relocated — locating it is the P3 entry condition (R2.g)** | salvage with Apache-2.0 attribution/NOTICE for copied code and tests; re-derived patterns need none | `rete` SALVAGE (network topology + the 46 behavioural tests as the match-semantics oracle), `rules` PATTERN (operator taxonomy), `logos` PATTERN (rule-AST + validator semantics) — per [`grounding-v3-logos.md` §5](../../../explorations/semantica-lab/research/grounding-v3-logos.md#5-verdict-for-the-new-lab) |
| EYE (`eyereasoner/eye`) https://github.com/eyereasoner/eye and eye-js (npm `eyereasoner`) https://github.com/eyereasoner/eye-js | MIT | reuse as test-time dependency, pinned (EYE 11.24.5 via `eyereasoner` 21.1.18, catalog-enforced) | the restricted oracle behind every gold case; never the runtime |
| `semantica-agi/semantica` (out-of-repo workstation clone, `danklocal` at `add1c006`) | MIT (Hawksight AI, verified) | port-with-attribution, schema-first | typed inference explanations as a concept only |

## 3. External research sources

Every URL below appears in the exploration ledger and was fetched there.

- RDF 1.1 Semantics §9.2.1 RDFS entailment patterns
  https://www.w3.org/TR/rdf11-mt/#patterns-of-rdfs-entailment-informative
- Muñoz, Pérez, Gutierrez 2009, "Simple and Efficient Minimal RDFS" (ρdf)
  https://users.dcc.uchile.cl/~cgutierr/papers/jws09.pdf
- SWAP reason vocabulary https://www.w3.org/2000/10/swap/reason#
- EYE `documentation/command_line.md` and `reasoning/socrates/socrates-proof.n3`
  (in the EYE repository above)
- Doorenbos 1995, "Production Matching for Large Learning Systems",
  CMU-CS-95-113 http://reports-archive.adm.cs.cmu.edu/anon/1995/CMU-CS-95-113.pdf
  (the Rete the v3 salvage implements)
- Doyle 1979, "A Truth Maintenance System"
  https://doi.org/10.1016/0004-3702(79)90008-0 (support-set retraction; R-c
  and P4)
- S1 stop rule — Shape Up ch. 8 "The circuit breaker"
  https://basecamp.com/shapeup/2.2-chapter-08

## 4. In-repo capability references

| Brick | Path | Mark |
| --- | --- | --- |
| Reasoning oracle (test-time) | `apps/labs/semantica/test/helpers/EyeOracleChild.ts` (`--restricted`, 64 KiB input / 1 MiB output caps) + `apps/labs/semantica/scripts/generate-g-entailment.ts` | reuse; extend the generator for the rules family |
| Pinned rdfs gold | `apps/labs/semantica/fixtures/gold/v1/g-entailment-rdfs.{json,n3}` (`g-entailment-rdfs/v1`, per-case `eyeProofDigest`) | frozen; the rules family is a sibling |
| Case-runner shapes that do not carry over | `src/schema/Reasoning.ts` `GEntailmentExpectation` (pinned to rdfs/v1), `RdfsRuleId` (seven-member LiteralKit), `InferenceEngine` (`S.Literal("semantica-rhodf/1")`) | NET-NEW `g-entailment-rules/v1`; widen rule id and engine domains |
| Rules as data | `src/schema/Reasoning.ts` `RdfsRule`, `StatementPattern` (variable predicates admitted) | reuse for user-vocabulary production rules |
| Proof objects | `src/schema/Reasoning.ts` `ProofDag`, content-addressed `InferenceEvent` ids; replay-identical C2 reports | already-have for P-R1; NET-NEW `CanonicalProofNodeV1` |
| Naive fixpoint | `src/layers/ReasonerLive.ts` | the ablation baseline for P-R2/P-R3 |
| Write model | `src/schema/Evidence.ts` `EvidenceBatch`, claim-level `ConflictWitness` (`ClaimId` pairs); `src/layers/LedgerLive.ts` `appendBatch` | reuse; NET-NEW statement-level conflict witness for R-e |
| Tombstone law | `goals/semantica-storage-inversion` P-S1 (`Invalidated`, reach via `claimQuads` + recorded premises) | inherited after P-S1 lands |
| RDF terms | `@beep/rdf` (`ObjectTerm`, Prov shapes) | reuse |
| Neighbour drivers for a future package | `packages/drivers/n3`, `oxigraph`, `shacl`, `rdf-canonize` | reference only until the O4 gate opens |

**How these inform implementation:** the oracle, the pins, the proof DAG and
the naive fixpoint already exist; the NET-NEW surface is one tagged fixture
family, two widened domains, `InferenceTruncated`, the statement-level
conflict witness, `CanonicalProofNodeV1`, `RuleCertificate` with its pure
compiler, and the ported behavioural oracle. `GEntailmentExpectation` is
never reused.

## 5. Cross-links and provenance

- Goal ↔ exploration: this packet is `links.goals[]` in
  [`explorations/semantica-lab/ops/manifest.json`](../../../explorations/semantica-lab/ops/manifest.json);
  `provenance.exploration` in [`ops/manifest.json`](../ops/manifest.json).
- Siblings: [`goals/semantica-storage-inversion`](../../semantica-storage-inversion/README.md)
  (P-S1 before R-c and P2–P4);
  [`goals/semantica-canary`](../../semantica-canary/README.md) (C2 runtime
  and oracle wiring);
  [`goals/semantica-atlas-sync`](../../semantica-atlas-sync/README.md)
  (writes any atlas row a reasoning verdict changes).
- Decision log: [`SPEC.md` §Decision Log](../SPEC.md#decision-log).

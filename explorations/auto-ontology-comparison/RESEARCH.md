# Auto Ontology versus the full Beep knowledge stack — decision dossier

Research snapshot: 2026-11-03. Publication scope settled: 2026-11-06.
Status: **research complete under the reduced two-assessment scope; experiments unstarted**.

## Decision

Retain Beep's current architecture. Do not adopt Auto Ontology wholesale or make an Ossie bridge the next implementation commitment. First test the concrete gaps in certification, query safety, information loss, and Beep validation contracts. For a warehouse analytics use case, evaluate AO as a complementary catalog/query system; for Beep's existing evidence-heavy workflows, prioritize consumer integration and evidence-preservation tests over adding another ontology representation.

This is a research decision and experiment plan, not implementation authorization or a runtime proof. No overall winner is justified. Operational and engineering costs remain separate from correctness, evidence integrity and usefulness.

## Evidence and completion

| Requested lane | Result | Limits |
|---|---|---|
| Grok 4.7, xhigh, deep-research | Source assessment plus completed workflow with Partial verdict | 21 retained claims, 12 dropped candidates and 3 rejected claims; no runtime measurements |
| Claude Opus 5.5, medium, deep-research | Completed five-researcher run and synthesis | Child model inheritance reported by coordinator; individual model receipts not independently verified |
| Kimi K 3.1 Pro, high | Omitted from final scope | No assessment produced; provider launch failed before research; no substitute |
| Muse Wonder 1.0, xhigh, deep-research | Skipped at user request | Usage exhausted; no assessment produced; scheduled retry disabled |

ADHD: five parallel isolated frames, 30 candidates scored, three focus tasks completed. See [ADHD.md](ADHD.md) and its [scored proposal pool](research/ideation-pool.json). No blocked model was substituted. Earlier direct-reading reports did not satisfy the requested deep-research method; the corrected reports supersede their method claims.

Pinned source:
- Beep: 8fe07d3eed947c146448d1e469af4bb06148c7c3.
- AO: 6c4fb71e20c1f9fc4b6059aa1c99f55b697d60b0.
- Source repositories: https://github.com/NVIDIA/auto-ontology and the local Beep checkout.
- Evaluation repository: https://github.com/NVIDIA/ontology-sql-eval.
- Interchange source: https://github.com/apache/ossie.

The [source ledger](research/SOURCES.md) supplies immutable file links for the
load-bearing claims below. The two completed assessments were inputs to this
synthesis, not votes establishing truth. The full local working reports remain
outside this public packet; the packet's claims must be reviewable from its pinned
primary sources without those reports. Test-source assertions are not passing-test
receipts. Negative searches are bounded evidence, not universal absence proofs.
The research describes the pinned revisions, not the later publication base.


## Comparison

| Aspect | Evidence-backed assessment | Decision implication |
|---|---|---|
| Warehouse ingestion and SQL agents | AO has connectors, catalog compilation, pgvector retrieval, query repair and analytics MCP | Useful complementary capability; no evidence Beep already provides an equivalent warehouse product |
| Formal representation | Beep has RDF datasets, named graphs, SKOS alignment and a declared structural reasoning fragment; AO models terms/attributes/SQL and semantic FKs relationally | Different semantics; a SQL metric is not automatically an OWL axiom |
| Evidence and uncertainty | Beep has explicit absence, separate signals, temporal claims and review-basis binding; AO certification is a catalog flag | Preserve these distinctions if importing candidates; do not treat a flag as an evidence certificate |
| Certification | Both assessments find no certification predicate on the inspected retrieval path; Claude finds tests preserving flags across SQL rewrites | Test edit invalidation and enforcement separately; badge rollup is not retrieval policy |
| SQL safety | Probe and chat execution paths differ; statement-type enforcement is not established on the main path | Prove behavior with disposable fixtures and exact locked dependencies; database grants remain a separate control |
| Interchange | Claude traces losses before and during Ossie conversion: certification, synonyms and other metadata, plus single-table projection | Require field-by-field loss accounting; no blanket “lossless bridge” claim |
| Beep validation | Workbench engine and bounded ClaimGate validator are distinct; richer shapes are not automatically exercised in the claim path | Specify the contract each consumer requires, then test supported constraints and unsupported-shape handling |
| Actual consumers | Desktop ontology MCP is real and gated. Foundation ontology and richer provenance/review machinery have limited or absent consumers in the inspected paths | Distinguish useful domain models from end-to-end guarantees; avoid describing all Beep knowledge as RDF-backed |
| Security and tenancy | AO gateway permissions do not by themselves secure reachable backend ports; zones are not proven end-to-end tenant isolation | Inspect deployment reachability and identity propagation before shared use |
| Productization | AO supplies a curator web UI and deployment packaging | Packaging supports usability potential, not proven production reliability |
| Benchmarks | Asymmetric examples/value anchors and grader-specific behavior prevent attributing a published configuration's gain solely to ontology | Run controlled ablations on held-out data before accuracy claims |

The reports disagree in breadth, not only conclusions. Grok initially underweighted the foundation alignment fold and corrected it. Claude corrected connector counts and earlier provenance-consumer claims. Avoid carrying the initial “FOLIO mirrors only” characterization forward. Neither report proves exploitability, deployed reliability, clinical/legal correctness, or measured performance.

## Ranked experiment portfolio

All acceptance criteria below are proposed. Freeze inputs, revisions and scoring before execution. A failed or inconclusive result must remain visible.

1. **Certification lifecycle and retrieval enforcement.** Seed deterministic terms/attributes without model calls. Exercise SQL/description edits, source changes, zone visibility, export/import and reset. Capture flag, review basis, candidate set and selected definition independently. Compare unchanged and changed records. A governance-ready design must invalidate or explicitly scope approval after a material change, preserve required history, and enforce the declared selection policy. One surviving boolean confirms only that lifecycle case, not every suspected route. UI unticking does not establish backend enforcement. Cost: approximately half to one engineer-day, disposable database, no inference needed.

2. **Generated SQL execution boundary.** Use a recording connector first, then a disposable database with sentinel rows and tightly scoped roles. Exercise DML, DDL, multiple statements and side-effecting functions through parser, probe, chat and fallback paths with the locked parser version. Compare writable and read-only roles. Acceptance for adoption: forbidden operations are rejected before dispatch under the intended policy; independent DB grants prevent mutation. An LLM judge is not a deterministic security boundary. Failure to reproduce one payload does not disprove the whole class. Cost: half to one day for deterministic stage; model-driven red-team episodes are separate.

3. **Beep validator contract differential.** Send identical requests to the bounded and full engines, with constraints inside and outside the bounded contract. Compare against a pinned reference engine within each declared support profile. Acceptance: zero disagreement inside the supported contract; unsupported constructs must be rejected or explicitly reported. Do not label every expected subset difference a defect. Include the actual ClaimGate shape and richer proposed variants. Cost: roughly one day, no inference.

4. **PII/sample-value and deployment-boundary probes.** Use fake emails/phones and endpoint stubs to trace tagged values into persistence, embeddings, exports and prompts. Separately check gateway/backend access with authenticated, unauthenticated and forged-identity requests in a local isolated deployment. Accept only the documented egress/access policy; report sinks separately. No real sensitive corpus. Cost: half to one day plus disposable setup.

5. **Ossie loss manifest.** Compare native AO export, AO pre-projection, converter output and reverse conversion. Include multi-table terms, keys, types, synonyms, certification and ownership. Acceptance is exact preservation of decision-critical fields or explicit rejection/sidecar retention; a “less than 5% loss” aggregate cannot excuse losing the one field that carries approval. Keep SQL as an opaque expression unless a separately verified semantic translation exists. Cost: one to two days, no inference.

6. **Evidence-bound refusal.** Pilot 40 independently labeled questions: answerable, partially answerable and unsupported, with lexical decoys and source-version swaps. Compare raw schema, AO as shipped, common typed-answer contract and contract ablation under identical information access. Distinguish valid empty answers, explicit refusal and execution failure. Score unsupported mappings, useful answers, missing-element explanations and verifiable version citations. A pilot validates measurement; size a confirmatory study before asserting small percentage-point improvements. Contract advantage is not automatically ontology advantage. Cost: annotation plus bounded inference and harness work.

7. **Versioned rejection memory.** First test a pure ledger decision function: unchanged reviewed candidate withheld with reason, unseen remains unknown, meaningful new evidence becomes eligible for reconsideration with old decision retained. Compare stateless regeneration and a string-only denylist. Accept exact invariants on fixtures. Then separately measure real repeat-review burden and wrongful suppression; fixture perfection alone does not establish usefulness. Revision change is not acceptance, and cosmetic edits should not cause repeated review storms. Cost: small deterministic pilot, zero model calls initially.

8. **Stale-evidence laundering.** Seed conflicting metric versions, retraction notices and dependent copies in supported warehouse metadata. Compare AO raw, AO with the same status information, Beep fixture gate with gold labels, and the gate with extracted labels; keep generator/executor fixed. Trace retrieved version, SQL lineage and cited version. Separate “as known then” from retrospective corrected truth. Require useful answer coverage and zero fabricated support; pre-register a practical improvement margin and confidence interval. An observed gap below five points is not an equivalence result. Cost: multi-day fixture/harness work and inference; annotation cost reported separately.

9. **Controlled SQL usefulness delta.** Only if warehouse analytics is a real Beep priority. Factor ontology and examples/value anchors independently; equalize model, hints, decoding and resource budgets. Use held-out schemas, with development datasets secondary. Report paired intervals, failures, accuracy and cost per useful answer. A confidence interval spanning zero is inconclusive rather than proof of no benefit. Adoption needs a pre-agreed practical margin, not merely statistical significance. Cost: highest; no new paid endpoint without explicit spending authorization.

## Assumptions to challenge

- More formal semantics do not imply better practical answers.
- A database-oriented semantic catalog is an ontology in a different sense; lack of RDF alone is not a defect.
- A schema-valid record is not true, approved or authorized.
- Repeated model agreement and copied documents do not create independent support.
- Certification displayed in a UI does not establish query enforcement.
- A model/package with no observed caller does not deliver a runtime guarantee.
- Source age and query frequency are not truth measures.
- Export syntax compatibility does not establish semantic equivalence.
- A small synthetic benchmark cannot establish domain-wide superiority.

## Strongest objections

If the immediate job is warehouse analytics, AO may supply most of the useful product while a Beep evidence bridge adds costly curation with little measured benefit. Read-only credentials may already supply the intended SQL boundary. If annotation parity removes the Beep harness advantage, catalog metadata may be sufficient for that workload. Conversely, if warehouse analytics is not on Beep's path, the highest-value outcome is internal validator/consumer clarification and reusable test patterns, not an AO integration.

Keep these alternatives alive until the experiments distinguish them. This PR publishes the research only. Implementation and runtime experiments require a separately scoped follow-on.


## Evidence map

- Representation and alignment: [AO representation and Beep semantics](research/SOURCES.md#representation-and-semantics).
- Certification, query selection and SQL checks: [governance and execution](research/SOURCES.md#governance-and-execution).
- Validator distinction and live consumers: [Beep validation and consumers](research/SOURCES.md#beep-validation-and-consumers).
- Sampling, interchange and benchmark limits: [egress and evaluation](research/SOURCES.md#egress-and-evaluation).

## Interpretation limits

The experiment order is an editorial risk-first priority, not a measured return on
investment. Duration estimates are planning estimates, not observed implementation
times. No database probes, security exploitation, benchmark runs or deployment
acceptance were performed. The recommendation may change after controlled evidence.

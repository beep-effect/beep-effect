# Cluster synthesis — Memory, bitemporal knowledge & epistemic state

- **Date:** 2026-07-25  **Synthesist:** codex gpt-5.6-sol (max)
- **Cluster:** memory-bitemporal — 25 papers (ids listed at the end)
- **Feeds:** `standards/memory-architecture/*`, `goals/epistemic-bitemporal-edge-core`, and downstream semantic-foundation, citation/retrieval, and agent-governance streams

## Verdict paragraph

This cluster does not justify a smarter permanent semantic memory; it justifies a stricter separation between immutable evidence and every interpretation of it. Exact events, documents, sourced assertions, versions, and transition records should form the authority substrate. Summaries, embeddings, graphs, consistent belief views, retrieval rankings, narrative state, quality scores, and agent-specific context should remain versioned, auditable, rebuildable projections. That strongly supports the current bitemporal goal’s immutable payloads, half-open axes, evidence-scoped identity, durable rejection, atomic supersession, canonical as-of reads, and refusal to place an external graph in the authority path. It also exposes three corrections: the memory taxonomy must distinguish an exact episodic corpus from its prunable semantic index; a two-axis epistemic core must not be mistaken for complete legal-time semantics; and structural validation, provenance integrity, or stable retrieval cannot by themselves establish substantive truth.

## Design challenges

1. **Cache lifecycle operations must never operate on canonical episodic history.** `01-memory-layer-taxonomy.md` currently describes old session material dropping away, semantic compression, and score-driven promotion into durable memory. That conflicts with the No-Escape authority boundary if it means pruning exact events or promoting unsupported summaries. `5c2aeef6919d` (Ontology Revision as Non-Prioritized Belief Revision) retains all sourced assertions behind a disposable working view; `2ebef49a0b91` (Construction of Knowledge Graphs) requires provenance-preserving incremental repair; `0e1b8c67380f` (Modified Sparse Distributed Memory), `52d958293653` (Text-based Reasoning with Symbolic Memory Model), and `08e376be5ed2` (Mind-Tool) show how reconstructed, inferred, or rewritten memory loses record identity. **Evidence strength:** high architectural convergence, with survey support and a small reconstructive-memory experiment, but little production validation. **Re-examine:** split Layer 2 into an exact event corpus outside the theorem class and a bounded semantic/session projection inside it. Define decay, pruning, consolidation, and forgetting exclusively as projection operations; promotion should mean a provenance-bearing admission event, never movement or deletion of source evidence.

2. **Gate success, telemetry conformance, hashes, recurrence, and non-contradiction are not truth states.** `fc16fbd18148` (MemoryFlow) separates structural/provenance verification from external truth; `7263be9774fb` (Triadic Memory Governors) limits its guarantee to deterministic control; `0d6fc0e76e0f` (Knowledge graph augmentation) mistakes link counts and hashes for reliability; `4feeb0ca3d30` (Authority-Aware Memory Partitioning) uses recurrence as promotion pressure; and `ad0622e993ee` (Reasoning About Reasoning) distinguishes attribution, derivability, and accepted belief. **Evidence strength:** strong logical and architectural support, weak empirical validation. **Re-examine:** maintain separate states for schema-valid, provenance-well-formed, exact-span-verified, entailment-checked, authority-assessed, accepted, and attorney-approved. This explicitly challenges the June-29 synthesis where `ClaimGate` admission is described as making the institutional fact obtain. Admission can establish workflow status; it cannot alone establish substantive truth.

3. **The two-axis core is necessary but not complete legal temporality.** `2ebef49a0b91` (Construction of Knowledge Graphs) supports validity and transaction time; `10828be135bf` (Finding fault) shows that release chronology is only knowledge-time-like; `fc16fbd18148` (MemoryFlow) shows observation and event time are not bitemporality; and `8fb75bf2f8c9` (LTMC) demonstrates that access recency is yet another distinct signal. **Evidence strength:** high for separating temporal meanings, medium for legal-domain completeness. **Re-examine:** keep `goals/epistemic-bitemporal-edge-core` core-only as specified, but document that `validAt` does not collapse legal enforceability, efficacy, and applicability, while `knownAt` does not mean observation, arrival, access, or release time. A downstream legal-time layer should compose over the core instead of widening it.

4. **One disposition or current fact cannot represent contested epistemic state.** `5c2aeef6919d` (Ontology Revision as Non-Prioritized Belief Revision) separates retained assertions from preferred-view membership; `ad0622e993ee` (Reasoning About Reasoning) separates own, attributed, and promoted beliefs; `52d958293653` (Text-based Reasoning with Symbolic Memory Model) separates evidence from inference; and `8567b5e65460` (How U4 and U8 Solve AI Memory Handling) demonstrates the audit failure caused by collapsing uncertainty, conflict, absence, and inactivity into unstable labels. **Evidence strength:** strong formal and conceptual support, with the bronze paper serving mainly as a negative case. **Re-examine:** ensure `ClaimDisposition` remains orthogonal to evidence polarity, attribution, review, working-view membership, and retrieval salience. Evidence-scoped competing assertions must be allowed to coexist; no-overlap should apply within one logical assertion lineage, not erase sourced disagreement.

5. **Recorded order is history, not epistemic precedence.** `5c2aeef6919d` (Ontology Revision as Non-Prioritized Belief Revision) rejects arrival order as an acceptance rule while admitting its own weighting remains order-sensitive; `fc16fbd18148` (MemoryFlow) defines deterministic ordering but leaves late-event policy unresolved; `7263be9774fb` (Triadic Memory Governors) is deterministic only when every input and version is frozen. **Evidence strength:** medium; the issue is precisely specified but not evaluated at scale. **Re-examine:** supplement deterministic race tests with batch-permutation, late-arrival, conflicting-duplicate, and replay tests. Where order intentionally changes the result, persist the policy basis and expose the causal difference.

6. **Consistency repair can fabricate unsupported facts or cause nonlocal belief cascades.** `d9e73d47d4a2` (Formal Foundations for RDF/S KB Evolution) proves complete repair search and global minimality under restrictive assumptions, but permits synthetic positive facts and shows singular fast paths cannot safely compose. `5c2aeef6919d` (Ontology Revision as Non-Prioritized Belief Revision) shows that changing one source score can replace an entire preferred view. **Evidence strength:** high formal support, no realistic scalability or legal evaluation. **Re-examine:** confine repair operators to semantic projections. Unsupported fillers remain explicit proposals with rule provenance and approval state. Batch repairs should be atomic, complete side effects reviewable, and optimized handlers checked against a general executable specification.

7. **Quality estimates need their own bitemporal refresh lifecycle.** `2b2bc2e2a40e` (Efficient Knowledge Graph Accuracy Evaluation) shows that indefinitely reusing a mistaken initial audit can preserve the error while appearing efficient; `fc16fbd18148` (MemoryFlow) invalidates metrics when lifecycle telemetry is incomplete; `10828be135bf` (Finding fault) shows snapshot quality misses historically visible regressions. **Evidence strength:** strong sampling theory plus empirical cost and refresh results, though mostly on synthetic or small non-legal datasets. **Re-examine:** version every graph-quality estimate with its sample, policy, interval, source versions, and audit time. Require maximum ages, change-triggered invalidation, and periodic sample replacement.

8. **Stable storage identifiers do not settle real-world identity.** `d9e73d47d4a2` (Formal Foundations for RDF/S KB Evolution) relies on an unsafe unique-name assumption; `10828be135bf` (Finding fault) finds rename-driven false churn across ontology releases; `2ebef49a0b91` (Construction of Knowledge Graphs) distinguishes IRIs from implementation-local graph IDs; and `ca5205ebbea7` (CoMMA) separates formal identity from labels and synonyms. **Evidence strength:** strong formal warning, survey corroboration, and one substantial longitudinal case study. **Re-examine:** keep labels, aliases, record IRIs, entity identity, and identity folds distinct. Represent renames and equivalence corrections as evidenced, time-indexed events rather than delete-and-recreate operations.

## Direct patterns

- **Retained evidence base plus preferred working view.** Preserve every sourced assertion, including rejected and mutually inconsistent ones, while deriving a consistent task-specific view with explicit membership decisions. Sources: `5c2aeef6919d` (Ontology Revision as Non-Prioritized Belief Revision), `2ebef49a0b91` (Construction of Knowledge Graphs), and `d9e73d47d4a2` (Formal Foundations for RDF/S KB Evolution). **Target:** epistemic/bitemporal follow-on and semantic foundation. **First step:** create a post-core fixture in which two conflicting assertions survive, one is excluded from the working view, and retracting its defeater rescues it without rewriting either source assertion.

- **Exact-version memory telemetry.** Bind every read, use, verification, correction, and replacement to stable event identity, update identity, content digest, policy version, and both temporal axes. Distinguish retrieval from actual behavioral use; flag reads of tombstoned or superseded versions. Source: `fc16fbd18148` (MemoryFlow). **Target:** memory architecture and agent governance. **First step:** specify a projection-only event envelope plus fail-closed `invalidReason` vocabulary; test conflicting duplicates, TTL right boundaries, late collectors, obligation expiry, and heap/state compaction before implementing metrics.

- **Reasoner-aware longitudinal change analysis.** Store asserted axiom membership by release separately from regenerated entailments, then classify changes as effectual or ineffectual and mine add-remove cycles. Sources: `10828be135bf` (Finding fault) and `d9e73d47d4a2` (Formal Foundations for RDF/S KB Evolution). **Target:** semantic foundation and identity. **First step:** build a small three-release fixture containing a substantive reversal, a harmless rename, and an ineffectual edit; emit review candidates with before/after entailments rather than automatic rollback.

- **Cost-aware, refreshable semantic audits.** Group review by entity or document to amortize setup cost, use two-stage weighted cluster sampling, retain estimator uncertainty, and periodically replace historical samples. Source: `2b2bc2e2a40e` (Efficient Knowledge Graph Accuracy Evaluation). **Target:** semantic-foundation QA and citation verification. **First step:** time a pilot attorney review batch, estimate per-context and per-claim costs, and choose the within-context sample cap from observed variance rather than copying the paper’s heuristic.

- **Fail-closed write governor.** Keep the governor outside generation, persist its complete versioned inputs, quarantine proposed durable writes during instability, and allow semantic signals only to veto, delay, widen retrieval, or escalate. Sources: `7263be9774fb` (Triadic Memory Governors) and `fc16fbd18148` (MemoryFlow). **Target:** agent control plane. **First step:** define a declarative rule set for missing evidence, retrieval volatility, contradiction, and stable resumption; fail closed when observation completeness cannot be proven.

- **Two-speed memory production with separate commit authority.** The live agent emits a completed-interaction event; a bounded asynchronous worker proposes derived memory; a separate authority validates and commits any transition. Sources: `119ef7c68fae` (The Bicameral Linux), `4feeb0ca3d30` (Authority-Aware Memory Partitioning), and `e7d800d250b1` (NexxusOS). **Target:** professional-desktop agent orchestration. **First step:** define queue, snapshot, race, retry, and backpressure semantics for one candidate-memory worker whose output must include source spans and cannot write authority directly.

- **Inspectable prompt-context objects.** Reify what the model currently sees, while keeping it distinct from canonical conversation history. Hiding, sharing, reordering, editing, and summarizing become auditable inclusion or derivation events. Source: `1f883c9bfd38` (Memory Sandbox). **Target:** professional-desktop UX. **First step:** model one stable source object, per-agent inclusion edges, and a summary object that drills down to its exact source objects; user deletion from context must not delete canonical history.

- **Fuzzy retrieval as traced candidate generation.** Missingness-aware distance, connected-subgraph activation, and scenario-gated symbolic retrieval may improve candidate recall, but each result must resolve to an exact source record before supporting a claim. Sources: `0e1b8c67380f` (Modified Sparse Distributed Memory), `8fb75bf2f8c9` (LTMC), and `52d958293653` (Text-based Reasoning with Symbolic Memory Model). **Target:** hybrid retrieval and verified-span citation. **First step:** add fixtures for missing query fields, false high-similarity neighbors, superseded evidence, and graph hubs while logging index version, seeds, score components, candidates, and final span resolution.

## Corroborations

- The cluster independently supports the No-Escape rule that semantic retrieval is a suggestion mechanism, not authority: `0e1b8c67380f` (Modified Sparse Distributed Memory), `8fb75bf2f8c9` (LTMC), `52d958293653` (Text-based Reasoning with Symbolic Memory Model), and the narrative-memory papers all expose reconstruction or compression loss.

- The current bitemporal goal’s immutable payloads, durable rejected dispositions, atomic close-and-insert, lineage, evidence-scoped identity, and two-axis as-of proof are strongly supported by `2ebef49a0b91` (Construction of Knowledge Graphs), `5c2aeef6919d` (Ontology Revision as Non-Prioritized Belief Revision), and `10828be135bf` (Finding fault).

- The goal’s prohibition on automatic supersession from contradiction is correct. Conflict should alter review or working-view membership, not erase evidence, as supported by `5c2aeef6919d` (Ontology Revision as Non-Prioritized Belief Revision) and `ad0622e993ee` (Reasoning About Reasoning).

- Stable IRI identity, assertion-level provenance, exact source versions, and an asserted-versus-derived boundary are independently supported by `2ebef49a0b91` (Construction of Knowledge Graphs), `ca5205ebbea7` (CoMMA), and `10828be135bf` (Finding fault).

- Treating the LLM as replaceable compute rather than durable state is corroborated by `4feeb0ca3d30` (Authority-Aware Memory Partitioning), `e7d800d250b1` (NexxusOS), `08e376be5ed2` (Mind-Tool), and `ad0622e993ee` (Reasoning About Reasoning).

## Delta vs the June-29 prior synthesis

**Genuinely new here:**

- A concrete belief-revision architecture: retained, possibly inconsistent sourced assertions behind a recoverable preferred consistent view, including rejected, duplicate, and rescued assertion events (`5c2aeef6919d`, Ontology Revision as Non-Prioritized Belief Revision).

- Exact-version operational telemetry: separate READ and USE events, content-digest binding, verification obligations, zombie/supersedence exposure, and fail-closed metric invalidity (`fc16fbd18148`, MemoryFlow).

- Formal repair obligations: exhaustive alternatives, global rather than greedy minimality, atomic compound requests, equivalence obligations for fast paths, and the risk of consistency repairs inventing unsupported facts (`d9e73d47d4a2`, Formal Foundations for RDF/S KB Evolution).

- Longitudinal ontology CI: effectual versus ineffectual edits, add-remove regression patterns, rename confounds, and stable-backbone analysis across releases (`10828be135bf`, Finding fault).

- Uncertainty-bounded and cost-aware semantic audits, including empirical evidence that indefinitely reused historical samples can preserve an initial error (`2b2bc2e2a40e`, Efficient Knowledge Graph Accuracy Evaluation).

- Inspectable per-agent prompt-context objects, deterministic write quarantine, and lineage requirements for derived-memory invalidation or unlearning (`1f883c9bfd38`, Memory Sandbox; `7263be9774fb`, Triadic Memory Governors; `5509c8933f8d`, MemEvolve).

**Re-confirmed rather than new:**

- Stable identity separated from labels and storage IDs.
- Per-assertion provenance and exact source/version retention.
- Event-sourced history rather than mutable current-state replacement.
- Valid-time separated from knowledge/transaction time.
- Asserted evidence separated from inference and semantic projection.
- Semantic retrieval, summaries, graphs, and model state kept outside authority.
- Human or attorney adjudication retained for consequential ambiguity.

These were already central to the June-29 synthesis’s identity, provenance, temporal, event-sourcing, and evidence-span recommendations.

**Contradictions and corrections:**

- The June-29 synthesis overstates `ClaimGate` admission by treating structural admission as sufficient for an institutional fact. This cluster requires structural validity, source grounding, entailment, authority, and approval to remain separate. The current repo audit also establishes that the claimed verified publication gate is not implemented.

- The prior synthesis calls schema the single source of truth for types, persistence, and ontology. The cluster supports schema authority over representation and validation shape, but not over sourced facts, historical ontology releases, or real-world identity. Those remain evidence-led and versioned.

- The prior synthesis’s multi-temporal legal model and the current two-axis bitemporal goal are compatible only as layers. Treating the core’s `validAt` as a replacement for enforceability, efficacy, and applicability would contradict the prior synthesis.

- Current repo state contradicts several June-29 implementation claims: `@beep/ontology` now exists, its proposed authoring API is retired, and multiple example APIs and symbols are stale. This report therefore carries forward conceptual findings only, not its code or present-state assertions.

## Tensions & contradictions

- **Retain everything versus selective forgetting.** `5c2aeef6919d` (Ontology Revision) retains all sourced assertions; `5509c8933f8d` (MemEvolve), `c0365b8e4e52` (CSNP), and `4feeb0ca3d30` (Authority-Aware Memory Partitioning) promote pruning or tier transitions. Adjudicate by substrate: evict derived caches and prompt material, not in-policy canonical evidence. Required deletion should follow an explicit retention, access, or key-destruction policy with descendant invalidation—not semantic forgetting.

- **Possibly inconsistent evidence versus always-valid knowledge bases.** `5c2aeef6919d` permits inconsistency in the retained background base; `d9e73d47d4a2` assumes a valid starting KB and repairs back to validity. Use both: the authority ledger may contain conflicting reports, while each reasoning projection declares and satisfies a versioned validity policy.

- **Deterministic total order versus order-independent acceptance.** `fc16fbd18148` requires reproducible event order; `5c2aeef6919d` argues arrival order should not determine acceptability. Preserve deterministic replay order, but require permutation invariance for evidence batches where chronology has no substantive meaning.

- **Central controller versus client-owned distributed state.** `4feeb0ca3d30` advocates one authority boundary; `c0365b8e4e52` advocates client-side replicated state. A logical single-writer authority contract need not imply one physical host. Replication should merge signed exact events, not authoritative summaries.

- **Narrative continuity versus legitimate revision.** `a679db358082` and `d7a30d8ad4d2` privilege stable narrative coherence; `5c2aeef6919d` and `10828be135bf` show why rejected beliefs and semantic reversals must remain recoverable. Narrative coherence may detect drift, but it cannot veto evidence-backed correction.

- **Model-free versus model-assisted consolidation.** `4feeb0ca3d30` prohibits models in consolidation; `119ef7c68fae` and `08e376be5ed2` rely on models to distill memory. Permit models to propose source-linked candidates in a capability-bounded worker; reserve admission, supersession, and deletion for deterministic policy plus required approval.

- **Reliability scores versus epistemic warrant.** `5c2aeef6919d` uses source credibility, `0d6fc0e76e0f` uses relationship degree, `52d958293653` uses model probability, and `7263be9774fb` uses retrieval/NLI stability. Treat all as versioned features or veto signals. None may substitute for independent source evidence or verified entailment.

## Routing suggestions

| Insight | Route | Rationale |
|---|---|---|
| Split exact episodic authority from its semantic session cache | `extend <standards/memory-architecture/01-memory-layer-taxonomy.md>` | Resolves the current ambiguity around pruning, compression, promotion, and No-Escape authority. |
| Prove that evidence-scoped competing assertions coexist while supersession closes only one lineage | `attach-to <goals/epistemic-bitemporal-edge-core>` | Clarifies the existing identity-partition acceptance criterion without adding contradiction triage. |
| Add version-bound READ/USE/VERIFY telemetry and zombie/supersedence measures | `attach-to <explorations/agent-memory-tiers-bitemporal-edges>` | The graduated exploration owns memory-tier follow-ons; these metrics should remain projections, not widen the core goal. |
| Shape retained-background/preferred-view revision, conflict sets, and rescue events | `new-exploration <epistemic-belief-view-revision>` | Contradiction triage and belief selection are explicit non-goals of the current bitemporal core. |
| Separate legal enforceability, efficacy, and applicability from generic valid/known time | `new-exploration <legal-multitemporal-validity>` | Preserves the core goal’s scope while giving the June-29 legal-time model an explicit downstream home. |
| Build reasoner-aware ontology release regression and rename handling | `new-exploration <ontology-version-regression-audit>` | Semantic foundation intentionally avoids a reasoning runtime; the CI contract needs independent shaping. |
| Add exact-version retrieval diagnostics, missingness fixtures, and candidate-to-span resolution | `attach-to <goals/hybrid-retrieval-fusion-core>` | Extends its existing contribution diagnostics and span-preservation proof without granting retrieval authority. |
| Batch verification by document/entity context and refresh audit samples | `attach-to <goals/citation-verified-span-substrate>` | Its exact anchors and retained attempts provide the evidence units required for cost-aware auditing. |
| Quarantine durable writes behind versioned fail-closed policy | `new-exploration <memory-write-governor>` | The control policy crosses memory, retrieval, evidence, and approval boundaries and deserves a separate contract. |
| Make per-agent prompt context visible and auditable | `new-exploration <inspectable-agent-context>` | The UX requires explicit inclusion, sharing, summary lineage, revocation, and canonical-history boundaries. |

## Quality notes

The cluster contains 5 gold, 12 silver, 6 bronze, and 2 dross papers. Its strongest evidence is narrow: formal change semantics in `d9e73d47d4a2` (Formal Foundations for RDF/S KB Evolution), longitudinal ontology history in `10828be135bf` (Finding fault), survey-sampling theory and experiments in `2b2bc2e2a40e` (Efficient Knowledge Graph Accuracy Evaluation), and broad architecture synthesis in `2ebef49a0b91` (Construction of Knowledge Graphs). None validates a complete legal bitemporal agent-memory system.

The narrative-memory and synthetic-identity papers under-delivered most sharply. `14bfb3924ec7` lacks a coherent carrier for cross-session state; `b9c4699452fe` reports unauditable large longitudinal gains; `c0365b8e4e52` supplies no evidence for its compression claims; `a679db358082` and `d7a30d8ad4d2` leave their key metrics undefined; and `e7d800d250b1` is proprietary and anecdotal. `4feeb0ca3d30`, `08e376be5ed2`, and `7263be9774fb` provide useful architecture but no reproducible causal evidence. `fc16fbd18148` is unusually precise yet unevaluated, and its reference verifier conflicts with some stated complexity and boundary semantics. `0d6fc0e76e0f` should be treated mainly as a warning against confusing digests or degree with truth.

Weak-evidence areas remain concurrency under late events, mixed insertion/deletion/correction workloads, privacy-preserving deletion, access control, adversarial poisoning, source dependence, calibration, legal valid-time semantics, and attorney-workflow outcomes. The synthesis inherits the expert notes’ evidence assessments; it does not independently re-open the 25 source papers.

## Papers in this cluster

- fc16fbd18148 — MemoryFlow: Real-Time, Implementation-Agnostic Telemetry for Measuring Dynamic Memory — silver
- 7263be9774fb — Triadic Memory Governors for Deterministic LLM Agents — silver
- 2ebef49a0b91 — Construction of Knowledge Graphs: State and Challenges — gold
- 4feeb0ca3d30 — Authority-Aware Memory Partitioning with Asynchronous Dream-State Consolidation — silver
- c0365b8e4e52 — Remember Me AI: The Client-Side Narrative Protocol (CSNP) — bronze
- 5c2aeef6919d — Ontology Revision as Non-Prioritized Belief Revision — gold
- d9e73d47d4a2 — Formal Foundations for RDF/S KB Evolution — gold
- 8567b5e65460 — How U4 and U8 Solve AI Memory Handling — bronze
- 119ef7c68fae — The Bicameral Linux: Recursive Context Injection and Asynchronous “Dreaming” — bronze
- d7a30d8ad4d2 — Review of “Cross-Session Narrative Memory (CSNM): A Minimal — bronze
- a679db358082 — Cross-Session Narrative Memory (CSNM): Ethical Invariants and Privacy-by-Design — bronze
- 0e1b8c67380f — Modified Sparse Distributed Memory as Transient Episodic Memory — silver
- 0d6fc0e76e0f — Knowledge graph augmentation: consistency, immutability, reliability, and context — bronze
- 5509c8933f8d — MemEvolve: The Meta-Evolutionary Horizon of Agentic Memory Systems — silver
- e7d800d250b1 — NexxusOS A Cognitive Operating System for Persistent Synthetic Identity — silver
- 52d958293653 — Text-based Reasoning with Symbolic Memory Model — silver
- 14bfb3924ec7 — Title not present in the supplied text — dross
- 10828be135bf — Finding fault: Detecting issues in a versioned ontology — gold
- b9c4699452fe — Memory Architectures in Long-Term AI Agents: Beyond Simple — dross
- 08e376be5ed2 — Mind-Tool: Domain Memory Architecture for AI Agents — silver
- 1f883c9bfd38 — Memory Sandbox: Transparent and Interactive Memory Management for — silver
- ca5205ebbea7 — Corporate Memory Management through Agents: The CoMMA project — silver
- 2b2bc2e2a40e — Efficient Knowledge Graph Accuracy Evaluation — gold
- 8fb75bf2f8c9 — LTMC — An Improved Long-Term Memory for Cognitive Architectures — silver
- ad0622e993ee — Reasoning About Reasoning in a Meta-Level Architecture — silver

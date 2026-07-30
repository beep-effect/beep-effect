# Cluster synthesis — Norms, deontic logic, legal reasoning & argumentation

- **Date:** 2026-07-25  **Synthesist:** codex gpt-5.6-sol (max)
- **Cluster:** legal-norms-reasoning — 24 papers (ids listed at the end)
- **Feeds:** `goals/semantic-foundation`; `docs/product/prose-to-proof.md`; memory/bitemporal doctrine; citation extraction, verification, and retrieval; professional-desktop agent governance

## Verdict paragraph

The cluster’s central result is that the layer after SKOS is not “more ontology,” but qualified legal argumentation. Exact documents, institutional decisions, and approval events remain authoritative records; case descriptions, factors, rules, interpretations, attacks, defeats, validity assessments, and accepted conclusions are rebuildable projections scoped to theory, audience, proof standard, procedure, jurisdiction, and time. This follows most directly from 727fe68fabe6 — *A Model of Legal Reasoning with Cases Incorporating*, f4ab0f7d6892 — *Persuasion and Value in Legal Argument*, 703aea161905 — *Argumentation and Standards of Proof*, 73abf21862dc — *The adaptive nature of text-driven law*, and b61240c6a85e — *An Architecture for Establishing Legal Semantic Workflows in*. The current `goals/semantic-foundation` M1 is therefore right to remain a narrow vocabulary and registry milestone. Conversely, `docs/product/prose-to-proof.md` is too strong when it says attorney approval makes a candidate a “fact”: approval can authorize use and record scoped closure, but it cannot turn a semantic interpretation into source truth. Grounding and approval remain necessary; neither is sufficient for legal correctness.

## Design challenges

1. **Attorney approval and deterministic grounding do not create legal truth.**

   **Papers.** 703aea161905 — *Argumentation and Standards of Proof*; 73abf21862dc — *The adaptive nature of text-driven law*; 51a651fb218c — *Semantic Web Regulatory Models: Why Ethics Matter*; b61240c6a85e — *An Architecture for Establishing Legal Semantic Workflows in*; f4ab0f7d6892 — *Persuasion and Value in Legal Argument*.

   **Evidence strength.** High architectural convergence across formal, jurisprudential, and partially implemented work; weak production validation.

   **Re-examine.** The literal Prose-to-Proof claims that “nothing becomes a fact until I sign” and that claim-plus-evidence-plus-lifecycle is authority. If “authority” means the exact record of what the practice approved, the architecture is defensible. If it means that the approved proposition is legally true, the cluster rejects it. The approval event, source item, and institutional decision can be authoritative records; the approved proposition remains a sourced, contestable interpretation. This also contradicts the June-29 synthesis’s claim that ClaimGate admission by itself makes a qualification obtain as an institutional fact.

2. **A precedent cannot safely have one canonical description, factor set, ratio, or rule.**

   **Papers.** 727fe68fabe6 — *A Model of Legal Reasoning with Cases Incorporating*; 99bbae2d4edf — *Using Argument Schemes for Hypothetical Reasoning in Law*; 1b74b7bb166f — *Legal case-based reasoning as practical reasoning*; bd232c4bdaba — *Arguing About Cases as Practical Reasoning*; a32b2b3bfed9 — *AI and Law: A fruitful synergy*.

   **Evidence strength.** Strong formal and worked-case convergence, but no substantial corpus evaluation or annotation-reliability evidence.

   **Re-examine.** Any future `Case → canonicalFactors`, `Case → canonicalRatio`, or extracted-rule design. A case document should remain stable while multiple provenance-bearing `CaseDescription`, `DimensionPosition`, `Factor`, `Rule`, `Preference`, and `Theory` records compete. Majority, concurrence, dissent, later treatment, analyst reconstruction, and changed social context must not overwrite one another.

3. **A taxonomy or entity–relation ontology is not a legal reasoning or validity engine.**

   **Papers.** 99bbae2d4edf — *Using Argument Schemes for Hypothetical Reasoning in Law*; 51a651fb218c — *Semantic Web Regulatory Models: Why Ethics Matter*; a32b2b3bfed9 — *AI and Law: A fruitful synergy*; acc7d5472704 — *Introducing the Logic and Law Corner*; 93289ccbf666 — *The Future of Law: Relational Justice, Web Services*; d0ac8b86974d — *Ontologies, ICTs and Law The International Ontojuris Project*.

   **Evidence strength.** Broad expert and system-design agreement; little empirical evidence about which layered design performs best.

   **Re-examine.** The June-29 synthesis’s elevation of relators as the single dominant idea. Relators remain valuable for legal positions, but they cannot express competing interpretations, defeaters, proof burdens, procedural effects, or audience-relative acceptance. This is not a defect in the current M1 SPEC, which expressly limits itself to vocabulary and registry capabilities. It is a boundary to preserve: an M1 classification result must never be consumed as legality, validity, or adjudicated truth.

4. **A verified span proves what a source says, not whether the proposition is established or which legal interpretation should prevail.**

   **Papers.** 703aea161905 — *Argumentation and Standards of Proof*; f4ab0f7d6892 — *Persuasion and Value in Legal Argument*; 73abf21862dc — *The adaptive nature of text-driven law*; a32b2b3bfed9 — *AI and Law: A fruitful synergy*; 90c15fe84620 — *Persuasion in Practical Argument Using Value-based Argumentation Frameworks*.

   **Evidence strength.** High conceptual and formal support; no end-to-end citation-grounding benchmark.

   **Re-examine.** Prose-to-Proof’s “every-assertion-grounded” language and the June-29 lifecycle-to-proof analogy. Grounding is a hard traceability guarantee, not a correctness guarantee. Shape validity, extraction confidence, retrieval relevance, source credibility, proof standard, and value-based legal choice require distinct fields and failure states. The four-state claim lifecycle is a workflow and may resemble a burden ladder, but it is not itself a legal proof standard.

5. **Global source scores and flat authority labels are too coarse for evidentiary conflict.**

   **Papers.** 703aea161905 — *Argumentation and Standards of Proof*; acc7d5472704 — *Introducing the Logic and Law Corner*; 7d7f8ed65c53 — *Computable Models of the Law: Languages, Dialogues, Games, Ontologies*; c8b554d0d336 — *Argument Based Machine Learning Applied to Law*.

   **Evidence strength.** Moderate: a strong conceptual objection plus one synthetic learning experiment.

   **Re-examine.** The June-29 `binding | persuasive | informational` source-authority field as a decision input. Authority rank remains useful metadata, but credibility must be assessed for a particular claim, conflict, procedural stage, and proof standard. A source can be reliable about one proposition and unreliable about another. Retrieval or model confidence must never be converted into proof status.

6. **Stable IRIs and matching labels cannot freeze meaning or establish legal equivalence.**

   **Papers.** e4c1e92b3477 — *A Linked Term Bank of Copyright-Related Terms*; d0ac8b86974d — *Ontologies, ICTs and Law The International Ontojuris Project*; 73abf21862dc — *The adaptive nature of text-driven law*; a32b2b3bfed9 — *AI and Law: A fruitful synergy*; 93289ccbf666 — *The Future of Law: Relational Justice, Web Services*.

   **Evidence strength.** Moderate-to-high architectural convergence, including one concrete reversed-SKOS-hierarchy defect; no mapping-accuracy benchmark.

   **Re-examine.** `skos:exactMatch`, identity folding, and classification ingestion. The current semantic-foundation requirement that alignments be vetted is corroborated, but “vetted” needs evidence, jurisdiction, governing instrument, version, reviewer, and mapping type. Matching labels or translations must not imply identity. Stable concept identity should coexist with versioned, community- and authority-scoped interpretations.

7. **`attacks`, `defeats`, and `accepted` cannot be flattened into timeless graph edges or flags.**

   **Papers.** f4ab0f7d6892 — *Persuasion and Value in Legal Argument*; 90c15fe84620 — *Persuasion in Practical Argument Using Value-based Argumentation Frameworks*; 2b8318922f83 — *Try to see it my way: Modelling persuasion*; 9208d0f244bc — *Agreeing to Differ: Modelling Persuasive Dialogue Between Parties*.

   **Evidence strength.** Strong formal support within restricted value-based argumentation frameworks; no corpus validation, and several assumptions are unsafe for production.

   **Re-examine.** Any future argument graph that stores one accepted/rejected state or rewrites an attack into a defeat. `attacks` should remain structural, while `defeats` and acceptance are derived for an explicit fact set, audience, value ordering, evaluation semantics, and time. The papers’ one-value-per-argument and effectively total-order assumptions should not become ontology invariants.

8. **Mechanical success and aggregate accuracy can hide legally material omissions.**

   **Papers.** c8b554d0d336 — *Argument Based Machine Learning Applied to Law*; 93289ccbf666 — *The Future of Law: Relational Justice, Web Services*; d0ac8b86974d — *Ontologies, ICTs and Law The International Ontojuris Project*; e4c1e92b3477 — *A Linked Term Bank of Copyright-Related Terms*; b61240c6a85e — *An Architecture for Establishing Legal Semantic Workflows in*.

   **Evidence strength.** One useful synthetic experiment plus several unevaluated systems and architectural cautions.

   **Re-examine.** Treat the semantic-foundation M1 sample-classification exit criterion as proof of plumbing only, not semantic usefulness. A later evaluation gate should measure condition-level recall, rare-condition failures, false equivalence, hierarchy errors, reviewer comprehension, review burden, and ontology drift. This does not justify widening M1 now.

9. **No-Escape should not be misread as banning derived nodes from reasoning chains or treating statutory text as the whole of law.**

   **Papers.** bd232c4bdaba — *Arguing About Cases as Practical Reasoning*; 1b74b7bb166f — *Legal case-based reasoning as practical reasoning*; 73abf21862dc — *The adaptive nature of text-driven law*; 7d7f8ed65c53 — *Computable Models of the Law: Languages, Dialogues, Games, Ontologies*.

   **Evidence strength.** Strong worked-case support for layered dependencies and strong jurisprudential argument, but no implemented replay architecture.

   **Re-examine.** This is a clarification, not a contradiction of `00-no-escape-theorem.md`: its C3 forbids semantic retrieval as source truth but does not forbid recomputable semantic intermediates. World facts may support intermediate legal-concept attributions, which may support consequences, provided every chain bottoms out in immutable source or institutional-event records and can be replayed. Exact records must include opinions, amendments, decisions, and closure events—not statutory text alone.

## Direct patterns

1. **Qualified value-based argument graph.** Store stable `Argument`, `Attack`, `ValueEffect`, `DecisionContext`, `ValuePreference`, and evaluation records; derive `Defeat` and extensions for a named context. Sources: f4ab0f7d6892 — *Persuasion and Value in Legal Argument*; 90c15fe84620 — *Persuasion in Practical Argument Using Value-based Argumentation Frameworks*; 2b8318922f83 — *Try to see it my way: Modelling persuasion*; 9208d0f244bc — *Agreeing to Differ: Modelling Persuasive Dialogue Between Parties*. **Target:** future legal-argumentation substrate and attorney control plane. **First step:** prototype a minimal evaluator profile supporting many-to-many value effects, incomparability, and multiple extensions; persist attacks, never cached defeats as authority.

2. **Theory-scoped precedent representation.** Separate `CaseSource`, `CaseDescription`, `Dimension`, `DimensionPosition`, `Factor`, `DefeasibleRule`, `RulePreference`, `ValuePreference`, `Theory`, and provenance-bearing theory-construction moves. Sources: 727fe68fabe6 — *A Model of Legal Reasoning with Cases Incorporating*; 99bbae2d4edf — *Using Argument Schemes for Hypothetical Reasoning in Law*; 1b74b7bb166f — *Legal case-based reasoning as practical reasoning*; bd232c4bdaba — *Arguing About Cases as Practical Reasoning*. **Target:** citation extraction and hybrid precedent retrieval. **First step:** hand-encode one small repository-safe precedent fixture with two competing theories, explicit thresholds, and span-bound construction moves before designing automatic extraction.

3. **Object/meta-level proof evaluation.** Keep factual assertions and object-level arguments separate from meta-arguments about source credibility, proof standard, authority, purpose, and value ordering. Sources: 703aea161905 — *Argumentation and Standards of Proof*; acc7d5472704 — *Introducing the Logic and Law Corner*; 99bbae2d4edf — *Using Argument Schemes for Hypothetical Reasoning in Law*. **Target:** epistemic-bitemporal evaluation and Prose-to-Proof review. **First step:** define an `EvaluationContext` containing selected fact set, proof standard, source assessments, value ordering, procedural stage, jurisdiction, and evaluator; expose separate attorney-review lanes for factual and normative choices.

4. **Argument-scheme review packets.** Represent practical arguments as circumstances → action → predicted state → goal → value, enriched with Toulmin data, warrant, backing, qualifier, and rebuttal roles. Turn critical questions into typed missing-support or challenge slots. Sources: f4ab0f7d6892 — *Persuasion and Value in Legal Argument*; 1b74b7bb166f — *Legal case-based reasoning as practical reasoning*; bd232c4bdaba — *Arguing About Cases as Practical Reasoning*; 99bbae2d4edf — *Using Argument Schemes for Hypothetical Reasoning in Law*; ee6c09b92c53 — *AI and Legal Argumentation: Aligning the Autonomous Levels*. **Target:** citation extraction and document-portal review. **First step:** bind every instantiated slot and attack to its own verified span; leave unsupported slots open rather than synthesizing completion.

5. **Dialogue protocol as an executable transition system.** Specify each performative with preconditions, immediate effects, outstanding completion conditions, and legal successor states; keep move legality, move strategy, and attorney authorization separate. Sources: c610011eac4e — *A method for the computational modelling of dialectical argument*; 9208d0f244bc — *Agreeing to Differ: Modelling Persuasive Dialogue Between Parties*; ee6c09b92c53 — *AI and Legal Argumentation: Aligning the Autonomous Levels*. **Target:** `goals/agentic-professional-runtime`. **First step:** model performatives as a tagged union with a total reducer and durable obligation IDs, then property-test control, balanced focus stacks, reachable completion, and legal termination.

6. **Dual legal-citation identity.** Preserve both the semantic target—legal work or expression—and the evidentiary target—immutable item or manifestation, content hash, version, and exact span. Type the citation relation and retain original citation text, resolution provenance, and unresolved status. Sources: 7d7f8ed65c53 — *Computable Models of the Law: Languages, Dialogues, Games, Ontologies*; a32b2b3bfed9 — *AI and Law: A fruitful synergy*; e4c1e92b3477 — *A Linked Term Bank of Copyright-Related Terms*. **Target:** citation-verified-span and identity streams. **First step:** require both fields in the citation envelope rather than overloading one URI.

7. **Contextual validity and interpretive closure events.** Separate `LegalText`, `LegalNorm`, `Interpretation`, `InstitutionalDecision`, `LegalEffect`, and `EnforcementConstraint`. Record a closure event with decision-maker, reasons, sources, jurisdiction, procedure, valid time, and knowledge time; permit later reopening without erasure. Sources: 51a651fb218c — *Semantic Web Regulatory Models: Why Ethics Matter*; 73abf21862dc — *The adaptive nature of text-driven law*; b61240c6a85e — *An Architecture for Establishing Legal Semantic Workflows in*; 488846748fcd — *A European Framework for Regulating Data and Metadata Markets*. **Target:** epistemic-bitemporal edges and Prose-to-Proof approval. **First step:** introduce a conceptual `InterpretiveClosure` contract before changing claim lifecycle states; do not use the papers’ unvalidated aggregate validity scores.

8. **Typed concept-mapping and hierarchy validation.** Separate legal concepts from language-specific lexical entries and qualify mappings as exact, close, broader, narrower, related, disputed, or unresolved. Sources: e4c1e92b3477 — *A Linked Term Bank of Copyright-Related Terms*; d0ac8b86974d — *Ontologies, ICTs and Law The International Ontojuris Project*; 93289ccbf666 — *The Future of Law: Relational Justice, Web Services*. **Target:** semantic foundation and IRI folding. **First step:** add loader tests that require mapping evidence and enforce `specific skos:broader general`; reject the reversed hierarchy found in the term-bank example.

9. **Problematic-case attorney queue.** Repeatedly identify the case most often misclassified or badly grounded, solicit its case-specific reasons, retrain or revise, and preserve the resulting rule delta. Source: c8b554d0d336 — *Argument Based Machine Learning Applied to Law*. **Target:** Prose-to-Proof dogfooding and extraction refinement. **First step:** rank recurring rejection, grounding, and missing-condition failures across fixture replays; treat attorney reasons as defeasible, versioned assertions rather than timeless constraints.

## Corroborations

- The No-Escape authoritative-record boundary is independently reinforced: semantic theories and confirmed knowledge graphs remain rebuildable interpretations, even when accurate or human-reviewed. See 727fe68fabe6 — *A Model of Legal Reasoning with Cases Incorporating*; b61240c6a85e — *An Architecture for Establishing Legal Semantic Workflows in*; c8b554d0d336 — *Argument Based Machine Learning Applied to Law*.

- The semantic-foundation M1 posture—repo-owned concept identities, vetted external mappings, reuse-first multi-ontology design, and no graph-store authority—is supported by e4c1e92b3477 — *A Linked Term Bank of Copyright-Related Terms*; d0ac8b86974d — *Ontologies, ICTs and Law The International Ontojuris Project*; 93289ccbf666 — *The Future of Law: Relational Justice, Web Services*.

- Prose-to-Proof’s candidate-only writes, stable source spans, rebuildable projections, and explicit attorney review are strongly supported. The correction is semantic: approval authorizes practice use and closure rather than manufacturing truth. See a32b2b3bfed9 — *AI and Law: A fruitful synergy*; 99bbae2d4edf — *Using Argument Schemes for Hypothetical Reasoning in Law*; c610011eac4e — *A method for the computational modelling of dialectical argument*.

- Append-only temporal provenance is repeatedly supported for norms, interpretations, preferences, dialogue commitments, and institutional decisions. See 7d7f8ed65c53 — *Computable Models of the Law: Languages, Dialogues, Games, Ontologies*; acc7d5472704 — *Introducing the Logic and Law Corner*; 73abf21862dc — *The adaptive nature of text-driven law*.

- Hybrid retrieval remains the right posture: lexical, concept, factor, argument-role, and dense channels have complementary errors, while every returned claim still requires exact verification. See a32b2b3bfed9 — *AI and Law: A fruitful synergy*; 93289ccbf666 — *The Future of Law: Relational Justice, Web Services*; d0ac8b86974d — *Ontologies, ICTs and Law The International Ontojuris Project*.

## Delta vs the June-29 prior synthesis

**Genuinely new here**

- The June-29 synthesis mentioned Toulmin, AIF, Carneades, proof standards, and evidence polarity, but did not supply the cluster’s central separation among structural attack, audience-relative defeat, and context-indexed acceptance. The four value-based argumentation papers make this operational.

- Precedent is no longer merely a source of defeasible rules or factors. 727fe68fabe6 — *A Model of Legal Reasoning with Cases Incorporating* adds theory membership, dimensional thresholds, explicit theory-construction operators, preference provenance, and comparative theory evaluation.

- 703aea161905 — *Argumentation and Standards of Proof* adds an object/meta-level split and claim-specific source evaluation. This is materially richer than the prior synthesis’s flat confidence, source-authority, and lifecycle analogy.

- c610011eac4e — *A method for the computational modelling of dialectical argument* contributes executable speech-act contracts, outstanding completion obligations, trace-checkable conversation classes, and a clean protocol/strategy separation.

- 73abf21862dc — *The adaptive nature of text-driven law* adds interpretive closure as a scoped, authorized, contestable event and separates legal obligation from technological prevention.

- 7d7f8ed65c53 — *Computable Models of the Law: Languages, Dialogues, Games, Ontologies* sharpens source identity: a semantic citation target at work/expression level must be paired with an immutable item or manifestation for reproducible proof.

- c8b554d0d336 — *Argument Based Machine Learning Applied to Law* contributes a concrete error-driven attorney-review loop and empirical warning that approximately 99% accuracy can coexist with omitted governing conditions.

- The cluster clarifies No-Escape: derived semantic nodes may be intermediate reasoning dependencies when they are recomputable and every path terminates in exact records. The theorem forbids terminal semantic authority, not layered derivation.

**Re-confirmed**

- Open-textured legal concepts must not be frozen into necessary-and-sufficient static types.

- Defeasible reasoning belongs outside the static taxonomy and validation layer.

- Term and concept identity must remain separate; jurisdiction, language, version, and provenance qualify mappings.

- Exact source spans, typed citations, append-only provenance, temporal validity, role/context qualification, and rebuildable graph projections remain load-bearing.

- Reuse-first, plural ontologies and hybrid lexical/semantic retrieval remain preferable to one monolithic legal ontology or one retrieval channel.

- Hohfeldian relators remain useful for positions between parties, but are now situated beneath a larger argument, procedure, and evaluation layer.

**Contradictions and corrections**

- The prior synthesis’s statement that an admitted ClaimGate qualification thereby becomes an institutional fact is contradicted by 51a651fb218c — *Semantic Web Regulatory Models: Why Ethics Matter*, 703aea161905 — *Argumentation and Standards of Proof*, and 73abf21862dc — *The adaptive nature of text-driven law*. A software validation gate can change repository workflow state; it does not acquire legal constitutive authority merely by analogy.

- Its claim that the four-state ClaimLifecycle is an exact burden-of-proof ladder is too strong. Procedural stage and proof standard can change independently, and evidentiary sufficiency requires meta-level assessment.

- Its flat `sourceAuthority` and verification-status proposal is necessary metadata but insufficient adjudication. Authority and credibility must be applied to a particular proposition, conflict, procedure, and time.

- Its “schema is the single source of truth for types, persistence, and ontology” is safe only for projection grammar and repo-owned vocabulary definitions. It must not imply that schema-derived legal assertions are authoritative facts.

- Its claim that identity lives on the Expression rather than the Work is too categorical. Work, expression, manifestation, and item require separate identities; semantic citation and reproducible evidence often target different levels.

- The packet’s existing snippet audit has already established that the prior synthesis’s claimed verification publication gate does not currently exist. The cluster supports building a stronger evidence-and-evaluation boundary, but does not re-confirm that prior current-state claim.

- There is no contradiction with the current `goals/semantic-foundation/SPEC.md`: its M1 taxonomy/registry scope is substantially narrower than the June-29 roadmap and should remain so.

## Tensions & contradictions

- **Value-based argumentation promises unique audience-relative extensions only under restrictive assumptions.** 90c15fe84620 — *Persuasion in Practical Argument Using Value-based Argumentation Frameworks*, 2b8318922f83 — *Try to see it my way: Modelling persuasion*, and 9208d0f244bc — *Agreeing to Differ: Modelling Persuasive Dialogue Between Parties* rely on sufficiently comparable value orders and exclusions on same-value cycles. Their own definitions leave room for incomparability. Adjudicate by implementing general multiple-extension semantics first; treat uniqueness as a validated evaluator profile, never a global invariant.

- **The VAF papers treat arguments, attacks, and values as given, while the proof-standard and case-theory papers identify their construction as the difficult legal work.** Run provenance and critical-question validation before extension evaluation; never let a mathematically valid evaluation launder unsupported inputs.

- **90c15fe84620 — *Persuasion in Practical Argument Using Value-based Argumentation Frameworks* makes fact universally top-ranked, whereas 703aea161905 — *Argumentation and Standards of Proof* requires claim-specific source and conflict assessment.** Prefer the latter. Evidence is not truth, and contradictory factual arguments cannot be resolved by assigning them one privileged value label.

- **Lightweight SKOS systems optimize interoperability and retrieval, while the reasoning papers require norms, arguments, procedure, and defeaters.** Do not choose one side. Use task-scoped layers: SKOS for identity and retrieval expansion; rule/argument modules for legal reasoning; exact documents beneath both.

- **Executable dialogue and rule systems conflict with papers denying that discretionary legality can be comprehensively hard-coded.** Compile determinate protocol mechanics, structural validation, and explicit policy constraints. Route legal interpretation, value selection, exceptions, and consequential closure through contestable attorney review.

- **The practical-reasoning papers derive legal consequences, while 73abf21862dc — *The adaptive nature of text-driven law* says legal effects are institutionally attributed rather than mechanically caused.** Treat a reasoner’s consequence as a prediction or justification claim. An authorized institutional act remains the event that changes legal position.

- **MetaLex-style citations favor work/expression targets, while Prose-to-Proof requires exact reproducibility.** Store both the semantic target and immutable item/span. Neither level substitutes for the other.

- **c8b554d0d336 — *Argument Based Machine Learning Applied to Law* treats expert reasons as clean constraints, while the rest of the cluster treats interpretations and preferences as defeasible and revisable.** Attorney annotations must therefore enter as provenance-bearing assertions subject to conflict, correction, and supersession.

## Routing suggestions

Suggestions only; no route is executed.

| insight | route | rationale |
|---|---|---|
| Approval records closure, not truth | extend `docs/product/prose-to-proof.md` | Replace “becomes a fact” with approved assertion or attorney closure; distinguish traceability, legal correctness, and authority of the approval record. |
| SKOS classification and mapping do not imply validity | attach-to `goals/semantic-foundation` | Preserve M1 scope while documenting the non-reasoning boundary and adding typed mapping/hierarchy invariants; do not add argument entities to M1. |
| Qualified arguments, theories, proof contexts, and audience-relative evaluation | new-exploration `legal-argumentation-substrate` | This is a cross-cutting capability beyond the current semantic-foundation goal and needs its own scope, evaluator profiles, corpus fixtures, and no-go boundaries. |
| Context-indexed acceptance, preferences, validity, and closure | attach-to `goals/epistemic-bitemporal-edge-core` | These are derived, versioned states requiring valid time, knowledge time, evaluator, procedure, and replay. |
| A span proves source content, not truth; citations need semantic and immutable targets | attach-to `goals/citation-verified-span-substrate` | Strengthen the evidence envelope without weakening the current exact-span requirement. |
| Argument schemes, Toulmin roles, critical questions, and actual-versus-hypothetical facts | attach-to `goals/citation-extraction-engine` | These provide typed extraction targets and explicit missing-support slots. |
| Supporting, contrary, distinguishing, and rule-attacking retrieval buckets | attach-to `goals/hybrid-retrieval-fusion-core` | Argument state can guide retrieval while relevance scores remain strictly separate from proof or acceptance. |
| Speech-act protocol, completion obligations, value declarations, and attorney closure | attach-to `goals/agentic-professional-runtime` | The control plane should separate legal moves, planner strategy, and authorization, with every commitment and retraction auditable. |
| No fold by translated label or unreviewed equivalence | attach-to `goals/identity-iri-fold` | Identity needs mapping type, jurisdiction, version, source, reviewer, and unresolved/disputed states. |
| Recurring-error attorney review queue | extend `docs/product/prose-to-proof.md` | Converts dogfooding rejection and grounding failures into targeted learning while measuring condition recall rather than aggregate approval rate alone. |

## Quality notes

- Tier distribution is 14 gold, 9 silver, and 1 bronze, but “gold” overwhelmingly means architectural relevance—not empirical validation.

- Apparent corroboration is inflated by related publication lineages. The four VAF papers reuse substantially the same formal core, and the two Pierson papers reuse the same hand-built reconstruction. They should not be counted as six independent validations.

- Most legal examples are manually encoded single cases. There are no attorney studies, inter-annotator results, substantial legal-corpus evaluations, production deployments, or USPTO-specific validation.

- The strongest quantitative claims are weakly reported. f4ab0f7d6892 — *Persuasion and Value in Legal Argument* cites accuracy above 90% without the necessary protocol; c8b554d0d336 — *Argument Based Machine Learning Applied to Law* uses one synthetic binary task and still misses parts of the generating rule.

- Several papers contain implementation-threatening defects: reversed SKOS hierarchy in e4c1e92b3477 — *A Linked Term Bank of Copyright-Related Terms*; malformed or inconsistent dialogue rules in c610011eac4e — *A method for the computational modelling of dialectical argument*; questionable theorem assumptions in 90c15fe84620 — *Persuasion in Practical Argument Using Value-based Argumentation Frameworks*; reversed acceptance implications in 703aea161905 — *Argumentation and Standards of Proof*; and internal argument-number inconsistencies in bd232c4bdaba — *Arguing About Cases as Practical Reasoning*.

- 9487eb8db098 — *AI Approaches to the Complexity of Legal Systems* under-delivered most severely: the supplied text is a foreword and contents page, not a research paper. ee6c09b92c53 — *AI and Legal Argumentation: Aligning the Autonomous Levels* offers an unvalidated autonomy taxonomy. 93289ccbf666 — *The Future of Law: Relational Justice, Web Services*, 51a651fb218c — *Semantic Web Regulatory Models: Why Ethics Matter*, and 488846748fcd — *A European Framework for Regulating Data and Metadata Markets* are broad position papers. Their principles are useful requirements, not demonstrated outcomes.

- 16bb2faf6705 — *GenAI as Fictional Author: Statutory Attribution of Copyright* proposes law rather than reporting enacted doctrine. Its role decomposition is portable; its developer/deployer attribution rule must not enter the ontology as current law.

- 7d7f8ed65c53 — *Computable Models of the Law: Languages, Dialogues, Games, Ontologies* is a truncated edited volume. Only the visible MetaLex, LKIF, DALOS, and MetaVex material supports this report.

## Papers in this cluster

727fe68fabe6 — A Model of Legal Reasoning with Cases Incorporating — gold

99bbae2d4edf — Using Argument Schemes for Hypothetical Reasoning in Law — gold

e4c1e92b3477 — A Linked Term Bank of Copyright-Related Terms — silver

9487eb8db098 — AI Approaches to the Complexity of Legal Systems — bronze

51a651fb218c — Semantic Web Regulatory Models: Why Ethics Matter — silver

f4ab0f7d6892 — Persuasion and Value in Legal Argument — gold

a32b2b3bfed9 — AI and Law: A fruitful synergy — gold

16bb2faf6705 — GenAI as Fictional Author: Statutory Attribution of Copyright — silver

90c15fe84620 — Persuasion in Practical Argument Using Value-based Argumentation Frameworks — gold

93289ccbf666 — The Future of Law: Relational Justice, Web Services — silver

2b8318922f83 — Try to see it my way: Modelling persuasion — gold

c610011eac4e — A method for the computational modelling of dialectical argument — gold

703aea161905 — Argumentation and Standards of Proof — gold

1b74b7bb166f — Legal case-based reasoning as practical reasoning — gold

bd232c4bdaba — Arguing About Cases as Practical Reasoning — gold

73abf21862dc — The adaptive nature of text-driven law — gold

9208d0f244bc — Agreeing to Differ: Modelling Persuasive Dialogue Between Parties — gold

c8b554d0d336 — Argument Based Machine Learning Applied to Law — silver

acc7d5472704 — Introducing the Logic and Law Corner — silver

7d7f8ed65c53 — Computable Models of the Law: Languages, Dialogues, Games, Ontologies — gold

b61240c6a85e — An Architecture for Establishing Legal Semantic Workflows in — gold

d0ac8b86974d — Ontologies, ICTs and Law The International Ontojuris Project — silver

ee6c09b92c53 — AI and Legal Argumentation: Aligning the Autonomous Levels — silver

488846748fcd — A European Framework for Regulating Data and Metadata Markets — silver

# Cluster synthesis — Legal ontology design, engineering & methodology

- **Date:** 2026-07-25  **Synthesist:** codex gpt-5.6-sol (max)
- **Cluster:** legal-ontology-design — 39 papers (ids listed at the end)
- **Feeds:** `goals/semantic-foundation`, `goals/identity-iri-fold`, `explorations/legal-ontology-landscape`, and the cross-cutting memory/bitemporal, citation-grounding, retrieval, and attorney-governance streams

## Verdict paragraph

The cluster supports the current bounded direction: `semantic-foundation` M1 should remain a repo-owned SKOS registry/loader with vetted external alignments, while `identity-iri-fold` remains deterministic tuple assembly and pure projection—not a legal-meaning engine. The broader evidence rejects a universal legal ontology in favor of purpose-scoped modules that separate exact records, textual expressions, interpretations, domain concepts, reasoning roles, procedures, and application instances. Stable IRIs identify things or records; they do not establish timeless meaning, legal equivalence, or source existence. Before adding a rich legal core, the repo needs explicit mapping provenance, executable competency questions, open-world versus closed-world validation boundaries, version-aware ontology QA, and attorney-reviewed mutation workflows. Nothing in this cluster justifies weakening the No-Escape rule: ontology assertions, entailments, alignments, rankings, and repairs remain rebuildable semantic products; authoritative source records and separately recorded adopted interpretations remain load-bearing.

## Design challenges

1. **Exact source text is necessary but may not fully record an adopted legal interpretation; nevertheless, an ontology cannot become authority.** `36d82e899e75 — Cross: An OWL Wrapper for Reasoning on Relational` gives the strongest boundary evidence: an open-world model can satisfy a reference with a model-only witness absent from the source database. `3c06bfc28d1d — Classifications and the Law: Doctrinal Classifications vs. Computational Ontologies`, `85175dde1716 — The winter, the summer and the summer dream`, and `a09528e40201 — Semantic Web for the Legal Domain: The next` argue that operative meaning also depends on interpretation and institutional context. **Strength:** strong within Cross’s formal model, with broader but conceptual legal support. **Re-examine:** define attorney-, agency-, or tribunal-adopted interpretations and policy acts as immutable exact records with their own provenance. Do not promote their semantic projections. The ontology-centered assessment postures in `5ab5eabd251e — An Ontological Approach to Legal Literature for Improving` and `ea07aefd3215 — Law and the Semantic Web, an Introduction` explicitly conflict with No-Escape C3 and the current graph-as-projection constraint if adopted literally; their unevaluated examples do not warrant that conflict.

2. **A stable IRI does not imply a stable, universal intension or an identity fold.** `3c06bfc28d1d — Classifications and the Law: Doctrinal Classifications vs. Computational Ontologies`, `e7bc107b3188 — Ontologies as a Set to Describe Legal Information`, `2a9360ee7197 — Relating Knowledge Graphs To Logic, Language, and the World`, `92e7a14f872b — Empirically-Grounded Development of Legal Ontologies: a Socio-Legal Perspective`, and `badd96c61d16 — Ontology Knowledge Map Approach Towards Building Linked Data` independently expose context-sensitive definitions, non-unique names, unexplained `sameAs`, and fuzzy-linking hazards. **Strength:** broad conceptual agreement plus concrete implementation failure modes; little controlled identity evaluation. **Re-examine:** treat `skos:exactMatch`, equivalence, redirects, and folds as scoped, provenance-bearing, reversible assertions. `identity-iri-fold` should prove syntactic resolution and deterministic projection, not infer semantic identity from labels, names, fuzzy scores, or shared vocabulary membership.

3. **Relation-centered modeling is useful, but the evidence does not support making it the universal center of legal semantics.** `04cbf7a69b5e — UFO-L: A Core Ontology of Legal Concepts Built` proposes legal relations as relators but reports no completed experiment. `49d66c8b64a7 — A Systematic Mapping of the Literature on Legal` warns that Hohfeldian and positivist models omit social reality; `34c674278903 — The Ontology of Legal Possibilities and Legal Potentialities` requires distinct rule, fact, and reason roles; `92e7a14f872b — Empirically-Grounded Development of Legal Ontologies: a Socio-Legal Perspective` adds tacit professional practice; and `43f2c05c6d62 — A Comparison of Four Ontologies for the Design` finds procedures inadequately represented. **Strength:** one dated systematic mapping plus several coherent design arguments, but no comparison establishing a winning center. **Re-examine:** retain Hohfeldian relators as a legal-position module, not the whole foundation. Future coverage must separately test norms, principles, procedures, argumentation, institutional facts, professional practice, and social context.

4. **A noun-and-taxonomy core is insufficient for operational legal procedure.** `43f2c05c6d62 — A Comparison of Four Ontologies for the Design` reports that none of four compared ontologies adequately represented legal procedures. `a9d68b581a0f — Ontologies of Professional Legal Knowledge as the Basis`, `92e7a14f872b — Empirically-Grounded Development of Legal Ontologies: a Socio-Legal Perspective`, `091ad4e2ded0 — Ontological Semantics for Data Privacy Compliance: The NEURONA Project`, and `05e9b573b10a — Indexing as an Ontological Support for Legal Reasoning` add actors, process order, contextual practice, organizational controls, and fact-to-rule alignment. **Strength:** repeated qualitative and fieldwork support, but no reusable procedural formalism or USPTO validation. **Re-examine:** do not infer that M1’s SKOS seed can later grow directly into an operational legal model. Procedure needs a separately scoped module covering competence, preconditions, deadlines, transitions, exceptions, outputs, and review authority.

5. **“Core,” foundational grounding, and vocabulary overlap do not establish reusable semantics.** `49d66c8b64a7 — A Systematic Mapping of the Literature on Legal` found frequent core/domain conflation and weak legal-theory provenance. `bdd78bbe92b9 — The LKIF Core Ontology of Basic Legal Concepts` and `a18010b8a6f3 — LKIF Core : Principled Ontology Development for the Legal` report limited wholesale reuse of existing ontologies. `8ed689db829c — Ontologies in Legal Information Systems; The Need for` argues for competing purpose-specific modules, while `e6bc0ec90155 — Formalising Ontologies and Their Relations` makes the shared mapping an explicit construction rather than a label match. **Strength:** moderate systematic evidence and implementation experience; dated coverage and no outcome study showing that foundational grounding improves quality. **Re-examine:** require module-level scope, jurisprudential provenance, inference assumptions, expressivity, tractability, mapping loss, and competency evidence before any FOLIO or external alignment is promoted.

6. **Logical consistency, closed-shape validity, legal compatibility, and source existence are different verdicts.** `36d82e899e75 — Cross: An OWL Wrapper for Reasoning on Relational` formalizes the open-world record-existence gap. `ad20ba29c442 — A Constructive Framework for Legal Ontologies` and `f796c27e78a8 — Some ontological tools to support legal regulatory compliance,` distinguish logical inconsistency from legally resolved or unresolved conflict. `abb6c8c81403 — Describing Reasoning Results with RVO, the Reasoning Violations`, `3033635e217a — CQChecker: A Tool to Check Ontologies in OWL-DL`, and `82458716569c — VERSION ANALYSIS FOR FAULT DETECTION IN OWL ONTOLOGIES` show that reasoner health still does not establish desired semantics. **Strength:** strong boundary reasoning, supported by implemented diagnostic systems; legal correctness remains unevaluated. **Re-examine:** every validation result must name its regime and distinguish asserted, entailed, contradicted, unknown, closed-world-invalid, and legally unresolved outcomes. M4 SHACL checks must not be described as substantive legal proof.

7. **Richer axiomatization and globally preferred repair can become operationally unaffordable.** The two LKIF reports, `bdd78bbe92b9 — The LKIF Core Ontology of Basic Legal Concepts` and `a18010b8a6f3 — LKIF Core : Principled Ontology Development for the Legal`, report reasoner degradation from complex equivalent-class axioms and inverse properties. `5943ec738200 — Declarative Repairing Policies for Curated KBs` proves order/syntax advantages for global repair but retains exponential search. `2d415b5e3456 — Wheat and Chaff – Practically Feasible Interactive Ontology Revision` and `812503d8c2e2 — Reasoning-Supported Interactive Revision of Knowledge Bases` reduce review work on one nonlegal ontology while exposing significant reasoner cost. **Strength:** formal complexity results plus narrow implementation evidence; LKIF timings are unreported and dated. **Re-examine:** require an explicit reasoning profile, representative benchmark corpus, time/node/memory budgets, and separate completeness/optimality flags before inference or repair becomes operationally critical.

8. **Binary deontic classifications erase legally material silence, uncertainty, exception, principle, and partial outcome states.** The LKIF complete-partition model in `bdd78bbe92b9 — The LKIF Core Ontology of Basic Legal Concepts` and `a18010b8a6f3 — LKIF Core : Principled Ontology Development for the Legal` conflicts with the permission/silence distinctions in `8ed689db829c — Ontologies in Legal Information Systems; The Need for`. `34c674278903 — The Ontology of Legal Possibilities and Legal Potentialities` makes uncertainty and burden-of-proof effects first-class; `04cbf7a69b5e — UFO-L: A Core Ontology of Legal Concepts Built` distinguishes binary rules from degree-fulfilled principles; `aa2e7d330d7f — Simulando Indenização em Ações Civis por meio de` excludes partial judgments and settlements. **Strength:** strong jurisprudential argument but little difficult-case evaluation. **Re-examine:** future legal-domain schemas must preserve permission, prohibition, obligation, silence, contradiction, uncertainty, defeasibility, and abstention separately. This does not challenge M1’s closed administrative document-class vocabulary.

## Direct patterns

- **Purpose- and commitment-bearing module manifests.** Represent each ontology module with layer, purpose, supported tasks, jurisdiction, authority basis, logic, inference regime, open/closed-world assumptions, negation policy, version, and applicability limits. Sources: `49d66c8b64a7 — A Systematic Mapping of the Literature on Legal`, `43f2c05c6d62 — A Comparison of Four Ontologies for the Design`, `8ed689db829c — Ontologies in Legal Information Systems; The Need for`, and `6f837875afbc — Ontologies and Legal Knowledge-Based Systems Development`. **Target:** `goals/semantic-foundation` and `explorations/legal-ontology-landscape`. **First step:** turn the candidate-adoption matrix into executable manifest fixtures before adding further external vocabulary constants.

- **Explicit alignment as a shared model plus mappings.** `e6bc0ec90155 — Formalising Ontologies and Their Relations` models related ontologies through a deliberate shared ontology and two mappings; `2a9360ee7197 — Relating Knowledge Graphs To Logic, Language, and the World` adds source-logic and translation concerns; `5943ec738200 — Declarative Repairing Policies for Curated KBs` shows that identity replacement is a global delta, not a tuple-local edit. **Target:** `goals/identity-iri-fold`. **First step:** add negative competency fixtures proving that equal labels, shared suffixes, or one matching predicate do not authorize a fold; record semantic mappings outside the deterministic fold with lossiness, scope, evidence, and intentional non-equivalences.

- **Document–expression–interpretation–situation separation.** `ad20ba29c442 — A Constructive Framework for Legal Ontologies`, `f796c27e78a8 — Some ontological tools to support legal regulatory compliance,`, `a09528e40201 — Semantic Web for the Legal Domain: The next`, and `85175dde1716 — The winter, the summer and the summer dream` distinguish material documents, textual provisions, conceptual norms, interpretations, and factual situations. **Target:** future legal-core work plus citation-grounding streams. **First step:** write one office-action competency fixture in which one provision supports multiple interpretations, one interpretation draws on multiple spans, and the underlying matter can satisfy more than one description.

- **Description–Situation and physical-to-institutional qualification.** `ad20ba29c442 — A Constructive Framework for Legal Ontologies`, `f796c27e78a8 — Some ontological tools to support legal regulatory compliance,`, `43f2c05c6d62 — A Comparison of Four Ontologies for the Design`, `8ed689db829c — Ontologies in Legal Information Systems; The Need for`, and `014f57bd6d67 — ONTOLOGIES IN THE LEGAL DOMAIN` converge on preserving an observed event while separately asserting its legal qualification under a norm. **Target:** a future legal-domain module, not semantic-foundation M1. **First step:** model a source event, candidate institutional qualification, governing authority spans, jurisdiction, applicable interval, and reviewer decision as separate fixture records.

- **Executable competency questions with dual-regime diagnostics.** `3033635e217a — CQChecker: A Tool to Check Ontologies in OWL-DL` supplies query/expected-answer records; `abb6c8c81403 — Describing Reasoning Results with RVO, the Reasoning Violations` supplies typed focal-resource and implicated-subgraph findings; `7c1bd43b5958 — A Quality Assurance Workflow for Ontologies based on` requires asserted and entailed views; `36d82e899e75 — Cross: An OWL Wrapper for Reasoning on Relational` supplies the closed-world boundary. **Target:** `goals/semantic-foundation`. **First step:** create a test matrix that records controlled-language question, resolved IRIs, formal query, expected regime, asserted/entailed status, exact input snapshot, and typed failure explanation.

- **Version-aware ontology regression as a derived projection.** `82458716569c — VERSION ANALYSIS FOR FAULT DETECTION IN OWL ONTOLOGIES` derives regression, redundancy, refactoring, and thrashing warnings from released versions; `7c1bd43b5958 — A Quality Assurance Workflow for Ontologies based on` adds pattern drift over inferred closure. **Target:** semantic-foundation lifecycle QA and memory architecture. **First step:** retain two or more immutable seed releases, canonicalize axiom identities, materialize asserted and inferred states per release, and emit review warnings without writing them back as ontology truth.

- **Human-reviewed candidate revision and repair.** `2d415b5e3456 — Wheat and Chaff – Practically Feasible Interactive Ontology Revision`, `812503d8c2e2 — Reasoning-Supported Interactive Revision of Knowledge Bases`, `5943ec738200 — Declarative Repairing Policies for Curated KBs`, and `abb6c8c81403 — Describing Reasoning Results with RVO, the Reasoning Violations` support candidate/accepted/rejected/excluded states, consequence previews, typed findings, and policy-as-data. **Target:** attorney governance. **First step:** define immutable candidate and judgment events; derive closure and queue ranking by ontology snapshot and reasoner version; use risk-weighted ordering only to schedule review, never to confer authority.

- **Practice-grounded acquisition with authority strata kept separate.** `92e7a14f872b — Empirically-Grounded Development of Legal Ontologies: a Socio-Legal Perspective`, `a9d68b581a0f — Ontologies of Professional Legal Knowledge as the Basis`, `091ad4e2ded0 — Ontological Semantics for Data Privacy Compliance: The NEURONA Project`, and `3bed889dda6e — An Ontology for the Construction of Legal Decision` combine practitioner questions, source documents, competency questions, expert review, and formalization. **Target:** future USPTO procedure/practice modeling. **First step:** collect a bounded set of real practitioner questions and map each to formal authority spans, professional-practice assertions, intended answer, exceptions, and reviewer agreement without collapsing those evidence strata.

- **Extraction and corpus associations as review candidates, not ontology mutations.** `bbd2af54d814 — KnowGL: Knowledge Generation and Linking from Text`, `badd96c61d16 — Ontology Knowledge Map Approach Towards Building Linked Data`, `2d2219bdb167 — A Complex-System Approach: Legal Knowledge, Ontology, Information and`, and `e7bc107b3188 — Ontologies as a Set to Describe Legal Information` supply candidate triples, fuzzy links, corpus-scoped associations, and reviewed term contributions. **Target:** citation extraction and hybrid retrieval. **First step:** require each candidate to carry exact spans, document version, proposed IRIs, alternative matches, extraction/corpus snapshot, score semantics, and review state; no candidate score may imply identity or legal truth.

- **Premise-role typing and inference-policy checking.** `34c674278903 — The Ontology of Legal Possibilities and Legal Potentialities` separates authoritative rules, evidentiary instances, and abductive reasons and rejects unauthorized converse or contrapositive inference; `3bed889dda6e — An Ontology for the Construction of Legal Decision` supplies recursive Toulmin-style argument nodes. **Target:** epistemic/bitemporal and attorney-control streams. **First step:** add fixtures where the same proposition appears in different premise roles and where an attempted converse is rejected unless a separate authority or presumption is cited.

## Corroborations

- The current M1 boundary—repo-owned SKOS concepts, vetted external alignment metadata, no law-practice entities—is supported by the repeated core/domain/application separation in `49d66c8b64a7 — A Systematic Mapping of the Literature on Legal`, `8ed689db829c — Ontologies in Legal Information Systems; The Need for`, and `6f837875afbc — Ontologies and Legal Knowledge-Based Systems Development`.

- No-Escape’s authority boundary gains unusually concrete support from `36d82e899e75 — Cross: An OWL Wrapper for Reasoning on Relational`, while `82458716569c — VERSION ANALYSIS FOR FAULT DETECTION IN OWL ONTOLOGIES`, `7c1bd43b5958 — A Quality Assurance Workflow for Ontologies based on`, and `2d2219bdb167 — A Complex-System Approach: Legal Knowledge, Ontology, Information and` consistently treat entailments, histories, clusters, and associations as derived observations.

- The fold’s static-IRI and no-synonym-method posture is corroborated by `2a9360ee7197 — Relating Knowledge Graphs To Logic, Language, and the World`, `e7bc107b3188 — Ontologies as a Set to Describe Legal Information`, and `badd96c61d16 — Ontology Knowledge Map Approach Towards Building Linked Data`: labels and generated URI strings do not prove identity.

- Pure deterministic projection without a graph-store commitment remains well justified. The cluster supplies many RDF/OWL demonstrations but almost no controlled evidence that a graph store, SPARQL runtime, or full DL reasoner improves legal task outcomes; LKIF instead contributes a tractability warning.

- Schema-first typed errors and propose–gate–record behavior are independently supported by the typed diagnostics in `abb6c8c81403 — Describing Reasoning Results with RVO, the Reasoning Violations`, executable requirements in `3033635e217a — CQChecker: A Tool to Check Ontologies in OWL-DL`, and human-reviewed states in the two interactive-revision papers.

- M2–M4 gating is prudent. Most classification, compliance, reasoning, and retrieval claims in this cluster are prototypes, proposals, or toy demonstrations rather than evidence strong enough to pull richer reasoning or domain semantics into M1.

## Delta vs the June-29 prior synthesis

**Genuinely new:**

- **A formal source-integrity boundary.** `36d82e899e75 — Cross: An OWL Wrapper for Reasoning on Relational` adds the most important new result: open-world ontology consistency cannot certify foreign-key existence or reconstruct the authoritative database. This gives No-Escape a precise ontology/database counterexample absent from the June-29 synthesis.

- **An ontology operations layer.** Executable competency questions, typed violations, asserted-versus-entailed QA, cross-version regression, impact-ranked review, and declarative global repair appear across `3033635e217a`, `abb6c8c81403`, `7c1bd43b5958`, `82458716569c`, `2d415b5e3456`, `812503d8c2e2`, and `5943ec738200`. The prior synthesis concentrated on ontology content and projection; this cluster adds lifecycle control and failure handling.

- **The procedure and professional-practice gap.** `43f2c05c6d62 — A Comparison of Four Ontologies for the Design`, `92e7a14f872b — Empirically-Grounded Development of Legal Ontologies: a Socio-Legal Perspective`, and `a9d68b581a0f — Ontologies of Professional Legal Knowledge as the Basis` show that norms, relators, and taxonomies do not cover operational procedure or tacit practice.

- **A formal model for alignment.** `e6bc0ec90155 — Formalising Ontologies and Their Relations` contributes explicit shared sub-ontologies, mappings, refinement, and compatibility-by-consistency. This is materially stronger than the prior synthesis’s generic instruction to align outward with SKOS.

- **Global identity changes as reviewable deltas.** `5943ec738200 — Declarative Repairing Policies for Curated KBs` shows why an identity replacement must be assessed as a global candidate delta. Combined with the non-unique-name and fuzzy-linking papers, this adds an operational guardrail to `identity-iri-fold`.

- **Role-specific inference permissions.** `34c674278903 — The Ontology of Legal Possibilities and Legal Potentialities` contributes an explicit prohibition against manufacturing converses or contrapositives and requires rules, facts, and reasons to retain different inferential roles.

**Re-confirmed:**

- Purpose-scoped foundational/core/domain/application layering and a library of modules rather than one universal ontology.
- Separation of ontology from reasoning framework, workflow, argumentation, and task control.
- Separation of agent identity from time-bounded roles and of physical events from institutional legal qualifications.
- Separation of documents, textual provisions, conceptual norms, interpretations, and cases.
- Stable source identity, temporal/provenance qualification, exact-span grounding, and human approval.
- External standards and vocabularies should be aligned to, not silently copied into repo authority.
- The legal-ontology literature remains rich in architecture and weak in comparative, task-level evaluation.

**Contradictions and corrections:**

- The prior synthesis says the relation-centric camp “won.” This cluster supports relators as a valuable module but does not establish them as the universal organizing center; procedure, principles, argument roles, social reality, and professional practice remain independent requirements.

- The prior synthesis treats missing foundational grounding as a quality defect. `49d66c8b64a7 — A Systematic Mapping of the Literature on Legal` reports prevalence, not a causal improvement in correctness or usability. Foundational grounding should be recorded and tested, not presumed beneficial.

- The prior synthesis presents UFO-L as carrying controlled comprehension evidence. The deep-read note for `04cbf7a69b5e — UFO-L: A Core Ontology of Legal Concepts Built` identifies it as a doctoral proposal with no completed experiments. This cluster therefore cannot corroborate the claimed empirical result from that paper.

- The prior synthesis’s “one schema is the source of truth for types, persistence, and ontology” is too broad for plural, purpose-relative legal conceptualizations. Schema-first modeling remains appropriate, but exact records, semantic assertions, alternative mappings, interpretation acts, and task-specific projections require distinct schema-governed artifacts rather than one canonical meaning graph.

- The prior implementation roadmap is superseded by live repo state: it described an unbuilt ontology package and an Oxigraph-to-FalkorDB source-of-truth pipeline, whereas current `goals/semantic-foundation/SPEC.md` says `@beep/ontology` already has a bounded FOLIO-model surface, application graph state projects to Postgres/PGlite, and M1 excludes graph-store and SPARQL wiring. This report follows the current SPEC.

- The prior recommendation to use `skos:exactMatch` as a straightforward outward bridge needs tightening. This cluster requires scope, source, version, interpretation, confidence, and reversible review on equivalence-like mappings.

- The prior file’s code sketches are already errata-flagged by the packet. This synthesis relies only on its architectural prose and reproduces no code.

## Tensions & contradictions

- **Foundational grounding versus pluralism.** `49d66c8b64a7` and `04cbf7a69b5e` favor explicit foundational grounding; `bdd78bbe92b9`, `a18010b8a6f3`, `8ed689db829c`, and `92e7a14f872b` show limited reuse, non-neutrality, and local practice. Adjudicate through module manifests, explicit mappings, and shared competency cases—not wholesale adoption or foundation-free modeling.

- **Norm-centered, relation-centered, and procedure-centered accounts.** LKIF centers norms, UFO-L centers relations, and the procedure/practice papers center workflows and professional knowledge. Treat these as interacting modules with declared dependencies. Do not choose one as the ontology’s universal root.

- **Open-world inference versus closed-world integrity.** OWL can infer classifications while failing to prove record existence; closed-world validation can identify missing required data while overreaching if treated as legal negation. Run and label both regimes independently.

- **Source authority versus interpreted meaning.** Some papers emphasize exact text; others argue that meaning emerges through interpretation, doctrine, purpose, and practice. Preserve source documents and adopted interpretive acts as distinct exact records, then rebuild semantic views from both.

- **Rich logical definitions versus tractability and open texture.** Equivalent-class axioms improve inferred typing but may degrade reasoners and still cannot resolve legal exceptions or principles. Use bounded reasoning profiles and escalate outside-profile questions rather than maximizing expressivity.

- **Automated propagation versus human authority.** Revision and repair algorithms can reduce review work, but their objective functions optimize decisions or preference order—not legal harm or evidentiary correctness. Automation may order, explain, and propagate provisional consequences; direct human judgments remain authoritative.

- **Stable identity versus changing meaning.** Stable IRIs are valuable for continuity, while definitions and classifications vary by source, jurisdiction, purpose, and time. Keep identity stable where warranted and version the conceptualizations and mappings around it.

- **Complete deontic partitions versus silence and uncertainty.** LKIF’s allowed/disallowed partition conflicts with accounts that distinguish permission, silence, dispute, and unknown status. Use LKIF’s partition only as a competency fixture; retain richer states until a governing authority resolves them.

- **Global optimal repair versus operational budgets.** Global repair avoids order and syntax sensitivity but is exponential; local repair is cheaper but policy-sensitive. Expose which mode ran, its budget, its completeness/optimality status, and all surviving alternatives.

## Routing suggestions

| Insight | Route | Rationale |
| --- | --- | --- |
| Purpose/layer manifests, adoption matrix, and competency evidence for external ontologies | `extend <explorations/legal-ontology-landscape>` | Candidate evaluation belongs in the reuse landscape before constants or alignments enter M1. |
| Negative identity fixtures plus scoped, reversible mapping records | `attach-to <goals/identity-iri-fold>` | Attach as a boundary and fixture requirement only; do not widen the fold into semantic identity adjudication. |
| Executable competency questions, dual OWA/CWA results, and typed violation envelopes | `attach-to <goals/semantic-foundation>` | These directly strengthen registry/loader acceptance without adding law-practice entities or a graph runtime. |
| Document, expression, norm interpretation, situation, and qualification distinctions | `extend <explorations/legal-ontology-landscape>` | The distinctions should inform future legal-core shaping but exceed current M1 scope. |
| USPTO procedure and professional-practice modeling | `new-exploration <legal-procedure-practice-ontology>` | Procedure, competence, deadlines, transitions, and tacit practice form a distinct problem not covered by the taxonomy seed. |
| Ontology release history, inferred-closure regression, and pattern-drift QA | `new-exploration <ontology-lifecycle-qa>` | This is an operational lifecycle capability with separate snapshots, reasoners, diagnostics, and review policy. |
| Candidate-axiom review, consequence previews, risk-weighted queues, and declarative repair policies | `new-exploration <ontology-curation-governance>` | Human-governed ontology mutation is a cross-cutting control-plane concern, not a registry-loader feature. |
| Exact interpretation/adoption records plus bitemporal semantic projections | `attach-to <goals/epistemic-bitemporal-edge-core>` | It can refine exact-record versus derived-assertion types without weakening No-Escape. |
| Premise-role typing and converse/contrapositive rejection | `new-exploration <legal-inference-policy>` | The guard belongs to legal proof construction and attorney review, beyond static ontology assembly. |
| Span-bound extraction candidates with ambiguous IRI sets and review state | `attach-to <goals/citation-extraction-engine>` | The cluster supplies a concrete candidate envelope while preserving verified spans as evidence. |
| Ontology distance, graph traversal, and corpus association as structural candidate channels | `attach-to <goals/hybrid-retrieval-fusion-core>` | These signals warrant ablations against lexical and dense retrieval; none should become authority or identity evidence. |

## Quality notes

- Tier distribution is 15 gold, 22 silver, and 2 bronze. “Gold” usually denotes architectural impact, not strong empirical validation.

- The evidence is heavily conceptual and historically concentrated. Many papers date from 1998–2017, use small European or national-law examples, and predate modern provenance, bitemporal, retrieval, and agent-security requirements.

- Several publications are not independent corroborations: `bdd78bbe92b9` and `a18010b8a6f3` report substantially overlapping LKIF work; `f796c27e78a8` and `ad20ba29c442` share the CLO/D&S program; `2d415b5e3456` and `812503d8c2e2` are closely related interactive-revision lines.

- Retrieval, compliance, and usability claims routinely exceed the evidence. `a9d68b581a0f` reports no retrieval evaluation; `091ad4e2ded0` remained under expert revision; `5ab5eabd251e` uses toy examples; `bbd2af54d814` imports its principal F1 result and is not legal-domain evaluated.

- `13214380eff3 — Legal Ontologies in ICT and Law` omits the promised 14-page case study, while `05e9b573b10a — Indexing as an Ontological Support for Legal Reasoning` lacks 22 pages containing the ontology and experiments. `57a8de3ad9e5 — Building and Processing a Knowledge-Graph for Legal Data` is a proposal without a built graph.

- Several reported evaluations contain material inconsistencies: `badd96c61d16` says 95 queries while its table totals 96; `3033635e217a` confuses at-most, at-least, and exactly-three cardinality; `2d415b5e3456` contains a table/prose conflict; `812503d8c2e2` contains formal and arithmetic inconsistencies.

- `aa2e7d330d7f — Simulando Indenização em Ações Civis por meio de` tests two positive, hand-modeled cases, excludes partial outcomes, and does not calculate indemnity despite its title. `04cbf7a69b5e — UFO-L: A Core Ontology of Legal Concepts Built` is a proposal, not evidence of improved modeling outcomes.

- The strongest QA studies use biomedical or synthetic ontologies, not legal ones: `7c1bd43b5958`, `82458716569c`, `2d415b5e3456`, `812503d8c2e2`, and `5943ec738200`. Their mechanisms are portable; their legal validity and attorney usability are unproved.

- No paper demonstrates a complete USPTO-ready ontology, stable-IRI governance, exact-span provenance, bitemporal revision, conflict-aware legal reasoning, and production cost behavior together. The report therefore routes mechanisms and test obligations, not a wholesale ontology adoption.

## Papers in this cluster

- bdd78bbe92b9 — The LKIF Core Ontology of Basic Legal Concepts — gold
- 49d66c8b64a7 — A Systematic Mapping of the Literature on Legal — gold
- a18010b8a6f3 — LKIF Core : Principled Ontology Development for the Legal — gold
- 92e7a14f872b — Empirically-Grounded Development of Legal Ontologies: a Socio-Legal Perspective — silver
- a09528e40201 — Semantic Web for the Legal Domain: The next — gold
- f796c27e78a8 — Some ontological tools to support legal regulatory compliance, — gold
- 04cbf7a69b5e — UFO-L: A Core Ontology of Legal Concepts Built — silver
- 3c06bfc28d1d — Classifications and the Law: Doctrinal Classifications vs. Computational Ontologies — gold
- 05e9b573b10a — Indexing as an Ontological Support for Legal Reasoning — silver
- 13214380eff3 — Legal Ontologies in ICT and Law — bronze
- badd96c61d16 — Ontology Knowledge Map Approach Towards Building Linked Data — silver
- ad20ba29c442 — A Constructive Framework for Legal Ontologies — gold
- 3bed889dda6e — An Ontology for the Construction of Legal Decision — silver
- 014f57bd6d67 — ONTOLOGIES IN THE LEGAL DOMAIN — gold
- aa2e7d330d7f — Simulando Indenização em Ações Civis por meio de — silver
- 2d415b5e3456 — Wheat and Chaff – Practically Feasible Interactive Ontology Revision — silver
- 0bfbbc91fda6 — THE BIONIC TURN IN LEGAL EPISTEMOLOGY: SOME REMARKS — silver
- 57a8de3ad9e5 — Building and Processing a Knowledge-Graph for Legal Data — bronze
- 5ab5eabd251e — An Ontological Approach to Legal Literature for Improving — silver
- 34c674278903 — The Ontology of Legal Possibilities and Legal Potentialities — gold
- 43f2c05c6d62 — A Comparison of Four Ontologies for the Design — gold
- ea07aefd3215 — Law and the Semantic Web, an Introduction — silver
- 091ad4e2ded0 — Ontological Semantics for Data Privacy Compliance: The NEURONA Project — silver
- 85175dde1716 — The winter, the summer and the summer dream — silver
- abb6c8c81403 — Describing Reasoning Results with RVO, the Reasoning Violations — silver
- 2d2219bdb167 — A Complex-System Approach: Legal Knowledge, Ontology, Information and — silver
- 8ed689db829c — Ontologies in Legal Information Systems; The Need for — gold
- 2a9360ee7197 — Relating Knowledge Graphs To Logic, Language, and the World — silver
- a9d68b581a0f — Ontologies of Professional Legal Knowledge as the Basis — silver
- 3033635e217a — CQChecker: A Tool to Check Ontologies in OWL-DL — silver
- bbd2af54d814 — KnowGL: Knowledge Generation and Linking from Text — silver
- 5943ec738200 — Declarative Repairing Policies for Curated KBs — gold
- 6f837875afbc — Ontologies and Legal Knowledge-Based Systems Development — silver
- 36d82e899e75 — Cross: An OWL Wrapper for Reasoning on Relational — gold
- e6bc0ec90155 — Formalising Ontologies and Their Relations — gold
- 812503d8c2e2 — Reasoning-Supported Interactive Revision of Knowledge Bases — silver
- e7bc107b3188 — Ontologies as a Set to Describe Legal Information — silver
- 7c1bd43b5958 — A Quality Assurance Workflow for Ontologies based on — silver
- 82458716569c — VERSION ANALYSIS FOR FAULT DETECTION IN OWL ONTOLOGIES — gold

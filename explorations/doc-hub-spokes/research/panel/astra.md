Model: GPT-6-based Codex; the exact runtime variant is not exposed to me.

## 1. Prior art: most components exist; the integration remains a hypothesis

I do not know a mature system implementing this entire architecture with demonstrated improvements across knowledge domains. That is different from saying the components are novel. The strongest contribution would be a measured improvement in producing and reviewing documents, supported by a precise integration contract.

**(a) Positioned diagnostics for a notation.** Language servers, linters, and document validators already provide this interaction pattern. **LSP** standardizes diagnostic and editing interfaces; **SARIF** carries findings, multiple locations, fixes, provenance, and execution paths. **Vale** brings configurable lint rules to prose. These establish the transport and authoring loop, not substantive document correctness. SARIF is especially relevant: study its complexity before deciding that one span and one confidence number suffice. [LSP](https://microsoft.github.io/language-server-protocol/), [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html), [Vale](https://docs.vale.sh/).

**(b) Typed admission of LLM output with repair.** **Guardrails AI/RAIL** specifies output structure, validators, and corrective actions. **Instructor** uses Pydantic validation and returns failures through retry loops. These are close precedents for admission and repair. They do not establish the proposed advantage of arbitrary notation, lossless source preservation, and span editing. Also, schema compliance gives certainty about represented constraints, not the truth of represented assertions. [Guardrails RAIL](https://github.com/guardrails-ai/guardrails/blob/main/docs/how_to_guides/rail.md), [Instructor validation](https://python.useinstructor.com/concepts/reask_validation/).

**(c) Domain document oracles.** The assertion that other domains have rulebooks but no oracle is too broad:

- **ClaimMaster** documents checks for antecedent basis, claim dependencies, reference numbering, and claim terms missing specification support. Its advertised detection capability is not evidence of legal completeness. [ClaimMaster documentation](https://www.patentclaimmaster.com/help/Introduction.html).
- **XBRL Formula** expresses business rules against financial report instances. This is an established document-validation architecture involving taxonomies and multiple validation layers. [XBRL validation](https://www.xbrl.org/the-standard/what/key-concepts-in-xbrl/validation/).
- **HL7 CQL/ELM** separates an author-facing clinical language from a canonical executable representation. **FHIR validation** checks profiles and resource constraints. These concern formalized clinical knowledge and data, not unrestricted clinical prose. [CQL introduction](https://cql.hl7.org/N1A/01-introduction.html), [FHIR validation](https://fhir.hl7.org/fhir/validation.html).
- **Catala** compiles executable interpretations of statutory rules, with default logic central to its design. It demonstrates both the opportunity and the considerable work required to formalize law. [Catala paper](https://arxiv.org/abs/2103.03198).

**(d) Provenance used as a gate.** **PROV-O** supplies representation; **AIRO** supplies AI-risk concepts. Neither, merely by being an ontology, establishes output reliability. **in-toto** is a closer operational precedent: signed records are checked against required steps, authorized actors, and artifact relationships. It gates process integrity in software supply chains, not substantive AI conclusions. I have not verified an established system combining your complete search–independent-review–calibration–human-signature policy with demonstrated document-quality gains. [PROV-O](https://www.w3.org/TR/prov-o/), [AIRO research](https://arxiv.org/abs/2610.31380), [in-toto](https://in-toto.io/docs/getting-started/).

**(e) Projectable declarative DSLs.** **LinkML** is a particularly close precedent: schemas generate multiple representations, including OWL and SHACL, with documented semantic limitations. **Tawny-OWL** embeds ontology construction in Clojure while retaining OWL semantics. Neither makes arbitrary executable policies faithfully interchangeable with OWL axioms. [LinkML OWL generation](https://linkml.io/linkml/generators/owl.html), [LinkML RDF/SHACL](https://linkml.io/linkml/data/rdf.html), [Tawny-OWL](https://arxiv.org/abs/1303.0213).

**(f) Compiler or diagnostic feedback.** **CompCoder** uses compiler feedback in reinforcement learning. **CodeRL** uses unit-test signals and a learned critic. **Teaching Large Language Models to Self-Debug** studies iterative execution-informed correction. These support investigating external feedback; they do not establish that probabilistic document judgments inherit compiler-like properties. [CompCoder](https://aclanthology.org/2022.findings-acl.2/), [CodeRL](https://arxiv.org/abs/2207.01780), [Self-Debugging](https://arxiv.org/abs/2304.05128).

## 2. Where the thesis is wrong or likely to fail

**Process admissibility is not a reduction of substantive judgment.** Your weaker formulation is correct: compliance with an explicit process policy can be checked mechanically. But “tiers 3/4 become tiers 1/2” changes the proposition being checked.

“The required search and review occurred” and “this invention is novel” remain different propositions. An approved domain can host irrelevant evidence. A quotation can exist but fail to entail the claim. Two providers can share misconceptions, retrieval omissions, or framing. A human signature establishes an accountable decision, not truth.

Even the process proposition needs qualifications. A well-formed provenance graph can describe events that never occurred. Evidence must come from trusted recording boundaries, bind to exact artifacts, and distinguish an actor’s attestation from independently observed execution. Cross-provider review is a diversity intervention whose benefit must be measured, not an independence guarantee.

**The tier boundary is already wrong in the worked example.** Antecedent basis is not uniformly a name-resolution error with a mechanical fix. USPTO guidance explicitly recognizes implicit antecedent basis, including inherent components, and says missing explicit antecedent basis does not automatically establish indefiniteness. A literal matcher can report a drafting convention violation; it cannot silently promote that into a legal conclusion. [MPEP §2173.05(e)](https://www.uspto.gov/web/offices/pac/mpep/s2173.html).

Likewise, specification support is not equivalent to finding every claim term in an ontology. Written description concerns the claimed invention and its limitations, assessed in context. An ontology can make an accepted interpretation executable; it does not establish that interpretation’s adequacy. [MPEP §2163](https://www.uspto.gov/web/offices/pac/mpep/s2163.html).

**A common envelope is useful; uniform semantics are dangerous.** A missing section has no existing span. A contradiction has several locations. A dependency-cycle finding targets a graph. A human objection can challenge the rule itself.

Use an envelope around a discriminated union: violation, unresolved question, obligation, recommendation, execution failure. Allow document, node, edge, insertion-point, and multiple-span targets. Shared storage and rendering are plausible. Repair and routing must branch on authority, actionability, and evidence requirements, even if they do not branch on judge implementation.

“Deterministic confidence = 1” confuses reproducibility with validity. A deterministic heuristic can be consistently wrong. Separate execution status, proof or derivation status, empirical reliability, and predicted probability. A second scalar called “confidence” adds little unless it has an operational definition.

**Profile monotonicity is a restricted contract, not a natural property.** With frozen interpretation and independent predicates, adding conjunctive constraints shrinks the accepted set. That is straightforward.

But profiles also introduce vocabulary, inference, exceptions, and scope. Adding an axiom can resolve a previous unknown-term or classification finding. Changing the entailment regime can change existing outcomes. Two individually satisfiable profiles can be incompatible.

Separate additive constraint bundles from interpretation-changing configuration. Detect incompatible bundles before asking an agent to repair forever. Legal exceptions and precedence deserve explicit treatment; **LegalRuleML** already recognizes defeasibility, temporal context, and conflicting norms. [LegalRuleML specification](https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/os/legalruleml-core-spec-v1.0-os.html).

**Span repair is an optimization hypothesis.** It should help isolated defects in otherwise good documents. It can perform poorly when the organization, argument, or claim dependency structure is wrong. Repeated small repairs can produce locally conforming but globally incoherent prose.

Measure total accepted-result cost, including retries and human review. Offer local replacement, subtree replacement, and regeneration. Preserve a deliberate choice among them. Also distinguish text locality from semantic locality: changing one definition can invalidate every downstream finding and witness.

**The hub is less universal than claimed.** Headings, paragraphs, and tables constitute a document model, not the semantic model of a patent. Claims, limitations, interpretations, and support relationships need a separate domain representation linked to the document.

CSS and scripts are not merely alternative notations for that document model. They introduce layout and behavior. A universal hub risks becoming either a lowest-common-denominator tree or a union of every spoke’s features. Declare bounded interchange subsets and explicit extension points.

**The evaluation corpus can teach the oracle the wrong target.** Office actions record examiner behavior under selection and procedural constraints. They are not a complete, uncontested correctness dataset. Unmentioned defects are not reliable negatives. Training on rejection records can collapse tier 3 into tier 4.

Keep independently adjudicated holdouts separate from the repair ledger. Recurring human comments are candidates for investigation, not automatically rules: recurrence may reflect ambiguity, preference, or a bad upstream workflow.

## 3. The DSL: choose semantics before class syntax

A DDD-shaped API is reasonable authoring ergonomics for this team. It is not an adequate semantic foundation.

Commands, aggregates, events, and policies describe state transitions and responsibility boundaries. Taxonomic subsumption, existential restrictions, defeasible rules, and evidence obligations have different semantics. A schema-bearing TypeScript class makes a declaration serializable only if its meaningful contents are themselves data. Arbitrary Effect closures do not become portable rules.

I would build a small family of explicitly typed intermediate representations:

| Concern | Suitable representation |
|---|---|
| Vocabulary and logical classification | OWL axioms within a declared fragment |
| Required evidence and graph integrity | SHACL constraints over a specified graph |
| Derived relations and recursive checks | Datalog with declared negation semantics |
| Process execution and authorization | State machine or workflow policy |
| Probabilistic judgments | Versioned evaluator contracts and calibration records |

Direct OWL/SHACL/Datalog authoring should remain available where experts need it. A TypeScript façade should construct these representations, not pretend their semantics are interchangeable.

For faithful OWL projection, either embed the relevant **OWL 2 structural AST** or publish a deliberately restricted fragment. At minimum, distinguish:

- Classes, individuals, object properties, data properties, datatypes, and annotations.
- Subclass from equivalence; conjunction, disjunction, and complement.
- Existential from universal restrictions; qualified cardinalities.
- Equality, explicit inequality, and disjointness.
- Property characteristics and chains, with OWL 2 DL global restrictions enforced.
- Imports, ontology versions, axiom provenance, and supported entailment regime.

These are semantic commitments, not documentation tags. Arbitrary property-chain and cardinality combinations are not automatically legal OWL 2 DL. [OWL 2 structural specification](https://www.w3.org/TR/owl2-syntax/).

The crucial distinction is **entailment versus record completeness**. An OWL existential restriction can require a reviewer to exist without identifying one in the available graph. Different reviewer identifiers need not denote different people. Thus an OWL model can satisfy conditions that would fail your operational evidence requirement. [OWL 2 primer](https://www.w3.org/TR/owl-primer/).

SHACL can require recorded reviewer links and constrain their values in the selected graph. It does not independently prove that review happened, that the reviewer was competent, or that the graph is complete. Specify graph boundaries, inference materialization, identity handling, and evidence freshness. [SHACL](https://www.w3.org/TR/shacl/).

Faithful projection also needs an explicit failure mode. Probability, deadlines, defaults, procedural order, arbitrary computation, and legal precedence generally cannot be translated into ordinary OWL axioms while preserving their operational meaning. Encoding them as annotations preserves bytes, not executable semantics.

Bidirectional projection should be promised only for a supported intersection, with round-trip laws. Imported constructs outside that intersection must survive opaquely or produce typed losses. Apply your existing document-loss discipline to the rule compiler itself.

## 4. What would make me productive inside the loop

I would use it willingly if it gave me:

- Stable finding IDs, pinned document/rule versions, and exact rejected evidence.
- Small feedback batches ordered by dependency and expected value.
- Explicit distinctions among “failed,” “unknown,” “not checked,” and “judge unavailable.”
- Safe patch handles with expected-old-text checks, rather than requiring me to calculate byte offsets.
- A choice between local edits, coordinated edits, and regeneration.
- A way to challenge a false positive, propose a rule exception, or request human interpretation.
- Fast local checks, with expensive searches and review obligations deferred to appropriate milestones.

A diagnostic should state the missing fact or violated relation, show the relevant context, and expose what would satisfy it. “Improve support” is not actionable. “This limitation has no accepted support edge; these two candidate passages were rejected for these reasons” is.

I would route around a system that repeatedly produces false positives, changes rules mid-task, floods the context with duplicate findings, or demands expensive ceremonies after every edit. I would also learn to exploit deletion if removing difficult content makes the dashboard greener.

The productive agent objective must be fulfilling the user’s substantive task under constraints. Minimizing findings is only a proxy.

## 5. The smallest useful two-week experiment

Test one narrow proposition: **located diagnostics plus local repair reduce the cost of producing acceptable short patent-related documents without damaging meaning.**

Do not build the general DSL, rename packages, add HTML parsing, or implement novelty adjudication for this experiment.

**Days 1–3: freeze scope and evaluation.** Assemble 12 development and 40 held-out short dossiers, each containing a specification excerpt, a few claims, and explicit drafting requirements. Include clean examples, natural defects, and seeded defects. Keep related patent families together when splitting. Have a patent practitioner label defects and acceptable repairs, preserving unresolved cases.

Implement four checks using the existing Markdown parser, source maps, document model, and findings infrastructure:

1. Duplicate claim identifiers.
2. Dangling or cyclic dependency references.
3. Missing reference-numeral targets within an explicitly complete supplied inventory.
4. Missing evidence for an explicitly required support link.

The fourth checks whether evidence is recorded, not whether legal support is sufficient. Add difficult antecedent-basis examples as advisory cases to test restraint.

**Days 4–7: compare four arms.**

| Arm | Interface and correction |
|---|---|
| A | Existing structured blocks and JSON Patch repair |
| B | Markdown, unlocated prose summaries, regeneration |
| C | Markdown, located typed findings, regeneration |
| D | Markdown, the same findings, span repair |

Use identical substantive requirements, equivalent validators, pinned model settings, and the same two-attempt budget. Share the initial Markdown draft across B–D for the repair comparison. Include initial-generation cost when comparing A with the others.

B→C isolates actionable localization; C→D isolates repair granularity; A→D tests the claimed advantage over your existing system.

**Days 8–11: run and review blind.** Measure final practitioner acceptance, missed defects, false-positive findings, preservation of required content, semantic regressions, tokens, latency, and human review minutes. Count unresolved attempts as failures rather than excluding them. Keep seeded-defect and natural-defect results separate.

Also test a handful of provenance attacks: copied approval on changed bytes, fabricated reviewer records, irrelevant but authentic quotations, and stale evidence.

**Days 12–14: apply preregistered decision criteria.** A reasonable pilot target is a 20% reduction in total completion cost, with no observed increase in material semantic regressions. Report paired differences and uncertainty; 40 cases cannot establish safety or tight noninferiority.

If D does not beat C, reject the span-repair advantage for this workload. If C beats B but D does not beat A, the evidence supports better diagnostics, not replacing structured output. If false positives consume the savings, stop expanding rules.

This experiment cannot validate the cross-domain architecture or the substantive adequacy of provenance gates. It can falsify the immediate product promise cheaply.

## 6. One idea missing from the proposal: frame conditions for repairs

Give repairs an explicit contract describing **what meaning they may change**.

Program verification uses frame conditions to bound an operation’s effects; Dafny’s `modifies` clauses are a concrete precedent. Adapt that idea to documents, while acknowledging that semantic preservation will sometimes require review rather than proof. [Dafny framing](https://dafny.org/latest/DafnyRef/DafnyRef.html).

Before a repair, identify protected commitments: required claim limitations, quantities, negations, citations, dependencies, and unresolved questions. A patch declares its intended changes. The system checks which commitments and witnesses may have been affected.

Fixing an antecedent reference should not silently delete a limitation. Repairing a citation should not strengthen the proposition it supposedly supports. Reorganizing a section should not preserve a human approval whose evidentiary basis changed.

Start with explicit structured commitments and conservative invalidation. Report uncertain semantic effects for review.

This changes the acceptance question from “Did the finding disappear?” to “Did the finding disappear while the protected task requirements survived?” That is a stronger defense against agents satisfying the oracle by degrading the work product.
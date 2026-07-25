# Legal Ontologies for `beep-effect`

### A Typed, Schema-First Field Guide — from Hohfeld to Effect Schema

> *A synthesis for an engineer who thinks in types and schemas, building a legal/IP platform on Effect-TS.*

---

**What this is.** A working translation of ~50 years of legal-ontology research into the vocabulary you actually build in: branded scalars, tagged unions, relators, state machines, and schema annotations. It is opinionated, code-heavy, and aimed squarely at `beep-effect`'s real goals — the `@beep/ontology` / `@beep/rdf` modeling stack, the `epistemic` claim-lifecycle, and the `law-practice` / IP-patent slice that serves a working USPTO patent practice.

**How it was produced.** This document is the output of a multi-agent research workflow:

- **72 papers deep-read** end-to-end (the 19-paper "most-similar" set beside this file + 53 curated from `~/YeeBois/research/ontology_research`, triaged out of 449 candidates), grouped into seven thematic clusters and distilled cluster-by-cluster.
- **5 reference implementations studied** as live code (`effect-ontology`, `effect-langextract`, Palantir's `osdk-ts`, `ontouml-js`, and the ALEA Institute's **FOLIO** legal ontology).
- **6 web/standards sweeps** (LKIF-Core, LegalRuleML, Akoma Ntoso, ELI/ECLI, PROV-O, SKOS, FRBR, gUFO, the rules-as-code tools).
- **4 groundings in the live `beep-effect` codebase** so every code sample matches the real idiom (`BaseEntity.Class`, `LiteralKit`, `EntitySchema.persist`, `$I.annote`, the 4-state `ClaimLifecycle`, `TextAnchor`/`EvidenceSpan`).
- **14 load-bearing claims independently fact-checked** (13 confirmed; 1 corrected — see Appendix B) and the whole draft put through an adversarial senior-engineer + legal-ontologist review.

**How to read it.** The Executive Summary is the 5-minute version. §§2–3 are the *theory* (the field, then the concepts). §4 is the *domain* (IP/patent). §§5–7 are the *engineering* (the translation playbook, a concrete schema blueprint, and the epistemic wiring) — this is the heart if you just want code. §8 is *build-vs-borrow*. §9 is *what to do*, sequenced. §10 is *where to read next*. Appendix A is a concept→schema cheat-sheet; Appendix B documents provenance and the one fact we corrected.

> **Code caveat.** Code blocks are *illustrative* and idiomatic, not copy-paste-compilable. They reference real `@beep/*` symbols where grounded, but verify against live source before shipping. Anything marked "illustrative" is a sketch of intent, not an API contract.

---

## Contents

1. [Executive Summary — The One Big Idea](#1-executive-summary--the-one-big-idea)
2. [A Field Guide to Legal Ontologies](#2-a-field-guide-to-legal-ontologies)
3. [The Conceptual Core Every Legal Ontology Needs](#3-the-conceptual-core-every-legal-ontology-needs)
4. [Modeling IP & Patent Practice — The Ontology `beep-effect` Actually Needs](#4-modeling-ip--patent-practice--the-ontology-beep-effect-actually-needs)
5. [From Ontology to Types & Schemas — The Translation Playbook](#5-from-ontology-to-types--schemas--the-translation-playbook)
6. [A Legal Core Ontology for `beep-effect` — A Schema Sketch](#6-a-legal-core-ontology-for-beep-effect--a-schema-sketch)
7. [Claims, Evidence & Admissibility — Wiring Legal Ontology into the Epistemic Slice](#7-claims-evidence--admissibility--wiring-legal-ontology-into-the-epistemic-slice)
8. [Build vs. Borrow — Reference Implementations Worth Studying](#8-build-vs-borrow--reference-implementations-worth-studying)
9. [Recommendations & Roadmap for `beep-effect`](#9-recommendations--roadmap-for-beep-effect)
10. [Annotated Reading Map](#10-annotated-reading-map)
- [Appendix A — Concept → Schema Inventory](#appendix-a--concept--schema-inventory)
- [Appendix B — Provenance & Method](#appendix-b--provenance--method)

---

## 1. Executive Summary — The One Big Idea

### The one sentence version

Here is the entire corpus compressed to a single claim: **a legal ontology is not a taxonomy of legal *things* — it is a graph of correlative *positions* between parties, qualified by norms, and indexed to a time and a jurisdiction.** A subsumption tree (`Patent` is-a `IntellectualProperty` is-a `Asset`) is the least interesting thing about law. What law actually *is* lives in the relations: this examiner *owes* a reasoned rejection to that applicant; this licensee *may* practice the claims but does *not* hold the right; this assignment *has the power to* extinguish the inventor's standing. Across the ~70 papers and reference repositories synthesized here, the strongest cross-cluster consensus — from UFO-L's controlled comprehension experiment to Francesconi's correlative equivalences to CLO's reified modal statements — is that **deontic content must be modeled as paired, branded positions inside a reified relation, never as free-floating monadic flags on a party.**

If you think in types, this is the best news in the document, because it maps *cleanly* onto schema-first engineering. A relator is a struct that existentially depends on two role-playing parties and bundles a correlative pair of legal positions — the active position in `holder`, the correlative one in `counterparty`. You read both sides off the one record; there is no duplicated converse:

```ts
const LegalRelator = LiteralKit(["RightDuty", "PrivilegeNoRight", "PowerLiability", "ImmunityDisability"])
  .toTaggedUnion("kind")({
    RightDuty: { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, object: ActionOrOmission },
    // ...the other three Hohfeldian squares (see §3, §6)
  })
  .pipe(S.filter((r) => r.holder !== r.counterparty, { message: () => "holder and counterparty must differ" }));
// both legs live on one relator: holder bears the active position, counterparty the correlative — no party-swap
```

That single shape is exactly the gap in beep today: law-practice links entities by opaque `*FixtureKey: S.String` strings, with zero deontic or relator constructs.

### Why this is the through-line

The field has been circling this idea for thirty years. The 1990s gave us the architectural skeleton — Bench-Capon & Visser's "a library of dedicated ontologies, not one universal one," Valente's functional FOLaw decomposition, Van Kralingen & Visser's frame-based Norm/Act/Concept slots. The modern era operationalizes it: (LKIF-Core) supplies the concept vocabulary, (UFO-L) supplies the relator pattern, (LegalRuleML) the defeasible rule interchange, (Akoma Ntoso) and ELI/ECLI the document and citation identifiers, and (FOLIO) an 18,000-concept SKOS vocabulary that is the closest existing analogue to beep's whole stack. The next section walks this family tree in detail; here it is enough to know they all converge on *relational and normative*.

### What this means for the real target

beep-effect's concrete target is not "law in general." It is a TypeScript/Bun/Effect-TS platform for a veteran USPTO patent attorney — prosecution portfolios, PTAB and Federal Circuit litigation, TTAB matters, licensing — ingesting authoritative sources into an OWL/RDF layer and publishing only *verified* graph nodes. Every modeling decision below earns its place against that target.

### What to do Monday morning

- **Ontology-modeling:** scaffold `@beep/ontology` per `goals/ontology-modeling-foundation/SPEC.md`; make the existing `SemanticSchemaMetadata` load-bearing by writing a Turtle/N-Triples projector over `serializeQuad`.
- **Law-practice:** delete `*FixtureKey: S.String`; replace each link with a first-class relator (Rejection-against-Claim, PriorArt-anticipates-Claim) projected to `gufo:Relator`/`gufo:mediates`.
- **Temporal substrate:** factor a domain-agnostic multi-temporal `LegalValidity` into `foundation/modeling`; make `(legalSystemId, validity-interval)` mandatory on every legal fact.
- **Epistemic:** extend `EvidenceSpan` with langextract's deterministic `AlignmentStatus` and FOLIO lineage; offsets computed, never trusted from the model.
- **Provenance:** promote `ClaimGateResult` toward a defeasible verdict and gate publishing behind PROV-O-attributed `verified | plausible_unverified | flagged` bundles.
- **Grounding:** pick UFO/gUFO for relators, record it explicitly, and align outward to LKIF/FOLIO via `skos:exactMatch` — never copy foreign OWL.

Read on: the field guide that follows turns each of these families into importable patterns.

## 2. A Field Guide to Legal Ontologies

Most legal-ontology papers, once you strip the prose, are arguing about the same three-floor building. They disagree about what goes on each floor and which one deserves the most attention, but the floors themselves are remarkably stable. Before we commit beep to any one of them, it pays to walk the building and read the arguments on the walls.

### The vertical stack: foundational / core / domain

The single most reproducible finding across the corpus is a vertical layering. At the top sits a **foundational (upper) ontology** of domain-independent categories — objects vs. events, endurants vs. perdurants, qualities, relators — supplied by DOLCE, BFO, SUMO, or UFO. Beneath it sits a **legal core ontology (LCO)**: norms, agents, roles, legal relations, sources — the vocabulary reusable across *all* of law. Below that is a **domain layer** (patent prosecution, GDPR, copyright) that is deliberately *not* reusable and gets rebuilt per subdomain, and finally an **application / A-Box** of instances. Guarino's "What is an Ontology" supplies the discipline that justifies the split: an ontology is a *formal, explicit specification of a shared conceptualization* (Gruber's 1993 "explicit specification of a conceptualization", with "formal" and "shared" added by Borst and Studer), and the degree of generality is exactly what separates the tiers.

The engineering payoff is a hard dependency rule — **a lower tier may reference identifiers in a higher tier, never the reverse** — plus an explicit tag on every module so the schema→RDF builder can partition emitted graphs into reusable-core vs. statute-specific:

```ts
const OntologyLayer = LiteralKit(["foundational", "core", "domain", "application"]).pipe(
  $I.annoteSchema("OntologyLayer", {
    description:
      "Vertical tier; the schema->RDF builder partitions reusable-core vs statute-specific graphs by this tag, and CI rejects upward references.",
  }),
)
```

Griffo's Systematic Mapping makes the choice consequential: it treats *absence of foundational grounding* (32% of surveyed ontologies) as a quality defect, not a stylistic preference. So in beep the grounding must be recorded, never implicit.

### Why explicit, shared, and plural — Bench-Capon & Visser

The foundational argument for doing any of this is still Bench-Capon & Visser's: a legal knowledge base needs an *explicit, shared conceptualisation* so that reasoning, communication, and reuse don't silently depend on a modeller's private intuitions. Their durable, counter-intuitive recommendation is that the answer is **not one universal legal ontology** but "a library of dedicated ontologies, one per purpose." Casanovas sharpens it ("there are no neutral ontologies"), Binefa formalises it as C-OWL viewpoints, and Abramowicz reframes reuse as the organising requirement. For beep this lands as: purpose-tagged, sliced modules — not a monolith — with grounding declared per slice.

### The families, compared

Five-and-a-half families recur. Here is the tour as a single table; the prose afterward draws out the two contrasts that matter most for our schema layer.

| Family | Grounding | Core commitment | Gets right | Gets wrong (for beep) |
|---|---|---|---|---|
| **FOLaw** (Valente, 1995) | none (functional) | Six *knowledge categories* — normative, world, responsibility, reactive, meta-legal, creative | Names the recurrent *reasoning roles* in legal problem-solving | It's an epistemology, not a terminology — no taxonomic backbone |
| **Frame-based** (van Kralingen & Visser) | none | Law as three slot-frames: Norm (8 slots), Act (13, event\|process × institutional\|physical), Concept-description | Maps almost 1:1 onto tagged structs | Norm-centric and monadic; relations are flattened into slots |
| **LLD** (McCarty) | bespoke logic | Deontic + temporal + action logic, plus *prototype-and-deformation* for open texture | Open-textured concepts = invariant core + permitted deformations, not closed enums | A research logic, not an importable vocabulary |
| **LRI-Core** (Breuker & Hoekstra) | commonsense/cognitive (five "worlds") | Law grounded in physical/mental/role/abstract/occurrence categories | Rejects over-philosophical grounding; cognitively plausible | Idiosyncratic; not a clean RDF target |
| **LKIF-Core** (ESTRELLA) | DOLCE-aligned | ~15 OWL modules (top, mereology, time, process, action, role, legal-role, norm, expression, rules…) feeding Carneades | Broad concept coverage; modular; real OWL | Flattens deontic content into OWL-DL allows/disallows; *no first-class dyadic legal relations*; missing units module |
| **UFO-L** (Griffo, Almeida & Guizzardi) | UFO / OntoUML (gUFO) | Legal **relation as relator** mediating two agents-in-roles, bundling correlative **legal positions** as modes | Hohfeld's eight conceptions + Alexy; *empirically* improves comprehension | Heaviest grounding commitment; needs gUFO projection discipline |

#### Contrast one: FOLaw vs. LRI-Core is an epistemology-vs-ontology fault line

FOLaw and LRI-Core both come from Breuker's orbit, yet they answer different questions. FOLaw asks *what role does knowledge play in legal reasoning* — its categories are verbs of reasoning (normative knowledge "qualifies," reactive knowledge "responds"). Breuker & Hoekstra later reclassified FOLaw outright as an **epistemological framework**, not an ontology, precisely because it lacks a terminological taxonomy. LRI-Core asks the ontological question — *what kinds of things exist* — answering with five cognitive worlds. The lesson for beep is sharp and load-bearing for the next section: keep "the role knowledge plays in reasoning" *out* of the clean RDF terminological layer, and route it to a separate epistemic/argument layer. We layer both, but we do not braid them.

#### Contrast two: norm-centric vs. relation-centric

Frame-based and LKIF-Core inherit the Kelsenian, norm-centric tradition: the norm is the unit, parties are arguments to it. UFO-L explicitly inverts this — "we propose removing the focus of legal norms and putting it on legal relations." Its 2023 DKE work even handles the *second* Hohfeldian square (power/liability, immunity/disability), where powers operate *on* other relations. This is the family beep should import, because law as lived is a web of correlative positions between parties, not a subsumption tree of terms. (The relator mechanics belong to the conceptual core that follows; here it is enough to mark that the relation-centric camp won.)

### What the comparisons concluded about evaluation

The four-ontology and two-ontology comparisons in the corpus converge on a short list of criteria, and they are unflattering. **Coverage** (does it span sources, norms, agents, acts, time?) and **reusability/modularity** are table stakes. **Explicit foundational grounding** is the discriminator Griffo elevates to a defect when absent. The criterion almost nobody satisfies is **empirical validation**: UFO-L's controlled experiment — with reported comprehension gains when relations are reified — is the cluster's *only* hard evidence that a modelling choice helps real humans. The takeaway is opinionated: prefer the grounded, relation-reifying design not on aesthetics but because it is the one with measured ergonomics, and record your grounding so a future reviewer can audit it.

### Where the field went: standards and FOLIO

Research ontologies matured into interchange standards, and these are what you actually integrate against — as import/export formats, not internal models.

- **LegalRuleML** (OASIS Core Spec v1.0, 2021, https://www.oasis-open.org/committees/legalruleml/) — the intermediate language between legal text and executable logic: deontic operators, defeasibility, metadata. The DAPRECO GDPR KB (966 reified I/O-logic rules) is the largest open corpus. Treat it as a rule-layer wire format, never as beep's static schema.
- **Akoma Ntoso / LegalDocML** (OASIS, http://www.akomantoso.org/) — FRBR-based Work/Expression/Manifestation/Item markup with `eId` fragment identifiers for legislative and judicial documents. The TS-facing renderer is Laws.Africa's `@lawsafrica/law-widgets`.
- **ELI / ECLI** (https://eur-lex.europa.eu/eli-register/about.html) — the European Legislation and Case Law Identifiers, ELI being OWL over FRBR/SKOS/Dublin Core. Adopt ELI as the IRI scheme for legislation and resolve citations to ECLI under a closed scheme union.
- **LKIF-Core** (CC-BY OWL) — still worth mining for its class taxonomy, but align *outward* via `skos:exactMatch` rather than copying its OWL wholesale; its deontic flattening is exactly what we want to avoid inheriting.
- **FOLIO** (ALEA Institute, CC-BY, https://folio.openlegalstandard.org/) — 18,000+ concepts across 24 top-level branches with opaque stable IRIs, SKOS labels, and a W3C Web Annotation (`oa:`) extraction model driven by a state machine (preliminary→confirmed/rejected/backup) over append-only `StageEvent` lineage. It is the closest existing reference to beep's whole stack and the obvious candidate to import as the legal-*concept* vocabulary.

The synthesis the rest of this guide builds on: ground deliberately (UFO/gUFO for relators, recorded explicitly), import UFO-L's relational pattern and FOLIO's vocabulary, and keep the standards at the boundary. With the building surveyed, we can move inside — to the primitives every one of these families had to model, and how they should look as beep schemas.

## 3. The Conceptual Core Every Legal Ontology Needs

### Sources: three faces of one document

Start with the most concrete thing in law and the easiest to get wrong: the source. A statute, a regulation, an opinion - each is simultaneously a physical artifact, a string of language, and a bearer of normative content. LRI-Core and the frame-based tradition (Van Kralingen & Visser) both insist on this three-perspective split, and FRBR operationalizes it: a `Work` (the abstract creation), an `Expression` (a given linguistic realization - a language version, a consolidated text at a point in time), a `Manifestation`, and an `Item`. Akoma Ntoso (LegalDocML) marks this up directly; ELI projects it onto an OWL/SKOS vocabulary for legislation, and ECLI does the same for case law. The non-negotiable engineering consequence is that *identity lives on the Expression, not the Work*: "Section 103" means nothing until you pin which consolidated version was in force. So sources get branded scheme identifiers, never `S.String`.

```ts
const ECLI = S.String.pipe(S.pattern(/^ECLI:[A-Z]{2}:.+/), S.brand("ECLI"));
const ELI = S.String.pipe(S.brand("ELI"));
const CELEX = S.String.pipe(S.brand("CELEX"));
const SourceId = LiteralKit(["ECLI", "ELI", "CELEX"]).toTaggedUnion("scheme")({
  ECLI: { value: ECLI }, ELI: { value: ELI }, CELEX: { value: CELEX },
});

const FrbrLevel = LiteralKit(["work", "expression", "manifestation", "item"])
  .pipe($I.annoteSchema("FrbrLevel", {
    description: "Identity and version-selection bind at the expression level.",
  }));
```

This is the substrate the following IP section builds patents and prosecution histories on; it does not need restating there.

### Norms: fact → norm → effect, and the rule-as-object

Every reviewed core ontology converges on one schema for a norm: it *describes a generic fact* and *ascribes a generic effect*. The deepest distinction is **regulative vs. constitutive** (CLO/Gangemi, Boella et al., echoing Searle). A regulative norm prescribes behavior and can be *violated*; a constitutive norm modifies institutional reality - it says what *counts as* what - and can only be *void*, never violated. Encode that asymmetry in the type, because "violable" and "voidable" are different lifecycles downstream:

```ts
const Norm = LiteralKit(["constitutive", "regulative"]).toTaggedUnion("normKind")({
  constitutive: { describesFact: SituationPattern, ascribesEffect: LegalQualification, voidable: S.tag(true) },
  regulative:   { describesFact: SituationPattern, modality: DeonticModality, normSubject: LawPractice.PartyId, violable: S.tag(true) },
}).pipe($I.annoteSchema("Norm", {
  description: "Constitutive = void-able institutional fact; regulative = violable behavioural directive.",
}));
```

The second principle is **rule-as-object** plus the **rules/sources isomorphism**: the abstract norm, the binding textual provision, and the formalized executable rule are three distinct artifacts in an N:M relation, joined by URI reference, never nested. Palmirani's "Fill the Gap" work is the sharpest treatment; LegalRuleML is the interchange format for it. The textual provision is the *only binding artifact*; the rule is a fallible formalization of it; the norm is the Kelsenian abstraction over many provisions. Collapse them and you can never explain a consolidation, a re-numbering, or a disputed interpretation.

```ts
const ProvisionUri = S.String.pipe(S.brand("AkomaNtosoEId"));
class NormProvisionRuleLink extends S.Class<NormProvisionRuleLink>($I`NormProvisionRuleLink`)({
  normRef: NormId, provisionRef: ProvisionUri, ruleRef: RuleId,
  role: LiteralKit(["derives", "elaborates", "splits", "merges"]),
}) {}
```

Norms also evolve. As "Legal Rules, Text and Ontologies Over Time" stresses, amendment, repeal, and derogation mean the *same* norm carries different content across versions; Fornara & Colombetti's work on the evolution of obligations and prohibitions shows the deontic content itself mutates as institutional events fire. Hence no norm is complete without a validity envelope (see Time below).

### Deontic modalities: closed, and directed

The fundamental qualifications are **obligation, prohibition, permission** - and, following Hohfeld, **power** as a distinct second-order modality. This is a closed domain; model it as one union and resist the urge to let epistemic or alethic modality leak in.

```ts
const DeonticModality = LiteralKit(["obligation", "prohibition", "permission", "power"])
  .pipe($I.annoteSchema("DeonticModality", {
    description: "Closed deontic domain; distinct from epistemic modality.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "vocabularyTerm", canonicalName: "DeonticModality",
      canonicalIri: "https://docs.oasis-open.org/legalruleml/ns/v1.0/#", preferredPrefix: "lrml",
      // align members individually: obligation->#Obligation, prohibition->#Prohibition, permission->#Permission;
      // 'power' maps to a potestative/Hohfeld (gufo) term, NOT a deontic operator
    }),
  }));
```

The subtle point the literature insists on (and LKIF-Core fumbles by flattening into OWL-DL `allows`/`disallows`) is the **directed vs. undirected** split. An undirected obligation is "one ought to φ"; a directed obligation is "A owes φ *to* B." Directed deontics are exactly what Hohfeld's correlatives capture, and they cannot be expressed as a monadic flag on a single party. This is the hinge into the relator pattern.

### Hohfeld's relations: the relator, not the flag

| First square | correlative | opposite |
|---|---|---|
| Right | Duty | No-right |
| Privilege | No-right | Duty |
| **Second square** | | |
| Power | Liability | Disability |
| Immunity | Disability | Liability |

The first square governs primary conduct; the second governs *changes to legal positions themselves* - a power operates *on* another relation. The 2023 DKE paper on legal powers, subjections, disabilities and immunities (Griffo et al.) is the one that models this second-order layer properly, and the legal-relations-pattern work supplies the reusable shape.

The cross-cutting insight - the single most important architectural commitment in this whole document - is **UFO-L's**: a legal relation is a **relator**, a reified, identity-bearing entity that `mediates` ≥2 agents-in-roles and bundles the *correlative pair* as modes inhering in one party and externally depending on the other. This inverts the norm-centric tradition. Because the relator already bundles both sides, the correlative position is read off the same record — the holder bears the active Hohfeldian position, the counterparty the correlative one (Francesconi: `ImplicitRight ≡ ExplicitDuty`) — rather than stored as a separate converse. UFO-L's controlled experiment is the cluster's only empirical evidence that this reification improves comprehension. In beep it directly displaces today's opaque `*FixtureKey: S.String` links.

```ts
const LegalRelator = LiteralKit(["RightDuty", "PrivilegeNoRight", "PowerLiability", "ImmunityDisability"])
  .toTaggedUnion("kind")({
    RightDuty:         { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, object: ActionOrOmission },
    PrivilegeNoRight:  { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, object: ActionOrOmission },
    PowerLiability:    { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, overRelator: RelatorId },
    ImmunityDisability:{ holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, overRelator: RelatorId },
  })
  .pipe(
    S.filter((r) => r.holder !== r.counterparty, { message: () => "relator requires ≥2 distinct parties" }),
    $I.annoteSchema("LegalRelator", { description: "Project to gufo:Relator + gufo:mediates." }),
  );
// correlative read off the same relator: holder = active position, counterparty = correlative (no party-swap)
```

### Agents, roles, powers, institutions

Agents are **rigid** identity-bearers; roles are **anti-rigid**, relator-scoped, time-bounded classifiers an agent *plays* (UFO-L, LRI-Core, PrOnto). "Agents can act, roles cannot" - so responsibility attaches to the agent, never the role, and roles live on the relation rather than as `Person` subclasses. A legal person is just an agent the system recognizes as a position-bearer.

```ts
const RoleKind = LiteralKit(["inventor", "assignee", "applicant", "examiner", "attorney",
  "licensor", "licensee", "plaintiff", "defendant", "judge"]);
class RolePlaying extends S.Class<RolePlaying>($I`RolePlaying`)({
  agent: LawPractice.PartyId, role: RoleKind,
  withinRelator: S.OptionFromOptionalKey(RelatorId), // verify in @beep/schema; otherwise S.optionalWith(RelatorId, { as: "Option" })
  institution: S.OptionFromOptionalKey(InstitutionId), validity: TimeInterval,
}) {}
```

**Institutional facts** are Searle's *count-as*: X counts as Y in context C. Valente folds this into his framework, and LKIF-Core/CLO model the qualifying step explicitly. A **power** is the second-order capacity to create, change, or extinguish a relation via a typed institutional act; an act met by an opposing *disability* is `void`, not merely ineffective.

### Facts, acts, events, cases, qualification

Marmor's *Ontology of Legal Facts* draws the line the whole stack rests on: **a fact about a norm is not itself a normative fact.** A stored statute record is descriptive data; deontic activation is an explicit derived step. Indeterminacy is first-class - `Determinate | NegativeFact | NoFactOfTheMatter` - so "no rule on point" is a value, not a null.

Qualification is the **counts-as** relator linking a brute fact to its institutional description ("A kills B" → "A murders B"; a deposit of papers → a patent application) under a qualifying norm. Sartor's `do(action)` / `bring(effect)` split keeps the act distinct from its consequence; events are instants, situations are intervals.

```ts
const Fact = LiteralKit(["FactAboutNorm", "NormativeFact"]).toTaggedUnion("kind")({
  FactAboutNorm: { norm: NormId }, NormativeFact: { ought: DeonticModality },
});
class CountsAs extends S.TaggedClass<CountsAs>()("CountsAs", {
  physical: FactRef, institutional: InstitutionalActId, qualifyingNorm: NormId, context: ContextRef,
}) {}
```

### Time: validity, applicability, efficacy, derogation

This is the least-solved problem, and Palmirani gives the sharpest model: three *orthogonal* legal axes - **enforceability** (in force), **efficacy** (producing effects, possibly retroactively), and **applicability** (which version governs a given case) - over and above ordinary **transaction time**. Retroactivity, annulment, and forked timelines defeat Allen interval logic, so the substrate must be **multi-temporal**. Marmor's guardrail makes `(legalSystemId, validity-interval)` mandatory on every legal fact: truth is only ever asserted under a closed "system S at time t" prefix. Derogation (lex superior / specialis / posterior) is then a relation between norms, not a deletion.

```ts
class TimeInterval extends S.Class<TimeInterval>($I`TimeInterval`)({
  from: S.DateTimeUtc, to: S.OptionFromOptionalKey(S.DateTimeUtc),
}) {}
class LegalValidity extends S.Class<LegalValidity>($I`LegalValidity`)({
  legalSystem: S.String.pipe(S.brand("LegalSystemId")),
  enforceability: TimeInterval, efficacy: TimeInterval,
  applicability: S.OptionFromOptionalKey(TimeInterval), transactionTime: TimeInterval,
}) {}
```

### World-knowledge vs. legal-knowledge

Finally, FOLaw's durable contribution: separate **world knowledge** (the brute facts and causal/commonsense structure of the domain) from **legal knowledge** (the normative qualifications layered over it). A patent's technical content, a chemical reaction, "who paid whom" - that is world knowledge; "infringes," "owes," "is liable" is legal knowledge that *attaches* to it. Keep these in distinct schema modules tagged by `OntologyLayer`, with a one-way dependency rule: legal-knowledge schemas may reference world-knowledge identifiers, never the reverse. (Heed Breuker & Hoekstra's caveat that FOLaw's six categories are *reasoning roles*, not terminology - so keep that epistemic layer out of the clean RDF terminological core.) These eight primitives - sourced, normed, deontic, relational, role-bearing, qualified, time-indexed, and layered - are the reusable bricks; the next section pours them into the mold of IP and patent practice.

## 4. Modeling IP & Patent Practice — The Ontology beep-effect Actually Needs

A USPTO prosecution practice is the ideal proving ground for everything the previous section established, because it is small enough to model exhaustively yet it exercises *every* core construct: a rejection is a normative qualification, a prior-art citation is an evidential relation, an office action is a speech act carrying deontic force, and a continuation is a historical-dependence relation between documents. Tom Oppold's book of business - planters for Precision Planting, demolition shears for Genesis Attachments, combine sensors for Headsight - is technologically diverse but procedurally uniform. Model the procedure well and the technology is just CPC metadata. So the domain layer's job is not to invent new primitives; it is to *specialize* the reusable core into the handful of patent universals that recur across every IP ontology in the literature.

### The entities that recur (and the ones beep already has)

Strip the applied patent-document ontologies down and the same skeleton appears in all of them. The table below maps that recurring vocabulary onto beep's real `law-practice` entities and onto the core construct each one specializes.

| Recurring universal | Ontology sources | beep today | Core construct it specializes |
|---|---|---|---|
| Patent / Application | (PATExpert), (PMO), (US patent system ontology), (ALIS IP) | `PatentAsset` | a *document-constituted* object, not a naïve owned continuant (regulation-of-IP / Peukert) |
| Claim | (PATExpert), (OWL patent IR), (patent-KG) | `Claim` | the legal-effect-bearing fragment; ownership of a *type* whose tokens infringe (Wilson) |
| Prior art / Citation | (patent-system retrieval ontology), (IP entities & relations), (patent-KG) | `PriorArtReference` | an **evidential** relation |
| Inventor / Assignee / Examiner | (US patent system ontology), (IP entities & relations) | *absent* (`LegalContactRole` = `"founder"` only) | anti-rigid **Role** on a rigid Agent (UFO-L) |
| Rejection §101/§102/§103/§112 | (US patent system ontology), (critique-of-IP-ontology) | `Rejection` + `RejectionGround` | a **normative qualification** (counts-as) |
| Office action | (ALIS IP), (US patent system ontology) | `OfficeAction` | an institutional **speech act** with deontic force |
| CPC / IPC classification | (PATExpert), (OWL patent IR) | *absent* | a SKOS **Concept** |
| Continuation / family | (US patent system ontology), INPADOC | *absent* | historical-dependence between Expressions |

The two glaring absences - a real Agent/Role layer and classification - are exactly where the applied patent ontologies are thin and where the product target is most demanding (Oppold must be one identity across an OED number, two bar numbers, and a PatentsView `attorney_id`).

### Specializing the core: a rejection is not a row, it's a normative act

beep's `RejectionGround` is already the richest construct in the codebase - a `LiteralKit(["101","102","103","112"]).toTaggedUnion("statute")` that encodes prior-art cardinality in the type (§102 = one reference, §103 = many plus a rationale). That instinct is correct; it is under-built. A rejection participates in three distinct core constructs at once, and each deserves first-class structure.

#### The office action as a deontic speech act

Mailing an office action is Sartor's `do(action)`; its *effect* - `bring(effect)` - is a regulative norm: the applicant now bears an obligation to respond within a shortened statutory period, hard-capped at six months (35 U.S.C. §133). Whether the action is `final` changes the applicant's downstream *permissions* (after final, the menu narrows to RCE, appeal, or abandonment). That is deontic content, not a date column.

```ts
// illustrative — packages/law-practice/domain/src/entities/OfficeAction
const OfficeActionKind = LiteralKit(["non_final", "final", "restriction", "notice_of_allowance", "advisory"]);

class ResponseDuty extends S.Class<ResponseDuty>($I`ResponseDuty`)({
  modality: DeonticModality,                 // "obligation" — closed deontic union from the core slice
  bearer: LawPractice.PartyId,               // attorney/applicant of record (Role layer, see below)
  shortenedPeriod: S.DurationFromMillis,     // 3mo default
  statutoryBar: S.DateTimeUtc,               // 6mo hard cap (§133) — a LegalValidity deadline
  options: S.NonEmptyArray(LiteralKit(["amend", "argue", "rce", "appeal", "abandon"])),
}) {}
// OfficeAction.fields gains: { kind: OfficeActionKind, mailedOn: S.DateTimeUtc, responseDuty: ResponseDuty }
```

This is where the three-valued closure from the core earns its keep: a missed `statutoryBar` is a *deadline violation*, which OWL's open-world assumption cannot detect. The duty must be checked under closed-world (Schema/SHACL) validation, not inferred.

#### The rejection as a normative qualification + relator

The qualification "claim 1 counts-as unpatentable, in system USPTO at time t" is a `CountsAs` instance whose `qualifyingNorm` is the cited statute. Reify it. Replace the opaque `claimFixtureKey`/`officeActionFixtureKey` strings with a relator that *mediates* the office action, the claim, and the examiner's role, and carries its own ground - projecting cleanly to `gufo:Relator` + `gufo:mediates`. While we are here, fix the two grounds the literature flags: §112 is not one thing, and §102 must carry the limitation-to-disclosure mapping that makes the rejection auditable.

```ts
// illustrative — extends the real RejectionGround (Rejection.values.ts)
const AnticipationMapping = S.Array(S.Struct({
  limitation: S.NonEmptyString,
  reference: LawPractice.PriorArtReferenceId,
  disclosure: EvidenceSpan,                  // TextAnchor + AlignmentStatus + Confidence
}));

const RejectionGround = LiteralKit(["101", "102", "103", "112"]).toTaggedUnion("statute")({
  "101": { category: LiteralKit(["abstract_idea", "natural_phenomenon", "law_of_nature"]) },
  "102": { reference: LawPractice.PriorArtReferenceId, mapping: AnticipationMapping },
  "103": {
    references: S.NonEmptyArray(LawPractice.PriorArtReferenceId),
    combinationRationale: S.NonEmptyString,  // KSR rationale
    motivationToCombine: EvidenceSpan,
  },
  "112": { defect: LiteralKit(["written_description", "enablement", "definiteness", "new_matter"]) }, // note: new_matter rejections are grounded in 35 U.S.C. §132 / §112(a), not generic §112
});

class RejectionOfClaim extends BaseEntity.Class<RejectionOfClaim>($I`RejectionOfClaim`)(
  LawPractice.RejectionId,
  {
    fields: {
      officeAction: LawPractice.OfficeActionId,   // branded ref, not a string fixtureKey
      claim: LawPractice.ClaimId,
      raisedBy: ExaminerRole,                      // anti-rigid Role, not a Person subclass
      ground: RejectionGround,
      qualification: LiteralKit(["rejected", "objected", "allowed", "withdrawn"]),
    },
    persisted: { ground: EntitySchema.persist.jsonb({ columnName: "ground" }) /* ... */ },
  },
  $I.annote("RejectionOfClaim", {
    description: "Reified examiner rejection: a normative qualification of a claim under a statutory ground.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "ontologyConstruct", canonicalName: "RejectionOfClaim",
      canonicalIri: "https://beep.dev/ip#RejectionOfClaim", preferredPrefix: "ip",
    }),
  })
) {}
```

#### Prior-art citation as an evidential relation, and the Distinction as a defeater

A citation is not a foreign key; it is evidence with polarity. `PriorArtReference` stays an entity, but the *anticipates* / *renders-obvious* edges live in the ground's `EvidenceSpan`-grounded mapping above - and the applicant's response becomes a **defeater** with explicit polarity, lifecycle-gated through the shared `ClaimLifecycle`. This is the codebase's `Distinction`, upgraded from a single `missing_limitation` kind into an undercutting argument the publishing gate can reason about.

```ts
// illustrative — Distinction-overcomes-Rejection as a polarised defeater
const RebuttalPolarity = LiteralKit(["distinguishes", "teaches_away", "unexpected_results", "secondary_consideration"]);
// Distinction.fields: { rejection: LawPractice.RejectionId, claim: LawPractice.ClaimId,
//   polarity: RebuttalPolarity, anchor: TextAnchor, lifecycleState: ClaimLifecycle }
```

Note what the role player demands: `ExaminerRole`, `PartyId`, and inventor/assignee/attorney roles do not exist in `law-practice` today (the only `LegalContactRole` is `"founder"`). Per UFO-L, these are anti-rigid roles on rigid agents - one Oppold identity plays `attorney` across thousands of matters - so they belong on the relator, never as `Person` subclasses. That Agent/Role slice is the highest-value addition this section implies.

### Classification, identity, and interop

The patent document itself wants ELI/ECLI-style treatment. A granted patent and its pre-grant publication are two FRBR Expressions of one invention disclosure (Work); an Akoma-Ntoso-style `eId` names claim 1 as a fragment of the granted Expression. So patent identity is a closed branded scheme union, decoded at the ingestion boundary and never `as`-cast.

```ts
// illustrative — patent document identity as a closed branded scheme (the ECLI/ELI analog)
const UsPatentNumber = S.String.pipe(S.pattern(/^US\d{7,8}[A-Z]\d?$/), S.brand("UsPatentNumber"));
const UsPublicationNo = S.String.pipe(S.pattern(/^US\d{11}[A-Z]\d$/), S.brand("UsPublicationNo"));
const UsApplicationNo = S.String.pipe(S.pattern(/^\d{2}\/\d{6}$/), S.brand("UsApplicationNo"));
const PatentDocId = S.Union([UsPatentNumber, UsPublicationNo, UsApplicationNo]); // closed scheme; decode dispatches by pattern

const CpcSymbol = S.String.pipe(S.pattern(/^[A-HY]\d{2}[A-Z]\s?\d+\/\d+$/), S.brand("CpcSymbol")); // e.g. A01C 7/00 (planters); CPC also has a 'Y' section
```

CPC and IPC are not strings - they are SKOS Concepts in a `ConceptScheme`, mapped through `@beep/rdf/Vocab/Skos` (`skos:inScheme`, `skos:broader`), which is exactly why a planter classification can resolve up the CPC hierarchy without a bespoke taxonomy. The external feeds bind by source, decode-at-boundary: WIPO **ST.96** XML and the consolidated **data.uspto.gov** ODP (mandatory mid-2026) supply the patent/PTAB/assignment records; **PatentsView**'s `/patent/attorney` yields the disambiguated `attorney_id` that, with the OED registration number and bar numbers, anchors the multi-ID Attorney identity; **CourtListener** dockets and PTAB control numbers become branded `CaseId`/`ProceedingId` for the litigation and IPR slices. Every such fact carries `(legalSystemId, validity-interval)` and an `AssertionProvenance` whose `VerificationStatus` gates publication - only `verified` nodes reach the public `/patents` and `/cases` pages.

This is precisely the 15-node / 11-edge model the `goals/ip-law-knowledge-graph` SPEC sketches but has not built (`Norm`, `LegalProvision`, `Jurisdiction`, `ClassificationCode`, `Expression`, `Judgment`). The relators and grounds above *are* those nodes, expressed schema-first so Oxigraph's OWL layer and the rebuilt FalkorDB read model derive from one source of truth rather than drifting apart. How those annotated schemas actually become Turtle, OWL axioms, and SHACL shapes - the generic projector - is the next section's job.

## 5. From Ontology to Types & Schemas — The Translation Playbook

The previous section told you *what* the ontology needs: reified legal relations, deontic positions, a norm/provision/rule tri-layer, validity over time. This section is the lookup table you reach for when you sit down to type it. Each entry maps one ontological construct to a concrete Effect Schema pattern in beep-effect's idiom, with the real symbols you already have in `@beep/identity`, `@beep/schema`, `@beep/rdf`, and the epistemic slice. The next section spends this playbook on an actual legal core schema; here we just sharpen the tools. The through-line: **types encode what is closed and stable, data carries what grows, annotations carry the RDF projection, and rules carry what defeats.** Confuse those four and you will either drown in `as unknown as` casts or hard-code a statute into a union you can never amend.

### Identity first: branded IDs and minted IRIs

Every legal fact is jurisdiction- and time-indexed (Marmor's closed `system S at time t` prefix), and every node you publish needs a stable, opaque IRI decoupled from its label (the FOLIO discipline — labels are SKOS annotations, never keys). So identity is two layers: a branded *internal* id and a minted *external* IRI.

```ts
import * as S from "effect/Schema"
import { EntityId } from "@beep/identity"
import { IRI, makeNamedNode, type NamedNode } from "@beep/rdf"

// Internal: branded entity id (the LawPractice.* registry idiom)
export const NormId = EntityId.factory("legal_norm", $I)

// External standard schemes as a closed branded union
export const ECLI = S.String.pipe(S.pattern(/^ECLI:[A-Z]{2}:.+/), S.brand("ECLI"))
export const ELI = S.String.pipe(S.brand("ELI"))
export const StandardId = S.Union([ECLI, ELI]) // closed scheme union; decode dispatches by pattern

// IRI minting: decode at the boundary, NEVER `as unknown as IRI`
const BASE = "https://beep.dev/ip#"
const node = (local: string): NamedNode => makeNamedNode(S.decodeSync(IRI)(`${BASE}${local}`))
```

The hard rule (learned the hard way from effect-ontology's branding leaks): brand the IRI end-to-end and decode at the boundary. The moment you cast, your `serializeQuad` output is no longer trustworthy.

### Taxonomies as closed unions — and knowing when to keep them open

`LiteralKit` is the universal closed-domain idiom. It hands you `.Enum`, `.Options` (canonical order), `.is.<member>` guards, and `.toTaggedUnion(tag)` for free. Use it for genuinely closed, type-governing domains — statute sections, deontic modalities, role kinds.

```ts
import { LiteralKit } from "@beep/schema"

export const RejectionStatute = LiteralKit(["101", "102", "103", "112"]).pipe(
  $I.annoteSchema("RejectionStatute", { description: "Closed §-section domain." })
)
// RejectionStatute.is["102"](x), RejectionStatute.Enum, RejectionStatute.Options
```

But not every taxonomy belongs in the type system. The decision is **closed (type) vs open (data)**: if the domain is small, stable, and you want exhaustiveness checking at compile time, make it a `LiteralKit`. If it is large, governed externally, or grows by ingestion — FOLIO's 18,000 concepts, IPC/CPC classes, the set of jurisdictions — model it as branded IRIs into a SKOS `ConceptScheme` and let the membership live in data, aligned via `skos:broader`/`skos:exactMatch`. Enumerating 18k concepts as a string union is how you get a 40-second `tsc` and a union nobody can read. The litmus test: *can a non-engineer need to add a member without a deploy?* If yes, it is data.

### Modalities and norm kinds as tagged unions you `Match` on

Closed legal variants become discriminated unions, and you branch on them with `Match`, never `if/else` chains. Encode cardinality and shape differences *in the type* the way `RejectionGround` already encodes prior-art cardinality per statute (§102 = one reference, §103 = ≥1 + rationale).

```ts
const DeonticModality = LiteralKit(["obligation", "prohibition", "permission", "power"])

export const Norm = LiteralKit(["constitutive", "regulative"]).toTaggedUnion("normKind")({
  constitutive: { describesFact: SituationPattern, ascribesEffect: LegalQualification },
  regulative: { describesFact: SituationPattern, modality: DeonticModality, subject: PartyId },
})

import * as Match from "effect/Match"
export const ascribe = Match.type<typeof Norm.Type>().pipe(
  Match.discriminator("normKind")("regulative", (n) => activateDuty(n.subject, n.modality)),
  Match.discriminator("normKind")("constitutive", (n) => qualify(n.ascribesEffect)),
  Match.exhaustive, // constitutive norms are void-able, regulative ones violable — the split is structural
)
```

`Match.exhaustive` is the payoff: add a fifth modality and every fold fails to compile until you handle it. Use `Match.discriminator(field)` for `LiteralKit.toTaggedUnion` tags (which name their own discriminant), reserving `Match.tag` for `_tag`-keyed `S.TaggedStruct` unions.

### Hohfeldian correlatives as a relator struct

This is the keystone (UFO-L). A legal relation is **not** a monadic flag on a party — it is a reified relator that mediates two parties-in-roles and bundles a correlative pair of positions. Model it as a tagged struct over the four Hohfeldian squares, enforce the "≥2 distinct parties" rule with a `Schema.filter`, and *read the correlative off the same relator* — the holder bears the active position, the counterparty the correlative (Francesconi: `ImplicitRight ≡ ExplicitDuty`) — rather than storing the converse twice.

```ts
export const LegalRelator = LiteralKit([
  "RightDuty", "PrivilegeNoRight", "PowerLiability", "ImmunityDisability",
]).toTaggedUnion("kind")({
  RightDuty: { holder: PartyId, counterparty: PartyId, object: ActionOrOmission },
  PrivilegeNoRight: { holder: PartyId, counterparty: PartyId, object: ActionOrOmission },
  PowerLiability: { holder: PartyId, counterparty: PartyId, overRelator: RelatorId },
  ImmunityDisability: { holder: PartyId, counterparty: PartyId, overRelator: RelatorId },
}).pipe(
  S.filter((r) => r.holder !== r.counterparty, { message: () => "relator requires >=2 distinct parties" }),
  $I.annoteSchema("LegalRelator", { description: "Reified legal relation; projects to gufo:Relator + gufo:mediates." })
)

// one source of truth: both Hohfeldian positions live on the SAME relator —
// holder bears the active position, counterparty the correlative; no party-swap, no duplicated row
export const activePosition = (r: typeof LegalRelator.Type) => r.holder
export const correlativePosition = (r: typeof LegalRelator.Type) => r.counterparty
```

The second Hohfeldian square (power/liability, immunity/disability) is exactly why `overRelator: RelatorId` exists — powers operate *on other relations* (UFO-L 2023). This is the construct that replaces beep's opaque `*FixtureKey: S.String` strings, and it projects cleanly to `gufo:Relator` + `gufo:mediates` (https://nemo-ufes.github.io/gufo/).

### Deontic positions and norm lifecycle as state machines

A relator (and a patent claim) has a lifecycle ordered by historical dependence. Mirror the epistemic slice's proven shape exactly: a `LiteralKit` of states, a pure transition *value object* that records but does not authorize, a service that authorizes, and a single `S.TaggedError` for the illegal step. Status is the **fold of an event log**, never a stored attribute (Sartor's do/bring split).

```ts
export const ProsecutionStatus = LiteralKit([
  "filed", "under_examination", "issued", "lapsed", "withdrawn", "revoked",
])

export class IllegalProsecutionStep extends S.TaggedError<IllegalProsecutionStep>($I`IllegalProsecutionStep`)(
  "IllegalProsecutionStep", { from: ProsecutionStatus, to: ProsecutionStatus }
) { static between = (from: any, to: any) => new IllegalProsecutionStep({ from, to }) }

// reducer over a chronologically-ordered LegalEvent log -> current status
export const statusOf = (events: ReadonlyArray<typeof LegalEvent.Type>): typeof ProsecutionStatus.Type => ...
```

This is the `ClaimLifecycle` → `ClaimTransition` → `ClaimInvalidTransition` triad, reused. Rejection of a *transition* is an error; rejection of a *claim* is a value (next pattern).

### OntoUML stereotypes as schema shapes

OntoUML's stereotypes are a ready-made decision table for *where* a concept goes (lessons from ontouml-js, https://github.com/OntoUML/ontouml-js). The anti-rigid ones are where engineers most often go wrong — **a role is never a `Person` subclass**; it is a field on the relator.

| Stereotype | Nature | Effect Schema pattern |
| --- | --- | --- |
| **kind** | rigid, supplies identity | `BaseEntity.Class` + branded id |
| **subkind** | rigid specialization | discriminant field in a `toTaggedUnion` |
| **phase** | anti-rigid, intrinsic change | `LiteralKit` state + transition VO |
| **role** | anti-rigid, relational | a `RolePlaying` field on the relator, time-bounded |
| **relator** | reified relation | `TaggedStruct` mediating ≥2 ids (above) |
| **mode / quality** | inhering trait | nested value object (`Confidence` = `UnitInterval`) |

Enforce the invariants the way ontouml-js does in its linter: identity fields `readonly`/immutable, `mediates ≥ 2` as a `Schema.filter`, roles attached to relations not entities. "Agents can act, roles cannot" — responsibility attaches to the rigid `kind`, not the anti-rigid role.

### Annotations are the RDF bridge

beep already carries the mechanism: `SemanticSchemaMetadata` rides on a typed `effect/Schema` annotation and is read back by `getSemanticSchemaMetadata` walking the AST. Make it load-bearing — one schema is the source of truth for types, persistence, *and* ontology.

```ts
import { makeSemanticSchemaMetadata } from "@beep/rdf"

const meta = makeSemanticSchemaMetadata({
  kind: "ontologyConstruct",
  canonicalName: "PatentApplication",
  canonicalIri: "https://beep.dev/ip#PatentApplication",
  preferredPrefix: "ip",
  representations: [{ kind: "Turtle" }, { kind: "JSON-LD" }, { kind: "JSON Schema" }],
})
// attach via $I.annote("PatentApplication", { description, semanticSchemaMetadata: meta })
```

The honest caveat: today `representations` is *descriptive only*. The carry-and-read trio (`makeSemanticSchemaMetadata` / `annotateSemanticSchema` / `getSemanticSchemaMetadata`) and the deterministic `serializeQuad` emitter exist; the generic projector — the planned `@beep/ontology` `Ont.projectTurtle` / `toJsonLD` / `projectJsonLdContext` — does not yet. That projector (consume `getSemanticSchemaMetadata`, fan out to `serializeQuad`, Turtle/N-Triples first) is the single highest-leverage build. And align *outward*: emit `skos:exactMatch` to FOLIO (https://folio.openlegalstandard.org) and LKIF-Core IRIs rather than copying their OWL.

### Validation as a gate that returns a verdict

Closed-shape data entry is a closed-world problem; OWL's open-world assumption cannot detect a missing deadline. So split the world (the OWA-inference vs CWA-validation split): OWL/RDF for *inference*, SHACL + `Schema.filter` for *validation*. Mirror `ClaimGate` precisely — the gate returns a tagged verdict where **rejection is a value, not an error**, and engine failure is a defect.

```ts
export const LicenseVerdict = LiteralKit(["admitted", "rejected"]).toTaggedUnion("verdict")({
  admitted: {},
  rejected: { violations: S.Array(ClaimGateViolation) },
})

// the IPROnto invariant as a refinement: a licensee must NOT become a rights-holder
const license = base.pipe(S.filter(
  (a) => a.kind === "Contract" || !makesRightsHolder(a.licensee),
  { message: () => "licensee must not become a rights holder" }
))
```

Cross-field invariants (the license/contract rule, interval well-ordering, `holder !== counterparty`) are `Schema.filter` refinements when local, SHACL node shapes (https://www.w3.org/TR/shacl/) when graph-scoped. Keep RDF terms inside the gate; project violations to product-agnostic primitives before they cross back into domain language.

### The hard part: what you must NOT freeze into types

A closed type system is the wrong home for the three things that make law *law*. Force them in and you will be shipping a migration every time a court rules.

- **Open texture** (McCarty's LLD prototype-and-deformation). "Obviousness," "abstract idea," "written description" are not closed enums of necessary-and-sufficient conditions. Model them as an *extensible set of exemplars + transformations in data* — factor records with provenance — not a union you have to widen.
- **Defeasibility** (Alexy, Palmirani). Reasoning is non-monotonic: `lex superior`/`specialis`/`posterior` override conclusions. This is a **rule layer** (LegalRuleML, https://www.oasis-open.org/committees/legalruleml/), not a subtype lattice. Encode the `SuperiorityRelation` as *data the rule engine consumes*, not as static schema constraints — OWL-DL cannot represent it faithfully and neither can a TypeScript union.
- **Vagueness and degree.** Alexy's principles are satisfiable *to a degree*. That is a branded `UnitInterval` (`FulfilmentDegree`) computed at runtime, not a boolean.
- **Indeterminacy** (Marmor). Truth is three-valued: `Determinate | NegativeFact | NoFactOfTheMatter`. And the cut that catches everyone — **a fact about a norm is not a normative fact.** A stored statute record is descriptive data; deontic activation is an explicit derived step, never an automatic `ought` that falls out of decoding a row.

### Rules of thumb: type vs data vs annotation vs rule

- **Type** it when the domain is closed, small, and stable, and you want compile-time exhaustiveness: modalities, statute sections, lifecycle states, relator kinds, scheme unions. `LiteralKit` + `toTaggedUnion` + `Match.exhaustive`.
- **Data** it when membership grows without a deploy, is externally governed, or is contested: concept vocabularies (SKOS schemes), exemplars/factors for open-textured terms, instances (A-Box), superiority relations. Branded IRIs in, not unions.
- **Annotate** it when the fact is *about the schema's projection*, not its values: canonical IRI, preferred prefix, `skos:exactMatch` alignments, representation targets. Lives in `SemanticSchemaMetadata`, read by AST walk, emitted by the projector.
- **Rule** it when the conclusion can be *defeated*: exceptions, priorities, non-monotonic inference, degree-of-fulfillment, counts-as qualification under context. Route to a defeasible rule layer outside the static schema; keep its inputs as data and its verdicts as values.

Two non-negotiables thread through all four: decode IRIs at the boundary (never cast), and stamp `(legalSystemId, validity-interval)` on every legal fact. Everything else is choosing the right column in this table.

## 6. A Legal Core Ontology for beep-effect — A Schema Sketch

The playbook handed you a verb list: brand the scalars, close the enums with `LiteralKit`, reify relations as relators, read correlatives off the one relator, hang the IRIs off annotations. This section spends those moves on an actual artifact — a minimal *legal core* expressed as Effect Schema modules that any legal vertical (patents today, GDPR or copyright later) can import without inheriting USPTO's vocabulary. I am sketching the package that does not exist yet: a candidate `@beep/legal-core`, sitting between the domain-agnostic `@beep/ontology` projector and the `law-practice` slice. Everything below is compiling-*plausible* and marked where it leans on symbols still on the roadmap (`@beep/ontology`, an expanded `Vocab/Owl`, `LegalValidity` in `foundation`).

### The core in seven modules

#### Identity first: branded sources on FRBR/ELI

A legal core that cannot name its sources is a toy. Start with branded scalars and an ELI-shaped (http://data.europa.eu/eli/ontology) source identity. The package mints its own identity composer, illustratively `$LegalCoreId`, exactly as `@beep/rdf` mints `$RdfId`.

```ts
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema"
const $I = $LegalCoreId.create("ids/Ids") // illustrative composer for the candidate package

export const NormId = S.String.pipe(S.brand("NormId"), $I.annoteSchema("NormId", { description: "Kelsenian norm identity (T-Box)." }))
export const RelatorId = S.String.pipe(S.brand("RelatorId"), $I.annoteSchema("RelatorId", { description: "Reified legal-relation identity." }))
export const LegalAgentId = S.String.pipe(S.brand("LegalAgentId"), $I.annoteSchema("LegalAgentId", {}))

// Closed identifier scheme union, FRBR-versioned. ECLI for case law, ELI for legislation.
export const ECLI = S.String.pipe(S.pattern(/^ECLI:[A-Z]{2}:.+/), S.brand("ECLI"))
export const ELI = S.String.pipe(S.brand("ELI"))
export const CELEX = S.String.pipe(S.brand("CELEX"))
export const StandardIdentifier = LiteralKit(["ECLI", "ELI", "CELEX"]).toTaggedUnion("scheme")({
  ECLI: { value: ECLI }, ELI: { value: ELI }, CELEX: { value: CELEX },
})

const FrbrLevel = LiteralKit(["work", "expression", "manifestation", "item"])
const SourceKind = LiteralKit(["legislation", "case_law", "regulation", "custom", "doctrine"])
```

`LegalSource` is the FRBR substrate that Akoma Ntoso and ELI both ride on — three perspectives (physical support / representational language / cognitive content) collapse here into a versioned work→expression chain. An *expression* `realizes` a *work*; that pointer is what lets PrOnto-style version selection pick the provision text in force at an event's instant.

```ts
const $I = $LegalCoreId.create("entities/LegalSource")
export class LegalSource extends S.Class<LegalSource>($I`LegalSource`)({
  level: FrbrLevel,
  kind: SourceKind,
  identifier: StandardIdentifier,                       // ELI/ECLI/CELEX, branded
  realizes: S.OptionFromOptionalKey(S.String),          // expression -> work id
  title: S.String,
}, $I.annote("LegalSource", {
  description: "FRBR-tiered legal source; ELI/ECLI work/expression identity.",
  semanticSchemaMetadata: makeSemanticSchemaMetadata({
    kind: "ontologyConstruct", canonicalName: "LegalSource",
    canonicalIri: "https://beep.dev/legal-core#LegalSource", preferredPrefix: "lc",
    representations: [{ kind: "Turtle" }, { kind: "JSON-LD" }],
    /* required overview/status/specifications/equivalenceBasis elided for brevity */
  }),
})) {}
```

#### Deontic positions and the Hohfeldian relator

This is the centerpiece, and it is where beep is most underbuilt: today `law-practice` links everything with opaque `*FixtureKey: S.String` strings and owns zero deontic constructs. The cross-cluster verdict (UFO-L) is unambiguous — **model deontic content as paired positions inside a relator, never as a monadic flag on a party.** So a `DeonticPosition` is a *mode*: it inheres in a bearer and externally depends on a counterparty.

```ts
const $I = $LegalCoreId.create("values/Deontic")
export const DeonticModality = LiteralKit(["obligation", "permission", "prohibition", "power"]).pipe(
  $I.annoteSchema("DeonticModality", {
    description: "Closed deontic domain; distinct from epistemic modality.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "vocabularyTerm", canonicalName: "DeonticModality",
      canonicalIri: "https://docs.oasis-open.org/legalruleml/ns/v1.0/#", preferredPrefix: "lrml", /* ... */
      // members aligned individually: obligation->#Obligation, prohibition->#Prohibition, permission->#Permission;
      // 'power' maps to a potestative/Hohfeld (gufo) term, NOT a deontic operator
    }),
  })
)
```

The relator itself is a closed tagged union over Hohfeld's four squares. Each branch mediates `holder` and `counterparty`; the first square carries an `object` (an action-or-omission), the *second* square — power/liability, immunity/disability — carries `overRelator`, because powers operate *on other legal relations* (UFO-L's 2023 treatment). Correlativity is not stored twice; both legs live on the same relator and the correlative is *read off it* — holder active, counterparty correlative (Francesconi: `ImplicitDuty ≡ ExplicitRight`) — which is what makes drift unrepresentable.

```ts
const $I = $LegalCoreId.create("values/HohfeldianRelation")
const mediated = { holder: LegalAgentId, counterparty: LegalAgentId, groundedIn: NormId, validity: LegalValidity } // LegalValidity from foundation
const ActionOrOmission = LiteralKit(["act", "omit"]).toTaggedUnion("mode")({ act: { description: S.String }, omit: { description: S.String } })

export const HohfeldianRelation = LiteralKit(["claim_duty", "privilege_noright", "power_liability", "immunity_disability"])
  .toTaggedUnion("square")({
    claim_duty:          { ...mediated, object: ActionOrOmission },
    privilege_noright:   { ...mediated, object: ActionOrOmission },
    power_liability:     { ...mediated, overRelator: RelatorId },
    immunity_disability: { ...mediated, overRelator: RelatorId },
  })
  .pipe(
    S.filter((r) => r.holder !== r.counterparty, { message: () => "relator must mediate >=2 distinct parties" }),
    $I.annoteSchema("HohfeldianRelation", {
      description: "Reified legal relation; projects to gufo:Relator with gufo:mediates.",
      semanticSchemaMetadata: makeSemanticSchemaMetadata({
        kind: "ontologyConstruct", canonicalName: "HohfeldianRelation",
        canonicalIri: "https://beep.dev/legal-core#HohfeldianRelation", /* ... */
      }),
    })
  )

// the passive leg is the same relator read from the counterparty's side — already present, never a party-swap
export const correlativeLeg = (r: typeof HohfeldianRelation.Type) =>
  ({ active: r.holder, correlative: r.counterparty, square: r.square })
```

The `S.filter` enforcing ≥2 distinct parties is the schema-level encoding of UFO-L's `mediates` cardinality and gUFO's anti-monadic constraint (https://nemo-ufes.github.io/gufo/). `validity: LegalValidity` is the Marmor guardrail made structural — every relation is indexed to `(legalSystemId, interval)` so no position is truth-apt outside a closed "system S at t" prefix; that multi-temporal, three-axis-plus-transaction-time (enforceability/efficacy/applicability) value object (Palmirani) is domain-agnostic and lives in `foundation`, layered the way `EvidenceSpan` layers `Confidence` over `TextAnchor`.

#### Norms, agents, roles, and institutional acts

A `Norm` is the fact→norm→effect schema, split on the constitutive/regulative axis — constitutive norms can only be *void*, regulative norms can be *violated*. Note the deliberate separation: a stored `Norm` is **a fact about a norm, not a normative fact** (Marmor); deontic activation is an explicit downstream step, never an automatic ought.

```ts
const $I = $LegalCoreId.create("values/Norm")
export const Norm = LiteralKit(["constitutive", "regulative"]).toTaggedUnion("normKind")({
  constitutive: { describesFact: SituationPattern, ascribesEffect: LegalQualification },
  regulative:   { describesFact: SituationPattern, modality: DeonticModality, bearer: LegalAgentId,
                  counterparty: S.OptionFromOptionalKey(LegalAgentId), conditions: S.Array(SituationPattern) },
}).pipe($I.annoteSchema("Norm", { description: "Fact->norm->effect; constitutive = void-able, regulative = violable." }))
```

Agents are *rigid* identity-bearers; roles are *anti-rigid*, time-bounded, and relator-scoped — "agents can act, roles cannot." So `LegalAgent` is a thin person/organization, and `RolePlaying` is a separate construct that lives on the relation, not as a `Person` subclass. The same split powers the counts-as qualification: a physical `LegalEvent` becomes an institutional `LegalAct` only *through* a qualifying norm (Searle/Valente; Sartor's do/bring distinction).

```ts
const $I = $LegalCoreId.create("values/Agency")
export const LegalPersonKind = LiteralKit(["natural_person", "legal_person", "public_body"])
export const RoleKind = LiteralKit(["inventor", "assignee", "applicant", "examiner", "attorney", "licensor", "licensee", "plaintiff", "defendant", "judge"])

export class LegalAgent extends S.Class<LegalAgent>($I`LegalAgent`)(
  { kind: LegalPersonKind, displayName: S.String },
  $I.annote("LegalAgent", { description: "Rigid identity-bearer; responsibility attaches here, not to a role." })) {}

export class RolePlaying extends S.Class<RolePlaying>($I`RolePlaying`)(
  { agent: LegalAgentId, role: RoleKind, withinRelator: S.OptionFromOptionalKey(RelatorId), validity: LegalValidity },
  $I.annote("RolePlaying", { description: "Anti-rigid, relator-scoped role assignment; one agent plays many time-bounded roles." })) {}

export const LegalActType = LiteralKit(["enactment", "filing", "registration", "grant", "assignment", "license", "revocation", "judgment"])
export class Qualification extends S.TaggedClass<Qualification>()("Qualification", {
  physical: S.String /* FactRef */, institutionalAct: LegalActType, qualifyingNorm: NormId,
}, $I.annote("Qualification", { description: "counts-as: a physical fact qualified into an institutional act under a norm." })) {}
```

#### Annotations are the projection

Notice that no construct above mentions Turtle. Each carries a `semanticSchemaMetadata` payload via the *existing* `@beep/rdf` mechanism (`makeSemanticSchemaMetadata` validates it; `getSemanticSchemaMetadata` reads it back by walking `schema.ast`). The candidate `@beep/ontology` projector consumes that annotation plus the already-shipped `serializeQuad` to emit Turtle/N-Triples and JSON-LD — `HohfeldianRelation` becomes a `gufo:Relator` with `gufo:mediates` edges, `DeonticModality` aligns outward to LegalRuleML via `skos:exactMatch`, and the FOLIO concept IRIs (https://folio.openlegalstandard.org) attach as `skos:closeMatch` rather than being copied. One schema is the source of truth for types, persistence, *and* ontology — the gap the playbook promised to close.

### Where it lives

The single most reproducible finding across the literature is vertical tiering (Bench-Capon & Visser: "a library of dedicated ontologies, one per purpose"); Griffo treats missing grounding as a defect, so placement must be recorded, not implicit. beep already has the rule encoded in doctrine — a slice `domain` imports only shared-kernel + `foundation`, never another slice (`01-hexagonal-vertical-slices.md:60-61`) — and the worked precedent (`DECISIONS.md` 2026-06-18) splits substrate down, vocabulary up, mechanism in-slice. Map the trichotomy onto it:

| Tier | Package | What lands here | Why |
|---|---|---|---|
| Foundational (agnostic) | `@beep/rdf`, `@beep/ontology` (to build) | IRI/terms/`serializeQuad`, the generic projector, a generic `Relator` construct, multi-temporal `LegalValidity`/`TimeInterval`, the `OntologyLayer` tag | Domain-agnostic substrate; mirrors how `TextAnchor`/`UnitInterval` were factored down (2026-06-18 tier a) |
| Legal core (cross-vertical) | `@beep/legal-core` (candidate) | `DeonticModality`, `HohfeldianRelation`, `Norm`, `LegalSource`, `LegalAgent`/`RolePlaying`, `Qualification` | Reusable across *all* law but **not** domain-agnostic — so its own shared-kernel-tier package, not `foundation` (per the SPEC stop-condition that defers legal content out of `foundation`) |
| Shared kernel | `@beep/shared-domain` | branded entity ids (`LawPractice.*` already here), `ClaimLifecycle`, the minimum promoted deontic vocabulary | Cross-slice product language with a README promotion record (`02-shared-kernel.md`) |
| Domain (statute-specific) | `law-practice/domain` | `Rejection`, `RejectionGround` (§101/§102/§103/§112), `PatentClaim`, `PriorArtReference` | Non-reusable; rebuilt per subdomain |

The hard rule: a lower tier may reference an upper-tier id, never the reverse, and every module carries an `OntologyLayer` tag so the projector partitions the emitted graph into reusable-core vs. statute-specific files. `@beep/legal-core` depends on `foundation` only; `law-practice/domain` may import `legal-core` and shared-kernel.

### Specializing the core: a §103 rejection

A statutory rejection is not a string — it is a *power-exercise*: the examiner's `power` over the applicant's `liability`, grounded in a §103 `Norm`, mediated by the examiner-role and applicant-role, with the `PatentClaim` as object. The existing `RejectionGround` tagged union (the richest construct in the live tree) stays; we promote the fixture-key strings to branded ids and attach the relator.

```ts
const $I = $LawPracticeDomainId.create("entities/Rejection/Rejection.model")
export class Rejection extends BaseEntity.Class<Rejection>($I`Rejection`)(
  LawPractice.RejectionId,
  {
    fields: {
      ground: RejectionGround,                  // existing §101/§102/§103/§112 union (prior-art cardinality in the type)
      groundingNorm: NormId,                    // @beep/legal-core — the statute as a Norm, not a bare literal
      relator: HohfeldianRelation,              // square: "power_liability", holder = examiner role
      claimRef: LawPractice.ClaimId,            // was claimFixtureKey: S.String
      officeActionRef: LawPractice.OfficeActionId,
    },
    persisted: {
      ground:   EntitySchema.persist.jsonb({ columnName: "ground" }),
      relator:  EntitySchema.persist.jsonb({ columnName: "relator" }),
      groundingNorm: EntitySchema.persist.text({ columnName: "grounding_norm" }),
      // ... id columns
    },
  },
  $I.annote("Rejection", {
    description: "A §-grounded rejection, modeled as an examiner power / applicant liability relator.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "ontologyConstruct", canonicalName: "PatentRejection",
      canonicalIri: "https://beep.dev/ip#PatentRejection", preferredPrefix: "ip", /* subClassOf lc:HohfeldianRelation */
    }),
  })
) {}
```

`PatentClaim` specializes a core `LegalObject` the same way — an `ip:PatentClaim` annotated `rdfs:subClassOf lc:ProtectableSubjectMatter`, recalling Wilson's point that the owned thing is the *type*, not the token. The slice keeps its statute literals and prior-art cardinality; the core supplies the relational and deontic backbone, projected outward as gUFO relators.

What this sketch deliberately leaves open is the moment a `Rejection` relator becomes an *admitted* assertion with grounded evidence and a defeasible verdict — that is the epistemic seam, and it is exactly where the next section picks up.

## 7. Claims, Evidence & Admissibility — Wiring Legal Ontology into the Epistemic Slice

The epistemic slice is the part of beep where a legal-tech engineer should feel most at home and most uneasy. At home, because the four-state `ClaimLifecycle` (`candidate → shape_valid → consistency_checked → admitted`) is already an admissibility pipeline in everything but name. Uneasy, because the slice was deliberately built legal-vocabulary-free, so none of that admissibility semantics is *typed* yet — it lives in the shape of the state machine, not in the words. This section wires the legal-ontology and argumentation literature onto the symbols that already exist, and is precise about which of them to extend versus leave alone.

### The lifecycle is already a burden-of-proof ladder

A court does not admit a fact in one step. It checks form (is this even a cognizable filing?), then checks coherence against the record, then — only then — treats it as established. beep's `ClaimLifecycle`, promoted to `@beep/shared-domain`, is the same ladder, and the mapping is exact enough to type against:

| Lifecycle state | Procedural analogue | Standard met |
|---|---|---|
| `candidate` | proffered / pleaded | bare assertion |
| `shape_valid` | prima facie / cognizable | structural sufficiency |
| `consistency_checked` | survives challenge on the record | no defeating conflict |
| `admitted` | found / established | discharged burden |

The crucial design property is already correct: `ClaimGateResult` is a tagged union `admitted {} | rejected { violations }`, and **rejection is a value, not an error** (`ClaimGateResult.model.ts`). That is precisely how law treats inadmissibility — a non-error outcome you can record, appeal, and re-run, never an exception that aborts the proceeding. Leave that idiom alone; it is the single most legally-correct decision in the slice.

### The ClaimGate is a constitutive "counts-as" gate

`makeClaimGate` maps a claim plus its evidence into a bounded SHACL dataset and runs `ShaclValidationService`, requiring `minCount 1` evidence quote. Read through Searle's lens (and Valente's *counts-as*, see the Concept Inventory's `CountsAs`), SHACL conformance *is* an institutional fact: a structurally valid extraction **counts as** an admissible claim within system S. The gate is constitutive, not merely descriptive — passing it changes the claim's institutional status, exactly the constitutive-vs-regulative distinction the norm literature insists on (CLO/Gangemi). This is why engine failure is an `Effect.orDie` defect rather than a rejection: a broken courtroom is not an inadmissible fact, it is a mistrial.

What the gate currently lacks is *normative content*. Today it asserts one thing: "has at least one grounded quote." A real admissibility rule is a defeasible inference, and that is where argumentation theory earns its place.

### Toulmin, AIF, and Carneades over real symbols

The argumentation models give a vocabulary for the parts beep already half-has. Toulmin (*The Uses of Argument*) decomposes an argument into claim, data, warrant, backing, qualifier, rebuttal; AIF (http://www.arg.tech) reifies those as nodes; Carneades — the engine LKIF-Core was built to feed — adds proof standards and pro/con arguments that can *undercut* or *rebut*. The legal-NLP work in the cluster supplies the extraction side: detecting the claim node from text (claim-detection), grounding the data node in cited material (recognizing-cited-facts), and walking precedent as argument graphs (browsing-case-law Carneades).

| Toulmin / Carneades | beep symbol | Status |
|---|---|---|
| Claim | `CandidateClaim` | exists (content is opaque `snapshot`) |
| Data / grounds | `Evidence` + `EvidenceSpan` | exists |
| Warrant / backing | `Norm` / `RejectionGround` | adjacent (law-practice), not wired into the gate |
| Qualifier | `Confidence` (UnitInterval) | exists, flat |
| Rebuttal / undercut | — | **missing** |

The missing row is the priority. `Evidence` links to a claim by opaque `spanFixtureKey`/`artifactFixtureKey` strings with a single scalar confidence — there is no typed polarity. Reify that edge as a relator carrying `supports | contradicts | undercuts`, and `ClaimGateResult` can graduate from the binary `admitted | rejected` to a Carneades-style verdict `admitted | rejected | undercut | rebutted` *without breaking the rejection-as-value idiom* — it just adds tags to the union.

### EvidenceSpan as provenance anchor, and confidence vs. proof standards

`EvidenceSpan = { ...TextAnchorFields, confidence: Confidence }` is the right substrate: a half-open `[startChar, endChar)` range plus exact `quote`, with `Confidence = UnitInterval` layered on top. This is the same shape as effect-langextract's `CharInterval`, and its decisive lesson applies directly: **the model emits only the verbatim quote; a deterministic alignment pass computes the offsets.** Two concrete deltas from langextract — beep's offsets are already *required and total* (langextract wrongly makes `startPos/endPos` optional; keep beep's stronger contract), and beep should adopt langextract's categorical `AlignmentStatus` (`match_exact | match_greater | match_lesser | match_fuzzy`) as a provenance field. A float cannot tell you whether a span was found verbatim or fuzzily; for citations and statute numbers in legal text that distinction is auditable evidence quality.

A warning the literature is emphatic about: `Confidence` is an *epistemic* qualifier (how sure the extractor is) and must never be conflated with a *legal* standard of proof (preponderance, clear-and-convincing). Keep them orthogonal — confidence weights the evidence node; the proof standard is a property of the gate's rule. PROV-O (https://www.w3.org/TR/prov-o/) has no native confidence at all, which is exactly why beep must add it explicitly rather than borrow.

### Annotating an admitted claim as a PROV/SKOS node

The publishing pipeline's requirement — surface only confirmed nodes — is PROV-O's qualified-attribution pattern plus a verification gate. The `representations` metadata already on schemas becomes load-bearing here: a projector reads `getSemanticSchemaMetadata` and emits quads via the existing `serializeQuad`.

```ts
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema"
import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf"
import { PROV_ENTITY, PROV_WAS_ATTRIBUTED_TO, PROV_WAS_DERIVED_FROM } from "@beep/rdf/Vocab/Prov"

const VerificationStatus = LiteralKit(["verified", "plausible_unverified", "flagged"])

class AssertionProvenance extends S.Class<AssertionProvenance>($I`AssertionProvenance`)(
  {
    status: VerificationStatus,
    attributedTo: AgentId,                 // PROV agent
    derivedFrom: S.NonEmptyArray(EvidenceSpan),
    sourceAuthority: LiteralKit(["binding", "persuasive", "informational"]),
  },
  $I.annote("AssertionProvenance", {
    description: "PROV-O attribution + verification gate; only 'verified' crosses the publishing boundary.",
  })
) {}

// illustrative: an admitted claim is an instance-level assertion, so it is typed prov:Entity
// (skos:Concept is reserved for vocabulary terms, not asserted claims)
const toProvNode = (subj: IRI, p: AssertionProvenance) => [
  makeQuad(makeNamedNode(subj), RDF_TYPE, PROV_ENTITY),
  // mint an IRI from the branded AgentId first — makeNamedNode expects an IRI, not an AgentId
  makeQuad(makeNamedNode(subj), PROV_WAS_ATTRIBUTED_TO, makeNamedNode(agentIri(p.attributedTo))),
  // ...one prov:wasDerivedFrom per grounded EvidenceSpan
]
```

This composes cleanly with the **federation invariant**. `ClaimProjection = (authority: ReadonlyArray<CandidateClaim>) => ClaimProjectionView` is a pure fold with no write capability; the publishing projector is the same shape, partitioning on `lifecycle === "admitted" && status === "verified"`. No central store, no slice writing into another's authority — the type signature *is* the guarantee.

### A legal Qualification expressed as a gated claim

The counts-as qualification — "applicant filed document D" *counts as* "a patent application" — is not a separate mechanism. It is a claim whose admission **is** the institutional fact, so it rides the existing gate:

```ts
class Qualification extends S.Class<Qualification>($I`Qualification`)(
  {
    physical: FactRef,                                   // the brute event
    institutional: LiteralKit(["patent_application", "priority_claim", "anticipation"]),
    qualifyingNorm: NormId,                              // the warrant (handed off from the LCO section)
    lifecycle: ClaimLifecycle,                           // shared-kernel admission ladder
    evidence: S.NonEmptyArray(EvidenceSpan),
  },
  $I.annote("Qualification", {
    description: "Counts-as institutional qualification; holds iff the ClaimGate admits it under qualifyingNorm.",
  })
) {}
// advance(q, gate.evaluate(q, q.evidence)) — admitted verdict ⇒ the institutional fact obtains
```

### What to add, what to leave alone

**Leave alone:** rejection-as-value, the `orDie` defect boundary, the four-state ladder's forward-only shape, and the `ClaimProjection` federation signature. These are load-bearing and legally sound.

**Add, in order:** (1) the categorical `AlignmentStatus` on `EvidenceSpan`; (2) a reified, polarised claim↔evidence relator replacing the fixture-key strings; (3) the `undercut | rebutted` tags on `ClaimGateResult`; (4) `AssertionProvenance` + the verified/plausible/flagged publishing projector; (5) typed propositional content to replace `snapshot: UnknownRecord`, so `consistency_checked` can do real conflict reasoning instead of a `minCount` check. The norm/relator vocabulary those warrants reference is the subject of the preceding section — wire it in by `NormId`, do not re-model it here.

## 8. Build vs. Borrow — Reference Implementations Worth Studying

Five projects sit close enough to what we are building that studying them beats guessing. None is a drop-in dependency; each contributes a pattern to lift, a vocabulary to import, or a cautionary tale about where genericity goes to die. The question for every one is the same: does beep *build* the equivalent, *align* to it, *study* it for ideas, or *avoid* the trap it stepped in?

#### effect-ontology — the closest analog to `@beep/ontology`

effect-ontology (github.com/mepuka/effect-ontology) loads OWL/RDFS+SKOS Turtle, derives ontology-guided extraction prompts, and runs a two-stage entity-then-relation KG pipeline with SHACL validation. It is the nearest living sibling to the `@beep/ontology` package that does not exist yet — and proof that the schema-first RDF idiom scales.

The two patterns worth lifting are the **RuleSet single source of truth** and the **merge monoid**. In effect-ontology one `ExtractionRule` set renders into *both* the prompt text and the Schema `.annotations({ description })`, so prompt and validator cannot drift — exactly the discipline beep's extraction needs. The second is a pure associative `mergeGraphs` folded over parallel chunk results with an empty-graph identity:

```ts
// illustrative — the merge monoid beep folds over parallel chunk extractions
const emptyGraph = KnowledgeGraph.make({ entities: [], relations: [] });
const mergeGraphs = (a: KnowledgeGraph, b: KnowledgeGraph): KnowledgeGraph => /* union by id, type voting */ a;
// Stream.runFold(emptyGraph, mergeGraphs) — assert associativity + identity as fast-check laws
```

Pair it with the staged hallucination barrier (relations may only reference already-extracted entity IDs). What to **avoid**: its README promises a "topological catamorphism over a KnowledgeIndex HashMap monoid" that the real code never builds — `OntologyContext` is array-backed with O(N) `Array.find` scans, and the parser sprinkles `as unknown as IRI` coercions. beep should actually build the HashMap-indexed index the docs only describe, and keep IRI branding end-to-end by decoding at the boundary, never casting. **Verdict: Borrow.**

#### effect-langextract — grounding, already half-built in beep

effect-langextract (github.com/pooks/effect-langextract) ports google/langextract: every extracted entity grounds to exact character offsets, but the LLM emits *only* the verbatim quote and a deterministic token aligner (a difflib `SequenceMatcher` port) assigns the span. Its `CharInterval` + `AlignmentStatus` is near-identical to beep's `EvidenceSpan`/`TextAnchor` covered in the previous section — so this is a reconcile, not a rebuild.

Borrow the **two-phase grounding** verbatim and add the categorical `AlignmentStatus` onto `EvidenceSpan` alongside the numeric `Confidence` — it records *how* a span was located (verbatim vs. fuzzy), which a single float cannot:

```ts
const AlignmentStatus = LiteralKit(["match_exact", "match_greater", "match_lesser", "match_fuzzy"]);
class EvidenceSpan extends S.Class<EvidenceSpan>($I`EvidenceSpan`)({
  ...TextAnchorFields,          // startChar, endChar, quote — REQUIRED and total
  alignmentStatus: AlignmentStatus,
  confidence: Confidence,       // = UnitInterval
}, $I.annote("EvidenceSpan", { description: "Offsets computed deterministically, never emitted by the model." })) {}
```

The one thing to **fix, not copy**: langextract makes `startPos`/`endPos` `optionalWith` — beep keeps offsets required and total, and should retune the English-biased tokenizer (it strips a trailing `s`) before trusting it on statute numbers and citation-dense legal text. **Verdict: Borrow.**

#### Palantir OSDK — "ontology as types," at industrial scale

OSDK (github.com/palantir/osdk-ts) generates a TypeScript SDK from a Foundry ontology: each object is emitted as both an `interface` and a tiny runtime `const`, with all rich metadata tucked under a phantom `__DefinitionMetadata?` field that has zero runtime cost but full literal typing. It is the most polished "ontology as types" surface in existence.

Worth emulating: the **phantom compile-time metadata** trick (a tiny const carrying the RDF IRI/SHACL shape id, a phantom type carrying the rich shape); **directional datatype lookup tables** (separate read/write/create maps, which line up perfectly with Effect Schema's Encoded-vs-Type split and with SHACL `minCount`/`maxCount` + OWL functional properties); cardinality and nullability **as type parameters**; and the `__quickinfo_snapshot__` tests that pin hover-tooltip type strings so deeply generic types stay human-readable.

```ts
// borrow the *shape*: one closed datatype union, then direction-specific maps
const XsdDatatype = LiteralKit(["xsd:string", "xsd:dateTime", "xsd:integer", "xsd:boolean", "xsd:anyURI"]);
```

Where to **differ**: OSDK hand-rolls parallel interface+const emission with template-string codegen over a *proprietary* wire format, and the type graph is so deep it needs a snapshot harness to stay sane. beep is schema-first — derive everything from one Effect Schema, key literal unions to open standards (XSD/OWL/SHACL), and if codegen is unavoidable use a real printer (ts-morph), not string concatenation. Emulate the ergonomics, not the machinery. **Verdict: Study.**

#### ontouml-js + vocabulary-lib — UFO stereotypes as data

The OntoUML/UFO toolchain (github.com/OntoUML/ontouml-js) encodes OntoUML stereotypes — `kind`, `subkind`, `role`, `phase`, `relator`, `mode`, `quality` — as enumerated data on a model graph, and its vocabulary library projects them to gUFO (`gufo:Relator`, `gufo:mediates`, `gufo:inheresIn`). It is the reference for treating UFO stereotypes as *data*, not prose — precisely how beep replaces opaque `*FixtureKey: S.String` links with first-class relators (UFO-L).

The transfer: stereotypes become a `LiteralKit`, and a relator's defining constraints (mediates ≥2 distinct parties; roles anti-rigid and relator-scoped; identity `readonly`) become Schema refinements enforced in CI alongside SHACL shapes:

```ts
const RelatorStereotype = LiteralKit(["kind", "subkind", "role", "phase", "relator", "mode", "quality"]);
const LegalRelator = LiteralKit(["RightDuty", "PowerLiability"]).toTaggedUnion("kind")({
  RightDuty: { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, object: ActionOrOmission },
  PowerLiability: { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, overRelator: RelatorId },
}).pipe(S.filter((r) => r.holder !== r.counterparty, { message: () => "relator must mediate >=2 distinct parties" }));
// project to gufo:Relator + gufo:mediates via getSemanticSchemaMetadata + serializeQuad
```

beep will not depend on a JS modeling library at runtime, but it should align its relator encoding and its gUFO projection target to this vocabulary. **Verdict: Align.**

#### FOLIO — do not reinvent 18,000 legal concepts

FOLIO (folio.openlegalstandard.org; github.com/alea-institute/folio) is a CC-BY OWL ontology of 18,000+ legal concepts with opaque stable IRIs + SKOS labels, plus `folio-enrich` (a 16-stage LLM+rules tagging pipeline using W3C Web Annotation `oa:` with a `preliminary→confirmed/rejected/backup` state machine over append-only `StageEvent` lineage), `charboundary` (a legal sentence segmenter), and a free public API. It is the closest existing reference to beep's *whole* stack.

The decisive move is to **import rather than mint**: map beep's own classes to FOLIO IRIs via `skos:exactMatch`/`closeMatch` instead of authoring 18k concepts.

```ts
import { SKOS_EXACT_MATCH, makeNamedNode, makeQuad } from "@beep/rdf";
// align beep's class to FOLIO's opaque IRI rather than reinventing the concept
const alignLessee = makeQuad(
  makeNamedNode("https://beep.dev/ip#Lessee"),
  SKOS_EXACT_MATCH,
  makeNamedNode("https://folio.openlegalstandard.org/R8pNPutX0TN6DlEqkyZuxSw"),
);
```

Also borrow the **opaque-IRI / SKOS-label separation** (never key on the human label), the `oa:Annotation` + `StageEvent` lineage as the claim-lifecycle spine, the **dual-path reconcile** (deterministic matchers concurrent with the LLM), the match-tier ranking with its legal terms-of-art lemma denylist, and the ontology-cache hash/freshness discipline. Keep an ergonomic flattened read-model alongside the formal OWL — FOLIO encodes relationships as `owl:Restriction someValuesFrom`, which is heavy to query directly; even folio-enrich works around it. **Verdict: Align (import).**

#### Scorecard

| Repo | Verdict | Maps to goal |
|---|---|---|
| effect-ontology | **Borrow** | ontology-modeling-foundation; trustgraph-doc-ontology (reified-claim lifecycle) |
| effect-langextract | **Borrow** | langextract-capability |
| Palantir OSDK | **Study** | ontology-modeling-foundation (the "ontology as types" surface) |
| ontouml-js + vocabulary-lib | **Align** | ontology-modeling-foundation (relator/role encoding → gUFO) |
| FOLIO | **Align (import)** | trustgraph-doc-ontology; langextract-capability (enrichment + charboundary) |

The net: borrow effect-ontology's RuleSet+monoid and langextract's grounding outright, align the relator schemas to gUFO and the concept vocabulary to FOLIO, and study OSDK for type ergonomics while pointedly differing on its codegen. How these consolidate into a build order is the subject of the roadmap that follows.

## 9. Recommendations & Roadmap for beep-effect

Four patterns are ready to land in the codebase today; everything else is sequencing. The decision filter is simple: adopt a pattern now if it (a) closes a *correctness* gap that opaque strings paper over, and (b) projects cleanly to RDF through the `@beep/rdf` annotation machinery you already have. Hold anything that buys reasoning power you cannot yet operationalize.

### (A) Adopt now

These are the highest-leverage moves, in order of return.

| Pattern | What it replaces | Source | Goal it advances |
|---|---|---|---|
| Legal relations as **relators** | `*FixtureKey: S.String` links in law-practice | (UFO-L), gUFO | `ip-law-knowledge-graph` |
| Reuse `ClaimLifecycle` + `ClaimGate` for legal qualification | ad-hoc status booleans | beep epistemic slice | `epistemic-claim-lifecycle-gate` |
| `LiteralKit` taxonomies for deontic / norm / rejection-ground | open string enums | (CLO), (Palmirani) | `beep-schema-topology` |
| Align `EvidenceSpan` with langextract grounding | model-supplied offsets | effect-langextract | `langextract-capability` |

**Reify legal relations as relators.** This is the single change that most upgrades the graph. Today law-practice connects entities through opaque keys; (UFO-L)'s controlled experiment (reported comprehension gains) is the cluster's only empirical evidence that reified, correlative relations are worth the modeling cost. The relator carries its own identity, provenance, and validity, mediates ≥2 role-playing parties, and carries both correlative positions on the one record (holder active, counterparty correlative).

```ts
const LegalRelator = LiteralKit([
  "RightDuty", "PrivilegeNoRight", "PowerLiability", "ImmunityDisability",
]).toTaggedUnion("kind")({
  RightDuty:        { holder: PartyId, counterparty: PartyId, object: ActionOrOmission },
  PrivilegeNoRight: { holder: PartyId, counterparty: PartyId, object: ActionOrOmission },
  PowerLiability:   { holder: PartyId, counterparty: PartyId, overRelator: RelatorId },
  ImmunityDisability:{ holder: PartyId, counterparty: PartyId, overRelator: RelatorId },
}).pipe(
  S.filter((r) => r.holder !== r.counterparty, { message: () => "relator requires ≥2 distinct parties" }),
  $I.annoteSchema("LegalRelator", {
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "ontologyConstruct", canonicalName: "LegalRelator",
      canonicalIri: "http://purl.org/nemo/gufo#Relator", preferredPrefix: "gufo",
    }),
  }),
);
// both Hohfeldian positions live on the one relator: holder = active, counterparty = correlative (no party-swap)
```

For the IP domain this means `PriorArtReference-anticipates-Claim`, `Rejection-against-Claim`, and `Distinction-overcomes-Rejection` become first-class entities, not edge labels. Reuse the existing four-state `ClaimLifecycle` (candidate→shape_valid→consistency_checked→admitted) and the SHACL-backed `ClaimGate` as the qualification spine: a relator is a *candidate* until the gate admits it, and rejection stays a tagged `ClaimGateResult` value rather than a thrown error. That keeps `epistemic-claim-lifecycle-gate` and `ip-law-knowledge-graph` sharing one promotion path.

Render every closed domain as a `LiteralKit` union — `DeonticModality`, `ProsecutionStatus`, and the existing `RejectionGround` (§101/§102/§103/§112) are the obvious first three. And put langextract's two-phase grounding on `EvidenceSpan` immediately: the model emits only a verbatim quote, a deterministic pass computes offsets, and an `AlignmentStatus` (`match_exact | match_greater | match_lesser | match_fuzzy`) records how the span was located. Keep offsets **required and total** — langextract's mistake was making them optional.

### (B) Align, don't reinvent

Treat these as external coordinate systems you map *to*, not schemas you absorb. The rule: mine their taxonomy, mint your own branded types, and bridge with `skos:exactMatch` carried in a Schema annotation.

| Concern | Align with | Posture |
|---|---|---|
| Legal upper concepts | (LKIF-Core) — https://github.com/RinkeHoekstra/lkif-core | conceptual reference; `skos:exactMatch`, don't copy the OWL |
| Legal-concept tagging | FOLIO (ALEA, 18k concepts) — https://folio.openlegalstandard.org | import as the concept vocabulary; opaque IRI + SKOS label |
| Provenance / taxonomy layer | PROV-O (https://www.w3.org/TR/prov-o/) + SKOS | backbone for `provenance-shared-claim-kernel` |
| Rules | LegalRuleML (OASIS) | import/export format, not an internal model |
| Document & source identity | Akoma Ntoso + ELI/ECLI | IRI scheme for legislation/case law |
| Works | FRBR | version selection under AKN/ELI |
| Patents | USPTO ODP / CPC / WIPO ST.96 | the domain identifiers for the product |

PROV-O has no native confidence field — beep adds it explicitly, which is exactly what `provenance-shared-claim-kernel` and the `VerificationStatus` (`verified | plausible_unverified | flagged`) gate already do. For the product, CPC and ST.96 are the patent vocabulary that grounds `trustgraph-doc-ontology`; ELI/ECLI brand the litigation and PTAB source identifiers. FOLIO is the closest existing reference to beep's whole stack and the right legal-concept tagging layer — its term-vs-concept split solves the polysemy you will hit the moment "claim" means both a patent claim and a litigation cause of action.

### (C) Interop roadmap via `@beep/ontology`

`ontology-modeling-foundation` defines `@beep/ontology`, which does not exist yet. Build it as the projection layer that makes the advertised `representations` metadata *load-bearing*: one generic projector consumes `getSemanticSchemaMetadata` and the existing `serializeQuad` to emit Turtle/N-Triples first, JSON-LD next.

```ts
const { Ont, $I } = Ontology.create({
  identity: "ip", baseIri: "https://beep.dev/ip#", preferredPrefix: "ip",
});
const PatentApplication = Ont.class("PatentApplication", { /* fields */ })
  .pipe($I.annoteSchema("PatentApplication", {
    kind: "ontologyConstruct",
    representations: [{ kind: "Turtle" }, { kind: "JSON-LD" }],
  }));

// projectTurtle / toJsonLD / fromJsonLD are pure; no triplestore required
const turtle = projectTurtle([PatentApplication, LegalRelator]);
```

This is the seam `ontology-interop-roadmap` needs. The product pipeline is **Oxigraph (WASM, OWL source of truth) → FalkorDB (rebuilt-each-run Cypher read model)**, and `@beep/ontology` is what feeds Oxigraph: schemas annotated `ontologyConstruct` emit Turtle, Oxigraph runs `SPARQL CONSTRUCT` for entity resolution and inference, and the result materializes into Cypher. The deliberate rebuild-on-each-run prevents OWL/Cypher drift — `@beep/ontology` only has to produce correct triples and round-trip JSON-LD; it never owns query.

### (D) Defer, and why

| Deferred | Why now is wrong | Revisit when |
|---|---|---|
| Full OWL DL reasoning | Oxigraph's RDFS/SPARQL covers entity resolution; DL tax is unpaid | reasoning outgrows Oxigraph → Jena Fuseki sidecar |
| RDF/XML | nobody hand-writes it; Turtle/JSON-LD suffice | external ingest demands it |
| Heavyweight SHACL engines | `ClaimGate` + Effect-Schema validate closed shapes already | cross-system shape contracts |
| Open-textured rules **as types** | (McCarty)'s prototype-and-deformation insight: open concepts resist closed enums | route to a rule layer outside the schema |
| Smart-contract execution | no on-chain requirement; pure liability | never, for this product |

The throughline: keep deontic and defeasible *reasoning* in a rule layer (LegalRuleML import, run in Oxigraph/Jena), and keep the static schema for closed-shape *validation*. This is the OWA-inference vs. CWA-validation split — do not try to encode "obviousness under §103" as a type.

### (E) Pitfalls and debates

- **Core-vs-domain scope creep.** Tag every module with `OntologyLayer` (`foundational | core | domain | application`) and enforce the one-way dependency rule: lower tiers may reference higher-tier IRIs, never the reverse. Patent-specific concepts are *domain*; they never leak upward into a reusable core.
- **Ontological overcommitment.** (Griffo) flags absent foundational grounding as a defect, but the cure is recording the choice, not maximizing it. Ground relators in UFO/gUFO, align outward to LKIF via SKOS, and write the grounding down — don't silently bake DOLCE assumptions into field semantics.
- **The is/ought boundary.** (Marmor) is non-negotiable: a stored statute record is *descriptive data*, not a binding ought. Keep `FactAboutNorm` distinct from `NormativeFact`; deontic activation is an explicit derived step, never an implicit consequence of having ingested a norm.
- **Ontology drift vs. runtime schema.** The schema is the single source of truth for types, persistence, *and* ontology; the FalkorDB rebuild and the `representations` annotation exist precisely so the RDF projection cannot drift from the validated structs.
- **The OntoUML-vs-implementation gap.** Enforce relator constraints (≥2 mediated parties, anti-rigid roles, immutable identity) as Effect-Schema refinements in CI, not as prose in a model diagram.
- **Critique-of-IP-ontology cautions.** (Peukert) warns against naïve "owned continuant" grounding (IP objects default to public domain, constituted by their documents); (Wilson) frames IP as ownership of *types*. Hold the IPROnto license-vs-contract invariant as a `Schema.filter` — a licensee must *not* become a rights-holder.

### A three-phase sequencing for the IP product

**Phase 1 — Identity and provenance spine.** Stand up `@beep/ontology` (Turtle/N-Triples projection over `serializeQuad`); brand the identity anchors (OED registration, bar numbers, PatentsView `attorney_id`, ELI/ECLI for cases); wire `AssertionProvenance` + the `verified | plausible_unverified | flagged` gate so only confirmed nodes publish. This directly addresses the product's heavy verification debt — the unverified 1,800+ figure and most litigation stay `plausible_unverified` until a PACER/Lens pass clears them. Serves `provenance-shared-claim-kernel`, `ontology-modeling-foundation`.

**Phase 2 — Relators and lifecycle.** Replace `*FixtureKey` links with `LegalRelator` entities; model the patent/claim prosecution lifecycle as an event-sourced fold (`Filing → Rejection → Amendment → Grant → Revocation`) over `ProsecutionStatus`; reuse `ClaimGate` to qualify each relator; add `AlignmentStatus` to `EvidenceSpan`. Serves `ip-law-knowledge-graph`, `epistemic-claim-lifecycle-gate`, `langextract-capability`, `trustgraph-doc-ontology`.

**Phase 3 — Deontic/temporal and interop.** Add the deontic/norm slice (Hohfeldian pairs, Palmirani Norm/Provision/Rule tri-layer, IPROnto invariant, AI-acquisition vocabulary), the multi-temporal `LegalValidity` substrate in `foundation/modeling`, and JSON-LD round-trip plus LegalRuleML export — completing the Oxigraph→FalkorDB interop. Serves `ontology-interop-roadmap`, `beep-schema-topology`.

Net: borrow UFO-L's relators and FOLIO's vocabulary, ground deliberately and on the record, make `(legalSystemId, validity-interval)` mandatory on every legal fact, and keep reasoning in a rule layer outside the static schema.

## 10. Annotated Reading Map

This closing map is a field guide to the sources behind everything above. Priority tags read literally: **Start here** = read before you write a schema; **Core** = read before you commit a design; **Deep cut** = read when you hit the specific problem it solves. Short-names in bold are the handles used throughout the document.

### Part 1 — The Deep-Read Corpus

#### Foundations & core ontologies

| Paper | Annotation → why it matters to beep | Priority |
|---|---|---|
| **What-is-Ontology** (Guarino, Oberle & Staab 2009, *Handbook on Ontologies*) | Rigorous conceptualization/commitment/ontology definitions → the precise vocabulary for the schema→RDF slice. | Start here |
| **LKIF-Core** (Hoekstra, Breuker, Di Bello & Boer 2007/08, ESTRELLA) | Modular OWL legal upper ontology, 3 layers/15 modules → mine the taxonomy, align via `skos:exactMatch`, don't copy the OWL. | Start here |
| **FOLaw/LRI-Core** (Van Engers et al. 2008, Springer) | Functional FOLaw vs commonsense LRI-Core → enforces the ontology-vs-epistemological-framework split. | Core |
| **FOLaw-vs-LRI** (Breuker & Hoekstra 2004, Leibniz Center) | Reclassifies FOLaw as reasoning-pattern epistemology → keep role-knowledge out of the clean terminological layer. | Core |
| **CLO/D&S** (Gangemi, Sagri & Tiscornia 2005, LNAI 3369) | Norms as DOLCE+ Descriptions, cases as Situations → inconsistency becomes situation-class disjointness, not modal contradiction. | Core |
| **CLO-Compliance** (Gangemi, Prisco, Sagri, Steve & Tiscornia 2003/04) | CLO + JurWordNet for EC-directive checking → norm comparison as first-order conformity. | Core |
| **Law+SemWeb** (Benjamins, Casanovas, Breuker & Gangemi 2005, LNAI 3369) | Field-defining survey of FOLaw/LRI-Core/CLO/LLD → the canonical map of the core-ontology landscape. | Core |
| **Legal-Facts** (Marmor 2025, draft) | Legal facts truth-apt only under a closed "system S at t"; facts-about-norms ≠ normative facts → metaphysical guardrails + 3-valued indeterminacy. | Start here |
| **Normativity** (Zaibert & Smith ~2003) | Plural normativities beyond constitutive rules → caution against reducing obligation to logical consequence. | Deep cut |
| **Legal-Possibilities** (Gray, CSU) | Combinatorial case-space from rule antecedents/consequents → inspiration for claim-lifecycle truth states. | Deep cut |

#### Legal relations & Hohfeld

| Paper | Annotation → why it matters to beep | Priority |
|---|---|---|
| **UFO-L Relations** (Griffo, Almeida & Guizzardi 2015, NEMO) | Triadic legal relations reified as relators bundling Hohfeld/Alexy right-duty modes → the importable relator pattern. | Start here |
| **Legal-Relations (ER18)** (Griffo, Almeida & Guizzardi 2018, ER) | Relator-as-truthmaker pattern for contracts, with comprehension evidence → schema for Rejection/Distinction relators. | Start here |
| **UFO-L Pattern** (Griffo, Almeida & Guizzardi 2016) | Right-duty relation as a reusable OntoUML pattern → template for branded relator structs. | Core |
| **UFO-L Powers** (Griffo, Almeida, Lima, Sales & Guizzardi 2023, *DKE*) | Second Hohfeldian square; powers act *on* relations (P7/P8) → model Power as higher-order, referencing relators. | Core |
| **UFO-L Alexy** (Griffo, Almeida & Guizzardi ~2015) | Grounds "rights to something" in UFO + Alexy → justifies relation-centric over norm-centric core. | Core |
| **UFO-L (thesis)** (Griffo 2015, doctoral) | Programmatic case for the relational LCO → the *why* behind shifting focus from norms to relations. | Core |
| **LawV** (Griffo, Teixeira, Almeida, Gailly & Guizzardi 2020, CEUR) | Visual language mapping UFO-L categories to symbols → reference for naming relator/role/position constructs. | Deep cut |
| **Just-Culture** (Griffo & Castello 2021, RELATED@ICAIL) | UFO-L applied to healthcare compliance, failures reified as relators → a domain-transfer worked example. | Deep cut |

#### Norms, deontic & contracts

| Paper | Annotation → why it matters to beep | Priority |
|---|---|---|
| **Fill-the-Gap** (Palmirani, Ognibene & Cervone 2012/13, CIRSFID) | Separates text (Akoma Ntoso) / concepts (LKIF) / rules (LegalRuleML) over time → the Norm/Provision/Rule tri-layer + temporal model. | Start here |
| **Provision-Model** (Francesconi ~2012, IOS) | Hohfeld correlatives as OWL-DL equivalence axioms → read both correlative legs off one relator rather than duplicating data. | Core |
| **PrOnto** (Palmirani, Martoni, Rossi, Bartolini & Robaldo 2018) | Modular GDPR ontology + FRBR versioning + SPINdle → pattern reuse and version-at-event selection. | Core |
| **Fornara-OWL2** (Fornara & Colombetti ~2009) | Obligations/prohibitions as commitments with deadlines, closed via CWA → why OWA can't catch deadline violations. | Core |
| **Lex-Magis** (Boella, Governatori, Rotolo & van der Torre 2010, LNAI) | Interpretation as AGM revision of counts-as rules in Defeasible Logic → the constitutive-rule revision model. | Core |
| **DPL-Contracts** (Milosevic & Dromey ~2002, DSTC) | Behaviour trees + Deontic Policy Language for monitoring → runtime obligation-state tracking. | Core |
| **Symboleo** (Soavi, Zeni, Mylopoulos & Mich 2021, REFSQ) | Contract ontology over obligations/powers/roles/events → vocabulary for the contract slice. | Deep cut |
| **Ergo/Accord** (Roche, Hernández, Chen, Siméon & Selman ~2021) | Typed functional DSL emitting obligations as first-class types → idiom for clause-as-typed-function. | Deep cut |
| **Digital-Twin** (Treleaven, Denny, Dolga, Moss & Schoernig ~2020, UCL) | Paired NL+executable landscape review → requirements orientation, not modeling content. | Deep cut |
| **Multilingual-Interp** (Schafer 2017, *Statute Law Review*) | Paraconsistent/multi-context logic → representing mutually inconsistent interpretations. | Deep cut |
| **NEURONA** (Torralba, Casellas et al. ~2011) | Splits reusable concept ontology from project rule ontology → the DPCO/DPRO reusable/domain split. | Deep cut |
| **DSAP** (Li & Samavi ~2018) | RDFS data-sharing-agreement ontology with flat prohibited/required flags → the monadic anti-pattern UFO-L fixes. | Deep cut |
| **DigPres** (Bakhshandeh et al. 2013, ICT Law) | IP/copyright/obligation ontology for digital preservation → competency-question validation example. | Deep cut |

#### IP & patent ontologies

| Paper | Annotation → why it matters to beep | Priority |
|---|---|---|
| **IPROnto** (Delgado, Gallego, Llorente & García 2003, LNCS) | SUMO-grounded IP-rights ontology with rights-transfer events → the license≠contract invariant. | Start here |
| **Wilson** (Wilson 2010, *The Monist*) | IP is ownership of *types*, not tokens → ground IP objects as types with token satisfaction conditions. | Start here |
| **Peukert** (Peukert 2021, CUP) | IP objects constituted by their documents, default to public domain → warns against naïve "owned continuant." | Core |
| **Twofold-IP** (Contissa & Laukyte 2008, JURIX) | OWL author/work/right triplet + Event-Calculus defeasible rules → the ontology+rules split for IP. | Core |
| **ALIS-IP** (Cevenini, Contissa, Laukyte, Riveret & Rubino 2008, Springer) | LKIF-grounded copyright ontology, OCATU lifecycle, benchmarked vs IPROnto → lifecycle modeling reference. | Core |
| **IP-Expression** (Rodríguez, Gauvin & Delgado 2007, WOSIS) | Splits `CanExercise` (capability) from `RequiresAuthorisation` (permission) → capability/permission separation. | Core |
| **USPTO-Onto** (Taduri, Lau, Law, Yu & Kesan 2011, dg.o) | Cross-links patents/cases/file wrappers → prosecution history as linked event data. | Deep cut |
| **PSO** (Taduri, Lau, Law & Kesan 2012, Stanford) | Patent System Ontology making cross-references explicit → multi-source retrieval shape. | Deep cut |
| **PMO/Modular** (Giereth et al. 2007, PATExpert) | Modular SUMO+genre+domain+linguistic patent stack → modular layering reference. | Deep cut |
| **PATExpert** (Wanner et al. 2006/07) | Patents as multimedia knowledge objects (PULO on SUMO) → deliberately thin on legal semantics. | Deep cut |
| **OWL-Patent-IR** (Bermúdez-Edo, Noguera, Garrido & Hurtado 2013, AISC) | XSLT translation of IPC codes to an OWL hierarchy → classification-code handling. | Deep cut |
| **Patent-KG** (Zuo, Yin & Childs ~2021, Imperial) | Attention-scored triple extraction from patent abstracts → patent-corpus ingestion, confidence-tagged triples. | Deep cut |
| **REL-Gen** (Llorente, Delgado et al. 2005, LNCS) | Maps contract clauses to MPEG-21 REL → the contract→rights-expression bridge. | Deep cut |

#### Legal NLP / knowledge graphs

| Paper | Annotation → why it matters to beep | Priority |
|---|---|---|
| **Eunomos** (Boella, Di Caro, Humphreys, Robaldo, Rossi & van der Torre 2012, *Semantic Web*) | Legislative XML + Legal Taxonomy Syllabus, concepts URN-linked to sources → the term-vs-concept many-to-many. | Core |
| **MIREL-Pop** (Robaldo, Di Caro et al. 2018, MIREL D2.4) | Survey of connecting legal text to ontology concepts/instances → ontology-population + NERC/NEL methods. | Core |
| **Legal-Metadata** (Sleimi, Sannier, Sabetzadeh, Briand, Ceci & Dann 2021, *RE*) | NLP+ML extraction of 6 statement + 18 phrase metadata types → actor-role classification design. | Core |
| **NOMOS/ILAM** (Konstantinou, Sykes & Yannopoulos 1993, ICAIL) | Conceptual Graphs from statute; extraction alone misses interpretive/case knowledge → why text→KG needs a manual layer. | Deep cut |
| **MWCC** (Taylor & Mfutso-Bengo 2020, EasyChair) | OCR→TEI→NER pipeline mapping Penal Code to ICCS → low-resource case-law ingestion. | Deep cut |
| **Lex-is+LKIF** (Letia & Cornoiu 2010, DAS) | Combines LKIF + Lex-is for dissemination → reuse-by-composition example. | Deep cut |
| **E-Sentencias** (Binefa et al. 2007, LOAIT) | Context-dependent multimedia hearing ontology → the viewpoint/contextual-ontology argument. | Deep cut |
| **DynELCom** (Schweighofer 2011, IGI) | Indexing-based "simplified reasoning" commentary → IR fallback when full formalization fails. | Deep cut |
| **Ukr-Lexical** (Getman, Karasiuk & Hetman 2020, CEUR) | Crowdsourced civil-law lexical ontology with validity timeframes → term-to-definition binding at scale. | Deep cut |

#### Argumentation & evidence

| Paper | Annotation → why it matters to beep | Priority |
|---|---|---|
| **Carneades-Browse** (Ceci & Gordon 2012, CIRSFID/Fraunhofer) | LKIF ontology + defeasible rules in Carneades to reconstruct interpretations → the defeasible-verdict engine pattern. | Core |
| **Arg-Mining** (Wyner, Mochales-Palau, Moens & Milward 2010, LNAI 6036) | Extracts premise/conclusion structure + case factors → claim/evidence extraction grounding. | Core |
| **Claim-Detection** (Lippi, Lagioia, Contissa, Sartor & Torroni 2015, AICOL) | Tree-kernel SVM detecting concluding claims in ECJ judgments → claim-detection baseline + corpus. | Deep cut |
| **Cited-Facts** (Shulayeva, Siddharthan & Wyner 2017, *AI&Law*) | Classifies cited facts vs principles → citation-treatment tagging. | Deep cut |
| **Pegs** (Keppens & Schafer 2004, JURIX) | "Pegs" for non-committal speculation vs existential quantification → modeling `NoFactOfTheMatter` referents. | Deep cut |

#### Surveys & methodology

| Paper | Annotation → why it matters to beep | Priority |
|---|---|---|
| **Ontologies-over-Time** (Rodrigues, de Freitas, Barreiros, de Azevedo & de Almeida Filho 2019, *ESWA*) | Maps 78 studies; Kelsen-Hart-Hohfeld + RDF/OWL dominate; calls for reuse + defeasibility → the field-orientation read. | Start here |
| **LCO-Mapping** (Griffo, Almeida & Guizzardi, NEMO) | Systematic mapping; 32% lack foundational grounding → grounding-as-quality-defect mandate. | Start here |
| **Explicit-Specs** (Bench-Capon & Visser 1997, Liverpool) | Explicit conceptualizations + a *library* of purpose-specific ontologies → the sliced-module rule. | Core |
| **Four-Ontologies** (Visser & Bench-Capon 1998, *AI&Law* 6) | Compares LLD/NORMA/FOLaw/FBO on adequacy/operationality/reusability → criteria for choosing what to reuse. | Core |
| **Doctrinal-Classifications** (Fernández-Barrera & Sartor 2010, EUI) | Concept-vs-topic and is-a-vs-operational-family distinctions → type-design + RDF-emission rules. | Core |
| **OPJK** (Casanovas, Casellas, Tempich, Vrandečić & Benjamins 2005, LOAIT) | Bottom-up professional-knowledge ontology from ~800 competency questions → CQ-driven design. | Core |
| **Two-Ontologies** (Visser & Bench-Capon 1997, LIAL) | Short FOLaw-vs-FBO comparison → the "priorities not types" divergence. | Deep cut |
| **Socio-Legal** (Casanovas, Casellas & Vallbé 2011, Springer) | Empirically grounded "pragmatic circle" → the empirical-validation loop. | Deep cut |
| **METHONTOLOGY** (Corcho, Fernández-López, Gómez-Pérez & López-Cima 2005, LNAI) | METHONTOLOGY/WebODE legal-entity build → ordered conceptualization tasks. | Deep cut |
| **BC-Festschrift** (Bench-Capon, Liverpool) | History of heavyweight→lightweight ontologies → justification for the schema/builder approach. | Deep cut |
| **Reuse-ICT** (Abramowicz, Stolarski & Tomaszewski 2013, IGI) | Reuse as a first-class requirement via statute-specific composition → copyright-case reuse example. | Deep cut |
| **ALO (volume)** (Sartor, Casanovas, Biasiotti & Fernández-Barrera, eds. 2011, Springer) | Front matter of the field's programmatic volume → the "no neutral ontologies" framing. | Deep cut |

#### Standards & identifiers

| Paper | Annotation → why it matters to beep | Priority |
|---|---|---|
| **BO-ECLI** (Agnoloni, Bacci, Peruginelli et al. 2017, JURIX) | Pluggable parser resolving citations to ECLI/ELI/CELEX → citation-resolution into branded identifiers. | Core |
| **DALOS** (Agnoloni & Tiscornia 2010, ePart/LNCS) | Multilingual lexicon + CLO-grounded domain ontology inside a drafting tool → controlled multilingual terminology. | Deep cut |

### Part 2 — The Wider Corpus

Beyond the ~72 deep reads, the catalog holds the following not-yet-deep-read papers. Read them by need, not completeness:

- **+97 legal-NLP / extraction-KG** — by far the largest bucket: LLM/transformer extraction pipelines, legal NERC/NEL, benchmark corpora, RAG-over-statute work. Depth on the *ingestion edge*; little new ontology architecture.
- **+50 other-relevant** — adjacent regulatory/e-gov/AI-and-law material; mine for jurisdiction-specific edge cases and the AI-acquisition contracting angle.
- **+22 methodology-tooling** — more ontology-engineering methodologies (NeOn, SAMOD, UPON), evaluation rubrics, and tooling; sharpens the build process, not the model.
- **+22 legal-core-ontology** — additional core/upper treatments and UFO-L follow-ons; the highest-value deepening for the relator core.
- **+15 DRM-rights-licensing** — ODRL/MPEG-21/REL lineage; directly feeds the license-vs-contract and grant-as-relator patterns.
- **+15 deontic-norms-rules-contracts** — more defeasible-logic and LegalRuleML formalizations; the rule-layer reasoning depth.
- **+13 IP-patent-ontology** — further patent/claim document ontologies; incremental over the bimodal split already mapped.
- **+4 argumentation-evidence-provenance**, **+1 upper-ontology-conceptual-modeling**, **+1 legal-doc-standards-identifiers** — thin tails; the deep reads already cover the load-bearing ideas.

### Part 3 — Curated External Resources

**Foundational ontology & OntoUML/UFO**
- **gUFO** — OWL 2 DL UFO; the RDF projection target for relator/mode schemas — https://nemo-ufes.github.io/gufo/
- **OntoUML spec** — authoritative relator/role/mode constraints to encode as Schema refinements — https://ontouml.readthedocs.io/
- **ontouml-js** — TypeScript model build/serialize; mine its metamodel types — https://github.com/OntoUML/ontouml-js
- **UFO-L project** — the source line for the relational LCO — https://nemo.inf.ufes.br/en/projetos/ufo-l/

**Legal core vocabularies & concepts**
- **LKIF-Core** (CC BY 4.0) — class taxonomy to mine and align outward — https://github.com/RinkeHoekstra/lkif-core
- **FIBO** — legal-person / LEI vocabulary for party modeling — https://spec.edmcouncil.org/fibo/
- **Hohfeld** — correlative/opposite biconditionals as a type-level invariant spec — https://www.thomasalspaugh.org/pub/fnd/hohfeld.html

**Document, rule & identifier standards**
- **Akoma Ntoso** — FRBR-based legislative/judicial XML interchange — https://github.com/oasis-open/legaldocml-akomantoso
- **LegalRuleML** — deontic/defeasible rule interchange — https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/
- **DAPRECO KB** — 966 reified GDPR rules; concrete test corpus — https://github.com/dapreco/daprecokb
- **ELI** — IRI scheme for legislation works/expressions — https://op.europa.eu/en/web/eu-vocabularies/eli
- **SKOS** — term-vs-concept schemes for the polysemy split — https://www.w3.org/TR/skos-reference/
- **PROV-O** — per-assertion provenance + Bundle (provenance-of-provenance) — https://www.w3.org/TR/prov-o/

**Rules-as-code engines (external reasoners, behind clean Effect services)**
- **L4** — TS-adjacent decision service over REST/MCP — https://github.com/smucclaw/l4-ide
- **OpenFisca** — tax/benefit calculation via JSON API — https://github.com/openfisca/openfisca-core
- **Catala** — literate legislative DSL (permissive) — https://github.com/CatalaLang/catala
- **Blawx** — s(CASP) explainable/defeasible reasoning — https://github.com/Lexpedite/blawx

**TypeScript ↔ RDF projection toolchain**
- **LinkML** — the "one model, many serializations" generator blueprint — https://linkml.io/linkml/generators/owl.html
- **schema-dts** — ontology as `@type`-discriminated unions, zero runtime — https://github.com/google/schema-dts
- **gftdcojp/ontology** — closest analogue: TS runtime schema → JSON-LD/SHACL/OWL — https://github.com/gftdcojp/ontology
- **N3.js / jsonld.js** — Turtle/N-Triples I/O and JSON-LD canonicalization — https://github.com/rdfjs/N3.js , https://github.com/digitalbazaar/jsonld.js
- **rdf-validate-shacl / shacl-engine** — the CWA validation gate in CI — https://github.com/zazuko/rdf-validate-shacl , https://github.com/rdf-ext/shacl-engine

**Argumentation, provenance & integrity**
- **CiTO** — typed claim→source edges (`citesAsEvidence`, `supports`, `disputes`) — https://sparontologies.github.io/cito/current/cito.html
- **Nanopublications + Trusty URIs** — assertion/provenance/pub-info packaging with content hashes — https://nanopub.net/
- **rdfjs-di** — Data Integrity (canonicalize-hash-sign) for admitted claims — https://github.com/iherman/rdfjs-di

**Key books**
- **Peukert**, *A Critique of the Ontology of Intellectual Property Law* (CUP 2021) — the metaphysics of IP objects.
- **Marmor**, *Foundations of Institutional Reality* (OUP 2023) — the closed-system and facts-about-norms guardrails.
- **Alexy**, *A Theory of Constitutional Rights* — the structural rights theory under UFO-L.

## Appendix A — Concept → Schema Inventory

> A cheat-sheet: each recurring legal-ontology concept and its canonical rendering as an Effect Schema construct in beep-effect idiom. Snippets are illustrative; canonical forms live in §6 (the Blueprint).

### Ontology layering (upper/core/domain/application)

Vertical tiering of legal knowledge: domain-independent foundational ontology -> reusable legal core -> non-reusable statute/IP-specific domain -> A-Box instances, with a one-way dependency rule (lower tiers may reference higher-tier ids, never the reverse).

```ts
const OntologyLayer = LiteralKit(["foundational","core","domain","application"]).pipe($I.annoteSchema("OntologyLayer", { description: "Vertical ontology tier; the schema->RDF builder partitions reusable-core vs statute-specific graphs by this tag." }));
// attach as annotation; builder enforces lower-only references
const layered = (layer: typeof OntologyLayer.Type) => $I.annoteSchema("layered", { ontologyLayer: layer });
```

*Sources: Bench-Capon & Visser 1997, LKIF-Core/ESTRELLA, Griffo systematic mapping, Abramowicz reuse, beep goals/ontology-modeling-foundation/SPEC.md*

### Legal Relator (Hohfeld/Alexy correlative pair)

A reified, identity-bearing legal relation that mediates >=2 agents-in-roles and bundles a correlative pair of legal positions (modes) inhering in one party and externally depending on the other; the central reusable pattern. NOT a free-floating monadic flag.

```ts
const LegalRelator = LiteralKit(["RightDuty","PrivilegeNoRight","PowerLiability","ImmunityDisability"]).toTaggedUnion("kind")({
  RightDuty: { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, object: ActionOrOmission },
  PrivilegeNoRight: { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, object: ActionOrOmission },
  PowerLiability: { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, overRelator: RelatorId },
  ImmunityDisability: { holder: LawPractice.PartyId, counterparty: LawPractice.PartyId, overRelator: RelatorId },
}).pipe(S.filter((r) => r.holder !== r.counterparty, { message: () => "relator requires >=2 distinct parties" }), $I.annoteSchema("LegalRelator", { description: "Reified legal relation; project to gufo:Relator with gufo:mediates." }));
// correlative read off the same relator: holder = active position, counterparty = correlative (no party-swap)
```

*Sources: UFO-L (Griffo/Almeida/Guizzardi), gUFO, Hohfeld 1913/1917, Alexy, Francesconi*

### Deontic modality (closed union)

The fundamental normative qualifications a norm imposes on a role: obligation, prohibition, permission, and the Hohfeldian power; rendered structurally inside relators rather than as standalone modal operators.

```ts
const DeonticModality = LiteralKit(["obligation","prohibition","permission","power"]).pipe($I.annoteSchema("DeonticModality", { description: "Closed deontic modality domain; distinct from epistemic modality.", semanticSchemaMetadata: makeSemanticSchemaMetadata({ kind: "vocabularyTerm", canonicalName: "DeonticModality", canonicalIri: "https://docs.oasis-open.org/legalruleml/ns/v1.0/#", preferredPrefix: "lrml" /* obligation->#Obligation, prohibition->#Prohibition, permission->#Permission; 'power' -> potestative/Hohfeld (gufo), not a deontic operator */ }) }));
```

*Sources: CLO/Gangemi, PrOnto, LegalRuleML, Sleimi, DSAP*

### Norm (fact-norm-effect) + constitutive vs regulative

A norm describes generic facts (situations) and ascribes generic legal effects (qualifications). Constitutive (declarative/counts-as) norms modify institutional reality and can only be void; regulative (directive) norms prescribe behaviour and can be violated.

```ts
const Norm = LiteralKit(["constitutive","regulative"]).toTaggedUnion("normKind")({
  constitutive: { describesFact: SituationPattern, ascribesEffect: LegalQualification, voidable: S.tag(true) },
  regulative: { describesFact: SituationPattern, modality: DeonticModality, normSubject: LawPractice.PartyId, violable: S.tag(true) },
}).pipe($I.annoteSchema("Norm", { description: "Fact->norm->effect; constitutive = void-able, regulative = violable." }));
```

*Sources: CLO/Gangemi, Boella et al., Francesconi, Van Kralingen & Visser*

### Norm / Textual Provision / Legal Rule (N:M tri-layer)

Strict separation of the abstract Kelsenian norm, its binding textual provision (the only binding artifact), and the formalized logical rule, joined by an explicit many-to-many link relator via URI references rather than nesting.

```ts
const ProvisionUri = S.String.pipe(S.brand("AkomaNtosoEId"), $I.annoteSchema("ProvisionUri", {}));
class NormProvisionRuleLink extends S.Class<NormProvisionRuleLink>($I`NormProvisionRuleLink`)({
  normRef: NormId, provisionRef: ProvisionUri, ruleRef: RuleId,
  role: LiteralKit(["derives","elaborates","splits","merges"]),
}, $I.annote("NormProvisionRuleLink", { description: "Explicit N:M join between the three legal layers; never nest them." })) {}
```

*Sources: Palmirani et al. (Fill the Gap), Francesconi*

### Legal validity over time (multi-temporal: three axes plus transaction time)

A rule carries three orthogonal legal time axes (enforceability, efficacy, applicability) plus transaction time; modeled multi-temporally and event-sourced so retroactive amendment, annulment, and forked timelines are first-class. Every legal fact is jurisdiction- and time-indexed (Marmor's closed prefix).

```ts
class TimeInterval extends S.Class<TimeInterval>($I`TimeInterval`)({ from: S.DateTimeUtc, to: S.OptionFromOptionalKey(S.DateTimeUtc) }) {}
class LegalValidity extends S.Class<LegalValidity>($I`LegalValidity`)({
  legalSystem: S.String.pipe(S.brand("LegalSystemId")),
  enforceability: TimeInterval, efficacy: TimeInterval,
  applicability: S.OptionFromOptionalKey(TimeInterval), transactionTime: TimeInterval,
}, $I.annote("LegalValidity", { description: "Multi-temporal multi-axial validity; reject single dates and Allen-only logic." })) {}
```

*Sources: Palmirani et al., Marmor (Ontology of Legal Facts), Rodrigues mapping, PrOnto (FRBR versioning)*

### Counts-as / institutional qualification

A physical act/event is legally qualified into an institutional one (kills -> murders; filing -> patent application) via a qualifying norm. Modeled as a relator linking the physical fact to the institutional description.

```ts
class CountsAs extends S.TaggedClass<CountsAs>()("CountsAs", {
  physical: FactRef, institutional: InstitutionalActId, qualifyingNorm: NormId, context: ContextRef,
}, $I.annote("CountsAs", { description: "Institutional qualification of a physical fact under a norm." })) {}
```

*Sources: Searle/Valente, FBO, LKIF-Core, CLO/Gangemi*

### Agent / Role / Institution relator

Agents are rigid identity-bearing entities; roles are anti-rigid, relator-scoped, time-bounded classifiers a player adopts. Responsibility attaches to the agent, not the role. Roles live on the relation, not as Person subclasses.

```ts
const RoleKind = LiteralKit(["inventor","assignee","applicant","examiner","attorney","licensor","licensee","plaintiff","defendant","judge"]);
class RolePlaying extends S.Class<RolePlaying>($I`RolePlaying`)({
  agent: LawPractice.PartyId, role: RoleKind, withinRelator: S.OptionFromOptionalKey(RelatorId),
  institution: S.OptionFromOptionalKey(InstitutionId), validity: TimeInterval,
}, $I.annote("RolePlaying", { description: "Anti-rigid role assignment; one agent plays many time-bounded roles." })) {}
```

*Sources: UFO-L, Van Engers/LRI-Core, PrOnto, OPJK, Fornara*

### Power-exercise / institutional act lifecycle

A legal power is a second-order capacity to create/change/extinguish another's legal position via a typed institutional act; an act performed against an opposing disability is void. Relators have a lifecycle ordered by historical dependence.

```ts
const RelatorState = LiteralKit(["prescribed","active","modified","suspended","extinguished"]);
class InstitutionalAct extends S.Class<InstitutionalAct>($I`InstitutionalAct`)({
  actType: LiteralKit(["enactment","registration","grant","assignment","license","revocation"]),
  at: S.DateTimeUtc, validity: LiteralKit(["valid","void"]),
  affectsRelator: RelatorId, historicallyDependsOn: S.Array(EventId),
}, $I.annote("InstitutionalAct", { description: "Power-exercise event advancing a relator state machine; void if opposing disability present." })) {}
```

*Sources: Griffo 2023 (powers/subjections), IPROnto, LKIF-Core*

### Facts about norms vs normative facts; three-valued resolution

A stored record of a norm is descriptive data, NOT an automatically binding ought; deontic activation is an explicit derived step. Indeterminacy is first-class: a determinate negative fact differs from 'no fact of the matter'.

```ts
const Fact = LiteralKit(["FactAboutNorm","NormativeFact"]).toTaggedUnion("kind")({
  FactAboutNorm: { norm: NormId }, NormativeFact: { ought: DeonticModality },
});
const Resolution = <A extends S.Top>(a: A) => LiteralKit(["Determinate","NegativeFact","NoFactOfTheMatter"]).toTaggedUnion("verdict")({
  Determinate: { value: a }, NegativeFact: {}, NoFactOfTheMatter: {},
});
```

*Sources: Marmor (Ontology of Legal Facts)*

### IP rights taxonomy + license-vs-contract invariant

Branded closed hierarchy of IP rights; moral rights are non-transferable, exploitation rights transferable. A contract transfers rights (grantee becomes rights-holder); a license grants only permitted actions and the licensee must NOT become a rights-holder.

```ts
const RightsAgreement = LiteralKit(["Contract","License"]).toTaggedUnion("kind")({
  Contract: { granter: LawPractice.PartyId, grantee: LawPractice.PartyId, transferredRights: S.NonEmptyArray(RightRef) },
  License: { licensor: LawPractice.PartyId, licensee: LawPractice.PartyId, grantedActions: S.NonEmptyArray(PermittedAction) },
}).pipe(S.filter((a) => a.kind === "Contract" || !makesRightsHolder(a.licensee), { message: () => "licensee must not become a rights holder" }));
```

*Sources: IPROnto, Wilson (type ownership), Peukert*

### Patent/claim lifecycle as event-sourced state machine

A patent or claim's prosecution status is the fold of a chronologically ordered log of typed legal events (filing, office action, rejection, amendment, grant, revocation), not a stored attribute.

```ts
const LegalEvent = LiteralKit(["Filing","Rejection","Amendment","Grant","Revocation"]).toTaggedUnion("event")({
  Filing: { occurredOn: S.DateTimeUtc },
  Rejection: { occurredOn: S.DateTimeUtc, final: S.Boolean, ground: RejectionGround, allowedClaims: S.Array(LawPractice.ClaimId), rejectedClaims: S.Array(LawPractice.ClaimId) },
  Amendment: { occurredOn: S.DateTimeUtc }, Grant: { occurredOn: S.DateTimeUtc }, Revocation: { occurredOn: S.DateTimeUtc },
});
const ProsecutionStatus = LiteralKit(["filed","under_examination","issued","lapsed","withdrawn","revoked"]);
// reducer: (events: ReadonlyArray<typeof LegalEvent.Type>) => typeof ProsecutionStatus.Type
```

*Sources: Taduri, Giereth PMO, Contissa (do/bring), ALIS*

### Defeasibility / rule-vs-principle

Legal reasoning is non-monotonic: exceptions and superior rules override conclusions. Alexy distinguishes all-or-nothing rules from principles satisfiable to a degree (optimization requirements); classical OWL-DL cannot represent this faithfully.

```ts
const NormTaxon = LiteralKit(["Rule","Principle"]).toTaggedUnion("taxon")({
  Rule: { satisfied: S.Boolean }, Principle: { degreeOfFulfillment: UnitInterval.pipe(S.brand("FulfilmentDegree")) },
});
class SuperiorityRelation extends S.Class<SuperiorityRelation>($I`SuperiorityRelation`)({ superior: NormId, inferior: NormId, basis: LiteralKit(["lex_superior","lex_specialis","lex_posterior"]) }) {}
```

*Sources: Rodrigues mapping, Palmirani, UFO-L/Alexy, Boella, MIREL/DAPRECO*

### Evidence span with deterministic grounding + alignment status

An evidence anchor: the LLM emits only the verbatim quote; a deterministic token-alignment pass computes required char offsets and tags how the span was located (exact/greater/lesser/fuzzy). Confidence is layered on top of the pure provenance anchor.

```ts
const AlignmentStatus = LiteralKit(["match_exact","match_greater","match_lesser","match_fuzzy"]);
class EvidenceSpan extends S.Class<EvidenceSpan>($I`EvidenceSpan`)({
  ...TextAnchorFields, // startChar, endChar, quote (required, total)
  alignmentStatus: AlignmentStatus, confidence: Confidence, // Confidence = UnitInterval
}, $I.annote("EvidenceSpan", { description: "Char-offset evidence wrapping TextAnchor; offsets computed deterministically, never by the model." })) {}
```

*Sources: effect-langextract, beep @beep/provenance TextAnchor, FOLIO oa:TextPositionSelector*

### Per-assertion provenance + verification gate

Every claim/node carries PROV-O attribution and a verification status so the publishing pipeline surfaces only confirmed nodes; provenance bundles are themselves entities (provenance-of-provenance). PROV-O lacks native confidence, which is added explicitly.

```ts
const VerificationStatus = LiteralKit(["verified","plausible_unverified","flagged"]);
class AssertionProvenance extends S.Class<AssertionProvenance>($I`AssertionProvenance`)({
  status: VerificationStatus, attributedTo: AgentId, derivedFrom: S.Array(LegalSourceRef),
  sourceAuthority: LiteralKit(["binding","persuasive","informational"]), at: S.DateTimeUtc,
}, $I.annote("AssertionProvenance", { description: "PROV-O attribution + verification gate; only 'verified' is published." })) {}
```

*Sources: PROV-O (W3C), FOLIO lineage, beep epistemic slice, product target (publishing gate)*

### Legal source identifier (ELI/ECLI/Akoma Ntoso) as branded scheme

Uniform branded identifiers for legislation and case law under a closed scheme union, FRBR-versioned (Work/Expression/Manifestation), either composed from extracted features or resolved via an Effect resolver with tagged errors.

```ts
const ECLI = S.String.pipe(S.pattern(/^ECLI:[A-Z]{2}:.+/), S.brand("ECLI"));
const ELI = S.String.pipe(S.brand("ELI"));
const CELEX = S.String.pipe(S.brand("CELEX"));
const StandardIdentifier = LiteralKit(["ECLI", "ELI", "CELEX"]).toTaggedUnion("scheme")({
  ECLI: { value: ECLI }, ELI: { value: ELI }, CELEX: { value: CELEX },
});
// resolve: (f: CitationFeature) => Effect.Effect<typeof StandardIdentifier.Type, NotFoundError | HttpError>
```

*Sources: ELI, ECLI, Akoma Ntoso/FRBR, BO-ECLI, DALOS*

### Term vs Concept (many-to-many) + SKOS scheme

Lexical terms (lemma + language + jurisdiction) are kept distinct from concepts (meanings) in a many-to-many relation, accommodating synonymy and polysemy; concepts live in a SKOS ConceptScheme with prefLabel/altLabel and broader/narrower.

```ts
class Term extends S.Class<Term>($I`Term`)({ lemma: S.NonEmptyString, language: LanguageCode, jurisdiction: JurisdictionCode }) {}
class Concept extends S.Class<Concept>($I`Concept`)({ iri: IRI, prefLabel: S.String, altLabels: S.Array(S.String), definition: S.OptionFromOptionalKey(S.String), broader: S.Array(IRI) }, $I.annote("Concept", { semanticSchemaMetadata: makeSemanticSchemaMetadata({ kind: "vocabularyTerm", canonicalName: "Concept", canonicalIri: "http://www.w3.org/2004/02/skos/core#Concept", preferredPrefix: "skos" }) })) {}
class TermConceptLink extends S.Class<TermConceptLink>($I`TermConceptLink`)({ termId: TermId, conceptIri: IRI }) {}
```

*Sources: Eunomos, ELTS/MIREL, SKOS (W3C), FOLIO*

### Schema annotation as RDF/OWL projection bridge

Each branded type/field carries its ontology IRI and construct-kind as a typed Schema annotation; a generic projector reads them back via AST walk and emits Turtle/JSON-LD/OWL/SHACL. The schema is the single source of truth for types, persistence, AND ontology.

```ts
// existing mechanism in @beep/rdf, made load-bearing
const classMetadata = makeSemanticSchemaMetadata({
  kind: "ontologyConstruct", canonicalName: "PatentApplication",
  canonicalIri: "https://beep.dev/ip#PatentApplication", preferredPrefix: "ip",
  representations: [{ kind: "Turtle" }, { kind: "JSON-LD" }, { kind: "JSON Schema" }],
});
// project: getSemanticSchemaMetadata(schema) -> NamedNode/Quad -> serializeQuad -> Turtle
```

*Sources: beep @beep/rdf SemanticSchemaMetadata, LinkML, gftdcojp/ontology, DSAP/Francesconi*

### AI-acquisition contracting vocabulary (product-specific)

Emerging concepts the product target requires: closed-pool vs open-pool AI systems, embedded/sneaky AI, the AI accountability waterfall, data rights, and output ownership; and the precise legal-vs-technical sense of 'ontology' itself (Ekagra v. CBP turned on a definition mismatch).

```ts
const AiSystemPool = LiteralKit(["closed_pool","open_pool"]);
const AiVisibility = LiteralKit(["embedded","disclosed","sneaky"]);
class AiAcquisitionTerm extends S.Class<AiAcquisitionTerm>($I`AiAcquisitionTerm`)({
  pool: AiSystemPool, visibility: AiVisibility,
  dataRights: S.Array(LiteralKit(["input","output","training","derivative"])),
  outputOwnership: LiteralKit(["vendor","customer","shared","unspecified"]),
  accountabilityWaterfall: S.Array(LawPractice.PartyId),
}, $I.annote("AiAcquisitionTerm", { description: "AI-acquisition contracting concept; distinguish technical vs contractual 'ontology' senses." })) {}
```

*Sources: IPWatchdog brief (product target), GSA AI Terms & Conditions, Ekagra v. CBP*


---

## Appendix B — Provenance & Method

**Corpus.** Two collections were merged and de-duplicated:

- The 19 unique papers in the "most-similar" set beside this document (22 files; 3 exact reprints collapsed) — the classic legal-ontology canon: FOLaw, the frame-based ontology, LRI-Core, LKIF-Core, UFO-L, the four-/two-ontology comparisons, the systematic mappings, and the methodology papers.
- 53 papers selected from `~/YeeBois/research/ontology_research/IP_ONTOLOGY_AI_RESEARCH/pdfs` — triaged from **449 candidates** down to the highest-signal set (the rest were either off-topic for a legal ontology — chemistry, optimization, generic ML — or kept as catalogue-only).

The 72 deep-read papers were grouped into seven thematic shards and distilled cluster-by-cluster before a master synthesis: **CORE** (foundations, relations, Hohfeld, legal facts, normativity), **NORMS** (deontic, rules, contracts, compliance), **IP** (patent & intellectual-property ontologies), **NLP** (legal text → ontology extraction), **ARG** (argumentation, evidence, standards/identifiers), and **SURVEY/METHOD** (surveys, mappings, ontology-engineering methodology).

**The wider corpus (catalogued, not deep-read).** Beyond the 72, the triage tagged ~240 further on-topic papers worth mining later, concentrated in: legal-NLP / knowledge-graph extraction (~97), general legal-ontology & adjacent (~50 "other-relevant"), ontology-engineering methodology & tooling (~22), additional legal-core ontologies (~22), digital-rights / licensing (~15), deontic / norms / contracts (~15), and IP / patent (~13). If this guide proves useful, that backlog is the next seam to mine — especially the legal-NLP/extraction cluster, which is the most directly relevant to turning office actions and opinions into typed claims.

**Reference implementations studied as live code.** `effect-ontology` (Effect-TS OWL→LLM-prompt pipeline), `effect-langextract` (source-grounded extraction with `CharInterval` spans), Palantir `osdk-ts` (ontology-as-generated-TypeScript), `ontouml-js` (UFO/OntoUML model manipulation), and **FOLIO** (ALEA Institute's open OWL legal ontology + enrichment pipeline). One repo study (`ontouml-js`) did not return a structured result in this run; its lessons are carried via the web/UFO findings instead.

**Fact-checking.** 14 load-bearing factual claims were independently verified against primary sources: **13 confirmed**, **1 corrected** — FOLIO is organized into **24 top-level branches** (the `FOLIOTypes` enumeration), not 27; its other attributes (ALEA Institute publisher, CC-BY data license, 18,000+ concepts, opaque `R`-prefix IRIs with SKOS labels) check out. That correction has been applied throughout. The draft was additionally run through an adversarial review for Effect-Schema idiom accuracy, legal-ontology accuracy, and internal consistency; the flagged code/terminology defects were corrected before publication.

**Known soft spots (read code critically).** Illustrative schemas across sections occasionally drift in field names (`subject`/`bearer`/`normSubject`) and base classes — each concept has one canonical form in the Blueprint (§6); treat earlier appearances as sketches. A few helper names (`S.OptionFromOptionalKey`, `annoteSchema`) should be checked against the live `@beep/schema` surface before use. Where this guide cites empirical figures from the UFO-L line of work, treat them as "reported" pending a check against the specific source paper; the local UFO-L copies describe some experiments as planned.

**Method, in one line.** ~120 LLM agents across extract → ground → distill → write → verify → critique, deterministically orchestrated, ~4.8M tokens. The point of the harness was not volume but *triangulation*: every load-bearing claim has either a paper, a standard, a repo, or a line of `beep-effect` source behind it.

---

*Generated 2026-06-29 for `~/YeeBois/projects/beep-effect`. This file lives beside its source corpus; move it into the repo (`docs/` or `explorations/`) if you want it tracked.*

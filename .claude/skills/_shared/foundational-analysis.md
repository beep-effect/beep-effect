# Foundational Analysis — Axioms and Failure Modes

Shared reference for all ontology skills, primarily `ontology-foundational-auditor`.
Distilled 2026-08-28 from a foundational-ontology adversarial review (UFO/OntoUML/
OntoClean lens) and its follow-up deep-research report; provenance at the bottom.

## The six laws

| Law | Enforcement |
|---|---|
| **Syntax is evidence, not ontology** | Observation stages emit `SourceObservation`; they may never emit `owl:Class` |
| **Every symbol may denote nothing in the domain** | Every `DenotationHypothesis` carries an explicit null hypothesis |
| **Category decisions require metaphysical tests** | Identity, rigidity, dependence, temporality, relational dependence are analyzed before admission |
| **LLMs propose; deterministic systems verify** | Parsers own source facts; reasoners own entailment; validators own conformance |
| **Negative inference requires declared closure** | No decision-bearing negation without a completeness/snapshot contract |
| **Only a named human accepts existential commitments** | Accepted ontology changes require steward ratification |

The governing principle: **ontology engineering is the disciplined control of
commitments, not the production of vocabulary.** Mechanical extraction can establish
"source says representation x exists." It cannot establish "x is an ontological
class," let alone subsumption, equivalence, rigidity, or identity provision.

## The category cheat-sheet (OntoUML stereotypes, programmer's PRIORS)

The "software analogue" column is a starting HYPOTHESIS to test, never a
conclusion to draw — an id column does not settle identity and an enum does
not settle phase semantics (see the failure-mode table below; concluding the
category FROM the analogue is itself the identifier-is-identity /
enum-is-taxonomy shortcut).

| Stereotype | Meta-properties | Software analogue (prior to TEST) | Classic bug it prevents |
|---|---|---|---|
| **Kind** | Rigid, supplies identity | Often surfaces as the entity class the system re-identifies — but the identity CRITERION (what makes two individuals the same), never the id column, is what qualifies it | — (this IS the sortal) |
| **Subkind** | Rigid, inherits identity | A rigid specialization of one identity provider | Inheriting two incompatible identity criteria |
| **Role** | Anti-rigid, relationally dependent | A projection that exists only while a relation holds (`holder`, `requester`) | Role-as-kind: modeling `Requester` as a rigid class |
| **Phase** | Anti-rigid, intrinsically conditioned | Often surfaces as a state field over a closed enum — but an enum member may equally be a code, an individual, or nothing; the intrinsic-condition test decides | State-as-kind: `class ActiveGrant extends Grant` |
| **Relator** | Reifies a relationship; mediates participants | The join entity that carries the relationship's OWN properties (a lease: weight, expiry, holder) | Relator collapse: reducing a lease to a binary property |
| Plan/Specification vs Execution | Repeatable description vs dated occurrence | `Effect<A>` vs the running fiber; a task definition vs its run | Spec/execution merge: "the BuildPlan consumed CPU" |
| Information object vs referent | The record vs what it records | A log record vs the failure occurrence | Artifact/referent merge; evidence-is-truth |

Decision rule: **if it can be rerun, split specification from execution. If its truth
changes with context, reify the context. If it exists only because participants stand
in a relation, test the relator pattern. If membership can change without the
individual ceasing to exist, test role/phase rather than kind/subkind.**

## Software-domain failure modes (audit checklist)

| Failure mode | Symptom | Defense |
|---|---|---|
| Implementation-is-reality | Every interface/type becomes a class | Candidate ledger + denotation analysis with null hypothesis |
| Enum-is-taxonomy | String union becomes subclasses | Controlled vocabulary / `sh:in` unless class semantics justified |
| State-is-kind | Status subclassing | Phase analysis |
| Role-is-kind | Relational membership modeled rigidly | Role/dependence analysis |
| Specification-is-execution | Definition and run share identity | Plan/execution split |
| Evidence-is-truth | Green result = correctness "proof" | Evidence + applicability-context model |
| Identifier-is-identity | String ID assumed to settle sameness | Explicit identity criterion |
| Snapshot-is-continuant | Enduring object conflated with changing state | Separate the continuant from its snapshots |
| Current-state timelessness | "current X" as timeless fact | Temporal/snapshot indexing |
| N-ary relation flattened | Jointly-conditioned validity as independent binary edges | Reified applicability/context pattern |
| Estimate-as-quality | P50/P95 as intrinsic timeless property | Estimate object with window/population/estimator provenance |
| Percentile-as-bound | P95 compared to a "maximum" | Split prediction ≠ admission charge ≠ hard limit |
| Policy-as-fact | Normative requirement read as descriptive state | Explicit obligation/policy layer distinct from procedure |
| Query-is-definition | SPARQL answers CQ ⇒ ontology deemed correct | Logical definitions + executed fixtures |
| Domain/range-as-validation | OWL domain/range used to reject bad data | SHACL for integrity; OWL causes inference |
| OWA/CWA collapse | `FILTER NOT EXISTS` read as negation | Declared per-predicate closure contract |
| Vacuous green | Zero-rows constraint passes on empty antecedent | Antecedent non-vacuity companion tests |
| `sameAs`/equivalence overreach | Lexical similarity → identity collapse | Conservative mappings; human-controlled equivalence |
| Temporal-association-as-causation | KPI moved after change ⇒ "intervention worked" | Observational naming unless design supports causality |
| Consensus-as-proof | N models agree ⇒ accepted | Consensus is advisory; countermodels + steward decide |
| Drifted ontology | Repo changed after extraction | Commit pinning + observation drift detection |
| Parse-only certification | Queries parse ⇒ suite trusted | EXECUTE against seeded graphs + must-fail counterexample fixtures |

## Admission discipline

Every accepted term needs an explicit justification of one of two kinds:

- **decision term** — directly required to answer a Must/Should competency question;
- **semantic-support term** — required to define, constrain, disambiguate, or preserve
  the correctness of a decision term (e.g. an Obligation class between a tier and the
  procedures that discharge it).

Valid successful outcomes of analysis: `no domain referent`, `unrelated`,
`insufficient evidence`, `multiple models remain viable`. Models are empirically weak
at asserting unrelatedness (CORE 2026 finding) — a pipeline that punishes abstention
manufactures hallucinated relations.

## Provenance

Derived from: (1) an external foundational-ontology adversarial review of the
beep-ci-operational-ontology exploration packet (2026-08-27; preserved as
round2-partner-review2.md under that packet's research/reviews/pre-s4/
directory on its working branch), and (2) the follow-up deep-research report "A Reusable
Foundational-Ontology Adversary for Software Repositories" (2026-08-28). Primary
literature: Guizzardi et al. (UFO), Guarino & Welty (OntoClean), OntoUML spec,
Grüninger & Fox (CQ methodology), OBO Foundry principles, W3C OWL 2 Profiles / SHACL /
PROV-O, SPIRES/OntoGPT, DRAGON-AI, CORE benchmark preprint.

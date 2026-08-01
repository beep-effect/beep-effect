---
track: 3
name: legal-graphrag-temporal
generated: 2026-08-01
distillateCount: 19
---

# Track 3 — Legal GraphRAG + Temporal/Diachronic Norm Reasoning

Synthesis over the track-3 distillates: ontology-driven GraphRAG, LegalGraphRAG, legal-RAG failure modes, diachronic norm
modeling, reasoning paths extracted from judgments, and temporal KG agent memory. Ten merged claims entered adversarial
verification across source-fidelity, beep-fit, and novelty-vs-wave-1 lenses; all ten survived 2-of-3 or better.

## Verified findings

### F1 — Legal time is bitemporal-plus, and supersession is adjudication-gated (imp. 5)

Legal time needs at least three separately queryable concerns: immutable recording/system time, legal valid time, and
applicability to governed facts. P055 separates transaction/recording time from valid time and further splits entry into the legal
order from applicability, including vacatio legis, retroactivity, tax anteriority, and lex mitior; KG ingestion time is a gap the
distillate identifies, not something native LRMoo already models (P055, L14).

The applied systems model validity only or omit temporal semantics: P018/P019 use half-open validity intervals, P005 carries
effective/ineffective time, P042 and P064 have no bitemporal legal model, and P048 lacks version validity (P018, P019, P005, P042,
P048, P064). P054 is the pre-bitemporal predecessor; P078 requires independent valid/transaction intervals; L14 contributes
entry/efficacy/applicability rather than KG system time (P054, P078, L14).

Zep supplies the concrete anti-pattern: later contradictory input can close an older edge's valid interval, so transaction order
becomes an unreviewed legal verdict (P099). Temporal overlap should create a contradiction candidate; competing assertions remain
additive with authority, confidence, scope, and an explicit adjudication state, including unknown (P099, P078).

- Evidence: P055, P054, P018, P019, P005, P048, P042, P099, P078, L14, and P064.
- Routing: epistemic slice — an applicability qualification over the shipped bitemporal edge substrate, plus legal scope inputs to
  contradiction triage.
- Changes: preserves the existing no-mutation adjudication doctrine; the net-new decision is how entry/efficacy/applicability
  compose with `validAt`/`knownAt` without becoming ambiguous timestamp columns (P055, L14).

### F2 — Norm evolution is an event log, not a decorated amendment edge (imp. 5)

Enactment, amendment, repeal, and suspension should be first-class n-ary events binding the commanding source provision,
predecessor version, successor version, actor, time, and typed legal effect (P018, P019, P055, P078). Version intervals are then
derived from creation/termination events, while unchanged component versions are reused across snapshots rather than cloning an
entire document tree (P018, P019, P054, P055).

The convergence is two related modeling lines plus a requirements survey, not three independent studies: P018/P019 are the same
manuscript, and P054/P055 are successive versions of one LRMoo research line (P018, P019, P054, P055). P054 uses
`F28 Expression Creation`; P055 revises the transition to joint `F27 Work Creation`/`E64 End of Existence` typing for replacement,
while P078 independently requires reified validity-affecting events (P054, P055, P078).

P083 supplies the relation-law needed around those events: causation is event-driven change over time, whereas constitution is
timeless rule-mediated support, so they must not collapse into one generic relation family (P083).

- Evidence: P018, P019, P054, P055, P078, and P083.
- Routing: epistemic slice — change-event claim schema and causal-versus- constitutive relation taxonomy;
  `uspto-patent-driver-depth` — prosecution actions as n-ary claim-version transitions (P055, P083).
- Changes: makes the causal event, not a bare interval or `amends` edge, the auditable source of version creation and termination
  (P055, P078).

### F3 — LegalRuleML is a schema donor, but needs a new legal-domain owner (imp. 5)

LegalRuleML Core 1.0 supplies a concrete schema backbone: a closed statement union for factual, constitutive, prescriptive,
override, penalty, and reparation statements; a separate deontic union for obligation, permission, prohibition, right, and
`SuborderList`; and orthogonal strict, defeasible, and defeater strengths (L14).

`Override` is an explicit directed precedence relation, not a numeric rank. `Alternatives` is a non-empty mutually exclusive
interpretation set whose selection must be another contextual or epistemic assertion, never ingestion mutation. Entry-into-force,
efficacy, and applicability form a named temporal domain rather than one generic date label (L14).

This is not literally one-to-one adoption: compact XML requires canonical normalization, the standard does not choose the legally
correct alternative, and its directed modalities do not cover the full Hohfeldian power/liability/ immunity/disability space
(L14).

- Evidence: L14.
- Routing: a new legal-rule/domain slice using schema-first tagged unions and entities, composed with epistemic claims; not the
  current SKOS-only `@beep/ontology` registry mission (L14).
- Changes: reopens LegalRuleML as an implementation-grade schema donor for a later rule slice without importing its XML tree as
  the domain model or widening semantic-foundation M1 (L14).

### F4 — Retrieval should be deterministic first and policy-disclosed (imp. 5)

Resolve exact identity, authored hierarchy, scope, language, and point-in-time eligibility before vector ranking; then let an LLM
plan over fixed typed primitives for snapshot lookup, lineage traversal, version comparison, impact analysis, and provenance
reconstruction (P005, P018, P019, P078). Half-open intervals and policies such as `SnapshotLast` must be explicit, and every
answer should carry the temporal, membership, retrieval, and fallback policies it actually used in a machine-readable provenance
annex (P018, P019). P099 supports predefined graph operations, although its fixed Cypher claim concerns graph writes rather than
proving this whole retrieval design (P099).

SOLAR's tax-law experiment quantifies the value of structured scaffolding: 77.9% average accuracy versus 32.4% zero-shot, roughly
half the token cost, and a reasoning/non-reasoning model gap reduced from 68.2 to 5.9 points (P056). Those numbers support
deterministic legal scaffolding in a tax-law PoC; they do not benchmark the proposed GraphRAG stack itself (P056).

- Evidence: P018, P019, P005, P056, P078, and P099.
- Routing: beep-owned epistemic graph retrieval services plus OIP solo-practice workflows, exposed as typed Effect contracts with
  an answer provenance annex; do not depend on unowned Cognee internals (P078).
- Changes: makes retrieval policy part of answer provenance and constrains the agent to named operations instead of generated
  graph queries (P018, P078).

### F5 — Reify legal application as a claim-bearing inference event (imp. 5)

P028's judgment graph uses `Fact -> Application <- Norm <- Provision`, making the reasoning step itself addressable instead of
hiding it in a text-to-text edge. On 648 judgments and 44,447 nodes, it reports micro recall 0.667 versus 0.351 for GPT-4o+RAG at
provision-retrieval `k = 3`, with expert-validated extraction F1 from 0.93 to 1.00 per class (P028).

The benchmark is suggestive, not causal proof that reification alone beats RAG: it has no reification ablation and uses
LKG-derived gold labels (P028). P030 adds a caution from reasoning-path extraction: its reasoning classes are the weakest
extracted classes, with precision around 0.36-0.41 (P030).

- Evidence: P028 and P030.
- Routing: epistemic slice — an inference-event claim with typed fact and norm premises, conclusion/application, provision
  identity, evidence, and provenance (P028).
- Changes: extends a binary-edge substrate with an n-ary, reviewable inference object while treating the reported retrieval gain
  as a hypothesis to reproduce, not an established causal result (P028, P030).

### F6 — Separate Work, temporal version, language version, and text-unit identity (imp. 5)

Legal identity has four levels: an abstract Work that persists through wording change, a temporal-version identity, a
language-version identity, and the retrievable text unit. Conceptual membership, Work partonomy, realization, and Expression
composition are distinct relation families with distinct domains (P018, P019, P055).

The source family contains a load-bearing incompatibility: P054 types Temporal Versions as `F2 Expression`, while P055 revises
them to distinct `F1 Work` instances and supplies no migration rule. A beep model must choose and test one assignment rather than
mixing both papers' properties (P054, P055).

- Evidence: P054, P055, P018, and P019.
- Routing: a legal document/norm identity slice adjacent to semantic-foundation and consumed by epistemic retrieval; this exceeds
  the current SKOS registry packet and needs explicit packet admission (P054, P055).
- Changes: prevents stable norm identity, dated legal state, translated wording, and retrievable spans from collapsing into one
  mutable document node (P018, P019).

### F7 — Evidence grounding is provision-fragment granular (imp. 5)

Legal claims should resolve to structured sub-document locators before optional character offsets: Article-Paragraph-Point in
P064, persistent legal fragment identifiers in P074, and LegalRuleML associations down to provisions, sentences, words, atoms, and
atom fragments in L14 (P064, P074, L14). P099 proves a weaker episode back-link for agent memory, not universal fragment-level
grounding, so it is corroboration for traceability rather than evidence that every system already reaches legal-fragment
granularity (P099).

LegalRuleML's isomorphism principle supplies the doctrine: source text remains legally binding, while a formal rule is a traceable
model of it. Source-to-rule mapping is many-to-many and should preserve structured identifiers plus optional offsets (L14).

- Evidence: P064, P074, L14, and P099.
- Routing: epistemic `EvidenceSpan` value object plus patent and government- legal locator variants, with source/rule many-to-many
  joins (L14, P064).
- Changes: deepens today's character-offset evidence into durable provision identity without discarding exact-span support (L14,
  P074).

### F8 — Extraction is schema-gated; vocabulary mutation is quarantined (imp. 4)

Ontology-in-prompt extraction is promising but not self-validating: P042 reports 93% precision and 89% recall for RDF generation
versus an estimated 50-60% for LlamaIndex property-graph extraction, at about $2.5 per 1,000 documents (P042). Post-hoc validation
remains necessary because P044's best fused pipeline reaches only 72.6% exact domain-range signature compliance and models can
smuggle modality into predicates such as `mustNotExceed` (P044).

Embedding fusion and synonym merging can erase legally load-bearing distinctions such as obligation versus prohibition; P064's
beta=0.6 cosine merge is a concrete risk, not evidence of legal equivalence (P044, P064). Zep's free-form all-caps predicates and
P078's rejection of bottom-up LLM-extracted graphs as ontology substitutes reinforce the same boundary (P099, P078).

- Evidence: P042, P044, P099, P078, P056, and P064.
- Routing: semantic-foundation registry governance and shape constraints; `uspto-patent-driver-depth` extraction; agent-memory
  projections that retain unmatched phrases as reviewable schema-change candidates (P042, P078).
- Changes: confirms wave-1's validate-before-admit doctrine and adds a named quarantine state so extraction never silently expands
  authoritative vocabulary (P042, P044, P099).

### F9 — Contradiction triage starts with legal scope alignment (imp. 4)

Contradiction is meaningful only after claims align on forum, jurisdiction, proof standard, temporal context, and the relevant
parties or institutional viewpoint. P083's `PointOfView` lets contrary civil and criminal proof findings coexist without making
the whole graph inconsistent (P083).

LegalRuleML `Context` scopes source, time, strength, authority, jurisdiction, and alternatives, while its skeptical defeasible
posture withholds unresolved contrary conclusions rather than exploding (L14). P078 requires parallel operative interpretations
indexed by court, chamber, procedure, territorial scope, precedential force, and affected parties (P078).

The safe sequence is candidate generation from temporal overlap, then subject/predicate/object, scope, and evidence alignment,
then an explicit adjudication state including unknown; this is the corrective recommendation derived from Zep's unsafe
newer-input-wins behavior (P099).

- Evidence: P083, L14, P078, and P099.
- Routing: epistemic contradiction triage — a generic scope-context value object with legal forum, jurisdiction, proof-standard,
  temporal, and PointOfView specializations (P083, L14).
- Changes: the candidate-align-adjudicate pipeline already exists in packet doctrine; the net-new delta is the legal scope schema
  required before two claims can qualify as comparable (P083, P078).

### F10 — Agent memory needs raw episodes, lossy projections, and a short-horizon fallback (imp. 4)

Zep's three tiers separate raw episode nodes, resolved semantic entities and edges, and community summaries. The transferable
pattern is non-lossy episodes as the audit base, with resolution, semantic edges, and summaries treated as regenerable lossy
projections; the evidence is vendor-authored and not an independently validated template (P099).

On LongMemEval with GPT-4o, about 1,600 retrieved tokens score 71.2% versus 60.2% for roughly 115,000-token full context at about
90% lower latency; temporal reasoning rises from 45.1% to 62.4% (P099). The counter-result is equally architectural:
single-session-assistant accuracy falls from 94.6% to 80.4%, motivating a recent-raw-episode fallback for short-horizon recall
(P099).

Similarity and community links remain retrieval aids, never asserted legal semantics (P048). P025's citation/similarity prediction
reaches only 0.62 and 0.556 AUC, reinforcing a separate non-claim relation family; P028 provides the contrast with explicit
claim-bearing application nodes (P025, P028).

- Evidence: P099, P048, P025, and P028.
- Routing: agent memory/Cognee — episode-versus-projection separation, hybrid retrieval, recent-raw fallback, and relation-family
  typing for claim versus retrieval-aid edges (P099, P048).
- Changes: narrows an already-standing architecture doctrine to two new rules: keep an explicit raw fallback and forbid
  similarity/community edges from acquiring claim status (P099, P025).

## Contradictions & challenges to standing decisions

No finding overturns a wave-1 or `goals/semantic-foundation` conclusion. One scope challenge should be made explicit rather than
silently routed:

1. **F3 reopens LegalRuleML's future-use deferral, not its M2/M3 rejection.** Wave-1 rejected LegalRuleML for P2 implementation
   because its XML artifacts did not supply the classification or role/deadline vocabulary needed by M2 and M3
   (`legal-ontology-landscape/research/03-legal-core-ip-ontologies.md:80-87`). L14 now supplies a concrete schema mapping for
   statements, deontic forms, override, alternatives, source association, and temporal context (L14). The challenge is to the
   indefinite “inspire later” posture: /adhd should decide whether to charter a separate legal-rule slice. It does not justify
   widening semantic-foundation M1, importing LegalRuleML XML as domain data, or reversing the original M2/M3 verdict (L14).

F6's four-level identity model likewise exceeds semantic-foundation's bounded SKOS registry, but that is a routing boundary rather
than a conflicting conclusion; it should enter a new packet instead of mutating M1 scope (P054, P055). F8 confirms, rather than
challenges, wave-1's schema/SHACL admission direction (P042, P044, P078, P099).

## Rejected in verification

None; all 10 merged claims survived 2-of-3 adversarial verification.

## Open questions for the /adhd integration pass

1. Does the legal-time increment become an applicability/context value object composed over `validAt`/`knownAt`, or a separately
   chartered temporal rule model, without smuggling domain semantics into the edge core (P055, L14)?
2. Can one generic change-event aggregate serve statute amendments, judicial interpretation changes, and patent prosecution claim
   transitions, or do their typed effects require separate event families (P055, P078, P083)?
3. Which LegalRuleML subset earns a V1 schema donor profile, and where is the package boundary that keeps it out of
   semantic-foundation M1 (L14)?
4. For Temporal Version identity, does beep choose P054's `F2 Expression` or P055's `F1 Work`, and what fixture proves
   relation-domain consistency across Work, version, language, and text-unit levels (P054, P055)?
5. What is the smallest fixed retrieval API that covers point-in-time lookup, lineage, version comparison, impact analysis, and
   provenance reconstruction while still exposing typed unsupported-operation failures (P018, P078)?
6. How should the answer provenance annex encode temporal policy, membership policy, language fallback, retrieval parameters,
   rejected candidates, and incomplete-lineage warnings (P018, P019, P005)?
7. What independent benchmark avoids P028's LKG-derived-gold circularity and isolates whether inference-event reification improves
   retrieval or merely accompanies a better curated graph (P028, P030)?
8. Which structured locator families belong in `EvidenceSpan` first — legal provision, patent claim/paragraph, judgment paragraph,
   and episode — and how are many-to-many source/rule mappings versioned (L14, P064, P074, P099)?
9. What governance state machine moves an unmatched extracted phrase from quarantine to registered concept without allowing
   similarity thresholds or extractor prompts to become ontology authority (P042, P044, P064, P099)?
10. What short-horizon threshold selects raw-episode fallback versus graph projection retrieval, and can it reproduce Zep's
    temporal gains without its single-session regression (P099)?

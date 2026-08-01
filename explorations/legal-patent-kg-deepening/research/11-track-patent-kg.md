---
track: patent-kg-fopnet
name: "Patent knowledge graphs + functional patent knowledge (FOPNet)"
generated: 2026-08-01
distillateCount: 15
---

# Track 2 — Patent KGs + Functional Patent Knowledge (FOPNet)

Synthesis over the track-2 distillates (FOPNet functional model, PatentLEGO,
Patent-KG, KLIPA, LOD-USPTO, MIFEA entity alignment, citation-relevance
empirics, classification-landscape studies, patent-figure NER). Ten claims
entered adversarial verification (source-fidelity, beep-fit/routing, novelty
lenses); all ten survived at 2-of-3 or better — eight unanimously, one (F7)
with a novelty-lens dissent and one (F4) with confirmed wave-1 overlap on the
concept-layer half, both noted inline.

## Verified findings

### F1 — FunctionalUnit profile beside patent entities, own schema, not an imported ontology (imp. 5, PRIORITY)

The FOPNet + PatentLEGO thread converges on one design: a FunctionalUnit
profile layered BESIDE publication/family/claim/embodiment entities, never
replacing them (R19). It is built from two composable graph patterns —
component → participates-in interaction → realizes effect → implements
function; and total function → decomposes-into sub-function → realized-by
component (P001) — plus directional typed ports: type + subtype + free-text
spec, an optional-flag on inputs, `is_primary | is_waste` on outputs, over
~6 resource families (R19). The normalized function-verb taxonomy enables
sibling-function substitution (cutting vs detaching under separation) as a
redesign/ideation operator (P001); port-subtype equality only *nominates*
candidates — compatibility is a separate evidence-producing judgment emitting
satisfied/violated/missing constraints (R19). Neither source ships an RDF/OWL
artifact or URI policy, and "every patent → one block" is the wrong
granularity: a single claim or embodiment can yield multiple functional units
(R19). Beep should formalize this as its own Effect-Schema design, not import
an ontology.

- Routing: `explorations/uspto-patent-driver-depth` +
  `goals/semantic-foundation` (`@beep/ontology`): FunctionalUnit + typed-port
  + CompatibilityAssessment schemas layered on existing patent entities; the
  function-verb vocabulary as a SKOS concept scheme with broader/narrower +
  synonyms. (Verifier note: the `agentic-cad-patent-tooling` leg is weak —
  that goal is a completed repo-agnostic buyer's-guide report and designs no
  schemas; do not route FunctionalUnit work there.)
- Changes: gives the packet its priority-thread deliverable shape — a
  clean-room functional-profile schema family, not an ontology import.

### F2 — Citations must be reified; a bare `cites` edge is analytically wrong (imp. 5)

Citation provenance (applicant/examiner/both — only 6.6% of office-action
references were identified by both), office-action use, and textual-relevance
score each change inference, and the sign actually reverses: aggregate
applicant/examiner citation relevance associates POSITIVELY with grant while
office-action-cited relevance associates NEGATIVELY (P017). Bare `citedBy`
adjacency is the real status quo being refuted (P006, P041). Citations must
be reified as qualified edges or citation-event nodes carrying provenance,
office-action linkage, submission time, and similarity-method metadata.
Face-list relevance, office-action reliance, and model similarity are three
coexisting claims the epistemic slice must hold simultaneously — never
collapsed into one "prior art relevance" truth (P017).

- Routing: epistemic slice (bitemporal edges, claims, contradiction triage) +
  `uspto-patent-driver-depth`: citation ingestion as provenance-bearing
  citation-event claims. Caveats: the sign reversal is observational; the
  6.6% figure is scoped to office-action-cited references.
- Changes: hard constraint on the driver's citation ingestion schema from
  day one — no bare adjacency ever enters the graph.

### F3 — Classification membership is a criterion-bound, provenance-bearing claim (imp. 5)

Patent-category membership is never an intrinsic Boolean: the
quantum-landscape study needed a ten-query sensitivity-to-specificity ladder
where "quantum patent" at S1 anywhere-mention = 178,033 grants vs S4
independent-claim-limitation = 10,318 — the category only exists relative to
a named criterion (P052). LLM/encoder classifier choice systematically shapes
which technological categories become visible (P046), and IPC "first
appearance" novelty is corpus-local, not a universal technology birth date
(P033). Classification assertions should be (document, concept,
criterion/model-version, corpus, date) tuples.

- Routing: `goals/semantic-foundation` (CPC/IPC as versioned external SKOS
  schemes with criterion-bound scope notes — sharpens the M2 edition-tracking
  plan already in SPEC.md) + epistemic slice (classification-as-claim tuple).
- Changes: the SKOS-registry half is partly latent in wave-1 M2; the novel
  delta is the criterion-bound tuple shape for every classification claim.

### F4 — Never emit unconditional equivalence from similarity signals (imp. 5)

Three lines converge (all via one miner's critique stance, so "independent"
is soft): LOD-USPTO's `owl:sameAs` on invention titles is flagged
semantically risky (P006); MIFEA's best cross-graph entity alignment tops out
at Hits@1 80.7% with no abstention or calibration (P035); the Chinese IP-law
KG's TransE/Word2Vec alignment "cannot by itself establish legal
equivalence" (P073). Candidate equivalence must be a qualified mapping
assertion (score, method, model version, review state) — SKOS mapping
properties plus an epistemic-claim shape — with human confirmation gating
high-impact merges.

- Routing: `goals/semantic-foundation` (SKOS mapping properties over
  `owl:sameAs` — already ratified wave-1; the delta is the qualified-mapping
  metadata) + agent memory / Cognee entity-resolution: candidate-pool +
  rerank + abstention + human confirmation.
- Changes: instance-level identity discipline (abstention, review-state,
  human-gated merges) is new; the concept-layer rule is confirmatory.

### F5 — Mention-level extraction stays separate from concept identity (imp. 5)

The patent-figure NER study's 6,405 "distinct object names" and 2,210
"distinct aspect names" are string-level outputs, not equivalence classes;
its own limitations show both naive string dedup (conflates spelling/plural
variants) and naive normalization (erases legally material design qualifiers
like "jacket with scalloped shoulder regions") are unsafe (P097). Ingestion
needs a CaptionMention node distinct from canonical
ObjectConcept/ViewAspectConcept, with span provenance (patent id, figure id,
caption offsets, model/version, time, confidence) recorded before any merge;
free-text engineering specs stay evidence until normalized safely (R19).

- Routing: epistemic slice (claims + evidence spans) +
  `goals/semantic-foundation` SKOS registry: mention/concept split with
  candidate SKOS mappings rather than automatic identity.
- Changes: adds an extraction-time identity constraint wave-1 never decided;
  pairs naturally with `@beep/langextract` char-span grounding.

### F6 — Epistemic status decomposes into orthogonal axes; PatentLEGO's gaps are acceptance tests (imp. 5)

(a) Confidence vs review state are independent — PatentLEGO's
`confidence_score` beside `review_status` is the germ, but the clean-room
pattern is immutable append-only assessments over field-level claims with
assessor identity, evidence links, and dispute representation, deriving
display status rather than mutating a score, and never letting "reviewed"
erase disagreement. (b) Provenance-kind per field is required — without
distinguishing an asserted value, an NLP extraction, a reviewer correction,
and a measured property, a missing field is uninterpretable (not required?
not extracted? unknown? disputed?). PatentLEGO's negative space is a direct
acceptance-test list for the epistemic slice (R19).

- Routing: epistemic slice claim/assessment schema. Verifier correction:
  axis (a) largely re-derives shipped bitemporal-edge-core doctrine
  (append-only EdgeVersion + supersedes lineage); route the real delta —
  axis (b) per-field ProvenanceKind, explicit unknown/disputed states, and
  the negative-space fixture list — as extensions to `packages/epistemic`
  via the active contradiction-triage lane, not greenfield.

### F7 — Schema-constrained LLM extraction works; repaired syntax is not verified semantics (imp. 4)

The proven pattern is schema-constrained generation (allowed
entity/relation-type matrices, strict JSON) followed by parse-repair and
schema validation before graph insertion — but KLIPA and the CPC study both
expose the trap: syntax repair and non-empty fallbacks convert malformed
generations into schema-valid but semantically wrong output; schema validity
is not semantic truth (P041, P046). Beep's Effect-Schema decode boundary is
the natural home, provided repaired-syntax status is stored distinct from
verified-semantics status. Bonus: VQA models reading patent cover images beat
OCR+LLM on speed and accuracy (Qwen2.5-VL 92.35% RAE vs 78.50%) because OCR
destroys layout (P041) — cover-pages-only, unreleased dataset.

- Routing: `uspto-patent-driver-depth`: S.decode-gated triple ingestion with
  a repaired-vs-verified status field on every extracted claim (both
  distillates route that field to the epistemic slice); VQA fallback lane for
  layout-heavy pages, deterministic USPTO structured data always preferred.
- Novelty dissent (1 of 3 lenses): the core repair-loop +
  validity-is-not-truth pattern was already decided in wave-1
  (`legal-ontology-landscape/research/04`, items 4–5); the new material is
  the named empirical repair-trap evidence and the VQA lane. Treated as
  confirm-and-extend, not a fresh decision.

### F8 — Model-internal signals are derivation provenance, not epistemic confidence (imp. 4)

Patent-KG built 4.16M entities / 11.0M edges from BERT-attention-selected
triples but measured only vocabulary coverage (recall 0.82), so millions of
edges could be noise without moving the metric; it fails on passive/long
sentences and models no negation, modality, or coreference (P067). TransD
embedding scores likewise cannot carry epistemic weight (P073). Reusable
parts: patent-aware segmentation tricks — semicolon sentence boundaries,
letter-hyphen-letter compounds, phrasal-verb joining (P067). The rule: store
attention/beam-search paths as derivation trace, gate asserted relations
behind a typed extractor plus evidence-span review, admit ML completions only
as hypothesis-status claims.

- Routing: epistemic slice (claim schema separates confidence from
  derivation-trace provenance; ML completions enter as hypotheses) +
  `uspto-patent-driver-depth` (patent-aware tokenization/segmentation with
  span retention — future-facing; the packet is currently API-driver scoped).

### F9 — USPTO schema drift demands versioned mappings + schema-generated regression tests (imp. 4)

USPTO bulk data has real schema drift across years; the working pattern is
declarative year/version-specific mappings, not one universal parser: the
2005–2017 LOD conversion adjusted RML mappings per DTD generation, validated
with RDFUnit schema-generated tests, and still shipped an unresolved ~1.7M
triple count discrepancy between its own sections (P006). Mapping-version
provenance stamped on every emitted assertion is what keeps later corrections
tractable — a lesson inferred from the paper's gap, not demonstrated by it.
Also reusable: federated vocabulary via FOAF/DCTerms/RDFS plus dataset-local
namespaces split ontology-vs-property (P006).

- Routing: `uspto-patent-driver-depth`: versioned mapping modules per USPTO
  release generation, schema-derived regression tests in CI, mapping-version
  stamped on every assertion (bitemporally correctable). The BRIEF's drift
  contract already covers version stamping/fails-closed; the delta is
  generation-versioned mapping modules + generated regression tests.

### F10 — Small controlled vocabularies ship as flat SKOS seed schemes with composition-over-expansion governance (imp. 4)

PatentLEGO's 12 purpose facets (GEN/STORE/CONVERT/DISTRIBUTE/CONTROL/
STRUCTURE/SENSE/INTERFACE/TREAT/EMIT/COMPUTE/ACTUATE) plus orthogonal
context facets (energy role, scale, domain) work as separate flat concept
schemes with stable IDs — no class hierarchy (R19). Its observed vocabulary
drift (SOURCE/USE outside the 12; template ID PROCESS vs pattern COMPUTE;
inconsistent abbreviations) is exactly what conformance tests over a registry
should catch. Ports reference stable concept IDs, never mnemonic strings
encoding semantics twice. Port discipline: patentlego-ontology is
CC BY-SA 4.0 — clean-room reimplementation of the abstract ideas only, never
vendoring its tables/JSON as source constants or seed data (R19).

- Routing: `goals/semantic-foundation` `@beep/ontology` SKOS registry —
  scheme structure, LiteralKit-backed concept IDs, registry conformance
  lints; this packet carries the CC BY-SA port-discipline gate. Novel content
  routed into decided wave-1 structure (registry architecture is settled).

## Contradictions & challenges to standing decisions

No finding overturns a wave-1 (`legal-ontology-landscape`) or
`semantic-foundation` conclusion. Three near-challenges, honestly logged:

- **F7 vs wave-1 extraction doctrine** — one novelty lens ruled the
  repair-loop/validity-is-not-truth core already decided in
  `legal-ontology-landscape/research/04` (items 4–5, `extr:extractionMethod`
  repair-pass, XML-first item 10). Resolution: F7 confirms and extends
  (empirical trap evidence + VQA lane); no re-decision needed.
- **F1 routing vs `agentic-cad-patent-tooling`** — the original routing
  named that goal, but verification found it a completed, repo-agnostic
  buyer's-guide report that designs no schemas. Challenge is to the routing
  seed, not to the goal's conclusions: FunctionalUnit work lands in
  `uspto-patent-driver-depth` + `semantic-foundation` instead.
- **F6 axis (a) vs shipped epistemic-slice code** — append-only assessment
  doctrine already exists in `packages/epistemic` (ClaimDisposition /
  EdgeVersion supersedes lineage); treating F6(a) as greenfield would
  duplicate it. Only axis (b) (ProvenanceKind, unknown/disputed) is new.

## Rejected in verification

None — all ten candidate claims survived 2-of-3 adversarial verification.

## Open questions for the /adhd integration pass

1. Where does FunctionalUnit live long-term — inside the
   `uspto-patent-driver-depth` domain package or a new functional-profile
   slice under `@beep/ontology`? (F1 straddles both; R19's multi-unit
   granularity argues for its own aggregate.)
2. What is the minimal function-verb SKOS scheme to seed — a clean-room
   verb taxonomy in FOPNet's spirit (P001), given F10's CC BY-SA bar on
   vendoring PatentLEGO's actual vocabulary?
3. Should the (document, concept, criterion/model-version, corpus, date)
   classification tuple (F3) and the citation-event claim (F2) share one
   generic "qualified assertion" schema in the epistemic slice, or stay as
   two named shapes?
4. CompatibilityAssessment (F1) emits satisfied/violated/missing constraints
   — is that the same evidence shape as contradiction-triage findings, and
   can the triage lane host it?
5. Does the repaired-vs-verified status field (F7) generalize into
   ProvenanceKind (F6b), or are extraction-repair state and provenance-kind
   orthogonal columns?
6. Which of PatentLEGO's negative-space gaps (F6) become actual acceptance
   fixtures in `packages/epistemic` tests, and in which PR lane?

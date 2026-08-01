---
track: legal-core-hohfeld
name: "Legal core ontologies + Hohfeldian formalization"
generated: 2026-08-01
distillateCount: 34
---

# Track 1 — Legal Core Ontologies + Hohfeldian Formalization

Synthesis over the track-1 distillates (UFO/UFO-L, LKIF, Hohfeld ODPs, network
models of legal relations, legal facts/possibilities). Ten claims entered
adversarial verification (source-fidelity, beep-fit/routing, novelty lenses);
all survived 2-of-3 or better, none killed. Two carried a routing-only
beep-fit dissent, noted inline.

## Verified findings

### F1 — Hohfeld is a closed 8-position domain; correlativity is a schema invariant (imp. 5)

Encode the Hohfeldian vocabulary as a closed domain of eight positions in four
correlative pairs — Claim-Right/Duty, Privilege/No-Right,
Power/Subjection-Liability, Immunity/Disability — with correlativity as a
schema-level invariant: each pair is two views of ONE underlying directed
relation, derived deterministically, never stored as two facts that can drift
(P095, P093, P031). Positions split by Alexy action polarity, act vs omission
(P031/P032). Privilege is absence of duty toward a *specific* counterparty
(P093); power is distinct from permission — an act under a disability is
*void*, not illegal (P047). Convergent core across UFO-L (P086, P088), COFRIS
(P023), the Hohfeld ODP thesis (P075), and network models (P007, P004, P010).

- Routing: `goals/semantic-foundation` — Hohfeldian concept scheme in the
  @beep/ontology SKOS registry as a LiteralKit domain with a derived
  correlative/inverse bimap; never flatten every "right" into one concept.
- Changes: SPEC has zero Hohfeld content today. Caveats: P088's UFO-L expands
  to 14 positions via polarity/liberty composites (the polarity discriminant
  absorbs this); correlativity cannot live in plain SKOS (P093) — see F8.

### F2 — Legal relations are reified triadic relators, never binary edges (imp. 5)

Legal relations are first-class n-ary relators with identity, lifecycle,
parts, and mediated contingent roles (RightHolder/DutyHolder) — never bare
`hasRight`/`isPermitted` edges or unary deontic labels (P010, P086, P031). A
relator bundles paired externally-dependent position moments (right-to-omission
inhering in holder + duty-to-omit inhering in counterparty — P004, P010), is
brought about by a grounding legal fact/event, and is typed by a source norm
(P090/P091, P085). Complex relators (e.g. Protected Liberty) aggregate 2..*
simple relators with independently addressable positions (P088). Exactly the
shape beep's epistemic edge/claim model should carry — plus the bitemporal/
evidence/provenance dimensions every source model omits (L02, P049, P023, P047).

- Routing: `goals/epistemic-bitemporal-edge-core` + new @beep/ontology
  legal-core — legal-relation claims as reified n-ary edges with required
  holder/counterparty/object/position-pair fields, grounding event, source
  norm, evidence spans, valid/transaction time.
- Changes: shipped epistemic edge is binary supports/refutes/contradicts.
  Caveat: edge-core is completed-retained and @beep/ontology has no legal-core
  — relators fit better as domain aggregates *over* the retained substrate
  than as an edge rewrite; needs a reopen or new packet.

### F3 — Contradiction triage needs position-tuple alignment plus a typed priority stage (imp. 5)

Contradiction detection between legal claims is only sound at the
position-tuple level after priority resolution: align holder, counterparty,
action polarity, object/result, conditions, jurisdiction, and time before
declaring conflict — broad "right" labels produce false contradictions (P004,
P031/P032). Norm conflicts are not automatically contradictions:
rule-exception pairs need explicit priority knowledge (lex specialis/superior/
posterior, authority, specificity, effective time) held as a first-class
meta-legal lane (P063, P008, P062) with multi-axis entrenchment parameters,
never one precedence score (P014). The finding schema discriminates conflict
kinds: rule conflict (fulfilled-or-not) vs principle collision (balanced) vs
competing interpretation (P086) vs disputed event occurrence (synthesized from
P008, P014, P082).

- Routing: `goals/epistemic-contradiction-triage` — CONTRADICTS/QUALIFIES
  derivation keyed on position tuples and scope overlap, with a typed
  priority-resolution stage and conflict-kind discriminant before surfacing.
- Changes: the packet has only a bare `conflicted` status today. Lands as
  *re-scope input* — detection heuristics are an explicit stop-and-re-scope
  boundary (SPEC.md:137); see Contradictions below.

### F4 — Surveyed literature is static-only; beep's epistemic slice is a genuine gap-filler (imp. 5)

Every surveyed legal core ontology delivers static structure and omits what
beep is building: no bitemporality/revision provenance, no evidence spans, no
calibrated uncertainty or contradiction state, no competing-interpretation
objects, and inadequate procedure modeling — all four classic ontologies fail
on procedural competence norms (P013). LKIF deliberately deferred
epistemic-role *semantics* and argumentation (P043); UFO-L's thesis names rule
conflict, defeasibility, and temporal norm interaction as future work (P088,
P090/P091). The epistemic slice fills a real gap, not a reinvention — and
ontology (what things are) stays architecturally separate from the
epistemic/procedural layer (how knowledge functions, per FOLaw's
ontology-vs-epistemology split — P063), with office-action sequences/deadlines
in a dedicated procedure model, not static norm classes (P013, P043; gap
enumerations in P008, P002, P062, L01, L02, P014, P004, P023, P051, P093).

- Routing: epistemic slice architecture boundary — @beep/ontology holds
  concept schemes; claims/evidence/contradiction machinery is the separate
  epistemic layer; dedicated procedure model for OIP office-action workflows.
- Changes: mostly *ratifies* shipped architecture with literature grounding
  wave-1 never supplied; the net-new directive is the procedure model.
  Caveat: CLO/FOLaw carry some validity-state machinery, so "static only"
  slightly compresses.

### F5 — Claims are truth-indexed to system-and-time; absence states are distinct (imp. 5)

Every legal claim is truth-indexed to "system S at time t": mandatory
jurisdiction + legal-order + valid-time index fields, with law as a closed
inference prefix — mixing prefixed legal premises with unprefixed worldly
facts is unsound (P081). "No rule exists", "unknown", "silent", "allowed",
"not-breached", and "no fact of the matter" are distinct claim states;
negation-as-failure is invalid unless closure scope and information source are
explicit — the British Nationality Act logic-programming systems silently
smuggled in exactly these closure/execution-order commitments (P062).
Absences are ontological posits needing authoritative support; burden-of-proof
rules give uncertainties their legal consequences (P082).

- Routing: epistemic claim schema — required jurisdiction/legal-order/
  valid-time fields; claim-status enum separating no-rule/unknown/silent/
  indeterminate; OIP workflows flag conclusions importing unprefixed facts.
- Changes: only ClaimDispositionStatus and EdgeVersion bitemporality exist.
  The index fields and open/closed-world split were already accepted in
  wave-1 (edge-core 2026-07-25) — route only the residue: six-state enum,
  closed-prefix mixing rule, absences-as-authoritative-posits.

### F6 — Three identity layers: document / expressed content / interpreted norm; qualification is a claim (imp. 5)

Keep three identity layers strictly separate — physical document/fragment,
expressed content (normative text), interpreted norm — since one description
can express multiple norms and vice versa (P088, P014); DoCO/IAO's named
failure mode is conflating text blocks with the content they bear (P094).
Likewise separate a physical act from its institutional qualification:
"physical act qualifiesAs legal act" is a contestable, temporally scoped,
authority-conditioned claim, not a fact — the president's signature enacts, an
actor's staged signature does nothing (P081; P075's Legal Fact ODP
qualification pipeline). Conformity is deliberately permissive: one situation
may satisfy several unrelated descriptions (P014). Physical and institutional
layers stay separate linked nodes joined by evidence-bearing qualification
claims (P013, P008, P062, P063).

- Routing: @beep/ontology document-vs-content-vs-norm identity + epistemic
  slice — span → content-entity → claim chains; filing/assignment/office-action
  records as document events linked by qualification claims to legal effects.
- Changes: @beep/ontology's domain is a stub, so the layering is missing;
  @beep/epistemic's EvidenceSpan→CandidateClaim chains are the extension
  point. Needs a new packet — semantic-foundation's non-goals exclude this.

### F7 — Powers are network-rewriting operations; authorization gates agent workflows (imp. 5)

Exercising a power creates, modifies, or extinguishes other legal positions
via an institutional act with model-update semantics; the identical utterance
by an unempowered actor has NO legal effect (P093, P007). Hard authorization
gate for agents: a proposed filing, assignment, waiver, or license must not
mutate the KG until authority and constitutive conditions are proven;
ineffective/attempted acts are retained as distinct events; disabilities mark
void acts (P047). Relator lifecycles (inception/transfer/satisfaction/
fulfillment) map onto bitemporal edge revisions (P023). P075 is concrete
prior art — valid + transaction time on propositions, expired relations kept
as historical assertions with a derived "active" projection — whose known gap
(creation-instant-only transaction time, no correction intervals) is exactly
what beep's full transaction-time intervals fix. Patent payoff: a patentee's
exclusion right is a multital bundle of directed claim-rights; assignments/
licenses/prosecution authority are powered acts transforming position bundles
(P007, P093, P088, P090/P091, P031/P032 — the slashed pairs are duplicate PDFs).

- Routing: `goals/epistemic-bitemporal-edge-core` +
  `explorations/uspto-patent-driver-depth` — power-exercise events as
  append-only edge-revision transactions with an active-as-of view;
  authorization gating in OIP workflows; ownership/license/examiner-applicant
  positions as auditable relator bundles.
- Changes: the bitemporal half *confirms* shipped edge-core SPEC; additive
  value (authorization gating, position bundles) lands on the active
  uspto-patent-driver-depth / claim-lifecycle-gate side.

### F8 — No canonical legal ontology: layered, purpose-labeled, theory-provenanced modules (imp. 4)

Thirty years of comparisons converge on a layered architecture (foundation →
reusable legal core → jurisdiction/statute/task extensions) under an explicit
reusability-vs-completeness trade-off, with no gold-standard universal legal
vocabulary (P008, P013). Beep's SKOS-first registry should be a versioned,
purpose-labeled library of competing modules indexed by task/subdomain/
abstraction (P062), carrying source-legal-theory provenance as scheme metadata
— 38–47% of surveyed legal ontologies cite no legal theory, and theory choice
changes which concepts exist (P086, P087). Foundational ontologies (UFO/UFO-L,
DOLCE) and small vocabularies (FIBO LegalCore) are mapped donor/alignment
models referenced with IRI+version, never silently imported (L01, P004, P010,
P043). SKOS broader/narrower links are NOT substitutes for correlation,
opposition, dependence, or cardinality axioms — those belong in Effect schemas
or a rules/SHACL layer (P090/P091, P095, P063).

- Routing: `goals/semantic-foundation` registry governance — purpose-labeled
  schemes with theory-provenance metadata, governed SKOS mappings to donors,
  constraints enforced outside the taxonomy.
- Changes: core stance is wave-1 doctrine; increments are theory-provenance
  metadata, competing-module indexing, and the SKOS-links-are-not-axioms rule
  — additions atop M1/M4. Caveats: 47% bound unverified (38% grounds in
  P087/P090); P024 is padding; DOLCE only in literature-use counts.

### F9 — Competency questions convert into schema-required fields (imp. 4; survived 2-of-3)

UFO-L's Right-Duty elicitation questions (who holds the right, who the duty,
what act/omission, what result, grounding event, defining rule — P085, P088)
and the maritime seven-question checklist (P049) are ready-made required-field
lists: extractions omitting bearer, counterparty, act/omission, result, or
grounding source should fail S.Schema validation. Assignment and prosecution
relations get the same non-optional treatment instead of ad-hoc binary edges
(P049, P085; CQ documentation discipline in P075, P043).

- Dissent (beep-fit lens, routing only): "OIP matter-graph intake" is not a
  packet, agentic-cad-patent-tooling is a completed buyer's guide, and
  uspto-patent-driver-depth scopes legal interpretation out; "license"
  relations extend beyond the distillates. Mechanism verified; landing open (Q4).

### F10 — Atomic normative rows are a measured retrieval substrate; reject hub-actor gating (imp. 4; survived 2-of-3)

One operative clause = one dominant directed relation
(holder --position--> counterparty) with a stable row ID and expert tripartite
sentence. On a 377-row treaty KB, structured row retrieval reaches macro F1
0.59 (GPT-5, P 0.77), returning inspectable ranked identifiers rather than
free-form answers (P002, P003). Actor-based prefiltering does not help under
a hub actor — removed only ~15% of rows; models over-select 24–36 actors vs
gold 6.2 — so beep must not build retrieval routing on high-degree-node
gating. False negatives cluster on conditional multi-actor cross-treaty
duties (P003).

- Dissent (beep-fit lens): the anti-hub-gating rule belongs in
  hybrid-retrieval-fusion-core / practice-KG territory where no hub-gating
  design yet exists. Small benchmark (15 questions, single expert gold):
  treat F1 0.59 as indicative; "fails" = "does not substantially improve".

## Contradictions & challenges to standing decisions

No wave-1 or semantic-foundation *conclusion* is contradicted — findings
extend the standing SKOS-registry, no-graph-store, and donor-alignment
decisions. Three scope/boundary challenges are real:

1. **F3 vs epistemic-contradiction-triage's exclusion.** The packet SPEC
   scopes out semantic contradiction-detection engines (SPEC.md:137
   stop-and-re-scope boundary). F3 (P063, P014, P086) supplies exactly the
   semantics that exclusion deferred — it must land as an explicit re-scope
   decision, not a silent widening.
2. **F2/F5/F7 vs completed-retained edge-core.** Three findings route design
   content at `goals/epistemic-bitemporal-edge-core`, which is closed. The
   bitemporal substrate is shipped and *confirmed* by P075; the
   relator/claim-status/power-event layers are new. Reopen via amendment or
   (verifier-preferred) charter a new legal-core packet over the substrate.
3. **F1/F8 vs wave-1's thin UFO-L verdict.** legal-ontology-landscape closed
   UFO-L as a one-paragraph "inspire" verdict (research/03:96). Track-1
   evidence (P088, P047, P031, P085) shows the relator catalog anchors
   F1/F2/F7/F9 — materially under-weighted. The /adhd pass should decide
   whether UFO-L is promoted to a governed donor-alignment model.

## Rejected in verification

None — all ten claims survived (2-of-3 or better). The F9/F10 routing
dissents are recorded inline; both substance lenses confirmed the claims.

## Open questions for the /adhd integration pass

1. **Packet topology:** do F2 (relators), F5 (claim-status enum), F6
   (three-layer identity), and F7 (power events) become ONE new legal-core
   packet over the epistemic substrate, or split between semantic-foundation
   amendments and a new epistemic-side packet? Edge-core being retained
   forces this before any routing seed.
2. **How much Hohfeld in V1 SKOS?** Ship F1's 8-position scheme together with
   the LiteralKit correlative bimap, or scheme-first with the bimap deferred
   to the legal-core packet (F8 places constraints outside SKOS)?
3. **Re-scope of epistemic-contradiction-triage:** accept F3's widening, or
   charter conflict semantics separately? Who owns the meta-legal
   priority-knowledge lane (P063, P014)?
4. **Landing zones for F9/F10:** epistemic extraction schema (F9's required
   fields), hybrid-retrieval / practice-KG surfaces (F10's anti-hub-gating
   rule), or a future OIP matter-graph intake packet?
5. **Procedure model (F4):** is law-docketing-patent-spine the dedicated
   procedure model for office-action sequences/deadlines, or does P013's
   procedural-competence failure justify a distinct procedure surface?
6. **UFO-L promotion (challenge 3):** promote UFO-L to a versioned
   donor-alignment model with IRI+version mappings under F8's governance?

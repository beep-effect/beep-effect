# 05 — Value Assessment: what Lynx/LKG is worth to beep-effect

- **Date:** 2026-08-06
- **Packet:** `explorations/lynx-lkg-ontology-grounding`
- **Inputs (all four sweeps present on disk, all read in full):**
  [`01-lynx-project-overview.md`](./01-lynx-project-overview.md),
  [`02-lkg-ontology-deep-dive.md`](./02-lkg-ontology-deep-dive.md),
  [`03-reference-ontologies-sweep.md`](./03-reference-ontologies-sweep.md),
  [`04-beep-effect-grounding.md`](./04-beep-effect-grounding.md).
  No gaps in the input set.
- **Method:** every verdict below is grounded in report 04's in-repo inventory —
  the ten locked commitments (D1–D10), the live code inventory (§4), the
  NOT-FOUND gap table (§5), the contradiction-risk map (§6), and the ten
  acceptance questions (§7). Where report 04's inventory was silent on a detail
  that changes a verdict, the file was read directly in this session and is
  cited `path:line` with **[read 2026-08-06]**.

---

## 0. Bottom line

**Lynx is a pattern donor, not a vocabulary donor, and its value is concentrated
in four ideas — three of which beep-effect has already half-built.**

The LKG ontology is 21 terms. Ten are marker classes with no distinguishing
properties; six are a metadata property bag; the rest are plumbing. There is
nothing in it worth adopting as *vocabulary*: report 04 §8 already lists the
document-class vocabulary, SKOS structural contract, DCTerms metadata, PROV-O
lineage profile, and exact-span provenance as **already covered**, and LKG's
legal-domain content is thinner than what `goals/legal-position-relator-runtime`
has already locked.

What Lynx is genuinely good for is three things:

1. **One engineering pattern we should port** — `nif:AnnotationUnit`: multiple
   attributed, confidence-scored, *competing* claims anchored to one shared
   span. beep-effect's `EvidenceSpan` carries exactly one confidence and no
   annotator (`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:102-111`
   **[read 2026-08-06]**), so the multi-claim layer is a real, narrow gap that
   composes existing bricks instead of replacing them.
2. **One free, permissive, tiny, license-clean artifact** — `lkg.ttl` is
   CC-BY-4.0 and 12,767 bytes (report 01 §4.1), which makes it the best
   available candidate to finally exercise the fail-closed vendor loader's
   never-tested `VETTED` path and force the R1 manifest reconciliation
   (report 04 §1.3, §5).
3. **A documented, dated, four-artifact failure that proves our own doctrine** —
   LKG's spec, TTL, JSON-LD context and SHACL shapes drifted apart in 18 places
   (report 02 §8), with `lkg:Doctrine` reaching 3,059 live instances while
   remaining undeclared (report 01 §5.3). That is D2 (Effect Schema is the
   authority; RDF is a projection) demonstrated by counterexample, and it is
   directly citable evidence for the M4 shapes-from-schema lane.

Everything else in the corpus is reference material. Of the 15 reference
ontologies, **wave 1 already surveyed 3 of them by name** (LKIF-Core,
LegalRuleML, Akoma Ntoso/ELI) and reached verdicts (report 04 §2.1), so their
appearance on Lynx's list is a re-verification, not new information — exactly as
report 04 §2 predicted.

**The single most important negative finding:** report 03 §5.1 confirms **zero
patent/IP modelling anywhere in the corpus** — no claim, no priority date, no
family, no prior art, no CPC/IPC, no prosecution event. Lynx cannot advance
`goals/semantic-foundation` M2 (classifications) or M3 (docketing) by one inch.
The largest declared vocabulary hole in the repo — "no candidate fully covers
docketing-obligation vocabulary" (report 04 §1.2) — is **still uncovered after
this packet**. That is a real result and should be recorded as such rather than
papered over.

---

## 1. Verdict vocabulary

| Verdict | Meaning | Obligation |
|---|---|---|
| **ADOPT** | Port the idea into beep-effect schemas, with attribution. License is permissive and the target is a named repo owner. | Names the landing package/packet and the attribution line. |
| **ADAPT** | The pattern is useful but its shape is wrong for schema-first Effect; it needs reshaping before it can land. | Names what changes and which repo brick it composes. |
| **ALREADY-COVERED** | A live `@beep/*` capability or committed decision already does this. | Cites the capability (path) or the decision from report 04. |
| **CONTRADICTS** | Conflicts with a decision already made. Adopting it is a `/grill-with-docs` question, not a PR. | Names the decision (D-number, `remo`-id, SPEC decision, or contradiction-map row). |
| **IGNORE** | Not worth carrying. | States why. |

**Grounding rule applied throughout:** a verdict that cannot point at report 04's
inventory is not a verdict. Report 04 §7's ten acceptance questions are the
gate; the two that kill the most candidates here are **Q1** (which of CQs 1–20
does it answer? — the repo does not adopt vocabulary speculatively) and **Q3**
(license evidence URL + port discipline).

---

## 2. LKG ontology — element-by-element

### 2.1 Structural patterns

| # | Element | Verdict | Grounding |
|---|---|---|---|
| L1 | **Stand-off architecture** — immutable canonical text spine (`nif:isString`), everything else an interval-keyed overlay (report 02 §6.1) | **ALREADY-COVERED** | `TextAnchor` is exactly this and says so: "pure provenance substrate… `text.slice(startChar, endChar)` should reproduce `quote`" (`packages/foundation/modeling/provenance/src/TextAnchor.ts:1-9` **[read 2026-08-06]**); report 04 §4.6 lists it plus `SourceTextIdentity`, `VerifiedTextAnchor`. HANDOFF hard constraint 4: **do not rebuild `TextAnchor`**. |
| L2 | **`nif:AnnotationUnit`** — many attributed, confidence-scored, competing claims per span (report 02 §6.4, called "the pattern most worth stealing") | **ADAPT** ⭐ | `EvidenceSpan` = `TextAnchorFields` + a **single** `confidence` + `quote` (`EvidenceSpan.model.ts:102-111` **[read 2026-08-06]**). No annotator IRI, no per-claim payload, no supersession. `TextAnchor.ts:5-8` explicitly delegates "confidence, claim semantics, judgement" to consumers — that is the composition seam. Gap is real (report 04 §5 does not list a multi-claim span layer); shortlist #1. |
| L3 | **Derivable span identity** `#offset_{begin}_{end}` (report 02 §2.2) | **ALREADY-COVERED**, and beep is stronger | The derivation is `(document, begin, end)`; beep's equivalent is `(SourceTextIdentity, startChar, endChar)`. Report 02 §9.3 says the port needs "a content hash or anchor-text field that LKG lacks" — `TextAnchorFields.quote` already is that redundancy, and `VerifiedTextAnchor` is the re-slice receipt (report 04 §4.6). The one open sliver is minting a **stable IRI** for a span under `https://ns.beep.sh/`, which is a D5/`@beep/identity` composer question, not an LKG one. |
| L4 | **Triple-redundant hierarchy** — `eli:has_part` + `nif:referenceContext` + `lkg:parent` all express containment, none constrain the others (report 02 §6.1) | **IGNORE** | Report 02 is explicit that nothing enforces offset containment or agreement between the three, so all three can disagree and still validate. Three unconstrained encodings of one fact is the drift failure mode we are trying to avoid, not a pattern. |
| L5 | **Flat text cannot express discontinuous or overlapping spans, or tables/figures** — spec concedes "manipulation of images, videos or tables is less developed" (report 02 §6.1) | **IGNORE** (recorded as an inherited limit) | Not a pattern to adopt; a known ceiling to note before anyone proposes stand-off as the universal document model. Patent drawings and claim tables sit squarely in the hole. |

### 2.2 Identity, metadata, and typing

| # | Element | Verdict | Grounding |
|---|---|---|---|
| L6 | **`lkg:Metadata` as a reified blank-node property bag**, subclassed to `eli:LegalExpression` purely to make ELI properties domain-legal (report 02 §3, §9.2#6) | **CONTRADICTS** | D2 (Effect Schema is the authority) + D8 (schema-first models, typed errors, tagged unions). Report 02 itself calls it an anti-pattern: unaddressable, unversionable, one functional property for everything. In beep terms a metadata bag is a nested `S.Class` field set, and a type-legality trick has no analogue because there is no reasoner to satisfy. |
| L7 | **Six document-subtype marker classes** (`Legislation`, `CaseLaw`, `Agreement`, `CollectiveAgreement`, `TechnicalSpecification`, `Standard`) with no distinguishing properties (report 02 §3) | **ALREADY-COVERED** | Report 02 says it itself: "In an Effect/Schema port this is a `LiteralKit` string union, not a class hierarchy." `DocumentClass = LiteralKit([...])` is that construct and is M1-locked to six members (`SemanticFoundation.models.ts:98` **[read 2026-08-06]**). The *members* differ (lifecycle/handling vs source-type) and the LKG members answer no CQ (Q1), so they are not additive. |
| L8 | **`eli:type_document` fine-grained typing via jurisdiction-scoped bare strings** (`"l"`, `"rdl"`, `"bgbl"`, `"si"`), with `"reg"` colliding across the EU and Spanish annexes (report 02 §3) | **IGNORE** | An un-namespaced string whose meaning depends on an optional sibling field is precisely what `LiteralKit` + repo law exist to prevent. The Annex I codelists are harvested reference data (report 02 §9.1#8) with no CQ mapping. |
| L9 | **`lkg:hasEli` — defer legal identity to the authoritative external identifier** rather than re-minting it (report 02 §9.1#6) | **ALREADY-COVERED** | This is `ConceptAlignment { conceptIri, kind, sourceIri }` with `SkosMappingKind` restricted to `exactMatch`/`closeMatch` (`SemanticFoundation.models.ts:140,181` **[read 2026-08-06]**), sitting under D6 (external alignment is metadata, never source of truth) and D5 (single minting authority). Same instinct, already executed and already fenced. |
| L10 | **`lkg:accessGroup` — an authorization tag inside the document model** (report 02 §4.2, §9.2#7) | **CONTRADICTS** | Report 02 calls it a boundary violation outright. Access control belongs to a permission system, not a taxonomy value object; `TaxonomyConcept` deliberately carries no authorization field (`SemanticFoundation.models.ts:211` **[read 2026-08-06]**). |
| L11 | **`lkg:Collection` — named as one of three core entities, then dropped** ("Collections are not specified in this document"; 0 hits in the TTL, report 01 §5.3#1) | **ADAPT** | The corpus/collection layer is a genuine hole in LKG and a partially-open one here: report 04 §5 records **no live-wired vendor slice** and the R1 caveat that the loader's `VendorManifestEntry` is narrower than the asset-pack `manifest.jsonl`. A collection/slice descriptor with a license-disposition field is the useful shape — shortlist #2. |
| L12 | **No `owl:versionIRI`; a single mutable namespace** so consumers cannot pin a version (report 02 §2.1, §9.2#10) | **ALREADY-COVERED** as a requirement | Report 04 §7 Q4 already demands `version`, `maintenanceStatus`, `sha256` per manifest row plus edition pinning for classification schemes. LKG is the negative example that justifies the rule, not a source for it. |

### 2.3 Language, terminology, provenance

| # | Element | Verdict | Grounding |
|---|---|---|---|
| L13 | **Language discipline** — exactly one mandatory document language (ISO 639-1); canonical text literal deliberately **untagged**; language-indexed metadata via `@container: @language`; `sh:uniqueLang` one-value-per-language; locale variants discouraged for a stated downstream-tooling reason (report 02 §6.3, called "the most carefully specified area, and the most portable") | **ADAPT** ⭐ | Partly covered, partly missing. `LanguageTag` exists with pattern checks (`packages/foundation/modeling/rdf/src/Rdf.ts:336` **[read 2026-08-06]**) and an IANA BCP-47 registry + validator ships in `@beep/html` (`src/internal/Html.language-tag-registry.generated.ts`, `Html.conformance.ts:678` **[read 2026-08-06]**). **Missing:** any lang-map combinator — `rg` for `LangMap\|uniqueLang\|languageMap` across `packages/**/src/**` returns only vocabulary-term strings **[verified 2026-08-06]** — and `TaxonomyConcept.prefLabel`/`definition` are monolingual `S.NonEmptyString` (`SemanticFoundation.models.ts:211` **[read 2026-08-06]**). Shortlist #3. |
| L14 | **Translations modelled as annotations (`itsrdf:target`, language-keyed), not as first-class documents** (report 02 §6.3) | **IGNORE** | Report 02 names the cost: a human-authored official translation cannot carry its own metadata, provenance, or identifier. For patent families (EP/JP/CN equivalents) the translation *is* a first-class instrument. Cheap-for-MT is the wrong trade here. |
| L15 | **The concept layer is SKOS, never OWL** — all ~70M triples of conceptual content are `skos:Concept` graphs with `closeMatch` links outward, zero OWL reasoning (report 01 §9.3) | **ALREADY-COVERED**, and it is corroborating evidence | Wave 1 already adopted SKOS as "the structural contract for every scheme" (report 04 §2.1) and rejected OWL RL/EL inference for v1 (report 04 §5, §6#3). Lynx at 70M triples independently reaching the same posture is the strongest external validation in this packet — cite it, do not re-decide it. |
| L16 | **`dct:subject` as free-text language-tagged keywords — EuroVoc present in the endpoint but never used for subject alignment** (report 02 §5.2, §9.2#9) | **IGNORE** (as a pattern); **note** as a cautionary precedent | Report 02 flags it as a notable omission that leaves cross-lingual subject retrieval — a stated project goal — with no schema support. beep already has the correct construct (`ConceptAlignment`), so this is a warning about leaving it empty, which is itself a live in-repo condition: every seed `alignments` array is `[]` (report 04 §5). |
| L17 | **`dct:source` and `lkg:wasExtractedFrom` with verbatim-identical definitions and no stated precedence** (report 02 §6.4) | **IGNORE** | A duplicate field pair with no precedence rule is a defect. Named only so nobody ports both. |
| L18 | **PROV-O, FOAF and SKOS declared in the namespace table and then never used in a single triple** (report 02 §5.2) | **IGNORE**; useful as a discipline warning | Declared-but-unused vocabularies are how a namespace table becomes fiction. The repo analogue is `@beep/rdf` `Vocab/*` gaining constants **only** on a P1/P2 research verdict (report 04 §7 Q5). |
| L19 | **"Checking licensing information" as step 2 of a 5-step resource-acquisition methodology** (report 01 §5.4) | **ALREADY-COVERED** | Report 04 §7 Q3 is the same gate, stated more sharply (permissive ⇒ port-with-attribution; share-alike/ND ⇒ clean-room, never vendored; missing ⇒ reference-only and blocked, the SALI precedent). Convergent-evolution evidence, not a source. |

### 2.4 Validation, serialization, and the failure mode

| # | Element | Verdict | Grounding |
|---|---|---|---|
| L20 | **JSON-LD context as a dual-surface contract** — one file turns ordinary JSON (`text`, `parts`, `offset_ini`) into correct RDF (report 02 §9.1#5, "directly analogous to schema-first codec design: one schema, two encodings") | **ALREADY-COVERED**, and beep is strictly better | `Ontology.fold` + `toContext`/`toJsonLd`/`toTurtle` (`Fold.assembly.ts:886`, `Fold.projections.ts:227,383,623`, report 04 §4.1) makes the context a **derived projection** of the schema. LKG hand-maintained its context, which is exactly why three declared properties (`hasPDF`, `hasDbpedia`, `hasWikipedia`) are absent from it and get silently dropped on round-trip (report 02 §4.3). Report 04 §4.1 calls the fold "D2 made executable". |
| L21 | **Numbered, machine-executable validation rules R001–R015 with SHACL implementations** (report 02 §6.5, §9.1#7) | **ADAPT**, M4-gated | The transferable half is the stated pattern: *the closed-world validator must materialize the types the open-world model merely implies*. beep's validator is deliberately bounded to four constraint kinds — `targetClass`, `minCount`, `maxCount`, `datatype` (`adapters/shacl-engine.ts:98-176`, report 04 §4.4) — and shapes are **M4-gated** (D9, `remo1`). The opportunity is generating shapes from the schema so they cannot drift; shortlist #4. |
| L22 | **The validation layer that does not validate** — part-structure constraint targets a misspelled property (`eli:hasPart`) so it never fires; the begin/end-index shape targets the wrong class; the Legislation shape does not target the spec's own Legislation example; the jurisdiction enum rejects both cases the prose calls out; 2 of 6 published examples fail R015; one published example is syntactically invalid Turtle; the authors' own "under revision" warning is commented out of the rendered page (report 02 §8) | **IGNORE** as a source; **ADOPT as evidence** | This is the packet's best artifact. It is a dated, citable, third-party demonstration that hand-synced schema/context/shapes/docs drift silently. Use it in the M4 lane's rationale and in `docs/BEEPGRAPH_ARCHITECTURE.md`'s D2 argument. |
| L23 | **`lkg:Doctrine`: 3,059 live instances of a class that was never declared**; `lkg:Collection`, `lkg:translation`, `lkg:annotation`, `lkg:part` all documented and undeclared; `lkg.rdf` promised and 404 (report 01 §5.3, report 02 §4.3) | **IGNORE** as a source; **ADOPT as evidence** | Same as L22 — the data outran the ontology by three thousand instances. This is the single most vivid available argument for schema-is-truth. |
| L24 | **ELI misuse** — three `owl:ObjectProperty`s (`jurisdiction`, `type_document`, `version`) populated with string literals, `type_document` also violating its domain, and `eli:has_part` silently entailing that every document and part is an `eli:Work` (report 02 §5.3) | **CONTRADICTS** / **IGNORE** | Never port. Contradiction-map row 3 (OWL reasoning rejected at ingestion and query time) means the over-entailment is invisible to us, but Q6 (expressible as an Effect Schema construct without a second source of truth) fails outright for a vocabulary used against its own declared types. If ELI is wanted, go to ELI directly — report 02 §9.3 says exactly this. |

---

## 3. Reference ontologies — the Lynx list of 15

Report 03's headline is the frame: **the list is a survey, not a dependency
manifest** — LKG imports exactly one of the 15 (ELI). Report 04 §2 sets the
prior: an item already surveyed in wave 1 is "at most a re-verification or a
license update".

### 3.1 Already surveyed in wave 1 — re-verification only

| Ontology | Wave-1 verdict (report 04 §2.1) | This packet's verdict | What actually changed |
|---|---|---|---|
| **LKIF-Core** | slice / **inspire only** — namespace IRIs dead (404), upstream unmaintained since ESTRELLA 2007–08, GitHub mirror only; CC-BY-4.0 | **ALREADY-COVERED (verdict stands) + license/maintenance UPDATE** | Report 03 §2.4 verifies the GitHub repo is **actively maintained — last pushed 2026-02-23**, 167 stars, ships every module in `.owl` and `.ttl`, and that the `LICENSE` file reads "Attribution 4.0 International" (the GitHub API's `license: None` is wrong — do not trust it). The *maintenance* half of wave 1's demotion is now false; the dead-namespace half stands. Worth a one-line correction to wave 1's row. Substantively still covered: the `norm`/`role`/`legal-action` content is superseded in-repo by `goals/legal-position-relator-runtime` (closed 8-member `HohfeldPosition`, single advantage-side relator, Party–Role split), which is sharper than LKIF's typology. |
| **LegalRuleML** | **reject for implementation** — no suitable OWL/TTL namespace, XML standard, no rule-engine consumer; donor deferral at `ROUTING-SEED.md:83` | **CONTRADICTS (partially) — the *isomorphism* concept is ADAPT-but-routed** | Report 03 §2.4 argues the deontic + defeasible + **isomorphism** triad is the right frame and that the XML serialization is disproportionate — which agrees with the reject-the-syntax half. Contradiction-map row 9: reopening the donor deferral is *allowed*; importing its XML tree as the domain model is not. Isomorphism (a traceable link from each formal rule to the provision that authorises it) belongs to the unopened **`legal-rule-time-identity`** slug, which already owns "a normalized LegalRuleML donor profile" (report 04 §3.1). Nothing to do here except supply that slug's donor evidence. |
| **Akoma Ntoso** | **inspire — identifier lessons only**; not an M2/M3 vocabulary for USPTO/TM filings | **ADAPT (runner-up), still routed** | Report 03 §2.1 adds real news: OASIS opened comment on **AKN v2.0 Part 2 (AKN 3.1)** in **July 2026** (<http://www.oasis-open.org/2026/07/16/invitation-to-comment-on-akoma-ntoso-v2-0-part-2-akn-3-1-before-call-for-consent-as-oasis-standard/>), OASIS IPR **RF on Limited Terms**, and that CH/IT/EU all migrated *to* it. The transferable piece is the judicial content model (`introduction`/`background`/`motivation`/`decision`), which report 03 §5.2 maps onto PTAB decisions, appeal briefs, and office actions. That is document-structure work with no CQ mapping (Q1 fails today) and lands in `patent-drafting-episode-ledger` / `uspto-patent-driver-depth`, both **queued on Benjamin's call** (report 04 §3.1). Do not open it from here. |
| **ELI** | **inspire — identifier lessons only** | **ADAPT — supply the donor profile to `legal-rule-time-identity`** ⭐ | Report 03 §2.2 makes the strongest case in the whole sweep: FRBR `LegalResource → LegalExpression → Format`, arbitrary-depth `LegalResourceSubdivision` addressing, and `eli:in_force` temporal states are the model for pre-AIA vs post-AIA §102/§103 as a *versioned expression* problem. Report 04 §3.1 shows the slug already owns `LegalDocumentVersion`, `LegalApplicabilityContext`, `LegalChangeEvent`. License: **not stated in the OWL, none on the OP landing page** (report 02 §5.1, report 03 §4) ⇒ **reference-only, model reimplementable, files never vendored** (D7). Shortlist #5. |

### 3.2 Not previously surveyed — first verdicts

| # | Ontology | License (report 03 §4) | Verdict | Grounding |
|---|---|---|---|---|
| R1 | **OntoLex `lexicog`** (+ OntoLex-lemon core, `vartrans`, LexInfo 3.0) | no statement in the spec; W3C CG convention ⇒ **reference-only** for text | **ADAPT (runner-up) — needs routing approval** | Report 03 §5.2's argument is the sharpest new idea in the corpus: patent claim construction *is* lexicography (the applicant may be their own lexicographer, and a specification's definitional passages are dictionary entries). `LexicographicResource`/`Entry`/`LexicalSense` lets "this term, as defined in *this* specification, has *this* sense" exist without a global ontology. **But** report 04 §7 Q1 bites: it maps to no CQ 1–20, and CQs 12/13/14 already route term-level work to the LangExtract→ClaimGate loop. Opening it needs Benjamin's routing approval (HANDOFF constraint 3). |
| R2 | **CDM** (EU Common Data Model) | none stated ⇒ **reference-only** | **IGNORE** | Publisher-centric FRBR over the whole Cellar repository; report 03 §2.2 notes it models resource *types* and editorial views, not the internal structure of a legal text. ELI is "the interoperable public face of a subset of it" — take ELI, skip CDM. |
| R3 | **`laki`** (Finlex legislation schema) | not stated in the RDF ⇒ **reference-only** | **IGNORE as a dependency; ADOPT one design precedent** | Its explicit item-granularity amendment relations — "Repeals statute (item)", "Refers to statute (item)", "Entry into force statute" (report 03 §2.2) — are good prior art for prosecution-history events. That evidence belongs in the `legal-rule-time-identity` donor packet alongside ELI, not in a dependency. |
| R4 | **`oikeus`** (Finlex case law) | not stated in the RDF ⇒ **reference-only** | **IGNORE** | Report 03 §2.3 records Lynx's own concession: "There is no relevant source of data except for some courts. No court has been considered in particular in the specs." There is **no dedicated case-law ontology on the list at all**. For Federal Circuit / PTAB work this layer must be built, not adopted — a finding, not a candidate. |
| R5 | **PCO** (Public Contracts Ontology) | **CC BY 3.0 CZ** ⇒ port-with-attribution | **IGNORE** | Procurement, not contracts-in-general; frozen since 2017-03-16 (report 03 §2.5). Fails Q1 (no CQ), and D4 keeps law-practice domain entities out of the semantic layer anyway. Mine the tender→award→contract→payment chain later if licence/royalty modelling ever opens. |
| R6 | **eu-cbcm** (EU cross-border company mobility) | **CC BY 4.0** ⇒ port-with-attribution | **IGNORE (with one flag)** | Report 03 §5.3 spots the real analogy — patent **assignment chains** are the same actor/authority/evidence shape as a cross-border merger. But `goals/legal-position-relator-runtime` already owns the Party–Role split composing the shared `Principal` (report 04 §3.3 decision 7), and forking it is forbidden. Flag the analogy in that goal's notes; adopt nothing. |
| R7 | **CEN MetaLex** | unknown; site dead, EU entry silent ⇒ **reference-only** | **IGNORE as a dependency; note the afterlife** | Report 03 §2.1: `metalex.eu` returns no HTTP response and the EU catalogue marks it **Archived** (last update 2015-12-08). Its *legislative modification event model* survives inside ELI, whose OWL states it "reuses the property names from the Metalex ontology… is_realized_by/realizes". So MetaLex reaches us through ELI; there is nothing to fetch. |
| R8 | **Nomothesia** (Greek legislation) | platform code **Apache-2.0**; OWL unrecoverable ⇒ ontology reference-only | **IGNORE** | Service dead (404 at `legislation.di.uoa.gr`), source last pushed 2016-11-19 (report 03 §2.2). Its value is as the clearest published "take ELI, extend it for one national corpus" precedent — a paragraph in the ELI donor profile, nothing more. |
| R9 | **CHLexML** | eCH free publication, no SPDX ⇒ **reference-only** | **IGNORE** | Formally discontinued November 2017; Switzerland moved to Akoma Ntoso (report 03 §2.1). Historical only. |
| R10 | **LexDania** | unknown ⇒ **reference-only** | **IGNORE** | Danish ministerial-regulation XML; artifact live, documentation a dead JS shell (report 03 §2.1). The one idea — a *family* of schemas over a shared base rather than a monolith — is already how `@beep/schema` composes (`EntitySchema`, `Model.Class`, report 04 §4.7). |
| R11 | **Norme In Rete** | Italian PA guidelines, no reuse licence ⇒ **reference-only** | **IGNORE (one idea noted)** | Superseded by Akoma Ntoso; the Lynx page's own artifact link is the placeholder joke `http://www.private.you-know-italians.xsd` (report 01 §5.2, report 03 §2.1). The durable idea is the **URN citation scheme** (`urn:nir:stato:legge:2000-01-07;1`) that resolves a citation without a registry lookup — which is a `@beep/identity` composer question governed by D5, not an NIR adoption. |
| R12 | **W3C Organization Ontology** (sibling page, adopted by Lynx) | W3C | **CONTRADICTS-adjacent → defer** | Lynx says it "should be the data model of choice" for organisations (report 03 §3). In-repo, organisational identity composes the shared `Principal` and the relator SPEC's Party–Role split (report 04 §3.3 decision 7, §4.7); contradiction-map row 6 forbids roles-as-subclasses. Any org vocabulary lands *there*, not as a new import. |
| R13 | **OMG/FIBO Contracts Ontology; MPEG-21 Media Contract Ontology** (sibling page) | not evaluated | **IGNORE — but record the gap** | Lynx evaluated and rejected both; FIBO specifically because it "does not provide a property/class to represent contract parts" (report 03 §2.5, §5.5). Report 03's conclusion is the finding worth keeping: **clause-level contract modelling is unsolved across this entire landscape.** Anyone proposing patent-licence or assignment modelling should expect net-new design. |
| R14 | **DBpedia ontology / data** (used by LKG for NER class refs) | **CC-BY-SA 3.0** — copyleft | **CONTRADICTS for data; ALREADY-COVERED for links** | Contradiction-map row 8: share-alike ⇒ **clean-room pattern only, never vendored bytes or tables** (the CopyrightOnto / PatentLEGO / SALI precedents). Citing `dbo:` class IRIs is fine (report 01 §8); `lkg:hasDbpedia` as a concept is just `ConceptAlignment` (L9). |
| R15 | **IATE, EuroVoc, UNESCO, ILO, STW, TheSoz** — the ~70M triples actually loaded in the live endpoint (report 01 §5.4) | per-source, **not restated by Lynx** ⇒ **reference-only** | **IGNORE for ingestion; ADAPT later for alignments** | Report 01 §8 is explicit: "the Lynx graph does not re-license them"; report 01 §10 lists these licences as unverified. Every seed `alignments` array is `[]` (report 04 §5) so the *slot* is waiting, but Q3 blocks ingestion until each thesaurus's own terms are verified at its own upstream. The operational tell that UNESCO is loaded twice under a typo'd graph IRI, and that MX/AU appear in a graph list no project description mentions (report 01 §5.4), is enough reason not to treat the endpoint as curated. |
| R16 | **NIF Core 2.0/2.1** | **Apache-2.0 + CC-BY-3.0** (dual, read from `nif-core.ttl`) ⇒ port-with-attribution | **ALREADY-COVERED (concepts) / IGNORE (files)** | The offset/span/annotation-unit algebra is L1–L3 above and is `TextAnchor`. Report 02 §5.1 also records that the NLP2RDF repo has **no repo-level LICENSE file and was last pushed 2017-06-22** — effectively unmaintained. D7 forbids third-party TTL in tracked source regardless. |
| R17 | **ITS 2.0 / RDF (`itsrdf`)** | W3C Software Notice and License ⇒ port-with-attribution | **ADAPT (inside L2)** | `taAnnotatorsRef` / `taClassRef` / `taIdentRef` / `taConfidence` is the field list for the multi-claim layer. Note the trap report 02 §4.3 found: the LKG context uses `itsrdf:taClassConf`, which **does not exist** in the ITS namespace — verify field names against the namespace, not against LKG. |
| R18 | **SKOS, DCTerms, PROV-O, FOAF, VANN, SHACL, W3C Time** | W3C / DCMI CC-BY-4.0 | **ALREADY-COVERED** | All present in `@beep/rdf` `Vocab/*` (`Skos`, `Dcterms`, `Prov`, `Owl`, `Rdf`, `Rdfs`, `Xsd`, `Oa`), generated from the `@beep/identity` `CoreVocab` registry via `bun run beep sync-data-to-ts --target vocab-terms` (report 04 §4.2). Wave 1 already returned adopt/adopt-by-IRI verdicts (report 04 §2.1). Lynx adds nothing. |
| R19 | **`oeg-upm/lynx-py`** (the only public Lynx code) | **Apache-2.0** ⇒ port-with-attribution | **IGNORE** | A client library for service endpoints that are all dead (report 01 §7). Nothing to port. |
| R20 | **LynxSP platform source** | unavailable — GitLab `superlynx` 404/403 | **IGNORE** | Report 01 §7: "there is nothing to port." Recorded so nobody spends a session on the Wayback Machine for it. |

---

## 4. Cross-cutting verdicts

| Element | Verdict | Grounding |
|---|---|---|
| **The Lynx restraint decision itself** — they examined Akoma Ntoso, TEI, LKIF, LegalRuleML, MetaLex and W3C Time and adopted *none*, because their workload was automated enrichment rather than human-authored normative structure (report 01 §4.2, §9.2) | **ADOPT (as method)** | This is the most portable thing in the packet and it costs nothing: make the determination explicitly rather than defaulting to a heavyweight legal ontology. It is also exactly what report 04 §7's ten acceptance questions already institutionalize — Lynx is external corroboration that the discipline is right. |
| **The survival audit** — services dead, code gone, data layer alive at 69,960,083 triples, 17 named graphs, five years after the grant ended (report 01 §7) | **ADOPT (as evidence for D7/Q2)** | "Cited in a paper" is not availability (report 04 §7 Q2). Lynx is the case study: the *hosted* layer that a partner ran died; the *files* the coordinating university served survived. It argues for reference-only + reproducible fetch manifests over live-endpoint dependencies. |
| **The reference-ontologies table has no license column** (report 01 §5.2) | **IGNORE the table's authority** | Fifteen rows, zero license data. Report 04 §7 Q3 makes license an acceptance question with a required evidence URL. Report 03 §4 supplied the missing column — that is this packet's most reusable single artifact. |
| **Net license position: no copyleft anywhere in the reference list** (report 03 §0#3, §4) | **ADOPT (as a finding)** | Unusually clean corpus. The binding constraint is the opposite one — *unknown* licences on EU and national-government artifacts (ELI, CDM, Finlex, LexDania, NIR, MetaLex) ⇒ models freely reimplementable, files never vendored, which D7 already mandates. |
| **Zero patent/IP modelling in the entire corpus** (report 03 §0#4, §5.1) | **ADOPT (as a negative finding)** | The most decision-relevant result. Lynx cannot serve M2 (IPC/CPC/Nice) or M3 (docketing/deadline vocabulary, the repo's largest declared hole per report 04 §1.2). Any patent layer must be grounded against EPO/USPTO/WIPO sources outside Lynx — which report 04 §2.1 has already begun (IPC 2026.01, CPC 2026.05 with **no OSI-style license found**, Nice NCL(13-2026)). |

---

## 5. Ranked shortlist — the 5 most valuable concrete opportunities

Ranked by (value × confidence) ÷ cost, with every one landing on an existing
owner. None requires a new slug except #5, which supplies evidence to a slug
already routed.

### #1 — Attributed multi-claim span annotation (`AnnotationUnit`, reshaped)

**Source:** L2 / R17. **Lands:** `@beep/epistemic` domain, composing
`@beep/provenance`. **License:** LKG CC-BY-4.0 + NIF Apache-2.0/CC-BY-3.0 +
ITS-RDF W3C — all port-with-attribution.

Today a span carries exactly one number: `EvidenceSpan` is `TextAnchorFields` +
`confidence` + `quote` (`EvidenceSpan.model.ts:102-111`), and `TextAnchor.ts:5-8`
deliberately refuses claim semantics so consumers can add them. That means when
an LLM extractor, a deterministic rule, and an attorney all say something about
the same clause, the model can hold one of them. The LKG shape separates *where*
(the span, stable) from *who says what about it and how sure* (a multiset of
attributed units), and that is exactly the shape the repo is missing. In
schema-first Effect terms: a `ClaimSource` `LiteralKit` (never a free string —
`CLAUDE.md` Code Laws) distinguishing extractor / rule / human; a
`SpanClaim` `S.Class` composing `...TextAnchorFields` with `source`,
`Confidence`, an `assertedAt` timestamp and a `modelVersion` — **the two fields
report 02 §6.4 names as LKG's own limits** — and a `payload` tagged union built
with `LiteralKit(...).toTaggedUnion(tagKey)` so entity-class, entity-identity,
and normalized-value claims are distinct variants rather than a bag of optional
fields; then a `SpanClaimSet` whose invariant is that claims are *never*
overwritten, only superseded, with supersession expressed the way
`EdgeVersion` already does lineage (report 04 §4.6). Design order is law: schema
→ `Context.Service` contract → implementation. The service contract is a
`SpanClaimLedger` with typed errors via `TaggedErrorClass`; admission stays
`ClaimGate`'s job (HANDOFF constraint 4 — do not rebuild it), so the ledger
records and the gate judges. This directly closes the recorded
`AnnotatedDocument`-drops-char-spans gap that report 03 §0#5 calls "the highest
practical payoff per unit of effort of anything found in this sweep", and it
keeps the standing rule that the system records while legal judgment stays human.

### #2 — Make `lkg.ttl` the first real VETTED vendor slice

**Source:** L11, L19, report 04 §1.3 (R1 caveat) and §5 ("no live-wired vendor
slice"). **Lands:** `goals/semantic-foundation` R1. **License:** CC-BY-4.0,
verified in the TTL as `terms:license <http://purl.org/NET/rdflicense/cc-by4.0>`
(report 01 §4.1) — attribution to "The Lynx Project Consortium" plus the five
named authors.

`TaxonomyLoader` has six typed errors, a `loadStatus: "VETTED"` requirement, a
`format: "jsonld"` restriction, and `realPath` re-canonicalization with a
prefix check against the vendor root (`TaxonomyLoader.ts:58,84,206-233,244-294`)
— and **none of it has ever run against a real third-party ontology**; only
package-local fixtures prove the contract, and pointing the loader at the real
asset-pack `manifest.jsonl` "fails closed with a parse error". That is a
fail-closed loader whose closed path is the only path ever exercised. LKG is the
ideal first subject precisely because it is unglamorous: 12,767 bytes, permissive,
dead upstream (so it will never change under us), and semantically irrelevant to
our domain — a pure exercise of the mechanism. The work is schema-first and
small: extend `VendorManifestEntry` with the fetch-metadata fields the asset-pack
manifest already carries (or mint a dedicated load manifest, as report 04 §1.3
allows), and add the field this packet proves is load-bearing — a
`LicenseDisposition` `LiteralKit(["port-with-attribution", "clean-room", "reference-only"])`
decoded from the manifest, so report 04 §7 Q3's discipline becomes a schema
invariant instead of a convention in a markdown table. D7 keeps the bytes
gitignored under the asset pack with committed manifest/fetch metadata; the
loader converts them at load time, so nothing third-party enters tracked package
source. Exit criterion: one `VETTED` row loads end-to-end and one deliberately
mis-licensed row fails closed with the right typed error.

### #3 — Language discipline as schema law: a lang-map combinator

**Source:** L13 — report 02 §6.3's "most carefully specified area, and the most
portable". **Lands:** `@beep/schema` (combinator) + `@beep/ontology`
(`TaxonomyConcept`). **License:** LKG CC-BY-4.0, port-with-attribution.

The tag half exists — `LanguageTag` with pattern checks in `@beep/rdf/Rdf.ts:336`
and a generated IANA BCP-47 registry with a validator in `@beep/html`. The
*structure* half does not: a repo-wide search for a lang-map construct returns
only vocabulary term strings, and `TaxonomyConcept.prefLabel` and `definition`
are flat `S.NonEmptyString` (`SemanticFoundation.models.ts:211`). So the M1 seed
is structurally monolingual, which is fine for one jurisdiction and wrong the
moment EP/JP/CN family members or a Spanish-language client matter appear. LKG
supplies four rules worth encoding, and every one maps to a schema construct
with no impedance: exactly one mandatory document language; the canonical text
literal deliberately **untagged** (so offsets and tooling behave, and language is
a metadata fact rather than a property of the string); language-indexed metadata
as a map; and at most one value per language. That is a
`LangMap = <A>(value: S.Codec<A>) => S.Record(LanguageTag, value)` combinator —
uniqueness is free because a record key cannot repeat, which is `sh:uniqueLang`
enforced by the type system rather than by a validator that report 02 §8 shows
was mis-targeted anyway — plus a `PrimaryLanguage` field on the carrier and a
documented rule that canonical text is never language-tagged. Then
`TaxonomyConcept.prefLabel: LangMap(S.NonEmptyString)`. The habit worth copying
alongside the schema is LKG's documentation of *why* it discourages locale
variants (downstream services refuse unknown language codes) — a modeling
constraint chosen to match real tool capability, stated in prose next to the
constraint.

### #4 — Project SHACL shapes from the schema, closing the drift loop (M4-gated)

**Source:** L20–L23. **Lands:** `goals/semantic-foundation` **M4** — gated by
D9 and `remo1`, so this is a *proposal into the M4 lane*, not work to start.
**License:** no port; the contribution is evidence plus in-repo code.

`Ontology.fold` already projects a schema to a JSON-LD context, JSON-LD, Turtle
and Markdown (`Fold.assembly.ts:886`, `Fold.projections.ts:227,383,623`), and the
validator is deliberately bounded to `targetClass`, `minCount`, `maxCount`,
`datatype` (`adapters/shacl-engine.ts:98-176`). The missing edge is
schema → shapes: today a shape would be hand-written against a schema, which is
the exact configuration that produced LKG's eighteen contradictions, its
part-structure constraint targeting a property (`eli:hasPart`) that appears in no
LKG data so the check never fires, its begin/end-index rule targeting the wrong
class, and its Legislation shape failing to target its own Legislation example.
A `toShacl` projection emitting only the four supported constraint kinds makes
the shape a *derived artifact* — it cannot target a misspelled property because
the property name comes from the schema, and it cannot drift because it is
regenerated. The transferable insight from report 02 §6.5 to encode is that the
closed-world validator must materialize what the open-world model merely
implies: the generator has to emit explicit `rdf:type` assertions the schema
treats as structural. `remo1` is respected exactly — invariants land as Effect
Schema constructs *now*, and only their machine-checkable projection waits for
M4. When the M4 lane opens, report 02 §8 is the written rationale.

### #5 — The ELI temporal/FRBR donor profile for `legal-rule-time-identity`

**Source:** §3.1 ELI row + R3 (`laki` amendment relations) + R7 (MetaLex's event
model surviving inside ELI) + L24 (how LKG got it wrong). **Lands:** the
**unopened** `legal-rule-time-identity` slug, which already owns
`LegalApplicabilityContext`, `LegalChangeEvent`, `LegalDocumentVersion`,
`InterpretedNorm`, `RewriteStep` and "a normalized LegalRuleML donor profile"
(report 04 §3.1). **License:** ELI declares none in the OWL and none on the OP
landing page ⇒ **reference-only — reimplement the model, never vendor the
files** (D7). **Routing:** opening the slug needs Benjamin's approval (HANDOFF
constraint 3); this packet supplies the donor evidence, nothing more.

Point-in-time law is the query that matters most in compliance and prosecution —
"what did this provision say on date D" — and pre-AIA versus post-AIA §102/§103
is precisely a versioned-expression problem. LKG's most instructive contribution
is its failure: it collapsed ELI's `LegalResource` → `LegalExpression` → `Format`
chain into a single blank node with three optional dates and no lineage, then
had to relate two consolidated versions with `owl:sameAs` — which asserts the two
versions *are the same individual*, merging their contradictory dates (report 02
§6.2). Report 02 §9.3's conclusion is the right one: if ELI alignment is wanted,
go to ELI directly and model the chain properly, because the chain is what buys
point-in-time law. In schema-first terms the donor profile sketches as a
`LegalSourceWork` identity distinct from a `LegalSourceVersion` carrying valid
time, with subdivision addressing to article/paragraph depth
(`eli:LegalResourceSubdivision` is the borrowed primitive report 03 §5.5 calls
the most promising one available), and change between versions modelled as typed
`LegalChangeEvent`s — `amends` / `repeals` / `consolidates` / `transposes` — the
relational surface LKG omitted entirely (it reuses 8 of ELI's ~85 properties and
none of the relational ones). Two constraints ride along and must be stated in
the donor profile so the slug inherits them: bitemporality composes the existing
`EdgeVersion` authority rather than a new one (HANDOFF constraint 4), and
`laki`'s item-granularity "Repeals statute (item)" relations are the precedent
that change events attach at subdivision granularity, not at document
granularity.

**Runners-up, deliberately not in the top five:** OntoLex `lexicog` for
applicant-as-lexicographer claim construction (intellectually the best new idea
in the corpus, but it maps to no CQ and needs routing approval); Akoma Ntoso's
judicial content model for PTAB decisions and office actions (queued slugs, not
ours to open); the correction to wave 1's LKIF maintenance status (a one-line
edit, not an opportunity).

---

## 6. What this packet does **not** unlock

Stated plainly so no downstream reader over-reads the result.

- **`goals/semantic-foundation` M2 (IPC/CPC/Nice as loadable SKOS).** Nothing in
  Lynx classifies patents. The identified sources remain WIPO/CPC/Nice, with CPC
  still carrying **no OSI-style license** (report 04 §2.1).
- **M3 docketing / deadline obligation vocabulary.** The repo's largest declared
  hole (report 04 §1.2) is untouched by all 15 reference ontologies. LegalRuleML's
  deontic frame is the nearest thing, and it is deferred as a donor.
- **Case law.** Report 03 §5.5: there is no dedicated case-law ontology on the
  list; Lynx itself fell back to ELI classes plus Akoma Ntoso predicates and
  conceded it had no source data. This layer gets built, not adopted.
- **Clause-level contract modelling.** Rejected by Lynx across FIBO and MPEG-21
  MCO; unsolved landscape-wide (report 03 §5.5).
- **Anything requiring a persistent graph store, a durable SPARQL endpoint, or
  runtime OWL inference.** Contradiction-map rows 1–3. Lynx's 70M-triple
  Virtuoso store is a *reading* resource, and report 01 §8 is explicit that it is
  not a re-publishing resource.

---

## 7. Open questions this assessment could not settle

1. **Thesaurus licences (IATE, EuroVoc, UNESCO, ILO, STW, TheSoz).** All
   unverified (report 01 §10). Blocks R15 and blocks populating the M1 seed's
   empty `alignments` from any of them.
2. **ELI's reuse terms in writing.** Everything about the ELI donor profile is
   model-reimplementation, which is safe; but if anyone ever wants the file,
   Decision 2011/833/EU needs confirming (report 03 §2.2).
3. **Whether `legal-rule-time-identity` opens at all.** A routing call for
   Benjamin, not a research finding.
4. **Whether `lexicog` earns a CQ.** If claim-construction lexicography is a real
   product need, it needs a competency question before it can be adopted at all
   (report 04 §7 Q1).
5. **Deliverables D1.3 (technical architecture) and D3.10 (final platform
   prototype) were not read** (report 01 §10). Both are public on Zenodo. Only
   worth opening if the *service orchestration* story ever matters; the ontology
   story is settled.

---

## Sources

Every URL below appears in reports 01–04 on disk; none was invented here. Full
provenance, including licence dispositions and in-repo bricks, is in
[`SOURCES.md`](./SOURCES.md).

**Lynx / LKG primary**
- <https://lynx-project.eu/doc/lkg/> — LKG Ontology spec v1.2, CC-BY-4.0
- <http://lynx-project.eu/doc/lkg.ttl> · <http://lynx-project.eu/doc/lkg-shapes.ttl> · <http://lynx-project.eu/doc/nif-shapes.ttl>
- <http://lynx-project.eu/doc/jsonld/lynxdocument.json>
- <https://lynx-project.eu/data2/reference-ontologies> · <https://lynx-project.eu/data2/data-models> · <https://lynx-project.eu/data2/domain-independent-vocabularies>
- <https://sparql.lynx-project.eu/sparql> — 69,960,083 triples [verified 2026-08-06]
- <https://cordis.europa.eu/project/id/780602> — CORDIS fact sheet
- <https://doi.org/10.1016/j.is.2021.101966> — IS 2022, CC-BY-4.0

**Upstream vocabularies cited in verdicts**
- <http://data.europa.eu/eli/ontology> · <https://op.europa.eu/en/web/eu-vocabularies/eli>
- <https://raw.githubusercontent.com/NLP2RDF/ontologies/master/nif-core/nif-core.ttl> · <https://github.com/NLP2RDF/ontologies>
- <https://www.w3.org/2005/11/its/rdf> · <http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231>
- <https://github.com/RinkeHoekstra/lkif-core> — CC BY 4.0, last pushed 2026-02-23
- <https://www.oasis-open.org/standard/akn-v1-0/> · <https://www.oasis-open.org/policies-guidelines/ipr/> · <http://www.oasis-open.org/2026/07/16/invitation-to-comment-on-akoma-ntoso-v2-0-part-2-akn-3-1-before-call-for-consent-as-oasis-standard/>
- <https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/os/legalruleml-core-spec-v1.0-os.html>
- <https://github.com/opendatacz/public-contracts-ontology> — CC BY 3.0 CZ
- <https://github.com/MaastrichtU-IDS/cbcm-ontology> — CC BY 4.0
- <https://jogracia.github.io/ontolex-lexicog/> · <https://lexinfo.net/ontology/3.0/lexinfo>
- <http://purl.org/finlex/schema/laki/> · <http://purl.org/finlex/schema/oikeus/>
- <https://web.archive.org/web/20201230160320/http://www.metalex.eu/metalex-cen.owl>
- <https://github.com/iliaschalkidis/nomothesia> — Apache-2.0
- <https://www.dublincore.org/specifications/dublin-core/dcmi-terms/> — CC BY 4.0

**In-repo grounding** — report 04 throughout, plus files read directly this
session: `packages/foundation/modeling/provenance/src/TextAnchor.ts`,
`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`,
`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts`,
`packages/foundation/modeling/rdf/src/Rdf.ts`,
`packages/foundation/modeling/html/src/internal/Html.language-tag*.ts`.

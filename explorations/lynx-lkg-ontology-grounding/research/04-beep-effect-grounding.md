# 04 — beep-effect In-Repo Grounding for the Lynx LKG Packet

Date: 2026-08-06
Scope: repo-only. No web fetches were performed for this report; every claim
below is grounded in a file on disk in the `beep-effect` checkout at
`/home/elpresidank/YeeBois/projects/beep-effect17` (branch `main`, clean at
session start, HEAD `2162ebdc8a`).

**Purpose.** Give the later Lynx/LKG synthesis a defensible answer to three
questions for every LKG term, pattern, or reference ontology it surfaces:

1. Is this **already covered** by a live `@beep/*` capability or a committed
   decision?
2. Is this **new** — a genuine gap with no in-repo owner?
3. Does this **contradict** a locked repo doctrine (in which case adopting it
   is a grill/align question, not an implementation detail)?

**URL discipline.** All external URLs reproduced in §2 are copied verbatim from
on-disk research files in this repo (principally
`explorations/legal-ontology-landscape/assets/manifest.jsonl` and
`explorations/legal-ontology-landscape/research/03-legal-core-ip-ontologies.md`).
No URL in this report was invented, and none was re-fetched or re-verified in
this session — the "verified" column reflects what the on-disk manifest
records, dated 2026-07-08.

---

## 1. Locked ontological commitments — `goals/semantic-foundation`

Packet state: `lifecycle: "active"`, graduated 2026-07-08 from
`explorations/legal-ontology-landscape`
(`goals/semantic-foundation/ops/manifest.json`). M1 is complete; M2–M4 are
gated (`goals/semantic-foundation/README.md` § Current Phase).

### 1.1 The doctrine that outranks any external ontology

These are the load-bearing commitments. An LKG finding that conflicts with one
of them is a **contradiction**, not a gap.

| # | Commitment | Source |
|---|---|---|
| D1 | **Graph-is-projection.** Semantic source data may be RDF/SKOS, but application graph state projects into schema-first Postgres/PGlite tables. A dedicated graph database is out of scope. | `goals/semantic-foundation/SPEC.md:74-77` |
| D2 | **Effect Schema is the authority; ontology is annotation + projection.** JSON-LD/Turtle are *derived*. | `docs/BEEPGRAPH_ARCHITECTURE.md:111-113` |
| D3 | **No SPARQL engine in v1.** The contract stays `UnsupportedSparqlQueryServiceLive`; any SPARQL topology decision is a separate gated P4/M4 call. | `goals/semantic-foundation/SPEC.md:15-17` |
| D4 | **No law-practice domain entities in the semantic layer.** `TrademarkAsset`, docketing entities, and time-bounded trademark models stay out of `@beep/ontology`. | `goals/semantic-foundation/SPEC.md:18-22` |
| D5 | **`https://ns.beep.sh/` is the sole minting authority.** Ad-hoc local namespaces (`https://beep.local/...`) are unacceptable for committed seed data. | `goals/semantic-foundation/SPEC.md:79-81` |
| D6 | **FOLIO alignment is metadata, never source of truth.** `skos:exactMatch` / `skos:closeMatch` where vetted; FOLIO cannot overwrite repo-owned concepts. | `goals/semantic-foundation/SPEC.md:84-86` |
| D7 | **No third-party TTL/OWL in tracked package source.** Vendor bytes stay gitignored under the exploration asset pack with committed manifest/fetch metadata; only repo-owned seed TTL/JSON-LD is committed. | `goals/semantic-foundation/SPEC.md:29-31`, `.../DECISIONS.md:121-135` |
| D8 | **Schema-first Effect models, typed errors, tagged unions are required** for registry, loader, and concept-scheme data. | `goals/semantic-foundation/SPEC.md:77-79` |
| D9 | **Milestone gating is binding.** M2 (IPC/CPC/Nice SKOS) is gated behind the Aug-5 first-user metric or a demo-day pull; M3 (docketing + party-role vocab) behind M2 + product pull; M4 (SHACL shapes) behind M1 consumers + M3 stability. | `goals/semantic-foundation/SPEC.md:96-101` |
| D10 | **The four allowed package-extension targets** are `@beep/rdf` `Vocab/*` (research-verdict-only), `@beep/ontology`, `@beep/identity` via `mergeVocab`, and `@beep/semantic-web` (contract unchanged). | `explorations/legal-ontology-landscape/DECISIONS.md:100-119`; `goals/semantic-foundation/SPEC.md:53-70` |

### 1.2 The V1 capability clusters and competency questions

V1 was scoped to four clusters over 20 numbered competency questions
(`explorations/legal-ontology-landscape/DECISIONS.md:38-54`; CQ text at
`explorations/legal-ontology-landscape/research/01-direction-grounding.md:23-44`):

- **Intake/filing taxonomy** — CQs 2, 3, 11, 15, 19 → **M1 (shipped)**
- **Classifications-as-SKOS (IPC/CPC/Nice)** — CQs 9, 10 → M2 (gated)
- **Docketing/deadline vocabulary** — CQs 1, 7, 8 → M3 (gated)
- **Party/role identity** — CQs 5, 18 → M3 (gated)
- CQs 12, 13, 14 route to the existing LangExtract→ClaimGate loop; CQs 16, 17,
  20 are answered by the P4 topology report
  (`explorations/legal-ontology-landscape/RESEARCH.md:76-82`).

A **recorded gap**: "no candidate fully covers docketing-obligation
vocabulary — M3 will mint under `ns.beep.sh`"
(`explorations/legal-ontology-landscape/RESEARCH.md:81-82`). This is the
single largest declared vocabulary hole and the most likely place an LKG
contribution could land.

### 1.3 Known unresolved caveat in the shipped M1

`goals/semantic-foundation/README.md` § Latest Evidence records two things the
synthesis must not gloss over:

- **No vendor slice is live-wired.** "research names no slice `VETTED` for
  loading, so package-local fixtures prove the fail-closed loader contract."
  In other words, the loader's vendor path has never been exercised against a
  real third-party ontology.
- **R1 reconciliation caveat.** The loader's `VendorManifestEntry` shape
  (`id`/`path`/`format:"jsonld"`/`loadStatus`) is intentionally narrower than
  the exploration asset pack's fetch-metadata `manifest.jsonl`; "pointing the
  loader at the real manifest today fails closed with a parse error." Any
  proposal to load an LKG artifact must first extend the asset-pack manifest
  with load fields or introduce a dedicated load manifest.

---

## 2. Ontologies already surveyed — verdicts and license ledger

Two independent survey waves have already run. **An LKG "reference ontologies"
list item that appears below is not new information** — at most it is a
re-verification or a license update.

### 2.1 Wave 1 — `explorations/legal-ontology-landscape` (P0–P4, graduated 2026-07-14)

Asset ledger: `explorations/legal-ontology-landscape/assets/manifest.jsonl`
(16 rows, 9 fully verified per `RESEARCH.md:12-14`), with reproducible fetch
via `assets/fetch.sh`; vendor bytes gitignored.

| Ontology | Verdict | License (as recorded) | Port discipline | Namespace / evidence URL (from disk) |
|---|---|---|---|---|
| **SKOS Core** | **adopt** (structural contract for every scheme) | W3C document use rules | reference-only for bytes; vocabulary IRIs used freely | `http://www.w3.org/2004/02/skos/core#` · `https://www.w3.org/TR/skos-reference/` |
| **DCMI Terms (DCTerms)** | **adopt** (never mint duplicates) | CC-BY-4.0 | port-with-attribution | `http://purl.org/dc/terms/` · `https://www.dublincore.org/specifications/dublin-core/dcmi-terms/` |
| **PROV-O / PROV** | **adopt by IRI** (narrow profile: lineage) | W3C document use rules | reference-only for bytes | `http://www.w3.org/ns/prov#` · `https://www.w3.org/TR/prov-o/` |
| **PAV** | slice (versioning predicates where clearer than `prov:*`) | Apache-2.0 | port-with-attribution | `http://purl.org/pav/` · `https://github.com/pav-ontology/pav` |
| **FOLIO** | **slice** — legal-practice label/mapping backbone, never source of truth; shallow on patent/TM practice | CC-BY-4.0 (data) / MIT (source) | port-with-attribution | `https://folio.openlegalstandard.org/` · `https://github.com/alea-institute/FOLIO` |
| **LKIF-Core** (7 modules: core, action, role, legal-role, legal-action, expression, norm) | slice / **inspire only** — namespace IRIs are **dead (404)**, upstream ontology content unmaintained (ESTRELLA 2007–08), GitHub mirror only | CC-BY-4.0 | port-with-attribution, but *do not assume dereferenceable terms* | `http://www.estrellaproject.org/lkif-core/*` (404) · `https://github.com/RinkeHoekstra/lkif-core` |
| **IAO** (Information Artifact Ontology) | slice — generic document/information-artifact semantics | CC-BY-4.0 | port-with-attribution | `http://purl.obolibrary.org/obo/iao.owl` · `https://github.com/information-artifact-ontology/IAO` |
| **Copyright Ontology (Rhizomik)** (3 modules) | slice — copyright work/rights only | **CC-BY-SA-4.0** | **clean-room only** (share-alike) | `https://rhizomik.net/ontologies/copyrightonto.owl` (+ `-creationmodel`, `-rightsmodel`) |
| **ODRL 2.2** | adopt by IRI (license terms in M3); *never* for patent-prosecution roles | not separately verified (W3C terms) | reference-only until verified | `http://www.w3.org/ns/odrl/2/` · `https://www.w3.org/TR/odrl-model/` |
| **LRMoo / FRBRoo** | inspire (work identity + document versioning pattern) | not verified | reference-only | `https://cidoc-crm.org/lrmoo/fm_releases` |
| **UFO-L** | inspire — the relator/Hohfeld pattern (keeps `Inventor`/`Assignee`/`Examiner` from becoming person subclasses) | not verified; no fetchable OWL/TTL observed | reference-only | `https://nemo.inf.ufes.br/en/projetos/ufo-l/` |
| **LegalRuleML** | **reject for implementation** — no OWL/TTL namespace suitable for M2/M3; XML standard, no rule-engine consumer | not evaluated | reference-only | `https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/legalruleml-core-spec-v1.0.html` |
| **SALI LMSS** | **inspire / BLOCKED** — MIT (GitHub) vs CC BY-ND (SALI site) license conflict; download blocked | **conflicting** | **do not ingest** until resolved | `https://github.com/sali-legal/LMSS` · `https://sali.org/explore-the-standard/` |
| **NEPOMUK NMO/NIE** | inspire — email/attachment/thread design reference (CQ 11); do not import the semantic-desktop stack | not evaluated in P1 | reference-only | (see `research/02-legal-dms-file-metadata.md`) |
| **Akoma Ntoso / ELI / ECLI** | inspire — identifier lessons only; not M2/M3 vocabularies for USPTO/TM filings | not evaluated | reference-only | `https://www.oasis-open.org/standard/akn-v1-0/` · `https://data.europa.eu/eli/ontology` |
| **FOLaw, LRI-Core, NEURONA, ALIS IP, Carneades, DSAP, IPROnto, PrOnto** | **reject — no fetchable OWL/TTL artifact observed** | not verified | reference-only | see `research/03-legal-core-ip-ontologies.md:98-110` |
| **EXIF, SPDX, schema.org, XMP, PREMIS, iManage/NetDocuments patterns** | reject for M1 / inspire only | mixed | reference-only | `explorations/legal-ontology-landscape/RESEARCH.md:38-47` |

**M2 classification sources already identified** (not yet implemented,
`research/03-legal-core-ip-ontologies.md:112-117`):

- IPC 2026.01 master files — `https://www.wipo.int/classifications/ipc/en/ITsupport/Version20260101/` — WIPO terms page puts online WIPO content under CC BY 4.0 unless service-specific terms apply.
- CPC 2026.05 bulk — `https://www.cooperativepatentclassification.org/cpcSchemeAndDefinitions/bulk` — **no OSI-style license found**; terms review required before package commit.
- Nice NCL(13-2026) — `https://www.wipo.int/classifications/nice/en/ITsupport/Version20260101/index.html`.
- Locarno/Vienna — deferred unless design/figurative-mark workflows pull them.

### 2.2 Wave 2 — `explorations/legal-patent-kg-deepening` (~120 papers, 24 repos)

Stage `align`, status `active`. Four verified track syntheses landed
2026-08-01 (`research/10..13-track-*.md`); 46 routed nuggets in
`research/nugget-catalog.json`. Track 1 (legal core + Hohfeld) is the most
LKG-adjacent:

- **T1-F1** — Hohfeld is a closed 8-position domain in four correlative pairs;
  correlativity is a *schema-level invariant*, "never stored as two facts that
  can drift". Explicitly: **"correlativity cannot live in plain SKOS"**
  (`research/10-track-legal-core.md`, F1 + F8 caveat).
- **T1-F2** — legal relations are reified triadic **relators**, never binary
  edges; a relator bundles paired position moments, a grounding legal
  fact/event, and a typed source norm.
- **T1-F3** — contradiction detection is only sound at the position-tuple level
  after typed priority resolution (lex specialis/superior/posterior).

License cautions recorded in wave 2 that bear on any LKG-adjacent ingestion:

- **PatentLEGO vocabulary data is CC BY-SA 4.0 — "never vendor its tables or
  JSON"** (`ROUTING-SEED.md:132`).
- **R25 (`flint-ontology`, TNO)** — Apache/MPL split "verified on the real TNO
  GitLab files" (`explorations/legal-patent-kg-deepening/README.md:98-104`).
  `P100` (FLINT), `P101` (controlled language) and `R25` were promoted out of
  `unverified-addendum` on 2026-08-06 by the relator wedge's Lane B verdicts.
- **eFLINT's uniform violation rule is a named donor trap and is never copied**
  (`goals/legal-position-relator-runtime/SPEC.md`, decision 9).

---

## 3. Routing state and the "do not rebuild" fence

### 3.1 The signed-off routing matrix

`explorations/legal-patent-kg-deepening/ROUTING-SEED.md` (signed off
2026-08-01, amended 2026-08-04 and 2026-08-05) routes all 46 ledger rows across
nine clusters. Two wedges opened and **both have graduated**; two slugs remain
queued on Benjamin's explicit call
(`explorations/legal-patent-kg-deepening/HANDOFF.md:146-158`).

| Cluster | Route | Target | State |
|---|---|---|---|
| Legal positions, relators, authorized transitions (`T1-F1,F2,F7,F9,T4-F6,P100,R25`) | mixed | `explorations/legal-position-relator-runtime` | **GRADUATED 2026-08-06** → `goals/legal-position-relator-runtime` |
| Patent citation events + candor disposition (`T2-F2,T3-F7,ADHD-1`) | mixed | `explorations/patent-citation-candor-gate` | **GRADUATED 2026-08-04**; impl PR #575 merged 2026-08-06 |
| **Semantic registry, qualified mappings, extraction admission** (`T1-F8,T2-F3..F7,T2-F10,T3-F8`) | **extend-goal** | **`goals/semantic-foundation`** | open; grill `remo1` resolved — schema-first now, M4 SHACL later |
| Legal rule, time, source identity, controlled transformation (`T1-F4,F5,F6,T3-F1,F2,F3,F6,T4-F5,P101`) | new-exploration | `legal-rule-time-identity` *(proposed slug, no path)* | not opened |
| Functional patent profiles + drift-safe ingestion (`T2-F1,F8,F9`) | mixed | `explorations/uspto-patent-driver-depth` | queued on Benjamin's call |
| Drafting episodes, deterministic retrieval, rebuildable projections | mixed | `patent-drafting-episode-ledger` *(proposed slug)* | queued on Benjamin's call |
| Rejected admission + ODRL profile claims (`T4-R1,T4-R2`) | **dup-skip** | — | permanently negative evidence |

**Directly relevant to Lynx:** the `legal-rule-time-identity` cluster is the
one an LKG synthesis is most likely to land in — it explicitly owns
"a normalized LegalRuleML donor profile", legal applicability context,
n-ary legal change events, and the document/content/norm/temporal-version/
language-version/executable-rule/runtime-event/rewrite-step identity chain
(`ROUTING-SEED.md:66-85`). It is a **proposed slug with no repo path**, so
nothing there is built and nothing is blocked.

### 3.2 Hard constraints inherited by any new packet in this strand

From `explorations/legal-patent-kg-deepening/HANDOFF.md:47-59` — these bind the
Lynx packet too:

1. Never silently re-litigate wave-1 or `goals/semantic-foundation`; challenges
   are **named align branches**, not implementation shortcuts.
2. `remo1`/`remo2`/`remo3` are DECIDED: schema-level invariants reach SHACL only
   via the semantic-foundation **M4 gate**; `MatterProjection` is rows-first with
   **no persistent graph store**; episode ledgers are product records with
   Cognee as a lossy projection.
3. Routing beyond the four approved slugs needs Benjamin's routing approval.
4. **Do not rebuild** `TaxonomySeed`, `EdgeVersion`, `TextAnchor`,
   `EvidenceSpan`, `ClaimGate`, runtime draft/gate contracts, USPTO drift
   handling, or weighted RRF.
5. Keep legal vocabulary in a **legal consumer domain**; do not widen completed
   generic epistemic goals because their substrate is reusable.
6. Keep `P100`/`P101`/`R25` unverified until verified; keep `T4-R1`/`T4-R2`
   rejected — do not resurrect them as gaps.

### 3.3 What the graduated wedges already locked (relevant to legal-core semantics)

`goals/legal-position-relator-runtime/SPEC.md` is the sharpest constraint set
for anything Hohfeld/relator/norm-shaped that Lynx might carry:

- Closed 8-member `HohfeldPosition` domain with **correlative** and
  **opposite** derivations defined over `(positionKind, LegalActContent)` —
  pure, total, involutive, commuting.
- A **simple** `LegalPositionRelator` storing exactly one advantage-side
  directed relation; "persisting both ends of a correlative pair is a schema
  defect, not a style choice."
- Package home is **`packages/law-practice/domain`**, with a named promotion
  gate: extract a legal-core package only when a *second* legal consumer needs
  the contract (decision 6). UFO-L's core-vs-domain layering is preserved as a
  future move, not an up-front package.
- **Party–Role split** composing the shared `Principal`; `LegalRole` is
  norm-prescribed, scoped to a relator, and carries its `sourceNorm`
  (decision 7).
- **Void vs penalised are two independent recorded axes** — constitution
  (`constituted`/`not-constituted`) and permission (`permitted`/`violative`) —
  "never one field" (decision 9).
- `LegalActContent` carries **required act/omission polarity**; a typed
  act-verb vocabulary is deferred, and "if it ever materializes it composes
  `goals/semantic-foundation`'s scheme loading, never a new registry"
  (decision 10).
- The system records; **"legal judgment stays human, always."**

`goals/patent-citation-candor-gate/SPEC.md` adds the fact/judgment discipline:
append-only fact records own the mechanics; the disposition holds only dated,
scoped attorney judgment; **no stored "duty satisfied" state exists anywhere** —
the gate predicate is recomputed and fails closed.

---

## 4. Live code inventory — what exists today

Every row below was read in this session. Paths are repo-relative.

### 4.1 `@beep/ontology` — `packages/foundation/modeling/ontology`

`beep.family = "foundation"`, `beep.kind = "modeling"`
(`packages/foundation/modeling/ontology/package.json`).

| Capability | Path | Notes |
|---|---|---|
| **Document-class vocabulary** | `src/SemanticFoundation.models.ts:98` | `LiteralKit(["draft","redline","filed","received","privileged","extracted-child"])` — exactly the M1-locked six. |
| **SKOS mapping kinds** | `src/SemanticFoundation.models.ts:140` | `LiteralKit(["exactMatch","closeMatch"])` — only two mapping predicates are admitted. No `broadMatch`/`narrowMatch`/`relatedMatch`. |
| **`ConceptAlignment`** | `src/SemanticFoundation.models.ts:181` | `{ conceptIri, kind, sourceIri }` — the vetted-external-mapping carrier. |
| **`TaxonomyConcept`** | `src/SemanticFoundation.models.ts:211` | `{ alignments, broader, definition, documentClasses, filingSegment, iri, prefLabel }`. |
| **`FilingSegment`** path-safety schema | `src/SemanticFoundation.models.ts:41` | Rejects `.`/`..`/separators/NUL at decode time. |
| **`FilingRoot` / `FilingRootKind`** | `src/SemanticFoundation.models.ts:239,271` | `local-vault` \| `box-mirror`. |
| **`TaxonomySeed`** | `src/SemanticFoundation.models.ts:287` | `{ concepts, filingRoots, pathTemplateSegments, schemeIri, title }`. |
| **Committed repo-owned seed** | `src/SemanticFoundation.seed.ts:49-140` | 9 concepts (legal-document, correspondence, email-message + 6 document-class concepts), 2 filing roots, path template `["root","client","matter","taxonomy-concept","document-class","file-name"]`. **All `alignments: []`** — zero FOLIO mappings are actually populated; the file's own note says FOLIO mappings stay empty "until a report verifies a term-level semantic match". |
| **Seed serializations** | `src/seed/legal-intake.ttl`, `src/seed/legal-intake.jsonld` | Repo-owned, tracked. |
| **Fail-closed vendor loader** | `src/TaxonomyLoader.ts:244-294` | `Context.Service` `TaxonomyLoader.load(manifestPath, vendorRoot)` requiring only `FileSystem`. Six typed errors: `TaxonomyManifestReadError`, `TaxonomyManifestParseError`, `VendorSliceUnvetted`, `VendorSliceReadError`, `VendorSliceParseError`, `VendorSlicePathEscape` (`:97-191`). Vendor rows must be `loadStatus: "VETTED"` (`:58`) and `format: "jsonld"` only (`:84`); paths are re-canonicalized with `realPath` and prefix-checked against the vendor root (`:206-233`). |
| **Librarian projection** | `src/TaxonomyRegistry.ts:126` | `runLibrarianLoop(seed, LibrarianInput) → LibrarianOutput` — concept lookup + document-class admission + one `FilingPath` per filing root. Pure; no placement I/O. Errors `TaxonomyConceptNotFound:84`, `UnsupportedDocumentClass:102`. |
| **Ontology fold (schema → ontology)** | `src/Fold.assembly.ts:886` (`Ontology.fold`), `src/Fold.models.ts` | `AssembledOntology`, `AssembledClass`, `AssembledPredicate`, `AssembledFact`, `SkosClassification` (`concept`\|`conceptScheme`), `OntologyWarningCode`, `OntologyAssemblyError`. Owned by the **active** `goals/identity-iri-fold` packet. |
| **Pure projections** | `src/Fold.projections.ts:227,383,623` | `toContext` (JSON-LD context), `toJsonLd`, `toTurtle`. Plus `src/Fold.markdown.ts`. This is D2 made executable: schemas are the authority, RDF is a derived projection. |
| **FOLIO OpenAPI client models** | `src/Ontology.models.ts:292,491,593,637,741` | `OWLClass`, `OWLObjectProperty`, list/search results, health. These model the FOLIO *API*, not FOLIO semantics. |
| Tests | `test/SemanticFoundation.test.ts`, `test/Fold.test.ts`, `test/Ontology.models.test.ts` | Three test files on disk. **Drift note:** `goals/semantic-foundation/README.md` § Latest Evidence still says "2 test files and 11 tests" — that line predates the `Fold.*` surface (first landed in the `identity-iri-fold` lane; `Fold.models.ts` last touched 2026-08-05, PR #559). |

### 4.2 `@beep/rdf` — `packages/foundation/modeling/rdf`

- Vocab constants: `src/Vocab/{Skos,Dcterms,Prov,Owl,Rdf,Rdfs,Xsd,Oa}.ts`, each
  backed by generated term inventories under `src/Vocab/generated/*.terms.ts`
  single-sourced from the `@beep/identity` `CoreVocab` registry via
  `bun run beep sync-data-to-ts --target vocab-terms`
  (`src/Vocab/Skos.ts:12-20`).
- SKOS constants already present: `SKOS_CONCEPT`, `SKOS_CONCEPT_SCHEME`,
  `SKOS_PREF_LABEL`, `SKOS_ALT_LABEL`, … (`src/Vocab/Skos.ts:36+`).
- RDF/JS value layer: `src/Rdf.ts` (`Dataset`, `Quad`, `NamedNode`, `BlankNode`,
  `GraphTerm`, `PrefixMap`, `makeDataset`, `serializeQuad`), `src/Iri.ts:888`
  (`IRIReference` — the IRI type every taxonomy model and alignment field uses),
  `src/Uri.ts`, `src/JsonLd.ts`, `src/Prov.ts`, `src/SemanticSchemaMetadata.ts`,
  `src/Adapters/WebAnnotation.ts`.

### 4.3 `@beep/identity` — `packages/foundation/modeling/identity`

- Root authority: `Identity.make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })`
  (`src/packages.ts:40`).
- `$OntologyId` (`src/packages.ts:286`) and `$SemanticFoundationId`
  (`src/packages.ts:301`, IRI `https://ns.beep.sh/ontology/semantic-foundation`).
- `VocabShape` / `VocabEntry` / `VocabRegistry` and the `mergeVocab` extension
  point (`src/Vocab.ts`), CURIE helpers (`src/Curie.ts`, `src/PnLocal.ts`).
- Every schema/error/service identifier in the repo is minted through a
  package-scoped `$I` composer — e.g.
  `const $I = $OntologyId.create("SemanticFoundation.models")`
  (`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:15`).

### 4.4 `@beep/semantic-web` — `packages/foundation/capability/semantic-web`

- **SPARQL**: full request/result schema surface (`src/services/sparql-query.ts:87-198`,
  profiles `select|ask|construct` at `:44`) but the shipped layer is
  `UnsupportedSparqlQueryServiceLive` (`:383`) failing with
  `SparqlQueryErrorReason` `unsupportedProfile|unimplemented` (`:237`).
- **SHACL**: bounded contract (`src/services/shacl-validation.ts`:
  `ShaclNodeShape:134`, `ShaclPropertyShape:92`, `ShaclValidationViolation:175`)
  with `BoundedShaclValidationServiceLive` (`src/adapters/shacl-engine.ts:73`)
  implementing exactly `targetClass`, `minCount`, `maxCount`, `datatype`
  (`:98-176`). `ShaclValidationServiceLive` is an alias of the bounded layer (`:239`).
- Also live: JSON-LD context/document/stream parse+serialize services,
  canonicalization service, provenance service, Web Annotation adapter.
- RDF Dataset Canonicalization driver: `packages/drivers/rdf-canonize`
  (RDFC-1.0 + SHA-256 fingerprints; cited at
  `explorations/legal-ontology-landscape/research/01-direction-grounding.md:15`).

### 4.5 The `ontology` **product slice** — `packages/ontology/{domain,use-cases,ui}`

This is a **separate, live, fully-featured ontology workbench** that the
wave-1/wave-2 research surfaces barely mention. It matters for Lynx because it
already runs SPARQL and inference locally.

| Capability | Path | Notes |
|---|---|---|
| Session aggregate (files-as-truth Turtle) | `packages/ontology/domain/src/aggregates/Session/Session.model.ts` | Typed change-operation edit model (`addQuad`/`removeQuad`), actor-attributed change journal, SHACL NodeShape awareness (`:35-38`). |
| **Named graph partitions** | `packages/ontology/domain/src/aggregates/Session/Session.values.ts:72` | `LiteralKit(["asserted","ontologies","inferred","shapes","provenance"])` — a *live* asserted-vs-inferred separation, with `isExcludedFromReasoning` (`:134`) and `graphPartitionIri` (`:110`). |
| **Live SPARQL runner** | `packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts:655` | `OntologySparqlRunnerLive` provides a real `SparqlQueryService` over an in-memory dataset for the workbench (`OntologySparqlPanelProfile` = `select`\|`construct`\|`ask`, `:44`). **This is the "disposable in-memory `@beep/rdf` dataset session" the `remo2` resolution names** (`ROUTING-SEED.md:256-259`) — it is not a persistent graph store and does not overturn D3. |
| **Structural reasoner** | `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:920` | `OntologyReasonerLive` — domain-native inference over `rdfs:subClassOf`, `subPropertyOf`, `domain`, `range`, `owl:disjointWith`, writing into the `inferred` partition. |
| Validation runner | `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:886` | `OntologyValidationRunnerLive`. |
| Agent-facing MCP toolkit | `packages/ontology/use-cases/src/tools/OntologyToolkit.ts`, `OntologyToolService.ts` | Owned by `goals/ontology-agent-surface` (`completed-retained`). |
| Workbench UI | `packages/ontology/ui/src/aggregates/Session/*.tsx` | explorer, graph, inspector, metrics, source, sparql, tree, validation, changelog. |

Owning packets: `goals/ontology-workbench` and `goals/ontology-workbench-migration`
and `goals/ontology-agent-surface` (all `completed-retained`),
`goals/ontology-interop-roadmap` (`completed-retained`).

### 4.6 Legal / epistemic domain machinery

| Capability | Path | Notes |
|---|---|---|
| **Practice-KG node kinds** | `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:38` | Closed `LiteralKit(["client","docket_family","docket","application","patent","document","email_archive"])`. |
| **Practice-KG edge predicates** | `packages/law-practice/domain/src/values/KgEdgePredicate/KgEdgePredicate.model.ts` | Closed: `has_docket_family`, `has_docket`, `files_as`, `granted_as`, `has_document`, `family_document`, `archived_in`, `continuation_of`, `enriched_family`. "The set is closed: an edge whose predicate is absent here cannot be projected." |
| **KG epistemic status** | `packages/law-practice/domain/src/values/PracticeKgEpistemicStatus/*.model.ts:38` | `derived-from-official-records` \| `candidate-unreviewed`. |
| **KG provenance kinds** | `packages/law-practice/domain/src/values/PracticeKgProvenanceKind/*.model.ts:37` | `catalog-digest`, `uspto-anchor`, `organize-row`, `extract-operation`. |
| Law-practice entities | `packages/law-practice/domain/src/entities/` | `Matter`, `LegalClient`, `LegalContact`, `PatentAsset`, `OfficeAction`, `Claim`, `Rejection`, `PriorArtReference`, `Distinction`, `IdsSubmissionFact`, **`PatentCitationEvent`**, **`CandorDisposition`**. |
| Bitemporal edge authority | `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts` | Binary endpoints, immutable `fact`, valid time, transaction time, supersedes lineage (cited at `ROUTING-SEED.md:58`). |
| Claim lifecycle / gate | `packages/epistemic/domain/src/values/{ClaimGate,ClaimLifecycle,ClaimProjection}/`, `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts` | Admission is a typed value; ClaimGate maps evidence quotes into a bounded SHACL dataset. |
| Contradiction substrate | `packages/epistemic/domain/src/{entities,values}/Contradiction/` | Owned by `goals/epistemic-contradiction-triage`; its SPEC is **never amended from the legal side** (relator SPEC decision 2). |
| Exact-span provenance | `packages/foundation/modeling/provenance/src/TextAnchor.ts:155`, `SourceTextIdentity.ts`, `VerifiedTextAnchor.ts` | UTF-16 anchors, source identity, verification receipts. |

### 4.7 Schema / domain-model machinery (`@beep/schema`, `@beep/shared-domain`)

The conventions any ported ontology term must be expressed in:

- **`LiteralKit`** — `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:747`.
  Const-typed literal-union factory giving `.is.<member>`, `.Enum`, `.$match`,
  and `.toTaggedUnion(tagKey)(shape)`. Repo law: never hand-roll a union of
  literals; never add `as const` to the inline array (`CLAUDE.md` § Code Laws).
  This is the **canonical shape for a closed ontological domain** — see
  `DocumentClass`, `SkosMappingKind`, `KgNodeKind`, `GraphPartition`,
  `HohfeldPosition` (planned).
- **`Model.Class`** — `packages/foundation/modeling/schema/src/DomainModel.ts:65`
  (`class DomainModel extends Model.Class<DomainModel>($I\`DomainModel\`)(...)`),
  with `Model/Model.{fields,variants,codecs,datetime,uuid,sqlite}.ts`.
- **`EntitySchema`** — `packages/foundation/modeling/schema/src/EntitySchema/`
  (`.definition`, `.factory`, `.fields`, `.persist`, `.shape`,
  `.constructors`). `persist.{literal,jsonb,timestampMillis,entityId}` bind a
  field to its column; `StorageKind`/`ValueStrategy`/`IndexHint` at
  `EntitySchema.persist.ts:28,75,155`.
- **`EntityId`** — `packages/shared/domain/src/entity/EntityId.ts`, consumed via
  per-slice registries: `EntityId.factory("law_practice", $I)` then
  `make("patent_citation_event", {...})`
  (`packages/shared/domain/src/identity/LawPractice.ts:11,304`). Sibling
  registries: `Agents.ts`, `Epistemic.ts`, `Shared.ts`, `Workspace.ts`.
- **Shared `Principal`** — `packages/shared/domain/src/entity/Principal.ts`; the
  relator SPEC's Party–Role split composes it rather than widening the agents
  runtime's private `RuntimePrincipalId`
  (`goals/legal-position-relator-runtime/SPEC.md` decision 7).
- **`BaseEntity.Class`** — `packages/shared/domain/src/entity/BaseEntity.ts`,
  used as
  `class PatentCitationEvent extends BaseEntity.Class<PatentCitationEvent>($I\`PatentCitationEvent\`)(LawPractice.PatentCitationEventId, { fields: {...}, persisted: {...} })`
  (`packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.model.ts:69`).
- **`TaggedErrorClass`** — `@beep/schema`, used for every typed error
  (see `TaxonomyLoader.ts:97-191`).
- **Design order is law**: schema → `Context.Service` contract → implementation
  (`goals/legal-position-relator-runtime/SPEC.md` decision 4;
  `goals/patent-citation-candor-gate/SPEC.md` decision 1).

---

## 5. Gaps — NOT FOUND in the live tree

Each was checked in this session or is recorded as a source-only `rg` miss in
`ROUTING-SEED.md` (2026-08-01, re-attributable but not re-run here).

| Missing capability | Status | Where it would land |
|---|---|---|
| Any reference to **Lynx / LKG** outside this packet | **NOT FOUND** except one citation line at `explorations/legal-ontology-landscape/research/00-source-brief.md:169` (recorded in this packet's `CAPTURE.md`) | this packet |
| Populated **FOLIO alignments** in the seed | **NOT FOUND** — every `TaxonomyConcept.alignments` is `[]` (`SemanticFoundation.seed.ts`) | semantic-foundation |
| Any **live-wired vendor slice** | **NOT FOUND** — no manifest row is `VETTED`; loader is proven only by package-local fixtures (`goals/semantic-foundation/README.md`) | semantic-foundation R1 |
| **IPC / CPC / Nice** as loadable SKOS schemes | **NOT FOUND** — M2, gated | semantic-foundation M2 |
| **Docketing / deadline vocabulary** | **NOT FOUND** — M3, gated; explicitly recorded as the one CQ cluster no surveyed ontology covers | semantic-foundation M3 |
| **Party vs time-bounded role** vocabulary | **NOT FOUND** in `@beep/ontology`; being minted in `goals/legal-position-relator-runtime` (decision 7) | law-practice domain |
| `TrademarkAsset` and trademark docketing entities | **NOT FOUND** (`research/01-direction-grounding.md:48`); the `trademark-docketing-domain` stub packet was **deleted 2026-07-14** by portfolio consolidation (#401) and is now a MAP-queued candidate gated on M3 | none yet |
| **SHACL shapes for intake / ClaimGate** | **NOT FOUND** — M4, gated; validator is bounded to 4 constraint kinds | semantic-foundation M4 |
| **SPARQL over persisted projections** | **NOT FOUND** — only in-memory workbench sessions | gated per P4 §"SPARQL milestone" (5 conditions) |
| **OWL RL/EL inference** | **NOT FOUND** and *rejected for v1* at ingestion and at query time; offline batch over projections is the only preferred later path | `research/05-semantic-topology-recommendation.md:124-144` |
| `Hohfeld*`, `LegalPositionRelator`, `PowerExercise`, `ActFrame`, `SlotCorrespondence` | **NOT FOUND** in source as of the 2026-08-01 sweep; now specced in `goals/legal-position-relator-runtime` | law-practice domain |
| `LegalApplicabilityContext`, `LegalChangeEvent`, `LegalDocumentVersion`, `InterpretedNorm`, `RewriteStep`, LegalRuleML donor profile | **NOT FOUND**; routed to the unopened `legal-rule-time-identity` slug | proposed, no path |
| `QualifiedMapping`, `MentionMappingCandidate`, `ProvenanceKind`, vocabulary quarantine, clean-room function-verb seed | **NOT FOUND**; routed **extend-goal into `goals/semantic-foundation`** | semantic-foundation |
| `FunctionalUnit`, `CompatibilityAssessment`, `PatentAwareSegmentation`, `MappingVersion` | **NOT FOUND**; routed to `explorations/uspto-patent-driver-depth`, queued | queued |
| `AnswerProvenanceAnnex`, `LegalInferenceEvent`, `MemoryProjection`, `DraftingEpisode`, `NormativeRow` | **NOT FOUND**; routed to the unopened `patent-drafting-episode-ledger` slug | proposed, no path |
| A general **ontology-authoring DSL** in `@beep/ontology` | Partially resolved: the `Fold.*` surface (`goals/identity-iri-fold`, active) is the authoring/projection substrate; the 2026-07-08 grounding note's "FOLIO/OpenAPI-model oriented only" characterization (`research/01-direction-grounding.md:53`) is now **stale** | identity-iri-fold |

---

## 6. Contradiction-risk map — where a Lynx/LKG proposal would collide

Ranked by how expensive the collision is to resolve.

1. **Any persistent RDF/graph store or triplestore-as-authority.** Collides with
   D1, D2, `remo2`. Requires a `/grill-with-docs` with Benjamin, not a PR.
2. **A SPARQL-first query story.** Collides with D3 and the five-condition
   SPARQL gate (`research/05-semantic-topology-recommendation.md:203-224`).
   An in-memory disposable session is already permitted; a durable endpoint is not.
3. **OWL reasoning as part of ingestion or query.** Explicitly rejected for v1
   in both placements; only offline batch with provenance and asserted-vs-inferred
   flags survives.
4. **Executable invariants carried inside the taxonomy registry.** The `remo1`
   resolution says invariants land as **Effect Schema constructs now**;
   registry-carried executable shapes route into the gated **M4** SHACL lane.
   An LKG shape/constraint layer must respect that split.
5. **Modeling legal positions as SKOS concepts.** T1-F1 states outright that
   correlativity cannot live in plain SKOS; correlativity must be a derived
   schema invariant, and both ends must never be persisted.
6. **Modeling roles as subclasses of person/organization.** UFO-L/LKIF's relator
   pattern is already adopted as the *anti*-pattern guard
   (`research/03-legal-core-ip-ontologies.md:96`); relator SPEC decision 7 makes
   the split binding.
7. **A second minting authority or a second identifier scheme.** Collides with D5
   and `@beep/identity`'s composer monopoly.
8. **Any share-alike (CC-BY-SA) or ND-licensed artifact.** CopyrightOnto (CC-BY-SA-4.0),
   PatentLEGO (CC-BY-SA-4.0), and SALI (MIT/CC-BY-ND conflict) are the standing
   precedents: **clean-room pattern only, never vendored bytes or tables**.
9. **LegalRuleML-shaped rule import.** Rejected for implementation in wave 1 and
   deferred indefinitely as a donor in wave 2 (`ROUTING-SEED.md:83`). Reopening
   its donor deferral is allowed; widening semantic-foundation M1 or importing
   its XML tree as the domain model is not.
10. **Anything that computes legal judgment.** Both graduated goals state the
    same rule: the system records, humans judge; there is no stored "satisfied"
    state and no computed materiality.

---

## 7. The ten questions this repo asks of any external legal ontology

These are the acceptance questions the Lynx/LKG synthesis must answer per
artifact. Each is derived from a decision or gate cited above, not invented here.

1. **Which numbered competency question does it answer?**
   If it maps to none of CQs 1–20
   (`explorations/legal-ontology-landscape/research/01-direction-grounding.md:23-44`),
   it is reference material — the repo does not adopt vocabulary speculatively.
   *(Source: DECISIONS.md 2026-07-08 "V1 capability clusters"; CQ20 is itself
   the adopt/slice/map/reject rule.)*

2. **Is there a currently fetchable OWL/TTL/JSON-LD artifact, and does its
   namespace IRI actually dereference?**
   Eight wave-1 candidates were rejected purely for having no fetchable artifact;
   all seven LKIF modules are demoted to inspire-only because
   `estrellaproject.org` returns 404 while the GitHub mirror is alive. "Cited in
   a paper" is not availability.
   *(Source: `research/03-legal-core-ip-ontologies.md:98-110`; `RESEARCH.md:100-102`.)*

3. **What is the license, from what evidence URL, and what port discipline
   follows?**
   Permissive (MIT/Apache/BSD/CC-BY) ⇒ port-with-attribution. Share-alike or ND
   (CC-BY-SA, CC-BY-ND) ⇒ **clean-room pattern only, never vendored**.
   Missing/conflicting ⇒ reference-only and blocked (the SALI precedent).
   *(Source: `assets/manifest.jsonl`; `ROUTING-SEED.md:132`; `research/SOURCES.md` rules.)*

4. **Is it maintained, and with what version/edition identity?**
   Every manifest row carries `version`, `maintenanceStatus`, and `sha256`.
   Classification schemes additionally require **edition pinning** (IPC `2026.01`,
   CPC `2026.05`, Nice `13-2026`) — an unversioned scheme cannot be loaded.
   *(Source: `assets/manifest.jsonl`; `research/03-legal-core-ip-ontologies.md:112-117`;
   SPEC M2 exit criteria.)*

5. **Adopt by IRI, slice, map, or reject — and does it earn a `@beep/rdf`
   constant?**
   The four-way verdict is CQ20. `@beep/rdf` `Vocab/*` gains constants **only**
   on a P1/P2 research verdict; otherwise existing SKOS/RDF constants are reused.
   *(Source: `goals/semantic-foundation/SPEC.md:55-58,117-118`; DECISIONS.md "Package extension targets".)*

6. **Can it be expressed as an Effect Schema construct — `LiteralKit` domain,
   `S.Class`/`Model.Class`, tagged union, typed error — without becoming a second
   source of truth?**
   Effect Schema is the authority; RDF is a projection. LinkML was rejected as a
   polyglot schema hub for exactly this reason. If the ontology only works as an
   OWL class hierarchy consumed by a reasoner, it fails.
   *(Source: `docs/BEEPGRAPH_ARCHITECTURE.md:111-113`; `research/05-semantic-topology-recommendation.md:146-164`; `CLAUDE.md` § Code Laws.)*

7. **Does it require a graph store, a SPARQL endpoint, or runtime OWL inference?**
   If yes, it is gated, not adoptable: no graph store (D1/`remo2`); SPARQL stays
   `UnsupportedSparqlQueryServiceLive` until all five gate conditions hold;
   OWL RL/EL is rejected at ingestion and at query time, permitted only as an
   offline batch projection with asserted-vs-inferred flags.
   *(Source: `research/05-semantic-topology-recommendation.md:77-100,124-144,203-224`;
   `ROUTING-SEED.md:256-259`.)*

8. **Does it keep enduring identity separate from time-bounded roles, and does it
   avoid persisting both ends of a correlative pair?**
   `Inventor`/`Assignee`/`Licensee`/`Examiner` must not be person subclasses;
   a relator stores one advantage-side directed relation and derives the rest.
   An ontology that flattens roles into classes, or stores Right *and* Duty as
   two facts, is a donor trap.
   *(Source: `research/03-legal-core-ip-ontologies.md:96,148`;
   `goals/legal-position-relator-runtime/SPEC.md` objective + decisions 5, 7.)*

9. **Does every term it contributes stay rebuildable from accepted claims,
   EventLog records, evidence spans, and DMS links — with an exact source anchor?**
   CQ16 is the standing test: no edge used by search or an agent answer may exist
   that cannot be rebuilt from the authority path. Terms must compose
   `TextAnchor`/`EvidenceSpan`/`ClaimGate` rather than introduce a parallel
   provenance model.
   *(Source: `research/05-semantic-topology-recommendation.md:9-22`;
   HANDOFF hard constraint 7.)*

10. **Where does it land, and does it widen a completed packet or the wrong
    layer?**
    Every candidate needs a route from the fixed vocabulary
    (`attach-existing | extend-goal | new-exploration | mixed | dup-skip`), an
    owner, and — for a new slug — Benjamin's routing approval. Legal vocabulary
    belongs in a **legal consumer domain**; generic epistemic/foundation packets
    are never widened because their substrate is reusable. Extracting a
    legal-core package requires a *second* legal consumer through the
    promotion-record gate.
    *(Source: `explorations/legal-patent-kg-deepening/HANDOFF.md:47-59`;
    `ROUTING-SEED.md` route vocabulary; `goals/legal-position-relator-runtime/SPEC.md` decision 6.)*

---

## 8. Quick verdict guide for the synthesis

- **Already covered — do not propose:** SKOS structural contract, DCTerms
  generic metadata, PROV-O lineage profile, FOLIO-as-mapping-backbone,
  document-class vocabulary, filing-path vocabulary, fail-closed vendor loading,
  JSON-LD/Turtle projection, in-memory SPARQL sessions, RDFS/OWL structural
  inference in the workbench, asserted/inferred/shapes/provenance partitioning,
  exact-span provenance, bitemporal edges, claim admission.
- **Already decided against — reopening needs a grill:** persistent graph store,
  durable SPARQL endpoint, runtime OWL reasoning, LinkML as schema hub,
  LegalRuleML import, SALI ingestion, vendored CC-BY-SA bytes.
- **Live gaps an LKG contribution could legitimately fill:** docketing/deadline
  obligation vocabulary (explicitly uncovered), legal applicability context and
  n-ary legal change events, temporal/language version identity for norms,
  qualified mapping + abstention/review states, vocabulary quarantine,
  populated FOLIO (or other) alignments for the M1 seed, and a real vetted
  vendor slice to exercise the loader's R1 caveat.
- **Land-here defaults:** registry/mapping/admission metadata →
  **extend `goals/semantic-foundation`** (already the signed-off route);
  rule/time/source identity → the unopened **`legal-rule-time-identity`** slug;
  positions/relators/norm-transitions → **`goals/legal-position-relator-runtime`**
  (do not fork it).

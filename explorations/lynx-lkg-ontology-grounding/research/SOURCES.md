# Lynx LKG Ontology Grounding — Sources & Provenance

<!--
The provenance ledger for this packet. Rules (from the explorations convention):
never fabricate a URL/DOI/repo link; reproduce only sources that actually appear
on disk in RESEARCH.md / research/*.md. Licences are load-bearing: copyleft
(AGPL/GPL/MPL/CC-BY-SA/CC-BY-ND) => CLEAN-ROOM reimplement only, never vendored;
permissive (MIT/Apache/BSD/CC-BY) => port WITH attribution; missing/unverified
=> reference-only. State the discipline per artifact.
-->

- **Date:** 2026-08-06
- **Cluster / origin:** four research sweeps run for this packet —
  [`01-lynx-project-overview.md`](./01-lynx-project-overview.md),
  [`02-lkg-ontology-deep-dive.md`](./02-lkg-ontology-deep-dive.md),
  [`03-reference-ontologies-sweep.md`](./03-reference-ontologies-sweep.md),
  [`04-beep-effect-grounding.md`](./04-beep-effect-grounding.md) — synthesised in
  [`05-value-assessment.md`](./05-value-assessment.md).
- **Provenance:** the packet exists because
  `explorations/legal-ontology-landscape/research/00-source-brief.md:169` carried
  Lynx as a single reference-only citation and nothing deeper existed anywhere in
  `explorations/` or `goals/` (see [`../CAPTURE.md`](../CAPTURE.md)).
- **Verification note:** rows marked **[verified 2026-08-06]** were probed live
  (HTTP/DNS/SPARQL) or read from the artifact itself during the sweeps. Rows
  marked *(from wave-1 manifest)* are reproduced from
  `explorations/legal-ontology-landscape/assets/manifest.jsonl`, dated
  2026-07-08, and were **not** re-fetched.

---

## 1. Mined source corpus

The "corpus" here is Lynx's own published model artifacts, read together because
they disagree with one another (report 02 §8). Any port must read all four; the
HTML spec's Annex I is aspirational.

| Source | Title | Upstream | Location | Theme | Disposition |
|---|---|---|---|---|---|
| `lkg-spec` | LKG Ontology specification v1.2 (HTML, 152 KB) | <https://lynx-project.eu/doc/lkg/> | report 02 §§1–8 | document ontology, 15 validation rules, Annex I codelists | **port-with-attribution** (CC-BY-4.0); Annex I treated as aspirational |
| `lkg-ttl` | `lkg.ttl` — the authoritative OWL (12,767 B) | <http://lynx-project.eu/doc/lkg.ttl> | report 01 §4.1, report 02 §10 | 10 classes, 4 object + 6 data properties | **port-with-attribution** |
| `lkg-context` | JSON-LD context `lynxdocument.json` (3,589 B) | <http://lynx-project.eu/doc/jsonld/lynxdocument.json> | report 02 §4.3 | JSON⇄RDF dual-surface contract | **port-with-attribution**; contradicts the spec in 6 places |
| `lkg-shapes` | SHACL shapes (9,268 B) + NIF shapes (2,803 B) | <http://lynx-project.eu/doc/lkg-shapes.ttl> · <http://lynx-project.eu/doc/nif-shapes.ttl> | report 02 §6.5, §8 | validation layer that does not validate | **reference-only** — cited as counter-evidence |
| `lkg-graph` | Live Virtuoso store, 69,960,083 triples, 17 named graphs | <https://sparql.lynx-project.eu/sparql> | report 01 §5.4 | terminologies + national legislation | **reference-only** — a reading resource; per-thesaurus terms unverified |
| `lkg-benchmark` | Benchmark corpus (2.43 MB) | <https://lynx-project.eu/data/benchmarking.zip> | report 01 §4.1 | sample documents | **reference-only** — not fetched into the repo |
| `lynx-refs` | "Relevant ontologies" survey table, 15 rows, **no licence column** | <https://lynx-project.eu/data2/reference-ontologies> | report 03 §1 | landscape scan | **reference-only** |
| `lynx-models` | Data-models rationale page (contract-ontology rejections, ISO/ELI choices) | <https://lynx-project.eu/data2/data-models> | report 03 §3 | design reasoning | **reference-only** |
| `lynx-vocab` | Domain-independent vocabularies page (OntoLex side) | <https://lynx-project.eu/data2/domain-independent-vocabularies> | report 01 §5.1, report 03 §2.7 | lexical/terminology model | **reference-only** |

**How these inform this packet.** Take the *stand-off + offset-overlay*
architecture and the `nif:AnnotationUnit` multi-claim shape; take the language
discipline; leave the metadata property bag, the flat date fields, the marker-class
taxonomy and the ELI usage. The four-artifact disagreement is itself the most
useful artifact — a dated, citable demonstration of what happens when the schema
stops being the single source of truth.

---

## 2. Upstream repositories, ontologies & licence disposition

Licence read from the artifact (LICENSE file, RDF triple, spec front matter)
wherever one exists; **not inferred**. Ordered by disposition.

### 2.1 Permissive — port-with-attribution

| Artifact | Licence | Evidence | What we take |
|---|---|---|---|
| **Lynx LKG Ontology** | **CC BY 4.0** | `terms:license <http://purl.org/NET/rdflicense/cc-by4.0>` in `lkg.ttl` + CC-BY badge in the spec **[verified 2026-08-06]** | Stand-off document model, span-identity pattern, language discipline. Attribution: "The Lynx Project Consortium" + Víctor Rodríguez-Doncel (creator), Sotiris Karampatakis, Filippo Maganza, Socorro Bernardos, Julián Moreno-Schneider |
| **NIF Core 2.0/2.1** | **Apache-2.0 + CC BY 3.0** (dual, in the ontology header) | <https://raw.githubusercontent.com/NLP2RDF/ontologies/master/nif-core/nif-core.ttl> **[verified 2026-08-06]** | Offset/span/annotation-unit algebra. Caveat: repo has **no repo-level LICENSE** and was last pushed 2017-06-22 (<https://github.com/NLP2RDF/ontologies>) |
| **ITS 2.0 / RDF** | **W3C Software Notice and License (2002-12-31)** | `dc:rights` in the namespace doc; <http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231> | `taAnnotatorsRef` / `taClassRef` / `taIdentRef` / `taConfidence` field list. Trap: `itsrdf:taClassConf` used by LKG **does not exist** in the namespace |
| **DCMI Metadata Terms** | **CC BY 4.0** | <https://www.dublincore.org/specifications/dublin-core/dcmi-terms/> | Already adopted in wave 1; nothing new |
| **LKIF-Core** | **CC BY 4.0** | repo `LICENSE` reads "Attribution 4.0 International" **[verified 2026-08-06]**; GitHub API reports `license: None` — **do not trust the API here**. <https://github.com/RinkeHoekstra/lkif-core>, last pushed 2026-02-23 | Nothing — superseded in-repo by `goals/legal-position-relator-runtime`. Wave-1's "unmaintained" characterisation needs correcting |
| **eu-cbcm** | **CC BY 4.0** (`spdx_id: CC-BY-4.0`) | <https://github.com/MaastrichtU-IDS/cbcm-ontology> | Nothing; the actor/authority/evidence analogy for assignment chains is noted only |
| **PCO** | **CC BY 3.0 CZ** | repo README, verbatim. <https://github.com/opendatacz/public-contracts-ontology> | Nothing; frozen since 2017-03-16 |
| **Akoma Ntoso** | **OASIS IPR, RF on Limited Terms** | <https://www.oasis-open.org/policies-guidelines/ipr/> · <https://www.oasis-open.org/standard/akn-v1-0/> | Judicial content model noted as a runner-up; keep the OASIS notice on any spec prose |
| **LegalRuleML** | **OASIS IPR, royalty-free** | same policy URL | The isomorphism concept only; XML serialization explicitly not taken |
| **Nomothesia (platform code)** | **Apache-2.0** | <https://github.com/iliaschalkidis/nomothesia>, last pushed 2016-11-19 | Nothing; ontology file itself unrecoverable |
| **`oeg-upm/lynx-py`** | **Apache-2.0** | <https://github.com/oeg-upm/lynx-py> | Nothing — a client for dead endpoints |
| **Lynx Zenodo deliverables (e.g. D2.5)** | **CC BY 4.0** | <https://doi.org/10.5281/zenodo.3558710> | Citable |
| **IS 2022 journal paper** | **CC BY 4.0** (Elsevier open access) | <https://doi.org/10.1016/j.is.2021.101966>; PDF <https://zaguan.unizar.es/record/117956/files/texto_completo.pdf> | The definitive technical account; quotable and adaptable with citation |

### 2.2 Copyleft / non-derivative — CLEAN-ROOM ONLY, never vendored

| Artifact | Licence | Evidence | Discipline |
|---|---|---|---|
| **DBpedia ontology & data** | **CC BY-SA 3.0** | report 01 §8, report 02 §5.1 | Citing `dbo:` class IRIs is fine; ingesting DBpedia data is not free. Matches the standing in-repo precedents (CopyrightOnto CC-BY-SA-4.0, PatentLEGO CC-BY-SA-4.0, SALI MIT/CC-BY-ND conflict) — **never vendor bytes or tables** |
| **Law in Context 2021 retrospective** | **CC BY-NC-SA 4.0** | stated on the PDF; <https://doi.org/10.26826/law-in-context.v37i1.129> | Quote and cite; do **not** adapt its text into a commercial deliverable |

### 2.3 Missing / unverified licence — REFERENCE-ONLY

Model may be reimplemented; **files must not be vendored** (also required by D7).

| Artifact | Licence status | Evidence |
|---|---|---|
| **ELI Metadata Ontology v1.5** | **none declared in the OWL, none on the landing page**; EU reuse policy (Decision 2011/833/EU) not confirmed in writing | <http://data.europa.eu/eli/ontology> (166,991 B RDF/XML, content-negotiated) · <https://op.europa.eu/en/web/eu-vocabularies/eli> **[verified 2026-08-06]**. NB report 01 §5.1 cites the EUR-Lex legal notice (editorial CC-BY-4.0, metadata CC0) — <https://eur-lex.europa.eu/content/legal-notice/legal-notice.html> — which covers EUR-Lex *content*, not the ontology file |
| **CDM (Common Data Model)** | no licence statement on the page | <https://op.europa.eu/en/web/eu-vocabularies/cdm> · <https://showvoc.op.europa.eu/> |
| **Finlex `laki`** | no `dct:license`/`dct:rights` in the returned Turtle (inspected) | <http://purl.org/finlex/schema/laki/> (11,839 B) · <https://seco.cs.aalto.fi/linkeddata/finnishlaw/> · <https://data.finlex.fi/> |
| **Finlex `oikeus`** | no licence in the RDF | <http://purl.org/finlex/schema/oikeus/> (7,610 B) · <https://ceur-ws.org/Vol-3257/paper5.pdf> (LawSampo successor) |
| **OntoLex `lexicog` / OntoLex-lemon / `vartrans`** | **no licence or copyright block in the spec**; W3C CG convention governs | <http://www.w3.org/ns/lemon/lexicog> · <https://jogracia.github.io/ontolex-lexicog/> · <https://www.w3.org/2019/09/lexicog/> · <https://www.w3.org/2016/05/ontolex/> |
| **LexInfo 3.0** | not stated | <https://lexinfo.net/ontology/3.0/lexinfo> (624,876 B) |
| **CHLexML (eCH-0095)** | eCH publishes free of charge; no SPDX. **Discontinued Nov 2017** | <https://ech.ch/de/ech/ech-0095/1.0> · <https://ejustice.ch/chlexml/> · <https://ejustice.ch/wp-content/uploads/2024/10/STAN_d_DRA_2016-05-03_eCH-0095_V1.0_CHLexML.pdf> |
| **LexDania** | unknown; no statement anywhere | <https://www.retsinformation.dk/offentlig/xml/schemas/2016/09/26/LexDania_2.1.xsd> |
| **Norme In Rete** | Italian PA guidelines, no reuse licence. **Superseded by Akoma Ntoso** | <https://www.agid.gov.it/sites/default/files/repository_files/linee_guida/linee_guida_marcatura_documenti_normativi_0.pdf> · <https://lg-normattiva.readthedocs.io/> · <https://www.normattiva.it/> |
| **CEN MetaLex** | unknown — site dead, EU catalogue silent and marked **Archived** (last update 2015-12-08) | <https://web.archive.org/web/20201230160320/http://www.metalex.eu/metalex-cen.owl> · <https://interoperable-europe.ec.europa.eu/collection/eu-semantic-interoperability-catalogue/solution/cen-metalex> · <https://docs.vlaamsparlement.be/docs/biblio/opendigibib/monografie/2011/365_cwa15710.pdf> |
| **Nomothesia OWL** | unrecoverable (404 at `legislation.di.uoa.gr`) | <https://cgi.di.uoa.gr/~koubarak/publications/2017/eswc17-legislation.pdf> |
| **IATE, EuroVoc, UNESCO Thesaurus, ILO Thesaurus, STW, TheSoz** (in the live endpoint) | per-source terms, **not restated by Lynx** | report 01 §5.4, §8 — "do not assume the Lynx graph re-licenses them" |
| **EU NALs, ISO 639-1, ISO 3166, ATU code lists** | EU reuse policy | report 02 §5.1 |
| **VANN** | CC BY per the vocabulary, not independently verified | report 02 §5.1 |
| **LynxSP platform source** | **unavailable** — GitLab `superlynx` 404/403; GitHub org `lynx-project` has 0 public repos | report 01 §7 — nothing to port |
| **Commercial Lynx components** (PoolParty, Tilde MT, K Dictionaries / Lexicala) | proprietary, named as closed in Law in Context §3 | **do not port** |

---

## 3. External research sources

All URLs below appear on disk in `research/01`–`research/05`. Grouped; the
licence table above is authoritative for disposition.

**Project & funding**
- <https://lynx-project.eu/> · `/project/summary` · `/project/consortium` · `/project/legal` · `/project/related` · `/news` · `/webinars`
- `/project/pilot1` · `/project/pilot2` · `/project/pilot3`
- <https://cordis.europa.eu/project/id/780602> · <https://cordis.europa.eu/project/id/780602/reporting>
- <https://lynx-project.eu/publications/articles> · <https://lynx-project.eu/publications/deliverables>
- <https://lynx-project.eu/doc/api/> — service catalogue (page lives; APIs do not)

**Ontology artifacts** — see §1 and §2 for URLs and licences; plus
<http://lkg.lynx-project.eu/def/> (namespace, redirects to the HTML spec),
<http://lkg.lynx-project.eu/> and <http://lkg.lynx-project.eu/kos> (browsers).

**Publications**
- Moreno Schneider et al. (2022), *Lynx: A knowledge-based AI service platform…*, **Information Systems 106:101966** — <https://doi.org/10.1016/j.is.2021.101966> · PDF <https://zaguan.unizar.es/record/117956/files/texto_completo.pdf> · <https://www.sciencedirect.com/science/article/pii/S0306437921001563>
- Rodríguez-Doncel & Montiel-Ponsoda (2021), *Lynx: Towards a Legal Knowledge Graph for Multilingual Europe*, **Law in Context 37(1):175-178** — <https://doi.org/10.26826/law-in-context.v37i1.129> · PDF <https://pdfs.semanticscholar.org/df90/3717a0d8739ec7c420e707d2205dfeccd57c.pdf>
- Montiel-Ponsoda et al. (2017), TERECOM@JURIX — <http://ceur-ws.org/Vol-2049/02paper.pdf> · <http://ceur-ws.org/Vol-2049/>
- González-Conejero et al. (2018) — <http://ceur-ws.org/Vol-2309/03.pdf>; Rodríguez-Doncel et al. (2018) — <http://ceur-ws.org/Vol-2309/12.pdf>
- Rehm et al. (2019), NLLP@NAACL — <https://www.aclweb.org/anthology/W19-2207/>
- Moreno-Schneider et al. (2020), LREC — <https://www.aclweb.org/anthology/2020.lrec-1.284.pdf>
- Martín-Chozas et al. (2020), *Defying Wikidata* — <https://www.aclweb.org/anthology/2020.lrec-1.694.pdf>
- Leitner et al. (2020), German legal NER dataset — <http://www.lrec-conf.org/proceedings/lrec2020/pdf/2020.lrec-1.551.pdf>; (2019) SEMANTiCS — <https://link.springer.com/chapter/10.1007/978-3-030-33220-4_20>
- LREC 2018 legal-KG workshop — <http://legalkg2018.lynx-project.eu/proceedings.pdf> · <http://lrec-conf.org/workshops/lrec2018/W22/pdf/12_W22.pdf>
- TIAD-2019 — <http://ceur-ws.org/Vol-2493/>

**Deliverables (Zenodo, CC-BY-4.0)**
- D1.3 <https://doi.org/10.5281/zenodo.2580245> · D2.5 <https://doi.org/10.5281/zenodo.3558710> · D2.7 <https://doi.org/10.5281/zenodo.3692561> (UAB mirror <https://ddd.uab.cat/pub/estudis/2020/5ca923f36125/D2.7_lyn_a2020m2d29iANG.pdf>) · D2.8 <https://doi.org/10.5281/zenodo.4651389> · D3.10 <https://doi.org/10.5281/zenodo.4298974> · D5.8 <https://doi.org/10.5281/zenodo.4651375>

**Reference ontologies & standards** — Akoma Ntoso <https://www.oasis-open.org/standard/akn-v1-0/>, schema <https://docs.oasis-open.org/legaldocml/akn-core/v1.0/cs01/part2-specs/schemas/akomantoso30.xsd>, <http://www.akomantoso.org/>, AKN 3.1 comment notice <http://www.oasis-open.org/2026/07/16/invitation-to-comment-on-akoma-ntoso-v2-0-part-2-akn-3-1-before-call-for-consent-as-oasis-standard/>, AKN4EU <https://op.europa.eu/en/web/eu-vocabularies/dataset/-/resource?uri=http://publications.europa.eu/resource/dataset/akn4eu>; LegalRuleML <https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/os/legalruleml-core-spec-v1.0-os.html> + RDFS <https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/csprd02/rdfs/>; ELI URI templates <http://publications.europa.eu/mdr/eli/documentation/uri_templates.html>; W3C Time <http://www.w3.org/2006/time#>; RDFLicense CC-BY-4.0 <http://purl.org/NET/rdflicense/cc-by4.0>; PCO LOD2 deliverable <http://static.lod2.eu/Deliverables/deliverable-9a.1.1.pdf>; eu-cbcm docs <https://maastrichtu-ids.github.io/cbcm-ontology/> + release <https://github.com/MaastrichtU-IDS/cbcm-ontology/releases/download/v1.2.2/eu-cmo-rdfxml-v1.2.2.owl>; Lexicala/OntoLex writeup <https://kln.lexicala.com/kln28/lonke-bosque-gil-ontolex-lemon-lexicog/>; `osoc-es/lynx-Sight` <https://github.com/osoc-es/lynx-Sight> + <https://osoc-es.github.io/lynx-Sight/>; OEG successor-adjacent work <https://github.com/oeg-upm/term-rag>.

**Classification sources for the still-uncovered M2 lane** *(from wave-1 manifest, not re-fetched)* — IPC 2026.01 <https://www.wipo.int/classifications/ipc/en/ITsupport/Version20260101/>; CPC 2026.05 bulk <https://www.cooperativepatentclassification.org/cpcSchemeAndDefinitions/bulk> (**no OSI-style licence found — terms review required**); Nice NCL(13-2026) <https://www.wipo.int/classifications/nice/en/ITsupport/Version20260101/index.html>.

---

## 4. In-repo capability references

The `@beep/*` bricks this packet composes. Sourced from
[report 04](./04-beep-effect-grounding.md); rows marked **[read 2026-08-06]**
were opened directly during the assessment.

| Brick | Path | Role in this packet | Disposition |
|---|---|---|---|
| `TextAnchor`, `SourceTextIdentity`, `VerifiedTextAnchor` | `packages/foundation/modeling/provenance/src/` | The stand-off/offset pattern already exists; `TextAnchor.ts:1-9` explicitly delegates confidence and claim semantics to consumers **[read 2026-08-06]** | **reuse** — HANDOFF constraint 4 forbids rebuilding it |
| `EvidenceSpan` | `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:102-111` | Carries one `confidence`, no annotator/timestamp/version — the multi-claim gap **[read 2026-08-06]** | **extend** (shortlist #1) |
| `ClaimGate`, `ClaimLifecycle`, `ClaimProjection` | `packages/epistemic/domain/src/values/`, `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts` | Admission stays the gate's job; the ledger records | **reuse** — do not rebuild |
| `EdgeVersion` | `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts` | Bitemporal + supersedes lineage; the model for claim supersession and for legal-version time | **reuse** |
| `TaxonomyLoader` | `packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:58,84,206-233,244-294` | Fail-closed vendor loading, six typed errors, `VETTED` + `jsonld` gates, `realPath` escape check — **never exercised on a real slice** | **extend** (shortlist #2) |
| `SemanticFoundation.models.ts` (`DocumentClass`, `SkosMappingKind`, `ConceptAlignment`, `TaxonomyConcept`, `TaxonomySeed`, `FilingSegment`) | `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:41,98,140,181,211,287` | Marker-class and external-identity verdicts; `prefLabel`/`definition` are monolingual `S.NonEmptyString` **[read 2026-08-06]** | **reuse** / **extend** (shortlist #3) |
| `Ontology.fold` + projections | `packages/foundation/modeling/ontology/src/Fold.assembly.ts:886`, `Fold.projections.ts:227,383,623`, `Fold.models.ts`, `Fold.markdown.ts` | JSON-LD context / JSON-LD / Turtle are already derived from schema — D2 executable | **reuse**; **extend** with `toShacl` at M4 (shortlist #4) |
| Bounded SHACL validator | `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`, `src/adapters/shacl-engine.ts:73,98-176,239` | Exactly four constraint kinds — the projection target | **reuse** |
| `UnsupportedSparqlQueryServiceLive` | `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:383` | The contract that must stay unsupported (D3) | **reuse unchanged** |
| `@beep/rdf` `Vocab/*` + `IRIReference` + `LanguageTag` | `packages/foundation/modeling/rdf/src/Vocab/{Skos,Dcterms,Prov,Owl,Rdf,Rdfs,Xsd,Oa}.ts`, `src/Iri.ts:888`, `src/Rdf.ts:336` **[read 2026-08-06]** | SKOS/DCT/PROV constants already generated; `LanguageTag` already exists | **reuse** |
| IANA BCP-47 registry + validator | `packages/foundation/modeling/html/src/internal/Html.language-tag-registry.generated.ts`, `Html.conformance.ts:678` **[read 2026-08-06]** | The tag half of the language discipline | **reuse** |
| `@beep/identity` composers | `packages/foundation/modeling/identity/src/packages.ts:40,286,301`, `src/Vocab.ts`, `src/Curie.ts` | `https://ns.beep.sh/` is the sole minting authority (D5); span-IRI questions land here | **reuse** |
| `LiteralKit`, `Model.Class`, `EntitySchema`, `EntityId`, `BaseEntity.Class`, `TaggedErrorClass`, `Principal` | `packages/foundation/modeling/schema/src/...`, `packages/shared/domain/src/entity/...` | The constructs every ported idea must be expressed in | **reuse** |
| Ontology workbench slice | `packages/ontology/{domain,use-cases,ui}` — `Session.values.ts:72` (graph partitions), `Session.sparql.ts:655`, `Session.reasoner.ts:920` | In-memory SPARQL + structural inference already exist and do not overturn D1/D3 | **reuse** |
| Law-practice / relator surfaces | `packages/law-practice/domain/src/values/{KgNodeKind,KgEdgePredicate}/`, `goals/legal-position-relator-runtime/SPEC.md` | Legal-core semantics are locked; LKIF/UFO-L content is superseded here | **reuse — do not fork** |
| **NET-NEW** (proposed) | — | `SpanClaim`/`SpanClaimSet`/`ClaimSource` (#1); `LicenseDisposition` + widened `VendorManifestEntry` (#2); `LangMap` combinator (#3); `toShacl` projection (#4, M4-gated); ELI donor profile (#5, routed) | **NET-NEW**, each on an existing owner |

---

## 5. Cross-links & provenance

**This packet**
- [`../CAPTURE.md`](../CAPTURE.md) — stage 0 raw dump (2026-08-06)
- [`../RESEARCH.md`](../RESEARCH.md) — stage 1 executive layer
- [`05-value-assessment.md`](./05-value-assessment.md) — the assessment (verdicts + shortlist)
- [`../ops/manifest.json`](../ops/manifest.json) — machine state; this file is registered as `exploration.sources`

**Upstream packets whose decisions bind this one**
- `explorations/legal-ontology-landscape` — **graduated** 2026-07-08 into
  `goals/semantic-foundation`. Wave-1 ontology verdicts, `assets/manifest.jsonl`
  licence ledger, and the CQ 1–20 competency set. Also the origin citation:
  `research/00-source-brief.md:169`.
- `goals/semantic-foundation` — **active**; D1–D10, M1 shipped, M2/M3/M4 gated,
  the R1 vendor-manifest reconciliation caveat. Landing zone for shortlist #2
  and #4.
- `explorations/legal-patent-kg-deepening` — **active**; `ROUTING-SEED.md`
  (signed off 2026-08-01) and `HANDOFF.md:47-59` hard constraints. Owns the
  unopened `legal-rule-time-identity` slug that shortlist #5 feeds.
- `goals/legal-position-relator-runtime` — **graduated** 2026-08-06; Hohfeld
  positions, relators, Party–Role split. Supersedes LKIF/UFO-L norm content.
- `goals/patent-citation-candor-gate` — impl PR #575 merged 2026-08-06;
  fact/judgment discipline.
- `goals/identity-iri-fold` — **active**; owns the `Fold.*` projection surface
  that shortlist #4 would extend.

**Corrections this packet contributes upstream**
- Wave-1 recorded LKIF-Core as unmaintained (ESTRELLA 2007–08, GitHub mirror
  only). The mirror is **actively maintained — last pushed 2026-02-23** with a
  verified CC BY 4.0 `LICENSE` (report 03 §2.4). The *dead namespace IRI* half of
  the wave-1 demotion stands; the *unmaintained* half does not.
- Lynx's reference-ontologies table has **no licence column**;
  [report 03 §4](./03-reference-ontologies-sweep.md) supplies one, read from each
  artifact. That table is the most reusable single artifact this packet produced.

**No codex review** exists for this packet (`reviews/` not present as of
2026-08-06).

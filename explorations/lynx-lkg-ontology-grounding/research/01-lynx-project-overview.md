# Lynx Project Overview — H2020 Legal Knowledge Graph for Multilingual Compliance

- **Packet:** `explorations/lynx-lkg-ontology-grounding`
- **Report:** `research/01-lynx-project-overview.md`
- **Date:** 2026-08-06
- **Scope:** what Lynx was, who built it, what it built, what survives today, and
  the exact ontology inventory (used / referenced / unfinished) with license status.
- **Method:** live fetch of <https://lynx-project.eu/> and its sub-pages, the CORDIS
  fact sheet, the open-access journal paper, plus direct probing of every Lynx
  endpoint (HTTP status, DNS, SPARQL queries) on 2026-08-06. Claims marked
  **[verified 2026-08-06]** were checked by running the command against the live
  service, not read off a page.

---

## 0. TL;DR

Lynx was a €3.64M H2020 Innovation Action (Dec 2017 – Mar 2021, GA 780602) that
built a **Legal Knowledge Graph (LKG)** plus a service platform (LynxSP) of ~14
NLP/compliance microservices over multilingual, multi-jurisdictional legal
documents. It is **formally concluded** — CORDIS status "Closed", and the project's
own last news post (2021-05-27) reads "The Lynx project has finished".

The surprise: **the data layer is still alive in 2026**. The Virtuoso SPARQL
endpoint answers queries and holds **69,960,083 triples** across 17 substantive
named graphs, including 16,710 `lkg:LynxDocument` instances **[verified
2026-08-06]**. The *service* layer is dead (all `apis.` / `auth.` hosts on
Cybly's cloud fail TLS), and the *code* is gone (GitLab group `superlynx` returns
404; the GitHub org `lynx-project` exists with **0 public repos**).

The ontology story is small and deliberately so. Lynx did **not** build a legal
domain ontology. It built one narrow **document** ontology — the LKG Ontology,
21 declared terms, `owl:imports` exactly two vocabularies (ELI and NIF) — and
reused SKOS thesauri for everything conceptual. Fifteen further legal ontologies
(Akoma Ntoso, LKIF, LegalRuleML, MetaLex, …) are catalogued as *reference only*
and were never imported. That restraint is the most portable lesson here.

---

## 1. Identity, funding, timeline

| Field | Value | Source |
|---|---|---|
| Acronym | Lynx | [CORDIS 780602](https://cordis.europa.eu/project/id/780602) |
| Full title | *Building the Legal Knowledge Graph for Smart Compliance Services in Multilingual Europe* | [CORDIS](https://cordis.europa.eu/project/id/780602) |
| Site strapline | *Lynx — Legal Knowledge Graph for Smart Compliance Services in Multilingual Europe* | <https://lynx-project.eu/> |
| Grant agreement | H2020 **No 780602** | <https://lynx-project.eu/project/legal> |
| Call / topic | **ICT-14-2016-2017** — Big Data PPP: cross-sectorial and cross-lingual data integration and experimentation | [CORDIS](https://cordis.europa.eu/project/id/780602) |
| Funding scheme | **IA** (Innovation Action) | [CORDIS](https://cordis.europa.eu/project/id/780602) |
| Start | **2017-12-01** | [CORDIS](https://cordis.europa.eu/project/id/780602) |
| End | **2021-03-31** | [CORDIS](https://cordis.europa.eu/project/id/780602) |
| Planned duration | 36 months (per deliverable cover sheets) | [D2.7 PDF, UAB copy](https://ddd.uab.cat/pub/estudis/2020/5ca923f36125/D2.7_lyn_a2020m2d29iANG.pdf) |
| Total cost | **€3,638,065.00** | [CORDIS](https://cordis.europa.eu/project/id/780602) |
| EU contribution | **€2,959,247.52** | [CORDIS](https://cordis.europa.eu/project/id/780602) |
| Status | **Closed** | [CORDIS](https://cordis.europa.eu/project/id/780602) |
| Coordinator | Universidad Politécnica de Madrid (UPM), Ontology Engineering Group; scientific/coordination contacts Elena Montiel-Ponsoda and Víctor Rodríguez-Doncel | <https://lynx-project.eu/project/consortium>, [D2.7](https://ddd.uab.cat/pub/estudis/2020/5ca923f36125/D2.7_lyn_a2020m2d29iANG.pdf) |

**Note on duration.** Deliverable cover sheets state "01/12/2017 (36 months)"
([D2.7](https://ddd.uab.cat/pub/estudis/2020/5ca923f36125/D2.7_lyn_a2020m2d29iANG.pdf)),
which would end 2020-11-30, but CORDIS records an end date of 2021-03-31 — a
~4-month extension. The final deliverables (D2.8, D4.5, D5.8, D6.6) carry
2021 Zenodo DOIs, consistent with the extension.

---

## 2. Consortium (11 entities, 7 countries)

CORDIS names the coordinator plus 10 participants. Website descriptions and
CORDIS legal entities differ in two places (flagged below).

| # | Partner | Country (CORDIS) | EU contribution | Role |
|---|---|---|---|---|
| — | **Universidad Politécnica de Madrid (UPM)** — Ontology Engineering Group | ES | *coordinator* | LKG ontology, data models, coordination |
| 1 | **Deutsches Forschungszentrum für Künstliche Intelligenz (DFKI)** | DE | €588,125.00 | NLP services, Workflow Manager, NER, summarisation |
| 2 | **Semantic Web Company (SWC)** | AT | €379,560.13 | PoolParty, Document Manager, entity linking, QA |
| 3 | **Cybly GmbH** | AT | €278,736.50 | LegalTech; operates the **openlaws** platform (Pilot 1 host) |
| 4 | **Tilde SIA** | LV | €256,647.13 | Neural MT, terminology extraction services |
| 5 | **Alpenite SRL** | IT | €217,641.38 | Platform/system integration |
| 6 | **Universitat Autònoma de Barcelona (UAB)** — Institute of Law and Technology | ES | €170,875.00 | Legal ontologies, socio-legal requirements |
| 7 | **K Dictionaries Ltd** | **IL** (CORDIS) / "multilingual" (site) | €156,170.88 | Lexicographic data (Lexicala), OntoLex-lemon |
| 8 | **Cuatrecasas Gonçalves Pereira SLP** | ES | €151,112.50 | Pilot 2 (labour law) domain owner |
| 9 | **Det Norske Veritas B.V.** ("DNV GL") | **NL** (CORDIS) / "Norway" (site) | €144,039.00 | Pilot 3 (oil & gas / energy) domain owner |
| 10 | **Universidad de Zaragoza (UNIZAR)** | ES | €36,082.50 | Translation inference, cross-lingual embeddings |

Sources: [CORDIS fact sheet](https://cordis.europa.eu/project/id/780602),
<https://lynx-project.eu/project/consortium>.

---

## 3. What Lynx built

### 3.1 The two-layer thesis

Lynx's own framing: Europe is fragmented into "legal silos and more than 20
linguistic islands" (<https://lynx-project.eu/project/summary>). The answer was
an **ecosystem of cloud services over a shared Legal Knowledge Graph** that
integrates legislation, case law, standards and private contracts across
jurisdictions and languages.

Critically, the LKG is **not** an ontology of law. The journal paper is explicit:

> "The notion of a Legal Knowledge Graph (LKG) may suggest including courts,
> judges, jurisdictions, abstract legal ideas and other general concepts. The
> Lynx Legal Knowledge Graph, however, does not contain such an assortment of
> entities, the focus is placed instead on **documents and terminological
> information**, serving the purpose to represent multilingual legal
> information."
> — Moreno Schneider et al., *Information Systems* 106 (2022) 101966, §3.1,
> [open access PDF](https://zaguan.unizar.es/record/117956/files/texto_completo.pdf)

So: **documents + terminologies are the graph**; concepts are SKOS, not OWL
axioms. A few extra natives exist (companies linked to Refinitiv PermID and NACE
codes, relevant persons), but there is no deontic layer, no rule layer, no
normative reasoning.

### 3.2 The Lynx Service Platform (LynxSP)

Documented at <https://lynx-project.eu/doc/api/>. Three infrastructure
components plus ~14 semantic services.

**Infrastructure**

| Component | Function |
|---|---|
| **Workflow Manager (WM)** | Creates/manages instances of the population workflow; automates document ingestion (DFKI) |
| **Document Manager (DCM)** | CRUD over collections, documents, annotations in the LKG; two backends (`ldp` = Trellis LDP, `upm-elastic` = Elasticsearch) |
| **Authorization & Identity** | Lynx identities and authorization policies (`auth.lynx-project.eu`) |

**Annotation services** — Temporal Expression (TimEx; EN/ES/DE), Geographical
NER (EN/DE), Named Entity Recognition (EN/ES/DE/NL), Relation Extraction (EN),
Entity Linking (EN/ES/DE/NL).

**Search / IR services** — Question Answering (EN), Cross-lingual Search
(EN/ES/DE/NL), Semantic Similarity (EN/ES/DE/NL), Terminology Query (PoolParty).

**Vocabulary services** — Dictionary service (Lexicala API), Terminology
Extraction (Tilde).

**Conversion services** — Neural Machine Translation (Tilde; DE↔ES, EN↔ALL,
ALL↔EN), Summarisation (extractive; EN/DE).

Design invariants stated in the paper (§3): all services share common interface
rules, are containerised where possible, and **all consume and emit the Lynx
Document format** — the format is the integration contract, which is why the
ontology is deliberately thin.

### 3.3 The three pilots

| Pilot | Domain | Owner | What it demonstrated |
|---|---|---|---|
| **Pilot 1** | Compliance assurance for **contracts** | Cybly / openlaws | Contract information extraction, standard-clause identification, alerting on legislative/case-law change, web search+browse+commentary; fed into openlaws.com. Surveying algorithms auto-enlarge the KB from Eur-Lex, BOE, etc. (<https://lynx-project.eu/project/pilot1>) |
| **Pilot 2** | Compliance assurance in **labour law** | Cuatrecasas | Cross-jurisdictional aggregation (EU, DE, AT, IT, ES), semantic annotation + linking of legislation/case law/administrative docs, recommender + lifecycle alerts when applicable provisions change (<https://lynx-project.eu/project/pilot2>) |
| **Pilot 3** | Compliance assurance in **oil & gas / energy** | DNV GL | Summarisation, cross-jurisdictional translation + comparison, recommender/alerts, annotation of DNV GL industry standards into the LKG with new domain-specific data models (<https://lynx-project.eu/project/pilot3>) |

The journal paper renames Pilot 3's domain as **Geothermal Energy (GTE)**
(§2.1), which is the narrowed final scope.

---

## 4. The Legal Knowledge Graph data model

### 4.1 The LKG Ontology

| Field | Value |
|---|---|
| Namespace | `http://lkg.lynx-project.eu/def/` |
| Prefix | `lkg` (`vann:preferredNamespacePrefix "lkg"`) |
| Version | **1.2** (HTML doc) / `owl:versionInfo "1.2.0"@en` (TTL) |
| Authors | Víctor Rodríguez-Doncel (creator); contributors Sotiris Karampatakis, Filippo Maganza, Socorro Bernardos, Julián Moreno-Schneider |
| Publisher | "The Lynx Project Consortium" |
| **License** | **CC-BY 4.0** — `terms:license <http://purl.org/NET/rdflicense/cc-by4.0>` in the TTL, and the same badge in the HTML spec |
| HTML spec | <https://lynx-project.eu/doc/lkg/> **[verified live 2026-08-06]** |
| Turtle | <http://lynx-project.eu/doc/lkg.ttl> — 12,767 bytes **[verified 2026-08-06]** |
| RDF/XML | <http://lynx-project.eu/doc/lkg.rdf> — **404, dead link** (still referenced from the spec) |
| JSON-LD context | <http://lynx-project.eu/doc/jsonld/lynxdocument.json> **[verified live]** |
| SHACL shapes | <http://lynx-project.eu/doc/lkg-shapes.ttl> (9,268 B), <http://lynx-project.eu/doc/nif-shapes.ttl> (2,803 B) **[verified live]** |
| Benchmark data | <https://lynx-project.eu/data/benchmarking.zip> (2.43 MB) **[verified live]** |

**Complete term inventory** (parsed from `lkg.ttl` **[verified 2026-08-06]** —
21 declared terms, that is the whole ontology):

- **Classes (10):** `LynxDocument`, `LynxDocumentPart`, `LynxAnnotation`,
  `Metadata`, `Legislation`, `Agreement`, `CollectiveAgreement`, `CaseLaw`,
  `Standard`, `TechnicalSpecification`
- **Object properties (4):** `metadata`, `parent`, `hasEli`, `hasDbpedia`
- **Datatype properties (7):** `accessGroup`, `hasAuthority`, `hasPDF`,
  `hasWikipedia`, `summary`, `wasExtractedFrom`

**Structural design.** `lkg:LynxDocument rdfs:subClassOf nif:Context` — every
document is an NLP-annotatable context. Document parts are offset-delimited
(`nif:beginIndex` / `nif:endIndex`), nested via `lkg:parent`, aggregated via
`eli:has_part`, and each part points back with `nif:referenceContext`.
Annotations are NIF `AnnotationUnit`s carrying `itsrdf:taClassRef` /
`taIdentRef` / `taConfidence` / `taAnnotatorsRef`. Metadata is a reified
`lkg:Metadata` node treated as an `eli:LegalExpression`.

This is the single most portable idea in the whole project: **stand-off,
offset-anchored annotation over an immutable text spine, with metadata reified
as a separate node**. It is why one document format could serve 14 heterogeneous
services.

### 4.2 Why not Akoma Ntoso or TEI

The paper documents an explicit, reasoned rejection (§3.1):

> "Akoma Ntoso is a highly complex and also extensible standard … The standard is
> fully focused on the assumption that **human experts create and maintain**
> Akoma Ntoso documents … Our focus in Lynx, on the other hand, is the
> **automated processing** of documents … this use case is not immediately
> enabled or supported by Akoma Ntoso but there are a number of more
> 'lightweight' best practice approaches in use in NLP that have been easier and
> more efficient to implement … The same is true for the guidelines of the Text
> Encoding Initiative (TEI), which we also thoroughly examined … arriving at the
> same conclusion."

They also rejected ELI as a sufficient base — "not even legislation obtained from
ELI-compliant sources is sufficiently coherent for the purposes of Lynx… each EU
country coined its own specialisation of the ELI ontology" — and therefore built
"a new data model, **inspired by ELI**".

They likewise rejected W3C Time Ontology for temporal annotation (§5.3):
"we do not use time specific ontologies such as the Time Ontology because it
would not offer any advantage with regard to maintaining the TimeML format."

---

## 5. Ontology inventory

### 5.1 Ontologies Lynx actually USED (imported / in the data)

| Ontology | Namespace | How used | License | Port discipline |
|---|---|---|---|---|
| **LKG Ontology** (Lynx's own) | `http://lkg.lynx-project.eu/def/` | The data model itself | **CC-BY 4.0** (declared in TTL) | **port-with-attribution** |
| **NIF Core 2.0** | `http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#` | `owl:imports`; `LynxDocument ⊑ nif:Context`; all annotation anchoring | **Apache-2.0** file header + `dcterms:license <http://creativecommons.org/licenses/by/3.0/>` in `nif-core.ttl` **[verified 2026-08-06]** ([source](https://raw.githubusercontent.com/NLP2RDF/ontologies/master/nif-core/nif-core.ttl)) | **port-with-attribution** |
| **ELI** (European Legislation Identifier) | `http://data.europa.eu/eli/ontology#` | `owl:imports`; metadata vocabulary (`eli:id_local`, `eli:jurisdiction`, `eli:type_document`, `eli:has_part`, `eli:LegalExpression`) | EU reuse policy; EUR-Lex legal notice: editorial content **CC-BY 4.0**, metadata **CC0 1.0** ([legal notice](https://eur-lex.europa.eu/content/legal-notice/legal-notice.html)) | **port-with-attribution** |
| **ITS 2.0 / RDF (itsrdf)** | `http://www.w3.org/2005/11/its/rdf#` | Annotation payloads: `taClassRef`, `taIdentRef`, `taConfidence`, `taAnnotatorsRef`, `target` | W3C document/software licenses | port-with-attribution |
| **SKOS** | `http://www.w3.org/2004/02/skos/core#` | The entire terminology layer (`Concept`, `prefLabel`, `altLabel`, `definition`, `note`, `broader`, `narrower`, `related`, `closeMatch`) | W3C Recommendation | port-with-attribution |
| **Dublin Core (dct + dc/1.1)** | `http://purl.org/dc/terms/`, `http://purl.org/dc/elements/1.1/` | Metadata: `language`, `title`, `creator`, `created`, `subject`, `source`, `jurisdiction` | DCMI, permissive | port-with-attribution |
| **PROV-O** | `http://www.w3.org/ns/prov#` | Provenance of annotations | W3C Recommendation | port-with-attribution |
| **FOAF** | `http://xmlns.com/foaf/0.1/` | Agents | CC-BY 1.0 | port-with-attribution |
| **VANN** | `http://purl.org/vocab/vann/` | Namespace prefix metadata | permissive | port-with-attribution |
| **DBpedia ontology (dbo)** | `http://dbpedia.org/ontology/` | NER class refs: `dbo:Person`, `dbo:Location`, `dbo:Organization` | CC-BY-SA 3.0 (DBpedia) | **copyleft — reference only for the data; class IRIs are fine to cite** |
| **OntoLex-lemon** (+ `lexicog`, `vartrans` modules) | `https://www.w3.org/2016/05/ontolex/` | Domain-independent lexical data (K Dictionaries) | W3C Community Group report | port-with-attribution |
| **LexInfo 3.0** | `https://lexinfo.net/ontology/3.0/lexinfo` | Morphosyntactic categories on lemon entries | not stated on the Lynx page — **verify before reuse** | reference-only until verified |
| **SHACL** | `http://www.w3.org/ns/shacl#` | Validation shapes for LynxDocument | W3C Recommendation | port-with-attribution |
| **RDF / RDFS / OWL / XSD** | — | Substrate | W3C | — |

Sources: <https://lynx-project.eu/doc/lkg/>, `lkg.ttl` **[verified]**,
`lynxdocument.json` **[verified]**,
<https://lynx-project.eu/data2/domain-independent-vocabularies>, IS 2022 §§3–5.

### 5.2 Ontologies Lynx CATALOGUED as reference but did NOT adopt

The LKG spec says "Other ontologies have been also **considered as a reference**"
and links <https://lynx-project.eu/data2/reference-ontologies>. None of these
appear in `owl:imports` or in the live graph. Full table as published
(15 entries):

| Prefix | Name | Format | Jurisdiction | Artifact URL |
|---|---|---|---|---|
| `akn` | Akoma Ntoso (also LegalDocML / AKN4EU) | XML | all | [XSD](http://docs.oasis-open.org/legaldocml/akn-core/v1.0/cs01/part2-specs/schemas/akomantoso30.xsd), [docs](http://www.akomantoso.org/) |
| `cdm` | Common Data Model (Publications Office, FRBR-based) | RDF | EU | [CDM](https://publications.europa.eu/en/web/eu-vocabularies/cdm) |
| `chlexml` | CHLexML (Swiss legal acts) | RDF/XML | CH | [schema](https://www.ech.ch/alfresco/s/ech/download?nodeid=02d08802-7651-4ec3-9f93-7d6f36f2e8d8) |
| `eli` | European Legislation Identifier | RDF/OWL | EU | [eli.owl](http://publications.europa.eu/mdr/resource/eli/eli.owl) — *(this one WAS adopted; see §5.1)* |
| `laki` | Finlex Legislation Metadata Schema | RDF | FI | [LODE view](http://eelst.cs.unibo.it/apps/LODE/source?url=http://purl.org/finlex/schema/laki/) |
| `lrml` | LegalRuleML metamodel | RDF | EU | [RDFS](http://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/csprd02/rdfs/) |
| `lexdania` | LexDania (Danish ministerial regulations) | XML | DK | [XSD](https://www.retsinformation.dk/offentlig/xml/schemas/2016/09/26/LexDania_2.1.xsd) |
| `lexicog` | OntoLex-lemon Lexicography Module | RDF | all | [ns](http://www.w3.org/ns/lemon/lexicog), [docs](https://jogracia.github.io/ontolex-lexicog/) |
| `lkif` | LKIF Legal Core Ontology (15 modules) | RDF | EU | [github RinkeHoekstra/lkif-core](https://github.com/RinkeHoekstra/lkif-core) |
| `metalex` | CEN MetaLex | RDF/OWL | EU | [metalex-cen.owl](http://www.metalex.eu/metalex-cen.owl) |
| `nomothesia` | Nomothesia (Greek legislation) | RDF/OWL | EL | [legislation.owl](http://legislation.di.uoa.gr/legislation.owl) |
| `nir` | Norme In Rete (Italian normative docs) | XML | IT | [guidelines PDF](http://vitali.web.cs.unibo.it/twiki/pub/NIR/WebHome/LineeguidadellamarcaturadidocumentilegislativisecondoNormeInRete.pdf) — *the `rdf` link on the Lynx page is a placeholder: `http://www.private.you-know-italians.xsd`* |
| `oikeus` | Finlex Case-law Metadata Schema | RDF | FI | [LODE view](http://eelst.cs.unibo.it/apps/LODE/source?url=http://purl.org/finlex/schema/oikeus/) |
| `pco` | Public Contracts Ontology (OpenData.cz) | RDF | all | [github opendatacz/public-contracts-ontology](https://github.com/opendatacz/public-contracts-ontology) |
| `eu-cbcm` | EU Cross-border Company Mobility Ontology | RDF/OWL | EU | [Maastricht IDS release](https://github.com/MaastrichtU-IDS/cbcm-ontology/releases/download/1.0/eu-cm-ontology_owlxml.owl), [docs](https://maastrichtu-ids.github.io/cbcm-ontology/) |

**License status: not recorded by Lynx for any of them.** The reference-ontologies
table has columns for prefix / format / name / description / language /
jurisdiction — **no license column**. Treat every row as **reference-only** until
independently verified at its own upstream. (LKIF and PCO are on GitHub and can
be checked directly; `nir`'s RDF link is a joke placeholder, so that row carries
no artifact at all.)

### 5.3 Ontologies PLANNED but NOT finished — hard evidence

This is the part the site does not tell you; it falls out of diffing the
published spec against the published TTL and the live graph.

1. **`lkg:Collection` — specified in prose, never modeled.** The spec's own
   introduction names Collections as one of *three* main entities: "Collections
   are groups of Lynx Documents with any logical relation. There may be one
   collection per use case, per jurisdiction, etc." and then immediately admits
   **"Collections are not specified in this document."**
   `grep -i ':Collection' lkg.ttl` → **0 hits [verified 2026-08-06]**. The
   Document Manager API manages collections as a REST resource, so the concept
   shipped in code but never in the ontology.

2. **`lkg:Doctrine` — used in production data, never declared.** Annex I of the
   spec lists valid `@type` values as "`lkg:Legislation`, `lkg:CaseLaw`,
   **`lkg:Doctrine`**, `lkg:Standard`". `grep -i ':Doctrine' lkg.ttl` → **0 hits**.
   But the live SPARQL endpoint returns **3,059 instances of
   `http://lkg.lynx-project.eu/def/Doctrine` [verified 2026-08-06]**. The data
   outran the ontology — an undeclared class with three thousand members in the
   shipped graph.

3. **`lkg:translation` — referenced in the spec table, never declared.** Annex I
   maps JSON `translations` → RDF `lkg:translation`;
   `grep -i ':translation' lkg.ttl` → **0 hits**. The JSON-LD context resolves
   `translations` to `itsrdf:target` instead — the spec table and the shipped
   context disagree, and neither matches the ontology.

4. **`lkg:annotation` / `lkg:part` — same pattern.** Annex I cites `lkg:annotation`
   and `lkg:part`; the TTL declares neither as a property (only the class
   `LynxAnnotation`), and the JSON-LD context routes `annotations` through
   `@reverse: nif:referenceContext` and `parts` through `eli:has_part`.

5. **RDF/XML serialization — promised, 404.** The spec's own download block links
   `http://lynx-project.eu/doc/lkg.rdf`; it returns **404 [verified 2026-08-06]**
   (the XML badge is commented out in the page HTML — they knew).

6. **Akoma Ntoso / TEI interoperability — deferred to "the future".** "In the
   future, interoperability between Lynx Documents and Akoma Ntoso or TEI
   documents can be easily achieved using transformation tools such as XSLT
   stylesheets or Python scripts" (IS 2022 §3.1). No such transformation ships.

7. **Deontic / rule layer — never attempted.** LegalRuleML and LKIF sit in the
   reference table and nowhere else. The paper's own conclusion frames Lynx as a
   *document + terminology* graph and calls for institutions to adopt CEN MetaLex
   and OASIS LegalDocML — i.e. the normative-structure problem is named as
   *someone else's* unfinished work
   ([Law in Context 37(1):175-178](https://doi.org/10.26826/law-in-context.v37i1.129), §3).

**Reading.** Points 1–4 are the same failure mode: the ontology file was frozen at
v1.2 while the spec prose, the JSON-LD context, the SHACL shapes and the
production data kept moving. If this packet ports the LKG model, port it from
**`lkg.ttl` + `lynxdocument.json` + `lkg-shapes.ttl` read together**, and treat
the HTML spec's Annex I as aspirational.

### 5.4 Terminologies / KOS actually loaded into the graph

**[verified 2026-08-06 by SPARQL against <https://sparql.lynx-project.eu/sparql>]** —
all 17 substantive named graphs, by triple count:

| Named graph | Triples | What it is |
|---|---:|---|
| `http://lkg.lynx-project.eu/iate` | 63,043,188 | **IATE** — EU Interactive Terminology for Europe |
| `http://sparql.lynx-project.eu/graph/eurovoc` | 3,526,462 | **EuroVoc** — EU multilingual thesaurus |
| `http://lkg.lynx-project.eu/data/es/all` | 1,409,491 | Spanish legislation + collective agreements |
| `http://lkg.lynx-project.eu/data/nl/legislation` | 375,361 | Dutch legislation |
| `http://lkg.lynx-project.eu/data/gr/legislation` | 335,400 | Greek legislation |
| `http://lkg.lynx-project.eu/thesoz` | 286,394 | **TheSoz** — Thesaurus for the Social Sciences |
| `http://lkg.lynx-project.eu/data/eu/legislation` | 270,824 | EU legislation |
| `http://lkg.lynx-project.eu/data/mx/legislation` | 201,297 | Mexican legislation |
| `http://lkg.lynx-project.eu/stw` | 111,943 | **STW Thesaurus for Economics** (ZBW) |
| `http://lkg.lynx-project.eu/data/ie/legislation` | 98,762 | Irish legislation |
| `http://lkg.lynx-project.eu/ilo` | 98,095 | **ILO Thesaurus** (labour, trilingual EN/ES/FR) |
| `http://lkg.lynx-project.eu/unesco-thesaurus` | 75,172 | **UNESCO Thesaurus** |
| `http://lkg.lynx-project.eu/unesco-thesauru` | 75,172 | *duplicate load, typo'd graph IRI (missing final `s`)* |
| `http://lkg.lynx-project.eu/data/au/legislation` | 32,810 | Australian legislation |
| `http://lkg.lynx-project.eu/terminology` | 7,825 | Lynx-generated pilot terminologies |
| `http://lkg.lynx-project.eu/data/at/legislation` | 6,265 | Austrian legislation |
| `http://lynx-project.eu/test` | 1 | test |

Plus Virtuoso system graphs (`localhost:8890/DAV/`, `virtrdf#`, `owl#`, `ldp#`).
**Total: 69,960,083 triples.**

Note the operational tell: the UNESCO thesaurus is loaded **twice** under a
typo'd and a correct graph IRI, and the graph list includes **MX and AU** — two
jurisdictions absent from every project description. The graph outgrew the
project narrative.

Document-level census **[verified 2026-08-06]**:

| Type | Instances |
|---|---:|
| `lkg:LynxDocumentPart` | 270,695 |
| `lkg:LynxDocument` | 16,710 |
| `lkg:Legislation` | 9,488 |
| `lkg:CollectiveAgreement` | 4,163 |
| `lkg:Doctrine` | **3,059** (undeclared class — see §5.3) |

Terminology methodology (IS 2022 §4): Lynx-generated terminologies are SKOS,
enriched from the **Linguistic Linked Open Data cloud** — EuroVoc, UNESCO
Thesaurus, Wikidata — plus the **Lexicala API** (synonyms/translations/definitions)
and **IATE**. `skos:closeMatch` carries the external links, `skos:note` the
extraction context, `dc:jurisdiction` the source corpus jurisdiction,
`dc:source` the provenance. Notably the acquisition pipeline had **"Checking
licensing information"** as step 2 of 5 — Lynx treated license status as a
gating criterion, same discipline this packet uses.

---

## 6. Key publications

Full list at <https://lynx-project.eu/publications/articles> (31 papers + 5
workshop proceedings volumes). The load-bearing ones:

**Primary / canonical**

1. **Moreno Schneider, J., Rehm, G., Montiel-Ponsoda, E., Rodríguez-Doncel, V.,
   Martín-Chozas, P., Navas-Loro, M., Kaltenböck, M., Revenko, A., Karampatakis, S.,
   Sageder, C., Gracia, J., Maganza, F., Kernerman, I., Lonke, D., Lagzdins, A.,
   Bosque Gil, J., Verhoeven, P., Gómez Díaz, E., Boil Ballesteros, P. (2022).**
   *Lynx: A knowledge-based AI service platform for content processing, enrichment
   and analysis for the legal domain.* **Information Systems 106, 101966.**
   DOI [10.1016/j.is.2021.101966](https://doi.org/10.1016/j.is.2021.101966).
   **Open access, CC-BY 4.0** — PDF:
   <https://zaguan.unizar.es/record/117956/files/texto_completo.pdf>.
   *→ The definitive technical account. §3.1 is the LKG data model, §§4–5 the
   linguistic resources and every service. Start here.*

2. **Rodríguez-Doncel, V. & Montiel-Ponsoda, E. (2021).** *Lynx: Towards a Legal
   Knowledge Graph for Multilingual Europe.* **Law in Context 37(1): 175-178.**
   DOI [10.26826/law-in-context.v37i1.129](https://doi.org/10.26826/law-in-context.v37i1.129).
   **CC BY-NC-SA 4.0** — PDF:
   <https://pdfs.semanticscholar.org/df90/3717a0d8739ec7c420e707d2205dfeccd57c.pdf>.
   *→ 4-page retrospective. Contains the licensing statement: "a large part of the
   source code and resulting data have been licensed openly", while naming
   PoolParty, Tilde MT and K Dictionaries' Lexicala as the closed components.*

3. **Montiel-Ponsoda, E., Rodríguez-Doncel, V., Gracia, J. (2017).** *Building the
   Legal Knowledge Graph for Smart Compliance Services in Multilingual Europe.*
   TERECOM@JURIX 2017, 15-17. <http://ceur-ws.org/Vol-2049/02paper.pdf>.
   *→ The original vision paper.*

**Platform / services**

4. Rehm, G., Moreno-Schneider, J., Gracia, J., et al. (2019). *Developing and
   Orchestrating a Portfolio of Natural Legal Language Processing and Document
   Curation Services.* NLLP@NAACL. <https://www.aclweb.org/anthology/W19-2207/>
5. Moreno-Schneider, J., Rehm, G., Montiel-Ponsoda, E., et al. (2020).
   *Orchestrating NLP Services for the Legal Domain.* LREC 2020.
   <https://www.aclweb.org/anthology/2020.lrec-1.284.pdf>
6. Moreno-Schneider, J., Bourgonje, P., Kintzel, F., Rehm, G. (2020). *A Workflow
   Manager for Complex NLP and Content Curation Pipelines.* IWLTP@LREC 2020.

**Data / requirements**

7. González-Conejero, J., Casanovas, P., Teodoro, E. (2018). *Business
   Requirements for Legal Knowledge Graph: the LYNX Platform.* TERECOM 2018.
   <http://ceur-ws.org/Vol-2309/03.pdf>
8. Rodríguez-Doncel, V., Navas-Loro, M., Montiel-Ponsoda, E., Casanovas, P.
   (2018). *Spanish Legislation as Linked Data.* TERECOM 2018.
   <http://ceur-ws.org/Vol-2309/12.pdf>
9. Martín-Chozas, P., Ahmadi, S., Montiel-Ponsoda, E. (2020). *Defying Wikidata:
   Validation of Terminological Relations in the Web of Data.* LREC 2020.
   <https://www.aclweb.org/anthology/2020.lrec-1.694.pdf>

**Datasets that outlived the project**

10. Leitner, E., Rehm, G., Moreno-Schneider, J. (2020). *A Dataset of German Legal
    Documents for Named Entity Recognition.* LREC 2020.
    <http://www.lrec-conf.org/proceedings/lrec2020/pdf/2020.lrec-1.551.pdf>
11. Leitner, E., Rehm, G., Moreno-Schneider, J. (2019). *Fine-Grained Named Entity
    Recognition in Legal Documents.* SEMANTiCS 2019.
    <https://link.springer.com/chapter/10.1007/978-3-030-33220-4_20>

**Workshop proceedings Lynx organised**

- TERECOM@JURIX 2017 — CEUR Vol-2049 <http://ceur-ws.org/Vol-2049/>
- LREC 2018 Workshop on Language Resources and Technologies for the Legal
  Knowledge Graph — <http://legalkg2018.lynx-project.eu/proceedings.pdf>
  **[verified live 2026-08-06]**
- TERECOM 2018 — CEUR Vol-2309 <http://ceur-ws.org/Vol-2309/>
- TIAD-2019 — CEUR Vol-2493 <http://ceur-ws.org/Vol-2493/>

**38 public deliverables**, all on Zenodo with DOIs, listed at
<https://lynx-project.eu/publications/deliverables>. Most relevant here:

| ID | Title | DOI |
|---|---|---|
| D1.3 | Technical architecture design | [10.5281/zenodo.2580245](https://doi.org/10.5281/zenodo.2580245) |
| D2.5 | Report on Lynx acquired vocabularies | [10.5281/zenodo.3558710](https://doi.org/10.5281/zenodo.3558710) — **CC-BY 4.0**; authors Kernerman, Martín-Chozas, Lagzdiņš, Gracia; 2019-11-30 |
| D2.7 | Catalogue of relevant legal and regulatory datasets | [10.5281/zenodo.3692561](https://doi.org/10.5281/zenodo.3692561) — also mirrored at [UAB](https://ddd.uab.cat/pub/estudis/2020/5ca923f36125/D2.7_lyn_a2020m2d29iANG.pdf) |
| D2.8 | Final report of the data management activities | [10.5281/zenodo.4651389](https://doi.org/10.5281/zenodo.4651389) |
| D3.10 | Final platform prototype | [10.5281/zenodo.4298974](https://doi.org/10.5281/zenodo.4298974) |
| D5.8 | Evaluation Report of the Lynx platform and pilots | [10.5281/zenodo.4651375](https://doi.org/10.5281/zenodo.4651375) |

---

## 7. Survival audit — what still exists on 2026-08-06

All rows **[verified 2026-08-06]** by direct HTTP/DNS/SPARQL probe.

### ALIVE

| Artifact | URL | Evidence |
|---|---|---|
| Project website (Joomla/T3) | <https://lynx-project.eu/> | HTTP 200, all sub-pages 200 |
| **SPARQL endpoint (Virtuoso)** | <https://sparql.lynx-project.eu/sparql> | HTTP 200; answers queries; **69,960,083 triples**, 17 substantive graphs |
| **LKG document browser** | <http://lkg.lynx-project.eu/> | HTTP 200 — "Lynx Access to Legislation" |
| **Terminology / KOS browser** | <http://lkg.lynx-project.eu/kos> | HTTP 200; `/kos/download` serves bulk terminology |
| LKG Ontology spec (HTML) | <https://lynx-project.eu/doc/lkg/> | HTTP 200, 152 KB |
| LKG Ontology (Turtle) | <http://lynx-project.eu/doc/lkg.ttl> | HTTP 200, 12,767 B |
| JSON-LD context | <http://lynx-project.eu/doc/jsonld/lynxdocument.json> | HTTP 200 |
| SHACL shapes | `…/doc/lkg-shapes.ttl`, `…/doc/nif-shapes.ttl` | HTTP 200, 9,268 B / 2,803 B |
| Benchmark bundle | <https://lynx-project.eu/data/benchmarking.zip> | HTTP 200, 2,434,315 B |
| API catalogue page | <https://lynx-project.eu/doc/api/> | HTTP 200 (page lives; the APIs it points at do not) |
| All 38 deliverables | Zenodo DOIs | permanent |
| **`oeg-upm/lynx-py`** | <https://github.com/oeg-upm/lynx-py> | **Apache-2.0**, Python, last push 2021-05-18, not archived — "Library for accessing and consume services developed in the European Project Lynx" |
| `osoc-es/lynx-Sight` | <https://github.com/osoc-es/lynx-Sight> | Open Summer of Code graph-visualisation tool for legal knowledge; demo at <https://osoc-es.github.io/lynx-Sight/> |
| openlaws (Pilot 1 host) | <https://openlaws.com> | HTTP 200 |
| Social / video | <https://twitter.com/lynxh2020>, <https://www.linkedin.com/company/lynx-project-h2020/>, <https://www.youtube.com/channel/UCiamvjcw-ljxZla9M2Cjzeg> | listed on site |

### DEAD

| Artifact | URL | Evidence |
|---|---|---|
| **Open Data Portal (CKAN)** | <http://data.lynx-project.eu> | DNS resolves (138.100.15.170) but **"Recv failure: Connection reset by peer"** |
| **All platform APIs** | `https://apis.lynx-project.eu/*` | DNS → 83.65.181.84 (`dmz.cybly.cloud`); **TLS: "unexpected eof while reading"** |
| **Auth service** | <https://auth.lynx-project.eu/auth/> | same host, same TLS failure |
| PoolParty terminology API | <https://lynx.poolparty.biz/PoolParty/api> | unreachable |
| Cybly (partner site) | <https://www.cybly.at> | HTTP 000 |
| **Source code (GitLab)** | `https://gitlab.com/superlynx/**` | group API **404 Group Not Found**; repo page **403** |
| GitHub org `lynx-project` | <https://github.com/lynx-project> | org exists (created 2019-07-18) with **0 public repos**, never updated |
| RDF/XML serialization | <http://lynx-project.eu/doc/lkg.rdf> | **404** (still linked from the spec) |

### Is the project alive or concluded?

**Concluded, with a zombie data layer.** CORDIS status is "Closed". The project's
own final news post, dated **2021-05-27**, is titled *"The Lynx project has
finished"* / *"The Lynx Service Platform is alive"* and states the H2020 project
ended 31 March and the platform is "fully running and ready to be applied to your
use case" (<https://lynx-project.eu/news>). **That commercial claim is now false**
— every service host and the data portal are down. The webinar series
(2020-12-10 → 2021-02-18) was the exploitation push; there is no activity after
May 2021 anywhere on the site.

What did survive is the part UPM hosts on its own infrastructure
(138.100.11.141 = UPM): the website, the ontology, the document browser, and the
70M-triple Virtuoso store. What died is the part Cybly hosted (83.65.181.84):
every API.

**No successor project.** UPM's OEG later published `oeg-upm/term-rag`
("Terminology Enhanced Retrieval Augmented Generation for Spanish Legal Corpora",
last push 2025-04-02, <https://github.com/oeg-upm/term-rag>), which is thematic
continuity by the same group, not a Lynx continuation.

---

## 8. License summary and port discipline

| Asset | License | Verified? | Discipline for this packet |
|---|---|---|---|
| **LKG Ontology** (`lkg.ttl`, spec, JSON-LD context, SHACL shapes) | **CC-BY 4.0** | ✅ `terms:license <http://purl.org/NET/rdflicense/cc-by4.0>` in TTL | **port-with-attribution** — the model may be reproduced/adapted with credit to "The Lynx Project Consortium" |
| **NIF Core 2.0** | Apache-2.0 header + `dcterms:license` CC-BY 3.0 | ✅ read from `nif-core.ttl` | **port-with-attribution** |
| **ELI ontology** | EU reuse policy; EUR-Lex editorial CC-BY 4.0, metadata CC0 1.0 | ✅ [EUR-Lex legal notice](https://eur-lex.europa.eu/content/legal-notice/legal-notice.html) | **port-with-attribution** |
| **IS 2022 paper** | **CC-BY 4.0** (Elsevier open access) | ✅ stated on the PDF | quotable, adaptable with citation |
| **Law in Context 2021 paper** | **CC BY-NC-SA 4.0** | ✅ stated on the PDF | **copyleft + NC** — quote and cite; do **not** adapt text into a commercial deliverable |
| **Deliverable D2.5** (and Zenodo deliverables generally) | **CC-BY 4.0** | ✅ Zenodo record | port-with-attribution |
| `oeg-upm/lynx-py` | **Apache-2.0** | ✅ GitHub API | **port-with-attribution** — the only Lynx client code publicly available |
| **LynxSP platform source** | — | n/a | **unavailable** (GitLab 404/403). Reference-only via the papers; there is nothing to port |
| **15 reference ontologies** (§5.2) | **not recorded by Lynx** | ❌ | **reference-only** until each is independently license-checked at its upstream |
| **LexInfo 3.0** | not stated | ❌ | reference-only pending verification |
| **DBpedia ontology / data** | CC-BY-SA 3.0 | (widely documented) | **copyleft — clean-room**; citing `dbo:` class IRIs is fine, ingesting DBpedia data is not free |
| **IATE / EuroVoc / UNESCO / ILO / STW / TheSoz data in the endpoint** | per-source, **not restated by Lynx** | ❌ | **reference-only** — each thesaurus carries its own terms; do not assume the Lynx graph re-licenses them |
| **Commercial components** (PoolParty, Tilde MT, Lexicala/K Dictionaries) | proprietary | ✅ named as closed in Law in Context §3 | **do not port** |

**Bottom line for the packet:** the one thing we can lawfully and cleanly port is
**the LKG document model** (CC-BY 4.0) and its two imports (both permissive). The
70M-triple graph is a *reading* resource, not a re-publishing resource.

---

## 9. What this means for the packet (grounding notes)

1. **The model to port is small.** 10 classes, 11 properties, two imports. If we
   port anything, port the *stand-off annotation contract*: an immutable text
   spine (`nif:isString` + begin/end offsets), a nested part structure with an
   explicit `parent`, reified metadata, and annotations as separate nodes that
   reference the context. That contract is what let 14 heterogeneous services
   interoperate — it is the transferable engineering result, not the class names.

2. **Lynx's ontology restraint was deliberate and vindicated.** They examined
   Akoma Ntoso, TEI, LKIF, LegalRuleML, MetaLex and Time Ontology and adopted
   none, because their workload was *automated enrichment*, not *human-authored
   normative structure*. Any beep-effect legal-KG design should make the same
   determination explicitly rather than defaulting to a heavyweight legal
   ontology.

3. **The concept layer was SKOS, not OWL.** All 70M triples of conceptual content
   are `skos:Concept` graphs with `closeMatch` links outward. Zero OWL reasoning.
   That is a strong prior for a schema-first design: model documents and spans
   rigorously; keep the taxonomy loose and linkable.

4. **Their failure mode is our warning.** The spec, the TTL, the JSON-LD context
   and the SHACL shapes drifted apart (§5.3) — `Doctrine` has 3,059 live instances
   and no declaration. In our terms: the schema stopped being the single source of
   truth and four artifacts had to be hand-synced. Schema-is-truth with generated
   context/shapes/docs is exactly the fix.

5. **License hygiene was a first-class pipeline step for them too** — "Checking
   licensing information" is step 2 of their 5-step resource acquisition
   methodology (IS 2022 §4.2). Same discipline as this packet's SOURCES.md rules.

---

## 10. Open questions / gaps in this sweep

- **LynxSP source code is unreachable.** `gitlab.com/superlynx` is 404/403 — either
  deleted or made private. Worth one attempt via the Wayback Machine or a direct
  ask to OEG-UPM if the workflow/document-manager implementation matters.
- **Reference-ontology licenses are all unverified.** If any of the 15 (esp. LKIF,
  PCO, MetaLex, LegalRuleML, eu-cbcm) become load-bearing, each needs its own
  license check before use. Not done here — the Lynx table has no license column.
- **Thesaurus data licenses in the live endpoint are unverified.** IATE, EuroVoc,
  ILO, STW, TheSoz, UNESCO each carry independent terms.
- **D1.3 (technical architecture) and D3.10 (final platform prototype) not read.**
  They are the deepest architecture sources and are public on Zenodo; the IS 2022
  paper was used as the substitute here.
- **`lkg:Doctrine` instances not sampled.** Worth one query to see what 3,059
  undeclared-class documents actually are (likely Spanish doctrinal commentary in
  the `data/es/all` graph).
- **Wayback coverage of `data.lynx-project.eu` (CKAN) not checked** — the dataset
  catalogue may be recoverable from snapshots.

---

## Sources

**Project (primary)**
- <https://lynx-project.eu/> — homepage
- <https://lynx-project.eu/project/summary>
- <https://lynx-project.eu/project/consortium>
- <https://lynx-project.eu/project/pilot1> · <https://lynx-project.eu/project/pilot2> · <https://lynx-project.eu/project/pilot3>
- <https://lynx-project.eu/project/legal> — licensing/disclaimer notice
- <https://lynx-project.eu/project/related> — 13 related initiatives
- <https://lynx-project.eu/news> — final post 2021-05-27
- <https://lynx-project.eu/webinars> — 4 webinars, 2020-12-10 → 2021-02-18
- <https://lynx-project.eu/publications/articles> · <https://lynx-project.eu/publications/deliverables>
- <https://lynx-project.eu/data2> · <https://lynx-project.eu/data2/data-models> · <https://lynx-project.eu/data2/reference-ontologies> · <https://lynx-project.eu/data2/domain-independent-vocabularies>
- <https://lynx-project.eu/doc/api/> — service catalogue

**Ontology artifacts**
- <https://lynx-project.eu/doc/lkg/> — LKG Ontology spec v1.2, CC-BY 4.0
- <http://lynx-project.eu/doc/lkg.ttl> · <http://lynx-project.eu/doc/lkg-shapes.ttl> · <http://lynx-project.eu/doc/nif-shapes.ttl>
- <http://lynx-project.eu/doc/jsonld/lynxdocument.json>
- <https://raw.githubusercontent.com/NLP2RDF/ontologies/master/nif-core/nif-core.ttl> — NIF license
- <https://eur-lex.europa.eu/content/legal-notice/legal-notice.html> — EU/ELI reuse terms

**Live services (probed 2026-08-06)**
- <https://sparql.lynx-project.eu/sparql> — Virtuoso, 69,960,083 triples
- <http://lkg.lynx-project.eu/> · <http://lkg.lynx-project.eu/kos>

**Funding / official**
- <https://cordis.europa.eu/project/id/780602> — CORDIS fact sheet

**Publications**
- <https://doi.org/10.1016/j.is.2021.101966> — IS 2022 (CC-BY 4.0); PDF <https://zaguan.unizar.es/record/117956/files/texto_completo.pdf>
- <https://doi.org/10.26826/law-in-context.v37i1.129> — Law in Context 2021 (CC BY-NC-SA 4.0); PDF <https://pdfs.semanticscholar.org/df90/3717a0d8739ec7c420e707d2205dfeccd57c.pdf>
- <http://ceur-ws.org/Vol-2049/02paper.pdf> — Montiel-Ponsoda et al. 2017
- <http://ceur-ws.org/Vol-2309/03.pdf> · <http://ceur-ws.org/Vol-2309/12.pdf> — TERECOM 2018
- <https://www.aclweb.org/anthology/W19-2207/> · <https://www.aclweb.org/anthology/2020.lrec-1.284.pdf>
- <https://ddd.uab.cat/pub/estudis/2020/5ca923f36125/D2.7_lyn_a2020m2d29iANG.pdf> — D2.7 (UAB mirror)
- <https://doi.org/10.5281/zenodo.3558710> — D2.5, CC-BY 4.0
- <http://legalkg2018.lynx-project.eu/proceedings.pdf> — LREC 2018 workshop

**Code**
- <https://github.com/oeg-upm/lynx-py> — Apache-2.0
- <https://github.com/osoc-es/lynx-Sight> · <https://osoc-es.github.io/lynx-Sight/>
- <https://github.com/lynx-project> — org, 0 public repos
- <https://github.com/oeg-upm/term-rag> — successor-adjacent work by the same group

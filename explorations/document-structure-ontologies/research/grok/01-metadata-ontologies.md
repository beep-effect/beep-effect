# Document Metadata Ontologies Survey

**Packet:** `explorations/document-structure-ontologies`
**Report:** `research/grok/01-metadata-ontologies.md`
**Authoring agent:** Grok 4.5 (xAI)
**Survey date:** 2026-08-11
**Scope:** document *metadata* vocabularies for typing, describing, and retrieving professional / legal / scholarly documents — not document *structure* (DoCO/PO/DEO are out of band; already assessed for SPAR structure).

**Beep baseline:** DCTERMS, PROV, OA (Web Annotation), SKOS, OWL already ship as `@beep/rdf` vocab modules (`packages/foundation/modeling/rdf/src/Vocab/`). Taxonomy loader already ingests TTL/JSON-LD (`@beep/ontology`). AST family: `@beep/md`, `@beep/pandoc-ast`, `@beep/lexical-schema`. Target surface: agents in professional desktop drafting patent applications and office-action responses, with ontology-aided retrieval and ontology-informed structure rules.

---

## 1. Method

1. Enumerate the named set (DCTERMS, PRISM, FaBiO, CiTO, BIBO, schema.org CreativeWork family, PREMIS, MODS/MADS, Web Annotation) plus newer/adjacent candidates discovered in-search (DataCite Ontology, C4O, schema.org Legislation, Akoma Ntoso metadata layer, PROV–DC mapping).
2. Prefer primary specs (DCMI, SPAR GitHub pages, W3C RECs, LoC standards pages, schema.org type pages, OASIS) over secondary summaries.
3. For each vocabulary record: **what it types**, **maturity/adoption**, **serializations**, **license**, **DCTERMS relationship** (complement vs overlap), and a **license note** for vendoring into beep.
4. Rank a shortlist against beep constraints: schema-first RDF vocab modules, TTL/JSON-LD ingestion, patent/OA drafting retrieval, no license landmines, minimal overlap with already-shipped DCTERMS/PROV/OA/SKOS.

Claims below are backed by the URLs cited inline. Treat uncited assertions as unverified.

---

## 2. Layering map (metadata vs structure vs anchors)

| Layer | Job | Canonical exemplars | Beep status |
| --- | --- | --- | --- |
| **Descriptive / bibliographic metadata** | Title, creator, type, identifiers, subjects, relations at *document* grain | DCTERMS, FaBiO, BIBO, schema.org CreativeWork, DataCite, PRISM subset | DCTERMS shipped |
| **Citation intent** | Why A cites B (extends, disputes, uses-as-evidence…) | CiTO (+ C4O for counts/context) | Not shipped |
| **Annotation / span anchors** | Body↔target associations; selectors on AST segments | Web Annotation (OA) | OA shipped |
| **Provenance / lifecycle** | Who did what when; derivation chains | PROV-O, PREMIS (preservation-grade), DCTERMS provenance/date family | PROV shipped |
| **Library catalog description** | Rich bibliographic XML/RDF for collections | MODS, MADS (authority), BIBFRAME (adjacent) | Not shipped |
| **Publishing-industry packaging** | Magazine/news syndication, rights summaries, aggregator messages | PRISM / PAM / PSV | Not shipped |
| **Legal document identity (FRBR-ish)** | Work/Expression/Manifestation/Item for legislation & judgments | Akoma Ntoso / LegalDocML metadata; FaBiO patent classes | Not shipped |
| **Document structure (out of this report)** | Section/paragraph/inline roles | DoCO, DEO, PO | Assessed elsewhere |

This report stays on the metadata layer. Structure ontologies are intentionally excluded except where a metadata vocab *reuses* them (e.g. CiTO examples using OA + C4O).

---

## 3. Baseline: DCMI Metadata Terms (DCTERMS)

### What it types

DCMI Metadata Terms is the authoritative set of properties, classes, datatypes, and vocabulary encoding schemes maintained by the Dublin Core Metadata Initiative. It includes the classic fifteen-element Dublin Core Metadata Element Set plus dozens of refined properties and classes (`dcterms:BibliographicResource`, `dcterms:Agent`, `dcterms:LicenseDocument`, etc.). The four DCMI namespaces are `/elements/1.1/`, `/terms/`, `/dcmitype/`, and `/dcam/`. DCMI gently encourages the `/terms/` namespace for new work while supporting `/elements/1.1/` indefinitely. Source: [DCMI Metadata Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/).

Core descriptive properties (non-exhaustive): `title`, `creator`, `contributor`, `publisher`, `subject`, `description`/`abstract`, `type`, `format`, `identifier`, `language`, `relation` family (`hasPart`/`isPartOf`, `hasVersion`/`isVersionOf`, `references`/`isReferencedBy`, `source`, `replaces`…), rights family (`rights`, `license`, `accessRights`, `rightsHolder`), and date family (`created`, `issued`, `modified`, `dateSubmitted`, `dateAccepted`, `valid`…). Type vocabulary (`dcmitype:Text`, `Dataset`, `Software`, …) gives coarse genre only — not patent-application vs office-action vs journal-article. Source: [DCMI Metadata Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/).

### Maturity / adoption

Extremely mature. The fifteen-element set is ISO 15836-1:2017; the richer terms set is ISO 15836-2:2019. DCMI terms are the de facto lingua franca for digital libraries, open repositories, OAI-PMH, DataCite crosswalks, schema.org mappings, SPAR FaBiO/PRISM reuse, and PREMIS linkage. Source: [DCMI Metadata Terms intro + ISO refs](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/); [ISO 15836-1](https://www.iso.org/standard/71339.html); [ISO 15836-2](https://www.iso.org/standard/71341.html).

### Serializations

RDF schemas for all four namespaces; usable in RDF/XML, Turtle, N-Triples, JSON-LD, and non-RDF contexts (XML, JSON, UML) by treating domain/range as guidance. Source: [DCMI Metadata Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/); [Expressing Dublin Core in RDF](https://www.dublincore.org/specifications/dublin-core/dc-rdf/).

### License

DCMI documents are licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)** unless otherwise indicated. Source: [DCMI Intellectual Property Notice](https://www.dublincore.org/about/copyright/).

### DCTERMS relationship

**Baseline.** Everything else either reuses, refines, or competes with these properties.

### License note (beep)

Safe to ship and already shipped as `@beep/rdf` `Dcterms` module. Keep CC-BY attribution in vocab headers / SOURCES ledger.

---

## 4. Per-vocabulary profiles

### 4.1 PRISM (Publishing Requirements for Industry Standard Metadata)

**What it types.** Industry metadata for magazine, news, newsletter, marketing, catalog, and journal content: general description, inter-resource relationships, intellectual property / usage rights, and inline markup. Modular namespaces cover Basic Metadata, Dublin Core subset, Images, Usage Rights, Rights Summary, Contract Management, Advertising, Recipes, Crafts, Controlled Vocabularies, Aggregator Message (PAM), and Source Vocabulary (PSV). Source: [W3C Member Submission — PRISM Specification Package (2020-09-10)](https://www.w3.org/Submission/2020/SUBM-prism-20200910/); [IDEAlliance PRISM overview](https://idealliance.org/workflow-innovations-publishers-requirement-for-industry-standard-metadata-prism/).

PRISM explicitly builds on Dublin Core and DC Terms as foundation, then adds publisher-centric fields (embargo, publication date granularities, volume/issue/page, DOI, keywords, rights windows). FaBiO itself reuses PRISM basic properties (`prism:doi`, `prism:issn`, `prism:publicationDate`, `prism:keyword`, page range, etc.). Source: [PRISM submission §2.2.4 Dublin Core](https://www.w3.org/Submission/2020/SUBM-prism-20200910/); [FaBiO spec namespaces](https://sparontologies.github.io/fabio/current/fabio.html).

**Maturity / adoption.** Mature in publishing DAM / syndication (IDEAlliance member ecosystem, PAM for aggregator feeds, XMP profiles for embedding). Submitted to W3C as Member Submission 2020 (not a W3C Recommendation — acknowledged input only). Less common outside magazine/news publishing. Source: [W3C Submission status note](https://www.w3.org/Submission/2020/SUBM-prism-20200910/); [IDEAlliance specifications page](https://idealliance.org/specifications/).

**Serializations.** XML (primary), RDF/XML profiles, XMP embedding in media files; schemas (PAM, PSV, rights, etc.) distributed as XSD packages. Source: [PRISM submission §1.11 schemas](https://www.w3.org/Submission/2020/SUBM-prism-20200910/).

**License.** W3C Member Submission documents under **W3C Document License** (copyright Idealliance, Inc. 2020). Source: [PRISM submission copyright block](https://www.w3.org/Submission/2020/SUBM-prism-20200910/); [W3C Document License](https://www.w3.org/Consortium/Legal/copyright-documents). The PRISM *namespaces and metadata field definitions* are industry standards from IDEAlliance — treat full PAM/PSV schemas as needing license review before vendoring wholesale.

**DCTERMS relationship.** **Heavy complement + controlled overlap.** PRISM includes an explicit "PRISM Subset of Dublin Core" module and recommends DC practices; PRISM properties refine publishing semantics DC does not cover (embargo, issueIdentifier, usage rights policies). Source: [PRISM submission §1.5 / §2.2.4](https://www.w3.org/Submission/2020/SUBM-prism-20200910/).

**License note (beep).** Prefer **selective reuse** of PRISM terms already adopted by FaBiO (`prism:doi`, page/volume/issue, keywords) rather than adopting the full PAM/PSV stack. Full PRISM is over-fit to magazine syndication; patent drafting does not need advertising tickets or recipe modules. Verify IDEAlliance terms before shipping any non-trivial PRISM module.

**Beep fit:** Low as a first-class vocab; Medium as *imported terms* via FaBiO.

---

### 4.2 FaBiO (FRBR-aligned Bibliographic Ontology)

**What it types.** OWL ontology for entities that are published or potentially publishable and that participate in bibliographic reference chains. Classes cover books, journals, journal articles/issues/volumes, conference papers, patents and patent applications/documents, legal opinions, technical reports, preprints, datasets, algorithms, web pages, and hundreds more — structured on FRBR **Work / Expression / Manifestation / Item**, with FaBiO extensions linking Work↔Manifestation, Work↔Item, Expression↔Item. Source: [FaBiO current HTML](https://sparontologies.github.io/fabio/current/fabio.html); [SPAR FaBiO page](https://www.sparontologies.net/ontologies/fabio); [GitHub SPAROntologies/fabio](https://github.com/SPAROntologies/fabio).

Patent-relevant classes (directly named in the class list): `fabio:Patent`, `fabio:PatentApplication`, `fabio:PatentApplicationDocument`, `fabio:PatentDocument`, plus `fabio:LegalOpinion`, `fabio:Report`, `fabio:TechnicalReport`, `fabio:WhitePaper`, `fabio:Specification`. Source: [FaBiO class index](https://sparontologies.github.io/fabio/current/fabio.html).

FaBiO reuses **FRBR, DCTERMS, PRISM, and SKOS** for properties (title, creator, identifier, DOI, ISSN, publication dates, subject terms, disciplines). Source: [FaBiO description](https://sparontologies.github.io/fabio/current/fabio.html).

**Maturity / adoption.** Peer-reviewed SPAR core (Peroni & Shotton, *Journal of Web Semantics*, 2012); actively maintained (revision 2.3; modified 2026-05-18 per published HTML); used across OpenCitations / scholarly Linked Data; listed in Bioregistry and BARTOC. Source: [FaBiO cite-as / DOI](https://sparontologies.github.io/fabio/current/fabio.html); [Bioregistry fabio](https://bioregistry.io/fabio); [paper](https://doi.org/10.1016/j.websem.2012.08.001).

**Serializations.** OWL 2 DL; downloadable **JSON-LD, RDF/XML, N-Triples, TTL**. Namespace: `http://purl.org/spar/fabio/`. Source: [FaBiO download badges](https://sparontologies.github.io/fabio/current/fabio.html).

**License.** **Creative Commons Attribution 4.0 International (CC BY 4.0)**. Source: [FaBiO license badge](https://sparontologies.github.io/fabio/current/fabio.html); [GitHub README license](https://github.com/SPAROntologies/fabio).

**DCTERMS relationship.** **Strong complement.** FaBiO does not replace DCTERMS; it *imports* DCTERMS properties and adds FRBR-aligned *document type taxonomy* and publishing-process distinctions DC lacks. Overlap is intentional reuse, not competition. Source: [FaBiO object properties listing DCTERMS](https://sparontologies.github.io/fabio/current/fabio.html).

**License note (beep).** Excellent vendor candidate: CC-BY 4.0, TTL/JSON-LD ready, aligns with existing DCTERMS/SKOS modules and taxonomy loader. Attribute SPAR Ontologies / Peroni & Shotton.

**Beep fit:** **High** — primary candidate for document-type typing of patents, applications, reports, and scholarly prior art.

---

### 4.3 CiTO (Citation Typing Ontology)

**What it types.** OWL 2 DL ontology for the *nature or type* of citations — factual and rhetorical — including direct, indirect, and implicit citations. Core properties: `cito:cites` / `cito:isCitedBy` plus ~40 typed subproperties (`extends`, `disputes`, `usesMethodIn`, `citesAsEvidence`, `citesAsAuthority`, `supports`, `refutes`, `repliesTo`, `retracts`, …). Reified `cito:Citation` class with `hasCitingEntity` / `hasCitedEntity` / `hasCitationCharacterization`. Self-citation specializations (author, journal, funder, affiliation, author-network). Aligns `schema:citation` as a subproperty of `cito:cites`. Source: [CiTO current HTML](https://sparontologies.github.io/cito/current/cito.html); [SPAR CiTO](https://www.sparontologies.net/ontologies/cito).

CiTO examples deliberately integrate **Open Annotation (OA)** and **C4O** for in-text pointer annotation — relevant to beep's existing OA module and AST anchors. Source: [CiTO examples of use](https://sparontologies.github.io/cito/current/cito.html).

**Maturity / adoption.** Same SPAR pedigree as FaBiO (JWS 2012); revision 2.8.2 (modified 2026-06-22); used in OpenCitations and scholarly discourse analysis; Quarto community interest in CiTO citation intents. Source: [CiTO header](https://sparontologies.github.io/cito/current/cito.html); [Quarto discussion #4176](https://github.com/orgs/quarto-dev/discussions/4176).

**Serializations.** OWL 2 DL; **JSON-LD, RDF/XML, N-Triples, TTL**. Namespace: `http://purl.org/spar/cito/`. Source: [CiTO download badges](https://sparontologies.github.io/cito/current/cito.html).

**License.** **CC BY 4.0**. Source: [CiTO license badge](https://sparontologies.github.io/cito/current/cito.html).

**DCTERMS relationship.** **Complement.** DCTERMS has coarse `references` / `isReferencedBy` / `relation`; CiTO specializes *citation intent*. CiTO v2.6.1 removed `cito:hasRelatedEntity` in favor of `dcterms:relation`. Source: [CiTO introduction changelog](https://sparontologies.github.io/cito/current/cito.html).

**License note (beep).** Same SPAR CC-BY 4.0 stack as FaBiO — clean pair. High value for office-action and prior-art graphs ("this claim *disputes* that reference"; "this response *cites as evidence* the examiner's art").

**Beep fit:** **High** for retrieval ranking and agent explanations; Medium complexity (many properties — start with a curated subset).

---

### 4.4 BIBO (Bibliographic Ontology)

**What it types.** OWL vocabulary for bibliographic things on the Semantic Web: documents, citations, and classification. Classes include `bibo:Document`, `bibo:Article`, `bibo:AcademicArticle`, `bibo:Book`, `bibo:Patent`, `bibo:LegalDocument`, `bibo:LegalCaseDocument`, `bibo:LegalDecision`, `bibo:Legislation`, `bibo:Bill`, `bibo:Statute`, `bibo:Brief`, `bibo:Hearing`, plus citation properties `bibo:cites` / `bibo:citedBy`. Reuses many DCTERMS and PRISM properties. Source: [Ontospy BIBO documentation](https://dcmi.github.io/bibo/); [purl.org/ontology/bibo/](http://purl.org/ontology/bibo/); [structured-dynamics GitHub](https://github.com/structureddynamics/Bibliographic-Ontology-BIBO).

**Maturity / adoption.** Historically the first widely used bibliographic OWL ontology (Bruce D'Arcus & Frédérick Giasson); still present in LOV and many KGs; **largely superseded for scholarly work by FaBiO** (SPAR published an explicit comparison). Maintenance is quiet relative to SPAR; DCMI mirrors docs; GitHub license clarity has been an open community issue. Source: [OpenCitations BIBO vs FaBiO comparison (2011)](https://opencitations.hypotheses.org/109); [DCMI BIBO page](https://www.dublincore.org/specifications/bibo/); [dcmi/usage issue #135 on licensing](https://github.com/dcmi/usage/issues/135); historical Google Code note of New BSD: [bibotools archive](https://code.google.com/archive/p/bibotools/).

**Serializations.** RDF/OWL (TTL/RDF/XML common); namespace `http://purl.org/ontology/bibo/`. Source: [BIBO Ontospy](https://dcmi.github.io/bibo/).

**License.** **Ambiguous / needs verification.** Historical "New BSD" on Google Code archive; current structured-dynamics and DCMI mirrors lack a clear LICENSE file in some forks; DCMI documentation pages themselves are CC BY 4.0 but that covers the *docs*, not necessarily the ontology axioms. Source: [Google Code bibotools license](https://code.google.com/archive/p/bibotools/); [dcmi/usage #135](https://github.com/dcmi/usage/issues/135); [DCMI document license](https://www.dublincore.org/about/copyright/).

**DCTERMS relationship.** **Overlap + complement.** BIBO reuses DCTERMS heavily and adds document-type classes and simple citation properties. Overlaps FaBiO's type taxonomy and CiTO's citation role (but with a flatter, less intent-rich citation model). Source: [BIBO Ontospy properties](https://dcmi.github.io/bibo/).

**License note (beep).** Do **not** vendor as primary until license is pinned. Prefer FaBiO+CiTO for the same job with clearer CC-BY 4.0.

**Beep fit:** **Medium-Low** as primary; useful as *interop mapping target* (many legacy KGs emit BIBO). Legal classes (`LegalDecision`, `Brief`, `Patent`) are attractive but FaBiO covers patents more carefully under FRBR.

---

### 4.5 schema.org CreativeWork family

**What it types.** The web's dominant structured-data vocabulary. `schema:CreativeWork` is "the most generic kind of creative work, including books, movies, photographs, software programs, etc." with a very large property set: `name`/`headline`, `author`/`creator`, `datePublished`/`dateModified`/`dateCreated`, `identifier`, `keywords`, `about`/`mentions`, `citation`, `license`, `copyrightHolder`, `isPartOf`/`hasPart`, `encoding`/`associatedMedia`, accessibility properties, `creativeWorkStatus`, etc. Specializations include `ScholarlyArticle`, `Article`, `Book`, `DigitalDocument`, `Dataset`, `SoftwareSourceCode`, `Legislation` / `LegislationObject`, media types, and more. Source: [schema.org/CreativeWork](https://schema.org/CreativeWork); [ScholarlyArticle](https://schema.org/ScholarlyArticle); [Legislation](https://schema.org/Legislation); [LegislationObject](https://schema.org/LegislationObject).

Usage scale: CreativeWork is used on **1M–10M domains** per Google web-index aggregation (July 2026 usage stats on the type page). Source: [CreativeWork usage line](https://schema.org/CreativeWork).

**Maturity / adoption.** Highest *web* adoption of any vocab in this survey. JSON-LD / Microdata / RDFa in HTML; Google, Bing, Yandex, and most CMS ecosystems. Legislation extension used by EUR-Lex guidance. Source: [schema.org CreativeWork](https://schema.org/CreativeWork); [EUR-Lex schema.org legislation guide](https://eur-lex.europa.eu/eli-register/legis_schema_org.html).

**Serializations.** **JSON-LD (preferred)**, Microdata, RDFa; full RDFS/OWL exports available from the project. Source: [schema.org CreativeWork](https://schema.org/CreativeWork); [schema.org docs](https://schema.org/docs/documents.html).

**License.** Schema vocabulary copyrights licensed under **Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)**. Source: [schema.org Terms of Service](https://schema.org/docs/terms.html); [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

**DCTERMS relationship.** **Parallel / overlapping.** Many properties are conceptual twins (`schema:author` ≈ `dcterms:creator`, `schema:datePublished` ≈ `dcterms:issued`, `schema:citation` ≈ `dcterms:references` / CiTO). CiTO explicitly superordinates `schema:citation` under `cito:cites`. Prefer DCTERMS internally; emit schema.org at web boundaries. Source: [CiTO schema:citation alignment](https://sparontologies.github.io/cito/current/cito.html); [CreativeWork properties](https://schema.org/CreativeWork).

**License note (beep).** **CC BY-SA 3.0 is ShareAlike** — viral if you *adapt* the schema vocabulary itself into a derived ontology. Practical web *use* of types/properties for markup is the intended path and is widespread; vendoring a large derived subset into beep's RDF generator needs legal review for SA obligations. Prefer **export mapping** (internal DCTERMS/FaBiO → schema.org JSON-LD) over re-hosting schema.org axioms.

**Beep fit:** **High as interoperability export surface**; **Low as internal ontology of record** (ShareAlike + sprawl + weaker legal typing than FaBiO/Akoma).

---

### 4.6 PREMIS (Preservation Metadata)

**What it types.** International standard for metadata supporting *long-term digital preservation* and usability. Data model entities: **Objects, Events, Agents, Rights** (semantic units + relationships). PREMIS OWL Ontology v3 encodes that model in RDF, linking to **PROV-O**, **DCTERMS**, and LoC preservation vocabularies at `id.loc.gov`. Source: [PREMIS home](https://www.loc.gov/standards/premis/); [PREMIS OWL v3 page](https://www.loc.gov/standards/premis/ontology/owl-version3.html); [id.loc.gov PREMIS 3](http://id.loc.gov/ontologies/premis-3-0-0.html); [GitHub lcnetdev/PREMIS](https://github.com/lcnetdev/PREMIS/).

**Maturity / adoption.** Gold standard in digital preservation (archives, national libraries, OAIS-aligned repositories); PREMIS EC still active (news through 2025–2026 on LoC site). Source: [PREMIS news list](https://www.loc.gov/standards/premis/).

**Serializations.** XML Schema for Data Dictionary implementations; OWL/RDF for Linked Data (TTL/RDF via id.loc.gov / GitHub). Source: [PREMIS OWL v3](https://www.loc.gov/standards/premis/ontology/owl-version3.html); [PREMIS 3.0 XSD](https://www.loc.gov/standards/premis/premis.xsd).

**License.** Library of Congress standards materials are U.S. federal government works in the **public domain** for U.S. government-authored content (standard U.S. Copyright Act §105 posture); confirm per-file headers on GitHub for any third-party contributions. Source: [LoC PREMIS site](https://www.loc.gov/standards/premis/); general federal PD posture summarized at [resources.data.gov open licenses](https://resources.data.gov/open-licenses/).

**DCTERMS relationship.** **Complement.** PREMIS OWL v3 explicitly connects to Dublin Core terms for descriptive facets while specializing preservation events, fixity, environments, and rights for archival objects. Source: [PREMIS OWL v3](https://www.loc.gov/standards/premis/ontology/owl-version3.html).

**License note (beep).** Likely fine for reference / selective import; full PREMIS is heavy for a drafting app. Prefer **PROV-O** (already shipped) for agent activity graphs; add PREMIS only if beep becomes a long-term bit-preservation store.

**Beep fit:** **Low near-term** (wrong problem: preservation, not drafting/retrieval); **Medium long-term** if matter files need archival-grade fixity/events.

---

### 4.7 MODS and MADS (Library of Congress)

**What it types.**

- **MODS** (Metadata Object Description Schema): XML bibliographic element set for library applications — richer than simple DC, simpler than full MARC. Current schema **MODS 3.8**. Source: [MODS home](https://www.loc.gov/standards/mods/); [MODS 3.8 announcement](https://www.loc.gov/standards/mods/mods-3-8-announcement.html).
- **MODS RDF**: OWL/RDF ontology for MODS concepts; primers for XML→RDF conversion. Source: [MODS RDF primer](https://www.loc.gov/standards/mods/modsrdf/primer.html); [primer part 2](https://www.loc.gov/standards/mods/modsrdf/primer-2.html).
- **MADS / MADS/RDF**: Metadata Authority Description Schema for *authority* data (names, topics, genres) as XML and RDF. Source: [MADS/RDF documentation](https://www.loc.gov/standards/mads/rdf/); [Wikipedia MADS](https://en.wikipedia.org/wiki/Metadata_Authority_Description_Schema).

**Maturity / adoption.** Core library community standard; broad ILS/digital-library adoption; active Editorial Committee (3.8 recent). Source: [MODS home](https://www.loc.gov/standards/mods/).

**Serializations.** **XML (primary)**; RDF/OWL for MODS RDF and MADS/RDF; mappings to BIBFRAME. Source: [MODS conversions](https://www.loc.gov/standards/mods/mods-conversions.html); [MODS RDF](https://www.loc.gov/standards/mods/modsrdf/primer.html).

**License.** LoC-maintained standards; treat as **U.S. government work / public domain** for government-authored schema text, with the usual "confirm headers" caveat. Source: [MODS home](https://www.loc.gov/standards/mods/); [resources.data.gov open licenses](https://resources.data.gov/open-licenses/).

**DCTERMS relationship.** **Complement with mapping.** MODS is often described as balancing MARC complexity and Dublin Core simplicity; crosswalks DC ↔ MODS are standard library practice. Source: [MODS overview / webinar framing](https://www.loc.gov/standards/mods/).

**License note (beep).** Fine for reference. Full MODS XML stack is library-catalog-shaped — high impedance for an Effect-native AST editor. Prefer FaBiO types + DCTERMS properties; keep MODS as an *import/export crosswalk* if ingesting library catalogs.

**Beep fit:** **Low as internal model**; **Medium as ingest crosswalk** from institutional repositories.

---

### 4.8 Web Annotation (OA)

**What it types.** W3C Recommendation model for annotations: rooted directed graph relating **Body** and **Target**, with motivations, lifecycle (creator/created/generator), agents, audiences, selectors (fragment, text quote, data position, SVG, etc.), states, and styles. Namespace `http://www.w3.org/ns/oa#`. Preferred serialization media type: `application/ld+json;profile="http://www.w3.org/ns/anno.jsonld"`. Source: [Web Annotation Data Model REC](https://www.w3.org/TR/annotation-model/); [Web Annotation Vocabulary](https://www.w3.org/TR/annotation-vocab/); [anno.jsonld context](http://www.w3.org/ns/anno.jsonld).

The model is resource-oriented and protocol-agnostic; a separate Annotation Protocol covers HTTP transport. Source: [annotation-model intro](https://www.w3.org/TR/annotation-model/).

**Maturity / adoption.** **W3C Recommendation (2017-02-23)**; implementation report published; successors to Open Annotation Community Group. Used in digital humanities, IIIF ecosystems, hypothes.is-style tools, and SPAR examples (CiTO+OA). Source: [REC status](https://www.w3.org/TR/annotation-model/); [implementation report](https://w3c.github.io/test-results/annotation-model/all.html).

**Serializations.** **JSON-LD (recommended)**; RDF vocab for any RDF syntax. Source: [annotation-model §1.2](https://www.w3.org/TR/annotation-model/).

**License.** W3C document license / patent policy for the Recommendation text; vocabulary intended for free use as a W3C standard. Source: [annotation-model copyright block](https://www.w3.org/TR/annotation-model/); [W3C Document License](https://www.w3.org/Consortium/Legal/copyright-documents).

**DCTERMS relationship.** **Complement.** OA is about *annotating* resources (including bibliographic ones), not replacing descriptive metadata. Annotation lifecycle properties partially echo DC/PROV creator-date patterns but are annotation-scoped. Source: [annotation-model §3.3 lifecycle](https://www.w3.org/TR/annotation-model/).

**License note (beep).** Already shipped as `Oa.ts`. Keep aligned with W3C context URL for JSON-LD interop.

**Beep fit:** **Already adopted — essential.** Primary bridge from document metadata graphs to `@beep/md` / Lexical span anchors (selectors over AST segments for examiner citations, claim annotations, agent comments).

---

### 4.9 DataCite Metadata Schema + DataCite Ontology (SPAR)

**What it types.**

- **DataCite Metadata Schema 4.7** (released 2026-03-03): core properties for citation and retrieval of research resources (mandatory Identifier, Creator, Title, Publisher, PublicationYear, ResourceType; rich optional funding, rights, related identifiers, descriptions). Source: [schema.datacite.org](https://schema.datacite.org/); [kernel 4.7](https://schema.datacite.org/meta/kernel-4.7/); [blog: Get Started with Schema 4.7](https://datacite.org/blog/get-started-with-schema-4-7/).
- **SPAR DataCite Ontology**: OWL 2 DL encoding of DataCite properties in RDF — especially a rigorous **identifier scheme model** (`datacite:hasIdentifier` + `usesIdentifierScheme` with individuals for DOI, ORCID, ROR, PMID, Handle, ARK, SPDX rights IDs, OpenAlex, Wikidata, …) plus qualified relations and description types. Source: [DataCite Ontology HTML](https://sparontologies.github.io/datacite/current/datacite.html); [GitHub SPAROntologies/datacite](https://github.com/SPAROntologies/datacite).

**Maturity / adoption.** DataCite Schema is the global standard for DOI registration metadata (repositories, funders, publishers). SPAR ontology tracks schema 4.7 (rev 1.3.1, modified 2026-05-05). Source: [schema.datacite.org](https://schema.datacite.org/); [DataCite Ontology header](https://sparontologies.github.io/datacite/current/datacite.html).

**Serializations.** DataCite Schema: XML (kernel XSDs), JSON in DataCite REST APIs. SPAR ontology: **JSON-LD, RDF/XML, N-Triples, TTL**. Source: [DataCite Ontology downloads](https://sparontologies.github.io/datacite/current/datacite.html).

**License.** SPAR DataCite Ontology: **CC BY 4.0**. Source: [DataCite Ontology license badge](https://sparontologies.github.io/datacite/current/datacite.html). DataCite Metadata Schema documentation: check DataCite terms for the kernel docs (widely implemented; schema is openly published at schema.datacite.org).

**DCTERMS relationship.** **Complement.** DataCite properties map cleanly onto DCTERMS (creator, title, publisher, date, rights) but add mandatory citation kernel discipline and *typed identifier schemes* DC leaves as free-text `dcterms:identifier`. SPAR ontology explicitly uses `dcterms:type` superproperties for description/resource types. Source: [DataCite Ontology description](https://sparontologies.github.io/datacite/current/datacite.html).

**License note (beep).** SPAR ontology is an easy CC-BY add-on for DOI/ORCID/ROR modeling — high value for patent literature DOIs and inventor ORCID linkage.

**Beep fit:** **High for identifier hygiene**; pair with FaBiO types + DCTERMS descriptive props.

---

### 4.10 C4O (Citation Counting and Context Characterization Ontology)

**What it types.** SPAR ontology for *how many* times a source is cited and *in what textual context* (in-text reference pointers, citation contexts). Extends BiRO; used with CiTO and OA in SPAR examples. Source: [C4O HTML](https://sparontologies.github.io/c4o/current/c4o.html); [SPAR C4O](https://www.sparontologies.net/ontologies/c4o); [GitHub SPAROntologies/c4o](https://github.com/SPAROntologies/c4o).

**Maturity / adoption.** Part of SPAR suite; specialized scholarly use. Source: [SPAR C4O](https://www.sparontologies.net/ontologies/c4o).

**Serializations.** OWL + standard RDF downloads (SPAR pattern). Source: [C4O page](https://sparontologies.github.io/c4o/current/c4o.html).

**License.** SPAR family — verify on page; suite standard is **CC BY 4.0** (confirm at publish time against the live HTML badge). Source: [SPAR ontologies site](https://www.sparontologies.net/ontologies/c4o).

**DCTERMS relationship.** Complement (no competition).

**Beep fit:** **Medium** — useful once AST-level citation anchors exist; not day-one metadata.

---

### 4.11 schema.org Legislation (+ LegislationObject)

**What it types.** `schema:Legislation` — "A legal document such as an act, decree, bill, etc. (enforceable or not) or a component of a legal act (like an article)." Properties include `legislationJurisdiction`, `legislationLegalForce` (`LegalForceStatus`), `legislationDate`, `legislationPassedBy`, links between legislations, etc. `LegislationObject` is a specific file encoding of a legislation. Source: [schema.org/Legislation](https://schema.org/Legislation); [LegislationObject](https://schema.org/LegislationObject); [EUR-Lex guide](https://eur-lex.europa.eu/eli-register/legis_schema_org.html).

**Maturity / adoption.** Moderate within schema.org; strong EU ELI / EUR-Lex alignment guidance. Not a substitute for Akoma Ntoso structure. Source: [EUR-Lex guide](https://eur-lex.europa.eu/eli-register/legis_schema_org.html).

**Serializations.** JSON-LD / RDFa / Microdata (schema.org). License: **CC BY-SA 3.0** (schema.org terms). Source: [schema.org terms](https://schema.org/docs/terms.html).

**DCTERMS relationship.** Complement for legal force/jurisdiction facets DC lacks.

**Beep fit:** **Medium** as export/SEO for published legal pages; not internal patent docket model.

---

### 4.12 Akoma Ntoso / LegalDocML (metadata layer)

**What it types.** OASIS standard XML vocabulary for parliamentary, legislative, and judicial documents. Metadata is organized around **FRBR** document identity (Work / Expression / Manifestation / Item) with permanent IRIs, versioning maps, and ontology-linked concepts. This is *both* structure and metadata — included here because its FRBR metadata model is the legal-domain analogue of FaBiO's FRBR bibliographic model. Source: [Akoma Ntoso Wikipedia summary + OASIS refs](https://en.wikipedia.org/wiki/Akoma_Ntoso); [OASIS LegalDocML TC](https://www.oasis-open.org/committees/legaldocml/); [GitHub oasis-open/legaldocml-akomantoso](https://github.com/oasis-open/legaldocml-akomantoso); [UN overview of AKN ontology / FRBR](https://unsceb-hlcm.github.io/part1/index-13.html); [AKN naming convention](https://docs.oasis-open.org/legaldocml/akn-nc/v1.0/csprd01/akn-nc-v1.0-csprd01.html).

**Maturity / adoption.** OASIS standard (v1.0, 2018); used by multiple parliaments and legal-tech vendors; USLM is a related U.S. legislative XML lineage. Source: [Wikipedia AKN](https://en.wikipedia.org/wiki/Akoma_Ntoso); [Xcential legis standards overview](https://xcential.com/legis-standards).

**Serializations.** XML (primary); IRI naming conventions; ontology references in metadata. Source: [AKN naming convention](https://docs.oasis-open.org/legaldocml/akn-nc/v1.0/csprd01/akn-nc-v1.0-csprd01.html).

**License.** OASIS open standards / TC open repository materials — check specific OASIS license notices per artifact. Source: [OASIS open repository README](https://github.com/oasis-open/legaldocml-akomantoso).

**DCTERMS relationship.** Complement at legal-document identity layer; can coexist with DCTERMS descriptive properties on FRBR Items/Manifestations.

**Beep fit:** **High strategic relevance for legal document identity**, but **structure-heavy** — belongs more with the legal-document-structure sweep (`02-…`) than pure metadata. For *metadata only*, borrow FRBR Work/Expression discipline (also present in FaBiO) without importing full AKN XML.

---

### 4.13 PROV-O (already shipped; brief for completeness)

**What it types.** W3C Recommendation OWL2 ontology for provenance: Entities, Activities, Agents, and relations (`wasGeneratedBy`, `used`, `wasAttributedTo`, `wasDerivedFrom`, …). Source: [PROV-O REC](https://www.w3.org/TR/prov-o/).

**DCTERMS mapping.** W3C Note maps DC Terms to PROV-O (partial). Source: [PROV-DC](https://www.w3.org/TR/prov-dc/).

**PREMIS relationship.** PREMIS OWL v3 explicitly connects to PROV-O. Source: [PREMIS OWL v3](https://www.loc.gov/standards/premis/ontology/owl-version3.html).

**Beep fit:** Already shipped (`Prov.ts`). Keep as provenance layer under DCTERMS descriptive records and OA annotations.

---

## 5. Cross-cutting comparison

| Vocabulary | Primary types | Grain | RDF-native? | License | DCTERMS relation | Beep priority |
| --- | --- | --- | --- | --- | --- | --- |
| **DCTERMS** | Generic descriptive properties + coarse types | Document / resource | Yes | CC BY 4.0 | Baseline | **Shipped** |
| **FaBiO** | FRBR bibliographic + patent/legal/scholarly classes | Work→Item | Yes (OWL) | CC BY 4.0 | Complements (imports DC) | **P1** |
| **CiTO** | Citation intent properties + Citation reification | Citation edge | Yes (OWL) | CC BY 4.0 | Complements `references` | **P1** |
| **DataCite (SPAR)** | Typed identifier schemes, qualified relations | Identifiers / relations | Yes (OWL) | CC BY 4.0 | Complements `identifier` | **P1** |
| **Web Annotation** | Annotation, Body, Target, Selectors | Span / association | Yes | W3C standard | Complements | **Shipped** |
| **PROV-O** | Entity/Activity/Agent provenance | Event chain | Yes | W3C | Complements / mapped | **Shipped** |
| **schema.org CreativeWork** | Web creative works + Legislation | Document / web entity | Yes (JSON-LD) | **CC BY-SA 3.0** | Parallel overlap | **P2 export** |
| **BIBO** | Document classes + simple cites | Document | Yes | **Unclear** | Overlap with FaBiO | **P3 map-only** |
| **PRISM** | Publishing rights, issues, syndication | Article / package | XML+RDF+XMP | W3C Doc + IDEAlliance | Complements + DC subset | **P3 selective** |
| **MODS/MADS** | Library bibliographic + authorities | Catalog record | XML primary; RDF secondary | LoC / PD posture | Complement | **P3 crosswalk** |
| **PREMIS** | Preservation Object/Event/Agent/Rights | Archival object | Yes (OWL v3) | LoC / PD posture | Complements | **P4 later** |
| **C4O** | Citation counts & contexts | In-text pointer | Yes | SPAR (verify CC-BY) | Complements | **P2 after AST cites** |
| **AKN / LegalDocML** | Legal FRBR identity + structure | Legal doc | XML | OASIS | Complements | **P2 structure track** |
| **schema Legislation** | Legal force / jurisdiction | Legislation | JSON-LD | CC BY-SA 3.0 | Complements | **P3 export** |

---

## 6. Ranked shortlist (for beep-effect)

### Tier A — adopt / deepen next

| Rank | Ontology | Why | License note |
| ---: | --- | --- | --- |
| 1 | **FaBiO** | FRBR-aligned document typing including **Patent / PatentApplication / PatentDocument / LegalOpinion**; reuses DCTERMS+SKOS already shipped; SPAR TTL/JSON-LD; pairs with DoCO structure work already assessed. | **CC BY 4.0** — vendor with attribution ([fabio.html](https://sparontologies.github.io/fabio/current/fabio.html)). |
| 2 | **CiTO** | Citation *intent* for prior art, office-action responses, and agent rationales; OA integration path matches shipped `Oa.ts`. | **CC BY 4.0** ([cito.html](https://sparontologies.github.io/cito/current/cito.html)). Start with curated subset (`cites`, `citesAsEvidence`, `citesAsAuthority`, `disputes`, `supports`, `extends`, `repliesTo`). |
| 3 | **DataCite Ontology (SPAR)** | Typed DOI/ORCID/ROR/PMID identifier schemes; avoids stringly `dcterms:identifier`. | **CC BY 4.0** ([datacite.html](https://sparontologies.github.io/datacite/current/datacite.html)). |
| 4 | **Web Annotation (deepen)** | Already shipped — invest in **selectors over `@beep/md` / Lexical offsets** for claim-level and examiner-citation anchors. | W3C REC ([annotation-model](https://www.w3.org/TR/annotation-model/)). |
| 5 | **DCTERMS (keep as spine)** | Do not replace; all Tier A vocabs hang off it. | **CC BY 4.0** ([DCMI copyright](https://www.dublincore.org/about/copyright/)). |

### Tier B — boundary / later

| Rank | Ontology | Why | License note |
| ---: | --- | --- | --- |
| 6 | **schema.org CreativeWork family** | Ubiquitous export/import; SEO and CMS interop; Legislation types for public legal pages. | **CC BY-SA 3.0** — prefer **mapping layer**, not internal ontology of record ([terms](https://schema.org/docs/terms.html)). |
| 7 | **C4O** | After in-text citation anchors exist, record counts/contexts for retrieval features. | SPAR — confirm CC-BY on live badge ([c4o](https://sparontologies.github.io/c4o/current/c4o.html)). |
| 8 | **Akoma Ntoso metadata (FRBR identity)** | Legal document identity patterns for legislation/judgments; coordinate with structure track. | OASIS — check artifact licenses ([GitHub](https://github.com/oasis-open/legaldocml-akomantoso)). |
| 9 | **PROV-O (keep)** | Drafting history, agent edits, derivation of response from OA — already present. | W3C ([PROV-O](https://www.w3.org/TR/prov-o/)). |

### Tier C — map or defer

| Rank | Ontology | Why defer | License note |
| ---: | --- | --- | --- |
| 10 | **BIBO** | Overlapped by FaBiO+CiTO; license ambiguity. | Unclear ([issue #135](https://github.com/dcmi/usage/issues/135)); historical New BSD on archive only. |
| 11 | **PRISM (full)** | Magazine/syndication-centric; heavy. Reuse only terms already pulled through FaBiO. | W3C Document License + IDEAlliance ([submission](https://www.w3.org/Submission/2020/SUBM-prism-20200910/)). |
| 12 | **MODS/MADS** | Library catalog impedance mismatch; keep as crosswalk. | LoC / PD posture ([MODS](https://www.loc.gov/standards/mods/)). |
| 13 | **PREMIS** | Preservation, not drafting. | LoC / PD posture ([PREMIS](https://www.loc.gov/standards/premis/)). |

---

## 7. Fit for beep-effect (assessment)

### 7.1 What beep already has

| Brick | Role in metadata stack |
| --- | --- |
| `@beep/rdf` `Dcterms` | Descriptive spine (title, creator, dates, rights, relations) |
| `@beep/rdf` `Prov` | Activity/agent provenance for drafts and agent runs |
| `@beep/rdf` `Oa` | Annotation anchors; body/target/motivation |
| `@beep/rdf` `Skos` | Controlled vocabularies / taxonomy concepts |
| `@beep/ontology` loader | TTL/JSON-LD seed ingestion + registry |
| `@beep/md` + Pandoc + Lexical | Document content ASTs to *attach* metadata and OA selectors to |

Packet context: SPAR structure ontologies (DoCO/PO/DEO) already assessed; FOLIO legal KG is a parallel thread (`research/folio/`). Do not re-mine lynx LKG reference ontologies — cite `explorations/lynx-lkg-ontology-grounding/research/`.

### 7.2 Recommended composition (application profile sketch)

```
Document resource
  a fabio:PatentApplicationDocument | fabio:Patent | fabio:Report | …
  dcterms:title / creator / created / modified / language / rights
  datacite:hasIdentifier  →  (scheme: doi | application-number | local)
  dcterms:subject         →  skos:Concept (CPC/USPC/FOLIO/practice taxonomy)
  prov:wasGeneratedBy / wasAttributedTo  (agent drafting run)
  oa:Annotation*          (claim comments, examiner cites, span highlights)
  cito:cites / cito:citesAsEvidence / cito:disputes  →  other Documents
```

Principles:

1. **DCTERMS remains the property spine** — never fork parallel title/creator properties without a mapping.
2. **FaBiO supplies `rdf:type` precision** DC's `dcmitype:Text` cannot.
3. **CiTO specializes edges**; do not overload `dcterms:references` for intent.
4. **DataCite Ontology for identifier nodes** when scheme matters (DOI vs patent number vs docket id).
5. **OA for spans**; never encode paragraph offsets only in ad-hoc JSON if OA selectors can express them.
6. **schema.org as egress** (JSON-LD for web/share) via one-way mapping.
7. **License hygiene:** prefer CC-BY 4.0 SPAR stack; treat CC-BY-SA schema.org as export-only; avoid BIBO until license is clean.

### 7.3 Patent / office-action retrieval scenarios

| Scenario | Vocab moves |
| --- | --- |
| Retrieve all *patent applications* by inventor X in CPC class Y | `fabio:PatentApplication` + `dcterms:creator` + `skos` subject |
| Rank prior art that this draft *disputes* vs *uses as evidence* | `cito:disputes` / `cito:citesAsEvidence` |
| Jump from an in-text examiner citation to the annotated span | `oa:Annotation` + TextQuoteSelector / FragmentSelector on md AST |
| Resolve DOI / application number / ORCID consistently | `datacite:hasIdentifier` + scheme individuals |
| Show who/what agent produced this draft version | `prov:wasGeneratedBy` + `dcterms:modified` |
| Export a public brief page | Map to `schema:CreativeWork` / `ScholarlyArticle` / `Legislation` as appropriate |

### 7.4 What *not* to do

- Do **not** adopt full PRISM PAM/PSV as the editor document model — wrong industry shape; conflicts with md/Pandoc/Lexical AST family.
- Do **not** replace DCTERMS with schema.org internally (ShareAlike + weaker typing).
- Do **not** import PREMIS as day-one drafting metadata — solve preservation later.
- Do **not** treat BIBO as the scholarly successor; FaBiO already is.
- Do **not** conflate this metadata layer with DoCO *structure* roles (Introduction, Methods, etc.) — compose them: FaBiO types the *document*, DoCO types the *sections*, OA anchors the *spans*.

### 7.5 Implementation shape in beep conventions

When graduating to a goal packet:

1. Add SPAR TTL/JSON-LD seeds under ontology package seeds (taxonomy loader path already exists).
2. Generate `@beep/rdf` vocab modules for FaBiO / CiTO / DataCite **term subsets** (not necessarily every class) following `Dcterms.ts` / generated-terms pattern.
3. Schema-first domain models for `DocumentMeta`, `Citation`, `Identifier` as Effect Schema classes — decode at boundary from RDF/JSON-LD.
4. Wire professional-desktop agent tools to emit CiTO edges and OA annotations as first-class graph writes.
5. Keep SOURCES.md license ledger updated (this packet's `research/SOURCES.md` pattern).

### 7.6 Residual risks

| Risk | Mitigation |
| --- | --- |
| FaBiO class explosion (~200+ classes) | Ship application profile subset (patent + report + article + legal opinion + generic Document) |
| CiTO property explosion (~40 intents) | Curated enum via LiteralKit; allow extension via `cito:cites` + OA comment body |
| schema.org ShareAlike | Export-only mapping module; no derived OWL rehost |
| BIBO license fog | Interop tests only; no vendored axioms |
| FRBR cognitive load | Hide Work/Expression/Manifestation behind editor "Document / Version / File" UX; store FRBR in graph |
| Overlap with FOLIO legal concepts | FOLIO for *legal meaning* of clauses; FaBiO/DCTERMS for *document packaging* — different layers |

---

## 8. Sources (canonical URLs)

### Primary specifications

- DCMI Metadata Terms: https://www.dublincore.org/specifications/dublin-core/dcmi-terms/
- DCMI copyright / CC BY 4.0: https://www.dublincore.org/about/copyright/
- ISO 15836-1:2017: https://www.iso.org/standard/71339.html
- ISO 15836-2:2019: https://www.iso.org/standard/71341.html
- FaBiO: https://sparontologies.github.io/fabio/current/fabio.html
- FaBiO GitHub: https://github.com/SPAROntologies/fabio
- CiTO: https://sparontologies.github.io/cito/current/cito.html
- CiTO GitHub: https://github.com/SPAROntologies/cito
- DataCite Ontology: https://sparontologies.github.io/datacite/current/datacite.html
- DataCite Metadata Schema: https://schema.datacite.org/
- DataCite Schema 4.7: https://schema.datacite.org/meta/kernel-4.7/
- C4O: https://sparontologies.github.io/c4o/current/c4o.html
- SPAR Ontologies hub: https://www.sparontologies.net/
- Peroni & Shotton 2012 (FaBiO+CiTO): https://doi.org/10.1016/j.websem.2012.08.001
- BIBO Ontospy: https://dcmi.github.io/bibo/
- BIBO GitHub (structured-dynamics): https://github.com/structureddynamics/Bibliographic-Ontology-BIBO
- BIBO vs FaBiO (OpenCitations): https://opencitations.hypotheses.org/109
- BIBO license discussion: https://github.com/dcmi/usage/issues/135
- PRISM W3C Member Submission: https://www.w3.org/Submission/2020/SUBM-prism-20200910/
- IDEAlliance PRISM: https://idealliance.org/workflow-innovations-publishers-requirement-for-industry-standard-metadata-prism/
- schema.org CreativeWork: https://schema.org/CreativeWork
- schema.org ScholarlyArticle: https://schema.org/ScholarlyArticle
- schema.org Legislation: https://schema.org/Legislation
- schema.org LegislationObject: https://schema.org/LegislationObject
- schema.org Terms (CC BY-SA 3.0): https://schema.org/docs/terms.html
- CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/
- CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
- Web Annotation Data Model: https://www.w3.org/TR/annotation-model/
- Web Annotation Vocabulary: https://www.w3.org/TR/annotation-vocab/
- PREMIS: https://www.loc.gov/standards/premis/
- PREMIS OWL v3: https://www.loc.gov/standards/premis/ontology/owl-version3.html
- PREMIS GitHub: https://github.com/lcnetdev/PREMIS/
- MODS: https://www.loc.gov/standards/mods/
- MODS RDF primer: https://www.loc.gov/standards/mods/modsrdf/primer.html
- MADS/RDF: https://www.loc.gov/standards/mads/rdf/
- PROV-O: https://www.w3.org/TR/prov-o/
- PROV-DC mapping: https://www.w3.org/TR/prov-dc/
- Akoma Ntoso / LegalDocML GitHub: https://github.com/oasis-open/legaldocml-akomantoso
- OASIS LegalDocML TC: https://www.oasis-open.org/committees/legaldocml/
- AKN overview (FRBR metadata): https://unsceb-hlcm.github.io/part1/index-13.html
- EUR-Lex schema.org legislation guide: https://eur-lex.europa.eu/eli-register/legis_schema_org.html
- Bioregistry FaBiO: https://bioregistry.io/fabio
- Federal open license posture: https://resources.data.gov/open-licenses/

### In-repo anchors

- RDF vocab modules: `packages/foundation/modeling/rdf/src/Vocab/`
- Ontology loader: `packages/foundation/modeling/ontology/src/`
- Packet SOURCES ledger: `explorations/document-structure-ontologies/research/SOURCES.md`
- Lynx LKG prior sweep (do not re-mine): `explorations/lynx-lkg-ontology-grounding/research/`

---

## 9. Bottom line

For beep-effect's professional drafting agents, the metadata stack should stay **DCTERMS-centric**, gain **FaBiO types** (especially patent/application document classes), **CiTO citation intent**, and **DataCite-style typed identifiers**, while **deepening Web Annotation selectors** on the md/Lexical AST. Treat **schema.org** as an interoperability egress (watch ShareAlike), **PRISM/MODS/PREMIS/BIBO** as selective maps or deferred heavyweights, and **Akoma Ntoso FRBR identity** as a coordinated concern with the legal *structure* track rather than a pure metadata import.

This is metadata only — compose later with DoCO/DEO structure roles and FOLIO legal concept graphs without collapsing the layers.

---

*End of report. Survey date 2026-08-11. All normative claims tied to URLs in §8.*

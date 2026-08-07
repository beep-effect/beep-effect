# LKG (Lynx Legal Knowledge Graph) Ontology — Deep Dive

- **Date:** 2026-08-06
- **Primary source:** <https://lynx-project.eu/doc/lkg/> (read in full: `#introduction` → Annex I → references)
- **Authoritative artifacts also read:** `lkg.ttl`, the JSON-LD context, and both SHACL shape files (see §7)
- **Packet:** `explorations/lynx-lkg-ontology-grounding`
- **Verification method:** the HTML spec was fetched and de-tagged locally, then cross-checked against the
  published OWL/TTL, the JSON-LD context, the SHACL shapes, and the upstream ELI / NIF / ITS-RDF
  ontology files themselves. Where those disagree, the disagreement is reported (§8) rather than smoothed over.

> **Read §8 before treating this ontology as a design source.** The rendered HTML documentation and the
> published OWL file are *not* the same model, and several normative-sounding statements in the prose are
> not backed by any published axiom or shape.

---

## 1. Identity, version, authorship, license

| Fact | Value | Source |
|------|-------|--------|
| Title | Legal Knowledge Graph Ontology | `rdfs:label` / `dct:title` in [lkg.ttl](http://lynx-project.eu/doc/lkg.ttl) |
| Ontology IRI | `http://lkg.lynx-project.eu/def/` | [spec §4](https://lynx-project.eu/doc/lkg/), `lkg.ttl` line 15 |
| Preferred prefix | `lkg` (`vann:preferredNamespacePrefix`) | `lkg.ttl` |
| Version | HTML says **Revision 1.2**; OWL says `owl:versionInfo "1.2.0"@en` | both |
| Creator (`dc:creator`) | Víctor Rodríguez-Doncel | `lkg.ttl` |
| Contributors (`dct:contributor`) | Filippo Maganza, Julián Moreno-Schneider, Socorro Bernardos, Sotiris Karampatakis | `lkg.ttl` |
| Publisher | "The Lynx Project Consortium, <http://lynx-project.eu/>" | `lkg.ttl` |
| **License** | **CC BY 4.0** — `dct:license <http://purl.org/NET/rdflicense/cc-by4.0>`, plus a CC-BY badge in the HTML header | `lkg.ttl`, HTML header |
| Funding | EU H2020 grant agreement **No 780602** | [spec §7](https://lynx-project.eu/doc/lkg/) |
| Generator | OWL API 4.5.9 (2019-02-01) — i.e. the file is a 2019-era artifact | trailing comment in `lkg.ttl` |
| Doc generator | LODE (Silvio Peroni), acknowledged in §7; authors recommend [OnToology](https://ontoology.linkeddata.es/) | [spec §7](https://lynx-project.eu/doc/lkg/) |

**Author-name discrepancy:** the HTML byline says "Sotiris **Karampakis**"; the OWL says
"Sotiris **Karampatakis**". The OWL spelling matches the published Lynx literature.

**License disposition for this packet:** CC BY 4.0 is permissive → **port-with-attribution** is
permitted for the *ontology content itself*. Attribution must name the Lynx Project Consortium and the
authors above. Note CC BY is a content license, not a patent/code license; the Java reference library
(§7) is a separate artifact with separate terms that could not be verified (GitLab returned HTTP 403 to
an unauthenticated fetch of <https://gitlab.com/superlynx/common/lynx_mvn>).

---

## 2. Namespace and IRI strategy

### 2.1 Ontology namespace

- Single flat namespace: `http://lkg.lynx-project.eu/def/` + local name. No sub-module namespaces, no
  versioned IRIs (`/def/1.2/` does not exist). There is **no `owl:versionIRI`** — only `owl:versionInfo`.
  Consequence: you cannot pin a consumer to LKG 1.2 by IRI; a republish silently changes the meaning of
  every existing `lkg:` term.
- The namespace IRI **does dereference** (`http://lkg.lynx-project.eu/def/` → 200, redirects to
  `https://lynx-project.eu/doc/lkg/`, `text/html`). Slash-namespace with HTML-only content negotiation:
  requesting the namespace returns the human doc, not the RDF. There is no observed `Accept:`-based
  negotiation to `lkg.ttl`.
- Local naming is **inconsistent in case convention**: classes are `UpperCamel`
  (`LynxDocument`, `CaseLaw`), most properties are `lowerCamel` (`hasDbpedia`, `wasExtractedFrom`,
  `accessGroup`), but the borrowed ELI properties they sit beside are `snake_case`
  (`eli:id_local`, `eli:has_part`, `eli:first_date_entry_in_force`). A generated TypeScript/Effect schema
  will have to normalize across two conventions in one metadata object.

### 2.2 Instance-data IRI strategy

Three *different* instance IRI patterns appear across the artifacts — this is the weakest part of the spec:

1. **Stated rule (the only hard one):** "There is no restriction on how LynxDocuments are identified
   --except that the identifiers must be URIs." ([spec §2.2](https://lynx-project.eu/doc/lkg/))
2. **Recommended pattern (spec §2.2):**
   `https://apis.lynx-project.eu/document-platforms/{implementationId}/collections/{collectionId}/documents/{docId}`
   where `implementationId ∈ {"ldp", "upm-elastic"}`. *(That host no longer resolves — connection failure
   as of 2026-08-06.)*
3. **A different "possible pattern"** repeated in the OWL comment and the spec: `http://USE-CASE-PART/res/slug`.
4. **A fourth base in the JSON-LD context:** `"@base": "https://lkg.lynx-project.eu/document-platforms/"`.

**Fragment IRIs are the one genuinely reusable idea here.** Document parts and annotations are identified
by an offset-encoded fragment on the containing document IRI:

```
<docIRI>#offset_{beginIndex}_{endIndex}
e.g. http://lynx-project.eu/doc/samples/doc006#offset_47_96
```

This is inherited from NIF, is machine-checkable, and is enforced by SHACL
(`nif:OffsetBasedStringShape`, pattern `#offset\_\d+\_\d*\b`) and stated as validation rule R008.
The payoff: a span identifier is *derivable* from `(document, begin, end)` with no ID allocator, no
database round-trip, and it round-trips through any RDF store. **This is the single pattern most worth
porting.**

Its cost is equally important: **the identifier is a function of the offsets, so any re-tokenization,
re-OCR, whitespace normalization, or Unicode-normalization change silently invalidates every annotation
IRI in the corpus.** There is no content hash, no anchor text fallback in the IRI, and no migration
story anywhere in the spec. NIF's own `nif:anchorOf` (the quoted span text) is used in the examples and
is the only redundancy available to detect drift — LKG never requires it.

---

## 3. Class inventory and intent

Ten classes. The intents below are quoted/paraphrased from `rdfs:comment` in `lkg.ttl` (authoritative)
with the HTML gloss noted where it differs.

| Class | IRI local name | Direct superclass (**per OWL**) | Intent |
|---|---|---|---|
| Lynx Document | `LynxDocument` | `nif:Context` | "Any document related to compliance worth to be in a Legal Knowledge Graph." The root entity. Being a `nif:Context` is what lets it anchor NLP annotations. |
| Lynx Document Part | `LynxDocumentPart` | `nif:Structure` | "Part of a LynxDocument" — an article/section/fragment, delimited by offsets, nestable. |
| Lynx Annotation | `LynxAnnotation` | `nif:Annotation` | "Declares a NIF annotation. The Annotation contains annotation units." An enrichment attached to a span. |
| Metadata | `Metadata` | **`eli:LegalExpression`** | "Declares the metadata element of a LynxDocument. As an 'intellectual realisation of a legal resource', it is considered an `eli:LegalExpression`." |
| Agreement | `Agreement` | `LynxDocument` | Private or public agreements (HTML adds "such as contracts"). |
| Collective Agreement | `CollectiveAgreement` | **`Agreement`** | CLAs / collective bargaining agreements. |
| Case Law | `CaseLaw` | `LynxDocument` | Judgments or related documents. |
| Legislation | `Legislation` | `LynxDocument` | Constitutions, acts, royal decrees, presidential decrees. |
| Technical Specification | `TechnicalSpecification` | `LynxDocument` | Technical specifications. |
| Standard | `Standard` | **`TechnicalSpecification`** | Standards. |

**Bolded superclasses are where the HTML documentation is wrong** — the rendered page shows
`CollectiveAgreement` and `Standard` as direct subclasses of `LynxDocument`, and lists all six document
subtypes as direct children of `LynxDocument`. The OWL file says otherwise. See §8.

### Notes on class design

- **The subtype taxonomy is a 2-level, 6-member enum, not an ontology.** `Agreement`,
  `CaseLaw`, `Legislation`, `TechnicalSpecification` (+ `CollectiveAgreement`, `Standard`) carry no
  distinguishing properties, no disjointness axioms, no restrictions. They are marker classes. In an
  Effect/Schema port this is a `LiteralKit` string union, not a class hierarchy.
- **Sub-typing beyond that level is delegated to a string.** The doc's mechanism for "constitution vs.
  royal decree vs. ministerial order" is `eli:type_document` carrying a **jurisdiction-specific string
  literal** (`"l"`, `"rdl"`, `"bgbl"`, `"si"`, …) — see the four Annex I tables (EU, Spain, Austria,
  Ireland). So document type is split across two incompatible mechanisms: RDF class for the coarse tier,
  an untyped, un-namespaced, jurisdiction-scoped string for the fine tier. Two Annex tables collide:
  `"reg"` means *regulation* in the EU table and *reglamento* in the Spanish one, with nothing in the
  data distinguishing them except the (optional) jurisdiction field.
- **`lkg:Doctrine` is referenced but never defined.** The `LynxDocument` elements table lists
  `lkg:Doctrine` as a permitted `@type` value; it does not exist in the OWL. Likewise `lkg:Date`,
  `lkg:RelEx`, and `lkg:EL` appear as annotation `taIdentRef`/entity-type values in examples and are
  undefined.
- **`Collection` is named as one of the three core entities and then dropped.** The introduction says
  "the main entities to deal with are three: Lynx Documents, Collections, Annotations" and immediately
  adds "Collections are not specified in this document." There is no `lkg:Collection` class. Corpus-level
  grouping is a hole in the model (a `collectionId` appears only inside the recommended URI template).
- **`Metadata` is the load-bearing oddity.** It is a *reified property bag* — in every example it is an
  **anonymous blank node** hung off the document by `lkg:metadata`. Declaring it
  `rdfs:subClassOf eli:LegalExpression` is a type-legality trick: it makes the ELI metadata properties
  (`eli:id_local`, `eli:jurisdiction`, `eli:version_date`, …) domain-legal on that node. See §5.2 for why
  this is more consequential than it looks.

---

## 4. Property inventory

LKG defines only **4 object properties and 6 data properties**. Everything else is borrowed.

### 4.1 Object properties (`lkg:`)

| Property | Domain | Range (per OWL) | Characteristics | Intent |
|---|---|---|---|---|
| `lkg:metadata` | `LynxDocument` | `Metadata` | **`owl:FunctionalProperty`** | Attaches the single metadata node. Exactly-one, also enforced by SHACL (`minCount 1, maxCount 1`) and rule R005. |
| `lkg:parent` | `LynxDocumentPart` | `LynxDocument ⊔ LynxDocumentPart` | — | Immediate container of a part; absent ⇒ root part. Enables nesting. |
| `lkg:hasEli` | `Metadata` | `eli:LegalExpression ⊔ eli:LegalResource` | — | "Official identifier (ELI, ECLI or equivalent)." The bridge to real legal identity. |
| `lkg:hasDbpedia` | `Metadata` | `owl:Thing` | — | Link to the equivalent DBpedia resource. |

### 4.2 Data properties (`lkg:`)

| Property | Domain | Range (per OWL) | Intent |
|---|---|---|---|
| `lkg:summary` | `Metadata` | `rdf:langString` | Summary of the document text, one per language. |
| `lkg:accessGroup` | `Metadata` | `xsd:string` | "Declares a group of documents for which access can be granted or not" — e.g. `"CocaCola"`. Authorization tag embedded in the document model. |
| `lkg:hasAuthority` | `Metadata` | `xsd:string` | Issuing authority. Single string, no language tag. Doc points at the EU [NAL corporate-body table](https://op.europa.eu/en/web/eu-vocabularies/at-dataset/-/resource/dataset/corporate-body) but the range is a bare string, not a code or IRI. |
| `lkg:hasPDF` | `Metadata` | `xsd:string` *(HTML doc claims `xsd:anyURI`)* | Link to the PDF rendition. |
| `lkg:hasWikipedia` | `Metadata` | `xsd:string` *(HTML doc claims `xsd:anyURI`)* | Link to the equivalent Wikipedia page. |
| `lkg:wasExtractedFrom` | `Metadata` | `xsd:string` *(HTML doc and JSON-LD context claim `xsd:anyURI`)* | Original URL if harvested from the web. |

Every single `lkg:` property has domain `Metadata` except `lkg:metadata` (domain `LynxDocument`) and
`lkg:parent` (domain `LynxDocumentPart`). **The model is: one class with structure, one class with a
property bag, and a NIF span algebra.**

### 4.3 Terms used in the spec/context but never declared in the OWL

These are real interoperability hazards — a consumer that validates against the published OWL will
reject or drop them:

| Term | Where it appears | Status |
|---|---|---|
| `lkg:annotation` | `LynxDocument` elements table, "RDF property" column for `annotations` | **Undeclared.** And contradicted by the JSON-LD context, which maps `annotations` to `{"@reverse": "nif:referenceContext"}` — so annotations are attached by the *inverse* of `nif:referenceContext`, and `lkg:annotation` never actually appears in any example triple. |
| `lkg:translation` | `LynxDocument` elements table, "RDF property" column for `translations` | **Undeclared.** Context maps `translations` → `itsrdf:target` with `@container: @language`. |
| `lkg:part` | `LynxDocumentPart` prose: "LynxDocument aggregates different parts with the `lkg:part` relation" | **Undeclared.** Every example and the context use `eli:has_part`. |
| `lkg:links` | JSON-LD context only (`"links": {"@id": "lkg:links", "@type": "@id", "@container": "@set"}`) | **Undeclared and undocumented.** |
| `lkg:Doctrine`, `lkg:Date`, `lkg:RelEx`, `lkg:EL` | `@type` table and annotation examples | **Undeclared classes.** |
| `dct:uri` | JSON-LD context (`"uri": {"@id": "dct:uri"}`) | **Not a DCMI term.** DCMI Metadata Terms has no `uri` property. |
| `itsrdf:taClassConf` | JSON-LD context | **Not in the ITS 2.0 RDF namespace.** Verified against <https://www.w3.org/2005/11/its/rdf> — the namespace declares `taConfidence`, `taClassRef`, `taIdent`, `taIdentRef`, `taPropRef`, `taSource`, `taAnnotatorsRef`, `target`, `mtConfidence`, … but no `taClassConf`. |
| `nif:summary` | Table 5 "Recommended entities in annotations" | **Not in nif-core 2.1.** Verified against the [nif-core.ttl](https://raw.githubusercontent.com/NLP2RDF/ontologies/master/nif-core/nif-core.ttl). LKG defines its own `lkg:summary`; the `nif:summary` row is an error. |
| `lkg:hasPDF`, `lkg:hasDbpedia`, `lkg:hasWikipedia` | Declared in OWL, listed in the metadata table | **Missing from the JSON-LD context.** Unmapped terms are *dropped* during JSON-LD expansion, so these three metadata fields cannot survive a JSON-LD → RDF round trip through the official context. |

### 4.4 Borrowed properties that carry the actual model

The externally-owned properties are more load-bearing than the `lkg:` ones:

| Borrowed property | Role in LKG | JSON key |
|---|---|---|
| `nif:isString` | The document text. Exactly 1, must be **untagged** (R013). | `text` |
| `nif:beginIndex` / `nif:endIndex` | Span offsets, `xsd:nonNegativeInteger`. | `offset_ini` / `offset_end` |
| `nif:referenceContext` | Part/annotation → owning document. Also, *reversed*, the JSON `annotations` container. | `referenceContext` |
| `nif:anchorOf` | Quoted span text on an annotation. | `anchorOf` |
| `nif:annotationUnit` → `nif:AnnotationUnit` | The reified per-annotator claim about a span. | `annotationUnit` |
| `itsrdf:taClassRef` / `taIdentRef` / `taConfidence` / `taAnnotatorsRef` / `target` | Entity class, entity identity, confidence, annotator provenance, translation target. | same names |
| `eli:has_part` | Document → part aggregation. | `parts` |
| `eli:id_local` (**mandatory, exactly 1**) | Local document identifier, e.g. `BOE-A-2019-1234`. | `id_local` |
| `eli:jurisdiction`, `eli:type_document`, `eli:version` | Jurisdiction, fine-grained doc type, consolidation status. | same names |
| `eli:first_date_entry_in_force`, `eli:date_no_longer_in_force`, `eli:version_date` | Temporal validity + publication date. | same names |
| `dct:language` (**mandatory, exactly 1**), `dct:title`, `dct:subject`, `dct:alternative` | Language and descriptive metadata. | `language`, `title`, `subject`, `alternative` |
| `dct:creator`, `dct:created`, `dct:rightsHolder`, `dct:source` | Provenance group. | same names |
| `owl:sameAs`, `rdfs:seeAlso` | Document equivalence / relatedness. | `sameAs`, `seeAlso` |

---

## 5. External vocabularies: reuse, alignment, and conformance

### 5.1 What the document actually uses

The spec's own namespace table (§4) declares: `def`(lkg), `xsd`, `rdf`, `rdfs`, `owl`, `dct`, `dc`,
`prov`, `vann`, `nif`, `rdflicense`, `foaf`, `eli`, `itsrdf`. The JSON-LD context adds `skos`, `dbo`,
`dbr`. Actual usage, verified across all four artifacts:

| Vocabulary | Namespace | How LKG uses it | License | Disposition |
|---|---|---|---|---|
| **NIF** (nif-core 2.1) | `http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#` | **Structural backbone.** `owl:imports`ed. `LynxDocument ⊑ nif:Context`, `LynxDocumentPart ⊑ nif:Structure`, `LynxAnnotation ⊑ nif:Annotation`. Offsets, text, span identity, annotation units. | **Apache 2.0 + CC BY 3.0 (dual)** — declared in the ontology header: `dcterms:license <http://www.apache.org/licenses/LICENSE-2.0>` and `<http://creativecommons.org/licenses/by/3.0/>` | **Port-with-attribution.** Note: the [NLP2RDF/ontologies](https://github.com/NLP2RDF/ontologies) repo has no repo-level LICENSE file and was last pushed **2017-06-22** — effectively unmaintained. |
| **ELI** (ELI Metadata Ontology v1.5) | `http://data.europa.eu/eli/ontology#` | **Metadata vocabulary + one class anchor.** `owl:imports`ed. `lkg:Metadata ⊑ eli:LegalExpression`; 8 ELI properties reused. | **No license declared** in the ontology file, and none stated on the [OP ELI landing page](https://op.europa.eu/en/web/eu-vocabularies/eli). | **Reference-only** until a license is verified in writing. Do not vendor the ELI file. (Reusing ELI *IRIs* in your own data is normal linked-data practice and is not a licensing act; copying ELI's axioms into a derived ontology is.) |
| **ITS 2.0 / RDF** | `http://www.w3.org/2005/11/its/rdf#` | **Annotation payload vocabulary.** Entity class/identity refs, confidence, annotator ref, translation target. Not imported, just used. | `dc:rights` → [W3C Software Notice and License (2002-12-31)](http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231) | Permissive (BSD-like); **port-with-attribution**. |
| **Dublin Core Terms** | `http://purl.org/dc/terms/` | Language, title, subject, alternative, creator, created, rightsHolder, source. | DCMI terms are published under [CC BY 4.0](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) | Port-with-attribution. |
| **DC Elements 1.1** | `http://purl.org/dc/elements/1.1/` | Only in the LKG ontology header (`dc:creator`, `dc:publisher`). | As above. | — |
| **VANN** | `http://purl.org/vocab/vann/` | Header only: preferred prefix/namespace. | CC BY (per the VANN vocabulary) — not independently verified here. | Reference-only. |
| **OWL / RDF / RDFS / XSD** | W3C | `owl:sameAs`, `rdfs:seeAlso`, `rdf:value`, `rdf:subject/predicate/object` (relation extraction), datatypes. | W3C | — |
| **DBpedia** | `http://dbpedia.org/ontology/`, `/resource/` | Example entity types/identities in annotations (`dbo:Location`, `dbo:Person`, `dbo:Organization`). Not normative. | DBpedia is CC BY-SA 3.0 / GFDL | Reference-only (share-alike). |
| **W3C Time** | `http://www.w3.org/2006/time#` | `time:TemporalEntity` as an example `taClassRef` value. | W3C | — |
| **RDFLicense** | `http://purl.org/NET/rdflicense/` | The license IRI itself. Resolves to the [W3C ODRL BP rdflicense collection](https://raw.githubusercontent.com/w3c/odrl/master/bp/license/rdflicense/cc-by4.0.ttl). | — | — |
| **SHACL** | `http://www.w3.org/ns/shacl#` | The two shape files. | W3C | — |
| **External code lists** | ISO 639-1, ISO 3166-1/-2 alpha-2, EU [ATU](https://data.europa.eu/euodp/en/data/dataset/atu), EU [resource-type NAL](http://publications.europa.eu/resource/authority/resource-type), EU [corporate-body NAL](https://op.europa.eu/en/web/eu-vocabularies/at-dataset/-/resource/dataset/corporate-body), Spanish [elidata.es](https://www.elidata.es/mdr/authority/resource-type/1/) | Referenced as recommended *string* values. | EU NALs: EU reuse policy | Reference-only. |

### 5.2 Vocabularies explicitly **NOT** used (asked in the brief)

Verified by exhaustive grep across `lkg.html`, `lkg.ttl`, `lynxdocument.json`, `lkg-shapes.ttl`,
`nif-shapes.ttl`:

- **EuroVoc — 0 occurrences.** LKG does *not* align subjects to EuroVoc. `dct:subject` takes free-text
  language-tagged keyword strings, not `skos:Concept` IRIs. For a legal KG this is a notable omission:
  the EU's own subject thesaurus is right there and unused.
- **DCAT — 0 occurrences.** No dataset/distribution/catalog layer at all. Corpus-level description is
  absent (consistent with `Collection` being dropped).
- **schema.org — not used as a modeling vocabulary.** It appears twice, both incidental: as an RDFa
  `prefix` declaration in the HTML `<html>` element (with `property="schema:version"` on the revision
  number, i.e. describing the *webpage*), and as an unused `@prefix schema:` line in `lkg-shapes.ttl`.
- **PROV-O — declared, never used.** `prov:` is in the spec's namespace table; there is not a single
  `prov:` triple in any artifact. Provenance is done with Dublin Core + ITS instead (§6.4).
- **FOAF — declared, never used.** In the namespace table and the JSON-LD context; no `foaf:` triple exists.
- **SKOS — declared, never used by LKG itself.** In the context and imported transitively (ELI imports
  SKOS core), but LKG defines no concept schemes and points no property at a `skos:Concept`.
- **ELI-DL** (the ELI Draft Legislation extension) — **not mentioned anywhere**.
- **Akoma Ntoso / LegalDocML** — **not used**, though it *is* listed on the project's separate
  ["Relevant ontologies" page](http://lynx-project.eu/data2/reference-ontologies), which the spec links as
  "a broad list here". That page (fetched 2026-08-06) surveys: Akoma Ntoso, CDM, CHLexML, ELI, Finlex
  `laki`/`oikeus`, LegalRuleML, LexDania, `lexicog`, LKIF, CEN Metalex, Nomothesia, NIR, PCO, and EU-CBCM
  — **as considered references only**. None besides ELI made it into the ontology.
- The lexical/terminology side of Lynx uses **OntoLex-lemon + `lexicog` + `vartrans` + LexInfo**, per
  <https://lynx-project.eu/data2/domain-independent-vocabularies> — but that is a *sibling* model, not
  part of the LKG document ontology, and there is no property in LKG linking a document span to a lexical
  sense.

### 5.3 ELI conformance — the most important finding of this review

LKG `owl:imports` ELI and then uses ELI properties in ways ELI does not license. Verified against the
live ELI ontology (v1.5, fetched from `http://data.europa.eu/eli/ontology`, 166,991 bytes RDF/XML):

| ELI term | ELI's own definition | LKG's usage | Verdict |
|---|---|---|---|
| `eli:jurisdiction` | **`owl:ObjectProperty`**, `rdfs:range eli:AdministrativeArea`, `subPropertyOf eli:relevant_for`; values from the ATU table | `eli:jurisdiction "AT"` — an `xsd:string` literal. SHACL explicitly asserts `sh:datatype xsd:string`. Spec: "ATU lists not supported as of this version." | **Non-conformant.** An object property given a literal object. |
| `eli:type_document` | **`owl:ObjectProperty`**, `rdfs:domain eli:LegalResource`, `rdfs:range eli:ResourceType` (≡ `skos:Concept ⊓ ∃skos:inScheme.ResourceTypeTable`) | `eli:type_document "Ley"` — a literal, on a node typed `eli:LegalExpression` | **Doubly non-conformant:** literal-for-resource **and** wrong domain class. |
| `eli:version` | **`owl:ObjectProperty`**, `rdfs:range eli:Version` (a SKOS scheme) | "The value is string from a controlled vocabulary, for example 'con'" | **Non-conformant** (literal for resource). |
| `eli:has_part` | `rdfs:domain eli:Work`, `rdfs:range eli:Work` (broadened in ELI v1.3) | Used between `LynxDocument` (⊑ `nif:Context`) and `LynxDocumentPart` (⊑ `nif:Structure`) | **Silent over-entailment:** because LKG imports ELI, RDFS domain/range entailment makes *every* LynxDocument and *every* part an `eli:Work`. |
| `eli:id_local` | domain `Format ⊔ LegalExpression ⊔ LegalResource` | On `lkg:Metadata ⊑ eli:LegalExpression` | **Conformant.** |
| `eli:first_date_entry_in_force`, `eli:date_no_longer_in_force`, `eli:version_date` | domain `LegalExpression ⊔ LegalResource`; the first and third are `owl:FunctionalProperty` | On `lkg:Metadata` | **Conformant.** |

**Does this make LKG graphs logically inconsistent?** No — and this nuance matters. ELI v1.5 contains
**zero `owl:disjointWith` axioms** (verified by exhaustive scan). So the domain/range entailments produce
*surprising* inferences rather than contradictions: a reasoner will happily conclude that your
`nif:Context` is also an `eli:Work` and that your metadata blank node is both a `LegalExpression` and a
`LegalResource`. The graphs are not broken; they are **semantically over-committed in ways nobody
declared or tested.** For OWL-DL tooling the object-property-with-literal usages are the harder problem —
they push the data out of OWL-DL entirely.

**Coverage of ELI.** ELI v1.5 exposes ~85 properties. **LKG reuses exactly 8.** Notably absent — all of
ELI's *legal-relational* surface:

> `amends` / `amended_by`, `repeals` / `repealed_by`, `consolidates` / `consolidated_by`,
> `changes` / `changed_by`, `cites` / `cited_by` / `cited_by_case_law`, `implements` / `implemented_by`,
> `transposes` / `transposed_by`, `applies` / `applied_by`, `commences` / `commenced_by`,
> `based_on` / `basis_for`, `corrects` / `corrected_by`, `refers_to`, `related_to`, `in_force`,
> `legal_value`, `has_translation` / `is_translation_of`, `is_realized_by` / `realizes`,
> `is_embodied_by` / `embodies`, `has_annex`, `published_in`, `passed_by`, `publisher_agent`,
> `rightsholder_agent`, `type_subdivision`, `LegalResourceSubdivision`, `uri_schema`.

**This is the headline weakness. For a model named "Legal Knowledge Graph", the graph is
text-structural (parts, spans, annotations), not legal-relational.** There is no way in LKG to say that
one document amends, repeals, consolidates, implements, transposes, or cites another. The only
document-to-document edges available are `owl:sameAs`, `rdfs:seeAlso`, and `lkg:hasEli` — i.e.
"same as", "see also", and "here is my official identifier elsewhere".

Relatedly: **ELI already has a class for articles and fragments — `eli:LegalResourceSubdivision`, with
`eli:type_subdivision` — and LKG does not use it.** It invented `lkg:LynxDocumentPart` on the NIF
offset branch instead. That is a deliberate, defensible choice (offsets are computable, subdivision
identity is editorial), but the spec never acknowledges the alternative or explains the trade.

---

## 6. Modeling patterns

### 6.1 Document decomposition

The pattern is **flat text + offset-delimited overlay**, not a nested document tree.

- The document holds the *entire* text once, in a single `nif:isString`.
- Parts hold **no text**: "The text is not repeated in the fragments, in order to save space."
  A part is `(beginIndex, endIndex, optional title, optional parent)`.
- Hierarchy is expressed **three redundant ways at once**, per the `LynxDocumentPart` prose:
  1. `eli:has_part` — document aggregates parts (flat, all levels, not just roots — see doc006 where
     the document `eli:has_part` all three parts including the nested one);
  2. `nif:referenceContext` — every part points back to the owning document (mandatory, cardinality 1);
  3. `lkg:parent` — part points to its immediate container; absent ⇒ root part.

**Design read:** this is a *stand-off annotation* model. The text is immutable and canonical; structure
and enrichment are overlays keyed by character offsets. It is the right shape for NLP pipelines
(multiple annotators can write disjoint overlays without touching or forking the text) and it makes
"give me every annotation overlapping article 3" a pure interval query. It is the wrong shape for
editorial workflows (any text edit renumbers everything downstream) and it cannot represent
*discontinuous* spans, *overlapping conflicting* structures, or tables/figures at all — the spec is
candid about the last point: "manipulation of images, videos or tables is less developed."

The triple redundancy is a real liability: nothing in the OWL or the shapes enforces that
`lkg:parent`'s offsets are contained within the parent's offsets, that `eli:has_part` agrees with the
`lkg:parent` chain, or that sibling parts do not overlap. All three can disagree and still validate.

### 6.2 Temporal versioning — the weakest area

Time is modeled as **three optional dates on a single flat metadata node**:

- `eli:first_date_entry_in_force` — when it enters into force
- `eli:date_no_longer_in_force` — when repealed/expired
- `eli:version_date` — date of publication of this version
- plus `eli:version` — a status string (`"con"` = consolidated, draft, bulletin)

There is **no version lineage**. ELI's FRBR machinery — `LegalResource` (the Work, stable across
amendments) realized by successive `LegalExpression`s (point-in-time consolidated versions), embodied by
`Format`s — is collapsed into one blank node. LKG uses none of `eli:is_realized_by`, `eli:realizes`,
`eli:consolidates`, `eli:changes`, `eli:in_force`, or `eli:legal_value`.

Concretely, the model **cannot answer "what did Article 12 say on 2019-03-01?"** Each consolidated
version is an independent `LynxDocument` with its own `id_local` and its own text, and the only thing
relating two versions of the same law is `owl:sameAs` / `rdfs:seeAlso` (both semantically wrong for this
— `owl:sameAs` between two *different* consolidated versions asserts they are the same individual, which
would merge their contradictory dates) or an external `lkg:hasEli` pointer that happens to share a Work
IRI. Point-in-time legal retrieval, the single most important query in compliance work, is out of scope.

Mandatory-ness is also asymmetric: `Legislation` documents must carry a jurisdiction (rule R012 and
`lkg:LegislationShape`), but **no date is ever mandatory** — despite R012's prose claiming
"there should be `eli:jurisdiction` and `eli:date`" (and `eli:date` is not a property in the metadata
table at all).

### 6.3 Language handling

This is the most carefully specified area, and the most portable.

- **Exactly one main document language**, mandatory, `dct:language`, ISO 639-1 two-letter code.
  Enforced by SHACL with an explicit 184-value `sh:in` enumeration.
- **Language *variants* are discouraged**, with a stated operational reason: "The use of language
  variants is not recommended (e.g. `es-mx` …) because services will not recognize it as Spanish
  (e.g. Timex will refuse the annotation of such unknown language)." A modeling constraint chosen to
  match downstream tool capability — honest, and worth imitating as a documentation habit.
- **The document text must NOT carry a language tag** (rule R013; `nif:isString` is `xsd:string`).
  The main language lives in metadata, not on the literal. This is a deliberate split: the text is a
  plain string so offsets and NIF tooling behave; the language is a metadata fact.
- **Language-indexed metadata fields** use JSON-LD `@container: @language`, which maps cleanly to
  RDF language-tagged literals: `title`, `subject`, `alternative`, `summary`, `translations`. In JSON
  these read as `{"en": "...", "es": [...]}`; in RDF as `"..."@en`. SHACL enforces `sh:uniqueLang true`
  for `dct:title` and `lkg:summary` — at most one value per language.
- **Translations are annotations, not documents.** `translations` → `itsrdf:target`, language-keyed.
  A translation is a language-tagged string hung off the document (or off a span), not a first-class
  `LynxDocument` with its own identity. That is cheap and works for MT output; it means a
  human-authored official translation cannot carry its own metadata, provenance, or ELI identifier.
- Multilingualism is *per-field*, not *per-document-version* — there is no `eli:has_translation`
  document graph.

### 6.4 Provenance

Two distinct layers, neither using PROV-O:

**Document level** (metadata group "Provenance"): `dct:creator` ("person or software"), `dct:created`
(`xsd:dateTime`, "date when created in Lynx (internal)"), `dct:rightsHolder`, `dct:source`
("original URL if the document was extracted from the web"), plus `lkg:wasExtractedFrom`
("original URL if the document was extracted from the web"). **`dct:source` and `lkg:wasExtractedFrom`
have verbatim-identical definitions** — a redundant pair with no stated precedence.

**Annotation level** — the genuinely good part: the `nif:AnnotationUnit` reification. Each annotation
span (`lkg:LynxAnnotation`, an offset-based string) holds one or more `nif:annotationUnit` nodes, and
each unit carries:

- `itsrdf:taAnnotatorsRef` — **which service/tool made this claim** (an IRI, e.g. `http://annotador.oeg-upm.net/`)
- `itsrdf:taClassRef` — the asserted entity *class* (`dbo:Location`, `time:TemporalEntity`)
- `itsrdf:taIdentRef` — the asserted entity *identity* (`dbr:Madrid`, a PoolParty concept IRI)
- `itsrdf:taConfidence` — `[0..1]` decimal
- `rdf:value` — a normalized value (e.g. `"2019"` for a temporal expression)

**This is the pattern most worth stealing.** Multiple annotators can assert *competing* claims about the
*same span* without overwriting each other, each claim carrying its own author and confidence.
The span is the stable anchor; interpretation is a multiset of attributed, scored claims. That is
exactly the shape needed for any pipeline where an LLM, a rules engine, and a human disagree about what
a clause means — and it generalizes far beyond the legal domain.

Its limits: no timestamp on a unit (you cannot tell which of two claims by the same annotator is newer),
no model/version field beyond the annotator IRI, no retraction or supersession mechanism, and no way to
express that unit A *depends on* unit B. It is attribution, not a provenance graph — which is presumably
why `prov:` is declared and then never used.

### 6.5 Validation strategy

LKG ships **15 numbered rules (R001–R015)** in prose plus two SHACL files. The interesting move is that
several rules exist to *force materialization of what OWL would have entailed*: `lkg:LynxDocumentShape`
requires `sh:path rdf:type ; sh:hasValue nif:Context` even though `LynxDocument ⊑ nif:Context` already
entails it — because SHACL does not reason. Hence the spec's repeated "also recommended `nif:Context`".
This is a legitimate, transferable pattern: *the closed-world validator demands the types the
open-world model merely implies.* It is also a warning that the ontology and the validator are two
models that must be kept in sync by hand — and §8 shows they were not.

---

## 7. Serialization, availability, and tooling (all probed 2026-08-06)

| Artifact | URL | Status |
|---|---|---|
| HTML specification | <https://lynx-project.eu/doc/lkg/> | **200**, 152 KB |
| Namespace IRI | <http://lkg.lynx-project.eu/def/> | **200** → redirects to the HTML spec |
| **OWL, Turtle** | <http://lynx-project.eu/doc/lkg.ttl> | **200**, 12,767 bytes, `text/turtle` — the authoritative artifact |
| OWL, RDF/XML | <http://lynx-project.eu/doc/lkg.rdf> | **404.** The download badge for it is commented out in the page HTML — a deliberate removal, not a broken link. **Turtle is the only serialization.** |
| **JSON-LD context** | <http://lynx-project.eu/doc/jsonld/lynxdocument.json> | **200**, 3,589 bytes — the practical contract for JSON producers |
| SHACL shapes (LKG) | <http://lynx-project.eu/doc/lkg-shapes.ttl> | **200**, 9,268 bytes |
| SHACL shapes (NIF) | <http://lynx-project.eu/doc/nif-shapes.ttl> | **200**, 2,803 bytes |
| Benchmark corpus | <https://lynx-project.eu/data/benchmarking.zip> | **200**, 2.4 MB |
| Sample documents doc001–doc007 | `https://gitlab.com/superlynx/common/lynx_mvn/-/raw/master/src/test/resources/documents/*` | Repo returns **403** to unauthenticated fetch |
| Java reference library | <https://gitlab.com/superlynx/common/lynx_mvn> | **403** (GitLab bot protection); license unverified |
| Validator sandbox API | `http://dcm.api.lynx-project.eu/validate/` | **503 — dead.** The "Validate / Normalize" buttons in §3 of the spec are non-functional. |
| Document platform API | `https://apis.lynx-project.eu/document-platforms/` | **Connection failure — dead.** This is the host in the *recommended* instance-IRI pattern. |

**Content hidden in the published page.** Several sections are wrapped in HTML comments and do not
render, but are present in the source — relevant because they show intent that never shipped:

- The complete worked example (`doc009`, JSON-LD + Turtle) is commented out.
- The entire **"Table 6: Annotations by service"** matrix is commented out. It maps each Lynx NLP service
  (Machine Translation, Summarization, NER, Geo Entity Recognition, Temporal Recognition, Relation
  Extraction, Entity Linking) to the exact ITS/NIF properties it emits and the entity types it produces.
  This is the most operationally useful table in the document and **the public page does not show it.**
- Two red editorial warnings are commented out but the sections they warn about still render:
  *"This Section is under review and the contents do not currently hold"* (§3 Validation) and
  *"These rules are under revision"* (the R001–R015 table). **The validation rules are published
  without the caveat their own authors wrote for them.**

---

## 8. Internal contradictions found (HTML doc vs. OWL vs. JSON-LD context vs. SHACL)

These are not nitpicks; each one changes what a generated schema would look like.

| # | Subject | HTML documentation says | OWL / context / SHACL says | Impact |
|---|---|---|---|---|
| 1 | `CollectiveAgreement` superclass | `LynxDocument` | `rdfs:subClassOf :Agreement` | Taxonomy depth differs. **Trust the TTL.** |
| 2 | `Standard` superclass | `LynxDocument` | `rdfs:subClassOf :TechnicalSpecification` | Same. |
| 3 | `hasPDF`, `hasWikipedia` range | `xsd:anyURI` | OWL: `xsd:string`; SHACL: `xsd:string` + regex URI pattern | Datatype of three fields is genuinely ambiguous. |
| 4 | `wasExtractedFrom` range | `xsd:anyURI` (and the JSON-LD context agrees: `"@type": "xsd:anyURI"`) | OWL: `xsd:string` | **The OWL is the outlier here** — context and doc agree against it. |
| 5 | `annotations` RDF property | `lkg:annotation` | Context: `{"@reverse": "nif:referenceContext"}`; no such property in OWL | The documented property does not exist and never appears in an example. |
| 6 | `translations` RDF property | `lkg:translation` | Context: `itsrdf:target` | Same. |
| 7 | Part aggregation | prose says `lkg:part`; tables and examples say `eli:has_part` | Context: `eli:has_part` | Self-contradictory within one section. |
| 8 | Part aggregation, again | examples use `eli:has_part` | **`lkg-shapes.ttl` constrains `eli:hasPart` (camelCase)** | **The part-structure SHACL constraint is dead code — that property never appears in any LKG data, so `sh:node lkg:LynxDocumentPartShape` never fires.** |
| 9 | `lkg:parent` range | OWL: `LynxDocument ⊔ LynxDocumentPart` | SHACL: `sh:class lkg:LynxDocumentPart` only | The spec's own complete example (doc009) sets a part's `parent` to the *document*, which the shape rejects. |
| 10 | R011 (`nif:OffsetBasedString` must have exactly one begin/end index) | stated for `OffsetBasedString` | `nif:StringShape` carries the R011 message but has **`sh:targetClass nif:Context`** | **Wrong target class — parts and annotations are never checked for begin/end index.** |
| 11 | Jurisdiction values | "EU represents European Union"; ISO 3166-2 regions "therefore also possible (ES-MA)" | `MetadataShape` `sh:in (...)` is a flat ISO 3166-1 alpha-2 list that **contains neither `EU` nor any region code** | The two documented special cases both fail validation. |
| 12 | R012 | "there should be `eli:jurisdiction` and `eli:date`" | `lkg:LegislationShape` requires jurisdiction only; `eli:date` is not in the metadata table at all | Date requirement is unenforced and names a nonexistent property. |
| 13 | Legislation typing | Annex I example types a document `eli:Legislation` | `lkg:LegislationShape` has `sh:targetClass lkg:Legislation` | **The spec's own annex example is not targeted by the shape meant to validate it.** |
| 14 | R015 (offsets match the text) | "should match the number of **word positions**" | SPARQL checks `strlen(str(?string)) != ?endIndex \|\| ?beginIndex != 0` — i.e. **character** length, and forces `beginIndex = 0` | Message and implementation disagree; and see below. |
| 15 | Rule numbering | R004 and R014 are **verbatim identical**: "There can be at most one ELI value." | — | R007 is also marked "PENDING" in a published rule table. |
| 16 | Namespace table: `foaf` | `http://xmlns.com/foaf/spec/` | The real FOAF namespace is `http://xmlns.com/foaf/0.1/` (which the JSON-LD context uses correctly) | The published namespace table is wrong. |
| 17 | Namespace table: `itsrdf` | `https://www.w3.org/2005/11/its/rdf#` (**https**) | The real namespace is `http://www.w3.org/2005/11/its/rdf#` (**http**), as used in the context and every example | IRIs are compared by string in RDF — the table's IRI names a different, nonexistent vocabulary. |
| 18 | Metadata table | `dtc:subject` | `dct:subject` everywhere else | Typo in a normative table. |

**The published examples fail the published shapes.** Rule R015 requires
`endIndex == strlen(text)` and `beginIndex == 0`. Checking every example in the spec:

| Example | text length | declared `offset_end` | R015 |
|---|---|---|---|
| doc002 `"This Lynx document is a valid NIF document"` | 42 | 41 | **FAIL** |
| doc003 `"Das ist ein Dokument."` | 21 | 20 | **FAIL** |
| doc004 `"Das ist ein Dokument"` | 20 | 20 | pass |
| doc006 | 96 | 96 | pass |
| doc007 | 51 | 51 | pass |
| doc009 (hidden) | 41 | 41 | pass |

Two of the six worked examples are invalid against the spec's own validator. Additionally doc007's
annotation declares `offset_ini: 21, offset_end: 35` with `anchorOf: "2019"`, but characters 21–35 of
that text are `"2019, specific"` — the offsets and the anchor text disagree (the IRI, `#offset_21_25`,
is right; the JSON `offset_end` is wrong). And doc006's published Turtle is **syntactically invalid**: a
predicate was lost, leaving a bare `false ;` in the triple block, and a title carries the malformed
language tag `@en:` (from a JSON key typo `"en:"`).

---

## 9. Assessment as a schema-design source

### 9.1 Strengths — what is genuinely worth taking

1. **The stand-off / offset-overlay architecture.** Immutable canonical text + everything else as
   interval-keyed overlays. Structure, annotations, and translations never mutate the text and never
   collide with each other. This is the correct backbone for any pipeline where multiple independent
   producers enrich the same document.
2. **Derivable span identity (`#offset_{begin}_{end}`).** No ID allocator, no coordination, content-free
   and reproducible: two annotators that find the same span produce the same IRI and their claims merge
   automatically. This is elegant and cheap.
3. **`nif:AnnotationUnit` — attributed, confidence-scored, competing claims per span.** The best idea in
   the model. Separating *"where"* (the span) from *"who says what about it, and how sure"* (the units)
   is exactly the structure needed when an LLM, a rules engine, and a human all annotate the same clause.
   Port this shape.
4. **Language handling.** One mandatory document language; text literal deliberately untagged;
   language-indexed metadata via `@container: @language`; `sh:uniqueLang` enforcement; and a stated,
   honest reason for discouraging locale variants (downstream tools break). Small, coherent, and it maps
   to a TypeScript `Record<LanguageCode, T>` with no impedance.
5. **The JSON-LD context as a dual-surface contract.** One file lets developers write ordinary JSON
   (`text`, `parts`, `offset_ini`) that mechanically becomes correct RDF. This is the right way to keep
   an RDF model from being hostile to application developers, and it is directly analogous to
   schema-first codec design: one schema, two encodings.
6. **Deferred legal identity via `lkg:hasEli`.** Rather than re-modeling legal identity, LKG points at
   the authoritative external identifier (ELI/ECLI). Correct instinct: do not re-mint identity you do not
   own.
7. **Explicit, numbered, machine-executable validation rules.** R001–R015 with SHACL implementations and
   a (once-)hosted sandbox is more validation rigor than most published ontologies attempt.
8. **Documented codelists per jurisdiction** (Annex I: EU / Spain / Austria / Ireland `type_document`
   values). Ugly as a model, but valuable as harvested reference data.

### 9.2 Weaknesses — what disqualifies it as a direct source

1. **It is not a legal knowledge graph; it is a document envelope.** No `amends`, `repeals`,
   `consolidates`, `cites`, `implements`, `transposes`, `in_force`. 8 of ELI's ~85 properties reused,
   none of the relational ones. The "graph" is text-structural. Anyone porting this expecting legal
   reasoning substrate will get a corpus wrapper.
2. **No point-in-time versioning.** ELI's Work/Expression FRBR layering is collapsed into one flat blank
   node with three optional dates and no lineage. "What did this article say on date D?" is unanswerable.
   For compliance work this is the query that matters most.
3. **ELI is misused, not just under-used.** Three `owl:ObjectProperty`s (`jurisdiction`,
   `type_document`, `version`) are populated with string literals; `type_document` also violates its
   domain. LKG imports ELI, so these are live semantic errors, not stylistic ones (§5.3).
4. **Four artifacts, four different models.** The HTML doc, the OWL, the JSON-LD context, and the SHACL
   shapes disagree on class hierarchy, property names, datatypes, and cardinalities in at least 18
   distinct places (§8). Three documented properties (`lkg:annotation`, `lkg:translation`, `lkg:part`)
   do not exist; three declared properties (`hasPDF`, `hasDbpedia`, `hasWikipedia`) are missing from the
   context and would be silently dropped in JSON-LD round-trips.
5. **The validation layer does not validate.** The part-structure constraint targets a misspelled
   property; the begin/end-index constraint targets the wrong class; the Legislation shape does not
   target the spec's own Legislation example; the jurisdiction enum rejects the two cases the prose
   specifically calls out; two of six published examples fail R015; one published example is
   syntactically invalid Turtle. The rules table's own "under revision" warning is commented out of the
   rendered page.
6. **`Metadata` as a reified blank-node property bag is an anti-pattern.** It is unaddressable (no IRI,
   so nothing can reference or version a metadata record), it forces every metadata field through one
   functional property, and it exists mainly to make ELI properties domain-legal. In an Effect/Schema
   port this should be a plain nested struct — but note that means losing the ability to attribute or
   date metadata assertions.
7. **`lkg:accessGroup` puts authorization inside the document model.** Access control as a metadata
   string on the content object is a boundary violation; it will not survive contact with a real
   permission system.
8. **No corpus/collection layer.** Named as one of three core entities, then explicitly dropped. No DCAT,
   no `lkg:Collection`.
9. **Subject keywords are free text, not concepts.** `dct:subject` takes language-tagged strings. No
   EuroVoc, no SKOS. Cross-lingual subject retrieval — a stated project goal — has no schema support.
10. **No `owl:versionIRI`, single mutable namespace.** Consumers cannot pin a version.
11. **Effectively abandoned.** H2020 grant 780602 (project ran 2018–2021); the OWL was generated with a
    2019-era OWL API; the validator API is 503 and the document-platform API does not resolve; the
    upstream NIF ontology repo has been untouched since 2017. This is a historical artifact, not a
    living standard.

### 9.3 Recommendation

**Treat LKG as a pattern source, not a schema source.** Take four things and leave the rest:

1. the stand-off text + offset-overlay decomposition;
2. derivable span identity, *plus* a content hash or anchor-text field that LKG lacks, so re-extraction
   can be detected instead of silently corrupting every annotation IRI;
3. the `AnnotationUnit` shape — attributed, confidence-scored, competing claims anchored to a shared
   span — extended with a timestamp and a model/version field;
4. the language discipline (one mandatory document language, untagged canonical text, language-indexed
   metadata maps, one-value-per-language enforcement).

Do **not** inherit its metadata bag, its flat date fields, or its ELI usage. If ELI alignment is wanted,
go to the ELI ontology directly (v1.5 is live and richly documented) and model the
`LegalResource` → `LegalExpression` → `Format` chain properly, because that is precisely what buys
point-in-time law — the thing LKG gave up. Model subjects as concept IRIs (EuroVoc is free and fits) and
document-to-document relations as first-class typed edges from ELI's relational vocabulary.

**License discipline for this packet:** LKG itself is **CC BY 4.0 → port-with-attribution** (credit the
Lynx Project Consortium and the five named authors). NIF is **Apache 2.0 / CC BY 3.0 →
port-with-attribution**. ITS-RDF is under the **W3C Software License → port-with-attribution**. Dublin
Core terms are **CC BY 4.0**. **ELI declares no license in its ontology file and none on its landing
page → reference-only**: reuse ELI *IRIs* in data freely (that is ordinary linked-data practice), but do
not copy ELI's axioms into a derived ontology without written confirmation of terms.

---

## 10. Compact class / property inventory

### Classes (10)

| # | IRI | Label | Direct superclass (OWL) | Notes |
|---|---|---|---|---|
| C1 | `lkg:LynxDocument` | Lynx Document | `nif:Context` | root entity; domain of `lkg:metadata` |
| C2 | `lkg:LynxDocumentPart` | Lynx Document Part | `nif:Structure` | domain of `lkg:parent`; SHACL also requires `nif:OffsetBasedString` |
| C3 | `lkg:LynxAnnotation` | Lynx Annotation | `nif:Annotation` | holds `nif:annotationUnit`s |
| C4 | `lkg:Metadata` | Metadata | `eli:LegalExpression` | blank-node property bag; domain of 8 of 10 lkg properties |
| C5 | `lkg:Agreement` | Agreement | `lkg:LynxDocument` | marker |
| C6 | `lkg:CollectiveAgreement` | Collective Agreement | `lkg:Agreement` | marker (HTML doc wrongly says `LynxDocument`) |
| C7 | `lkg:CaseLaw` | Case Law | `lkg:LynxDocument` | marker |
| C8 | `lkg:Legislation` | Legislation | `lkg:LynxDocument` | marker; extra shape requires jurisdiction |
| C9 | `lkg:TechnicalSpecification` | Technical Specification | `lkg:LynxDocument` | marker |
| C10 | `lkg:Standard` | Standard | `lkg:TechnicalSpecification` | marker (HTML doc wrongly says `LynxDocument`) |

### Object properties (4)

| # | IRI | Domain | Range | Char. | JSON key |
|---|---|---|---|---|---|
| OP1 | `lkg:metadata` | `LynxDocument` | `Metadata` | Functional | `metadata` |
| OP2 | `lkg:parent` | `LynxDocumentPart` | `LynxDocument ⊔ LynxDocumentPart` | — | `parent` |
| OP3 | `lkg:hasEli` | `Metadata` | `eli:LegalExpression ⊔ eli:LegalResource` | — | `hasEli` |
| OP4 | `lkg:hasDbpedia` | `Metadata` | `owl:Thing` | — | *(absent from context)* |

### Data properties (6)

| # | IRI | Domain | Range (OWL) | Card. | JSON key |
|---|---|---|---|---|---|
| DP1 | `lkg:summary` | `Metadata` | `rdf:langString` | 0-1 per lang | `summary` |
| DP2 | `lkg:accessGroup` | `Metadata` | `xsd:string` | 0-* | `accessGroup` |
| DP3 | `lkg:hasAuthority` | `Metadata` | `xsd:string` | 0-1 | `hasAuthority` |
| DP4 | `lkg:hasPDF` | `Metadata` | `xsd:string` | 0-1 | *(absent from context)* |
| DP5 | `lkg:hasWikipedia` | `Metadata` | `xsd:string` | 0-1 | *(absent from context)* |
| DP6 | `lkg:wasExtractedFrom` | `Metadata` | `xsd:string` | 0-1 | `wasExtractedFrom` |

### Borrowed properties carrying the model (not owned by LKG)

| IRI | Owner | On class | Card. | JSON key |
|---|---|---|---|---|
| `nif:isString` | NIF | `LynxDocument` | 1, untagged | `text` |
| `nif:beginIndex` / `nif:endIndex` | NIF | Document, Part, Annotation | 1 / 1 | `offset_ini` / `offset_end` |
| `nif:referenceContext` | NIF | Part, Annotation | 1 | `referenceContext` (+ `@reverse` for `annotations`) |
| `nif:anchorOf` | NIF | Annotation | 0-1 | `anchorOf` |
| `nif:annotationUnit` | NIF | Annotation | 0-* | `annotationUnit` |
| `itsrdf:taClassRef` / `taIdentRef` / `taConfidence` / `taAnnotatorsRef` | ITS 2.0 RDF | `nif:AnnotationUnit` | 0-* | same |
| `itsrdf:target` | ITS 2.0 RDF | `LynxDocument` | 0-* per lang | `translations` |
| `eli:has_part` | ELI | `LynxDocument` | 0-* | `parts` |
| `eli:id_local` | ELI | `Metadata` | **1 (mandatory)** | `id_local` |
| `eli:jurisdiction` | ELI | `Metadata` | 0-1 (**1 for Legislation**) | `jurisdiction` |
| `eli:type_document` | ELI | `Metadata` | 0-1 | `type_document` |
| `eli:version` | ELI | `Metadata` | 0-1 | `version` |
| `eli:first_date_entry_in_force` / `date_no_longer_in_force` / `version_date` | ELI | `Metadata` | 0-1 each | same |
| `dct:language` | DCMI | `Metadata` | **1 (mandatory)** | `language` |
| `dct:title` / `dct:subject` / `dct:alternative` | DCMI | `Metadata`, `Part` | 0-1 per lang / 0-* / 0-* | same |
| `dct:creator` / `dct:created` / `dct:rightsHolder` / `dct:source` | DCMI | `Metadata` | 0-* / 0-1 / 0-1 / 0-1 | same |
| `owl:sameAs` / `rdfs:seeAlso` | W3C | `Metadata` | 0-* | `sameAs` / `seeAlso` |

---

## 11. Source list

Primary (all fetched 2026-08-06):

- LKG specification — <https://lynx-project.eu/doc/lkg/>
- LKG ontology, Turtle — <http://lynx-project.eu/doc/lkg.ttl>
- LKG JSON-LD context — <http://lynx-project.eu/doc/jsonld/lynxdocument.json>
- LKG SHACL shapes — <http://lynx-project.eu/doc/lkg-shapes.ttl>
- NIF SHACL shapes — <http://lynx-project.eu/doc/nif-shapes.ttl>
- LKG namespace IRI — <http://lkg.lynx-project.eu/def/>
- Lynx "Relevant ontologies" survey — <http://lynx-project.eu/data2/reference-ontologies>
- Lynx domain-independent vocabularies (OntoLex-lemon side) — <https://lynx-project.eu/data2/domain-independent-vocabularies>
- Lynx benchmark corpus — <https://lynx-project.eu/data/benchmarking.zip>

Upstream vocabularies (fetched and inspected 2026-08-06):

- ELI Metadata Ontology v1.5 — <http://data.europa.eu/eli/ontology> (RDF/XML via content negotiation)
- ELI landing page — <https://op.europa.eu/en/web/eu-vocabularies/eli>
- NIF core 2.1 — <https://raw.githubusercontent.com/NLP2RDF/ontologies/master/nif-core/nif-core.ttl>
- NLP2RDF ontologies repo — <https://github.com/NLP2RDF/ontologies>
- ITS 2.0 / RDF namespace — <https://www.w3.org/2005/11/its/rdf>
- W3C Software Notice and License — <http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231>
- RDFLicense CC BY 4.0 — <http://purl.org/NET/rdflicense/cc-by4.0> → <https://raw.githubusercontent.com/w3c/odrl/master/bp/license/rdflicense/cc-by4.0.ttl>
- DCMI Metadata Terms — <https://www.dublincore.org/specifications/dublin-core/dcmi-terms/>

Project background (search results, not independently verified):

- Lynx project home — <https://lynx-project.eu/>
- "LYNX: Towards a Legal Knowledge Graph for Multilingual Europe" — <https://pdfs.semanticscholar.org/df90/3717a0d8739ec7c420e707d2205dfeccd57c.pdf>
- "Lynx: A knowledge-based AI service platform … for the legal domain", *Information Systems* 106 — <https://www.sciencedirect.com/science/article/pii/S0306437921001563>
- "Lynx: Building the Legal Knowledge Graph for Smart Compliance Services in Multilingual Europe" (LREC 2018 W22) — <http://lrec-conf.org/workshops/lrec2018/W22/pdf/12_W22.pdf>
- CORDIS grant 780602 — <https://cordis.europa.eu/project/id/780602/reporting>

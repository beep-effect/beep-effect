# Vocabulary Specifications for Identity-as-IRI

This note grounds the `identity-as-iri` vocabulary registry, SKOS profile
validation, RDFS/OWL fold semantics, Dublin Core migration, SHACL projection,
and future PROV-O fiber source in official specifications. All factual claims
about a vocabulary or validation behavior cite the fetched source section that
defines them.

## 1. Registry Namespaces and Term Inventories

The generated registry should preserve local names exactly, including case and
punctuation. The lists below are the implementation inventory for literal
CURIE unions.

### rdf:

Namespace IRI: `http://www.w3.org/1999/02/22-rdf-syntax-ns#` (RDF Schema 1.1
§6).

Finite local-name inventory from the RDF namespace:

```ts
type RdfTerm =
  | "Alt"
  | "Bag"
  | "HTML"
  | "List"
  | "Property"
  | "Seq"
  | "Statement"
  | "XMLLiteral"
  | "first"
  | "langString"
  | "nil"
  | "object"
  | "predicate"
  | "rest"
  | "subject"
  | "type"
  | "value";
```

RDF Schema 1.1 summarizes the RDF classes and properties in §6 and separately
notes that `rdf:nil` is the empty `rdf:List` instance and that `rdf:_1`,
`rdf:_2`, `rdf:_3`, and so on are container membership properties (RDF Schema
1.1 §6). Because the `_n` family is open-ended, model it as a template pattern
such as `` `_${number}` `` or a positive-integer refinement instead of pretending
it is a closed finite union (RDF Schema 1.1 §6).

### rdfs:

Namespace IRI: `http://www.w3.org/2000/01/rdf-schema#` (RDF Schema 1.1 §6).

Complete local-name inventory from the RDFS namespace:

```ts
type RdfsTerm =
  | "Class"
  | "Container"
  | "ContainerMembershipProperty"
  | "Datatype"
  | "Literal"
  | "Resource"
  | "comment"
  | "domain"
  | "isDefinedBy"
  | "label"
  | "member"
  | "range"
  | "seeAlso"
  | "subClassOf"
  | "subPropertyOf";
```

RDF Schema 1.1 §2 defines the core classes `rdfs:Resource`, `rdfs:Class`,
`rdfs:Literal`, and `rdfs:Datatype`; §3 defines the properties used by the
fold, including `rdfs:domain`, `rdf:type`, `rdfs:subClassOf`,
`rdfs:subPropertyOf`, `rdfs:label`, `rdfs:comment`, `rdfs:range`,
`rdfs:seeAlso`, and `rdfs:isDefinedBy`; §6 gives the summary table for the
RDFS classes and properties.

### skos:

Namespace IRI: `http://www.w3.org/2004/02/skos/core#` (SKOS Reference §2).

Complete SKOS core local-name inventory:

```ts
type SkosTerm =
  | "Collection"
  | "Concept"
  | "ConceptScheme"
  | "OrderedCollection"
  | "altLabel"
  | "broadMatch"
  | "broader"
  | "broaderTransitive"
  | "changeNote"
  | "closeMatch"
  | "definition"
  | "editorialNote"
  | "exactMatch"
  | "example"
  | "hasTopConcept"
  | "hiddenLabel"
  | "historyNote"
  | "inScheme"
  | "mappingRelation"
  | "member"
  | "memberList"
  | "narrowMatch"
  | "narrower"
  | "narrowerTransitive"
  | "notation"
  | "note"
  | "prefLabel"
  | "related"
  | "relatedMatch"
  | "scopeNote"
  | "semanticRelation"
  | "topConceptOf";
```

SKOS Reference §2 states that all SKOS vocabulary URIs are formed by appending
the local name to `http://www.w3.org/2004/02/skos/core#`. The list above is the
complete core SKOS vocabulary table from SKOS Reference §2. It intentionally
excludes SKOS-XL, which is a separate namespace in SKOS Reference Appendix B.

### owl:

Namespace IRI: `http://www.w3.org/2002/07/owl#` (OWL 2 Structural
Specification §2.4).

The OWL registry for this handoff is an intentional subset, not the full OWL 2
vocabulary. It contains the class, property, mapping, ontology-versioning, and
deprecation terms needed by the fold:

```ts
type OwlTerm =
  | "AnnotationProperty"
  | "AsymmetricProperty"
  | "Class"
  | "DatatypeProperty"
  | "FunctionalProperty"
  | "InverseFunctionalProperty"
  | "IrreflexiveProperty"
  | "NamedIndividual"
  | "Nothing"
  | "ObjectProperty"
  | "Ontology"
  | "ReflexiveProperty"
  | "SymmetricProperty"
  | "Thing"
  | "TransitiveProperty"
  | "backwardCompatibleWith"
  | "deprecated"
  | "equivalentClass"
  | "equivalentProperty"
  | "imports"
  | "incompatibleWith"
  | "inverseOf"
  | "priorVersion"
  | "sameAs"
  | "versionInfo";
```

OWL 2 ontologies have classes, properties, individuals, and data values, and
OWL 2 entities are identified by IRIs (OWL 2 Structural Specification §1 and
§5). `owl:Class`, `owl:ObjectProperty`, `owl:DatatypeProperty`,
`owl:AnnotationProperty`, and `owl:NamedIndividual` correspond to the entity
kinds defined in OWL 2 Structural Specification §5.1 through §5.6. The property
characteristic classes listed above are used in the OWL Primer's Turtle examples
for object-property declarations (OWL 2 Primer §4.4 and §5.4). The
versioning/compatibility annotation properties and `owl:deprecated` are
built-in annotation properties with special treatment in OWL 2 Structural
Specification §2.4 and §5.5. `owl:equivalentClass`, `owl:equivalentProperty`,
`owl:inverseOf`, and `owl:sameAs` are the mapping/equality terms used by the
OWL Primer for class, property, and individual relationships (OWL 2 Primer
§4.1, §4.4, and §5.6).

### dcterms:

Namespace IRI: `http://purl.org/dc/terms/` (DCMI Metadata Terms §1.3 and §2).

Complete local-name inventory for the `dcterms:` namespace in DCMI Metadata
Terms. This includes properties, DCMI classes in the terms namespace,
vocabulary encoding schemes, and syntax encoding schemes (DCMI Metadata Terms
§2, §4, §5, and §6). It intentionally excludes the DCMI Type Vocabulary members
under `http://purl.org/dc/dcmitype/`, because that is a different namespace
(DCMI Metadata Terms §7).

```ts
type DctermsTerm =
  | "Agent"
  | "AgentClass"
  | "BibliographicResource"
  | "Box"
  | "DCMIType"
  | "DDC"
  | "FileFormat"
  | "Frequency"
  | "IMT"
  | "ISO3166"
  | "ISO639-2"
  | "ISO639-3"
  | "Jurisdiction"
  | "LCC"
  | "LCSH"
  | "LicenseDocument"
  | "LinguisticSystem"
  | "Location"
  | "LocationPeriodOrJurisdiction"
  | "MESH"
  | "MediaType"
  | "MediaTypeOrExtent"
  | "MethodOfAccrual"
  | "MethodOfInstruction"
  | "NLM"
  | "Period"
  | "PeriodOfTime"
  | "PhysicalMedium"
  | "PhysicalResource"
  | "Point"
  | "Policy"
  | "ProvenanceStatement"
  | "RFC1766"
  | "RFC3066"
  | "RFC4646"
  | "RFC5646"
  | "RightsStatement"
  | "SizeOrDuration"
  | "Standard"
  | "TGN"
  | "UDC"
  | "URI"
  | "W3CDTF"
  | "abstract"
  | "accessRights"
  | "accrualMethod"
  | "accrualPeriodicity"
  | "accrualPolicy"
  | "alternative"
  | "audience"
  | "available"
  | "bibliographicCitation"
  | "conformsTo"
  | "contributor"
  | "coverage"
  | "created"
  | "creator"
  | "date"
  | "dateAccepted"
  | "dateCopyrighted"
  | "dateSubmitted"
  | "description"
  | "educationLevel"
  | "extent"
  | "format"
  | "hasFormat"
  | "hasPart"
  | "hasVersion"
  | "identifier"
  | "instructionalMethod"
  | "isFormatOf"
  | "isPartOf"
  | "isReferencedBy"
  | "isReplacedBy"
  | "isRequiredBy"
  | "isVersionOf"
  | "issued"
  | "language"
  | "license"
  | "mediator"
  | "medium"
  | "modified"
  | "provenance"
  | "publisher"
  | "references"
  | "relation"
  | "replaces"
  | "requires"
  | "rights"
  | "rightsHolder"
  | "source"
  | "spatial"
  | "subject"
  | "tableOfContents"
  | "temporal"
  | "title"
  | "type"
  | "valid";
```

## 2. SKOS Integrity Conditions for Validation

The SKOS Reference distinguishes formal integrity conditions from usage notes:
an RDF graph is inconsistent with the SKOS data model when the graph and the
SKOS model lead to a logical contradiction (SKOS Reference §1.8), and the
document explicitly labels integrity-condition sections in the per-topic layout
(SKOS Reference §1.7.1).

Hard-fail these formal SKOS integrity conditions in strict profile mode:

| Condition | Validation classification | Implementer rule |
|---|---|---|
| S9 | Hard failure | A resource must not be both `skos:ConceptScheme` and `skos:Concept`, because those classes are disjoint (SKOS Reference §4.4/S9). |
| S13 | Hard failure | The three lexical label properties `skos:prefLabel`, `skos:altLabel`, and `skos:hiddenLabel` are pairwise disjoint, so the same subject/object pair cannot use more than one of them (SKOS Reference §5.4/S13). |
| S14 | Hard failure | A resource has no more than one `skos:prefLabel` value per language tag; treat duplicate preferred labels in the same language as an error (SKOS Reference §5.4/S14). |
| S27 | Hard failure | `skos:related` is disjoint with `skos:broaderTransitive`; because `skos:broader` is a subproperty of `skos:broaderTransitive`, direct broader/related clashes also become errors after SKOS entailment (SKOS Reference §8.3/S22-S26 and §8.4/S27). |
| S35 | Hard failure | `skos:Collection` is disjoint with both `skos:Concept` and `skos:ConceptScheme`, so collections cannot be modeled as concepts or schemes (SKOS Reference §9.4/S35). |
| S36 | Hard failure | `skos:memberList` is functional, so an ordered collection must not have more than one `skos:memberList` value (SKOS Reference §9.4/S36). |

Warn, rather than hard-fail, on SKOS usage conventions that the specification
does not make formal integrity conditions:

| Topic | Warning profile rule |
|---|---|
| Missing or multiple scheme membership | SKOS allows a concept to participate in zero, one, or more concept schemes, so a Beep profile may warn on missing `skos:inScheme` but must not claim core SKOS inconsistency (SKOS Reference §4.6.1). |
| Top concept convention | `skos:hasTopConcept` conventionally links a scheme to topmost concepts, but SKOS says no integrity condition enforces that convention; warn if a top concept has a broader concept in the same scheme (SKOS Reference §4.6.3). |
| Scheme containment through semantic relations | A semantic relation between concepts does not entail that both concepts are in the same scheme, so a same-scheme requirement is profile policy, not SKOS core (SKOS Reference §4.6.4). |
| Domain of `skos:inScheme` | SKOS intentionally states no domain for `skos:inScheme`; a profile can require class nodes to be `skos:Concept`, but the core model keeps the property usable by extensions (SKOS Reference §4.6.5). |
| Unique notations in a scheme | Unique notations within a concept scheme are discussed as a possible usage convention, not a SKOS integrity condition; implement as a warning unless the selected profile says otherwise (SKOS Reference §6.5.3). |
| Hierarchy cycles and alternate hierarchy paths | SKOS discusses cycles and alternate paths in hierarchical relations, but core SKOS does not make all such patterns inconsistent; warn unless they entail the S27 broader/related disjointness clash (SKOS Reference §8.6.8 and §8.6.9). |
| Mapping-property overreach | `skos:exactMatch` is transitive but other SKOS mapping properties are not, and no subproperty chains are defined through `skos:exactMatch` or `skos:closeMatch`; warn if authoring appears to assume stronger mapping propagation (SKOS Reference §10.6.3 and §10.6.7). |

## 3. RDFS and OWL Semantics Used by the Fold

`rdfs:subClassOf` points from the narrower class to the broader class. A triple
`C1 rdfs:subClassOf C2` states that all instances of `C1` are instances of
`C2` (RDF Schema 1.1 §3.4). Therefore the handoff tuple
`[Claim, "rdfs:subClassOf", "folio:Document"]` means Claim is a subclass of
Document, and the inverse authoring form `^rdfs:subClassOf` is the right way to
model "parent class of" without reversing the RDF predicate itself (RDF Schema
1.1 §3.4).

RDFS domain and range are inference rules, not local field validators. If
property `P` has `rdfs:domain C`, then subjects of triples using `P` are
instances of `C`; if `P` has `rdfs:range C`, then objects of triples using `P`
are instances of `C` (RDF Schema 1.1 §3.2 and §3.1). Multiple domain or range
statements are conjunctive: the subject or object is inferred to be an instance
of all stated classes (RDF Schema 1.1 §3.2 and §3.1). The fold can emit
`rdfs:domain` and `rdfs:range`, but closed-world cardinality and datatype checks
belong in SHACL, not in RDFS domain/range semantics (RDF Schema 1.1 §3.1 and
§3.2; SHACL §4.1 and §4.2).

Use `owl:ObjectProperty` for predicates whose values are resources and
`owl:DatatypeProperty` for predicates whose values are literals. OWL 2 defines
object properties separately from data properties in the entity model, and the
OWL Primer uses object-property assertions for links between individuals and
data-property assertions for literal values (OWL 2 Structural Specification
§5.3 and §5.4; OWL 2 Primer §4.4 and §4.5). That supports the handoff rule:
infer datatype-vs-object property from the schema AST value kind instead of
requiring authors to declare it.

Use `owl:sameAs` only when two individual IRIs denote the same individual.
SKOS explicitly contrasts this with SKOS mapping: `owl:sameAs` links two
individuals and indicates the same resource, while `owl:equivalentClass` links
classes with the same class extension (SKOS Reference §10.6.8). In SKOS
concept-mapping work, prefer `skos:exactMatch` for high-confidence concept
matches across schemes and avoid `owl:sameAs` unless identity-strength merging
is intended, because `owl:sameAs` can merge labels and scheme membership enough
to trigger SKOS inconsistency such as duplicate `skos:prefLabel` values per
language (SKOS Reference §10.6.8 and §5.4/S14). Use `owl:equivalentClass` for
class-extension equivalence, not individual identity and not loose SKOS concept
mapping (SKOS Reference §10.6.8; OWL 2 Primer §4.1).

OWL 2 punning allows the same IRI to be used in more than one syntactic role,
including as both a class and an individual, while OWL 2 Direct Semantics treats
the different uses as separate (OWL 2 New Features §2.4.1). OWL 2 still
restricts punning: a name cannot be both a class and a datatype, and a name can
be used for only one kind of property (OWL 2 New Features §2.4.1). This matters
for Beep because a schema class IRI can be an `owl:Class` while also serving as
the subject of SKOS annotation triples, but the fold should not use one IRI as
both an `owl:ObjectProperty` and an `owl:DatatypeProperty` (OWL 2 New Features
§2.4.1).

## 4. dcterms: vs dc/elements/1.1

Use `dcterms:` as the default Dublin Core namespace for new Beep output:
`http://purl.org/dc/terms/` (DCMI Metadata Terms §1.3 and §2). Treat the legacy
`dc:` namespace `http://purl.org/dc/elements/1.1/` as migration input and
legacy compatibility output only (DCMI Metadata Terms §1.3). DCMI term entries
show the relationship by declaring many `dcterms:*` properties as subproperties
of their `dc/elements/1.1` counterparts, for example `dcterms:title` is a
subproperty of `http://purl.org/dc/elements/1.1/title` (DCMI Metadata Terms §2,
term `title`).

Important ranges for the handoff fields:

| Term | Official range statement |
|---|---|
| `dcterms:identifier` | Has range `http://www.w3.org/2000/01/rdf-schema#Literal` (DCMI Metadata Terms §2, term `identifier`). |
| `dcterms:description` | Has range `http://www.w3.org/2000/01/rdf-schema#Literal` (DCMI Metadata Terms §2, term `description`). |
| `dcterms:source` | Range includes `http://purl.org/dc/terms/BibliographicResource` (DCMI Metadata Terms §2, term `source`). |
| `dcterms:title` | Has range `http://www.w3.org/2000/01/rdf-schema#Literal` (DCMI Metadata Terms §2, term `title`). |
| `dcterms:creator` | Range includes `http://purl.org/dc/terms/Agent` (DCMI Metadata Terms §2, term `creator`). |

For the `Ontology_models.ts` migration in the handoff, replace
`http://purl.org/dc/elements/1.1/title`, `description`, `identifier`,
`source`, and `creator` predicates with the corresponding `dcterms:*` CURIEs
when emitting new owned metadata, while preserving `dc/elements/1.1` only for
reading old annotations or documenting legacy source data (DCMI Metadata Terms
§1.3 and §2).

## 5. SHACL Essentials for `.key -> sh:property`

The projection target is a SHACL shapes graph. A class schema projects to a
`sh:NodeShape`, and each `$I.key(...)` field projects to a `sh:PropertyShape`
attached through `sh:property` (SHACL §2.1 and §4.7.2).

`sh:targetClass` selects focus nodes that are SHACL instances of the target
class; the subclass declarations needed to walk the class hierarchy must exist
in the data graph (SHACL §2.1.3.1). That means a Beep class shape can use the
class IRI as `sh:targetClass`, but validation over subclass instances depends
on the data graph carrying the relevant `rdfs:subClassOf` triples (SHACL
§2.1.3.1).

`sh:path` belongs on a property shape and identifies the property path from a
focus node to its value nodes (SHACL §2.3.1). For `$I.key("skos:prefLabel")`,
expand the CURIE to the predicate IRI and emit it as the `sh:path`; for an
inverse predicate such as `^rdfs:subClassOf`, use SHACL's property path support
rather than changing the underlying RDF predicate (SHACL §2.3.1).

Use `sh:datatype` when the schema AST says the field value is a literal of a
known datatype. SHACL says the `sh:datatype` parameter values are IRIs, and
each value node must be a literal with exactly that datatype (SHACL §4.1.2).

Use `sh:class` when the schema AST says the field value is an object/resource
with a target class. SHACL says each value node must be a SHACL instance of the
given type, and multiple `sh:class` values are interpreted conjunctively
(SHACL §4.1.1).

Use `sh:minCount` and `sh:maxCount` for optionality and cardinality. SHACL
defines `sh:minCount` as the minimum number of value nodes and `sh:maxCount` as
the maximum number of value nodes; both parameters use integer literals and a
shape has at most one value for each parameter (SHACL §4.2.1 and §4.2.2).
For Beep, non-optional scalar keys usually project to `sh:minCount 1`; optional
keys project without `sh:minCount`; single-valued fields project to
`sh:maxCount 1`; array fields omit `sh:maxCount` unless the AST has an explicit
upper bound (SHACL §4.2.1 and §4.2.2).

## 6. PROV-O Core Starting-Point Terms

Namespace IRI: `http://www.w3.org/ns/prov#` (PROV-O §1.3).

Use only the small future-fiber seed set for now:

```ts
type ProvSeedTerm =
  | "Activity"
  | "Agent"
  | "Entity"
  | "generatedAtTime"
  | "wasDerivedFrom";
```

`prov:Entity`, `prov:Activity`, and `prov:Agent` are the three starting-point
classes for describing things, processes, and responsible actors in PROV-O
(PROV-O §3.1). `prov:wasDerivedFrom` is a starting-point property connecting an
entity to another entity from which it was derived (PROV-O §3.1).
`prov:generatedAtTime` records the time at which an entity was generated, and
PROV-O examples use it with `xsd:dateTime` literals (PROV-O §4.3 and §3.2).
That is enough for the later `prov(x)` fiber without committing this packet to
the full PROV-O expanded vocabulary (PROV-O §3.1 and §4).

## 7. Design Implications

1. Generate a finite literal union for `rdf:` plus a separate `_n` container
   membership template, because RDF Schema defines `rdf:_1`, `rdf:_2`,
   `rdf:_3`, and so on as an open family rather than a finite list (RDF Schema
   1.1 §6).

2. Keep SKOS core and SKOS-XL separate in the registry. The core namespace is
   `http://www.w3.org/2004/02/skos/core#`; SKOS-XL is described separately in
   Appendix B, so adding SKOS-XL terms to `skos:` would invent CURIEs that the
   core namespace does not define (SKOS Reference §2 and Appendix B).

3. Treat SKOS strict-profile failures as exactly the formal integrity
   conditions S9, S13, S14, S27, S35, and S36, with entailment-aware checking
   for S27 because `skos:broader` is below `skos:broaderTransitive` (SKOS
   Reference §4.4/S9, §5.4/S13-S14, §8.3/S22-S26, §8.4/S27, and §9.4/S35-S36).

4. Keep scheme-membership expectations profile-specific. SKOS allows concepts
   in zero, one, or multiple schemes and does not infer scheme containment from
   semantic relations, so missing or cross-scheme membership is warning policy,
   not a core SKOS contradiction (SKOS Reference §4.6.1 and §4.6.4).

5. Preserve the tuple direction `[child, "rdfs:subClassOf", parent]`.
   RDFS defines the subject as the subclass and the object as the superclass,
   so reversing this in the authoring model would invert the class hierarchy
   (RDF Schema 1.1 §3.4).

6. Do not use `rdfs:domain` or `rdfs:range` as closed-world validators. RDFS
   domain/range infer subject/object classes; SHACL supplies closed-world
   datatype, class, and cardinality validation through `sh:datatype`,
   `sh:class`, `sh:minCount`, and `sh:maxCount` (RDF Schema 1.1 §3.1 and §3.2;
   SHACL §4.1 and §4.2).

7. Infer `owl:ObjectProperty` versus `owl:DatatypeProperty` from AST value
   shape. OWL 2 separates object-property and data-property entity kinds, and
   OWL 2 punning still allows only one property kind per IRI (OWL 2 Structural
   Specification §5.3 and §5.4; OWL 2 New Features §2.4.1).

8. Permit class IRIs to carry SKOS annotations without minting separate
   annotation subject IRIs. OWL 2 punning permits the same term to denote both
   a class and an individual in separate syntactic roles, and SKOS explicitly
   leaves room for concepts to also be OWL classes or properties (OWL 2 New
   Features §2.4.1; SKOS Reference §3.5.1).

9. Use `skos:exactMatch` for high-confidence cross-scheme concept matches and
   reserve `owl:sameAs` for true individual identity. SKOS warns that
   `owl:sameAs` can merge label and scheme facts enough to create SKOS
   inconsistency, while `owl:equivalentClass` is class-extension equivalence
   rather than concept mapping (SKOS Reference §10.6.8).

10. Default Dublin Core output to `dcterms:` and keep `dc/elements/1.1` as a
    migration input. DCMI Metadata Terms defines the `http://purl.org/dc/terms/`
    namespace and declares refined properties such as `dcterms:title` as
    subproperties of legacy `dc/elements/1.1` elements where applicable (DCMI
    Metadata Terms §1.3 and §2).

11. Model `dcterms:creator` and `dcterms:source` as object-capable metadata,
    not forced string literals, because DCMI uses `Range Includes
    dcterms:Agent` for creator and `Range Includes
    dcterms:BibliographicResource` for source (DCMI Metadata Terms §2, terms
    `creator` and `source`).

12. Emit SHACL property shapes directly from `$I.key` annotations. SHACL's
    `sh:property` attaches property shapes, `sh:path` selects value nodes, and
    `sh:datatype`/`sh:class`/`sh:minCount`/`sh:maxCount` cover the AST-derived
    literal/object/cardinality split (SHACL §2.3.1, §4.1.1, §4.1.2, §4.2.1,
    §4.2.2, and §4.7.2).

13. Keep PROV-O as a future fiber source with only `Entity`, `Activity`,
    `Agent`, `wasDerivedFrom`, and `generatedAtTime` in the seed registry. The
    starting-point classes and derivation relation are enough to attach
    provenance to an identity, while `generatedAtTime` gives the timestamp
    hook used in PROV-O examples (PROV-O §3.1, §3.2, and §4.3).

## Sources

| title | official URL | version/date | fetched yes/no |
|---|---|---|---|
| SKOS Simple Knowledge Organization System Reference | https://www.w3.org/TR/skos-reference/ | W3C Recommendation, 18 August 2009 | yes |
| RDF Schema 1.1 | https://www.w3.org/TR/rdf-schema/ | W3C Recommendation, 25 February 2014 | yes |
| OWL 2 Web Ontology Language Primer (Second Edition) | https://www.w3.org/TR/owl2-primer/ | W3C Recommendation, 11 December 2012 | yes |
| OWL 2 Web Ontology Language New Features and Rationale (Second Edition) | https://www.w3.org/TR/owl2-new-features/ | W3C Recommendation, 11 December 2012 | yes |
| OWL 2 Web Ontology Language Structural Specification and Functional-Style Syntax (Second Edition) | https://www.w3.org/TR/owl2-syntax/ | W3C Recommendation, 11 December 2012 | yes |
| Shapes Constraint Language (SHACL) | https://www.w3.org/TR/shacl/ | W3C Recommendation, 20 July 2017 | yes |
| DCMI Metadata Terms | https://www.dublincore.org/specifications/dublin-core/dcmi-terms/ | DCMI Recommendation, version 2020-01-20 | yes |
| PROV-O: The PROV Ontology | https://www.w3.org/TR/prov-o/ | W3C Recommendation, 30 April 2013 | yes |

# Audit: SemanticSchemaMetadata Consumers

## Summary

Section 3 of the identity-as-IRI handoff proposes a generated or curated vocabulary registry as data first and types second, with prefix entries carrying namespace IRIs and term literals (explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:130). It also sketches CURIE and `Expand` type machinery from that registry (explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:152), adds literal-typed `iri` and `curie` members to `IdentityComposer` (explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:174), and says annotation records written by `annote` / `annoteSchema` should grow owned `iri` and `curie` fields (explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:193).

The current `SemanticSchemaMetadata` channel is a typed Effect Schema annotation payload stored under the `semanticSchemaMetadata` annotation key (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:250, packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:319). Its payload records semantic-web metadata: kind, canonicalName, overview, status, specifications, equivalenceBasis, optional canonicalIri, optional preferredPrefix, aliases, canonicalization flag, representations, provenance/evidence/time notes, implementation notes, and non-goals (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:271). The `canonicalIri` and `preferredPrefix` exact search terms only occur as optional fields on that schema in the inspected source tree (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:279, packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:280).

The writer API validates payloads with `makeSemanticSchemaMetadata` before storage (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:347), and `annotateSemanticSchema` attaches validated metadata by calling `schema.annotate({ semanticSchemaMetadata: ... })` (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:377, packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:383). The reader API recursively walks schema AST values until it finds `annotations.semanticSchemaMetadata` (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:396, packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:429), and `getSemanticSchemaMetadata` exposes that traversal for any `S.Top` schema (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:460).

Subsumption shorthand used below: "address-only" means composer-derived `iri` / `curie` would subsume only address projection data, not the descriptive/specification/provenance/evidence fields currently stored in `SemanticSchemaMetadata` (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:273, packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:288; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:184, explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:196).

Search coverage: the requested terms `SemanticSchemaMetadata`, `annotateSemanticSchema`, `getSemanticSchemaMetadata`, `canonicalIri`, and `preferredPrefix` were searched under `packages/`, `apps/`, and `scratchpad/`. The inspected source hits are listed in the writer, reader, non-consumer, and Sources sections below; `apps/` and `scratchpad/` produced no matching source file paths for those terms.

## WRITERS

### Writer API and test-only writers

| Call site | What it annotates/authors | Composer-derived iri/curie subsumes it? |
|---|---|---|
| packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:383 | Generic writer implementation for `annotateSemanticSchema`; attaches validated `semanticSchemaMetadata` to any Effect schema passed through the helper (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:377). | Address-only. Keep as the descriptive metadata layer. |
| packages/foundation/modeling/rdf/test/Rdf.test.ts:562 | Test-only payload construction for `semanticMetadataInput` in the semantic metadata test block (packages/foundation/modeling/rdf/test/Rdf.test.ts:549). | Address-only. Test should migrate only if payload shape changes. |
| packages/foundation/modeling/rdf/test/Rdf.test.ts:581 | Test-only direct annotation of `S.String` with `semanticMetadataInput` (packages/foundation/modeling/rdf/test/Rdf.test.ts:580). | Address-only. |
| packages/foundation/modeling/rdf/test/Rdf.test.ts:582 | Test-only curried annotation of `S.Finite` via `annotateSemanticSchema(...)(S.Finite)` (packages/foundation/modeling/rdf/test/Rdf.test.ts:585). | Address-only. |

### `@beep/rdf` core RDF and URI schemas

| Call site | What it annotates/authors | Composer-derived iri/curie subsumes it? |
|---|---|---|
| packages/foundation/modeling/rdf/src/Rdf.ts:23, packages/foundation/modeling/rdf/src/Rdf.ts:294 | Authors `curieMetadata` and attaches it to `Curie` (packages/foundation/modeling/rdf/src/Rdf.ts:290). | Address-only. `Curie` still needs syntax/spec/equivalence metadata. |
| packages/foundation/modeling/rdf/src/Rdf.ts:37, packages/foundation/modeling/rdf/src/Rdf.ts:790 | Authors `namespaceBindingMetadata` and attaches it to `NamespaceBinding` (packages/foundation/modeling/rdf/src/Rdf.ts:783). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:52, packages/foundation/modeling/rdf/src/Rdf.ts:391 | Authors `namedNodeMetadata` and attaches it to `NamedNode` (packages/foundation/modeling/rdf/src/Rdf.ts:384). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:75, packages/foundation/modeling/rdf/src/Rdf.ts:470 | Authors `literalMetadata` and attaches it to `Literal` (packages/foundation/modeling/rdf/src/Rdf.ts:461). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:91, packages/foundation/modeling/rdf/src/Rdf.ts:732 | Authors `quadMetadata` and attaches it to `Quad` (packages/foundation/modeling/rdf/src/Rdf.ts:723). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:114, packages/foundation/modeling/rdf/src/Rdf.ts:761 | Authors `datasetMetadata` and attaches it to `Dataset` (packages/foundation/modeling/rdf/src/Rdf.ts:755). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:219 | Inline metadata attached to `PrefixLabel` (packages/foundation/modeling/rdf/src/Rdf.ts:215). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:333 | Inline metadata attached to `LanguageTag` (packages/foundation/modeling/rdf/src/Rdf.ts:329). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:422 | Inline metadata attached to `BlankNode` (packages/foundation/modeling/rdf/src/Rdf.ts:415). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:501 | Inline metadata attached to `DefaultGraph` (packages/foundation/modeling/rdf/src/Rdf.ts:494). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:540 | Inline metadata attached to `Term` (packages/foundation/modeling/rdf/src/Rdf.ts:536). | Address-only. |
| packages/foundation/modeling/rdf/src/Rdf.ts:817 | Inline metadata attached to `PrefixMap` (packages/foundation/modeling/rdf/src/Rdf.ts:812). | Address-only. |
| packages/foundation/modeling/rdf/src/Uri.ts:21, packages/foundation/modeling/rdf/src/Uri.ts:209 | Authors `uriReferenceMetadata` and attaches it to `URIReference` (packages/foundation/modeling/rdf/src/Uri.ts:205). | Address-only. |
| packages/foundation/modeling/rdf/src/Uri.ts:32, packages/foundation/modeling/rdf/src/Uri.ts:248 | Authors `relativeUriReferenceMetadata` and attaches it to `RelativeURIReference` (packages/foundation/modeling/rdf/src/Uri.ts:244). | Address-only. |
| packages/foundation/modeling/rdf/src/Uri.ts:42, packages/foundation/modeling/rdf/src/Uri.ts:287 | Authors `absoluteUriMetadata` and attaches it to `AbsoluteURI` (packages/foundation/modeling/rdf/src/Uri.ts:283). | Address-only. |
| packages/foundation/modeling/rdf/src/Uri.ts:52, packages/foundation/modeling/rdf/src/Uri.ts:326 | Authors `uriMetadata` and attaches it to `URI` (packages/foundation/modeling/rdf/src/Uri.ts:322). | Address-only. |

### `@beep/rdf` JSON-LD schemas

| Call site | What it annotates/authors | Composer-derived iri/curie subsumes it? |
|---|---|---|
| packages/foundation/modeling/rdf/src/JsonLd.ts:110 | Metadata attached to `JsonLdTermDefinition` (packages/foundation/modeling/rdf/src/JsonLd.ts:103). | Address-only. |
| packages/foundation/modeling/rdf/src/JsonLd.ts:151 | Metadata attached to `JsonLdContext` (packages/foundation/modeling/rdf/src/JsonLd.ts:143). | Address-only. |
| packages/foundation/modeling/rdf/src/JsonLd.ts:183 | Metadata attached to `JsonLdBlankNodeIdentifier` (packages/foundation/modeling/rdf/src/JsonLd.ts:179). | Address-only. |
| packages/foundation/modeling/rdf/src/JsonLd.ts:230 | Metadata attached to `JsonLdNodeIdentifier` (packages/foundation/modeling/rdf/src/JsonLd.ts:227). | Address-only. |
| packages/foundation/modeling/rdf/src/JsonLd.ts:282 | Metadata attached to `JsonLdReferenceValue` (packages/foundation/modeling/rdf/src/JsonLd.ts:276). | Address-only. |
| packages/foundation/modeling/rdf/src/JsonLd.ts:321 | Metadata attached to `JsonLdLiteralValue` (packages/foundation/modeling/rdf/src/JsonLd.ts:313). | Address-only. |
| packages/foundation/modeling/rdf/src/JsonLd.ts:403 | Metadata attached to `JsonLdNodeObject` (packages/foundation/modeling/rdf/src/JsonLd.ts:395). | Address-only. |
| packages/foundation/modeling/rdf/src/JsonLd.ts:438 | Metadata attached to `JsonLdDocument` (packages/foundation/modeling/rdf/src/JsonLd.ts:431). | Address-only. |
| packages/foundation/modeling/rdf/src/JsonLd.ts:477 | Metadata attached to `JsonLdFrame` (packages/foundation/modeling/rdf/src/JsonLd.ts:470). | Address-only. |

### `@beep/rdf` provenance schemas

| Call site | What it annotates/authors | Composer-derived iri/curie subsumes it? |
|---|---|---|
| packages/foundation/modeling/rdf/src/Prov.ts:79 | Metadata attached to `ObjectRef` (packages/foundation/modeling/rdf/src/Prov.ts:75). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:126 | Metadata attached to `ProvDateTimeEncoded` (packages/foundation/modeling/rdf/src/Prov.ts:122). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:173 | Metadata attached to `ProvDateTime` (packages/foundation/modeling/rdf/src/Prov.ts:169). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:230 | Metadata attached to `LifecycleTimes` (packages/foundation/modeling/rdf/src/Prov.ts:217). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:278 | Metadata attached to `Entity` (packages/foundation/modeling/rdf/src/Prov.ts:263). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:319 | Metadata attached to `Activity` (packages/foundation/modeling/rdf/src/Prov.ts:306). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:357 | Metadata attached to `Agent` (packages/foundation/modeling/rdf/src/Prov.ts:349). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:396 | Metadata attached to `SoftwareAgent` (packages/foundation/modeling/rdf/src/Prov.ts:388). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:435 | Metadata attached to `Plan` (packages/foundation/modeling/rdf/src/Prov.ts:427). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:474 | Metadata attached to `Collection` (packages/foundation/modeling/rdf/src/Prov.ts:466). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:513 | Metadata attached to `Person` (packages/foundation/modeling/rdf/src/Prov.ts:505). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:552 | Metadata attached to `Organization` (packages/foundation/modeling/rdf/src/Prov.ts:544). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:565 | `relationMetadata` factory authors shared PROV relation metadata (packages/foundation/modeling/rdf/src/Prov.ts:564). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:601 | `relationMetadata` attached to `Usage` (packages/foundation/modeling/rdf/src/Prov.ts:593). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:631 | `relationMetadata` attached to `Generation` (packages/foundation/modeling/rdf/src/Prov.ts:623). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:662 | `relationMetadata` attached to `Association` (packages/foundation/modeling/rdf/src/Prov.ts:654). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:691 | `relationMetadata` attached to `Attribution` (packages/foundation/modeling/rdf/src/Prov.ts:684). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:722 | `relationMetadata` attached to `Delegation` (packages/foundation/modeling/rdf/src/Prov.ts:714). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:751 | `relationMetadata` attached to `Derivation` (packages/foundation/modeling/rdf/src/Prov.ts:744). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:780 | `relationMetadata` attached to `PrimarySource` (packages/foundation/modeling/rdf/src/Prov.ts:773). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:809 | `relationMetadata` attached to `Quotation` (packages/foundation/modeling/rdf/src/Prov.ts:802). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:838 | `relationMetadata` attached to `Revision` (packages/foundation/modeling/rdf/src/Prov.ts:831). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:869 | `relationMetadata` attached to `Start` (packages/foundation/modeling/rdf/src/Prov.ts:861). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:900 | `relationMetadata` attached to `End` (packages/foundation/modeling/rdf/src/Prov.ts:892). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:945 | Metadata attached to `ProvRecord` (packages/foundation/modeling/rdf/src/Prov.ts:927). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:995 | Metadata attached to `ProvBundle` (packages/foundation/modeling/rdf/src/Prov.ts:988). | Address-only. |
| packages/foundation/modeling/rdf/src/Prov.ts:1029 | Metadata attached to `ProvO` (packages/foundation/modeling/rdf/src/Prov.ts:1026). | Address-only. |

### `@beep/rdf` evidence and Web Annotation adapter schemas

| Call site | What it annotates/authors | Composer-derived iri/curie subsumes it? |
|---|---|---|
| packages/foundation/modeling/rdf/src/Evidence.ts:83 | Metadata attached to `TextQuoteSelector` (packages/foundation/modeling/rdf/src/Evidence.ts:73). | Address-only. |
| packages/foundation/modeling/rdf/src/Evidence.ts:124 | Metadata attached to `TextPositionSelector` (packages/foundation/modeling/rdf/src/Evidence.ts:116). | Address-only. |
| packages/foundation/modeling/rdf/src/Evidence.ts:164 | Metadata attached to `FragmentSelector` (packages/foundation/modeling/rdf/src/Evidence.ts:156). | Address-only. |
| packages/foundation/modeling/rdf/src/Evidence.ts:242 | Metadata attached to `EvidenceTarget` (packages/foundation/modeling/rdf/src/Evidence.ts:235). | Address-only. |
| packages/foundation/modeling/rdf/src/Evidence.ts:284 | Metadata attached to `EvidenceAnchor` (packages/foundation/modeling/rdf/src/Evidence.ts:276). | Address-only. |
| packages/foundation/modeling/rdf/src/Evidence.ts:330 | Metadata attached to `BoundedEvidenceProjection` (packages/foundation/modeling/rdf/src/Evidence.ts:323). | Address-only. |
| packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:27 | `adapterMetadata` factory authors shared Web Annotation adapter metadata (packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:26). | Address-only. |
| packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:67 | `adapterMetadata` attached to `WebAnnotationTextQuoteSelector` (packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:56). | Address-only. |
| packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:103 | `adapterMetadata` attached to `WebAnnotationTextPositionSelector` (packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:93). | Address-only. |
| packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:138 | `adapterMetadata` attached to `WebAnnotationFragmentSelector` (packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:128). | Address-only. |
| packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:212 | `adapterMetadata` attached to `WebAnnotationTarget` (packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:205). | Address-only. |
| packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:248 | `adapterMetadata` attached to `WebAnnotation` (packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:239). | Address-only. |

### `@beep/semantic-web` service-contract schemas

| Call site | What it annotates/authors | Composer-derived iri/curie subsumes it? |
|---|---|---|
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:21 | `serviceContractMetadata` factory authors JSON-LD document service metadata (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:20). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:90 | Attached to `JsonLdDocumentError` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:82). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:122 | Attached to `CompactJsonLdDocumentRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:114). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:155 | Attached to `FlattenJsonLdDocumentRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:147). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:188 | Attached to `FrameJsonLdDocumentRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:181). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:223 | Attached to `JsonLdDocumentLoaderPolicy` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:215). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:294 | Attached to `ExpandJsonLdDocumentRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:287). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:332 | Attached to `NormalizeJsonLdDocumentRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:321). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:363 | Attached to `JsonLdToRdfRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:357). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:396 | Attached to `JsonLdFromRdfRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:389). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:427 | Attached to `JsonLdDocumentResult` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:421). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:455 | Attached to `JsonLdToRdfResult` (packages/foundation/capability/semantic-web/src/services/jsonld-document.ts:449). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:20 | `serviceContractMetadata` factory authors JSON-LD context service metadata (packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:19). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:81 | Attached to `JsonLdContextError` (packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:73). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:114 | Attached to `NormalizeJsonLdContextRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:106). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:149 | Attached to `ExpandJsonLdTermRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:142). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:182 | Attached to `ExpandJsonLdTermResult` (packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:175). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:214 | Attached to `CompactJsonLdIriRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:207). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:247 | Attached to `CompactJsonLdIriResult` (packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:240). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:277 | Attached to `MergeJsonLdContextsRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-context.ts:270). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/sparql-query.ts:18 | `serviceContractMetadata` factory authors SPARQL query service metadata (packages/foundation/capability/semantic-web/src/services/sparql-query.ts:17). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/sparql-query.ts:79 | Attached to `SparqlQueryRequest` (packages/foundation/capability/semantic-web/src/services/sparql-query.ts:70). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/sparql-query.ts:105 | Attached to `SparqlSelectResult` (packages/foundation/capability/semantic-web/src/services/sparql-query.ts:98). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/sparql-query.ts:131 | Attached to `SparqlAskResult` (packages/foundation/capability/semantic-web/src/services/sparql-query.ts:124). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/sparql-query.ts:161 | Attached to `SparqlConstructResult` (packages/foundation/capability/semantic-web/src/services/sparql-query.ts:154). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/sparql-query.ts:230 | Attached to `SparqlQueryError` (packages/foundation/capability/semantic-web/src/services/sparql-query.ts:222). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:19 | `serviceContractMetadata` factory authors SHACL validation service metadata (packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:18). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:83 | Attached to `ShaclPropertyShape` (packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:72). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:122 | Attached to `ShaclNodeShape` (packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:114). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:159 | Attached to `ShaclValidationViolation` (packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:149). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:191 | Attached to `ShaclValidationRequest` (packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:183). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:225 | Attached to `ShaclValidationResult` (packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:217). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:255 | Attached to `ShaclValidationError` (packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:247). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/provenance.ts:38 | `serviceContractMetadata` factory authors provenance service metadata (packages/foundation/capability/semantic-web/src/services/provenance.ts:37). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/provenance.ts:100 | Attached to `ProjectProvenanceRequest` (packages/foundation/capability/semantic-web/src/services/provenance.ts:92). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/provenance.ts:130 | Attached to `SummarizeProvenanceRequest` (packages/foundation/capability/semantic-web/src/services/provenance.ts:123). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/provenance.ts:164 | Attached to `ExportProvenanceRequest` (packages/foundation/capability/semantic-web/src/services/provenance.ts:154). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/provenance.ts:196 | Attached to `BoundedProvenanceProjection` (packages/foundation/capability/semantic-web/src/services/provenance.ts:188). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/provenance.ts:235 | Attached to `ProvenanceSummary` (packages/foundation/capability/semantic-web/src/services/provenance.ts:224). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/provenance.ts:265 | Attached to `ProvenanceServiceError` (packages/foundation/capability/semantic-web/src/services/provenance.ts:257). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts:21 | `serviceContractMetadata` factory authors JSON-LD stream serialize service metadata (packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts:20). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts:66 | Attached to `JsonLdStreamSerializeRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts:57). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts:101 | Attached to `JsonLdStreamSerializeResult` (packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts:93). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts:158 | Attached to `JsonLdStreamSerializeError` (packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts:149). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:20 | `serviceContractMetadata` factory authors JSON-LD stream parse service metadata (packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:19). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:101 | Attached to `JsonLdTextChunkStream` (packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:93). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:136 | Attached to `JsonLdByteChunkStream` (packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:128). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:216 | Attached to `JsonLdStreamParseRequest` (packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:209). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:251 | Attached to `JsonLdStreamParseResult` (packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:243). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:310 | Attached to `JsonLdStreamParseError` (packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:302). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/canonicalization.ts:19 | `serviceContractMetadata` factory authors canonicalization service metadata (packages/foundation/capability/semantic-web/src/services/canonicalization.ts:18). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/canonicalization.ts:82 | Attached to `CanonicalizationError` (packages/foundation/capability/semantic-web/src/services/canonicalization.ts:74). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/canonicalization.ts:113 | Attached to `CanonicalizeDatasetRequest` (packages/foundation/capability/semantic-web/src/services/canonicalization.ts:105). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/canonicalization.ts:147 | Attached to `FingerprintDatasetRequest` (packages/foundation/capability/semantic-web/src/services/canonicalization.ts:139). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/canonicalization.ts:180 | Attached to `CanonicalDatasetResult` (packages/foundation/capability/semantic-web/src/services/canonicalization.ts:173). | Address-only. |
| packages/foundation/capability/semantic-web/src/services/canonicalization.ts:211 | Attached to `DatasetFingerprint` (packages/foundation/capability/semantic-web/src/services/canonicalization.ts:204). | Address-only. |

## READERS

| Call site | What it reads/does | Composer-derived iri/curie subsumes it? |
|---|---|---|
| packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:429 | Runtime reader traversal checks whether an inspected object has `annotations.semanticSchemaMetadata` (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:386). | No. Composer-derived iri/curie could provide another lookup key, but this reader returns the descriptive metadata payload. |
| packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:430 | Runtime reader traversal returns the discovered metadata payload (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:396). | No. |
| packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:460 | Public `getSemanticSchemaMetadata(schema)` reader API accepts any `S.Top` schema (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:443). | No. It can be layered with a future identity/IRI reader. |
| packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:461 | Public reader starts traversal at `schema.ast` with a `WeakSet` for cycle prevention (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:460). | No. |
| packages/foundation/modeling/rdf/test/Rdf.test.ts:588 | Test-only reader verifies metadata attached directly to `S.String` has canonicalName `ExampleIdentifier` (packages/foundation/modeling/rdf/test/Rdf.test.ts:581). | No. |
| packages/foundation/modeling/rdf/test/Rdf.test.ts:589 | Test-only reader verifies nested metadata is found through `S.Array(curried)` (packages/foundation/modeling/rdf/test/Rdf.test.ts:586). | No. |
| packages/foundation/modeling/rdf/test/Rdf.test.ts:590 | Test-only reader verifies unannotated `S.Array(S.String)` returns `undefined` (packages/foundation/modeling/rdf/test/Rdf.test.ts:590). | No. |
| packages/foundation/modeling/rdf/test/Rdf.test.ts:591 | Test-only reader verifies unannotated `S.Boolean` returns `undefined` (packages/foundation/modeling/rdf/test/Rdf.test.ts:591). | No. |
| packages/foundation/capability/semantic-web/test/InteropAndMetadata.test.ts:103 | Test-only cross-package metadata coverage audit reads each exported public schema and asserts metadata exists (packages/foundation/capability/semantic-web/test/InteropAndMetadata.test.ts:93, packages/foundation/capability/semantic-web/test/InteropAndMetadata.test.ts:104). | No. Composer-derived iri/curie would not satisfy the test's `canonicalName` assertion (packages/foundation/capability/semantic-web/test/InteropAndMetadata.test.ts:105). |

## Non-Consumer Search Hits

| Hit | Classification |
|---|---|
| packages/foundation/modeling/rdf/src/index.ts:72 | Re-export of the metadata module from `@beep/rdf`; it exposes the channel but does not author or read metadata (packages/foundation/modeling/rdf/src/index.ts:67). |
| packages/foundation/capability/semantic-web/src/semantic-schema-metadata.ts:9 | Compatibility re-export of `@beep/rdf/SemanticSchemaMetadata`; it exposes the channel but does not author or read metadata (packages/foundation/capability/semantic-web/src/semantic-schema-metadata.ts:2). |
| packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts:65 | Generated allowlist entry naming `SemanticSchemaMetadata.ts`; it documents a WeakSet traversal exception, not a metadata writer or reader (packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts:67). |

## Final Recommendation

Recommendation: layer composer-derived identity `iri` / `curie` onto schema identity annotations, and keep `SemanticSchemaMetadata` as the semantic/documentation/specification payload layer. The handoff's composer fields cover deterministic address projection (explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:184), while the existing metadata channel stores kind, names, overview, status, specifications, equivalence, representation, provenance, evidence, time, implementation-note, and non-goal fields (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:273, packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:288).

Deprecate the `canonicalIri` and `preferredPrefix` fields after composer-derived `iri` / `curie` lands. They are present in the payload schema (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:279, packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:280), but no inspected writer row above uses them in payload data; address projection should move to the composer-owned channel described in the handoff (explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:193, explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:196).

Migration cost estimate: 110 concrete production annotation attachments plus the generic writer implementation are in scope if the metadata shape or attach mechanism changes; the attachments are enumerated in the WRITERS section and the generic writer is `annotateSemanticSchema` (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:383). Reader risk is low because production runtime reading is centralized in `getSemanticSchemaMetadata` and its private traversal (packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:429, packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:460), while discovered call sites outside the helper are test-only assertions in `Rdf.test.ts` and `InteropAndMetadata.test.ts` (packages/foundation/modeling/rdf/test/Rdf.test.ts:588, packages/foundation/capability/semantic-web/test/InteropAndMetadata.test.ts:103).

## Sources

- explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md
- packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts
- packages/foundation/modeling/rdf/src/Rdf.ts
- packages/foundation/modeling/rdf/src/Uri.ts
- packages/foundation/modeling/rdf/src/JsonLd.ts
- packages/foundation/modeling/rdf/src/Prov.ts
- packages/foundation/modeling/rdf/src/Evidence.ts
- packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts
- packages/foundation/modeling/rdf/src/index.ts
- packages/foundation/modeling/rdf/test/Rdf.test.ts
- packages/foundation/capability/semantic-web/src/semantic-schema-metadata.ts
- packages/foundation/capability/semantic-web/src/services/jsonld-document.ts
- packages/foundation/capability/semantic-web/src/services/jsonld-context.ts
- packages/foundation/capability/semantic-web/src/services/sparql-query.ts
- packages/foundation/capability/semantic-web/src/services/shacl-validation.ts
- packages/foundation/capability/semantic-web/src/services/provenance.ts
- packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts
- packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts
- packages/foundation/capability/semantic-web/src/services/canonicalization.ts
- packages/foundation/capability/semantic-web/test/InteropAndMetadata.test.ts
- packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts
- <local-memory-registry> (workflow context check only; repo audit facts above are from live source files)

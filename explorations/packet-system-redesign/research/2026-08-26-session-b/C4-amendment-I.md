# Lane C4 research: Amendment I JSON-LD projection

## Verdict

The repository has enough RDF, identity, deterministic JSON-LD, and in-process SPARQL substrate to prototype this projection, but Amendment I is not ratifiable as written because its wording risks putting owned IRI addressing into `SemanticSchemaMetadata`, whose address fields are deprecated in favor of composer-derived `iri`/`curie`. (`packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:283-315`; `explorations/identity-as-iri/DECISIONS.md:63-81`)
No acceptance-grade cross-graph join exists in the current packet fold: the closest packet-to-research-report edge is present only in raw manifest JSON that the canonical `GoalManifest` does not model, while packet-to-evidence-span waits on candidate 4's not-yet-created `EvidenceReceipt`. (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:420-468`; `explorations/packet-system-redesign/MAP.md:175-190`)
Disposition: reshape and split Amendment I into a proof exploration gated on one packet -> research report -> source-span join, then adopt it as an additional renderer over candidate 3/Workstream D's one normalized projection only if that worked fixture closes the identity, input-freshness, and evidence-link gaps. (`goals/knowledge-surface-automation/SPEC.md:197-222`; `explorations/packet-system-redesign/MAP.md:123-135`)

## Evidence method and scope

This is a live-source audit of the current modeling packages, packet-core implementation, ratified identity packets, and overlapping packet charters; `PacketProjector` itself is still only a proposed candidate-3 symbol, so the implemented projector examined here is `projectPacketTrace`. (`explorations/packet-system-redesign/MAP.md:185-190`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketFold.ts:362-401`)

## 1. Substrate inventory

### 1.1 `Prov.ts`: useful model surface, narrow RDF codec, no packet use

`Prov.ts` calls itself a "Minimal stable PROV core and early extension tier" and accepts an `ObjectRef` as an IRI, CURIE, or local identifier; this permissive reference grammar is not the repository's owned-IRI minting doctrine. (`packages/foundation/modeling/rdf/src/Prov.ts:1-20`; `packages/foundation/modeling/rdf/src/Prov.ts:61-91`)

Its record surface is materially broader than four class names. (`packages/foundation/modeling/rdf/src/Prov.ts:975-995`)

- core-looking records include `Entity`, with generation/attribution/source/quotation/revision/derivation and time/value fields, plus `Activity`, `Agent`, and `SoftwareAgent`; (`packages/foundation/modeling/rdf/src/Prov.ts:255-342`; `packages/foundation/modeling/rdf/src/Prov.ts:344-421`)
- the early extension tier includes `Plan`, and the public union also includes `Collection`, `Person`, and `Organization`; (`packages/foundation/modeling/rdf/src/Prov.ts:423-461`; `packages/foundation/modeling/rdf/src/Prov.ts:975-994`)
- qualified/direct relation DTOs include `Usage`, `Generation`, `Association`, `Attribution`, `Delegation`, `Derivation`, `PrimarySource`, `Quotation`, `Revision`, `Start`, and `End`; (`packages/foundation/modeling/rdf/src/Prov.ts:583-592`; `packages/foundation/modeling/rdf/src/Prov.ts:594-758`; `packages/foundation/modeling/rdf/src/Prov.ts:975-994`)
- `ProvBundle` is a bounded record array with an optional, deliberately separate `LifecycleTimes` adjunct, and `ProvO` is the bundle-or-record public union. (`packages/foundation/modeling/rdf/src/Prov.ts:211-253`; `packages/foundation/modeling/rdf/src/Prov.ts:1028-1065`; `packages/foundation/modeling/rdf/src/Prov.ts:1067-1098`)

The RDF/JS bridge is real but smaller than the schema surface: `provBundleToDataset` emits deterministic quads and `datasetToProvBundle` reconstructs supported records, while non-empty lifecycle adjuncts and unsupported extension-tier records fail instead of being dropped. (`packages/foundation/modeling/rdf/src/ProvRdf.ts:482-567`; `packages/foundation/modeling/rdf/src/ProvRdf.ts:929-971`; `packages/foundation/modeling/rdf/src/ProvRdf.ts:440-455`)

That restriction matters immediately to Amendment I: `Plan` exists in `ProvRecord`, but the codec's catch-all rejects unsupported extension records, so the current codec cannot be the packet projection implementation for the requested `prov:Plan`/P-Plan surface without extension or a separate ontology projection. (`packages/foundation/modeling/rdf/src/Prov.ts:975-995`; `packages/foundation/modeling/rdf/src/ProvRdf.ts:440-455`)

The codec is proved against a named audit graph and round-trips its supported core byte-equivalently, including qualified and direct usage predicates. (`packages/foundation/modeling/rdf/test/ProvRdf.test.ts:138-159`)

It is not used "in anger" by another production domain: the barrel exports `Prov.ts`, the only production implementation importing it is its adjacent `ProvRdf.ts` codec, and direct exercises are confined to RDF package tests. (`packages/foundation/modeling/rdf/src/index.ts:59-66`; `packages/foundation/modeling/rdf/src/ProvRdf.ts:20-32`; `packages/foundation/modeling/rdf/test/ProvRdf.test.ts:1-12`; `packages/foundation/modeling/rdf/test/ProvO.test.ts:1-24`; `packages/foundation/modeling/rdf/test/InteropAndMetadata.test.ts:1-6`)

The distinction is DTO versus vocabulary use: the ontology session code **does** use `@beep/rdf/Vocab/Prov` in production to emit an RDF journal of `prov:Entity`, `prov:Agent`, `prov:Activity`, `prov:used`, generation, and association quads, while rejecting export when authenticated actor identity is missing; it does not construct `Prov.ts` records. (`packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:26-34`; `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:743-790`)

`Prov.ts` does **not** model P-Plan classes or properties, packet manifests/events, AgentO, report provenance, evidence receipts, or evidence-span foreign keys; the public union is exhaustively the records listed above. (`packages/foundation/modeling/rdf/src/Prov.ts:975-995`; `packages/foundation/modeling/rdf/src/Prov.ts:1028-1098`)

### 1.2 `SemanticSchemaMetadata`: documentation/profile annotations, not an address registry

The actual symbol is `SemanticSchemaMetadata`, an Effect `S.Class` stored under the module-augmented `semanticSchemaMetadata` annotation key. (`packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:260-324`; `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:341-349`)

Its required shape is `kind`, `canonicalName`, `overview`, `status`, a non-empty specification list, and `equivalenceBasis`; optional documentation fields cover aliases, canonicalization, representations, provenance profile, evidence anchoring, time semantics, implementation notes, and non-goals. (`packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:283-315`)

The closed metadata kinds include identifier/vocabulary/ontology/RDF/JSON-LD/provenance/service/adapter categories, and representation labels include RDF/JS, JSON-LD, Turtle, TriG, RDF/XML, and JSON Schema. (`packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:41-54`; `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:167-178`)

`canonicalIri` and `preferredPrefix` still decode for compatibility but are explicitly deprecated because composer-derived annotations own IRI and CURIE addressing. (`packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:291-305`)

The write/read API validates before attachment through `makeSemanticSchemaMetadata` and `annotateSemanticSchema`, then `getSemanticSchemaMetadata` resolves either direct schema annotations or nested AST annotations. (`packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:351-415`; `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:427-497`)

Every current production writer is in nine implementation files: `Rdf.ts` (12 attachments), `JsonLd.ts` (9), `Prov.ts` (26), `Evidence.ts` (6), `Uri.ts` (4), the Web Annotation adapter (8), and semantic-web's canonicalization (6), SHACL (7), and SPARQL (6) service DTOs. (`packages/foundation/modeling/rdf/src/Rdf.ts:21-112`; `packages/foundation/modeling/rdf/src/Rdf.ts:228-561`; `packages/foundation/modeling/rdf/src/Rdf.ts:861`; `packages/foundation/modeling/rdf/src/JsonLd.ts:107-124`; `packages/foundation/modeling/rdf/src/JsonLd.ts:412-468`; `packages/foundation/modeling/rdf/src/Prov.ts:77-91`; `packages/foundation/modeling/rdf/src/Prov.ts:583-592`; `packages/foundation/modeling/rdf/src/Evidence.ts:243-303`; `packages/foundation/modeling/rdf/src/Uri.ts:217-347`; `packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:483-496`; `packages/foundation/capability/semantic-web/src/services/canonicalization.ts:100-282`; `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:109-366`; `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:99-298`)

There is no production reader of `getSemanticSchemaMetadata` outside its defining module; current readers are coverage/round-trip tests that audit public RDF and semantic-web schema families or prove direct/nested lookup. (`packages/foundation/modeling/rdf/test/InteropAndMetadata.test.ts:64-81`; `packages/foundation/modeling/rdf/test/Rdf.test.ts:639-650`; `packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts:118-127`)

**Blocking wording collision:** if "IRIs ... carried as `SemanticSchemaMetadata`" means filling `canonicalIri`/`preferredPrefix`, Amendment I contradicts the ratified single-address-channel decision; it is safe only if semantic metadata carries PROV/P-Plan documentation while normal `$I.class`/`$I.annote` annotations carry the owned `iri`/`curie`, and `rdfs:subClassOf`/`owl:equivalentClass` remain ontology-fold triples. (`explorations/identity-as-iri/DECISIONS.md:63-81`; `goals/identity-iri-fold/SPEC.md:88-114`)

### 1.3 Identity and IRI minting: ratified and already shipped

The exact owned transform is mechanical: `@beep/a/b` plus authority `https://ns.beep.sh/` becomes `https://ns.beep.sh/a/b`, and the same identity plus prefix `beep` becomes `beep:a/b`. (`packages/foundation/modeling/identity/src/Id.ts:378-405`; `packages/foundation/modeling/identity/src/Id.ts:407-434`)

Bound composers expose literal `.iri` and `.curie`; one-argument `make(...)` composers remain unbound, and `.rebase(...)` changes IRI/CURIE projections without changing the identity path or symbol. (`packages/foundation/modeling/identity/src/Id.ts:1314-1362`; `packages/foundation/modeling/identity/src/Id.ts:1420-1440`)

Owned schema annotations contain `identifier`, interned `schemaId`, title, and composer-bound `iri`/`curie`; ontology-key options statically forbid forged identity/address fields and put borrowed predicates in the separate `ontologyTerm` channel. (`packages/foundation/modeling/identity/src/Id.ts:716-746`; `packages/foundation/modeling/identity/src/Id.ts:775-782`; `packages/foundation/modeling/identity/src/Id.ts:850-899`)

Runtime tests prove `$I.class("Claim")` mints `https://ns.beep.sh/my-pkg/patent/Claim` / `beep:my-pkg/patent/Claim`, and even unsafe options cannot forge `iri`/`curie` through `$I.key`. (`packages/foundation/modeling/identity/test/OntologyEntrypoints.test.ts:44-73`)

The ratified authority is `https://ns.beep.sh/`, `SemanticSchemaMetadata` is documentation-only, and fold-only relational triples are the single authoring channel; Amendment I must preserve all three doctrines. (`explorations/identity-as-iri/DECISIONS.md:63-92`; `explorations/identity-as-iri/DECISIONS.md:130-145`; `goals/identity-iri-fold/SPEC.md:81-114`)

The current identity packet is not speculative: `identity-iri-fibered` is completed-retained and reports shipped `Fibered`, `IdentityRegistry`, RDF binding, dataset layer, SHACL projection, and end-to-end proof. (`goals/identity-iri-fibered/README.md:3-17`; `goals/identity-iri-fibered/README.md:33-38`)

`IdentityRegistry` resolves exact identity/IRI/CURIE references, stores all three projections per entry, rejects collisions in any encoding, and the semantic-web adapter uses each entry's IRI as its RDF named-node subject. (`packages/foundation/modeling/identity/src/IdentityRegistry.ts:20-70`; `packages/foundation/modeling/identity/src/IdentityRegistry.ts:81-143`; `packages/foundation/modeling/identity/src/IdentityRegistry.ts:277-304`; `packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts:203-236`)

The available RDF dataset registry layer is explicitly a test/development adapter that decodes one in-memory dataset once; it is not a durable graph store. (`packages/foundation/capability/semantic-web/src/identity/IdentityRegistryDataset.ts:1-3`; `packages/foundation/capability/semantic-web/src/identity/IdentityRegistryDataset.ts:21-49`)

`CoreVocab` currently closes borrowed CURIEs over RDF, RDFS, SKOS, OWL, and DCTERMS; it includes `rdfs:subClassOf` and `owl:equivalentClass`, but it has no PROV or P-Plan namespace, so an Amendment-I fold needs an explicitly extended vocabulary rather than stringly CURIEs. (`packages/foundation/modeling/identity/src/Vocab.ts:113-170`; `packages/foundation/modeling/identity/src/Vocab.ts:171-236`)

### 1.4 JSON-LD, SPARQL, stores, and ontology packages

The generic RDF package supplies bounded JSON-LD value/document schemas, including `JsonLdNodeObject` and `JsonLdDocument`; it explicitly says RDF semantic identity still requires bridging and canonicalization, so this file is a DTO substrate rather than the packet emitter. (`packages/foundation/modeling/rdf/src/JsonLd.ts:1-16`; `packages/foundation/modeling/rdf/src/JsonLd.ts:390-468`)

The real deterministic emitter is the ontology fold: its projections are pure, total, and byte-identical for the same assembly; `toContext` derives terms from assembled annotations plus core prefixes, and `toJsonLd` emits class, predicate, and external-fact-subject nodes. (`packages/foundation/modeling/ontology/src/Fold.projections.ts:1-7`; `packages/foundation/modeling/ontology/src/Fold.projections.ts:204-246`; `packages/foundation/modeling/ontology/src/Fold.projections.ts:281-355`; `packages/foundation/modeling/ontology/src/Fold.projections.ts:357-411`)

The emitter's built-in compacting/context vocabulary is only DCTERMS/OWL/RDF/RDFS/SKOS, matching `CoreVocab`; PROV and P-Plan bindings must therefore be added in an extension or left as full IRIs. (`packages/foundation/modeling/ontology/src/Fold.projections.ts:135-154`; `packages/foundation/modeling/identity/src/Vocab.ts:128-238`)

SPARQL has both an abstract capability and a concrete driver: `SparqlQueryService` accepts a query/profile/dataset and its default layer fails because the capability package wires no engine, while `@beep/oxigraph` lazily creates an Oxigraph store, loads the request dataset, runs the query, and maps SELECT/CONSTRUCT/ASK results. (`packages/foundation/capability/semantic-web/src/services/sparql-query.ts:90-100`; `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:317-319`; `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:365-409`; `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:57-67`; `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:176-207`; `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:209-293`)

That Oxigraph store is request-local, not a persistent triple store, because each execution constructs a new store and loads only the supplied dataset. (`packages/drivers/oxigraph/src/Oxigraph.sparql.ts:176-207`)

There is no live `rdflib` implementation; the only P-Plan occurrence in package source is a Turtle test fixture, so neither P-Plan nor AgentO is currently a modeled production vocabulary. (`packages/ontology/server/test/fixtures/foaf-social-network/graph.ttl:1-12`; `explorations/identity-as-iri/research/repos/rdflib-js.md:1-9`)

The relevant package surfaces are `@beep/rdf`, `@beep/identity`, `@beep/ontology`, `@beep/semantic-web`, `@beep/oxigraph`, and the ontology slice's client/config/domain/server/ui/use-cases packages; this is substantial substrate, but it is not yet one integrated packet knowledge graph. (`packages/foundation/modeling/rdf/package.json:2-5`; `packages/foundation/modeling/identity/package.json:2-5`; `packages/foundation/modeling/ontology/package.json:2-5`; `packages/foundation/capability/semantic-web/package.json:2-5`; `packages/drivers/oxigraph/package.json:2-5`; `packages/ontology/client/package.json:2-5`; `packages/ontology/config/package.json:2-5`; `packages/ontology/domain/package.json:2-5`; `packages/ontology/server/package.json:2-5`; `packages/ontology/ui/package.json:2-5`; `packages/ontology/use-cases/package.json:2-5`)

## 2. Candidate joins

### Ranking by "could be demonstrated in one PR"

| Rank | Candidate | One-PR assessment |
| --- | --- | --- |
| 1 | Packet -> research report provenance | **Possible only as a tightly bounded proof PR**, because both files exist and one live goal names reports, but the canonical manifest decoder strips `researchReports` and no report-instance IRI/provenance schema exists. (`goals/identity-iri-fold/ops/manifest.json:30-48`; `packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:420-468`; `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.schemas.ts:711-735`) |
| 2 | Packet T-Box -> repo ontology T-Box | **Mechanically possible in one PR**, because the ontology fold already accepts relational facts and emits deterministic JSON-LD, but this is ontology self-description rather than the value-bearing A-Box join demanded by Amendment I. (`goals/identity-iri-fold/SPEC.md:84-108`; `packages/foundation/modeling/ontology/src/Fold.projections.ts:357-411`; `explorations/packet-system-redesign/MAP.md:131-135`) |
| 3 | Packet event actor -> identity registry graph | **Possible only after an actor-binding decision**, because packet actors are arbitrary non-empty strings while registry references are exact identity/IRI/CURIE values; no current event supplies that exact key. (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:793-826`; `packages/foundation/modeling/identity/src/IdentityRegistry.ts:20-70`; `packages/foundation/modeling/identity/src/IdentityRegistry.ts:277-304`) |
| 4 | Packet runtime activity/receipt -> evidence span | **Not a one-PR demonstration today**, because evidence anchors/spans exist but `EvidenceReceipt` and its IRI-bearing subject are candidate-4 symbols in a packet that has not been created. (`packages/foundation/modeling/rdf/src/Evidence.ts:243-304`; `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:137-168`; `explorations/packet-system-redesign/MAP.md:175-190`) |

The ranking distinguishes "can emit a triple" from "satisfies the amendment": candidate 2 can prove mapping machinery, but only candidate 1 or 4 could answer a cross-system question that JSON/JQ over packet rows cannot answer alone. (`explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:75-97`)

### Candidate 1 — packet to research-report provenance (closest acceptance proof)

**Exact question:** "Which research reports were declared inputs to `identity-iri-fold`, and which upstream source or exact source span supports the report claim that literal IRI precision should survive until projection?" (`goals/identity-iri-fold/ops/manifest.json:43-48`; `explorations/identity-as-iri/research/20-repo-mining-synthesis.md:1-12`)

**Graphs bridged:** the packet control/provenance graph (packet, plan, projection activity) and a research artifact/evidence graph (report, source ledger, anchored source evidence). The repository already describes the research corpus as reports with their own file:line upstream citations, but has no canonical report graph. (`explorations/identity-as-iri/research/SOURCES.md:1-18`)

**Exact IRIs:** on the packet side, the T-Box class can be composer-owned under the existing `$RepoCliId` path, e.g. `https://ns.beep.sh/repo-cli/commands/Goals/Goals.schemas/GoalManifest`; an instance such as `https://ns.beep.sh/repo-cli/packet/goals/identity-iri-fold` is a **proposed** runtime IRI, not a current contract. (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:18-26`; `packages/foundation/modeling/identity/src/packages.ts:28-48`; `packages/foundation/modeling/identity/src/Id.ts:378-405`)

On the research side, a content-addressed IRI such as `https://ns.beep.sh/artifact/sha256/<report-digest>` and a fragment/annotation IRI such as `https://ns.beep.sh/evidence/sha256/<anchor-digest>` are likewise **proposed** instance IRIs; the ratified synthesis distinguishes composer identities for kinds from digest-minted IRIs for runtime instances but does not yet specify this path grammar. (`explorations/knowledge-endgame/CAPTURE.md:94-108`; `explorations/knowledge-endgame/CAPTURE.md:126-133`)

**Artifacts supplying each side today:** `goals/identity-iri-fold/ops/manifest.json` names `20-repo-mining-synthesis.md`, the report states the claim and its report-section sources, and the packet's `SOURCES.md` describes the source ledger. (`goals/identity-iri-fold/ops/manifest.json:43-48`; `explorations/identity-as-iri/research/20-repo-mining-synthesis.md:1-12`; `explorations/identity-as-iri/research/SOURCES.md:11-18`)

**Missing:** `GoalManifest` strips `researchReports`; there is no `ResearchReport`/`ResearchSource`/report-claim schema, no report-instance IRI mint, no content digest in the manifest, and no structured span for the report's section-style citations. (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:420-468`; `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.schemas.ts:711-735`; `explorations/identity-as-iri/research/20-repo-mining-synthesis.md:1-12`)

**Minimum worked acceptance fixture:** decode the real `identity-iri-fold` manifest without losing its four `researchReports`, mint deterministic packet/report IRIs from an explicitly ratified instance-mint rule, emit `prov:used` from one packet projection activity to `20-repo-mining-synthesis.md`, connect that report to one `EvidenceTarget`, load the packet and evidence datasets into the existing Oxigraph service, and assert the named report plus its exact quote/offset answer. (`goals/identity-iri-fold/ops/manifest.json:43-48`; `packages/foundation/modeling/rdf/src/Evidence.ts:243-304`; `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:176-293`)

This is the recommended definition of **one real join**, but it is not specifiable as an implementation contract until the missing typed manifest field, instance-IRI grammar, and source-anchor representation are decided. (`packages/tooling/tool/cli/src/commands/Goals/Bootstrap.schemas.ts:711-735`; `explorations/knowledge-endgame/CAPTURE.md:94-108`)

### Candidate 2 — packet schema classes to ontology classes (easy but insufficient)

**Exact question:** "Which repo-owned packet schema classes are PROV/P-Plan subclasses, and which are equivalent to AgentO design-time terms?" The existing mapping report, for example, places agent kinds under `prov:Agent`, workflow patterns under `pplan:Plan`, and workflow steps under `pplan:Step`. (`explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:21-34`)

**Graphs bridged:** the packet schema T-Box and the ontology package's assembled T-Box; this does not join packet instances to report/evidence/ontology instances. (`packages/foundation/modeling/ontology/src/Fold.models.ts:138-175`; `packages/foundation/modeling/ontology/src/Fold.projections.ts:290-355`)

**Exact IRIs:** a live packet class already has the composer-derived IRI shape `https://ns.beep.sh/repo-cli/commands/Goals/PacketCore/PacketCore.schemas/PacketTraceEntry`; proposed new classes could point by full IRI to `http://www.w3.org/ns/prov#Activity`, `http://purl.org/net/p-plan#Step`, and `http://www.w3id.org/agentic-ai/onto#WorkflowStep`. (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:18-25`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1304-1322`; `packages/foundation/modeling/rdf/src/Vocab/Prov.ts:25-76`; `explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:14-34`)

**Artifacts supplying each side today:** packet schema handles and composer IRIs exist, and the ontology fold accepts explicit subject/predicate/object tuples and emits external fact subjects in JSON-LD. (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:18-25`; `packages/foundation/modeling/ontology/src/Fold.models.ts:138-175`; `packages/foundation/modeling/ontology/src/Fold.projections.ts:324-355`)

**Missing:** there are no P-Plan/AgentO vocabulary modules, no ratified packet-to-standard class mapping, and the current packet event classes lack `SemanticSchemaMetadata`; moreover, `PacketTraceEntry` is a projected event copy, not automatically a `prov:Activity`. (`packages/foundation/modeling/identity/src/Vocab.ts:128-238`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1304-1322`; `explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:36-50`)

**One-PR verdict:** this can demonstrate deterministic T-Box output, but it does not meet Amendment I's own justification because it answers only a vocabulary-mapping question. (`explorations/packet-system-redesign/MAP.md:131-135`)

### Candidate 3 — packet actor to registered agent identity

**Exact question:** "Is the actor recorded on this packet event the same software-agent identity registered in the semantic-web identity dataset, and what fibers describe it?" (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:793-826`; `packages/foundation/modeling/identity/src/IdentityRegistry.ts:81-143`)

**Graphs bridged:** the packet runtime-event graph and the identity-registry RDF dataset. (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:899-905`; `packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts:203-236`)

**Exact IRIs:** the registry side already uses each `IdentityEntry.iri` as the RDF subject, e.g. the documented `https://ns.beep.sh/semantic-web/Example`; the packet side has no actor IRI because `PacketEventActor` is only a checked string such as `operator`. (`packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts:211-236`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:793-826`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1291-1297`)

**Artifacts supplying each side today:** packet events retain actor strings verbatim in `PacketTraceEntry`, and `IdentityRegistry` plus `IdentityRdfBinding` can resolve and serialize exact identities. (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketFold.ts:348-360`; `packages/foundation/modeling/identity/src/IdentityRegistry.ts:277-304`; `packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts:203-236`)

**Missing:** an actor schema that carries an exact `IdentityRef`, a migration/default for legacy `operator` strings, and actual registered entries for the agents that wrote the events. (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:793-826`; `packages/foundation/modeling/identity/src/IdentityRegistry.ts:41-70`; `explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:54-73`)

**One-PR verdict:** possible as a synthetic fixture, but not a real fleet join until at least one live event actor is identity-bound; changing the event wire shape would also invoke the packet upcaster/golden-replay law. (`explorations/packet-system-redesign/MAP.md:263-266`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:27-33`)

### Candidate 4 — packet evidence receipt to exact evidence span (best eventual join, currently gated)

**Exact question:** "Which exact source-text span proves the digest-bound evidence receipt that makes this packet closed, and which runtime activity generated that evidence?" Candidate 4 is chartered to make landed-versus-closed derivable from digest-bound receipts. (`explorations/packet-system-redesign/MAP.md:175-176`; `explorations/packet-system-redesign/MAP.md:185-190`)

**Graphs bridged:** the future packet closure/runtime PROV graph and the existing RDF/epistemic evidence graph. (`explorations/packet-system-redesign/MAP.md:123-135`; `packages/foundation/modeling/rdf/src/Evidence.ts:243-304`; `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:55-71`)

**Exact IRIs:** Amendment I proposes reusing a receipt/activity IRI for PROV `Activity`/`Generation`, while the evidence side can already carry an `EvidenceAnchor.id` and `EvidenceTarget.source` as IRIs; no exact packet receipt IRI or cross-field is defined today. (`explorations/packet-system-redesign/MAP.md:123-135`; `packages/foundation/modeling/rdf/src/Evidence.ts:243-304`)

**Artifacts supplying each side today:** `TextAnchor` fixes an exact half-open character range plus quote, `EvidenceSpan` adds confidence, `Evidence` persists the span, and the RDF Web Annotation adapter converts `EvidenceTarget` without making Web Annotation mandatory. (`packages/foundation/modeling/provenance/src/TextAnchor.ts:1-10`; `packages/foundation/modeling/provenance/src/TextAnchor.ts:48-70`; `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:106-168`; `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:55-71`; `packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:435-496`)

**Missing:** every packet-side object in the join—`EvidenceSubject`, `EvidenceReceipt`, merged-commit seal, proof-cache key, receipt-to-anchor relation, and its minting rule—is only in candidate 4's future significant-symbol ledger. (`explorations/packet-system-redesign/MAP.md:175-190`)

**One-PR verdict:** no; implementing this now would pull candidate-4 machinery across the core packet's explicit scope fence, so it must follow candidate 4's schema decision rather than preempt it. (`goals/packet-control-plane-core/SPEC.md:71-80`)

### Join conclusion

One real join is not "a SPARQL query over packet nodes" or "an `owl:equivalentClass` triple"; it is a query whose answer requires a packet-side edge and a separately modeled report/evidence-side edge keyed by the same deterministic IRI. (`explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:75-97`; `explorations/knowledge-endgame/CAPTURE.md:83-116`)

The repository can specify the target acceptance question now—candidate 1's packet -> report -> span chain—but cannot yet specify its stable wire contract, because the raw manifest link, runtime IRI grammar, and report/span relation are all outside current typed packet state. (`goals/identity-iri-fold/ops/manifest.json:43-48`; `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.schemas.ts:711-735`; `explorations/knowledge-endgame/CAPTURE.md:94-108`)

## 3. Collision check

### 3.1 Direct duplication and dependency inside packet-system work

1. **Candidate 3 already owns packet projection/migration.** Its mission is to migrate packet state onto the event fold and generated projections, explicitly reusing KSA Workstream D's deterministic single-projector/JSON/Mermaid/static-HTML contract; its significant-symbol ledger already reserves `PacketProjector`, `PacketProjection`, `sourceTip`, and `projectorVersion`. (`explorations/packet-system-redesign/MAP.md:169-176`; `explorations/packet-system-redesign/MAP.md:185-190`)
2. **Workstream D already forbids divergent semantic projectors.** One deterministic normalized projection feeds JSON, Mermaid, and the dashboard, and the design document repeats that renderers may not invent their own semantics. (`goals/knowledge-surface-automation/SPEC.md:197-206`; `goals/knowledge-surface-automation/research/p4-goals-projection-design.md:7-14`)
3. **Therefore Amendment I may add a renderer, not a second packet fold/compiler.** A separate RDF fold over raw manifests/events would duplicate candidate 3 and create semantic drift; JSON-LD must consume the same normalized `PacketProjection` as the other renderers. (`explorations/packet-system-redesign/MAP.md:173-176`; `goals/knowledge-surface-automation/SPEC.md:201-206`)
4. **Candidate 4 owns the runtime evidence half.** `EvidenceSubject`, `EvidenceReceipt`, `ProofCacheKey`, closure derivation, and the merged-commit seal are already its future ledger, so Amendment I depends on those identifiers and must not invent a parallel receipt schema. (`explorations/packet-system-redesign/MAP.md:175-190`)
5. **The current core explicitly fences candidates 2/3/4 out.** Its acceptance excludes fleet migration and closure receipts, and its stop condition says pulling candidate-2/3/4 machinery into the slice breaks scope. (`goals/packet-control-plane-core/SPEC.md:62-80`)
6. **`PacketProjector` is not live yet.** The implemented surface is `foldPacketEvents` plus `projectPacketTrace`; candidate 3 and candidate 4 directories do not exist in the current charter, which itself labels both proposed slugs "not yet created." (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketFold.ts:293-346`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketFold.ts:362-401`; `explorations/packet-system-redesign/MAP.md:173-176`)

### 3.2 Semantic contradictions to resolve before ratification

1. **Exploration-node collision:** KSA Workstream D says explorations are not graph nodes and graduation is represented only by provenance edges, whereas Amendment I's phrase "packet graph" could be read as making goal and exploration packets peers. The amendment must adopt the KSA rule explicitly or amend it openly. (`goals/knowledge-surface-automation/SPEC.md:219-224`; `explorations/packet-system-redesign/MAP.md:123-135`)
2. **Address-channel collision:** composer annotations are the single owned address channel, while `SemanticSchemaMetadata` is documentation; Amendment I's current phrase "IRIs ... carried as `SemanticSchemaMetadata`" is contradictory unless rewritten as two separate channels. (`explorations/identity-as-iri/DECISIONS.md:63-81`; `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:291-305`)
3. **Instance-mint gap:** the identity fold ratified compile-time composer IRIs for kinds, while the knowledge-endgame capture distinguishes those from digest-minted runtime instances; Amendment I currently gives no instance grammar for packets, events, reports, receipts, or spans. (`goals/identity-iri-fold/SPEC.md:81-114`; `explorations/knowledge-endgame/CAPTURE.md:94-108`)
4. **Design-time/runtime boundary:** AgentO intentionally does not model executions, calls, loops, or runtime trace facts, while packet events and PROV supply that layer; an `owl:equivalentClass` mapping must be limited to true conceptual identity and must not equate a design-time AgentO step with a runtime `prov:Activity`. (`explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:36-50`; `explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:92-97`)
5. **Raw-manifest collision:** the proposed join relies on `researchReports`, `currentSourceOfTruth`, provenance, and launcher/work-plan material, but canonical `GoalManifest` currently strips unknown keys and types none of those fields. (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:420-468`; `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.ts:158-189`)
6. **Freshness collision:** current `sourceTip` proves only the event stream tip, while Amendment I would also read manifest/report/ontology artifacts; treating `sourceTip` alone as graph freshness would silently trust stale non-event inputs. (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketFold.ts:318-345`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1324-1371`)

### 3.3 Knowledge-endgame overlap

`knowledge-endgame` contains almost the same join-layer thesis and explicitly names Amendment I's one-cross-graph-join acceptance, but it is parked at capture and says the existing portfolio carries the critical path. (`explorations/knowledge-endgame/README.md:3-27`; `explorations/knowledge-endgame/CAPTURE.md:83-133`)

The operator parked it on 2026-08-25 to avoid opening another front; H/I/J rulings are reopen triggers, not authority to absorb the capture into Amendment I. (`explorations/knowledge-endgame/DECISIONS.md:8-38`)

Amendment I therefore **depends on and duplicates the thesis**, but must borrow only the validated distinctions—kind versus instance identity, graph-as-projection, redaction, and joins—not the unratified federation/platform scope. (`explorations/knowledge-endgame/CAPTURE.md:94-133`; `explorations/knowledge-endgame/DECISIONS.md:14-32`)

### 3.4 What was killed, what was parked, and what is live

**Killed/superseded design, 2026-07-02:** the old `ontology-modeling-foundation` authoring API (`Ontology.create`, identity wrapper, synonym-heavy string references) was declared dead and superseded because it remained authoritative-looking and contradicted the composer/fold design. (`explorations/identity-as-iri/research/12-audit-goals-supersession.md:1-16`; `explorations/identity-as-iri/DECISIONS.md:147-158`)

That was **not** a rejection of ontology projection: the retained interop roadmap says the old authoring surface is dead prior art while `@beep/ontology` continues to own assembly/projections and `@beep/semantic-web` owns runtime semantic services. (`goals/ontology-interop-roadmap/README.md:18-38`)

**Parked donor harvest, 2026-07-14:** `effect-ontology-harvest` was parked align-complete with zero goals because live packages are authoritative, the audit had a waived/incomplete review surface, and every possible port requires item-level re-verification when a demand gate fires. (`explorations/effect-ontology-harvest/README.md:3-21`; `explorations/effect-ontology-harvest/README.md:31-35`; `explorations/effect-ontology-harvest/DECISIONS.md:32-76`; `explorations/effect-ontology-harvest/DECISIONS.md:78-107`)

**Completed replacement fold:** `identity-iri-fold` is completed-retained; it shipped `Ontology.fold` and pure JSON-LD/context/Turtle/Markdown projections, making that substrate the current implementation rather than the killed API. (`goals/identity-iri-fold/README.md:3-14`; `goals/identity-iri-fold/README.md:34-39`; `goals/identity-iri-fold/PLAN.md:9-14`)

**Completed semantic runtime/workbench:** the ontology workbench completed its Oxigraph SPARQL/reasoning phase and its validation/provenance phase, including a PROV-O journal export; Amendment I may reuse the driver but does not need to reopen the workbench. (`goals/ontology-workbench/PLAN.md:3-16`)

**Completed agent surface:** `ontology-agent-surface` is completed-retained and already requires caller identity to survive into each change-log entry so PROV-O exports contain the correct `prov:Agent` and association; this is reusable attribution precedent and a possible future foreign graph, not packet-projector scope. (`goals/ontology-agent-surface/README.md:3-14`; `goals/ontology-agent-surface/SPEC.md:86-98`; `goals/ontology-agent-surface/PLAN.md:13-18`)

**Other parked ontology work:** `ontology-curation-governance` and `ontology-lifecycle-qa` were both parked at capture on 2026-08-17 with explicit roadmap resume triggers; their concerns are mutation review/quarantine and versioned SHACL witness lifecycle, not packet JSON-LD. (`explorations/ontology-curation-governance/README.md:3-19`; `explorations/ontology-curation-governance/README.md:27-29`; `explorations/ontology-lifecycle-qa/README.md:3-19`; `explorations/ontology-lifecycle-qa/README.md:27-29`)

**Adjacent but not an authority for this lane:** `semantica-lab` graduated on 2026-08-24 into its own canary/driver goals and keeps five graph/reasoning candidates gated for later re-entry, so Amendment I should not silently absorb its knowledge-graph roadmap. (`explorations/semantica-lab/README.md:3-29`)

**Active semantic package work:** `semantic-foundation` is active with M1 complete and M2-M4 gated; its graph-is-projection doctrine excludes a dedicated graph database and requires `https://ns.beep.sh/` IRIs. (`goals/semantic-foundation/README.md:3-15`; `goals/semantic-foundation/README.md:38-49`; `goals/semantic-foundation/SPEC.md:73-91`)

Its source exploration deliberately moved shared vocabulary work out of an older IP-law graph-store direction, and its v1 explicitly excludes SPARQL engine wiring and graph-store adoption. (`explorations/legal-ontology-landscape/DECISIONS.md:3-20`; `explorations/legal-ontology-landscape/DECISIONS.md:85-98`)

**Conclusion:** semantic-web/ontology work was not generally killed; one obsolete authoring API was superseded, one upstream harvest was parked, and the live fold, identity registry, semantic services, ontology slice, and semantic-foundation packet remain valid dependency surfaces. (`goals/ontology-interop-roadmap/README.md:18-38`; `goals/identity-iri-fibered/README.md:33-38`; `goals/semantic-foundation/README.md:3-15`)

## 4. Cost to build and keep green

### 4.1 The real implementation envelope

Amendment I is not "one serializer" because it crosses the normalized packet projection, identity vocabulary, research/evidence inputs, and runtime query harness. (`explorations/packet-system-redesign/MAP.md:123-135`; `goals/knowledge-surface-automation/SPEC.md:197-206`)

1. **One shared semantic input model.** Extend candidate 3/Workstream D's normalized packet projection with the manifest/work-plan/event/evidence references JSON-LD needs, rather than re-decoding and refolding raw files in an RDF-specific path. (`explorations/packet-system-redesign/MAP.md:173-190`; `goals/knowledge-surface-automation/SPEC.md:197-206`)
2. **Typed packet semantic classes and vocabulary.** Add repo-owned packet `Plan`/`Step`/`Activity`/`Association` classes with composer-owned IRIs; add explicit PROV/P-Plan vocabulary support; author RDFS/OWL/AgentO mappings as fold triples, not metadata address fields. (`packages/foundation/modeling/identity/src/Id.ts:716-782`; `packages/foundation/modeling/ontology/src/Fold.models.ts:138-175`; `explorations/identity-as-iri/DECISIONS.md:63-92`)
3. **Typed join inputs.** At minimum, promote `researchReports` into the canonical manifest model or a separately canonical provenance input, and define deterministic report/source/span identity; candidate 4 later supplies receipts rather than Amendment I inventing them. (`packages/tooling/tool/cli/src/commands/Goals/Bootstrap.schemas.ts:711-735`; `explorations/packet-system-redesign/MAP.md:175-190`)
4. **A distinct projection envelope.** The graph output needs its own `schemaVersion` and `projectorVersion`, plus event `sourceTip` and an input fingerprint covering manifest/work-plan/report/ontology bytes; current trace freshness only compares event tip and projector version. (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1249-1274`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1324-1371`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketFold.ts:403-444`)
5. **A deterministic JSON-LD renderer.** Reuse the ontology projection's sorting/assembly principles or its emitted model, preserve byte identity for identical inputs, and keep full-IRI fallback for vocabularies not in the compacting registry. (`packages/foundation/modeling/ontology/src/Fold.projections.ts:1-7`; `packages/foundation/modeling/ontology/src/Fold.projections.ts:135-175`; `goals/identity-iri-fold/SPEC.md:99-108`)
6. **One executable join acceptance.** Load the packet graph plus the separately emitted report/evidence graph into the existing request-local Oxigraph driver and assert the exact cross-graph answer; this is an integration proof, not a new persistent store. (`packages/drivers/oxigraph/src/Oxigraph.sparql.ts:176-293`; `explorations/packet-system-redesign/MAP.md:131-135`)

### 4.2 Verification cost

The minimum green suite must cover composer IRI/CURIE literals and collision rejection, SemanticSchemaMetadata presence without deprecated address fields, PROV/P-Plan/AgentO mapping triples, deterministic JSON-LD bytes under shuffled input order, fork behavior, stale input detection for event and non-event sources, and the real join fixture. (`packages/foundation/modeling/identity/test/OntologyEntrypoints.test.ts:44-80`; `packages/foundation/modeling/rdf/test/InteropAndMetadata.test.ts:64-81`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketFold.ts:293-345`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketFold.ts:403-444`)

If packet event or manifest wire shapes change, the lane also pays the existing version/upcaster/golden-replay cost; events require versioned evolution, and manifest adoption already preserves unknown keys specifically because naive decode/encode loses them. (`packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:27-33`; `explorations/packet-system-redesign/MAP.md:263-266`; `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.schemas.ts:711-735`)

The `ProvRdf` codec cannot remove this cost because it rejects `Plan`/other extension records and lifecycle adjuncts; using it would first require widening and testing the codec, while the ontology fold already provides the more appropriate T-Box JSON-LD path. (`packages/foundation/modeling/rdf/src/ProvRdf.ts:482-567`; `packages/foundation/modeling/rdf/src/ProvRdf.ts:440-455`; `packages/foundation/modeling/ontology/src/Fold.projections.ts:357-411`)

### 4.3 Ongoing maintenance cost

Every change that alters graph bytes for a previously valid input bumps the graph projector version, retires old projections, and regenerates them; rung 2 established that projections are disposable and never upcast. (`goals/packet-control-plane-core/PLAN.md:75-87`; `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketCore.schemas.ts:1249-1274`)

The lane must keep mappings synchronized with packet schema evolution, candidate 3's normalized model, candidate 4 receipt identity, identity vocabulary/codegen, and any selected P-Plan/AgentO version; AgentO revision 0.2 is explicitly suitable as a mapping target but not as an internal identifier authority. (`explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:46-50`; `explorations/packet-system-redesign/research/2026-08-25-agento-ontology-mapping.md:135-150`)

Committed per-packet graph files would add review churn across the fleet, whereas a disposable on-demand/fleet artifact preserves D8 and avoids treating generated JSON-LD as a second writer. (`explorations/packet-system-redesign/DECISIONS.md:293-305`; `explorations/packet-system-redesign/MAP.md:257-268`)

The honest delivery shape is at least two changes after candidate 3 exists—semantic/identity contract plus renderer/join proof—and likely a third when candidate 4 supplies runtime receipts; folding all three into candidate 3/4 ratification now would conceal unresolved contracts already assigned to separate owners. (`explorations/packet-system-redesign/MAP.md:169-190`)

## 5. Recommended disposition

**Split into its own exploration/proof lane gated on proving one join; do not ratify Amendment I into candidates 3/4 as written.** The current wording contains an address-channel contradiction, a missing runtime IRI grammar, an untyped research link, and a dependency on a not-yet-created receipt model. (`packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:291-305`; `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.schemas.ts:711-735`; `explorations/packet-system-redesign/MAP.md:175-190`)

The reshaped lane should have this entry gate: candidate 3 exposes one normalized packet projection; the `researchReports` edge is typed without losing legacy manifest keys; and a ratified kind-versus-instance mint rule names packet, report, source, activity, and anchor resources. (`goals/knowledge-surface-automation/SPEC.md:197-206`; `packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:420-468`; `explorations/knowledge-endgame/CAPTURE.md:94-108`)

Its exit proof should be one real `identity-iri-fold` fixture answering candidate 1's question across two independently supplied graphs, with the exact packet/report/source-span IRIs asserted and Oxigraph used only as the query harness. (`goals/identity-iri-fold/ops/manifest.json:43-48`; `packages/foundation/modeling/rdf/src/Evidence.ts:243-304`; `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:176-293`)

If that fixture cannot be built without inventing candidate 4 receipts or a second semantic projector, reject the lane; if it succeeds, candidate 3 gains the JSON-LD renderer and candidate 4 later reuses the proven instance-IRI/evidence relation. (`goals/packet-control-plane-core/SPEC.md:75-80`; `explorations/packet-system-redesign/MAP.md:123-135`; `explorations/packet-system-redesign/MAP.md:173-190`)

# Text knowledge pipeline and agent-facing contracts

Read-only code assessment, 2026-11-08. Citations are repository-relative path:line references. Recommendations and negative findings based on search are explicitly labeled. No packages were installed, no servers or experiments launched, and no repository files changed. The requested scratchpad is the only output location.

## 1. Inventory

**Semantica.** This is a headless-first construction canary for document-to-KG processing, with a deliberately minimal web shell and no reusable exports. Its README still says the stages throw `StageNotImplemented`, although runtime source wires C0, C1 and C2 implementations: treat that paragraph as stale documentation, not current execution evidence. Inputs are manifest-verified W1 papers and committed F1 fixtures; outputs include grounded evidence, ledger snapshots, vector/RDF projections and reasoner/evaluation witnesses. The layers separate acquisition (`DocumentSourceLive`), parsing (`ParserLive`), text identity/verification (`CanonicalizerLive`), exact slicing (`ChunkerLive`), hosted/pattern extraction (`ExtractorLive`), provider caching, PGlite ledger, embeddings, DuckDB vector projection, Oxigraph RDF projection, reasoning, gold-source evaluation and C0/C1/C2 orchestration. Key contracts are `SourceDocument`, `ParseOutcome`, `ResolvedSourceText`/`CanonicalText`, `Chunk`, `EvidenceClaim`, `EvidenceBatch`, `LedgerSnapshot`. Sources: `apps/labs/semantica/README.md:3`, `apps/labs/semantica/README.md:21`, `apps/labs/semantica/README.md:37`, `apps/labs/semantica/src/runtime/Layer.ts:48`, `apps/labs/semantica/src/runtime/Layer.ts:84`, `apps/labs/semantica/src/runtime/Layer.ts:107`, `apps/labs/semantica/src/layers/CanaryC0Live.ts:317`.

**Langextract.** The provider-neutral service accepts `LangExtractRequest` with document ID, text, targets and examples; renders a prompt; calls an injected Effect `LanguageModel`; parses candidates; aligns them to source; and returns `LangExtractResult` containing raw text, `GroundedExtraction[]`, diagnostics and an NLP handoff. Alignment is a discriminated family of exact/lesser/minimal-fold/fuzzy/unaligned results, with aligned results carrying `matchedText` and a `Contract.Span`. A separate `VerifiedSpan` family handles explicitly unit-tagged offsets, raw chunks, candidate-to-anchor receipts, failure stages and verification/re-anchor history. The ordinary extraction service does **not** call that stricter verification path; it calls `alignCandidates` and `toAnnotatedDocument`. Sources: `packages/foundation/capability/langextract/src/Service/Service.layer.ts:58`, `packages/foundation/capability/langextract/src/Service/Service.layer.ts:87`, `packages/foundation/capability/langextract/src/Extraction/Extraction.model.ts:180`, `packages/foundation/capability/langextract/src/Extraction/Extraction.model.ts:400`, `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.model.ts:462`.

**Nlp-processing.** This package owns executable NLP capabilities rather than just text models. `NLPBackend` describes interchangeable backend operations and explicit unsupported-operation errors. Its tool family includes tokenization, entities, sentences, sentence chunks, statistics, similarity, keywords, transformations and corpus operations; `NlpToolkit` combines those tool contracts, while drivers supply handlers. Graph operations include an in-memory heterogeneous result cache. Inputs are generally strings and operation-specific parameters; outputs are task-specific schema values or NLP graph nodes, not inherently verified source evidence. Sources: `packages/foundation/capability/nlp-processing/src/Backend/NLPBackend.ts:6`, `packages/foundation/capability/nlp-processing/src/Tools/NlpToolkit.ts:94`, `packages/foundation/capability/nlp-processing/src/Tools/NlpToolkit.ts:145`, `packages/foundation/capability/nlp-processing/src/Tools/ExtractEntities.ts:32`, `packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/ResultStore.ts:6`.

**Wink.** `@beep/wink` implements NLPBackend and NLP tool handlers over one shared wink engine lifecycle. It supports tokens, sentences, POS, lemmas and NER, but advertises no dependency parsing, relations, constituency parsing or coreference. One graph-backend adapter reconstructs entity spans with `indexOf` and assigns confidence 1; the tokenization/tool adapter instead reconstructs offsets by accumulating token text and preceding spaces. These are materially different routes from the same backend name. Sources: `packages/drivers/wink/src/WinkBackend.service.ts:6`, `packages/drivers/wink/src/WinkBackend.service.ts:42`, `packages/drivers/wink/src/WinkBackend.service.ts:54`, `packages/drivers/wink/src/WinkBackend.service.ts:115`, `packages/drivers/wink/src/WinkTokenization.service.ts:154`.

**Oxigraph.** `@beep/oxigraph` is the RDF query driver. `SparqlQueryRequest` brings an immutable RDF dataset into an in-memory native store; stores are memoized by dataset instance, and SELECT/ASK/CONSTRUCT results are converted back into shared RDF/service contracts. This is query execution over a supplied dataset, not evidence-ledger persistence. Sources: `packages/drivers/oxigraph/package.json:2`, `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:187`, `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:263`, `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:311`, `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:92`.

**Graph-3d.** `@beep/graph-3d` is a rendering driver, with `Graph3DProjection` containing typed-array IDs, xyz positions, indexed links, communities, importance, weights and optional labels. It consumes a visual projection, not claims or RDF directly. Inference: semantic identity/evidence must be retained in an external lookup if this becomes a legal-evidence UI. Sources: `packages/drivers/graph-3d/package.json:2`, `packages/drivers/graph-3d/src/Graph3D.projection.ts:62`.

**Practice-KG MCP app.** This app composes the law-practice MCP host with long-lived PGlite and DuckDB resources and strict-tier telemetry. Its 13-tool toolkit exposes clients, docket families, application/matter/correspondent lookup, KG find, corpus text/document access, email search, candidate claims, claim self-check, claim inspection and provenance. The host delegates business logic to law-practice packages. Inputs are typed tool requests plus a validated bundle context; outputs are toolkit-specific responses, not Semantica's `EvidenceBatch`. Sources: `apps/practice-kg-mcp/package.json:2`, `apps/practice-kg-mcp/src/runtime/Host.ts:8`, `apps/practice-kg-mcp/src/runtime/Host.ts:39`, `packages/law-practice/use-cases/src/Tools.ts:38`.

**Trustgraph-workbench.** This app describes itself as a TrustGraph knowledge-graph workbench lab shell. The README specifies an app-local runtime boundary and no public TypeScript exports. Do not infer a working document ingestion or persistent graph pipeline from its package name. Sources: `apps/labs/trustgraph-workbench/package.json:2`, `apps/labs/trustgraph-workbench/README.md:3`, `apps/labs/trustgraph-workbench/README.md:14`.

**Name search scope.** A recursive package.json name search for knowledge/research/intel/graph/kg/extraction/citation/verification/archive located graph-3d and oxigraph in packages, plus practice-kg-mcp and trustgraph-workbench in apps. Mock `pkg-*` fixture names are search false positives. Important implementations live under differently named owners: `semantic-web`, `epistemic`, `ontology`, `law-practice`, and the tooling CLI's Research/Knowledge/Kb commands. Those should not be overlooked by a package-name-only inventory. Evidence for actual owners: `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:325`, `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts:49`, `packages/ontology/use-cases/src/tools/OntologyToolkit.ts:950`, `packages/tooling/tool/cli/src/commands/Research/Library/Library.schemas.ts:703`, `packages/tooling/tool/cli/src/commands/Kb/Kb.service.ts:288`.

## 2. End-to-end trace, with preserved and lost information

The requested chain is not one implemented function composition. The live Semantica path is acquisition → parse → source identity → exact chunks → extraction → app-local evidence ledger → disposable RDF/vector projections. Langextract also produces a generic NLP envelope, but Semantica uses `extracted.success.extractions` instead of that envelope. No direct Semantica → foundation `makeClaimEnvelope` binding was found. The contracts below establish this distinction. Sources: `apps/labs/semantica/src/layers/CanaryC0Live.ts:317`, `apps/labs/semantica/src/layers/ExtractorLive.ts:671`, `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:276`.

| Hop / function | Input → output | Identity, provenance and information change |
| --- | --- | --- |
| `DocumentSource.hashBytes`, `verifyExpectedBytes`, `makeVerifiedDocument` (`apps/labs/semantica/src/layers/DocumentSourceLive.ts:77`, `:89`, `:104`) | Manifest/fixture path and expected byte witness → bytes plus `SourceDocument` | SHA-256 of exact bytes; byte length checked. Document ID must equal SHA-256. Acquisition event ID is derived from canonical ingested-event preimage. The logical document reference is therefore content identity in this lab (`apps/labs/semantica/src/schema/Document.ts:138`, `:147`). |
| `Parser.parseMarkdown` / `parseHtml` / `parsePdf` (`apps/labs/semantica/src/layers/ParserLive.ts:106`, `:114`, `:126`) | `SourceDocument`, `Uint8Array` → `ParseOutcome` = Parsed(text, extractor, document) or Degraded | Markdown is strict UTF-8 decoding; HTML becomes extracted text; PDF uses DocTextFileProcessingEngine with Tika preference. The generic `parsed` constructor keeps text and extractor, not PDF page geometry or HTML node mapping (`:49`, `:86`). Byte-to-text coordinate correspondence is absent from this result. |
| `Canonicalizer.identify` (`apps/labs/semantica/src/layers/CanonicalizerLive.ts:29`) | SourceDocument + parsed outcome → `ResolvedSourceText` | Rehashes parsed text encoded as UTF-8. `SourceTextIdentity` stores scope, sourceRef, relative locator, byte digest, text digest, extractor and normalization version. Lab scope is constant `semantica-canary`, normalization `raw/1` (`:31`). This pins a manifestation, not merely a filename. |
| `Chunker.chunk` (`apps/labs/semantica/src/layers/ChunkerLive.ts:218`) | `CanonicalText` → nonempty `Chunk[]` | Candidate ranges are scanned without rewriting separators. Each chunk retains source-global UTF-16 `TextAnchor`, exact quote, source verification receipt, ordinal/kind, document and content-derived ID. Whitespace outside chunks is omitted from the chunk collection but remains in canonical text (`:182`, `:224`). |
| `makeHostedExtractionRequest`, `LangExtractService.extract` (`apps/labs/semantica/src/layers/ExtractorLive.ts:656`; `packages/foundation/capability/langextract/src/Service/Service.layer.ts:58`) | Canonical whole-document text → prompt → model response → `ExtractionCandidate[]` → `GroundedExtraction[]` | Chunking does not drive hosted requests: the full canonical text is supplied. Prompt asks for copied text and forbids invented offsets; alignment derives offsets locally. Model response becomes candidates; raw generation usage/model-response objects are not included in the returned `LangExtractResult` (`Service.layer.ts:87`, `:106`; `Service.prompt.ts:83`). |
| Optional generic handoff `toAnnotatedDocument` (`packages/foundation/capability/langextract/src/Handoff/Handoff.behavior.ts:86`) | Document ID, text, grounded extractions, generator, timestamp → `Contract.AnnotatedDocument` | Drops unaligned candidates; creates one document-wide chunk; remints chunk/mention/entity IDs from document and array position; uses matched text for mention and candidate text for canonical name. Every aligned label becomes an Entity, including labels semantically intended as relation or structure. Attributes and alignment tier disappear; relations are always empty. Retains optional extraction confidence only on Entity. No source/text digest, extractor pin or verified receipt enters provenance (`:39`, `:87`, `:106`). |
| Optional strict boundary `convertTextOffsetRange` and VerifiedSpan models (`packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.behavior.ts:387`; `VerifiedSpan.model.ts:462`) | Explicit incoming unit/range + source text; candidate association → canonical UTF-16 range and receipt/history contracts | Provides the missing Python/code-point ingress conversion and candidate receipt association. It is not automatically composed into ordinary Service.layer extraction. Do not describe `GroundedExtraction` as an opaque verified-source proof. |
| `groundHostedExtractions` / `makeClaim` (`apps/labs/semantica/src/layers/ExtractorLive.ts:606`, `:241`) | Canonical text, exact chunks, GroundedExtraction[], ModelIdentity, cacheKey → `ExtractOutcome` with `EvidenceBatch` | Re-verifies exact matched anchor against canonical text, assigns containing/overlapping/fallback chunk, converts labels to app ClaimBody, creates content-addressed ClaimId. Missing confidence becomes 1 (`:238`). Unaligned candidates become degradation records. Relations get separately decoded and grounded; fuzzy relation evidence is rejected; endpoints must resolve uniquely inside the evidence quote (`:403`, `:422`, `:493`). |
| App evidence versus foundation epistemics (`apps/labs/semantica/src/schema/Evidence.ts:413`; `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:343`) | App EvidenceClaim ≠ foundation ClaimVersion | Semantica carries body, model, method, confidence, cacheKey and receipt. Its ID preimage excludes confidence, cacheKey and receipt (`Evidence.ts:425`). Foundation envelope adds proposition/logicalKey, supporting/challenging assertions, valid and knowledge time, supersession, review and five separate evidence signals. No automatic promotion or assertion binding is established by this app. `EvidenceSpan` contributes the shared Confidence vocabulary here, not the whole claim envelope. |
| `Ledger.appendDocument` / `appendBatch` (`apps/labs/semantica/src/layers/CanaryC0Live.ts:341`, `:350`; `layers/LedgerLive.ts:119`, `:161`) | Documents, outcomes, canonical text, chunks, claims, events → PGlite rows | Schema encoding plus canonical JSON produces payload and another SHA-256 digest. Read decodes original contracts; indexed columns are a small subset. Event recorded time is persisted separately. |
| `RdfProjection.rebuild` / `claimQuads` (`apps/labs/semantica/src/layers/RdfProjectionLive.ts:66`, `:111`) | LedgerSnapshot → RDF Dataset + serialized quads and triples | Re-mints claim/chunk/batch graph IRIs under Semantica's identity. Projects only claim type/chunk, entity label, structure role, relation subject/object/predicate text. Omits exact quote/range/receipt, confidence, model/method, timestamps, entity type/cluster and structure depth. Named graph carries batch ID. Serialized triples omit the graph component (`:118`). |
| `RdfProjection.query` / Oxigraph (`apps/labs/semantica/src/layers/RdfProjectionLive.ts:126`; `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:187`) | Dataset + SELECT expectations → sorted serialized rows / `SparqlResultWitness` | In-memory query store is recreated or memoized per dataset, not the authoritative ledger. Literal/node values are serialized for witnesses. |
| Vector and reasoner consumers (`apps/labs/semantica/src/runtime/Layer.ts:84`, `:107`) | Snapshot-derived embedding/projection services → vector/reasoning witnesses | DuckDB is explicitly `:memory:` in the lab runtime. C2 receives C1, RDF and ReasonerLive. These are canary consumers; no direct claim-review UI is wired by this runtime. |

There is no JSON-LD hop in Semantica's inspected source. `@beep/rdf/JsonLd` supplies bounded JSON-LD value/document schemas independently; Semantica rebuild uses quads and term serialization. Inference: JSON-LD publication would need an explicit context and evidence-preserving projection contract, not merely a new serializer. Sources: `packages/foundation/modeling/rdf/src/JsonLd.ts:1`, `apps/labs/semantica/src/layers/RdfProjectionLive.ts:111`.

## 3. Offset representations and their units

| Representation | Unit / interval / coordinate frame | Evidence and caveat |
| --- | --- | --- |
| SourceDocument bytes / source digest | Bytes; count, not text range | `apps/labs/semantica/src/schema/Document.ts:142`; byte witness checked at `layers/DocumentSourceLive.ts:98`. UTF-8 hashing does not imply byte-based text anchors. |
| Parser text | JS string with no original artifact location map in Parsed constructor | `apps/labs/semantica/src/layers/ParserLive.ts:49`. PDF/HTML transformation changes coordinate space. |
| Provenance TextAnchor | Nonempty half-open `[startChar,endChar)`, zero-based UTF-16 code units, exact quote width | `packages/foundation/modeling/provenance/src/TextAnchor.ts:52`, `:74`, `:96`, `:172`. Verifier rejects split surrogate pairs/out-of-range and quote mismatch (`VerifiedTextAnchor.ts:649`, `:655`). |
| Semantica candidate/chunk | Canonical-text-global UTF-16 half-open ranges | Scanner uses `charCodeAt` and `String.length`; quote uses `slice(start,end)` (`apps/labs/semantica/src/layers/ChunkerLive.ts:37`, `:190`, `:224`). |
| NLP Handoff Span | Explicit half-open zero-based UTF-16 units into source text | `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:261`. Mention description says "within a chunk" (`:399`), but generic handoff only creates a whole-document chunk, so that adapter cannot expose a local/global discrepancy. Recommendation: name the coordinate frame explicitly before multi-chunk adapters are added. |
| Langextract MatchedText / GroundedExtraction | UTF-16 start + matched text; converted to half-open Contract.Span | `packages/foundation/capability/langextract/src/Alignment/Alignment.model.ts:84`, `:304`, `:348`; `Extraction/Extraction.model.ts:187`. Fuzzy-window score cannot be recovered from matched slice and must be recomputed (`Alignment.model.ts:382`). |
| VerifiedSpan TextOffsetRange | Explicit `unicode-code-point` or `utf16-code-unit`; nonempty half-open range | `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.model.ts:42`, `:93`, `:124`. |
| VerifiedSpan canonical Utf16TextRange | Inclusive UTF-16 start, exclusive UTF-16 end | `VerifiedSpan.model.ts:130`. Conversion walks code points and adds width 1 or 2; bounds/surrogate checks fail closed (`VerifiedSpan.behavior.ts:320`, `:340`, `:403`). |
| VerifiedSpan normalized locator maps | Raw UTF-16 range behind each normalized code unit; normalization clusters are half-open raw UTF-16 ranges | `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.normalization.ts:39`, `:129`, `:157`. These are normalization clusters, not a declaration that public anchors use grapheme indices. |
| EvidenceSpan | Same half-open UTF-16 anchor plus confidence, max quote width 65,536 units | `packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:75`, `:107`, `:119`. Structural consistency alone does not resolve a source. |
| Wink token char bounds | Half-open JS/UTF-16 bounds re-derived from preceding spaces plus token text length | `packages/drivers/wink/src/WinkTokenization.service.ts:154`. Sentence token ranges use inclusive final token index (`:108`, `:245`). |
| Wink AiEntity bounds | start/end character bounds from first/last token; token end index inclusive | `packages/drivers/wink/src/WinkTools.service.ts:284`; inclusive token endpoint selected at `:265`. Fallbacks to zero/text length can manufacture a location if token metadata is absent. |
| Wink graph EntityNode span | JS `indexOf` and length, half-open; first matching occurrence, or `[0,needle.length)` on absence | `packages/drivers/wink/src/WinkBackend.service.ts:54`, `:126`. No source proof. |
| Wink sentence chunks | Inclusive start/end sentence indices; `charCount` is UTF-16 length of newly assembled text | `packages/drivers/wink/src/WinkTools.service.ts:475`, `:509`, `:526`. Trims sentences and joins with spaces; original source char ranges are not returned. |

Python ingress: the assignment identifies langextract as a Google langextract port. Inference from Python string indexing: Python-origin offsets need a declared code-point unit rather than blindly entering JS `slice`. The repository already has the correct explicit conversion hook, demonstrated with `A😀B`; it does not assume all incoming ranges are UTF-16 (`VerifiedSpan.behavior.ts:376`). The ordinary prompt avoids offset imports entirely by requesting copied text and deriving matches in TypeScript (`Service/Service.prompt.ts:85`). No byte-range or grapheme-index converter was found in the inspected strict-span family; its closed unit literals enumerate only two units (`VerifiedSpan.model.ts:42`).

## 4. IRI construction and registry opportunities

The complete requested regex hits are preserved in the appendix below, including fixtures, documentation examples, ordinary GitHub URLs, unrelated BASE variables and filesystem paths. This is a reproducible lexical inventory, not a claim that each hit is a runtime RDF term. The following classifies the actual construction families observed in those hits.

| Construction family | Location | Registry assessment |
| --- | --- | --- |
| Semantica namespace BASE | `apps/labs/semantica/src/layers/RdfProjectionLive.ts:26` | Already derives authority from `$SemanticaId.iri`; do not misreport this as a hardcoded beep domain. |
| `ontology/${term}` | same file `:41` | Accepts any string; lacks a closed Semantica term registry. A lab-owned vocabulary would constrain term names and keep definitions with their constructors. |
| EvidenceClaim, EntityClaim, RelationClaim, StructureClaim; sourceChunk, label, role, predicateText | same file `:48`–`:55` | Custom Semantica meanings, not automatically equivalent to PROV/OA/RDFS. CoreVocab cannot supply these local terms today. A dedicated registry could; mapping `label` to RDFS requires an explicit semantic decision. |
| `claim/${id}`, `chunk/${id}`, `provenance/batch/${id}` | same file `:59`–`:61` | Instance-resource minting, not vocabulary enumeration. Needs typed constructors and a stable encoding/identity policy; a prefix registry alone is insufficient. |
| `predicate/${claim.id}` | same file `:79` | Per-claim predicate resource. Same predicate text across claims produces different predicates. Recommendation: distinct assertion ID and relation-vocabulary IRI; do not use the occurrence ID as relation identity. |
| RDF type, subject, predicate, object; XSD string | same file `:43`–`:47` | CoreVocab RDF/XSD namespaces and rdf vocab modules can supply namespaces; `RDF_TYPE` is already exported. Not every desired RDF constant necessarily has a named convenience export. Sources: `packages/foundation/modeling/identity/src/Vocab.ts:130`, `:181`; `packages/foundation/modeling/rdf/src/Vocab/Rdf.ts:15`, `:38`. |
| Pizza tutorial `https://beep.example/ontology/tutorial/pizza#` | `packages/ontology/use-cases/src/aggregates/Session/Session.pizza-tutorial.ts:17` | Tutorial example namespace. Register as tutorial-specific if reused; do not replace its domain with a production legal ontology automatically. |
| ciops / ciops-prov `https://oip.law/ontology/...#` | `apps/labs/ciops/src/projection/Turtle.ts:17`, `:18` | Operational ontology prefixes. Separate owner should define/register these; no evidence they are CoreVocab terms. |
| Hardcoded test-utils semantic annotation IRIs | `packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:23`, `:55`, `:65`, `:121`, `:131`, `:141`, `:151` | Identity composer could supply owned symbol/field IRIs. These are actual metadata declarations, despite the test-kit package name. |
| IdentityAuthority | `packages/foundation/modeling/identity/src/Id.ts:77` | Canonical authority definition; preserve as owner rather than replacing it through its own registry. |
| PublicOrigin, HostedUrl documentation examples | `packages/foundation/modeling/public-site/src/PublicOrigin.schema.ts:32`; `HostedUrl.schema.ts:335` | Website routes, not RDF terms. Public-site owns their constructors; CoreVocab would be the wrong owner. |
| Microsoft GRAPH_BASE_URL/API URLs and GitHub conformance-source pins | `packages/drivers/m365/src/M365.config.ts:31`; `packages/foundation/modeling/html/src/internal/conformance/Html.conformance-source-registry.ts:122` | Service endpoints and provenance source URLs. They should remain service/config or source-registry concerns; RDF vocab cannot substitute. |

Inference: centralizing *authority syntax*, *vocabulary definitions*, *instance identity*, and *HTTP route construction* into one registry would conflate four contracts. The existing split between identity, RDF vocabulary helpers and public-site routes is useful; local projection code needs to consume it more consistently. Sources supporting the distinct roles: `identity/src/Vocab.ts:2`, `rdf/src/Vocab/Rdf.ts:15`, `public-site/src/HostedUrl.schema.ts:335`, `semantica/src/layers/RdfProjectionLive.ts:59` (all under the full package/app prefixes given above).

## 5. What agents can use today

**Schema → tools.** NLP tools are real `effect/ai/Tool` definitions with parameter schema, encoded success schema and typed failure (`ExtractEntities.ts:82` under `packages/foundation/capability/nlp-processing/src/Tools/`). `NlpToolkit` combines those definitions (`Tools/NlpToolkit.ts:145`). MCP publication goes through `sanitizedToolkit`; its `toolJsonSchema` uses `S.toJsonSchemaDocument`, selects excess-property behavior, controls reference policy and includes `$defs`. NLP MCP mounts both NLP and streaming/file-IO toolkits on a stdio MCP server with Wink handlers (`packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:294`; `packages/drivers/nlp-mcp/src/Server.ts:110`). This is stronger than informal tool descriptions: codecs remain the execution boundary. Inference: cross-field source/digest verification cannot be conveyed by JSON Schema alone and must remain an explicit tool/service behavior.

**Schema → prompts.** Langextract uses schemas to encode few-shot example envelopes, but the output JSON shape itself is handwritten prose. Target names/kinds, attributes and descriptions are rendered into text. Semantica injects the frozen predicate literals into relation instructions and hashes a descriptor containing rendered prompt and relation alignment/endpoint policy. The prompt contract is therefore partly derived, partly maintained manually; it is not generated from the full GroundedExtraction or epistemic schema (`packages/foundation/capability/langextract/src/Service/Service.prompt.ts:19`, `:27`, `:39`, `:83`; `apps/labs/semantica/src/layers/ExtractorLive.ts:103`, `:152`, `:180`).

**Source → docs.** Root `bun run docgen` invokes `beep docgen local --full`; `docgen:local` omits full scope (`package.json:367`). The repository owns its docgen tool (`packages/tooling/tool/docgen/package.json:2`). Checker recognizes a titled `**Example** (...)` followed by a TypeScript fence, and enforces examples where configured (`src/Checker.ts:19`, `:67`). Core extracts example files, writes a temporary compilation project, runs TypeScript on them and cleans up (`src/Core.ts:218`). Printer emits Markdown example blocks (`src/Printer.ts:133`). Presence/typechecking helps agent copyability; it does not prove a claim's source grounding, lawfulness, or end-to-end behavior. The stale Semantica README illustrates that distinction (`apps/labs/semantica/README.md:21`; `src/runtime/Layer.ts:107`).

**Skills.** Search of `.claude/skills/**/SKILL.md` found no literal references to `@beep/nlp`, `@beep/rdf`, `langextract`, `nlp-processing`, `epistemics`, or `semantica` as package-oriented usage recipes. Related skills explain ontology authoring, PROV-O and provenance ledgers generically: `.claude/skills/ontology-architect/SKILL.md:92`, `.claude/skills/ontology-conceptualizer/SKILL.md:91`, `.claude/skills/ontology-scout/SKILL.md:46`, `.claude/skills/explore/SKILL.md:66`. This is a search-bounded negative finding, not proof that no reference exists in skill reference files. Recommendation: provide an executable source→verified anchor→candidate claim recipe rather than adding more architecture prose.

**MCP and actual consumers.** The relevant server families include NLP MCP, law-practice KG, ontology config/server and desktop ontology transport; adjacent drivers also mount government-legal, USPTO and M365 toolkits. Direct evidence: `packages/drivers/nlp-mcp/src/Server.ts:110`; `apps/practice-kg-mcp/src/runtime/Host.ts:39`; `packages/ontology/use-cases/src/tools/OntologyToolkit.ts:782`; `apps/professional-desktop/server/OntologyMcpTransport.ts:1`; server search results in the appendix. Ontology toolkit exposes inspection, snapshots, search, SPARQL, change proposal, validation, repair, export/publish provenance and capability metadata (`OntologyToolkit.ts:782`–`:950`). Practice toolkit exposes evidence/provenance retrieval and claim checks (`packages/law-practice/use-cases/src/Tools.ts:38`). Thus "tools agents can use" already includes operational MCP contracts, not merely future plans.

**Thin boundary.** Search found no single exposed tool that accepts the full `SourceTextIdentity` and returns a foundation ClaimVersion with verified assertion links while preserving the same source manifestation through NLP and RDF. This is an inference from the inspected contract split, not a claim about every MCP tool in the repository. The immediate gap is a composed evidence contract and recipe, not lack of MCP plumbing (`langextract/src/Handoff/Handoff.behavior.ts:87`; `semantica/src/schema/Evidence.ts:413`; foundation `epistemics/src/Claim/Claim.model.ts:343`, with full package prefixes as above).

## 6. Research intake is another evidence system

Research packets are immutable after merge; corrections use later packets, with a specific retired-Effect-import exception. `claims.jsonl` and the single-writer ledger are authoritative; digests and DuckDB indexes are derived. Scraped text is sanitized before disk and quarantined in fenced excerpts. Research/search synthesis is blinded to the checkout; only the publisher writes the new packet plus ledger. Machine suggestions do not auto-create explorations or goals; human admission imports a source. Sources: `research/README.md:14`, `:24`, `:29`, `:32`, `:36`, `:41`, `:47`.

The packet layout includes REPORT, SOURCES, SUGGESTED_ACTIONS, PROMPT, claims.jsonl and RUN.json; RUN includes success/partial/timed-out status, window, usage, novelty and frictions (`research/README.md:14`). The concrete historical findings carry `schema: beep.research.finding/v0`, ID, axis, kind, `window_new`, refute flags/refute_of/collides_with, delta, url/extra_urls, title, free-text claim, excerpt, tags, source_date, watchlist_ids and suggested_capture (`research/2026-10-09/claims.jsonl:1`). These are observed record shapes, not a verified current TypeScript validator. The SPEC explicitly planned Research-local version-one schemas (`goals/nightly-research-routine/SPEC.md:71`). I did not locate the nightly v0 validator in the inspected Research command family, so cannot assert it validates every shipped packet today.

Those rows do not serialize the foundation epistemic ClaimVersion, nor do their excerpts carry exact TextAnchor + SourceTextIdentity. This follows from comparing the observed row fields with `supportedBy`, knowledge/valid intervals, review/signals in `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:343`, and the manifestation requirements in `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:125`. Their scholarly assertions have not been independently verified in this audit; the rows are evidence of repository modeling only.

The newer research library has its own `LibraryFinding`: string IDs for source/occurrence/capture/document/modelRun, CiTO relation, a **string** `span`, summary, topics and recordedAt. Several provenance references default to empty strings. It has semantic annotations but still does not reuse exact-anchor or ClaimVersion shape (`packages/tooling/tool/cli/src/commands/Research/Library/Library.schemas.ts:703`). Recommendation: retain discovery-specific fields while binding findings to a shared capture/manifestation and verified location contract; do not force a raw web discovery into an accepted epistemic claim.

## 7. Persistence versus in-memory contracts

| Store / owner | Persisted shape | Relationship to foundation contracts |
| --- | --- | --- |
| Semantica PGlite ledger | documents(id,digest,payload); parse_outcomes(id,document,digest,payload); chunks(id,document,digest,payload); claims(id,batch,document,lane,digest,payload); batches(id,document,lane,digest,payload); events(id,digest,payload,recorded_at); conflicts(id,left_claim,right_claim,digest,payload) | Payload is schema-encoded canonical JSON, with a payload digest. Read decodes schema. These are hand-written SQL tables, not a Drizzle projection of foundation ClaimVersion. `apps/labs/semantica/src/layers/LedgerLive.ts:63`, `:94`, `:184`, `:218`. Data directory is ledgerRoot/runId/mode (`:268`). |
| Semantica RDF | Dataset + serialized quads/triples, passed to Oxigraph | Disposable projection rebuilt from ledger. Native stores memoized in memory; no persistent triple-store path in this driver. `apps/labs/semantica/src/layers/RdfProjectionLive.ts:111`, `:173`; `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:197`, `:314`. |
| Semantica vectors | DuckDB in-memory database | Runtime explicitly selects `:memory:`; authoritative evidence remains ledger. `apps/labs/semantica/src/runtime/Layer.ts:84`. |
| Epistemic Evidence rows | ProductEntity metadata plus artifactFixtureKey, spanFixtureKey and EvidenceSpan JSONB | Drizzle generated with `toPgTable(Evidence)`; preserves quote/range/confidence but this row alone has no SourceTextIdentity or verified receipt. `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:56`; `packages/epistemic/tables/src/entities/Evidence/Evidence.table.ts:26`. |
| Epistemic CandidateClaim rows | ProductEntity metadata plus fixtureKey, lifecycle and `Record<string,unknown>` snapshot JSONB | More weakly typed than foundation ClaimVersion; persistence accepts arbitrary snapshot fields. `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts:49`; `packages/epistemic/tables/src/entities/CandidateClaim/CandidateClaim.table.ts:26`. |
| Other epistemic tables | EdgeVersion, EvidenceVerification, ClaimDisposition, Contradiction, UsageRecord and shared schema exports | Separate application persistence family; do not equate EvidenceClaim from the lab with every product epistemic row. `packages/epistemic/tables/src/Schema.ts:1`; entity table modules under `packages/epistemic/tables/src/entities/`. |
| Ontology documents | Root-relative .ttl files through filesystem sidecar store | Session parser/serializer maps file text to RDF datasets and back. Separate from extracted claims ledger. `packages/ontology/server/src/aggregates/Session/Session.file-store.ts:2`, `:46`; `Session.layer.ts:44`, `:50`. |
| NLP operation cache | in-memory Ref<HashMap>, results generalized through unknown | Annotation/operation state is not automatically durable. `packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/ResultStore.ts:6`. |
| Practice host | App-owned PGlite and DuckDB resources | Law-practice toolkit consumes those resources, not the Semantica runtime ledger by construction. `apps/practice-kg-mcp/src/runtime/Host.ts:16`, `:39`. |
| Research | packet JSONL + ledger; newer LibraryFinding records | Another shape, with URL/excerpt or string span rather than verified anchor. `research/README.md:29`; `packages/tooling/tool/cli/src/commands/Research/Library/Library.schemas.ts:703`. |

Search-bounded observation: there is no demonstrated durable persistence of the generic `Contract.AnnotatedDocument` on the Semantica path; the service returns it, then the app consumes only extractions (`packages/foundation/capability/langextract/src/Service/Service.layer.ts:106`; `apps/labs/semantica/src/layers/ExtractorLive.ts:675`). This does not rule out unrelated consumers elsewhere.

## 8. Ranked boundary defects and contracts that would fix them

These are design findings, not claims that every boundary violates its current local specification. A deliberately lossy view is reasonable if loss is explicit and the source remains retrievable.

1. **RDF projection removes the evidence needed to audit its statements.** It drops anchor/quote/source digest, receipt, producer and confidence; triple serialization also drops named graph. Location: `apps/labs/semantica/src/layers/RdfProjectionLive.ts:66`, `:118`. Contract: `ClaimRdfProjection` returning dataset plus a total assertion→source-manifestation/verified-anchor/activity binding, with declared omitted fields and a ledger resolver. Test evidence round-trip or resolvability, not quad count alone.
2. **No explicit promotion from grounded extraction to epistemic assertion/version.** Lab EvidenceClaim and foundation ClaimVersion model different things; a verified quote is not a reviewed proposition. Locations: `apps/labs/semantica/src/schema/Evidence.ts:413`; `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:343`. Contract: typed promotion that records proposition, assertion ID, supporting anchor, producing activity and Proposed review state; preserve separate confidence/source trust/validation/reviewer signals.
3. **Missing confidence becomes maximal confidence.** Locations: `apps/labs/semantica/src/layers/ExtractorLive.ts:238`, `:722`; `packages/drivers/wink/src/WinkBackend.service.ts:124`. Contract: an absent signal with reason; deterministic-match success and model certainty are separate values. Foundation's five-signal design already provides the right direction (`epistemics/src/Claim/Claim.model.ts:311`).
4. **Generic handoff reinterprets every aligned extraction as an entity and loses relations.** Location: `packages/foundation/capability/langextract/src/Handoff/Handoff.behavior.ts:39`, `:111`. Contract: target-kind-indexed conversion, explicit relation endpoint resolution, structure annotations, diagnostics for unrepresentable candidates, and provenance-preserving source binding. Do not infer relation semantics from a free label alone.
5. **Handoff IDs depend on array order, and provenance has no manifestation identity.** Location: `packages/foundation/capability/langextract/src/Handoff/Handoff.behavior.ts:42`, `:53`, `:87`, `:92`; `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:319`. Contract: stable occurrence IDs from source manifestation + exact anchor + annotation kind, separate entity-resolution identity, and a typed producer activity. Generic timestamp/generator strings do not substitute for the model pin.
6. **Wink graph adapter can invent or conflate locations.** `findSpan` picks first match and defaults to zero on absence; entity output always receives confidence 1. Location: `packages/drivers/wink/src/WinkBackend.service.ts:54`, `:115`. Contract: engine occurrence/token bounds → verified source anchor; ambiguous or missing location becomes a typed failure/unaligned result. Preserve repeat occurrences.
7. **Persisted candidate snapshot admits arbitrary data.** Location: `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts:55`. Contract: versioned discriminated snapshot codec or slice-bound foundation ClaimVersion JSONB codec, with explicit migration and source/assertion references. JSONB storage itself is not the defect; unknown snapshot contents are.
8. **Research evidence cannot be re-sliced against a pinned capture.** Locations: `research/2026-10-09/claims.jsonl:1`; `packages/tooling/tool/cli/src/commands/Research/Library/Library.schemas.ts:703`. Contract: discovery finding → immutable captured manifestation → verified excerpt anchor, with recorded source URL and retrieval activity. Keep nightly novelty/refutation metadata as a separate enrichment.
9. **Alternative chunking destroys source-coordinate composability.** Wink sentence chunks trim and join text, returning sentence indices/charCount rather than a source map. Location: `packages/drivers/wink/src/WinkTools.service.ts:475`, `:526`. Semantica's containingChunk also silently selects overlap or first chunk when no full containment exists (`apps/labs/semantica/src/layers/ExtractorLive.ts:224`). Contract: distinguish source slices from synthesized display chunks; carry origin maps or multi-chunk coverage, and make fallback assignment explicit.
10. **Relation predicate identity is minted from claim identity.** Location: `apps/labs/semantica/src/layers/RdfProjectionLive.ts:79`. Contract: typed relation-vocabulary IRI independent of assertion occurrence, plus app vocabulary registration for the projection terms. Keep quoted predicate text as evidence; it must not be the only route to relation semantics.

### Appendix: complete lexical IRI/URL search receipts

The following receipts preserve all hits for the requested searches. Tests/examples are included intentionally. Findings above distinguish actual runtime minting from other text. Line citations in these receipts point to the inspected checkout, not an external source.

#### Interpolated BASE matches

```text
packages/drivers/m365/test/M365.write.test.ts:56:const MAILBOX_URL = `${GRAPH_BASE_URL}/users/${MAILBOX}`;
packages/drivers/m365/test/M365.write.test.ts:352:        expect(A.map(captures, (capture) => capture.url)).toStrictEqual([`${GRAPH_BASE_URL}/me/messages`]);
packages/drivers/m365/test/M365.service.test.ts:100:const METADATA_URL = `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/items/${ITEM_ID}?$select=id%2Cname%2Csize%2Cfile%2Cfolder%2C%40microsoft.graph.downloadUrl`;
packages/drivers/m365/test/M365.service.test.ts:226:    url: `${GRAPH_BASE_URL}/sites/${SITE_ID}/drives`,
packages/drivers/m365/test/M365.service.test.ts:230:    url: `${GRAPH_BASE_URL}/sites?search=legal%20docs`,
packages/drivers/m365/test/M365.service.test.ts:234:    url: `${GRAPH_BASE_URL}/sites/${SITE_ID}`,
packages/drivers/m365/test/M365.service.test.ts:238:    url: `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/root/delta`,
packages/drivers/m365/test/M365.service.test.ts:242:          "@odata.deltaLink": `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/root/delta?token=abc`,
packages/drivers/m365/test/M365.service.test.ts:254:    url: `${GRAPH_BASE_URL}/sites/${SITE_ID}/lists/list-id/items/7?$expand=fields`,
packages/drivers/m365/test/M365.service.test.ts:264:    url: `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/items/${ITEM_ID}/versions`,
packages/drivers/m365/test/M365.service.test.ts:268:    url: `${GRAPH_BASE_URL}/me/messages?$filter=receivedDateTime%20ge%202026-01-01&$top=2`,
packages/drivers/m365/test/M365.service.test.ts:272:    url: `${GRAPH_BASE_URL}/me/messages/message-id`,
packages/drivers/m365/test/M365.service.test.ts:276:    url: `${GRAPH_BASE_URL}/users/user-id/events?$top=3`,
packages/drivers/m365/test/M365.service.test.ts:280:    url: `${GRAPH_BASE_URL}/users/user-id/events/event-id`,
packages/drivers/m365/test/M365.service.test.ts:340:      url: `${GRAPH_BASE_URL}/me/drives`,
packages/drivers/m365/test/M365.service.test.ts:386:      url: `${GRAPH_BASE_URL}/me/drives`,
packages/drivers/m365/test/M365.service.test.ts:460:        expect(A.map(captures, (capture) => capture.url)).toContain(`${GRAPH_BASE_URL}/sites/${SITE_ID}/drives`);
packages/drivers/m365/test/M365.service.test.ts:557:          `${GRAPH_BASE_URL}/users/user-id/messages/message-id?$select=subject,from,receivedDateTime,webLink`,
packages/drivers/m365/test/M365.service.test.ts:558:          `${GRAPH_BASE_URL}/me/messages/message-id`,
packages/drivers/m365/test/M365.service.test.ts:590:        const untrustedDeltaLink = `${GRAPH_BASE_URL}.evil.tld/drives/${DRIVE_ID}/root/delta?token=abc`;
packages/drivers/m365/test/M365.service.test.ts:594:          return url === `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/root/delta`
packages/drivers/m365/test/M365.mail.test.ts:46:const MAILBOX_URL = `${GRAPH_BASE_URL}/users/${MAILBOX}`;
packages/drivers/m365/src/M365.config.ts:31: * const drivesUrl = new URL(`${GRAPH_API_BASE_URL}/me/drives`)
packages/drivers/openclaw/src/Openclaw.config.ts:285:    onSome: (nodeBinDir) => `${nodeBinDir}:${HERMETIC_BASE_PATH}`,
packages/tooling/tool/cli/test/yeet-siblings.test.ts:90:    if (A.contains(args, "rev-parse")) return { stdout: `${BASE_SHA}\n`, exit: 0 };
packages/tooling/tool/cli/test/yeet-review-lane.test.ts:65:const at = (minute: number): string => `${BASE}${Str.padStart(2, "0")(`${minute}`)}:00.000Z`;
packages/tooling/tool/cli/test/yeet-merged-preview.test.ts:69:    `100644 ${BASE_SHA} 1\tgoals/INDEX.md`,
packages/tooling/tool/cli/test/yeet-merged-preview.test.ts:126:    assertNone(gitObjectIdFromOutput(`error: duplicate parent ${BASE_SHA} ignored`));
packages/tooling/tool/cli/test/yeet-final-check.test.ts:582:          `git diff --no-color --no-ext-diff --unified=0 --find-renames=50% --end-of-options ${BASE} HEAD -- old/test/moved.test.ts new/test/moved.test.ts`
packages/tooling/tool/cli/test/yeet-final-check.test.ts:788:      yield* fs.writeFileString(path.join(dir, `${BASE}.json`), "{not json");
packages/drivers/github-actions/src/internal/runnerFile.ts:44:  return longestRun < 0 ? BASE_DELIMITER : `${BASE_DELIMITER}${Str.repeat(longestRun + 1)("_")}`;
packages/law-practice/server/test/DocketIntake.graph.test.ts:58:const MAILBOX_URL = `${GRAPH_BASE_URL}/users/${MAILBOX}`;
packages/tooling/library/repo-workspaces/test/integration/ConfigDependencyFetch.int.test.ts:124:  vi.stubEnv("FAKE_PNPM_PUBLISHED", `{"${NAME}@0.11.1":"${BASE_SRI}"}`);
packages/tooling/library/repo-workspaces/test/integration/ConfigDependencyFetch.int.test.ts:155:  yield* commit("inline-only", `0.11.1+${BASE_SRI}`, undefined);
packages/tooling/library/repo-workspaces/test/integration/ConfigDependencyFetch.int.test.ts:222:        assert.include(run?.lockfile, `resolution: {integrity: "${BASE_SRI}"}`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:41:export const semanticaOntologyIri = <const Term extends string>(term: Term) => `${BASE}ontology/${term}` as const;
apps/labs/semantica/src/layers/RdfProjectionLive.ts:48:const EVIDENCE_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/EvidenceClaim`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:49:const ENTITY_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/EntityClaim`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:50:const RELATION_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/RelationClaim`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:51:const STRUCTURE_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/StructureClaim`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:52:const CHUNK = Rdf.makeNamedNode(`${BASE}ontology/sourceChunk`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:53:const LABEL = Rdf.makeNamedNode(`${BASE}ontology/label`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:54:const ROLE = Rdf.makeNamedNode(`${BASE}ontology/role`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:55:const PREDICATE_TEXT = Rdf.makeNamedNode(`${BASE}ontology/predicateText`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:59:const claimNode = (id: string) => Rdf.makeNamedNode(`${BASE}claim/${id}`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:60:const chunkNode = (id: string) => Rdf.makeNamedNode(`${BASE}chunk/${id}`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:61:const graphNode = (id: string) => Rdf.makeNamedNode(`${BASE}provenance/batch/${id}`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:79:        quad(claim, graph, RDF_PREDICATE, Rdf.makeNamedNode(`${BASE}predicate/${claim.id}`)),
packages/tooling/tool/cli/src/commands/Knowledge/KnowledgeDoctor.service.ts:2107:      .pipe(KnowledgeOperationalError.mapError(`Failed to write ${KNOWLEDGE_DOCTOR_BASELINE_PATH}.`));
packages/tooling/tool/cli/src/commands/Knowledge/KnowledgeDoctor.baseline.ts:1339:      message: `${KNOWLEDGE_DOCTOR_BASELINE_PATH} differs from the re-mint at ${minted.mintedAt} (${A.length(
packages/tooling/library/ai-metrics/test/sequence-break.test.ts:1269:if [ -n "\${BEEP_SEQUENCE_BREAK_NTFY_BASE_URL:-}\${BEEP_SEQUENCE_BREAK_NTFY_TOPIC:-}\${BEEP_SEQUENCE_BREAK_NTFY_TOKEN:-}" ]; then
packages/tooling/library/ai-metrics/test/sequence-break.test.ts:1278:if [ -n "\${BEEP_SEQUENCE_BREAK_NTFY_BASE_URL:-}\${BEEP_SEQUENCE_BREAK_NTFY_TOPIC:-}\${BEEP_SEQUENCE_BREAK_NTFY_TOKEN:-}" ]; then
packages/tooling/library/ai-metrics/test/sequence-break.test.ts:1281:case " $* " in *" ${NTFY_BASE_URL}/ "*) ;; *) exit 101 ;; esac
packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:1608:  yield* Console.log(`[goals:doctor] wrote ${GOALS_DOCTOR_BASELINE_PATH} with ${A.length(blocking)} finding key(s).`);
packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:1621:    yield* Console.error(`[goals:doctor] ${GOALS_DOCTOR_BASELINE_PATH} does not parse as JSONC.`);
packages/tooling/tool/cli/src/commands/Goals/Adopt.ts:276:  Str.Equivalence(relativePath, `history/reflections/${REFLECTION_TEMPLATE_BASENAME}`);
packages/tooling/tool/cli/test/knowledge-doctor-mint.test.ts:255:    const rule = (name: string) => `baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:${name}`;
packages/tooling/tool/cli/test/knowledge-doctor-baseline.test.ts:444:        const nonRemoval = `baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:non-removal`;
packages/tooling/tool/cli/test/knowledge-doctor-baseline.test.ts:467:          `baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:removed`,
packages/tooling/tool/cli/test/knowledge-doctor-baseline.test.ts:485:          `baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:mint-diff-not-baseline-only`,
packages/tooling/tool/cli/test/knowledge-doctor-baseline.test.ts:491:          [`baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:mint-not-reproducible`]
packages/tooling/tool/cli/test/knowledge-doctor-baseline.test.ts:497:          [`baseline-tamper:${KNOWLEDGE_DOCTOR_BASELINE_PATH}:minted-at-not-ancestor`]
packages/tooling/tool/cli/test/knowledge-doctor-baseline.test.ts:860:        const stdout = `$ bun run beep\n{"schemaVersion":"knowledge-doctor-leases-report/v1","tree":"${MINTED}","mergeBase":"${MERGE_BASE}","now":"2026-10-14T00:00:00.000Z","leases":[{"key":"${expiring.key}","document":"docs/a.md","owner":"@kriegcloud","expires":"2026-10-18T00:00:00.000Z","status":"${rows[0]?.status ?? ""}","violations":[],"details":[]}]}\n`;
packages/tooling/tool/cli/test/knowledge-doctor-baseline.test.ts:872:        const stdout = `{"schemaVersion":"knowledge-doctor-leases-report/v1","tree":"${MINTED}","mergeBase":"${MERGE_BASE}","now":"2026-10-14T00:00:00.000Z","leases":[]}`;
packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts:314:    `[lane-proof] reuse disabled: ${LANE_BASE_REF} moved from the run's pinned base ${shortSha(pinned.value)} to ${shortSha(laneBase)}`
packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:1274:      onNone: () => O.some(`${COVERAGE_BASELINE_PATH}: row for ${packageName} names no workspace package`),
packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:1278:          : O.some(`${COVERAGE_BASELINE_PATH}: row for ${packageName} names a package that cannot be measured`),
packages/tooling/tool/cli/test/ci-lane.test.ts:1733:        expect(workflow).toContain('shape_args+=(--affected --base "origin/${GITHUB_BASE_REF:-main}")');
packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:796:      `Scoped ${COVERAGE_WRITE_BASELINE_ARG} runs require exact --filter=<workspace-package> selectors or --affected; Turbo ranges and --since cannot provide verifier-equivalent coverage shards.`
packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:812:      `Scoped ${COVERAGE_WRITE_BASELINE_ARG} selectors must name exact workspace packages that define coverage. Unsupported selector(s): ${A.join(unsupportedSelectors, ", ")}.`
packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1030:      `${COVERAGE_REPLACE_ALL_ARG} requires ${COVERAGE_WRITE_BASELINE_ARG}; it only controls coverage baseline replacement.`
packages/tooling/tool/cli/test/check-census-gate.test.ts:346:        `check-census gate failed: no baselined program was selected (--filter "__no_such_row__", baseline ${CHECK_CENSUS_BASELINE_PATH}).`
packages/tooling/tool/cli/test/check-census-command.test.ts:261:      expect(loggedSince8).toContain(`wrote ${CHECK_CENSUS_BASELINE_PATH}`);
packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalLawLanes.ts:294:  extends: `${normalizePathSeparators(repoRoot)}/${REPO_TSCONFIG_BASE_FILE}`,
packages/tooling/tool/cli/src/commands/Quality/CheckCensusGate.ts:123:    `// Re-measure every row with one command: ${CHECK_CENSUS_BASELINE_WRITE_COMMAND}`,
packages/tooling/tool/cli/src/commands/Quality/CheckCensusGate.ts:890:        `FAIL compiler changed: baseline measured with ${report.baselineCompiler}, this run used ${report.compiler}; counts are not comparable. Re-measure with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\`.`,
packages/tooling/tool/cli/src/commands/Quality/CheckCensusGate.ts:909:      `tighten ${comparison.name}: single-checker instantiations dropped by ${comparison.baseline.instantiations - comparison.current.instantiations}; lock the gain in with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\`.`
packages/tooling/tool/cli/src/commands/Quality/CheckCensusGate.ts:1391:      `Failed to read ${absolutePath}; create it with \`${CHECK_CENSUS_BASELINE_WRITE_COMMAND}\`.`
packages/tooling/tool/cli/test/ci-runner-security.test.ts:1426:      assert.include(workflowText, 'shape_args+=(--affected --base "origin/${GITHUB_BASE_REF:-main}")');
packages/tooling/tool/cli/src/commands/Laws/EntityKitFreeze.ts:433:    .pipe(EntityKitFreezeExecutionError.mapError(`Failed to stat ${ENTITY_KIT_FREEZE_BASELINE_PATH}`));
packages/tooling/tool/cli/src/commands/Laws/EntityKitFreeze.ts:440:    onReadError: () => EntityKitFreezeExecutionError.new(`Failed to read ${ENTITY_KIT_FREEZE_BASELINE_PATH}.`),
packages/tooling/tool/cli/src/commands/Laws/EntityKitFreeze.ts:443:        `Failed to decode ${ENTITY_KIT_FREEZE_BASELINE_PATH} as an ${ENTITY_KIT_FREEZE_RULE_ID} baseline.`
packages/tooling/tool/cli/src/commands/Laws/EntityKitFreeze.ts:463:    onError: () => EntityKitFreezeExecutionError.new(`Failed to write ${ENTITY_KIT_FREEZE_BASELINE_PATH}.`),
```

#### HTTP URLs containing beep

```text
apps/professional-desktop/test/tauri-youtube-security.test.ts:71:    expect(webExtensionSource).toContain('#define BEEP_YOUTUBE_APP_REFERER "https://cloud.beep.professional-desktop/"');
apps/professional-desktop/test/packaged-rpc-origin.test.ts:16:    expect(resolveChatRpcHttpUrl(runtimeAt("http://professional-desktop.beep.localhost:1355"))).toBe(
apps/professional-desktop/test/packaged-rpc-origin.test.ts:17:      "http://professional-desktop.beep.localhost:1355/rpc"
apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts:44:export const allowedOrigin = "http://professional-desktop.beep.localhost:1355";
apps/professional-desktop/src/spikes/Graph3DSpike.tsx:305: * //   http://graph3d-bench.beep.localhost:1355/?graph3d-spike   (or VITE_GRAPH3D_SPIKE=1)
apps/professional-desktop/server/OntologyMcpTransport.ts:67:  "http://professional-desktop.beep.localhost:1355",
packages/tooling/tool/docgen/src/Printer.ts:400: *   projectHomepage: "https://github.com/beep-effect/beep-effect",
packages/tooling/tool/docgen/src/Printer.ts:403: *   srcLink: "https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/docgen/src",
packages/tooling/tool/docgen/src/Printer.ts:500: *   projectHomepage: "https://github.com/beep-effect/beep-effect",
packages/tooling/tool/docgen/src/Printer.ts:503: *   srcLink: "https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/docgen/src",
packages/tooling/tool/docgen/src/Configuration.ts:265: *   projectHomepage: "https://github.com/beep-effect/beep-effect",
packages/tooling/tool/docgen/src/Configuration.ts:268: *   srcLink: "https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/docgen/src",
packages/tooling/tool/docgen/src/Configuration.ts:357: *   projectHomepage: "https://github.com/beep-effect/beep-effect",
packages/tooling/tool/docgen/src/Configuration.ts:360: *   srcLink: "https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/docgen/src",
packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts:253:      "issue": "https://github.com/beep-effect/beep-effect/pull/1067"
packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts:261:      "issue": "https://github.com/beep-effect/beep-effect/pull/1067"
packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts:285:      "issue": "https://github.com/beep-effect/beep-effect/pull/1067"
packages/law-practice/server/test/PracticeKg.projections.test.ts:1131:            "https://beep-effect.com/ns/practice-kg/application/11223344",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1132:            "https://beep-effect.com/ns/practice-kg/application/55667788",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1133:            "https://beep-effect.com/ns/practice-kg/application/76543210",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1134:            "https://beep-effect.com/ns/practice-kg/application/87654321",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1135:            `https://beep-effect.com/ns/practice-kg/docket_family/${fixtureClients.alpha}.20001`,
packages/law-practice/server/test/PracticeKg.projections.test.ts:1136:            "https://beep-effect.com/ns/practice-kg/docket_family/20001",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1137:            `https://beep-effect.com/ns/practice-kg/docket_family/${fixtureClients.beta}.20001`,
packages/law-practice/server/test/PracticeKg.projections.test.ts:1138:            "https://beep-effect.com/ns/practice-kg/document/sha256:1111111111111111111111111111111111111111111111111111111111111111",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1139:            "https://beep-effect.com/ns/practice-kg/document/sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1140:            "https://beep-effect.com/ns/practice-kg/document/sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1141:            "https://beep-effect.com/ns/practice-kg/document/sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1142:            "https://beep-effect.com/ns/practice-kg/document/sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1143:            "https://beep-effect.com/ns/practice-kg/document/sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
packages/law-practice/server/test/PracticeKg.projections.test.ts:1180:            `{"subject_iri":"https://beep-effect.com/ns/practice-kg/application/11223344","predicate":"mentioned_in_family","object_iri":"https://beep-effect.com/ns/practice-kg/docket_family/${fixtureClients.alpha}.20001","epistemic_status":"mention-derived"}`,
packages/law-practice/server/test/PracticeKg.projections.test.ts:1181:            `{"subject_iri":"https://beep-effect.com/ns/practice-kg/application/11223344","predicate":"mentioned_in_family","object_iri":"https://beep-effect.com/ns/practice-kg/docket_family/${fixtureClients.beta}.20001","epistemic_status":"mention-derived"}`,
packages/law-practice/server/test/PracticeKg.projections.test.ts:1182:            '{"subject_iri":"https://beep-effect.com/ns/practice-kg/application/55667788","predicate":"mentioned_in_family","object_iri":"https://beep-effect.com/ns/practice-kg/docket_family/20001","epistemic_status":"mention-derived"}',
packages/law-practice/server/test/PracticeKg.projections.test.ts:1183:            `{"subject_iri":"https://beep-effect.com/ns/practice-kg/application/87654321","predicate":"mentioned_in_family","object_iri":"https://beep-effect.com/ns/practice-kg/docket_family/${fixtureClients.alpha}.20001","epistemic_status":"mention-derived"}`,
packages/law-practice/server/test/PracticeKg.projections.test.ts:1184:            `{"subject_iri":"https://beep-effect.com/ns/practice-kg/docket/${fixtureClients.alpha}.20001US01","predicate":"files_as","object_iri":"https://beep-effect.com/ns/practice-kg/application/87654321","epistemic_status":"derived-from-official-records"}`,
packages/law-practice/server/test/PracticeKg.projections.test.ts:1400:            ["kg_provenance", { iri: "https://beep-effect.com/ns/practice-kg/application/76543210" }],
packages/tooling/tool/cli/test/yeet-wave-rerun.test.ts:97:const url = "https://github.com/beep/repo/pull/7";
packages/tooling/tool/cli/test/yeet-wave-rerun.test.ts:108:    link: `https://github.com/beep/repo/actions/runs/${run}/job/${run}`,
packages/tooling/tool/cli/test/yeet-wave-exempt.test.ts:211:          resolution: YeetAckThreadResolution.make({ url: "https://github.com/beep/repo/pull/7#discussion_r1" }),
packages/tooling/tool/cli/test/yeet-watch-mode.test.ts:137:        link: row.link ?? "https://github.com/beep/beep/actions/runs/1/job/2",
packages/tooling/tool/cli/test/yeet-watch-mode.test.ts:406:                link: "https://github.com/beep/beep/actions/runs/9/job/9",
packages/tooling/tool/cli/test/yeet-watch-mode.test.ts:434:        expect(failing?.link).toBe("https://github.com/beep/beep/actions/runs/9/job/9");
packages/tooling/tool/cli/test/yeet-watch-mode.test.ts:602:            prUrl: "https://github.com/beep/beep/pull/751",
packages/tooling/tool/cli/test/yeet-watch-mode.test.ts:666:          prUrl: "https://github.com/beep/beep/pull/751",
packages/tooling/tool/cli/test/yeet-watch-mode.test.ts:1024:                link: "https://github.com/beep/beep/actions/runs/3/job/4",
packages/tooling/tool/cli/test/yeet-watch-mode.test.ts:1053:          expect(row.capsule.link).toBe("https://github.com/beep/beep/actions/runs/3/job/4");
packages/tooling/tool/cli/test/yeet-watch-mode.test.ts:1537:          html_url: `https://github.com/beep/beep/pull/751#issuecomment-${comment.id}`,
packages/tooling/tool/cli/test/yeet-status-triage.test.ts:265:  url: `https://github.com/beep-effect/beep-effect/pull/1184#discussion_r${databaseId}`,
packages/tooling/tool/cli/test/yeet-status-triage.test.ts:489:      url: "https://github.com/beep-effect/beep-effect/pull/1184",
packages/tooling/tool/cli/test/yeet-status-triage.test.ts:1258:        link: "https://github.com/beep/beep/actions/runs/9/job/9",
packages/tooling/tool/cli/test/yeet-status-chain.test.ts:40:const link = (job: number) => `https://github.com/beep/beep/actions/runs/77/job/${job}`;
packages/tooling/tool/cli/test/yeet-status-chain.test.ts:80:    url: "https://github.com/beep/beep/pull/1311",
packages/tooling/tool/cli/test/yeet-status-chain.test.ts:321:    '"link":"https://github.com/beep/beep/actions/runs/77/job/3","signal":{"bucket":"pass","state":"',
packages/tooling/tool/cli/test/yeet-status-chain.test.ts:335:    'failed`","state":"OPEN","url":"https://github.com/beep/beep/pull/1311"},"runId":"feature_chain-<run>',
packages/tooling/tool/cli/test/yeet-squash-commitlint.test.ts:169:    const url = `* docs: see https://github.com/beep-effect/beep-effect/pull/1915#issuecomment-${Str.repeat(80)("9")}`;
packages/tooling/tool/cli/test/yeet-squash-commitlint.test.ts:267:  html_url: "https://github.com/beep-effect/beep-effect/pull/1913",
packages/tooling/tool/cli/test/yeet-siblings.test.ts:42:  html_url: `https://github.com/beep-effect/beep-effect/pull/${number}`,
packages/tooling/tool/cli/test/yeet-siblings.test.ts:72:    return { body: { id: 1, html_url: "https://github.com/beep-effect/beep-effect/pull/8#issuecomment-1" } };
packages/tooling/tool/cli/test/yeet-settle.test.ts:798:                    prUrl: "https://github.com/beep/repo/pull/1",
packages/tooling/tool/cli/test/yeet-settle.test.ts:1063:                url: "https://github.com/beep/repo/pull/1",
packages/tooling/tool/cli/test/yeet-settle.test.ts:1142:  url: "https://github.com/beep/repo/pull/1",
packages/tooling/tool/cli/test/yeet-scripted-process.test.ts:319:            ["remote get-url --push origin", 0, "https://github.com/beep-effect/beep-effect.git"],
packages/tooling/tool/cli/test/yeet-scripted-process.test.ts:507:              ["git remote get-url --push origin", 0, "https://github.com/fork-owner/beep-effect.git"],
packages/tooling/tool/cli/test/yeet-review-window.test.ts:496:  '{"headRefOid":"abc1234def","id":"PR_window","isDraft":false,"labels":[],"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","number":42,"reviewDecision":null,"state":"OPEN","url":"https://github.com/beep/beep/pull/42"}';
packages/tooling/tool/cli/test/yeet-review-window.test.ts:557:      prUrl: "https://github.com/beep/beep/pull/42",
packages/tooling/tool/cli/test/yeet-resume.test.ts:115:      "https://github.com/beep-effect/beep-effect/pull/43"
packages/tooling/tool/cli/test/yeet-resume.test.ts:120:    decodePrRefResult("https://gitlab.com/beep-effect/beep-effect/pull/42").pipe(Result.isFailure, assertTrue);
packages/tooling/tool/cli/test/yeet-resume.test.ts:409:          options({ ref: decodeRef("https://github.com/beep-effect/beep-effect/pull/99") })
packages/tooling/tool/cli/test/yeet-resume.test.ts:453:          '{"cwd":"/current/repository"}\n{"type":"pr-link","prNumber":42,"prUrl":"https://github.com/beep-effect/beep-effect/pull/42"}\n'
packages/tooling/tool/cli/test/yeet-resume.test.ts:522:            ref: decodeRef("https://github.com/beep-effect/beep-effect/pull/42"),
packages/tooling/tool/cli/test/yeet-resume.test.ts:559:            ref: decodeRef("https://github.com/beep-effect/beep-effect/pull/42"),
packages/tooling/tool/cli/test/yeet-reply-engine.test.ts:497:  url: `https://github.com/YeeBois/beep-effect/pull/558#discussion_${id}`,
packages/tooling/tool/cli/test/yeet-reply-engine.test.ts:868:          url: "https://github.com/YeeBois/beep-effect/pull/558",
apps/practice-claude-mod/src/build-plugin.ts:159:      homepage: "https://github.com/beep-effect/beep-effect/tree/main/apps/practice-claude-mod",
packages/tooling/tool/cli/test/yeet-remediation.test.ts:161:    link: "https://github.com/beep/beep/actions/runs/1/job/2",
packages/tooling/tool/cli/test/yeet-remediation.test.ts:241:  link: "https://github.com/beep/beep/actions/runs/1/job/2",
packages/tooling/tool/cli/test/yeet-remediation.test.ts:425:            expect(entry.capsule.link).toBe("https://github.com/beep/beep/actions/runs/1/job/2");
packages/tooling/tool/cli/test/yeet-ready-gate.test.ts:1319:          `{"headRefOid":"abc1234def","id":"PR_ready","isDraft":true,"labels":[],"mergeable":"MERGEABLE","mergeStateStatus":"DRAFT","number":42,"reviewDecision":null,"state":"${restStatus}","url":"https://github.com/beep/beep/pull/42"}`
packages/tooling/tool/cli/test/yeet-ready-gate.test.ts:1545:            '{"headRefOid":"abc1234def","id":"PR_ready","isDraft":true,"labels":[],"mergeable":"MERGEABLE","mergeStateStatus":"DRAFT","number":42,"reviewDecision":null,"state":"OPEN","url":"https://github.com/beep/beep/pull/42"}',
packages/tooling/tool/cli/test/yeet-ready-gate.test.ts:2040:              html_url: "https://github.com/beep/beep/pull/42",
packages/tooling/tool/cli/test/yeet-push-ack-timeline.test.ts:62:    link: "https://github.com/beep/beep/actions/runs/9/job/9",
packages/tooling/tool/cli/test/yeet-pull-request-lifecycle.test.ts:127:              ? { stdout: "https://github.com/beep-effect/beep-effect.git" }
packages/tooling/tool/cli/test/yeet-provenance-footer.test.ts:279:      restPullRequest({ number: 42, draft, html_url: "https://github.com/beep-effect/beep-effect/pull/42" })
packages/tooling/tool/cli/test/yeet-provenance-footer.test.ts:922:        assertSome(result.url, "https://github.com/beep-effect/beep-effect/pull/42");
packages/tooling/tool/cli/test/yeet-pr-wave-notifier.test.ts:66:const prUrl = "https://github.com/beep/repo/pull/7";
packages/tooling/tool/cli/test/yeet-pr-wave-notifier.test.ts:710:                    link: "https://github.com/beep/repo/actions/runs/7/job/991",
packages/tooling/tool/cli/test/yeet-pr-wave-notifier.test.ts:735:          link: `https://github.com/beep/repo/actions/runs/7/job/${job}`,
packages/tooling/tool/cli/test/yeet-pr-fixtures.ts:68:    prUrl: O.some(options.prUrl ?? `https://github.com/beep-effect/beep-effect/pull/${resolved.pr}`),
packages/ontology/use-cases/src/aggregates/Session/Session.pizza-tutorial.ts:17:const PIZZA_NS = "https://beep.example/ontology/tutorial/pizza#" as const;
packages/tooling/tool/cli/test/yeet-monitor-ready.test.ts:68:const url = "https://github.com/beep/repo/pull/7";
packages/tooling/tool/cli/test/yeet-monitor-ready.test.ts:850:            link: `https://github.com/beep/repo/actions/runs/7/job/${job}`,
packages/tooling/tool/cli/test/yeet-merge-gate.test.ts:1032:        html_url: `https://github.com/beep-effect/beep-effect/pull/${pullFixture.number}#issuecomment-1`,
packages/tooling/tool/cli/test/yeet-merge-gate.test.ts:1114:  html_url: `https://github.com/beep-effect/beep-effect/pull/${pullFixture.number}`,
packages/tooling/tool/cli/test/yeet-inbox.test.ts:52:    link: "https://github.com/beep/beep/actions/runs/1/job/2",
packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts:99:        link: "https://github.com/beep/beep/actions/runs/1/job/2",
packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts:117:        link: "https://github.com/beep/beep/pull/900#discussion_r1",
packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts:531:            url: "https://github.com/beep/repo/pull/7",
packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts:555:        expect(result.stdout).toContain("--thread-url https://github.com/beep/repo/pull/7");
packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts:819:            link: "https://github.com/beep/beep/pull/900",
packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts:828:              link: "https://github.com/beep/beep/pull/900#issuecomment-1",
packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts:858:            "P1 pr-comment [comment-old] PR #900 https://github.com/beep/beep/pull/900#issuecomment-1"
packages/tooling/tool/cli/test/yeet-inbox-hook-adapter.test.ts:861:            "P0 origin/main [conflict-new] PR #900 https://github.com/beep/beep/pull/900"
packages/tooling/tool/cli/test/yeet-gh-rest-first.test.ts:76:  html_url: "https://github.com/beep-effect/beep-effect/pull/1501",
packages/tooling/tool/cli/test/yeet-gh-rest-first.test.ts:350:    htmlUrl: "https://github.com/beep-effect/beep-effect/pull/1501",
packages/tooling/tool/cli/test/yeet-gh-rest-first.test.ts:667:    url: "https://github.com/beep-effect/beep-effect/pull/1#discussion_r1",
packages/tooling/tool/cli/test/yeet-gh-rest-first.test.ts:734:    assertSome(repoSlugFromRemote("https://github.com/beep-effect/beep-effect.git"), "beep-effect/beep-effect");
packages/tooling/tool/cli/test/yeet-gate-table.test.ts:50:  html_url: "https://github.com/beep-effect/beep-effect/pull/1459",
packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts:187:          "https://github.com/sponsors/beep",
packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts:188:          { type: "github", url: "https://github.com/sponsors/beep-effect" },
packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts:220:        "https://github.com/sponsors/beep",
packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts:221:        "https://github.com/sponsors/beep-effect",
packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts:733:        homepage: "https://github.com/beep-effect/beep-effect/tree/main/packages/tooling/library/repo-utils",
packages/tooling/tool/cli/test/yeet-converge.test.ts:60:const url = "https://github.com/beep/repo/pull/7";
packages/tooling/tool/cli/test/yeet-converge.test.ts:64:const link = "https://github.com/beep/repo/actions/runs/11/job/22";
packages/tooling/library/repo-utils/test/schemas/DocgenConfig.test.ts:12:  srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
packages/tooling/tool/cli/test/yeet-check-fidelity.test.ts:39:const link = "https://github.com/beep/beep/actions/runs/9/job/9";
packages/tooling/tool/cli/test/yeet-check-fidelity.test.ts:66:    url: "https://github.com/beep/beep/pull/754",
packages/tooling/tool/cli/test/yeet-base-conflict.test.ts:81:const url = "https://github.com/beep/repo/pull/7";
packages/tooling/tool/cli/test/yeet-base-conflict.test.ts:1062:      YeetAckThreadResolution.make({ url: "https://github.com/beep/repo/pull/7#discussion_r2" })
packages/tooling/tool/cli/test/yeet-artifact-writers.test.ts:315:    prUrl: "https://github.com/YeeBois/beep-effect/pull/560",
packages/tooling/tool/cli/test/worktree-fleet-roots.test.ts:703:      '[remote "origin"]\n\turl = https://github.com/Beep-Effect/beep-effect.git\n\tfetch = +refs/heads/*\n';
packages/tooling/tool/cli/test/worktree-fleet-roots.test.ts:705:    expect(url).toBe("https://github.com/Beep-Effect/beep-effect.git");
packages/tooling/library/repo-utils/src/schemas/DocgenConfig.ts:187: *   srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
packages/tooling/library/repo-utils/src/schemas/DocgenConfig.ts:328: *   srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
packages/tooling/library/repo-utils/src/schemas/DocgenConfig.ts:384: *     srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
packages/tooling/library/repo-utils/src/schemas/DocgenConfig.ts:479:    srcLink: `https://github.com/beep-effect/beep-effect/tree/main/${input.packageRelativePath}/src/`,
packages/tooling/library/repo-utils/src/schemas/DocgenConfig.ts:535: *   srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
packages/tooling/library/qa-capture/test/SessionStore.test.ts:31:      url: "http://storybook.beep.localhost:1355",
packages/tooling/tool/cli/test/tsconfig-sync.test.ts:480:              srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example-use-cases/src/",
packages/tooling/tool/cli/test/tsconfig-sync.test.ts:640:              srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema/src/",
packages/tooling/tool/cli/test/tsconfig-sync.test.ts:656:                "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/identity/claudecode/",
packages/tooling/tool/cli/test/tsconfig-sync.test.ts:695:              "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/identity/claudecode/",
packages/tooling/tool/cli/test/tsconfig-sync.test.ts:766:                  "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema/src/",
packages/tooling/tool/cli/test/tsconfig-sync.test.ts:809:                srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/protocol/src/",
packages/tooling/tool/cli/test/tsconfig-sync.test.ts:1214:  "srcLink": "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/example-docgen/src/",
packages/tooling/library/qa-capture/test/Collector.test.ts:32:const appOrigin = "http://storybook.beep.localhost:1355";
packages/tooling/tool/cli/test/Kb.test.ts:216:      expect(output["dataset.nq"]).toContain("<http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <urn:beep:kb:Claim>");
packages/tooling/library/qa-capture/src/QaCapture.models.ts:453: *   url: "http://storybook.beep.localhost:1355/iframe.html?id=dock-dockviewreact--basic",
packages/tooling/library/qa-capture/src/QaCapture.models.ts:771: *     url: "http://storybook.beep.localhost:1355",
packages/tooling/tool/cli/test/support/YeetGithub.ts:284:    url: "https://github.com/beep-effect/beep-effect/pull/1",
packages/tooling/tool/cli/test/support/YeetGithub.ts:458:  html_url: "https://github.com/beep-effect/beep-effect/pull/7",
packages/tooling/tool/cli/test/skills-relock.test.ts:557:          url: `https://github.com/kriegcloud/beep-effect/pull/${number}`,
packages/tooling/tool/cli/test/runners-bake.test.ts:212:          git.remotes ?? [["origin", "https://github.com/beep-effect/beep-effect.git"]],
packages/tooling/tool/cli/test/runners-bake.test.ts:786:            remotes: [["fork", "https://github.com/someone/beep-effect-fork.git"]],
packages/tooling/tool/cli/test/reviewer.test.ts:120:  html_url: `https://github.com/beep-effect/beep-effect/pull/${number}`,
packages/tooling/tool/cli/src/commands/Yeet/internal/WaveNotifier.ts:640: * console.log(O.isSome(yeetPrWaveRepository("https://github.com/beep-effect/beep-effect/pull/7"))) // true
packages/tooling/library/mcpb-kit/src/McpbKit.package.ts:121:      repository: { type: "git", url: "https://github.com/kriegcloud/beep-effect.git" },
packages/tooling/tool/cli/test/residue-reap.test.ts:2603:    "https://github.com/beep-effect/beep-effect.git",
packages/tooling/tool/cli/test/create-package.test.ts:944:            expect(tauriConf).toContain(`"devUrl": "http://desktop-shell.beep.localhost:1355"`);
packages/tooling/tool/cli/test/create-package-lab.test.ts:741:            expect(tauriConf).toContain(`"devUrl": "http://probe-tauri.labs.beep.localhost:1355"`);
packages/tooling/tool/cli/src/commands/Yeet/internal/Resume.schemas.ts:97: * const ref = S.decodeSync(PrRef)("https://github.com/beep-effect/beep-effect/pull/42")
packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:23:    iri: "https://beep-effect.com/ns/test-utils/Vitest/PositiveTimeoutMillis",
packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:55:        iri: "https://beep-effect.com/ns/test-utils/Vitest/TestContextUnavailable.method",
packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:65:    iri: "https://beep-effect.com/ns/test-utils/Vitest/TestContextUnavailable",
packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:121:        iri: "https://beep-effect.com/ns/test-utils/Vitest/TestHang.lastLogLine",
packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:131:        iri: "https://beep-effect.com/ns/test-utils/Vitest/TestHang.testName",
packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:141:        iri: "https://beep-effect.com/ns/test-utils/Vitest/TestHang.timeoutMillis",
packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:151:    iri: "https://beep-effect.com/ns/test-utils/Vitest/TestHang",
packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts:546: *   prUrl: O.some("https://github.com/beep-effect/beep-effect/pull/42"),
packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts:817: *   prUrl: O.some("https://github.com/beep-effect/beep-effect/pull/42"),
packages/tooling/tool/cli/test/codex-findings-refresh.test.ts:140:      "https://github.com/kriegcloud/beep-effect",
packages/tooling/tool/cli/test/codex-findings-csv.test.ts:34:      "https://github.com/kriegcloud/beep-effect",
apps/labs/semantica/test/Projection.test.ts:352:          "https://beep-effect.com/ns/semantica/ontology/EvidenceClaim"
packages/tooling/tool/cli/src/internal/github/GithubIdentity.ts:421: * console.log(O.getOrElse(repoSlugFromRemote("https://github.com/beep-effect/beep-effect.git"), () => "")) // "beep-effect/beep-effect"
packages/tooling/tool/cli/test/qa-round-pipeline.test.ts:100:      url: "http://storybook.beep.localhost:1355/",
packages/tooling/tool/cli/test/qa-pure.test.ts:145:        `http://storybook.beep.localhost:${PORTLESS_PORT}`
packages/tooling/tool/cli/test/qa-pure.test.ts:148:        `http://kg-scratch.labs.beep.localhost:${PORTLESS_PORT}`
packages/tooling/tool/cli/test/qa-pure.test.ts:180:          expect(target.url).toBe(`http://storybook.beep.localhost:${PORTLESS_PORT}`);
packages/tooling/tool/cli/test/qa-pure.test.ts:195:          expect(target.url).toBe(`http://my-lab.beep.localhost:${PORTLESS_PORT}`);
packages/tooling/tool/cli/test/qa-pure.test.ts:210:          expect(target.url).toBe(`http://my-lab.labs.beep.localhost:${PORTLESS_PORT}`);
packages/tooling/tool/cli/test/qa-pure.test.ts:211:          expect(target.allowedOrigins).toContain(`http://my-lab.labs.beep.localhost:${PORTLESS_PORT}`);
packages/tooling/tool/cli/test/qa-pure.test.ts:227:          expect(portlessUrlForApp(target)).toBe(`http://shared-name.beep.localhost:${PORTLESS_PORT}`);
packages/tooling/tool/cli/test/qa-pure.test.ts:555:        url: "http://storybook.beep.localhost:1355/",
packages/tooling/tool/cli/test/qa-pure.test.ts:855:        url: "http://storybook.beep.localhost:1355/",
packages/tooling/tool/cli/test/qa-pure.test.ts:904:          url: "http://storybook.beep.localhost:1355/",
packages/tooling/tool/cli/test/qa-judge-contract-parity.test.ts:302:      expect(QaJudgeContract.id).toBe("https://beep-effect.com/ns/contracts/qa-inventory/v1");
packages/tooling/tool/cli/test/qa-command.test.ts:308:      url: "http://storybook.beep.localhost:1355/",
packages/tooling/tool/cli/test/proof-job.test.ts:186:    link: `https://github.com/beep/repo/actions/runs/${prNumber}`,
packages/tooling/tool/cli/test/proof-job.test.ts:211:    link: `https://github.com/beep/repo/pull/${prNumber}#issuecomment-${commentId}`,
packages/tooling/tool/cli/test/palantiri-parcels-command.test.ts:169:          link: "https://github.com/beep-effect/beep-effect/pull/1#issuecomment-1",
packages/drivers/openclaw/src/OpenclawIntent.models.ts:393: *   allowedOrigins: ["http://openclaw.beep.localhost:1355"],
packages/tooling/tool/cli/test/owner-checkpoint.test.ts:211:  html_url: "https://github.com/beep-effect/beep-effect/pull/42",
packages/tooling/tool/cli/test/owner-checkpoint.test.ts:1359:          link: ` <https://api.github.com/repos/beep-effect/beep-effect/commits/${head}/check-runs?page=2>; rel="next"`,
packages/tooling/tool/cli/test/owner-checkpoint.test.ts:1611:                  link: `<https://api.github.com/repos/beep-effect/beep-effect/commits/${head}/statuses?page=2>; rel="next"`,
packages/tooling/tool/cli/src/commands/Yeet/internal/ArtifactPaths.ts:125: * console.log(canonicalRepositoryIdentity("https://github.com/beep-effect/beep-effect.git"))
packages/tooling/tool/cli/test/docgen.test.ts:811:        homepage: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema",
packages/tooling/tool/cli/test/docgen.test.ts:856:          projectHomepage: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema",
packages/tooling/tool/cli/test/docgen.test.ts:859:          srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema/src/",
packages/tooling/tool/cli/test/docgen.test.ts:1405:        "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/identity/src/"
packages/tooling/tool/cli/test/docgen.test.ts:4034:            projectHomepage: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema",
packages/tooling/tool/cli/test/docgen.test.ts:4037:            srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/foundation/modeling/schema/src/",
packages/tooling/library/ai-metrics/test/identity-registry.test.ts:202:            originUrl: "https://GitHub.com/beep-effect/beep-effect",
packages/tooling/tool/cli/src/commands/Worktree/internal/FleetRoots.ts:270: * console.log(O.getOrNull(fleetRepositoryFromOriginUrl("https://github.com/Beep-Effect/beep-effect.git"))?.owner)
packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts:1514: *   originUrl: "https://github.com/beep-effect/beep-effect.git",
packages/tooling/tool/cli/src/commands/Skills/SkillsRelock.schemas.ts:403: *   url: "https://github.com/beep-effect/beep-effect/pull/7",
packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1755:  homepage: `https://github.com/beep-effect/beep-effect/tree/main/${packagePath}`,
packages/tooling/tool/cli/src/commands/Goals/ArchiveExecution.service.ts:588: *   archiveUrl: "https://github.com/beep-effect/beep-effect-goals-archive/tree/main/goals/demo",
packages/tooling/tool/cli/src/commands/Goals/ArchiveExecution.service.ts:641: *     archiveUrl: "https://github.com/beep-effect/beep-effect-goals-archive/tree/main/goals/demo",
packages/drivers/exiftool/test/Exiftool.models.test.ts:268:    expect(BEEP_QA_XMP_NAMESPACE_URI).toBe("https://beep-effect.com/ns/qa/1.0/");
packages/drivers/exiftool/test/Exiftool.models.test.ts:271:    expectTypeOf(BEEP_QA_XMP_NAMESPACE_URI).toEqualTypeOf<"https://beep-effect.com/ns/qa/1.0/">();
packages/tooling/tool/cli/src/commands/Goals/Archive.schemas.ts:272: *   rewrittenTo: "https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/demo/PLAN.md",
packages/tooling/tool/cli/src/commands/Github/Github.service.ts:262:    const form = `<form method="POST" action="https://github.com/organizations/beep-effect/settings/apps/new?state=${nonce}"><input type="hidden" name="manifest" value="${escapeAttribute(manifestJson)}"><button>Create ${app} in beep-effect</button></form>`;
packages/tooling/tool/cli/src/commands/Github/Github.schemas.ts:79: *   url: "https://github.com/beep-effect/beep-effect",
packages/tooling/tool/cli/src/commands/Qa/Record.ts:84: *   url: "http://storybook.beep.localhost:1355/",
packages/tooling/tool/cli/src/commands/Qa/Record.ts:159: *     url: "http://storybook.beep.localhost:1355/",
packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts:159: * // "http://storybook.beep.localhost:1355"
packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts:161: * // "http://kg-scratch.labs.beep.localhost:1355"
packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts:171:    apps: () => `http://${target.name}.beep.localhost:${PORTLESS_PORT}`,
packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts:172:    labs: () => `http://${target.name}.labs.beep.localhost:${PORTLESS_PORT}`,
packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts:222: *   allowedOrigins: ["http://storybook.beep.localhost:1355"],
packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts:223: *   url: "http://storybook.beep.localhost:1355/iframe.html"
packages/tooling/tool/cli/src/commands/Qa/Qa.render.ts:142: *     url: "http://storybook.beep.localhost:1355/",
packages/tooling/tool/cli/src/commands/Qa/Qa.command.ts:87:    "Portless app name; apps expand to http://<app>.beep.localhost:1355, labs (apps/labs/<app>) to http://<app>.labs.beep.localhost:1355"
packages/tooling/tool/cli/src/commands/Qa/JudgeContract.ts:791: * console.log(QaJudgeContractSubject.name) // "https://beep-effect.com/ns/contracts/qa-inventory/v1@2.0.0"
packages/tooling/tool/cli/src/commands/Architecture/internal/PackageShell.ts:237:  "srcLink": "https://github.com/beep-effect/beep-effect/tree/main/packages/${target.boundedContext}/${role}/src/"
packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts:101:    homepage: `https://github.com/beep-effect/beep-effect/tree/main/${operation.repositoryDirectory}`,
packages/foundation/modeling/lexical/src/internal/conformance/Lexical.conformance-registry.ts:96:        "https://github.com/beep-effect/beep-effect/blob/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/lexical/src/Lexical.model.ts",
packages/foundation/modeling/lexical/src/internal/conformance/Lexical.conformance-registry.ts:99:        repository: "https://github.com/beep-effect/beep-effect",
packages/foundation/modeling/public-site/test/PublicSite.test.ts:45:    expect(PublicOrigin.literal).toBe("https://beep-effect.com");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:46:    expectTypeOf<PublicOrigin>().toEqualTypeOf<"https://beep-effect.com">();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:47:    expect(S.is(PublicOrigin)("https://beep-effect.com")).toBe(true);
packages/foundation/modeling/public-site/test/PublicSite.test.ts:48:    expect(S.is(PublicOrigin)("https://www.beep-effect.com")).toBe(false);
packages/foundation/modeling/public-site/test/PublicSite.test.ts:68:      expect(hostedUrl(route)).toBe(`https://beep-effect.com/${route}`);
packages/foundation/modeling/public-site/test/PublicSite.test.ts:74:    expectTypeOf(hostedUrl("docs")).toEqualTypeOf<"https://beep-effect.com/docs">();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:75:    expectTypeOf(hostedUrl("llms.txt")).toEqualTypeOf<"https://beep-effect.com/llms.txt">();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:76:    expectTypeOf(hostedUrl("docs", "identity/Id")).toEqualTypeOf<"https://beep-effect.com/docs/identity/Id">();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:78:    expectTypeOf(hostedUrl("api", dynamicPath)).toEqualTypeOf<`https://beep-effect.com/api/${string}`>();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:82:    expect(hostedUrl("docs", "identity/Id")).toBe("https://beep-effect.com/docs/identity/Id");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:83:    expect(hostedUrl(".well-known", "security.txt")).toBe("https://beep-effect.com/.well-known/security.txt");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:107:    expect(bare("llms.txt")).toBe("https://beep-effect.com/llms.txt");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:119:    expect(hostedUrl("docs", undefined)).toBe("https://beep-effect.com/docs");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:120:    expect(hostedUrl("docs", maybePath)).toBe("https://beep-effect.com/docs");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:157:    expectTypeOf(authority).toEqualTypeOf<"https://beep-effect.com/ns/">();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:163:    expect(labRoute("api-docs.labs.beep.localhost")).toBe("https://beep-effect.com/labs/api-docs");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:164:    expectTypeOf(labRoute("api-docs.labs.beep.localhost")).toEqualTypeOf<"https://beep-effect.com/labs/api-docs">();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:168:    expect(labRoute("semantica.labs.beep")).toBe("https://beep-effect.com/labs/semantica");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:169:    expectTypeOf(labRoute("semantica.labs.beep")).toEqualTypeOf<"https://beep-effect.com/labs/semantica">();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:173:    expect(labRoute("trustgraph-workbench")).toBe("https://beep-effect.com/labs/trustgraph-workbench");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:174:    expectTypeOf(labRoute("ciops")).toEqualTypeOf<"https://beep-effect.com/labs/ciops">();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:228:    expect(labRoute(label)).toBe("https://beep-effect.com/labs/lejeune-bolt-workbench");
packages/foundation/modeling/public-site/test/PublicSite.test.ts:229:    expectTypeOf(labRoute(label)).toEqualTypeOf<`https://beep-effect.com/labs/${LabLabel}`>();
packages/foundation/modeling/public-site/test/PublicSite.test.ts:244:      expect(url).toBe(`https://beep-effect.com/${route}`);
packages/foundation/modeling/public-site/test/PublicSite.test.ts:254:      expect(labRoute(label)).toBe(`https://beep-effect.com/labs/${label}`);
packages/foundation/modeling/ontology/test/Fold.test.ts:19:const $I = make("beep", { authority: "https://beep-effect.com/ns/", prefix: "beep" }).$BeepId.create("patent");
packages/foundation/modeling/ontology/test/Fold.test.ts:91:      expect(claim.iri).toBe("https://beep-effect.com/ns/patent/Claim");
packages/foundation/modeling/ontology/test/Fold.test.ts:92:      expect(spec.iri).toBe("https://beep-effect.com/ns/patent/Spec");
packages/foundation/modeling/ontology/test/Fold.test.ts:96:            "https://beep-effect.com/ns/patent/Claim",
packages/foundation/modeling/ontology/test/Fold.test.ts:102:            "https://beep-effect.com/ns/patent/Claim",
packages/foundation/modeling/ontology/test/Fold.test.ts:108:            "https://beep-effect.com/ns/patent/Spec",
packages/foundation/modeling/ontology/test/Fold.test.ts:110:            "https://beep-effect.com/ns/patent/Claim",
packages/foundation/modeling/ontology/test/Fold.test.ts:114:            "https://beep-effect.com/ns/patent/Claim",
packages/foundation/modeling/ontology/test/Fold.test.ts:116:            "https://beep-effect.com/ns/patent/Spec",
packages/foundation/modeling/ontology/test/Fold.test.ts:139:      expect(text.termIri).toBe("https://beep-effect.com/ns/patent/text");
packages/foundation/modeling/ontology/test/Fold.test.ts:145:      expect(O.getOrThrow(claimRef.rangeIri)).toBe("https://beep-effect.com/ns/patent/Claim");
packages/foundation/modeling/ontology/test/Fold.test.ts:177:      const badTriple = ["https://beep-effect.com/ns/patent/Claim", "nope:term", "owl:Thing"] as unknown as Triple;
packages/foundation/modeling/ontology/test/Fold.test.ts:209:        A.findFirst((node) => node["@id"] === "https://beep-effect.com/ns/patent/Claim"),
packages/foundation/modeling/ontology/test/Fold.test.ts:214:        "@id": "https://beep-effect.com/ns/patent/Claim",
packages/foundation/modeling/ontology/test/Fold.test.ts:217:          "rdfs:subClassOf": [{ "@id": "https://beep-effect.com/ns/patent/Spec" }],
packages/foundation/modeling/ontology/test/Fold.test.ts:239:        "rdfs:seeAlso": [{ "@id": "https://beep-effect.com/ns/patent/Claim" }],
packages/foundation/modeling/ontology/test/Fold.test.ts:274:        A.findFirst((node) => node["@id"] === "https://beep-effect.com/ns/patent/Claim"),
packages/foundation/modeling/ontology/test/Fold.test.ts:292:      expect(turtle).toContain("@prefix beep: <https://beep-effect.com/ns/patent/> .");
packages/foundation/modeling/ontology/test/Fold.test.ts:295:      expect(turtle).toContain("<https://beep-effect.com/ns/patent/Ontology.models/HttpUrl> a rdfs:Class");
packages/foundation/modeling/ontology/test/Fold.test.ts:317:  const $Skos = make("beep", { authority: "https://beep-effect.com/ns/", prefix: "beep" }).$BeepId.create("vocab");
packages/foundation/modeling/ontology/test/Fold.test.ts:348:        A.findFirst((node) => node["@id"] === "https://beep-effect.com/ns/vocab/Concept"),
packages/foundation/modeling/ontology/test/Fold.test.ts:392:        "https://beep-effect.com/ns/vocab/Concept",
packages/foundation/modeling/ontology/test/Fold.test.ts:393:        "https://beep-effect.com/ns/vocab/Scheme",
packages/foundation/modeling/ontology/test/Fold.test.ts:487:  const $Neg = make("beep", { authority: "https://beep-effect.com/ns/", prefix: "beep" }).$BeepId.create("negative");
packages/foundation/modeling/ontology/test/Fold.test.ts:656:      const $Patent = make("beep", { authority: "https://beep-effect.com/ns/", prefix: "beep" })
packages/foundation/modeling/ontology/test/Fold.test.ts:744:      expect(claimClass.iri).toBe("https://beep-effect.com/ns/ontology/Ontology.models/OWLClass");
packages/foundation/modeling/public-site/src/PublicOrigin.schema.ts:13: * Schema for the apex origin `https://beep-effect.com`.
packages/foundation/modeling/public-site/src/PublicOrigin.schema.ts:26: * PublicOrigin.literal // => "https://beep-effect.com"
packages/foundation/modeling/public-site/src/PublicOrigin.schema.ts:32:export const PublicOrigin = S.Literal("https://beep-effect.com").pipe(
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:72: * S.is(HostedUrl)("https://beep-effect.com/docs") // => true
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:73: * S.is(HostedUrl)("https://beep-effect.com/labs/semantica") // => true
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:74: * S.is(HostedUrl)("https://beep-effect.com/llms.txt/extra") // => false
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:291: * const url: HostedUrlOf<"docs", "identity"> = "https://beep-effect.com/docs/identity"
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:310: * const url: LabUrlOf<"semantica.labs.beep"> = "https://beep-effect.com/labs/semantica"
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:335: * hostedUrl("docs") // => "https://beep-effect.com/docs"
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:336: * hostedUrl("docs", "identity/Id") // => "https://beep-effect.com/docs/identity/Id"
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:337: * hostedUrl("llms.txt") // => "https://beep-effect.com/llms.txt"
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:367: * labRoute("api-docs.labs.beep.localhost") // => "https://beep-effect.com/labs/api-docs"
packages/foundation/modeling/public-site/src/HostedUrl.schema.ts:368: * labRoute("semantica") // => "https://beep-effect.com/labs/semantica"
packages/foundation/modeling/identity/test/Vocab.test.ts:55:      iri: "https://beep-effect.com/ns/",
packages/foundation/modeling/identity/test/PnLocal.test.ts:144:        fullIri: "https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl",
packages/foundation/modeling/identity/test/PnLocal.test.ts:146:    ).toBe("<https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl>");
packages/foundation/modeling/identity/test/PnLocal.test.ts:153:        fullIri: 'https://beep-effect.com/ns/x"> <urn:evil>',
packages/foundation/modeling/identity/test/PnLocal.test.ts:155:    ).toBe("<https://beep-effect.com/ns/x%22%3E%20%3Curn:evil%3E>");
packages/foundation/modeling/identity/test/OntologyEntrypoints.test.ts:6:const { $MyPkgId } = make("my-pkg", { authority: "https://beep-effect.com/ns/", prefix: "beep" });
packages/foundation/modeling/identity/test/OntologyEntrypoints.test.ts:73:      expect(ann.iri).toBe("https://beep-effect.com/ns/my-pkg/patent/Claim");
packages/foundation/modeling/ontology/src/Fold.projections.ts:390: * console.log(document["@graph"][0]?.["@id"]) // "https://beep-effect.com/ns/patent/Claim"
packages/foundation/modeling/identity/test/IriBinding.test.ts:13:    expect($SemanticFoundationId.iri).toBe("https://beep-effect.com/ns/ontology/semantic-foundation");
packages/foundation/modeling/identity/test/IriBinding.test.ts:19:    expectTypeOf(IdentityAuthority).toEqualTypeOf<"https://beep-effect.com/ns/">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:20:    expectTypeOf($I.iri).toEqualTypeOf<"https://beep-effect.com/ns/">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:22:    expectTypeOf(x.iri).toEqualTypeOf<"https://beep-effect.com/ns/x">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:24:    expectTypeOf(SemanticFoundationVocab.beep.iri).toEqualTypeOf<"https://beep-effect.com/ns/">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:26:    expect(IdentityAuthority).toBe("https://beep-effect.com/ns/");
packages/foundation/modeling/identity/test/IriBinding.test.ts:27:    expect($I.iri).toBe("https://beep-effect.com/ns/");
packages/foundation/modeling/identity/test/IriBinding.test.ts:30:    expect(x.iri).toBe("https://beep-effect.com/ns/x");
packages/foundation/modeling/identity/test/IriBinding.test.ts:39:    expectTypeOf($EpistemicId.iri).toEqualTypeOf<"https://beep-effect.com/ns/epistemic">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:40:    expectTypeOf(claim.iri).toEqualTypeOf<"https://beep-effect.com/ns/epistemic/Claim">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:41:    expectTypeOf($QaId.iri).toEqualTypeOf<"https://beep-effect.com/ns/qa">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:42:    expectTypeOf(qaVersion.iri).toEqualTypeOf<"https://beep-effect.com/ns/qa/1.0">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:44:    expect($EpistemicId.iri).toBe("https://beep-effect.com/ns/epistemic");
packages/foundation/modeling/identity/test/IriBinding.test.ts:45:    expect(claim.iri).toBe("https://beep-effect.com/ns/epistemic/Claim");
packages/foundation/modeling/identity/test/IriBinding.test.ts:47:    expect($QaId.iri).toBe("https://beep-effect.com/ns/qa");
packages/foundation/modeling/identity/test/IriBinding.test.ts:48:    expect(qaVersion.iri).toBe("https://beep-effect.com/ns/qa/1.0");
packages/foundation/modeling/identity/test/IriBinding.test.ts:49:    expect(`${qaVersion.iri}/`).toBe("https://beep-effect.com/ns/qa/1.0/");
packages/foundation/modeling/identity/test/IriBinding.test.ts:53:    const { $BeepId } = make({ authority: "https://beep-effect.com/ns/", prefix: "beep" })("beep");
packages/foundation/modeling/identity/test/IriBinding.test.ts:58:      IriFromIdentity<"https://beep-effect.com/ns/", "@beep/ontology/Ontology.models/HttpUrl">
packages/foundation/modeling/identity/test/IriBinding.test.ts:59:    >().toEqualTypeOf<"https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:66:    expectTypeOf(modules.$OntologyId.iri).toEqualTypeOf<"https://beep-effect.com/ns/ontology">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:67:    expectTypeOf(model.iri).toEqualTypeOf<"https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:72:    expect(model.iri).toBe("https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl");
packages/foundation/modeling/identity/test/IriBinding.test.ts:110:    expectTypeOf(annotation.iri).toEqualTypeOf<"https://beep-effect.com/ns/ontology/Ontology.models/OWLClass">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:114:      iri: "https://beep-effect.com/ns/ontology/Ontology.models/OWLClass",
packages/foundation/modeling/identity/test/IriBinding.test.ts:120:      "https://beep-effect.com/ns/ontology/Ontology.models/OWLClassLabel"
packages/foundation/modeling/identity/test/IdentityRegistry.test.ts:26:    iri: "https://beep-effect.com/ns/identity/First",
packages/foundation/modeling/identity/test/IdentityRegistry.test.ts:66:        iri: "https://beep-effect.com/ns/identity/Second",
packages/foundation/modeling/identity/test/IdentityRegistry.test.ts:96:        iri: "https://beep-effect.com/ns/identity/Second",
packages/foundation/modeling/ontology/src/Fold.assembly.ts:887: * console.log(assembled.classes[0]?.iri) // "https://beep-effect.com/ns/patent/Claim"
packages/foundation/modeling/identity/test/AnnoteError.test.ts:7:const $Bound = make("probe", { authority: "https://beep-effect.com/ns/", prefix: "beep" }).$ProbeId.create("Widget");
packages/foundation/modeling/identity/src/packages.ts:470: * $SemanticFoundationId.iri // => "https://beep-effect.com/ns/ontology/semantic-foundation"
packages/foundation/modeling/identity/src/packages.ts:495: * $EpistemicId.create("Claim").iri // => "https://beep-effect.com/ns/epistemic/Claim"
packages/foundation/modeling/identity/src/packages.ts:496: * claimSubjectPrefix // => "https://beep-effect.com/ns/epistemic/claim/"
packages/foundation/modeling/identity/src/packages.ts:521: * $QaId.iri // => "https://beep-effect.com/ns/qa"
packages/foundation/modeling/identity/src/packages.ts:522: * xmpNamespace // => "https://beep-effect.com/ns/qa/1.0/"
packages/foundation/modeling/md/src/internal/conformance/Md.specification-source-registry.ts:119:      "https://github.com/beep-effect/beep-effect/blob/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/md/src/Md.model.ts",
packages/foundation/modeling/md/src/internal/conformance/Md.specification-source-registry.ts:122:      repository: "https://github.com/beep-effect/beep-effect",
packages/foundation/modeling/identity/src/Vocab.ts:541: * SemanticFoundationVocab.beep.iri // => "https://beep-effect.com/ns/"
packages/foundation/modeling/identity/src/PnLocal.ts:472: *   fullIri: "https://beep-effect.com/ns/Ontology.models/HttpUrl"
packages/foundation/modeling/identity/src/PnLocal.ts:474: * console.log(rendered) // "<https://beep-effect.com/ns/Ontology.models/HttpUrl>"
packages/foundation/modeling/identity/src/IdentityRegistry.ts:58: *   value: "https://beep-effect.com/ns/identity/Widget"
packages/foundation/modeling/identity/src/IdentityRegistry.ts:94: *   iri: "https://beep-effect.com/ns/identity/Widget",
packages/foundation/modeling/identity/src/IdentityRegistry.ts:266:   *   iri: "https://beep-effect.com/ns/identity/Widget",
packages/foundation/modeling/identity/src/Id.ts:61: * `/`: `@beep/a/b` mints `https://beep-effect.com/ns/a/b`.
packages/foundation/modeling/identity/src/Id.ts:69: * IdentityAuthority // => "https://beep-effect.com/ns/"
packages/foundation/modeling/identity/src/Id.ts:71: * $I.create("x").iri // => "https://beep-effect.com/ns/x"
packages/foundation/modeling/identity/src/Id.ts:77:export const IdentityAuthority = "https://beep-effect.com/ns/" as const;
packages/foundation/modeling/identity/src/Id.ts:360: * Converts `"@beep/a/b"` to `"https://beep-effect.com/ns/a/b"` when the authority is
packages/foundation/modeling/identity/src/Id.ts:361: * `"https://beep-effect.com/ns/"`. Widened string inputs intentionally widen to `string`.
packages/foundation/modeling/identity/src/Id.ts:368: * type Iri = IriFromIdentity<"https://beep-effect.com/ns/", "@beep/schema/Entity">
packages/foundation/modeling/identity/src/Id.ts:369: * const iri: Iri = "https://beep-effect.com/ns/schema/Entity"
packages/foundation/modeling/identity/src/Id.ts:1234:   * const { $MyPkgId } = make("my-pkg", { authority: "https://beep-effect.com/ns/", prefix: "beep" })
packages/foundation/modeling/identity/src/Id.ts:1317:   * const { $BeepId } = make("beep", { authority: "https://beep-effect.com/ns/", prefix: "beep" })
packages/foundation/modeling/identity/src/Id.ts:1349:   * const { $BeepId } = make("beep", { authority: "https://beep-effect.com/ns/", prefix: "beep" })
packages/foundation/modeling/identity/src/Id.ts:1351:   * iri // => "https://beep-effect.com/ns/schema"
packages/foundation/modeling/identity/src/Id.ts:1377:   * const { $MyPkgId } = make("my-pkg", { authority: "https://beep-effect.com/ns/", prefix: "beep" })
packages/foundation/modeling/identity/src/Id.ts:1423:   * const { $BeepId } = make("beep", { authority: "https://beep-effect.com/ns/", prefix: "beep" })
packages/foundation/modeling/identity/src/Id.ts:1490:   * const { $BeepId } = make("beep", { authority: "https://beep-effect.com/ns/", prefix: "beep", vocab: CoreVocab })
packages/foundation/modeling/pandoc-ast/src/internal/conformance/Pandoc.conformance-registry.ts:41:        "https://github.com/beep-effect/beep-effect/blob/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/pandoc-ast/src/internal/Pandoc.registry.ts",
packages/foundation/modeling/pandoc-ast/src/internal/conformance/Pandoc.conformance-registry.ts:44:        repository: "https://github.com/beep-effect/beep-effect",
packages/foundation/modeling/pandoc-ast/src/internal/conformance/Pandoc.conformance-registry.ts:57:        "https://github.com/beep-effect/beep-effect/blob/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/pandoc-ast/src/Pandoc.model.ts",
packages/foundation/modeling/pandoc-ast/src/internal/conformance/Pandoc.conformance-registry.ts:60:        repository: "https://github.com/beep-effect/beep-effect",
packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts:249: *   iri: "https://beep-effect.com/ns/semantic-web/Example",
packages/foundation/modeling/html/src/internal/conformance/Html.policy-conformance-registry.ts:29:      "https://raw.githubusercontent.com/beep-effect/beep-effect/e6e88af611c2d677c8348e9e6722687b6c34c454/packages/foundation/modeling/html/src/Html.policy.ts",
packages/foundation/modeling/html/src/internal/conformance/Html.policy-conformance-registry.ts:32:      repository: "https://github.com/beep-effect/beep-effect",
packages/foundation/modeling/html/src/internal/conformance/Html.conformance-source-registry.ts:122:      "https://raw.githubusercontent.com/beep-effect/beep-effect/dc9e7d2707508787a0c5daf9f33c5cf1b6259e87/packages/foundation/modeling/html/data/whatwg/content-model.json",
packages/foundation/modeling/html/src/internal/conformance/Html.conformance-source-registry.ts:125:      repository: "https://github.com/beep-effect/beep-effect",
packages/foundation/modeling/html/src/internal/conformance/Html.conformance-source-registry.ts:153:      "https://raw.githubusercontent.com/beep-effect/beep-effect/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/html/data/overrides/classification.json",
packages/foundation/modeling/html/src/internal/conformance/Html.conformance-source-registry.ts:156:      repository: "https://github.com/beep-effect/beep-effect",
packages/foundation/modeling/html/src/internal/conformance/Html.conformance-source-registry.ts:169:      "https://raw.githubusercontent.com/beep-effect/beep-effect/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/html/data/overrides/obsolete-interfaces.json",
packages/foundation/modeling/html/src/internal/conformance/Html.conformance-source-registry.ts:172:      repository: "https://github.com/beep-effect/beep-effect",
packages/foundation/modeling/skill-contract/test/SkillContract.test.ts:62:      expect(FailurePredicateType).toBe("https://beep-effect.com/ns/skill-contract/evidence/failure/v2");
packages/foundation/modeling/skill-contract/test/SkillContract.test.ts:63:      expect(GateSummaryPredicateType).toBe("https://beep-effect.com/ns/skill-contract/evidence/gate-summary/v2");
```

#### ontology/ matches

```text
apps/professional-desktop/test/tailwind-sources.test.ts:26:  "@beep/ontology-ui": "packages/ontology/ui/src",
apps/labs/semantica/test/Projection.test.ts:352:          "https://beep-effect.com/ns/semantica/ontology/EvidenceClaim"
apps/professional-desktop/test/ontology-workspace-seed.test.ts:13:import { seedPizzaTutorial } from "@/ontology/OntologyWorkspaceSeed";
apps/professional-desktop/test/ontology-sidecar-registration.test.ts:25:import { OntologyHandlersLive } from "@/ontology/OntologyOrchestrator";
packages/tooling/policy-pack/repo-configs/test/NoNativeRuntimeHotspots.test.ts:12:    expect(isNoNativeRuntimeErrorFile("scratchpad/effect-ontology/Runtime/HttpServer.ts")).toBe(true);
packages/tooling/policy-pack/repo-configs/test/NoNativeRuntimeHotspots.test.ts:18:    expect(isNoNativeRuntimeExtraCheckHotspot("scratchpad/effect-ontology/Runtime/HttpServer.ts")).toBe(true);
packages/tooling/policy-pack/repo-configs/test/NoNativeRuntimeHotspots.test.ts:19:    expect(isNoNativeRuntimeExtraCheckHotspot("scratchpad/effect-ontology/App.tsx")).toBe(true);
packages/tooling/policy-pack/repo-configs/test/NoNativeRuntimeHotspots.test.ts:21:    expect(isNoNativeRuntimeExtraCheckHotspot("scratchpad/effect-ontology/README.md")).toBe(false);
packages/tooling/policy-pack/repo-configs/src/laws/NoNativeRuntimeHotspots.ts:79:  Str.startsWith("scratchpad/effect-ontology/")(relativeFilePath) ||
packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts:241:      "file": "packages/ontology/domain/src/aggregates/Session/Session.model.ts",
apps/labs/semantica/src/layers/RdfProjectionLive.ts:35: * console.log(semanticaOntologyIri("EvidenceClaim").endsWith("/ns/semantica/ontology/EvidenceClaim")) // true
apps/labs/semantica/src/layers/RdfProjectionLive.ts:41:export const semanticaOntologyIri = <const Term extends string>(term: Term) => `${BASE}ontology/${term}` as const;
apps/labs/semantica/src/layers/RdfProjectionLive.ts:48:const EVIDENCE_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/EvidenceClaim`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:49:const ENTITY_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/EntityClaim`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:50:const RELATION_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/RelationClaim`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:51:const STRUCTURE_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/StructureClaim`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:52:const CHUNK = Rdf.makeNamedNode(`${BASE}ontology/sourceChunk`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:53:const LABEL = Rdf.makeNamedNode(`${BASE}ontology/label`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:54:const ROLE = Rdf.makeNamedNode(`${BASE}ontology/role`);
apps/labs/semantica/src/layers/RdfProjectionLive.ts:55:const PREDICATE_TEXT = Rdf.makeNamedNode(`${BASE}ontology/predicateText`);
apps/professional-desktop/src/App.tsx:419:// graph's private registry to everything it portals, but chat/ontology/sync
apps/professional-desktop/src/runtime/Layer.ts:88:import { OntologyHandlersLive } from "@/ontology/OntologyOrchestrator";
apps/professional-desktop/src/runtime/Layer.ts:89:import { OntologyWorkspaceSeedLive } from "@/ontology/OntologyWorkspaceSeed";
apps/professional-desktop/src/ontology/OntologyWorkspaceSeed.ts:64: * import { seedPizzaTutorial } from "@/ontology/OntologyWorkspaceSeed"
apps/professional-desktop/src/ontology/OntologyWorkspaceSeed.ts:121: * import { OntologyWorkspaceSeedLive } from "@/ontology/OntologyWorkspaceSeed"
apps/professional-desktop/src/ontology/OntologyOrchestrator.ts:195: * import { OntologyHandlersLive } from "@/ontology/OntologyOrchestrator"
apps/labs/ciops/test/projection.test.ts:57:const aboxPath = "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl";
apps/labs/ciops/test/projection.test.ts:59:  "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson";
apps/labs/ciops/test/projection.test.ts:181:        expect(firstDocument.content).toContain("@prefix ciops: <https://oip.law/ontology/ci-ops#> .");
apps/labs/ciops/test/projection.test.ts:182:        expect(firstDocument.content).toContain("@prefix ciops-prov: <https://oip.law/ontology/ci-ops-prov#> .");
apps/labs/ciops/test/live-replay.test.ts:68:const pin = "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet";
apps/labs/ciops/test/live-replay.test.ts:69:const aboxPath = "explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl";
apps/labs/ciops/test/live-replay.test.ts:71:  "explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson";
apps/labs/ciops/test/kpi-reading.test.ts:484:        yield* fs.makeDirectory(`${root}/explorations/beep-ci-operational-ontology/research`, { recursive: true });
apps/labs/ciops/test/kpi-contract.test.ts:48:const ledgerPath: RepoRelativePath = "explorations/beep-ci-operational-ontology/research/control-interventions.yaml";
apps/labs/ciops/test/evidence.test.ts:19:const aboxPath = "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl";
apps/labs/ciops/test/evidence.test.ts:21:  "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson";
packages/tooling/tool/cli/test/yeet-monitor-loop.test.ts:76:  "FAIL packages/ontology/use-cases/test/SchemaParity.test.ts",
packages/tooling/tool/cli/test/yeet-monitor-loop.test.ts:93:  "##[error]command (/opt/actions-runner/_work/beep-effect/beep-effect/packages/ontology/config) /home/ec2-user/.bun/bin/bun run build exited (2)",
apps/labs/ciops/src/projection/Turtle.ts:17:  "@prefix ciops: <https://oip.law/ontology/ci-ops#> .",
apps/labs/ciops/src/projection/Turtle.ts:18:  "@prefix ciops-prov: <https://oip.law/ontology/ci-ops-prov#> .",
apps/labs/ciops/src/projection/Schemas.ts:449: * const document = TurtleDocument.make({ content: "@prefix ciops: <https://oip.law/ontology/ci-ops#> .\n" })
apps/labs/ciops/src/projection/Replay.ts:1028:      "- Journal: `ontology/extraction/s6/snapshot/raw/journal.ndjson`",
apps/labs/ciops/src/projection/Evidence.ts:363: *   abox: "explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl",
apps/labs/ciops/src/projection/Evidence.ts:364: *   goldenJournal: "explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson",
apps/labs/ciops/src/projection/Evidence.ts:578:const run4FleetPin = "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet";
apps/labs/ciops/src/projection/Evidence.ts:603:  abox: "explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl",
apps/labs/ciops/src/projection/Evidence.ts:604:  goldenJournal: "explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson",
apps/labs/ciops/src/projection/Evidence.ts:954:        'Authority: `goals/ciops-ontology-pipeline/research/decisions.md`, "2026-10-06 — P2 design sitting", Rulings 8 and 9, and the S7 contract §8.3 (§5 live evidence). The frozen `explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md` is never re-rendered; its agreement is recomputed below in the same run.',
apps/labs/ciops/src/kpi/Schemas.ts:431: *       path: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
apps/labs/ciops/src/kpi/Schemas.ts:946: *       path: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
apps/labs/ciops/src/kpi/Schemas.ts:1179: *   path: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
apps/labs/ciops/src/kpi/Render.ts:60: *       path: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
apps/labs/ciops/src/kpi/Render.ts:297:      "Rules: KPI law v1.2 §7 (`explorations/beep-ci-operational-ontology/research/kpi-measurement-rules.md`), " +
apps/labs/ciops/src/kpi/Pins.ts:22:const run4FleetPin = "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet";
apps/labs/ciops/src/kpi/Pins.ts:75:    path: "explorations/beep-ci-operational-ontology/research/evidence/journal-snapshot-2026-10-01/journal.redacted.ndjson",
apps/labs/ciops/src/kpi/Pins.ts:80:    path: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
apps/labs/ciops/src/kpi/ChangeEvents.ts:7: * `explorations/beep-ci-operational-ontology/research/control-interventions.yaml`:
apps/labs/ciops/scripts/generate-replay-evidence.ts:17:  abox: "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl",
apps/labs/ciops/scripts/generate-replay-evidence.ts:18:  journal: "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson",
apps/labs/ciops/scripts/generate-replay-evidence.ts:19:  evidence: "../../../explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md",
packages/execution-authority/server/src/GovernedTierGate/GovernedTierGate.gate.ts:8: * foundation-mediated port inversion: `ontology/server` keeps consuming
packages/tooling/tool/cli/test/research-library-ontology.test.ts:310:        const tboxPath = path.join(root, "ontology/research-library.ttl");
packages/tooling/tool/cli/test/research-library-ontology.test.ts:311:        const shapesPath = path.join(root, "ontology/research-library.shacl.ttl");
packages/tooling/tool/cli/test/quality-tasks.test.ts:7442:            "explorations/beep-ci-operational-ontology/ontology/extraction/s6/output.json",
packages/tooling/tool/cli/test/native-runtime.test.ts:186:            "scratchpad/effect-ontology/Runtime/HotspotProbe.ts",
packages/tooling/tool/cli/test/native-runtime.test.ts:221:          expect(summary.affectedFiles).toEqual(["scratchpad/effect-ontology/Runtime/HotspotProbe.ts"]);
packages/tooling/tool/cli/test/native-runtime.test.ts:290:            "scratchpad/effect-ontology/Runtime/RateLimitedLanguageModel.ts",
packages/tooling/tool/cli/test/native-runtime.test.ts:301:          expectStrictNativeError(summary, ["scratchpad/effect-ontology/Runtime/RateLimitedLanguageModel.ts"]);
packages/tooling/tool/cli/test/laws-turbo-inputs.test.ts:186:        "packages/_internal/db-admin/effect-ontology/example.ts",
packages/tooling/tool/cli/test/laws-turbo-inputs.test.ts:238:        ["scratchpad/example.tsx", "packages/_internal/db-admin/effect-ontology/example.ts"],
packages/tooling/tool/cli/test/laws-retired-iri-authorities.test.ts:323:          "packages/foundation/modeling/ontology/src/seed/docketing.ttl",
packages/tooling/tool/cli/test/laws-retired-iri-authorities.test.ts:324:          "packages/foundation/modeling/ontology/src/seed/docketing.jsonld",
packages/ontology/use-cases/src/aggregates/Session/Session.pizza-tutorial.ts:17:const PIZZA_NS = "https://beep.example/ontology/tutorial/pizza#" as const;
packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts:284: *   baseIri: "https://oip.law/ontology/claims#"
packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts:288: * console.log(O.getOrUndefined(payload.baseIri)) // => "https://oip.law/ontology/claims#"
packages/tooling/tool/cli/src/commands/Research/Library/Library.paths.ts:39:export const LIBRARY_TBOX_FILE = "ontology/research-library.ttl";
packages/tooling/tool/cli/src/commands/Research/Library/Library.paths.ts:53:export const LIBRARY_SHAPES_FILE = "ontology/research-library.shacl.ttl";
packages/tooling/tool/cli/src/commands/Research/Library/Library.paths.ts:131: * console.log(libraryOutputAncestor("/library", "ontology/model.ttl").pipe !== undefined)
packages/tooling/tool/cli/test/ci-heavy-admission.test.ts:204:      "explorations/research-library-ontology/BRIEF.md",
packages/tooling/tool/cli/test/ci-heavy-admission.test.ts:205:      "explorations/research-library-ontology/CAPTURE.md",
packages/tooling/tool/cli/test/ci-heavy-admission.test.ts:206:      "explorations/research-library-ontology/DECISIONS.md",
packages/tooling/tool/cli/test/ci-heavy-admission.test.ts:207:      "explorations/research-library-ontology/MAP.md",
packages/tooling/tool/cli/test/ci-heavy-admission.test.ts:208:      "explorations/research-library-ontology/README.md",
packages/tooling/tool/cli/test/ci-heavy-admission.test.ts:209:      "explorations/research-library-ontology/RESEARCH.md",
packages/tooling/tool/cli/test/ci-heavy-admission.test.ts:210:      "explorations/research-library-ontology/assets/.gitkeep",
packages/tooling/tool/cli/test/ci-heavy-admission.test.ts:211:      "explorations/research-library-ontology/ops/manifest.json",
packages/tooling/tool/cli/test/ci-heavy-admission.test.ts:212:      "explorations/research-library-ontology/research/SOURCES.md",
packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:51:  "scratchpad/effect-ontology/**/*.{ts,tsx}",
packages/foundation/modeling/identity/test/shape-stable.test.ts:440:    expectExistingAnnotationShape(annotation, "@beep/ontology/Ontology.models/OWLClass", "OWLClass", ["description"]);
packages/foundation/modeling/identity/test/shape-stable.test.ts:442:    expectExistingAnnotationShape(schemaAnnotations, "@beep/ontology/Ontology.models/OWLClassLabel", "OWLClassLabel", [
packages/foundation/modeling/identity/test/Vocab.test.ts:57:        "ontology/semantic-foundation",
packages/foundation/modeling/identity/test/Vocab.test.ts:58:        "ontology/semantic-foundation/taxonomy/legal-intake",
packages/foundation/modeling/identity/test/Vocab.test.ts:59:        "ontology/semantic-foundation/filing-root/local-vault",
packages/foundation/modeling/identity/test/Vocab.test.ts:60:        "ontology/semantic-foundation/filing-root/box-mirror",
packages/foundation/modeling/identity/test/PnLocal.test.ts:144:        fullIri: "https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl",
packages/foundation/modeling/identity/test/PnLocal.test.ts:146:    ).toBe("<https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl>");
packages/foundation/modeling/identity/test/IriBinding.test.ts:13:    expect($SemanticFoundationId.iri).toBe("https://beep-effect.com/ns/ontology/semantic-foundation");
packages/foundation/modeling/identity/test/IriBinding.test.ts:58:      IriFromIdentity<"https://beep-effect.com/ns/", "@beep/ontology/Ontology.models/HttpUrl">
packages/foundation/modeling/identity/test/IriBinding.test.ts:59:    >().toEqualTypeOf<"https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:61:      CurieFromIdentity<"beep", "@beep/ontology/Ontology.models/HttpUrl">
packages/foundation/modeling/identity/test/IriBinding.test.ts:62:    >().toEqualTypeOf<"beep:ontology/Ontology.models/HttpUrl">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:64:      SlugFromIdentifier<"@beep/ontology/Ontology.models/HttpUrl">
packages/foundation/modeling/identity/test/IriBinding.test.ts:67:    expectTypeOf(model.iri).toEqualTypeOf<"https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:68:    expectTypeOf(model.curie).toEqualTypeOf<"beep:ontology/Ontology.models/HttpUrl">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:71:    expect(model.string()).toBe("@beep/ontology/Ontology.models/HttpUrl");
packages/foundation/modeling/identity/test/IriBinding.test.ts:72:    expect(model.iri).toBe("https://beep-effect.com/ns/ontology/Ontology.models/HttpUrl");
packages/foundation/modeling/identity/test/IriBinding.test.ts:73:    expect(model.curie).toBe("beep:ontology/Ontology.models/HttpUrl");
packages/foundation/modeling/identity/test/IriBinding.test.ts:83:    expectTypeOf(rebased.iri).toEqualTypeOf<"https://opip.law/ns/patent#ontology/patent">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:84:    expectTypeOf(rebased.curie).toEqualTypeOf<"patent:ontology/patent">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:85:    expectTypeOf(annotation.iri).toEqualTypeOf<"https://opip.law/ns/patent#ontology/patent/Claim">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:86:    expectTypeOf(annotation.curie).toEqualTypeOf<"patent:ontology/patent/Claim">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:91:    expect(rebased.symbol()).toBe(Symbol.for("@beep/ontology/patent"));
packages/foundation/modeling/identity/test/IriBinding.test.ts:92:    expect(rebased.iri).toBe("https://opip.law/ns/patent#ontology/patent");
packages/foundation/modeling/identity/test/IriBinding.test.ts:93:    expect(rebased.curie).toBe("patent:ontology/patent");
packages/foundation/modeling/identity/test/IriBinding.test.ts:94:    expect(annotation.identifier).toBe("@beep/ontology/patent/Claim");
packages/foundation/modeling/identity/test/IriBinding.test.ts:95:    expect(annotation.schemaId).toBe(Symbol.for("@beep/ontology/patent/Claim"));
packages/foundation/modeling/identity/test/IriBinding.test.ts:110:    expectTypeOf(annotation.iri).toEqualTypeOf<"https://beep-effect.com/ns/ontology/Ontology.models/OWLClass">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:111:    expectTypeOf(annotation.curie).toEqualTypeOf<"beep:ontology/Ontology.models/OWLClass">();
packages/foundation/modeling/identity/test/IriBinding.test.ts:113:      identifier: "@beep/ontology/Ontology.models/OWLClass",
packages/foundation/modeling/identity/test/IriBinding.test.ts:114:      iri: "https://beep-effect.com/ns/ontology/Ontology.models/OWLClass",
packages/foundation/modeling/identity/test/IriBinding.test.ts:115:      curie: "beep:ontology/Ontology.models/OWLClass",
packages/foundation/modeling/identity/test/IriBinding.test.ts:120:      "https://beep-effect.com/ns/ontology/Ontology.models/OWLClassLabel"
packages/foundation/modeling/identity/test/IriBinding.test.ts:122:    expect(getProperty(schemaAnnotations, "curie")).toBe("beep:ontology/Ontology.models/OWLClassLabel");
packages/foundation/modeling/identity/src/packages.ts:470: * $SemanticFoundationId.iri // => "https://beep-effect.com/ns/ontology/semantic-foundation"
packages/foundation/modeling/identity/test/Identity.test.ts:253:    expect(classAnnotations?.identifier).toBe("@beep/ontology/Ontology.models/OWLClass");
packages/foundation/modeling/identity/test/Identity.test.ts:254:    expect(classAnnotations?.schemaId).toBe(Symbol.for("@beep/ontology/Ontology.models/OWLClass"));
packages/foundation/modeling/identity/test/Identity.test.ts:256:    expect(schemaAnnotations?.identifier).toBe("@beep/ontology/Ontology.models/OWLClassLabel");
packages/foundation/modeling/identity/test/Identity.test.ts:257:    expect(getProperty(keyAnnotations, "identifier")).toBe("@beep/ontology/Ontology.models/OWLClass.iri");
packages/foundation/modeling/identity/test/Identity.test.ts:258:    expect(httpAnnotations?.identifier).toBe("@beep/ontology/Ontology.models/OWLClassResponse");
packages/foundation/modeling/identity/src/Vocab.ts:542: * SemanticFoundationVocab.beep.terms.includes("ontology/semantic-foundation") // => true
packages/foundation/modeling/identity/src/Vocab.ts:552:      "ontology/semantic-foundation",
packages/foundation/modeling/identity/src/Vocab.ts:553:      "ontology/semantic-foundation/taxonomy/legal-intake",
packages/foundation/modeling/identity/src/Vocab.ts:554:      "ontology/semantic-foundation/filing-root/local-vault",
packages/foundation/modeling/identity/src/Vocab.ts:555:      "ontology/semantic-foundation/filing-root/box-mirror",
packages/foundation/modeling/identity/src/Id.ts:1426:   * rebased.iri // => "https://opip.law/ns/patent#ontology/patent"
packages/foundation/modeling/ontology/src/Classification.models.ts:19: * import { ClassificationSchemeKind } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:37: * import type { ClassificationSchemeKind } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:51: * import { IpcEdition } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:67: * import type { IpcEdition } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:81: * import { CpcEdition } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:97: * import type { CpcEdition } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:111: * import { NiceEdition } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:127: * import type { NiceEdition } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:141: * import { IpcSymbol } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:159: * import type { IpcSymbol } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:173: * import { CpcSymbol } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:189: * import type { CpcSymbol } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:203: * import { NiceClassNumber } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:219: * import type { NiceClassNumber } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:233: * import { NiceBasicNumber } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:249: * import type { NiceBasicNumber } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:263: * import type { ClassificationConcept } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:290: * import type { ClassificationSnapshot } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:331: * import { ClassificationPin } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:359: * import { ClassificationError } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:387: * import { classificationSchemeIri, ClassificationPin } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Classification.models.ts:406: * import { classificationConceptIri, ClassificationPin } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.seed.ts:26: * import { SemanticFoundationSchemeIri } from "@beep/ontology/SemanticFoundation.seed"
packages/foundation/modeling/ontology/src/SemanticFoundation.seed.ts:47: * import { SemanticFoundationSeed } from "@beep/ontology/SemanticFoundation.seed"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:33: * import { FilingSegment } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:63: * import type { FilingSegment } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:80: * import { isFilingSegment } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:96: * import { DocumentClass } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:123: * import type { DocumentClass } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:140: * import { SkosMappingKind } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:160: * import type { SkosMappingKind } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:177: * import { ConceptAlignment } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:210: * import { TaxonomyConcept } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:246: * import { FilingRootKind } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:266: * import type { FilingRootKind } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:283: * import { FilingRoot } from "@beep/ontology/SemanticFoundation.models"
packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:305: * import { SemanticFoundationSeed } from "@beep/ontology/SemanticFoundation.seed"
packages/foundation/modeling/ontology/src/internal/ClassificationXml.ts:215: * import { ClassificationPin } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/internal/ClassificationXml.ts:309: * import { ClassificationPin } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/internal/ClassificationXml.ts:337: * import { ClassificationPin } from "@beep/ontology/Classification.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:41: * import { SourceType } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:61: * import type { SourceType } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:96: * import { HttpUrl } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:117: * import type { HttpUrl } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:134: * import { GraphInfo } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:234: * import { HealthStatus } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:254: * import type { HealthStatus } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:271: * import { HealthResponse } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:303: * import { OWLClass } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:494:        "OWLClass model for the FOLIO package, which represents an OWL class in the FOLIO\nontology/taxonomy style.\n\nTODO: think about future-proofing for next-gen roadmap.",
packages/foundation/modeling/ontology/src/Ontology.models.ts:505: * import { OWLObjectProperty } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:609: * import { OWLClassList } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:655: * import { OWLObjectPropertyList } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:692: * import { OWLSearchScore } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:712: * import type { OWLSearchScore } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:729: * import { OWLSearchResult } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:749: * import type { OWLSearchResult } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:765: * import { OWLSearchResults } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:805: * import { ValidationErrorLocationSegment } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:825: * import type { ValidationErrorLocationSegment } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:842: * import { ValidationError } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/src/Ontology.models.ts:888: * import { HTTPValidationError } from "@beep/ontology/Ontology.models"
packages/foundation/modeling/ontology/test/Ontology.models.test.ts:12:} from "@beep/ontology/Ontology.models";
packages/foundation/modeling/ontology/test/Fold.test.ts:4:import { FactLiteral } from "@beep/ontology/Fold.models";
packages/foundation/modeling/ontology/test/Fold.test.ts:5:import { OWLClass } from "@beep/ontology/Ontology.models";
packages/foundation/modeling/ontology/test/Fold.test.ts:698:        authority: "https://example.test/ontology/",
packages/foundation/modeling/ontology/test/Fold.test.ts:744:      expect(claimClass.iri).toBe("https://beep-effect.com/ns/ontology/Ontology.models/OWLClass");
packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts:27: * import { LibrarianInput } from "@beep/ontology/TaxonomyRegistry"
packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts:56: * import { FilingPath } from "@beep/ontology/TaxonomyRegistry"
packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts:75: * import type { LibrarianOutput } from "@beep/ontology/TaxonomyRegistry"
packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts:102: * import { TaxonomyConceptNotFound } from "@beep/ontology/TaxonomyRegistry"
packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts:126: * import { UnsupportedDocumentClass } from "@beep/ontology/TaxonomyRegistry"
packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts:160: * import { SemanticFoundationSeed } from "@beep/ontology/SemanticFoundation.seed"
packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts:161: * import { LibrarianInput, runLibrarianLoop } from "@beep/ontology/TaxonomyRegistry"
packages/foundation/modeling/ontology/test/Classification.test.ts:12:} from "@beep/ontology/Classification.models";
packages/foundation/modeling/ontology/test/Classification.test.ts:13:import { ClassificationRegistry } from "@beep/ontology/ClassificationRegistry";
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:45: * import { VendorSlicePath } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:75: * import { VendorLoadStatus } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:92: * import { VendorLoadKind } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:111: * import type { VendorLoadKind } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:149: * import type { VendorLoadStatus } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:165: * import { VendorManifestEntry } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:202: * import { VendorAlignmentManifestEntry } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:267: * import { VendorConceptSlice } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:301: * import { TaxonomyManifestReadError } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:325: * import { TaxonomyManifestParseError } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:349: * import { VendorSliceUnvetted } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:372: * import { VendorSliceReadError } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:395: * import { VendorSliceParseError } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:418: * import { VendorSliceAlignmentNotAdmitted } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:444: * import { VendorSlicePathEscape } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:477: * import { VendorSliceConceptMismatch } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:515: * import { VendorAlignmentTargetNotFound } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:548: * import { VendorAssetManifestRow } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:608: * import { decodeVendorManifestRow } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:637: * import { decodeLoadManifestEntry } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:688: * import { resolveVendorPath } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:742: * import { readVendorContent } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:939: * import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:992:   * import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader"
packages/foundation/modeling/ontology/src/Fold.projections.ts:39: * import type { JsonLdTerm } from "@beep/ontology/Fold.projections"
packages/foundation/modeling/ontology/src/Fold.projections.ts:64: * import type { JsonLdContext } from "@beep/ontology/Fold.projections"
packages/foundation/modeling/ontology/src/Fold.projections.ts:81: * import type { JsonLdNodeValue } from "@beep/ontology/Fold.projections"
packages/foundation/modeling/ontology/src/Fold.projections.ts:105: * import type { JsonLdNode } from "@beep/ontology/Fold.projections"
packages/foundation/modeling/ontology/src/Fold.projections.ts:126: * import type { JsonLdDocument } from "@beep/ontology/Fold.projections"
packages/foundation/modeling/ontology/src/Fold.projections.ts:221: * import { fold } from "@beep/ontology/Fold.assembly"
packages/foundation/modeling/ontology/src/Fold.projections.ts:222: * import { toContext } from "@beep/ontology/Fold.projections"
packages/foundation/modeling/ontology/src/Fold.projections.ts:375: * import { fold } from "@beep/ontology/Fold.assembly"
packages/foundation/modeling/ontology/src/Fold.projections.ts:376: * import { toJsonLd } from "@beep/ontology/Fold.projections"
packages/foundation/modeling/ontology/src/Fold.projections.ts:619: * import { fold } from "@beep/ontology/Fold.assembly"
packages/foundation/modeling/ontology/src/Fold.projections.ts:620: * import { toTurtle } from "@beep/ontology/Fold.projections"
packages/foundation/modeling/ontology/src/Vocabulary.models.ts:19: * import { VocabularySchemeKind } from "@beep/ontology/Vocabulary.models"
packages/foundation/modeling/ontology/src/Vocabulary.models.ts:40: * import { VocabularyPin } from "@beep/ontology/Vocabulary.models"
packages/foundation/modeling/ontology/src/Vocabulary.models.ts:57: * import { DocketingVocabulary } from "@beep/ontology/Vocabulary.seed"
packages/foundation/modeling/ontology/src/Vocabulary.models.ts:85: * import { PartyKindVocabulary } from "@beep/ontology/Vocabulary.seed"
packages/foundation/modeling/ontology/src/Vocabulary.models.ts:108: * import { VocabularyFailureReason } from "@beep/ontology/Vocabulary.models"
packages/foundation/modeling/ontology/src/Vocabulary.models.ts:131: * import { VocabularyError } from "@beep/ontology/Vocabulary.models"
packages/foundation/modeling/ontology/src/Vocabulary.seed.ts:16: * import { DocketingVocabulary } from "@beep/ontology/Vocabulary.seed"
packages/foundation/modeling/ontology/src/Vocabulary.seed.ts:297: * import { PartyKindVocabulary } from "@beep/ontology/Vocabulary.seed"
packages/foundation/modeling/ontology/src/Vocabulary.seed.ts:383: * import { LegalRoleVocabulary } from "@beep/ontology/Vocabulary.seed"
packages/foundation/modeling/ontology/src/Fold.markdown.ts:39: * import { MarkdownLinkMode } from "@beep/ontology/Fold.markdown"
packages/foundation/modeling/ontology/src/Fold.markdown.ts:60: * import type { MarkdownLinkMode } from "@beep/ontology/Fold.markdown"
packages/foundation/modeling/ontology/src/Fold.markdown.ts:77: * import { MarkdownOptions } from "@beep/ontology/Fold.markdown"
packages/foundation/modeling/ontology/src/Fold.markdown.ts:278: * import { fold } from "@beep/ontology/Fold.assembly"
packages/foundation/modeling/ontology/src/Fold.markdown.ts:279: * import { toMarkdown } from "@beep/ontology/Fold.markdown"
packages/foundation/modeling/ontology/src/Fold.models.ts:33: * import type { AbsoluteIri } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:59: * import type { SchemaHandle } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:76: * import type { Subject } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:92: * import type { LiteralScalar } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:113: * import type { TypedLiteral } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:133: * import type { TupleObject } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:155: * import type { Triple } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:171: * import type { OntologyFoldInput } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:201: * import { isSchemaHandle } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:285: * import { TripleValue } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:306: * import type { TripleValue } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:322: * import { SkosClassification } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:342: * import type { SkosClassification } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:363: * import { AssembledPredicateKind } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:383: * import type { AssembledPredicateKind } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:399: * import { FactLiteral } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:426: * import { FactObject } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:446: * import type { FactObject } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:447: * import { FactLiteral } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:470: * import { AssembledFact } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:503: * import { AssembledPredicate } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:541: * import { AssembledClass } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:576: * import { OntologyWarningCode } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:600: * import type { OntologyWarningCode } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:621: * import { OntologyValidationWarning } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:652: * import { AssembledOntology } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:689: * import { OntologyAssemblyErrorReason } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:718: * import type { OntologyAssemblyErrorReason } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:734: * import { OntologyAssemblyError } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.models.ts:775: * import { FactLiteral, isFactLiteral } from "@beep/ontology/Fold.models"
packages/foundation/modeling/ontology/src/Fold.assembly.ts:63: * import type { BoundComposer } from "@beep/ontology/Fold.assembly"
packages/foundation/modeling/ontology/src/Fold.assembly.ts:866: * import { fold } from "@beep/ontology/Fold.assembly"
packages/foundation/modeling/ontology/src/ClassificationRegistry.ts:61: * import { ClassificationRegistry } from "@beep/ontology/ClassificationRegistry"
packages/foundation/modeling/ontology/src/ClassificationRegistry.ts:96:   * import { ClassificationRegistry } from "@beep/ontology/ClassificationRegistry"
packages/foundation/modeling/ontology/src/VocabularyRegistry.ts:30: * import { VocabularyRegistry } from "@beep/ontology/VocabularyRegistry"
packages/foundation/modeling/ontology/src/VocabularyRegistry.ts:55:   * import { VocabularyRegistry } from "@beep/ontology/VocabularyRegistry"
```

#### MCP implementation and integration matches

```text
apps/practice-kg-mcp/src/smoke.ts
apps/practice-kg-mcp/src/runtime/Host.ts
apps/practice-gateway/test/OnboardingGuide.test.ts
apps/practice-gateway/test/LazyPracticeKg.test.ts
apps/practice-gateway/test/BoxDriveTools.test.ts
apps/practice-gateway/test/Approvals.test.ts
apps/practice-gateway/src/Server.ts
apps/practice-gateway/src/OnboardingGuide.ts
apps/practice-gateway/src/Approvals.ts
apps/professional-desktop/server/VaultSyncTransport.ts
apps/professional-desktop/server/OntologyMcpTransport.ts
apps/practice-review-hub/src/runtime/Layer.ts
packages/drivers/uspto-mcp/test/Server.test.ts
packages/drivers/uspto-mcp/src/bin.ts
packages/drivers/uspto-mcp/src/Server.ts
packages/tooling/tool/cli/test/research-library-inventory.test.ts
packages/ontology/config/test/Config.test.ts
packages/ontology/config/src/test.ts
packages/ontology/config/src/server.ts
packages/foundation/capability/mcp-kit/test/fixtures/McpClient.ts
packages/foundation/capability/mcp-kit/test/fixtures/FixtureHost.ts
packages/ontology/config/src/layer.ts
packages/foundation/capability/mcp-kit/test/ToolkitComposition.test.ts
packages/ontology/config/src/TestLayer.ts
packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts
packages/ontology/config/src/McpConfig.ts
packages/foundation/capability/mcp-kit/test/McpCaller.test.ts
packages/foundation/capability/mcp-kit/test/ApiKeyRequired.test.ts
packages/foundation/capability/mcp-kit/src/test/Conformance.test-kit.ts
packages/foundation/capability/mcp-kit/src/index.ts
packages/foundation/capability/mcp-kit/src/client.ts
packages/foundation/capability/mcp-kit/src/Version.ts
packages/foundation/capability/mcp-kit/src/ToolkitComposition.ts
packages/foundation/capability/mcp-kit/src/TierGate.ts
packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts
packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts
packages/drivers/nlp-mcp/test/SanitizedSpan.test.ts
packages/drivers/nlp-mcp/src/bin.ts
packages/drivers/nlp-mcp/src/Server.ts
packages/drivers/m365-mcp/test/Server.test.ts
packages/tooling/library/ai-sync/test/ai-sync.test.ts
packages/drivers/m365-mcp/test/SanitizedSpan.test.ts
packages/drivers/m365-mcp/test/OutboxServer.test.ts
packages/tooling/library/ai-sync/src/transforms.ts
packages/tooling/library/ai-sync/src/source-map.ts
packages/tooling/library/ai-sync/src/schemas.ts
packages/tooling/library/ai-sync/src/index.ts
packages/tooling/library/ai-sync/src/generator.ts
packages/drivers/m365-mcp/src/index.ts
packages/drivers/m365-mcp/src/bin.ts
packages/tooling/library/ai-sync/src/_generated/source-metadata.gen.ts
packages/drivers/m365-mcp/src/bin-outbox.ts
packages/tooling/library/ai-sync/src/_generated/schemas.gen.ts
packages/drivers/m365-mcp/src/Server.ts
packages/drivers/m365-mcp/src/OutboxServer.ts
packages/law-practice/server/test/PracticeKg.projections.test.ts
packages/drivers/gov-legal-mcp/test/Server.test.ts
packages/drivers/gov-legal-mcp/src/bin.ts
packages/drivers/gov-legal-mcp/src/Server.ts
packages/drivers/acp/test/compat.test.ts
packages/drivers/acp/test/client.test.ts
packages/drivers/acp/src/internal/normalize.ts
packages/drivers/acp/src/_generated/schema.gen.ts
packages/drivers/acp/src/_generated/schema-v1.gen.ts
packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts
packages/drivers/acp/src/AcpCompat.models.ts
packages/tooling/tool/cli/src/commands/HarnessLedger/internal/PruneWindow.ts
packages/law-practice/server/src/Tools.ts
packages/tooling/tool/cli/src/commands/Palantiri/Palantiri.tools.ts
```

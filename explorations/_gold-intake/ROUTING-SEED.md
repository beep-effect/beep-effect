# Wave Routing Seed — starting hypothesis (Phase 1 verifies & gates)

> Grounded against the **live** beep-effect `explorations/`+`goals/`+`packages/` tree on **2026-06-29** (10 parallel verification agents). This is a STARTING hypothesis to accelerate Phase 1 — it is **not** the final gated matrix. Phase 1 re-checks against the then-current tree, routes the remaining/long-tail nuggets, and produces the approved `ROUTING.md` + `routing.json`. Machine form: [`routing-seed.json`](./routing-seed.json).

It corrects several naive `GOLD_SYNTHESIS` beep-targets — e.g. `@beep/uspto` **already** targets ODP with File-Wrapper support; the gov drivers are **unowned net-new** work (reuse the `packages/drivers/{runpod,acp}` Effect codegen precedent, not Orval); `official-data-sync-foundation` is disjoint static-dataset (ISO/IANA/CLDR) work.

## Summary

| Cluster | Route | Target | Wave | New slug? |
|---|---|---|---|---|
| USPTO/patent driver depth (ODP, query DSL, File Wrapper, EPO, BigQuery) | **mixed** | `packages/drivers/uspto` | P1 | — |
| Anti-inference structured extraction + deterministic doc-structure | **mixed** | `goals/langextract-capability` | P1 | — |
| Gov/legal data drivers + OpenAPI codegen | **new-exploration** | `gov-legal-data-driver-codegen` *(new)* | P1 | `gov-legal-data-driver-codegen` |
| MCP server design (conditional registration, multi-provider auth, progressive disclosure) | **new-exploration** | `mcp-auth-gated-registration` *(new)* | P1 | `mcp-auth-gated-registration` |
| Layout-aware PDF extraction + OCR-need gating | **extend-goal** | `goals/file-processing-capability` | P2 | — |
| Citation lookup + verbatim-span grounding (hallucination guard) | **mixed** | `citation-grounding-hallucination-guard` *(new)* | P2 | `citation-grounding-hallucination-guard` |
| RAG ingestion + char-span chunking | **mixed** | `rag-retrieval-projection` *(new)* | P2 | `rag-retrieval-projection` |
| Court / jurisdiction controlled vocabulary | **new-exploration** | `court-vocabulary-resolver` *(new)* | P2 | `court-vocabulary-resolver` |
| Four-tier agent-memory schema w/ confidence + conflict edges (agentmemory, Apache-2.0) | **new-exploration** | `agent-memory-tiers-bitemporal-edges` *(new)* | P2 | `agent-memory-tiers-bitemporal-edges` |
| Effect orchestration patterns (Schedule, Layer provider, bounded fan-out) | **new-exploration** | `effect-orchestration-patterns` *(new)* | P2 | `effect-orchestration-patterns` |

Route mix: new-exploration×5, mixed×4, extend-goal×1.

## Per-cluster detail

### USPTO/patent driver depth (ODP, query DSL, File Wrapper, EPO, BigQuery)
- **Route:** mixed · **Wave:** P1
- **Primary target:** `packages/drivers/uspto` (exists)
- **Coordinate with:** `packages/drivers/epo (new EPO OPS OAuth2 driver)`, `packages/drivers/google-patents-bigquery (new BigQuery driver)`, `goals/official-data-sync-foundation`
- **Net-new (no existing home):**
  - PatentSearch query DSL builder + Lucene special-character escaping over ODP (existing searchApplications only forwards a raw ?q= string)
  - Prosecution/status-code vocabulary mapping and friendly->API field-name mapping for ODP File Wrapper fields
  - EPO OPS OAuth2 client (no EPO/OPS code anywhere in repo) -> new packages/drivers/epo
  - Google Patents BigQuery driver (no BigQuery code anywhere in repo) -> new packages/drivers/google-patents-bigquery
- **Already covered (do NOT rebuild):**
  - ODP endpoint targeting (data.uspto.gov /api/v1/patent/applications) — driver already targets ODP, not legacy PatentsView/PEDS, matching the gold's sunset guidance
  - File Wrapper document listing + download (getDocuments/downloadDocument with downloadOptionBag/downloadUrl extraction)
  - Application metadata projection + continuity (parent/child) resolution
  - Application-number / patent-number normalization + Lucene-free brand schemas
  - API-key scoping and SSRF allowlisting (assertAllowedRemoteUrl, same-host credential)
- **Rationale:** packages/drivers/uspto is a real Effect driver already pointed at the ODP (api/v1/patent/applications) implementing metadata, continuity, File Wrapper document list/download, and number normalization — so ODP/File-Wrapper basics are covered. But searchApplications only forwards a raw q= string (no query DSL or Lucene escaping), there is no prosecution/status-code or friendly->API field mapping, and ripgrep confirms zero EPO OPS or Google Patents BigQuery code anywhere in packages/ or goals/. The candidate goal official-data-sync-foundation is unrelated (ISO 4217 / IANA media types / tzdb / CLDR territories), not patents.
- **⚠ Cautions:** PatentsView is mid-sunset — keep the new DSL targeting ODP data.uspto.gov (the existing driver already does this); do NOT reintroduce legacy PatentsView/PEDS endpoints. EPO OPS and BigQuery both require credentialed auth (OAuth2 / GCP), which is out of scope for offline verification and needs secrets handling. Source gold MCP repos (uspto-patents-mcp, uspto_pfw_mcp, patents-mcp-server) are external — treat as reference only; reimplement DSL/escaping and field-mapping natively in Effect rather than copying, and confirm their licenses before lifting code. No goal currently owns the uspto driver, so the ODP-depth extensions need a new patent-driver-depth exploration packet pointing at packages/drivers/uspto.

### Anti-inference structured extraction + deterministic doc-structure
- **Route:** mixed · **Wave:** P1
- **Primary target:** `goals/langextract-capability` (exists)
- **Coordinate with:** `packages/foundation/capability/langextract`, `packages/foundation/capability/nlp`, `goals/law-practice-office-action-extraction-rung`, `deterministic-doc-structure-extraction`
- **Net-new (no existing home):**
  - Anti-inference / 'LLM as pure OCR' prompt discipline as an explicit extraction-target/prompt contract (no anti-inference prompt mode exists in @beep/langextract today)
  - Partial(candidate) vs Complete(authoritative) streaming gate — langextract V1 SPEC explicitly DEFERS streaming, so this is a net-new domain-event/gating model needing a standards decision
  - doc-haus deterministic regex contract-structure extraction (defined terms, cross-refs, parties, amendments) with char offsets + redline candidate gate — no deterministic legal/contract-structure extractor exists in @beep/nlp or anywhere in repo
- **Already covered (do NOT rebuild):**
  - Schema-first LLM structured extraction grounded to exact half-open source character spans — already built in packages/foundation/capability/langextract (Extraction, Target, Service, Alignment, Handoff modules) and driven by goals/langextract-capability
  - Deterministic source-alignment + span/provenance primitives and AnnotatedDocument/Handoff IR — already in @beep/nlp and @beep/langextract Alignment
  - Candidate-gate-into-law-domain plumbing for grounded extractions — claimed by goals/law-practice-office-action-extraction-rung (GroundedExtraction[] -> IrToLaw)
- **Rationale:** langextract-capability (goal + implemented @beep/langextract package with Extraction/Target/Service/Alignment/Handoff barrels) already owns provider-neutral schema-first LLM extraction grounded to char spans, so the TalentScore "pure-OCR" schema extends it rather than starting fresh; but that goal's SPEC explicitly defers streaming and the anti-inference prompt mode, and neither @beep/nlp nor any goal contains the doc-haus deterministic regex contract-structure extractor (defined terms/cross-refs/parties/amendments with offsets + redline gate), so that half is a genuine gap warranting a new deterministic-doc-structure-extraction exploration coordinated with @beep/nlp.
- **⚠ Cautions:** BAML is BoundaryML's external DSL/runtime (Apache-2.0) and TalentScore/doc-haus are external private projects — port the PATTERNS (anti-inference prompt, Partial/Complete gate, regex doc-structure), do not copy code or adopt the BAML runtime. The Partial(candidate)/Complete(authoritative) streaming gate collides with langextract V1's explicit 'streaming deferred / raw AI stream chunks are not public API' constraint, so it requires a standards decision before extending the goal. Keep the deterministic regex extractor out of drivers/provider deps; if attached to @beep/nlp it must stay provider-neutral and span-bearing (not routed through the entity-level-span-lossy AnnotatedDocument envelope, per the office-action rung constraint).

### Gov/legal data drivers + OpenAPI codegen
- **Route:** new-exploration · **Wave:** P1
- **Primary target:** `gov-legal-data-driver-codegen` (NET-NEW packet)
- **Coordinate with:** `@beep/courtlistener`, `packages/drivers/ecfr`, `@beep/dol`, `@beep/federal-register`, `packages/drivers/govinfo`, `explorations/solo-firm-docketing`, `packages/drivers/runpod`, `packages/drivers/acp`
- **Net-new (no existing home):**
  - OpenAPI single-spec -> dual (Effect SDK + MCP server) codegen pipeline ported onto beep's Effect/effect-Schema/HttpApi stack (us-legal-tools uses Orval/axios/Zod; port the architecture, not the code)
  - Implement the four bare skeleton drivers @beep/{courtlistener,ecfr,dol,federal-register} (currently only export VERSION='0.0.0')
  - CourtListener V4 Token-header auth client layer (Authorization: Token <key>, env COURTLISTENER_API_TOKEN, baseURL /api/rest/v4)
  - Declarative auth+retry+cache client factory (us-gov-open-data-mcp pattern) generalized as an Effect HTTP layer across drivers
  - Per-driver env-auth matrix + conditional MCP tool registration (CourtListener/GovInfo/DOL key-gated; eCFR/FedReg always-on keyless)
  - Finish PARTIAL @beep/govinfo: add client/auth(api.data.gov api_key)/retry/cache layer on top of existing Search HttpApi domain contracts
- **Already covered (do NOT rebuild):**
  - @beep/govinfo domain layer (Search HttpApi contract + value models like SearchResult/PackageInfo/GranuleMetadata) already scaffolded
  - Repo already has an Effect-native OpenAPI/JSON-schema codegen precedent in packages/drivers/runpod and packages/drivers/acp (openapi.json + scripts/generate.ts) to reuse instead of adopting Orval/axios
  - Static official-dataset sync (ISO4217/IANA/CLDR) is owned separately by goals/official-data-sync-foundation -- out of scope for this cluster, do not rebuild
- **Rationale:** The four gov/legal drivers are bare VERSION-only skeletons and govinfo is only partially scaffolded (Search HttpApi contract, no client/auth), and no goal or exploration currently drives their implementation: official-data-sync-foundation is a disjoint static-dataset (ISO/IANA/CLDR) goal, and solo-firm-docketing is a build-vs-buy decision packet frozen at its align review gate with an empty MAP.md. The gold (an OpenAPI->SDK+MCP codegen pipeline plus auth/retry/cache patterns across five APIs) is genuinely net-new infrastructure that warrants its own exploration, coordinating with the existing skeletons and the runpod/acp codegen precedent.
- **⚠ Cautions:** Licensing: us-legal-tools is MIT but the value is the codegen PIPELINE/PATTERNS, not the Orval-generated axios/Zod output -- port the architecture onto Effect/HttpApi/effect-Schema rather than copying; us-gov-open-data-mcp license is unverified, so treat as reimplement-don't-copy. API state (verified 2026-06, all five upstreams ACTIVE): CourtListener V4 ENFORCES auth (anonymous = 401), header must be literally 'Authorization: Token <key>' (DRF TokenAuthentication, not Bearer/Api-Key), target /api/rest/v4/ (V3 legacy), and the SCOTUS visualization endpoints are deprecated -- do not generate them. GovInfo + DOL require api.data.gov api_key (query param); eCFR and Federal Register are keyless (FedReg is an 'unofficial prototype', GovInfo is the official source). Orval @orval/mcp generator works in single-mode only (one spec per config) -- relevant if Orval is used directly. Cross-cutting deprecation (NOT in this repo, flag for any sibling patents driver): PatentsView ended Feb 2025; PatentSearch -> USPTO Open Data Portal (data.uspto.gov) on 2026-03-20 with mandatory key reissue; legacy USPTO Developer Hub decommissioned 2026-06-05.

### MCP server design (conditional registration, multi-provider auth, progressive disclosure)
- **Route:** new-exploration · **Wave:** P1
- **Primary target:** `mcp-auth-gated-registration` (NET-NEW packet)
- **Coordinate with:** `packages/drivers/nlp-mcp`, `packages/drivers/m365-mcp`, `goals/m365-mcp`, `goals/nlp-adjunct-port`, `packages/drivers/uspto`
- **Net-new (no existing home):**
  - Conditional/credential-keyed Toolkit composition — build the Toolkit only from driver Layers whose Effect Config resolved successfully (CourtListener public vs USPTO/GovInfo/DOL keyed)
  - Tier-gating of write-vs-read tools at the candidate->approved wall (no real src implements requiresAuth/tier-gate today)
  - Graceful 'API key missing' as structured content — a shared helper returning {error: api_key_required, tool, envVar, registrationUrl} instead of throwing
  - Progressive-disclosure named field tiers (minimal/balanced/complete) projection / server-side response reshaping for context reduction (uspto_pfw field_configs pattern)
  - readOnly/idempotent tool-def hint conventions surfaced on tool metadata
- **Already covered (do NOT rebuild):**
  - Two Effect-native MCP server scaffolds already exist: @beep/nlp-mcp (Server.ts makeServerLayer + McpServer.toolkit + McpServer.layerStdio, Tools/Handlers split, bin.ts; ~42 tools) and @beep/m365-mcp (same pattern, read-only v1) — do NOT re-scaffold
  - Schema-first Tool.make I/O with failureMode:'return' -> typed AiToolError already standard in both servers
  - Span/data hygiene (counts/sizes/paths only, never raw content/tokens) already enforced
  - NLP tool-surface expansion + streaming suite owned by goals/nlp-adjunct-port — not part of this cluster
- **Rationale:** beep already ships both MCP servers named as gold beep-targets (packages/drivers/nlp-mcp and m365-mcp confirmed present with the full Toolkit + layerStdio scaffold), so the bare-scaffold lessons are dups; the GOLD_SYNTHESIS itself (lines 1572-1697) flags the high-value gaps as conditional/auth-gated registration, progressive-disclosure field tiers, and a structured api_key_required helper. Grep over goals/*/SPEC.md and packages confirms no existing goal owns these and no real src implements requiresAuth/tier-gate/api_key_required, so this is a genuine cross-cutting gap warranting a new packet that coordinates the existing MCP drivers and future per-driver (USPTO) servers rather than extending the NLP- or M365-specific goals.
- **⚠ Cautions:** PatentsView API sunset: api.patentsview.org 301-redirects to data.uspto.gov/odp (HTML not JSON) — encode in @beep/uspto base-URL + UsptoEndpointSunset tagged error; target ODP from the start. Licensing: patents-mcp-server / mcp-uspto / uspto_pfw are MIT and portable; mike is unknown-license and screenpipe/harvest-mcp flagged unknown — reimplement-don't-copy. Scope note: the 'multi-provider auth/LLM fallback layer' strand in this cluster's title spans the four LLM drivers (@beep/anthropic, openai-compat, xai, venice-ai) and is arguably a separate provider-abstraction cluster; keep this packet focused on MCP-side credential-keyed registration + progressive disclosure and cross-link the LLM-fallback work rather than absorbing it.

### Layout-aware PDF extraction + OCR-need gating
- **Route:** extend-goal · **Wave:** P2
- **Primary target:** `goals/file-processing-capability` (exists)
- **Coordinate with:** `packages/foundation/capability/file-processing`, `packages/drivers/tika`, `goals/langextract-capability`
- **Net-new (no existing home):**
  - page_needs_ocr text-vs-OCR heuristic / quality gate before extraction (doctor + lawyergpt/legalmind-ai)
  - Layout-aware PDF text extraction with margin crop + skew-line filtering
  - OCR confidence artifact suppression
  - MIME/encoding detection-and-repair logic
  - Concrete OCR/PDF-diagnostics driver implementation (future @beep/poppler / @beep/docling / Tesseract) backing the deferred OCR strategy
- **Already covered (do NOT rebuild):**
  - OCR strategy flag (whether OCR-capable strategies are allowed) — already a Strategy field
  - ocr-disabled / encrypted-source / format-out-of-scope skip reasons — already modeled in FileProcessingSkipReason + SkippedProcessFileResult
  - Schema-first extraction IR with skippedCapabilities, typed failures/warnings
  - PDF text-layer extraction via @beep/tika (V1)
  - MimeType / FileExtension primitives in @beep/schema
- **Rationale:** The active goals/file-processing-capability packet (P1 complete, P2-P5 pending) already owns the product-neutral file-extraction capability and has scaffolded the OCR strategy flag plus ocr-disabled skip reason, while explicitly deferring all OCR implementation, layout-aware PDF, and Poppler/Docling drivers to future phases (SPEC Locked Decisions + manifest engineMatrix laterRole). The gold cluster's page_needs_ocr gating, layout-aware crop/skew extraction, confidence suppression, and MIME/encoding repair are exactly that deferred OCR/PDF-diagnostics layer, so they extend this goal rather than forming a new exploration.
- **⚠ Cautions:** doctor is BSD-2 (permissive: may adapt with attribution, not vendored wholesale). lawyergpt/legalmind-ai license is unknown — reimplement the heuristic, do not copy. SPEC explicitly defers OCR to a future strategy + driver boundary (engineMatrix lists Poppler for PDF diagnostics/bbox-text comparison and Docling for OCR/layout-aware extraction as future-only); this cluster is the concretization of that deferred work, so it lands as a new OCR/PDF-diagnostics phase rather than reopening the completed P1 vertical proof.

### Citation lookup + verbatim-span grounding (hallucination guard)
- **Route:** mixed · **Wave:** P2
- **Primary target:** `citation-grounding-hallucination-guard` (NET-NEW packet)
- **Coordinate with:** `goals/epistemic-claim-lifecycle-gate`, `goals/provenance-shared-claim-kernel`, `packages/foundation/capability/langextract`, `packages/epistemic/domain`
- **Net-new (no existing home):**
  - eyecite-style legal citation parser: detect citations in text and emit exact char spans (no parser exists; rg for eyecite/citation/reporter returns only test-reporter and unrelated hits)
  - UnmatchedCitation candidate->resolved RESOLUTION lifecycle (resolving a parsed citation to an authority/reporter) — distinct from the generic claim-admission ClaimLifecycle
  - verbatim-citation / ground-before-cite hallucination-guard CONTRACT (mike): require a verified verbatim span before a citation may be emitted; composes EvidenceSpan + ClaimGate + citation parse but is itself net-new
  - cross-chunk straddle verification: langextract Alignment matches against a single source string only, so quote verification across chunk boundaries has no home
- **Already covered (do NOT rebuild):**
  - exact char-offset span grounding primitive — @beep/provenance TextAnchor + @beep/epistemic-domain EvidenceSpan {startChar,endChar,quote,confidence}
  - candidate->...->admitted lifecycle machinery + SHACL ClaimGate verdict — goals/epistemic-claim-lifecycle-gate (ClaimLifecycle/ClaimGate/ClaimProjection)
  - verbatim quote verification with normalized->raw offset mapping — langextract Alignment (findExact / findLesser via lowerWithSourceOffsets normalized->source offset arrays / findFuzzy Levenshtein), emitting match_exact|match_lesser|match_fuzzy|unaligned with char Spans
- **Rationale:** The grounding substrate already exists: @beep/epistemic-domain EvidenceSpan + @beep/provenance TextAnchor give exact char-span primitives, goals/epistemic-claim-lifecycle-gate gives the candidate->admitted lifecycle + SHACL gate, and packages/foundation/capability/langextract Alignment already does verbatim quote verification with normalized->raw offset mapping (findLesser's lowerWithSourceOffsets) and fuzzy fallback. What has NO home anywhere in packages/**/src or goals/** is the citation layer itself — an eyecite-style citation parser, the citation candidate->resolved resolution lifecycle, the ground-before-cite hallucination-guard contract, and cross-chunk straddle — so the cluster is mixed: reuse the epistemic + langextract substrate, add a new exploration packet for the citation/guard capability.
- **⚠ Cautions:** AGPL: eyecite/courtlistener and mike are AGPL — reimplement the citation-parse + ground-before-cite contract from spec, do NOT copy source. doc-haus license unknown — treat normalized->raw offset + straddle logic as reference only; note that langextract Alignment already implements the normalized->raw mapping in MIT-clean repo code, so prefer extending it over porting doc-haus. Reuse (do not rebuild) the existing ClaimLifecycle/ClaimGate pattern and EvidenceSpan/TextAnchor rather than introducing a parallel citation lifecycle. Scope: keep citation/IP-law vocabulary out of the epistemic slice (per epistemic SPEC non-goals); the new packet is a downstream consumer composing epistemic + langextract via public surface, alongside law-practice-office-action-spike / ip-law-knowledge-graph. PatentsView sunset is not relevant to this cluster.

### RAG ingestion + char-span chunking
- **Route:** mixed · **Wave:** P2
- **Primary target:** `rag-retrieval-projection` (NET-NEW packet)
- **Coordinate with:** `goals/langextract-capability`, `goals/ip-law-knowledge-graph`, `packages/foundation/capability/semantic-web`, `packages/foundation/capability/langextract`
- **Net-new (no existing home):**
  - Hybrid 3-channel RRF retrieval fusion (embedding cosine + FTS/BM25 + literal-phrase) with char-span citations — the GraphRAG retrieval service is PLANNED, not built
  - pgvector HNSW vector_cosine_ops projection schema + thresholded top-k cosine retrieval (vectors as rebuildable projection, not authority)
  - Breadcrumb-prefixed embedding strategy (docName > section prefix to keep boilerplate separable)
  - Bounded-concurrency ingestion workflow (semaphore + per-file/per-chunk transaction) re-expressed as Effect Stream.mapEffect with bounded parallelism
  - Offset-preserving char-span chunker (~2000-char chunks carrying charStart/charEnd) sitting between @beep/md and @beep/langextract
- **Already covered (do NOT rebuild):**
  - Span-grounded extraction substrate with char offsets and fuzzy alignment — @beep/langextract GroundedExtraction/AlignmentStatus already exists
  - Char-span provenance contract — @beep/provenance TextAnchor (text.slice(start,end)===quote)
  - PDF/DOCX text extraction + OCR-capable ingestion plumbing — @beep/file-processing + @beep/tika P1 vertical already merged (PR #262)
  - Local corpus extraction/cataloging — goals/oppold-corpus-pipeline completed
- **Rationale:** All three named candidates are the wrong home: goals/file-processing-capability is extraction-only and explicitly lists "knowledge-graph extraction or assembly" and OCR out of scope; goals/oppold-corpus-pipeline is completed-retained salvage/catalog/extract and explicitly excludes embeddings, LLM processing, and KG/epistemic ingestion; explorations/solo-firm-docketing is PACER/docketing, unrelated. The repo's own GOLD_SYNTHESIS.md (lines 231-235, 353-355, 383-386) routes these exact nuggets to a planned-but-unbuilt FalkorDB/GraphRAG retrieval projection over @beep/semantic-web plus a char-span chunker between @beep/md and the active goals/langextract-capability (currently P4 Implement); the retrieval/RRF/pgvector/bounded-concurrency-ingestion projection layer has no execution packet, so it needs a new exploration while the chunker piece attaches to langextract.
- **⚠ Cautions:** lawyergpt license is UNKNOWN — reimplement patterns, do not copy source. lawyergpt pins Gemini embeddings: embedding-001/embedding-gecko-001/gemini-embedding-exp-03-07 shut down Oct 2025 and text-embedding-004 shut down Jan 14 2026; current GA is gemini-embedding-001 (3072-dim default, Matryoshka-truncatable) so any pgvector column dimension + HNSW index must match chosen output_dimensionality. beep is provider-neutral/local-first (PGlite+Drizzle, local ONNX embeddings) so do NOT pin Gemini and keep vectors as projection, not authority. doc-haus is MIT (safe to study/adapt). lawyergpt's un-gated tool-calling RAG (raw chunks to LLM, "use your own knowledge") is an explicit ANTI-PATTERN beep rejects — outputs must carry CandidateClaim+Evidence provenance spans through the ClaimGate, not bare chunks.

### Court / jurisdiction controlled vocabulary
- **Route:** new-exploration · **Wave:** P2
- **Primary target:** `court-vocabulary-resolver` (NET-NEW packet)
- **Coordinate with:** `goals/official-data-sync-foundation`, `@beep/courtlistener`, `goals/ip-law-knowledge-graph`
- **Net-new (no existing home):**
  - courts-db canonical court entity dataset (~2,809 courts) with CourtListener IDs
  - regex court-name normalization dictionary
  - court-string resolver with partial-match span gating
  - data-sync ingestion of the courts-db dataset into @beep/data + schema literals/codecs
- **Already covered (do NOT rebuild):**
  - abstract Court graph node (ip-law-knowledge-graph p1 schema, _tag Court)
  - abstract Jurisdiction graph node (ip-law-knowledge-graph p1 schema)
- **Rationale:** The `@beep/courtlistener` driver is a bare stub (only `VERSION`), and no courts-db dataset, regex normalization dictionary, or span-gated court-string resolver exists anywhere in packages/, @beep/data, or goals. ip-law-knowledge-graph only defines abstract OWL Court/Jurisdiction graph nodes (PENDING), not a controlled vocabulary or resolver, and official-data-sync-foundation provides the dataset-sync mechanism but does not own court data. The vocabulary dataset plus resolver is a coherent net-new capability warranting its own packet that ingests via official-data-sync-foundation and lands in/alongside the courtlistener driver.
- **⚠ Cautions:** courts-db is BSD-2 (permissive, attribution-friendly) — safe to vendor the dataset/regex dictionary with attribution, but it is a freelawproject/CourtListener-adjacent asset; treat the resolver logic as reimplement-don't-copy and avoid pulling in any AGPL CourtListener server code. Scope: keep this as the vocabulary/resolver vertical only — graph-shape Court/Jurisdiction nodes remain owned by ip-law-knowledge-graph; dataset ingestion plumbing remains owned by official-data-sync-foundation. P2 because it depends on the official-data-sync-foundation pipeline and is downstream of the IP-graph schema.

### Four-tier agent-memory schema w/ confidence + conflict edges (agentmemory, Apache-2.0)
- **Route:** new-exploration · **Wave:** P2
- **Primary target:** `agent-memory-tiers-bitemporal-edges` (NET-NEW packet)
- **Coordinate with:** `goals/epistemic-claim-lifecycle-gate`, `standards/memory-architecture`, `goals/agentic-professional-runtime`, `goals/trustgraph-port`, `explorations/_gold-intake`
- **Net-new (no existing home):**
  - Explicit four-tier consolidation taxonomy enum (working/episodic/semantic/procedural) — agentmemory ConsolidationTier; nothing in packages (rg found zero hits)
  - accessCount/strength/sourceMemoryIds + retention/decay scoring (salience x exp temporal decay + reinforcement, hot/warm/cold/evictable tiers) — no working-memory/decay tier exists
  - rejected + superseded ClaimLifecycle STATES (today 'rejected' is only a ClaimGate verdict; ClaimLifecycle is forward-only candidate->shape_valid->consistency_checked->admitted)
  - Conflict/contradiction edges + per-anchor supersede pass before admission (doc-haus redline-gate semantics) — no conflict detection exists
  - Bitemporal versioned claim/fact edges (tvalid/tvalidEnd, version/supersededBy/isLatest, sourceObservationIds, EdgeContext) with NEVER-overwrite/always-version semantics — explicitly DEFERRED by the completed epistemic gate; no persisted edge store
  - Triple-stream BM25+vector+graph retrieval fused via RRF (k=60) with weight renormalization — planned FalkorDB/GraphRAG projection, not built
- **Already covered (do NOT rebuild):**
  - Per-fact confidence: Evidence/EvidenceSpan carry Confidence = UnitInterval (packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts) + startChar/endChar/quote char-span grounding
  - Semantic tier itself: CandidateClaim + Evidence + ClaimLifecycle + SHACL-backed ClaimGate built and shipped (epistemic-claim-lifecycle-gate is completed-retained; 11 tests green)
  - Provenance substrate: @beep/semantic-web PROV-O + bounded SHACL + @beep/provenance TextAnchor (the never-overwrite edge's provenance fields align here)
  - The four-LAYER memory taxonomy is already a binding decision record in standards/memory-architecture/01-memory-layer-taxonomy.md (conceptual, not implemented)
- **Rationale:** GOLD_SYNTHESIS item 8 plus the bitemporal/RRF table rows already route this cluster to "extend CandidateClaim/ClaimLifecycle + borrow doc-haus redline-gate," but the natural extension home (goals/epistemic-claim-lifecycle-gate) is lifecycle:completed-retained and explicitly DEFERRED the bitemporal store, FalkorDB/GraphRAG, and rejected/superseded states — so these cannot be an in-place extend-goal. rg confirms per-fact confidence + the semantic tier already exist, but ConsolidationTier/accessCount/strength/RRF/bitemporal edges have zero presence in packages. The coherent net-new capability (tier schema + decay + conflict edges + never-overwrite bitemporal edges + RRF retrieval) needs a fresh wedge packet that graduates into a NEW goal extending the epistemic slice, with standards/memory-architecture as the governing taxonomy and trustgraph-port as the FalkorDB/GraphRAG retrieval home.
- **⚠ Cautions:** Licensing: agentmemory is Apache-2.0 (permissive — port with attribution), but it is plain TS + Zod v4 + the bespoke iii-sdk, NOT Effect/effect-Schema, so DI/Layer/service patterns do NOT transfer — reimplement data models in Effect-Schema (LiteralKit/Model.Class), reuse only the algorithms/shapes. Do NOT copy the XML-tag extraction prompt's regex parser (parseTemporalGraphXml) — it is brittle and lacks beep's required char-span grounding; reuse the prompt SHAPE only and add span grounding (or use BAML/Standard-Schema structured output). RRF: validate k=60 default (Cormack 2009; k in [40,80] comparable), fuse on rank only, do not score-normalize across streams. The RRF/FalkorDB-projection sub-capability overlaps GOLD_SYNTHESIS item 9 and goals/trustgraph-port — coordinate to avoid building two retrieval layers. PatentsView/USPTO-ODP deprecations appear in the agentmemory web-enrichment but are out of scope for this memory cluster. Keep zero IP-law vocabulary in the epistemic/memory slice (federation + no-vocabulary invariants from the completed gate).

### Effect orchestration patterns (Schedule, Layer provider, bounded fan-out)
- **Route:** new-exploration · **Wave:** P2
- **Primary target:** `effect-orchestration-patterns` (NET-NEW packet)
- **Coordinate with:** `standards/effect-first-development.md`, `.patterns/error-handling.md`, `packages/drivers/anthropic`, `goals/effect-native-migration`
- **Net-new (no existing home):**
  - Centralized Effect Schedule retry-policy library (DRY extraction: today retry policies are inline per-driver as Schedule.exponential in packages/drivers/anthropic/src/Anthropic.service.ts:106, Anthropic.repair.ts:105, and openai-compat; no shared foundation/common retry-policy module exists)
  - Layer.unwrapEffect-based provider selection (zero usages of Layer.unwrapEffect anywhere under packages/**/src; provider wiring is currently static Layer composition via ai-provider-cli/openai-compat, not effectful provider selection)
- **Already covered (do NOT rebuild):**
  - Failure-vs-defect split in LLM client wrapper: documented as law EF-31 in standards/effect-first-development.md and implemented via TaggedErrorClass in packages/drivers/anthropic/src/Anthropic.errors.ts
  - Schedule-based retry as a pattern: documented EF-25/26 in standards and already used (Schedule.exponential + ExecutionPlan) in anthropic + openai-compat drivers
  - Bounded fan-out concurrency: documented as law EF-27 ('Parallel fan-out needs explicit concurrency') in standards/effect-first-development.md and applied operationally in goals/effect-native-migration (one-agent-per-package bounded parallel waves)
- **Rationale:** The three candidate targets do not own this cluster: goals/effect-native-migration is scoped to migrating native JS Map/Set/String/Date/JSON to Effect-native data types (not runtime orchestration), while standards/effect-first-development.md and .patterns already document the *conceptual* laws (EF-25/26 retry-Schedule, EF-27 bounded fan-out, EF-31 failure-vs-defect). The genuinely net-new work is consolidation into a shared library: a centralized retry-policy module (policies are currently duplicated inline per-driver) and Layer.unwrapEffect provider selection, which has zero occurrences in the repo. No existing exploration/goal covers Effect orchestration as a library.
- **⚠ Cautions:** Largely a library-extraction/consolidation task, not greenfield — the laws and per-driver implementations already exist, so scope must avoid rebuilding documented standards or working anthropic/openai-compat retry+error code; reuse and DRY-extract them instead. No licensing concerns (all first-party Effect code). Note Layer.unwrapEffect must be validated against the vendored effect-v4 API before adopting.

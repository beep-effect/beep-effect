# Gold Intake — Routing Matrix

> Reconciliation of all 219 gold nuggets (explorations/_gold-intake/research/gold-catalog.json) against the live tree.
> Source of truth: routing.json (this file is its human view). Generated 2026-06-29.

All 219 gold nuggets are routed — coverage is 219/219 with zero unrouted and zero duplicated IDs — across 29 clusters. By route the split is: **10 new-exploration** clusters (116 nuggets), **5 mixed** clusters (64 nuggets), **6 extend-goal** clusters (26 nuggets), **0 attach-existing** clusters, and **8 dup-skip** clusters (13 nuggets). Headline: the repo already owns most of the substrate — the file-processing/langextract/provenance/epistemic kernels, both Effect-native MCP servers, the four LLM drivers, the hand-rolled `@beep/uspto` ODP core, and the law-practice office-action loop — so the gold is overwhelmingly content and patterns landing *onto* that substrate (extend-in-place notes, query-DSL/auth/retrieval depth, and a handful of genuinely net-new wedges), not a greenfield rebuild.

## Graduate-now decision (Wave-1 scope — needs sign-off)

Two different lenses pick the Wave-1 graduate-now set, and they only partly agree. `wave` on every cluster is the **MODE of its member nuggets' catalog priorities** (`waveBasis` — data-driven, reproducible). Graduate-now scope is a **separate strategic call** to confirm at the matrix gate; the two candidate sets below diverge, and all ~13 packeted wedges still reach research-complete in Phase 2 regardless of which wave they sit in.

**Strategic (approved-plan foundation-unblockers)**
- gov-legal-data-driver-codegen
- mcp-auth-gated-registration
- uspto-patent-driver-depth
- langextract anti-inference (Case-A research note on goals/langextract-capability — NOT a new packet)

**Data-driven (nugget-priority mode = P1)**
- gov-legal-data-driver-codegen
- citation-grounding-hallucination-guard
- effect-orchestration-patterns
- Agent skills + cost-tiered routing + ethical-wall identity (extend goals/agentic-professional-runtime)

**Overlap (in both sets):** gov-legal-data-driver-codegen — the only wedge the strategic plan and the data both elevate.

**Promotion candidates** (data-P1 wedges the strategic set does not yet include):
- citation-grounding-hallucination-guard (7×P1 nuggets; GOLD_SYNTHESIS Wave-1 explicitly lists the courtlistener+mike citation guardrail)
- effect-orchestration-patterns (5×P1 nuggets)

> Note: The approved plan designates the strategicRecommended foundation-unblockers for graduate-now. The data (nugget-priority MODE) elevates a partly-different set. Only gov-legal-data-driver-codegen is in both. Resolve the graduate-now set at the matrix gate; ALL ~13 packeted wedges still reach research-complete in Phase 2 regardless of wave.

## Wave 1 (data-P1 clusters)

| Cluster | Route | primaryTarget (exists) | proposedSlug | #nuggets | P1/P2/P3 | netNew (summary) |
| --- | --- | --- | --- | --- | --- | --- |
| Gov/legal data drivers + OpenAPI codegen | new-exploration | gov-legal-data-driver-codegen ✗ | gov-legal-data-driver-codegen | 19 | 7/6/6 | OpenAPI single-spec → dual (Effect SDK + MCP) codegen pipeline; implement 4 bare driver skeletons; CourtListener V4 Token-header auth |
| Citation lookup + verbatim-span grounding (hallucination guard) | new-exploration | citation-grounding-hallucination-guard ✗ | citation-grounding-hallucination-guard | 11 | 7/3/1 | eyecite-style citation parser emitting exact char spans; UnmatchedCitation candidate→resolved lifecycle; ground-before-cite contract |
| Effect orchestration patterns (Schedule, Layer provider, bounded fan-out) | new-exploration | effect-orchestration-patterns ✗ | effect-orchestration-patterns | 8 | 5/2/1 | centralized Schedule retry-policy library (DRY-extract per-driver inline); Layer.unwrapEffect provider selection (zero usages today) |
| Agent skills + cost-tiered routing + ethical-wall identity | mixed | goals/agentic-professional-runtime ✓ | — | 6 | 4/2/0 | cost-tiered tool-routing Skill + not-legal-advice gate; CurrentUser Context.Tag + RpcMiddleware matter-scoped filter; triage gate |

## Wave 2 / Wave 3 — research-complete + queue

| Wave | Cluster | Route | primaryTarget (exists) | proposedSlug | #nuggets | P1/P2/P3 | netNew (summary) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P2 | USPTO/patent driver depth (ODP, query DSL, File Wrapper, EPO, BigQuery) | mixed | packages/drivers/uspto ✓ | uspto-patent-driver-depth | 26 | 6/15/5 | Lucene query-term escaping + length cap; friendly→API nested field mapping; ODP structured filter/rangeFilter/sort POST + query-DSL |
| P2 | Layout-aware PDF extraction + OCR-need gating | extend-goal | goals/file-processing-capability ✓ | — | 13 | 4/6/3 | page_needs_ocr gating heuristic; margin-crop + skew/transform-matrix filtering; two-pass text-then-OCR keep-longer orchestration |
| P2 | Court / jurisdiction controlled vocabulary | new-exploration | court-vocabulary-resolver ✗ | court-vocabulary-resolver | 14 | 1/8/5 | courts-db ~2,809-court dataset w/ CourtListener IDs; regex court-name normalization dictionary; partial-match span-gated resolver |
| P2 | Anti-inference structured extraction + deterministic doc-structure | mixed | goals/langextract-capability ✓ | deterministic-doc-structure-extraction | 15 | 3/9/3 | Partial/Complete streaming gate as Effect Stream (conflicts langextract lock); deterministic no-model regex contract/entity extractors |
| P2 | Four-tier agent-memory schema w/ confidence + conflict edges | new-exploration | agent-memory-tiers-bitemporal-edges ✗ | agent-memory-tiers-bitemporal-edges | 15 | 5/7/3 | four-tier consolidation taxonomy enum; accessCount/strength + retention/decay scoring; rejected+superseded ClaimLifecycle states |
| P2 | MCP server design (conditional registration, multi-provider auth, progressive disclosure) | new-exploration | mcp-auth-gated-registration ✗ | mcp-auth-gated-registration | 28 | 11/12/5 | credential-keyed Toolkit composition (only resolved-Config Layers); tier-gate write-vs-read tools; structured api_key_required content |
| P2 | Ingestion security + secret/PII governance | new-exploration | ingestion-security-secret-governance ✗ | ingestion-security-secret-governance | 10 | 1/7/2 | prompt-injection regex detector at retrieval boundary (flag-not-block); ordered secure-storage→env secret chain; per-user AES-256-GCM vault |
| P2 | Multi-provider LLM dispatch + graceful fallback | new-exploration | multi-provider-llm-dispatch-fallback ✗ | multi-provider-llm-dispatch-fallback | 8 | 0/7/1 | shared dispatch Layer: user-key>env>CLI precedence + Layer.orElse fallback; per-provider default-model resolution; typed PROVIDER_REGISTRY |
| P2 | Governance control plane (bulk-mutation dry-run, audit trace) | extend-goal | goals/agent-governance-control-plane ✓ | — | 2 | 0/1/1 | previewable filter-gated bulk-mutation (dryRun + audit trail); tamper-evident agent LLM+tool-call audit trace |
| P2 | Claim-lifecycle gate (SHACL severity, transition guard, deterministic scoring) | mixed | goals/epistemic-claim-lifecycle-gate ✓ | — | 3 | 0/2/1 | SHACL severity reporting + non-blocking warnings with source-span metadata (rest is already-owned) |
| P2 | Secure document download proxy (opaque TTL-gated links) | new-exploration | secure-document-download-proxy ✗ | secure-document-download-proxy | 2 | 0/2/0 | edge-gated secure resource route (strict-UUID, no-store private PDFs); encrypted opaque TTL-gated download links (Fernet/DPAPI analog) |
| P2 | Relational grounded-extraction grid (per-cell citations) | extend-goal | goals/law-practice-office-action-extraction-rung ✓ | — | 1 | 0/1/0 | relational grounded-extraction grid: columns_config + cells (content + citations jsonb + status per document×column) |
| P2 | IPC/CPC classification SKOS taxonomy seed | extend-goal | goals/ip-law-knowledge-graph ✓ | — | 1 | 0/1/0 | WIPO-IPC / CPC classification taxonomy (section+class hierarchy) as IP SKOS-taxonomy seed |
| P2 | Conversation branching (branchIndex sibling ordering) | extend-goal | goals/workspace-thread-domain ✓ | — | 1 | 0/1/0 | conversation branching via branchIndex sibling-ordering alongside the existing Turn.parentTurnId |
| P2 | Local-first projection sync (EventStreamHub) | new-exploration | local-first-projection-sync ✗ | local-first-projection-sync | 1 | 0/1/0 | per-user live connection hub (EventStreamHub) refreshing projections after an authority write |
| P3 | RAG ingestion + char-span chunking | mixed | rag-retrieval-projection ✗ | rag-retrieval-projection | 14 | 3/5/6 | hybrid 3-channel RRF retrieval fusion w/ char-span citations; pgvector HNSW vector_cosine_ops projection; breadcrumb-prefixed embeddings |
| P3 | IP-law domain depth (claim-chart, PTAB, clause taxonomy, prior-art) | extend-goal | goals/law-practice-office-action-spike ✓ | — | 8 | 0/3/5 | ClaimElement value object (Claim→elements→PriorArtReference spans); PTAB validity-challenge entity + vocab; CUAD 41-category clause taxonomy |

## Attach-only / extend-goal (into existing packets — no new exploration)

| Cluster | Route | target packet | #nuggets | what attaches (netNew summary) |
| --- | --- | --- | --- | --- |
| Layout-aware PDF extraction + OCR-need gating | extend-goal | goals/file-processing-capability | 13 | deferred OCR/PDF-diagnostics phase: page_needs_ocr gate, layout-aware crop/skew, two-pass orchestration + extracted_by_ocr lineage, MIME/mojibake/encoding repair, graded input-quality gating |
| IP-law domain depth (claim-chart, PTAB, clause taxonomy, prior-art) | extend-goal | goals/law-practice-office-action-spike | 8 | element-level ClaimElement decomposition, PTAB/clause/statute taxonomies, composite risk-verdict aggregation, richer PriorArtReference field-set |
| Governance control plane (bulk-mutation dry-run, audit trace) | extend-goal | goals/agent-governance-control-plane | 2 | dry-run filter-gated bulk-mutation primitive + tamper-evident agent activity/LLM+tool-call audit trace |
| Relational grounded-extraction grid (per-cell citations) | extend-goal | goals/law-practice-office-action-extraction-rung | 1 | tabular grounded-extraction grid (document×column, per-cell content + citations jsonb + status) |
| IPC/CPC classification SKOS taxonomy seed | extend-goal | goals/ip-law-knowledge-graph | 1 | WIPO-IPC/CPC SKOS-taxonomy seed for the IP controlled vocabulary (deferred scope note) |
| Conversation branching (branchIndex sibling ordering) | extend-goal | goals/workspace-thread-domain | 1 | branchIndex sibling-ordering variant on the existing parentTurnId Turn branching |
| Anti-inference structured extraction + deterministic doc-structure | mixed | goals/langextract-capability | 15 | Case-A pure-OCR anti-inference prompt-mode + n-best candidate scoring + context-budget chunking (streaming-gate + deterministic-extractor strands graduate to the sibling packet instead) |
| Agent skills + cost-tiered routing + ethical-wall identity | mixed | goals/agentic-professional-runtime | 6 | cost-tiered routing Skill, CurrentUser/RpcMiddleware ethical-wall identity, pre-pipeline triage gate, concrete IP-attorney skill workflows |
| Claim-lifecycle gate (SHACL severity, transition guard, deterministic scoring) | mixed | goals/epistemic-claim-lifecycle-gate | 3 | SHACL severity + non-blocking warning metadata as an additive validation-result field (transition-guard + scoring already owned) |

## Dup-skip (already owned — reference only)

| Capability (cluster) | repo home (primaryTarget) | #nuggets |
| --- | --- | --- |
| MCP scaffold / transport / packaging (already shipped) | packages/drivers/nlp-mcp | 4 |
| Contract-first RPC + OTLP tracing (already shipped) | packages/agents/use-cases | 1 |
| LLM HttpClient wrapper + JSON repair (already owned) | packages/drivers/anthropic | 2 |
| Env-first Redacted secret resolution (already owned) | packages/drivers/uspto | 1 |
| Closed-struct extraction contracts (already owned) | packages/epistemic/domain | 1 |
| Boundary validation → structured result (already owned) | packages/foundation/modeling/schema | 1 |
| 35 USC 101/102/103/112 rejection taxonomy (already owned) | packages/law-practice/domain | 2 |
| Typed-JSONB persistence (already owned) | packages/workspace/server | 1 |

## Proposed NEW exploration slugs

13 distinct proposed slugs (P1 first, then P2, then P3).

**P1**
- **gov-legal-data-driver-codegen** (P1) — OpenAPI→dual (Effect SDK + MCP) codegen pipeline on Effect/HttpApi/effect-Schema; implement the four bare VERSION-only gov/legal driver skeletons (courtlistener/ecfr/dol/federal-register), finish PARTIAL govinfo, with a shared auth/retry/cache client layer.
- **citation-grounding-hallucination-guard** (P1) — eyecite-style legal citation parser emitting exact char spans, a citation candidate→resolved resolution lifecycle, and a ground-before-cite hallucination-guard contract composing the existing EvidenceSpan/ClaimGate/langextract Alignment substrate.
- **effect-orchestration-patterns** (P1) — DRY-extract a centralized Effect Schedule retry-policy library + Layer.unwrapEffect provider selection out of the currently-inline per-driver retry/error patterns (library consolidation, not greenfield).

**P2**
- **uspto-patent-driver-depth** (P2) — extend hand-rolled @beep/uspto in place with a Lucene/ODP query-DSL surface, deeper prosecution data (/transactions, status/document-code vocab, PTAB/assignments/foreign-priority), and a 403→source-document fallback; net-new EPO OPS / BigQuery / ppubs / Google-Patents-SerpApi retrieval tiers.
- **court-vocabulary-resolver** (P2) — the courts-db canonical court dataset (~2,809 courts), a regex court-name normalization dictionary, and a span-gated court-string resolver, ingested via official-data-sync-foundation (graph nodes stay owned by ip-law-knowledge-graph).
- **deterministic-doc-structure-extraction** (P2) — sibling home for the Partial/Complete streaming gate (which conflicts the langextract V1 streaming lock) plus the deterministic, no-model-in-the-loop regex contract/entity/caption/header extractors.
- **agent-memory-tiers-bitemporal-edges** (P2) — four-tier consolidation tier schema + decay/retention scoring + conflict/contradiction edges + never-overwrite bitemporal claim edges + RRF retrieval, graduating into a NEW goal extending the epistemic slice (consuming, not rebuilding, the RRF layer).
- **mcp-auth-gated-registration** (P2) — conditional/credential-keyed Toolkit composition, tier-gating of write-vs-read tools, a structured api_key_required helper, and progressive-disclosure field tiers across the existing MCP drivers and future per-driver servers.
- **ingestion-security-secret-governance** (P2) — the defensive ingestion-boundary gate: prompt-injection detection, ordered secret resolution + per-user AES-256-GCM vault, SSRF DNS/redirect hardening, secret/PII/OOXML scrubbing with audit, and failed-redaction x-ray.
- **multi-provider-llm-dispatch-fallback** (P2) — a shared Effect dispatch Layer owning user-key>env>CLI precedence + Layer.orElse graceful fallback + per-provider default-model resolution across @beep/{anthropic,openai-compat,xai,venice-ai}.
- **secure-document-download-proxy** (P2) — a desktop-sidecar UUID/TTL-gated opaque-link proxy serving private @beep/uspto File-Wrapper PDFs with keys kept server-side.
- **local-first-projection-sync** (P2) — a @beep/workspace-server EventStreamHub for real-time local-first projection refresh after authority writes.

**P3**
- **rag-retrieval-projection** (P3) — the DESIGNATED single owner of the hybrid 3-channel RRF retrieval layer, plus a pgvector HNSW projection schema, bounded-concurrency Effect-Stream ingestion, and an offset-preserving char-span chunker (the chunker attaches to langextract).

## Per-cluster detail

### Gov/legal data drivers + OpenAPI codegen
- **nuggetIds:** TalentScore#7, courtlistener#11, doc-haus#14, harvest-mcp#4, harvest-mcp#8, lawyergpt#5, mcp-uspto#1, mike#11, patent-search-mcp-server#6, patents-mcp-server#14, us-gov-open-data-mcp#2, us-gov-open-data-mcp#3, us-legal-tools#1, us-legal-tools#10, us-legal-tools#12, us-legal-tools#2, us-legal-tools#3, us-legal-tools#4, uspto-patents-mcp#6
- **route:** new-exploration · **primaryTarget:** gov-legal-data-driver-codegen (exists: ✗) · **wave:** P1 (P1 7 / P2 6 / P3 6) · **proposedSlug:** gov-legal-data-driver-codegen · **secondaryTargets:** 8 (packages/drivers/{courtlistener,ecfr,dol,federal-register,govinfo,runpod,acp}, explorations/solo-firm-docketing)
- **netNew:**
  - OpenAPI single-spec → dual (Effect SDK + MCP server) codegen pipeline ported onto beep's Effect/effect-Schema/HttpApi stack (us-legal-tools uses Orval/axios/Zod; port the architecture, not the code)
  - Implement the four bare skeleton drivers @beep/{courtlistener,ecfr,dol,federal-register} (currently only export VERSION='0.0.0')
  - CourtListener V4 Token-header auth client layer (Authorization: Token <key>, env COURTLISTENER_API_TOKEN, baseURL /api/rest/v4)
  - Declarative auth+retry+cache client factory (us-gov-open-data-mcp pattern) generalized as an Effect HTTP layer across drivers
  - Per-driver env-auth matrix + conditional MCP tool registration (CourtListener/GovInfo/DOL key-gated; eCFR/FedReg always-on keyless)
  - Finish PARTIAL @beep/govinfo: add client/auth(api.data.gov api_key)/retry/cache layer on top of existing Search HttpApi domain contracts
- **alreadyCovered:**
  - @beep/govinfo domain layer (Search HttpApi contract + value models like SearchResult/PackageInfo/GranuleMetadata) already scaffolded
  - Repo already has an Effect-native OpenAPI/JSON-schema codegen precedent in packages/drivers/runpod and packages/drivers/acp (openapi.json + scripts/generate.ts) to reuse instead of adopting Orval/axios
  - Static official-dataset sync (ISO4217/IANA/CLDR) is owned separately by goals/official-data-sync-foundation — out of scope for this cluster, do not rebuild
- **rationale:** The four gov/legal drivers are bare VERSION-only skeletons and govinfo is only partially scaffolded (Search HttpApi contract, no client/auth), and no goal or exploration currently drives their implementation: official-data-sync-foundation is a disjoint static-dataset (ISO/IANA/CLDR) goal, and solo-firm-docketing is a build-vs-buy decision packet frozen at its align review gate with an empty MAP.md. The gold (an OpenAPI->SDK+MCP codegen pipeline plus auth/retry/cache patterns across five APIs) is genuinely net-new infrastructure that warrants its own exploration, coordinating with the existing skeletons and the runpod/acp codegen precedent.
- **cautions:**
  - Licensing: us-legal-tools is MIT but the value is the codegen PIPELINE/PATTERNS, not the Orval-generated axios/Zod output — port the architecture onto Effect/HttpApi/effect-Schema rather than copying; us-gov-open-data-mcp license is unverified, so treat as reimplement-don't-copy. API state (verified 2026-06, all five upstreams ACTIVE): CourtListener V4 ENFORCES auth (anonymous = 401), header must be literally 'Authorization: Token <key>' (DRF TokenAuthentication, not Bearer/Api-Key), target /api/rest/v4/ (V3 legacy), and the SCOTUS visualization endpoints are deprecated — do not generate them. GovInfo + DOL require api.data.gov api_key (query param); eCFR and Federal Register are keyless (FedReg is an 'unofficial prototype', GovInfo is the official source). Orval @orval/mcp generator works in single-mode only (one spec per config) — relevant if Orval is used directly. Cross-cutting deprecation (NOT in this repo, flag for any sibling patents driver): PatentsView ended Feb 2025; PatentSearch → USPTO Open Data Portal (data.uspto.gov) on 2026-03-20 with mandatory key reissue; legacy USPTO Developer Hub decommissioned 2026-06-05.

### USPTO/patent driver depth (ODP, query DSL, File Wrapper, EPO, BigQuery)
- **nuggetIds:** courtlistener#4, google-patents-mcp#1, mcp-uspto#3, mcp-uspto#4, mcp-uspto#5, mcp-uspto#6, patents-mcp#1, patents-mcp#2, patents-mcp#3, patents-mcp#6, patents-mcp#7, patents-mcp-server#10, patents-mcp-server#13, patents-mcp-server#2, patents-mcp-server#4, patents-mcp-server#6, patents-mcp-server#8, us-gov-open-data-mcp#7, uspto-patents-mcp#1, uspto-patents-mcp#3, uspto-patents-mcp#8, uspto_pfw_mcp#1, uspto_pfw_mcp#14, uspto_pfw_mcp#2, uspto_pfw_mcp#3, uspto_pfw_mcp#7
- **route:** mixed · **primaryTarget:** packages/drivers/uspto (exists: ✓) · **wave:** P2 (P1 6 / P2 15 / P3 5) · **proposedSlug:** uspto-patent-driver-depth · **secondaryTargets:** 19 (incl. goals/ip-law-knowledge-graph, goals/law-practice-office-action-spike/-extraction-rung, mcp-auth-gated-registration, packages/drivers/epo [NEW], google-patents, google-patents-bigquery, govinfo, nlp-mcp, @beep/langextract, semantic-web, law-practice/domain, court-vocabulary-resolver / official-data-sync-foundation)
- **netNew:**
  - Lucene query-term escaping with documented safe/unsafe metacharacter policy + length cap (anti-injection)
  - Friendly to API nested field-name mapping for Lucene queries (patentNumber: → applicationMetaData.patentNumber:)
  - Smart identifier disambiguation (application vs patent vs publication, confidence) emitting the correct Lucene field query
  - ODP structured search POST body (filter/rangeFilter/sort) + JSON query-DSL builder over ODP fields
  - Prosecution-timeline endpoint /transactions (statusCodeBag → status/date/description model)
  - USPTO numeric status-code to prosecution-state controlled vocabulary (lifecycle dictionary)
  - Prosecution document-code litigation-importance tiers (critical/important/standard/administrative)
  - PTAB trials (IPR/PGR/CBM/DER) + assignments + foreign-priority + patent-term-adjustment ODP endpoints
  - Search parameter-object validation + attorney filters (art_unit/examiner/customer_number/filing+grant date ranges)
  - 403 structured-endpoint to source-document graceful-degradation fallback (always reach the primary PDF)
  - ppubs Public Search session/auth handshake + 403 reauth / 429 backoff for full-text not in ODP
  - ppubs searchWithBeFamily JSON request wire format (.pn./brs qt, per-database filters, family preference)
  - EPO OPS OAuth2 client-credentials driver (token cache, x-throttling 'black' detect, force-array XML parse) — packages/drivers/epo (NEW)
  - BigQuery patents-public-data global retrieval with mandatory dry-run cost gating + UNNEST localized text
  - Google Patents BigQuery parameterized queries (nested claims_localized/description_localized extraction)
  - Google Patents via SerpApi alternative source + prior-art filter taxonomy (status/type/date-prefix vocab)
  - EPO CQL / ODP / BigQuery query-syntax cheat-sheet resource for prose-to-query agents
  - Few-shot docket/serial-number normalization prompt + reusable eval/test fixture corpus
  - **netNew nugget IDs:** courtlistener#4, google-patents-mcp#1, mcp-uspto#4, mcp-uspto#5, patents-mcp#1, patents-mcp#2, patents-mcp#3, patents-mcp-server#2, patents-mcp-server#4, patents-mcp-server#8, patents-mcp-server#10, patents-mcp-server#13, us-gov-open-data-mcp#7, uspto-patents-mcp#1, uspto_pfw_mcp#1, uspto_pfw_mcp#2, uspto_pfw_mcp#3, uspto_pfw_mcp#7, uspto_pfw_mcp#14
- **alreadyCovered:**
  - ODP continuity (parent/child) resolution + model — @beep/uspto (getContinuity, UsptoContinuity)
  - ODP File-Wrapper document listing — @beep/uspto (getDocuments, UsptoDocumentReference) + downloadDocument
  - ODP application-metadata endpoints (meta-data/continuity/documents) already spoken — @beep/uspto (getApplication, USPTO_API_URL api.uspto.gov)
  - Patent/application number normalization (prefix + kind-code strip) — @beep/uspto (normalizeUsptoPatentNumber, normalizeUsptoApplicationNumber)
  - Core search/read tool surface + canonical patent record models — @beep/uspto (searchApplications, UsptoApplicationMetadata)
  - Typed driver error model (config/not-found/rate-limited/response-status/transport) — @beep/uspto (UsptoError, UsptoErrorReason)
  - ODP-targeted client with PatentsView sunset already avoided — @beep/uspto (USPTO_API_URL)
  - **alreadyCovered nugget IDs:** mcp-uspto#3, mcp-uspto#6, patents-mcp#6, patents-mcp#7, patents-mcp-server#6, uspto-patents-mcp#3, uspto-patents-mcp#8
- **rationale:** The hand-rolled @beep/uspto driver already speaks ODP (api.uspto.gov) for the application-metadata core (getApplication/getContinuity/getDocuments/downloadDocument/searchApplications) with number-normalization helpers and a typed UsptoError model, so those nuggets are refinements rather than gaps and the cluster routes as extend-in-place (new-exploration uspto-patent-driver-depth scoped onto packages/drivers/uspto), NOT a restart. The genuine depth is net-new: a Lucene/ODP query-DSL surface (escaping, friendly-to-API field mapping, identifier disambiguation, structured filter/rangeFilter/sort POST body), deeper prosecution data (/transactions timeline, status-code + document-code vocabularies, PTAB/assignments/foreign-priority endpoints, parameter-object validation), and a graceful 403-to-source-document fallback. EPO OPS is fully net-new (packages/drivers/epo does not exist) and BigQuery + ppubs + Google-Patents/SerpApi add alternative international/full-text retrieval tiers the ODP driver cannot cover. Codegen precedent is runpod, but uspto is deliberately hand-rolled — extend it directly without bolting on generate.ts/Orval.
- **cautions:**
  - NEVER PatentsView: api.patentsview.org was sunset Feb-2025 (410 / 301-redirects HTML to data.uspto.gov/odp). The query-DSL nuggets mcp-uspto#5 and uspto-patents-mcp#1 document PatentsView's JSON _or/_and/_text_any DSL — port the DSL *shape* but retarget it to ODP, never the dead endpoint.
  - ODP key reissue 2026-03-20 (PatentSearch → ODP) and legacy Developer Hub decommissioned 2026-06-05 — pin to data.uspto.gov/odp + api.uspto.gov X-API-KEY only.
  - EPO OPS (patents-mcp-server#2, patents-mcp-server#13) requires OAuth2 client-credentials secrets — out of offline scope; gate the epo driver behind secret governance (1Password), never commit creds.
  - BigQuery nuggets (patents-mcp-server#10, patents-mcp#3, patents-mcp-server#13) require GCP creds + billing; keep the dry-run cost gate mandatory; out of the offline/privilege-safe default scope.
  - ppubs (patents-mcp#1, patents-mcp#2) is an undocumented reverse-engineered USPTO endpoint — fragile and may break without notice; treat as a best-effort full-text tier behind ODP, not a primary source.
  - Codegen precedent = runpod (openapi.json + scripts/generate.ts), but uspto is hand-rolled — EXTEND in place; do NOT add generate.ts blindly or introduce Orval/axios/Zod.

### Layout-aware PDF extraction + OCR-need gating
- **nuggetIds:** doctor#1, doctor#10, doctor#11, doctor#12, doctor#2, doctor#3, doctor#6, doctor#7, doctor#9, harvest-mcp#7, judge-pics#1, lawyergpt#1, legalmind-ai#2
- **route:** extend-goal · **primaryTarget:** goals/file-processing-capability (exists: ✓) · **wave:** P2 (P1 4 / P2 6 / P3 3) · **proposedSlug:** null · **secondaryTargets:** 10 (goals/langextract-capability, packages/drivers/tika, file-processing, langextract, observability, @beep/provenance, @beep/schema MimeType/FileExtension, future OCR driver boundary)
- **netNew:**
  - page_needs_ocr gating heuristic: empty text / '(cid:' broken-font maps / FreeText+Widget annotations / embedded images / curve-count > 10 → skip expensive OCR (doctor#2)
  - Layout-aware PDF extraction: top/bottom margin crop + skew/transform-matrix filtering (is_skewed strips circular stamps, perpendicular court text) for stable provenance char spans (doctor#1)
  - Two-pass extraction orchestration: text-layer first, OCR fallback only when needed, keep-whichever-is-longer, plus an extracted_by_ocr lineage flag feeding evidence provenance (doctor#11)
  - OCR confidence-based artifact suppression: per-word Tesseract confidence + margin position → keep / blank-out / box-glyph, so low-confidence OCR never becomes an authoritative fact (doctor#3)
  - Content-sniffing MIME repair: magic-byte correction (WordPerfect \xffWPC, ASF/WMA, %PDF-, FLAC/AAC/OGG/RealMedia) over extension/Magika misclassification (doctor#6)
  - Mojibake repair table for broken court PDF producers (pdfFactory / Ninth-Circuit), with the 'e'-absent corruption detector (doctor#9)
  - Encoding cascade for legacy TXT/HTML court files: utf-8 → ISO8859 → cp1252 → latin-1 before failing (doctor#10)
  - Graded input-quality gate (excellent/good/poor/empty) that returns a typed error bundling issues + recommendations before expensive extraction (harvest-mcp#7)
  - PDF text-quality / garbage assessment: word-count, real-letter ratio (CJK+ASCII), repeated-char gibberish regex → flag image-only scans / refuse low-quality input (legalmind-ai#2)
  - Panic-isolated per-file parsing: recover()-per-parser so a malformed upload cannot crash the ingestion worker, with rasterize+OCR fallback when digital text yields nothing (lawyergpt#1)
  - License-tagged source-artifact provenance record: source URL / sha256 / license / artist / date convention for ingested assets (judge-pics#1)
  - **netNew nugget IDs:** doctor#1, doctor#2, doctor#3, doctor#6, doctor#9, doctor#10, doctor#11, harvest-mcp#7, judge-pics#1, lawyergpt#1, legalmind-ai#2
- **alreadyCovered:**
  - File-processing capability substrate (Artifact, Strategy, Operation, Extraction, Service) — @beep/file-processing (packages/foundation/capability/file-processing)
  - Content-addressable sha256 digest type ContentDigest — @beep/file-processing/Artifact (doctor#7: only the PDF /CreationDate+/ModDate strip-before-hash normalization is a net delta on top of the existing digest)
  - Extension→format classification + MimeType/FileExtension schemas — @beep/file-processing/Strategy.classifyFormatFromExtension + @beep/schema (doctor#6 extends, not replaces, this)
  - Text-layer PDF/DOCX/RTF/HTML/text extraction driver — @beep/tika (packages/drivers/tika)
  - PST export driver scaffold — @beep/libpff (packages/drivers/libpff)
  - Request-scoped logfmt/lifecycle observability — Effect-native Effect.withLogSpan / annotateLogs / spans already cover doctor#12's upload-lifecycle decorator pattern (doctor#12)
  - Provenance / source-hash / TextAnchor / EvidenceSpan kernel — @beep/provenance (packages/foundation/modeling/provenance)
  - **alreadyCovered nugget IDs:** doctor#7, doctor#12
- **rationale:** goals/file-processing-capability is active with @beep/file-processing + @beep/tika + @beep/libpff already owning the extraction substrate (Artifact/ContentDigest, Strategy/classifyFormatFromExtension, Operation, Extraction, Service), and its SPEC explicitly DEFERS OCR to 'a future strategy and driver boundary' (SPEC.md: OCR is V1 strategy-flag/skipped-capability only; PDF-diagnostics deferred). These nuggets are exactly that deferred OCR/PDF-diagnostics phase: a page_needs_ocr gate, layout-aware crop/skew extraction for stable spans, two-pass orchestration with an extracted_by_ocr lineage flag, confidence-based artifact suppression, MIME/mojibake/encoding repair, and graded input-quality gating - none of which exist today. This is a legit Case-A non-invasive research note feeding the deferred phase (NOT a dup of the built capability and NOT a SPEC reopen): doctor#7 (ContentDigest already exists) and doctor#12 (Effect-native log spans already exist) are the only already-covered members, with small deltas noted for the owner to integrate later.
- **cautions:**
  - NON-INVASIVE: research note only - do NOT reopen goals/file-processing-capability SPEC.md; the goal owner integrates these into the deferred OCR strategy/driver boundary later. P2 Tika + P3 libpff completion are the active pending phases and must not be disturbed.
  - OCR engines (Tesseract), pdfplumber/pdftotext, and Magika are external runtimes - per SPEC they belong behind a NEW future OCR strategy + driver boundary (privilege-safe local execution like the existing tika JVM driver), NOT in V1 and NOT inside @beep/file-processing core.
  - License hygiene: port as clean-room Effect/TS heuristics, not copied source. Free Law Project 'doctor' is permissive (BSD-2-Clause) but verify; legalmind-ai and lawyergpt upstream licenses are UNVERIFIED. The doctor#9 mojibake letter_map and doctor#3 confidence constants are data tables - re-derive/attribute rather than lifting verbatim.
  - legalmind-ai#2 (doctor too) ship CJK-tuned gibberish heuristics and Chinese issue strings; beep's corpus is English legal text - adapt the real-letter-ratio threshold and messages before use.
  - doctor#7 deterministic-hash normalization (blank /CreationDate + /ModDate) must compose WITH the existing ContentDigest, not introduce a parallel hashing path; doctor#6 MIME repair must extend classifyFormatFromExtension + @beep/schema MimeType, not fork them.
  - doctor#3 + harvest-mcp#7 + legalmind-ai#2 touch the retrieval/logic wall: low-confidence OCR or low-quality input must surface as a typed error / non-authoritative evidence, never silently become a candidate claim - keep this aligned with the epistemic claim/evidence gate.

### Citation lookup + verbatim-span grounding (hallucination guard)
- **nuggetIds:** Juris.AI#2, courtlistener#1, courtlistener#2, courtlistener#3, doc-haus#2, doc-haus#4, mike#1, mike#3, research-squad#1, us-legal-tools#6, us-legal-tools#7
- **route:** new-exploration · **primaryTarget:** citation-grounding-hallucination-guard (exists: ✗) · **wave:** P1 (P1 7 / P2 3 / P3 1) · **proposedSlug:** citation-grounding-hallucination-guard · **secondaryTargets:** 4 (goals/epistemic-claim-lifecycle-gate, goals/provenance-shared-claim-kernel, @beep/langextract, packages/epistemic/domain)
- **netNew:**
  - eyecite-style legal citation parser: detect citations in text and emit exact char spans (no parser exists; rg for eyecite/citation/reporter returns only test-reporter and unrelated hits)
  - UnmatchedCitation candidate→resolved RESOLUTION lifecycle (resolving a parsed citation to an authority/reporter) — distinct from the generic claim-admission ClaimLifecycle
  - verbatim-citation / ground-before-cite hallucination-guard CONTRACT (mike): require a verified verbatim span before a citation may be emitted; composes EvidenceSpan + ClaimGate + citation parse but is itself net-new
  - cross-chunk straddle verification: langextract Alignment matches against a single source string only, so quote verification across chunk boundaries has no home
- **alreadyCovered:**
  - exact char-offset span grounding primitive — @beep/provenance TextAnchor + @beep/epistemic-domain EvidenceSpan {startChar,endChar,quote,confidence}
  - candidate→...→admitted lifecycle machinery + SHACL ClaimGate verdict — goals/epistemic-claim-lifecycle-gate (ClaimLifecycle/ClaimGate/ClaimProjection)
  - verbatim quote verification with normalized→raw offset mapping — langextract Alignment (findExact / findLesser via lowerWithSourceOffsets normalized→source offset arrays / findFuzzy Levenshtein), emitting match_exact|match_lesser|match_fuzzy|unaligned with char Spans
- **rationale:** The grounding substrate already exists: @beep/epistemic-domain EvidenceSpan + @beep/provenance TextAnchor give exact char-span primitives, goals/epistemic-claim-lifecycle-gate gives the candidate→admitted lifecycle + SHACL gate, and packages/foundation/capability/langextract Alignment already does verbatim quote verification with normalized→raw offset mapping (findLesser's lowerWithSourceOffsets) and fuzzy fallback. What has NO home anywhere in packages/**/src or goals/** is the citation layer itself — an eyecite-style citation parser, the citation candidate→resolved resolution lifecycle, the ground-before-cite hallucination-guard contract, and cross-chunk straddle — so the cluster is mixed: reuse the epistemic + langextract substrate, add a new exploration packet for the citation/guard capability.
- **cautions:**
  - AGPL: eyecite/courtlistener and mike are AGPL — reimplement the citation-parse + ground-before-cite contract from spec, do NOT copy source. doc-haus license unknown — treat normalized→raw offset + straddle logic as reference only; note that langextract Alignment already implements the normalized→raw mapping in MIT-clean repo code, so prefer extending it over porting doc-haus. Reuse (do not rebuild) the existing ClaimLifecycle/ClaimGate pattern and EvidenceSpan/TextAnchor rather than introducing a parallel citation lifecycle. Scope: keep citation/IP-law vocabulary out of the epistemic slice (per epistemic SPEC non-goals); the new packet is a downstream consumer composing epistemic + langextract via public surface, alongside law-practice-office-action-spike / ip-law-knowledge-graph. PatentsView sunset is not relevant to this cluster.

### Court / jurisdiction controlled vocabulary
- **nuggetIds:** Juris.AI#6, courtlistener#7, courtlistener#8, courts-db#1, courts-db#2, courts-db#3, courts-db#5, courts-db#6, courts-db#7, courts-db#8, doc-haus#9, judge-pics#2, seal-rookery#1, seal-rookery#2
- **route:** new-exploration · **primaryTarget:** court-vocabulary-resolver (exists: ✗) · **wave:** P2 (P1 1 / P2 8 / P3 5) · **proposedSlug:** court-vocabulary-resolver · **secondaryTargets:** 3 (goals/official-data-sync-foundation, packages/drivers/courtlistener, goals/ip-law-knowledge-graph)
- **netNew:**
  - courts-db canonical court entity dataset (~2,809 courts) with CourtListener IDs
  - regex court-name normalization dictionary
  - court-string resolver with partial-match span gating
  - data-sync ingestion of the courts-db dataset into @beep/data + schema literals/codecs
- **alreadyCovered:**
  - abstract Court graph node (ip-law-knowledge-graph p1 schema, _tag Court)
  - abstract Jurisdiction graph node (ip-law-knowledge-graph p1 schema)
- **rationale:** The `@beep/courtlistener` driver was deleted 2026-08-13 (was VERSION-only; recreate via `goals/honest-repo-signal/research/FOLLOW-UPS.md` if a product feature pulls the HTTP driver). No courts-db dataset, regex normalization dictionary, or span-gated court-string resolver exists anywhere in packages/, @beep/data, or goals. ip-law-knowledge-graph only defines abstract OWL Court/Jurisdiction graph nodes (PENDING), not a controlled vocabulary or resolver, and official-data-sync-foundation provides the dataset-sync mechanism but does not own court data. The vocabulary dataset plus resolver is a coherent net-new capability warranting its own packet that ingests via official-data-sync-foundation; do not treat the deleted courtlistener tree as a landing zone.
- **cautions:**
  - courts-db is BSD-2 (permissive, attribution-friendly) — safe to vendor the dataset/regex dictionary with attribution, but it is a freelawproject/CourtListener-adjacent asset; treat the resolver logic as reimplement-don't-copy and avoid pulling in any AGPL CourtListener server code. Scope: keep this as the vocabulary/resolver vertical only — graph-shape Court/Jurisdiction nodes remain owned by ip-law-knowledge-graph; dataset ingestion plumbing remains owned by official-data-sync-foundation. P2 because it depends on the official-data-sync-foundation pipeline and is downstream of the IP-graph schema.

### Anti-inference structured extraction + deterministic doc-structure
- **nuggetIds:** Juris.AI#3, Legal-AI_Project#2, LegalEase#1, LegalEase#4, TalentScore#1, TalentScore#3, TalentScore#4, TalentScore#6, doc-haus#3, doctor#4, doctor#5, harvest-mcp#3, legalmind-ai#1, mike#5, stenoai#1
- **route:** mixed · **primaryTarget:** goals/langextract-capability (exists: ✓) · **wave:** P2 (P1 3 / P2 9 / P3 3) · **proposedSlug:** deterministic-doc-structure-extraction · **secondaryTargets:** 18 (incl. explorations/court-vocabulary-resolver, explorations/rag-retrieval-projection, goals/file-processing-capability, goals/langextract-capability, goals/trustgraph-port, packages/agents, nlp-mcp, epistemic/domain, langextract, nlp, provenance, law-practice/domain)
- **netNew:**
  - Partial(candidate) vs Complete(authoritative) streaming gate as an Effect Stream of a tagged ParseEvent union — only the terminal Complete crosses into authority (CONFLICTS langextract V1 streaming-lock; needs a sibling home)
  - Parallel partial-vs-final schema-first models (strict Schema.Class for the authoritative record + Schema.optionalWith(NullOr) PartialData for progressively-filling stream chunks)
  - Extraction-library→domain adapter skeleton with parallel mapPartial* mappers (Stream.async over an async generator, getFinalResponse() triggers score+persist+single Complete emit)
  - Deterministic regex contract-structure extractor: defined terms / Section-Article-Exhibit cross-refs / corporate-suffix parties+roles / amendment recitals, each row carrying verbatim text + char offsets, NO model in the loop, with a versioned re-extraction migration
  - Deterministic regex legal-entity catalog (statute/case/court/legal-term) with hand-tuned per-type confidence and matchAll char-span indices as a cheap pre-LLM candidate seeder
  - Deterministic regex entity-and-relationship extractor emitting a typed {nodes,links} contract graph (party/jurisdiction/date/obligation) for a non-LLM first pass
  - Court caption-line column alignment with documented per-jurisdiction separators (§ TX, : NY, ) generic) as a legal-NLP normalization pass
  - PACER/court header-stamp isolation (pdfplumber font/position filter) + docket document-number regex extraction for filing→docket provenance linkage
  - Layered heuristic-then-LLM classification pipeline: deterministic heuristics decide first with confidence, LLM only as fallback/refinement (the deterministic-wall-before-fallible-model discipline)
  - Unique-anchor tracked-changes span resolver: find + context_before/after with whitespace/punctuation tolerance and explicit ambiguous/not-found failure modes — resolves an LLM-proposed span back to an exact source char location
  - **netNew nugget IDs:** TalentScore#3, TalentScore#4, TalentScore#6, doc-haus#3, Juris.AI#3, LegalEase#4, doctor#4, doctor#5, harvest-mcp#3, mike#5
- **alreadyCovered:**
  - BAML 'LLM as pure OCR' anti-inference prompt + typed extraction schema ('extract EXACTLY as written, DO NOT infer/reason/add') — pure-extend prompt-mode research note on @beep/langextract (packages/foundation/capability/langextract)
  - Risk-scored clause extraction prompt + strict 'respond ONLY with valid JSON' contract for CandidateClaim generation — extend langextract Extraction prompt shaping (must add source char spans)
  - VerdictAnalysis fixed-record structured-extraction prompt schema + required-field validation loop — reference shape for langextract CandidateClaim extraction (express as effect/Schema + span provenance)
  - Span-grounded extractive QA with n-best ranking + null_score_diff_threshold null-handling — candidate-scoring reference for @beep/langextract span extraction / candidate→approved gate
  - Overlapping map-reduce chunking sized to model context budget with clean-newline breaks — preprocessing that feeds spans into @beep/langextract before the candidate gate (langextract pipeline extend, not a new home)
  - **alreadyCovered nugget IDs:** TalentScore#1, LegalEase#1, legalmind-ai#1, Legal-AI_Project#2, stenoai#1
- **rationale:** The repo already owns the span-grounded LLM extraction substrate — @beep/langextract has Extraction/Alignment/Service/Target and an active P4 goal — so the anti-inference 'pure-OCR' prompt-mode nuggets (extract exactly as written, never infer; n-best candidate scoring; JSON-contract CandidateClaim prompts; context-budget chunking that feeds it) are a pure-extend Case-A research note on goals/langextract-capability, not new packets. But that same goal's SPEC (lines 88-89) LOCKS streaming as deferred ('raw AI stream chunks are not public API'), so the TalentScore Partial/Complete streaming gate directly conflicts the lock and cannot attach there; and the deterministic, no-model-in-the-loop regex contract/entity/caption/header extractors (doc-haus, Juris.AI, LegalEase, doctor, mike) are a @beep/nlp-adjacent deterministic-logic capability with no current home (@beep/nlp's PatternParsers are wink-NLP tooling, not a versioned char-offset contract-structure extractor). Both net-new themes graduate into the proposed sibling exploration deterministic-doc-structure-extraction.
- **cautions:**
  - LOCKED-DECISION CONFLICT: langextract V1 SPEC (goals/langextract-capability/SPEC.md L88-89) defers streaming — the Partial/Complete gate (TalentScore#3/#4/#6) is marked gapStatus=dup in the catalog but is actually net-new-conflicting; route to the sibling, do NOT reopen the langextract streaming lock
  - Streaming, IF ever pulled into langextract, must be exposed as schema-backed LangExtract domain events, never raw AI chunks — keep the sibling's stream surface schema-first to stay reconcilable
  - All adopted LLM-prompt nuggets emit free text / 'exact clause text' but NO char offsets — beep's provenance wall requires source spans; the extend note must add GroundedExtraction.span before adoption
  - Source nuggets are Python (doctor, stenoai, Legal-AI_Project, LegalEase) and BAML (TalentScore) — port to Effect/TS + effect/Schema; do not vendor Python or BAML runtimes
  - legalmind-ai#1 is Taiwan jurisdiction (not US IP) — adjacent reference shape only, do not adopt its field set verbatim for office-action/patent extraction
  - Deterministic extractors must preserve the 'a miss is an absent row, never a wrong fact' guarantee and the versioned re-extraction migration (doc-haus VERSION const) when ported

### Four-tier agent-memory schema w/ confidence + conflict edges
- **nuggetIds:** agentmemory#2, agentmemory#3, agentmemory#5, agentmemory#6, agentmemory#7, courtlistener#9, courts-db#4, doc-haus#10, doc-haus#7, harvest-mcp#2, mike#4, mike#6, research-squad#10, research-squad#8, screenpipe#3
- **route:** new-exploration · **primaryTarget:** agent-memory-tiers-bitemporal-edges (exists: ✗) · **wave:** P2 (P1 5 / P2 7 / P3 3) · **proposedSlug:** agent-memory-tiers-bitemporal-edges · **secondaryTargets:** 5 (goals/epistemic-claim-lifecycle-gate, standards/memory-architecture, goals/agentic-professional-runtime, goals/trustgraph-port, explorations/_gold-intake)
- **netNew:**
  - Explicit four-tier consolidation taxonomy enum (working/episodic/semantic/procedural) — agentmemory ConsolidationTier; nothing in packages (rg found zero hits)
  - accessCount/strength/sourceMemoryIds + retention/decay scoring (salience × exp temporal decay + reinforcement, hot/warm/cold/evictable tiers) — no working-memory/decay tier exists
  - rejected + superseded ClaimLifecycle STATES (today 'rejected' is only a ClaimGate verdict; ClaimLifecycle is forward-only candidate→shape_valid→consistency_checked→admitted)
  - Conflict/contradiction edges + per-anchor supersede pass before admission (doc-haus redline-gate semantics) — no conflict detection exists
  - Bitemporal versioned claim/fact edges (tvalid/tvalidEnd, version/supersededBy/isLatest, sourceObservationIds, EdgeContext) with NEVER-overwrite/always-version semantics — explicitly DEFERRED by the completed epistemic gate; no persisted edge store
  - Triple-stream BM25+vector+graph retrieval fused via RRF (k=60) with weight renormalization — planned FalkorDB/GraphRAG projection, not built
- **alreadyCovered:**
  - Per-fact confidence: Evidence/EvidenceSpan carry Confidence = UnitInterval (packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts) + startChar/endChar/quote char-span grounding
  - Semantic tier itself: CandidateClaim + Evidence + ClaimLifecycle + SHACL-backed ClaimGate built and shipped (epistemic-claim-lifecycle-gate is completed-retained; 11 tests green)
  - Provenance substrate: @beep/semantic-web PROV-O + bounded SHACL + @beep/provenance TextAnchor (the never-overwrite edge's provenance fields align here)
  - The four-LAYER memory taxonomy is already a binding decision record in standards/memory-architecture/01-memory-layer-taxonomy.md (conceptual, not implemented)
- **rationale:** GOLD_SYNTHESIS item 8 plus the bitemporal/RRF table rows already route this cluster to "extend CandidateClaim/ClaimLifecycle + borrow doc-haus redline-gate," but the natural extension home (goals/epistemic-claim-lifecycle-gate) is lifecycle:completed-retained and explicitly DEFERRED the bitemporal store, FalkorDB/GraphRAG, and rejected/superseded states — so these cannot be an in-place extend-goal. rg confirms per-fact confidence + the semantic tier already exist, but ConsolidationTier/accessCount/strength/RRF/bitemporal edges have zero presence in packages. The coherent net-new capability (tier schema + decay + conflict edges + never-overwrite bitemporal edges + RRF retrieval) needs a fresh wedge packet that graduates into a NEW goal extending the epistemic slice, with standards/memory-architecture as the governing taxonomy and trustgraph-port as the FalkorDB/GraphRAG retrieval home.
- **cautions:**
  - Licensing: agentmemory is Apache-2.0 (permissive — port with attribution), but it is plain TS + Zod v4 + the bespoke iii-sdk, NOT Effect/effect-Schema, so DI/Layer/service patterns do NOT transfer — reimplement data models in Effect-Schema (LiteralKit/Model.Class), reuse only the algorithms/shapes. Do NOT copy the XML-tag extraction prompt's regex parser (parseTemporalGraphXml) — it is brittle and lacks beep's required char-span grounding; reuse the prompt SHAPE only and add span grounding (or use BAML/Standard-Schema structured output). RRF: validate k=60 default (Cormack 2009; k in [40,80] comparable), fuse on rank only, do not score-normalize across streams. The RRF/FalkorDB-projection sub-capability overlaps GOLD_SYNTHESIS item 9 and goals/trustgraph-port — coordinate to avoid building two retrieval layers. PatentsView/USPTO-ODP deprecations appear in the agentmemory web-enrichment but are out of scope for this memory cluster. Keep zero IP-law vocabulary in the epistemic/memory slice (federation + no-vocabulary invariants from the completed gate).
  - License: screenpipe#3 is from screenpipe (LicenseRef-Screenpipe-Commercial — the most restrictive source in the corpus) → reference patterns/shapes only, reimplement in Effect-Schema; mike#6 (version-lineage/provenance enum, rec=port) is AGPL-3.0 → clean-room; harvest-mcp#2 (rec=adopt) is unknown-license → reimplement, do not copy.
  - RRF retrieval fusion here OVERLAPS rag-retrieval-projection (the designated RRF owner) and goals/trustgraph-port (FalkorDB/GraphRAG) — CONSUME a single shared RRF/retrieval layer, do not build a third.

### Effect orchestration patterns (Schedule, Layer provider, bounded fan-out)
- **nuggetIds:** Juris.AI#5, courts-db#9, research-squad#11, research-squad#2, research-squad#3, research-squad#5, research-squad#7, uspto_pfw_mcp#5
- **route:** new-exploration · **primaryTarget:** effect-orchestration-patterns (exists: ✗) · **wave:** P1 (P1 5 / P2 2 / P3 1) · **proposedSlug:** effect-orchestration-patterns · **secondaryTargets:** 4 (standards/effect-first-development.md, .patterns/error-handling.md, packages/drivers/anthropic, goals/effect-native-migration)
- **netNew:**
  - Centralized Effect Schedule retry-policy library (DRY extraction: today retry policies are inline per-driver as Schedule.exponential in packages/drivers/anthropic/src/Anthropic.service.ts:106, Anthropic.repair.ts:105, and openai-compat; no shared foundation/common retry-policy module exists)
  - Layer.unwrapEffect-based provider selection (zero usages of Layer.unwrapEffect anywhere under packages/**/src; provider wiring is currently static Layer composition via ai-provider-cli/openai-compat, not effectful provider selection)
- **alreadyCovered:**
  - Failure-vs-defect split in LLM client wrapper: documented as law EF-31 in standards/effect-first-development.md and implemented via TaggedErrorClass in packages/drivers/anthropic/src/Anthropic.errors.ts
  - Schedule-based retry as a pattern: documented EF-25/26 in standards and already used (Schedule.exponential + ExecutionPlan) in anthropic + openai-compat drivers
  - Bounded fan-out concurrency: documented as law EF-27 ('Parallel fan-out needs explicit concurrency') in standards/effect-first-development.md and applied operationally in goals/effect-native-migration (one-agent-per-package bounded parallel waves)
- **rationale:** The three candidate targets do not own this cluster: goals/effect-native-migration is scoped to migrating native JS Map/Set/String/Date/JSON to Effect-native data types (not runtime orchestration), while standards/effect-first-development.md and .patterns already document the *conceptual* laws (EF-25/26 retry-Schedule, EF-27 bounded fan-out, EF-31 failure-vs-defect). The genuinely net-new work is consolidation into a shared library: a centralized retry-policy module (policies are currently duplicated inline per-driver) and Layer.unwrapEffect provider selection, which has zero occurrences in the repo. No existing exploration/goal covers Effect orchestration as a library.
- **cautions:**
  - Largely a library-extraction/consolidation task, not greenfield — the laws and per-driver implementations already exist, so scope must avoid rebuilding documented standards or working anthropic/openai-compat retry+error code; reuse and DRY-extract them instead. No licensing concerns (all first-party Effect code). Note Layer.unwrapEffect must be validated against the vendored effect-v4 API before adopting.

### MCP server design (conditional registration, multi-provider auth, progressive disclosure)
- **nuggetIds:** agentmemory#8, agentmemory#9, doc-haus#8, harvest-mcp#6, mcp-uspto#2, mike#2, mike#7, patent-search-mcp-server#5, patents-mcp#4, patents-mcp#5, patents-mcp-server#1, patents-mcp-server#12, patents-mcp-server#3, research-squad#4, screenpipe#1, screenpipe#2, us-gov-open-data-mcp#1, us-gov-open-data-mcp#4, us-gov-open-data-mcp#5, us-gov-open-data-mcp#6, us-gov-open-data-mcp#8, us-legal-tools#5, us-legal-tools#9, uspto-patents-mcp#4, uspto-patents-mcp#7, uspto_pfw_mcp#10, uspto_pfw_mcp#4, uspto_pfw_mcp#9
- **route:** new-exploration · **primaryTarget:** mcp-auth-gated-registration (exists: ✗) · **wave:** P2 (P1 11 / P2 12 / P3 5) · **proposedSlug:** mcp-auth-gated-registration · **secondaryTargets:** 5 (packages/drivers/nlp-mcp, packages/drivers/m365-mcp, goals/m365-mcp, goals/nlp-adjunct-port, packages/drivers/uspto)
- **netNew:**
  - Conditional/credential-keyed Toolkit composition — build the Toolkit only from driver Layers whose Effect Config resolved successfully (CourtListener public vs USPTO/GovInfo/DOL keyed)
  - Tier-gating of write-vs-read tools at the candidate→approved wall (no real src implements requiresAuth/tier-gate today)
  - Graceful 'API key missing' as structured content — a shared helper returning {error: api_key_required, tool, envVar, registrationUrl} instead of throwing
  - Progressive-disclosure named field tiers (minimal/balanced/complete) projection / server-side response reshaping for context reduction (uspto_pfw field_configs pattern)
  - readOnly/idempotent tool-def hint conventions surfaced on tool metadata
- **alreadyCovered:**
  - Two Effect-native MCP server scaffolds already exist: @beep/nlp-mcp (Server.ts makeServerLayer + McpServer.toolkit + McpServer.layerStdio, Tools/Handlers split, bin.ts; ~42 tools) and @beep/m365-mcp (same pattern, read-only v1) — do NOT re-scaffold
  - Schema-first Tool.make I/O with failureMode:'return' → typed AiToolError already standard in both servers
  - Span/data hygiene (counts/sizes/paths only, never raw content/tokens) already enforced
  - NLP tool-surface expansion + streaming suite owned by goals/nlp-adjunct-port — not part of this cluster
- **rationale:** beep already ships both MCP servers named as gold beep-targets (packages/drivers/nlp-mcp and m365-mcp confirmed present with the full Toolkit + layerStdio scaffold), so the bare-scaffold lessons are dups; the GOLD_SYNTHESIS itself (lines 1572-1697) flags the high-value gaps as conditional/auth-gated registration, progressive-disclosure field tiers, and a structured api_key_required helper. Grep over goals/*/SPEC.md and packages confirms no existing goal owns these and no real src implements requiresAuth/tier-gate/api_key_required, so this is a genuine cross-cutting gap warranting a new packet that coordinates the existing MCP drivers and future per-driver (USPTO) servers rather than extending the NLP- or M365-specific goals.
- **cautions:**
  - PatentsView API sunset: api.patentsview.org 301-redirects to data.uspto.gov/odp (HTML not JSON) — encode in @beep/uspto base-URL + UsptoEndpointSunset tagged error; target ODP from the start. Licensing: patents-mcp-server / mcp-uspto / uspto_pfw are MIT and portable; mike is unknown-license and screenpipe/harvest-mcp flagged unknown — reimplement-don't-copy. Scope note: the 'multi-provider auth/LLM fallback layer' strand in this cluster's title spans the four LLM drivers (@beep/anthropic, openai-compat, xai, venice-ai) and is arguably a separate provider-abstraction cluster; keep this packet focused on MCP-side credential-keyed registration + progressive disclosure and cross-link the LLM-fallback work rather than absorbing it.

### RAG ingestion + char-span chunking
- **nuggetIds:** Juris.AI#4, LegalEase#5, agentmemory#1, agentmemory#12, courtlistener#10, doc-haus#1, doc-haus#11, doc-haus#6, lawyergpt#2, lawyergpt#3, lawyergpt#4, lawyergpt#6, research-squad#9, uspto-patents-mcp#2
- **route:** mixed · **primaryTarget:** rag-retrieval-projection (exists: ✗) · **wave:** P3 (P1 3 / P2 5 / P3 6) · **proposedSlug:** rag-retrieval-projection · **secondaryTargets:** 4 (goals/langextract-capability, goals/ip-law-knowledge-graph, packages/foundation/capability/semantic-web, packages/foundation/capability/langextract)
- **netNew:**
  - Hybrid 3-channel RRF retrieval fusion (embedding cosine + FTS/BM25 + literal-phrase) with char-span citations — the GraphRAG retrieval service is PLANNED, not built
  - pgvector HNSW vector_cosine_ops projection schema + thresholded top-k cosine retrieval (vectors as rebuildable projection, not authority)
  - Breadcrumb-prefixed embedding strategy (docName > section prefix to keep boilerplate separable)
  - Bounded-concurrency ingestion workflow (semaphore + per-file/per-chunk transaction) re-expressed as Effect Stream.mapEffect with bounded parallelism
  - Offset-preserving char-span chunker (~2000-char chunks carrying charStart/charEnd) sitting between @beep/md and @beep/langextract
- **alreadyCovered:**
  - Span-grounded extraction substrate with char offsets and fuzzy alignment — @beep/langextract GroundedExtraction/AlignmentStatus already exists
  - Char-span provenance contract — @beep/provenance TextAnchor (text.slice(start,end)===quote)
  - PDF/DOCX text extraction + OCR-capable ingestion plumbing — @beep/file-processing + @beep/tika P1 vertical already merged (PR #262)
  - Local corpus extraction/cataloging — goals/oppold-corpus-pipeline completed
- **rationale:** All three named candidates are the wrong home: goals/file-processing-capability is extraction-only and explicitly lists "knowledge-graph extraction or assembly" and OCR out of scope; goals/oppold-corpus-pipeline is completed-retained salvage/catalog/extract and explicitly excludes embeddings, LLM processing, and KG/epistemic ingestion; explorations/solo-firm-docketing is PACER/docketing, unrelated. The repo's own GOLD_SYNTHESIS.md (lines 231-235, 353-355, 383-386) routes these exact nuggets to a planned-but-unbuilt FalkorDB/GraphRAG retrieval projection over @beep/semantic-web plus a char-span chunker between @beep/md and the active goals/langextract-capability (currently P4 Implement); the retrieval/RRF/pgvector/bounded-concurrency-ingestion projection layer has no execution packet, so it needs a new exploration while the chunker piece attaches to langextract.
- **cautions:**
  - lawyergpt license is UNKNOWN — reimplement patterns, do not copy source. lawyergpt pins Gemini embeddings: embedding-001/embedding-gecko-001/gemini-embedding-exp-03-07 shut down Oct 2025 and text-embedding-004 shut down Jan 14 2026; current GA is gemini-embedding-001 (3072-dim default, Matryoshka-truncatable) so any pgvector column dimension + HNSW index must match chosen output_dimensionality. beep is provider-neutral/local-first (PGlite+Drizzle, local ONNX embeddings) so do NOT pin Gemini and keep vectors as projection, not authority. doc-haus is MIT (safe to study/adapt). lawyergpt's un-gated tool-calling RAG (raw chunks to LLM, "use your own knowledge") is an explicit ANTI-PATTERN beep rejects — outputs must carry CandidateClaim+Evidence provenance spans through the ClaimGate, not bare chunks.
  - License: courtlistener#10 (MinHash/LSH near-dup clustering, rec=port) is AGPL-3.0 → reimplement the dedup from spec, do not copy AGPL source.
  - RRF retrieval fusion: this packet is the DESIGNATED single owner of the hybrid 3-channel RRF retrieval layer; agent-memory-tiers-bitemporal-edges and goals/trustgraph-port must consume it, not rebuild it.

### Ingestion security + secret/PII governance
- **nuggetIds:** LegalEase#3, agentmemory#11, doc-haus#13, doc-haus#5, doctor#8, mike#12, mike#8, mike#9, uspto_pfw_mcp#12, uspto_pfw_mcp#6
- **route:** new-exploration · **primaryTarget:** ingestion-security-secret-governance (exists: ✗) · **wave:** P2 (P1 1 / P2 7 / P3 2) · **proposedSlug:** ingestion-security-secret-governance · **secondaryTargets:** 6 (packages/drivers/anthropic, packages/drivers/courtlistener, packages/drivers/uspto, @beep/langextract, foundation/modeling/identity, foundation/modeling/provenance)
- **netNew:**
  - Prompt-injection / instruction-override + examiner-disclosure regex detector at the retrieval boundary (flag-not-block, char-span findings) in @beep/file-processing
  - Ordered secure-storage→env secret-resolution chain with placeholder-string + too-short-key rejection
  - Per-user AES-256-GCM key vault (scrypt/IV/auth-tag, source=env|user) — no vault exists in @beep/identity
  - DNS-resolution + private/reserved-IP rejection + redirect:'manual' SSRF hardening beyond the allowlist SafeRemoteHost
  - Pre-LLM secret/PII scrub (provider-key regex → [REDACTED], OOXML scrub across all XML-escape variants) with per-matter audit row
  - PDF x-ray check for recoverable text under failed redaction boxes; untrusted-HTML tag/attr-allowlist sanitizer for fetched opinions
- **alreadyCovered:**
  - @beep/schema SafeRemoteHost allowlist; @beep/uspto S.RedactedFromValue env-first config; @beep/html render boundary; @beep/provenance audit-log home
- **rationale:** A cross-cutting ingestion-boundary security/governance wedge with no current home: prompt-injection detection, ordered secret resolution + per-user vault, SSRF DNS/redirect hardening, secret/PII/OOXML scrubbing with audit, and failed-redaction x-ray all land at the @beep/file-processing retrieval boundary plus @beep/identity (vault) and @beep/provenance (audit). Distinct from multi-provider-llm-dispatch (key precedence) — this is the defensive ingestion gate.
- **cautions:**
  - doc-haus MIT (adapt heuristics); mike unknown-license → reimplement vault/sanitizer patterns, do not copy.
  - Flag-not-block: injection findings are advisory char-span annotations, never silent drops.
  - Coordinate the secret-resolution overlap with multi-provider-llm-dispatch-fallback (key precedence) to avoid two resolvers.

### Multi-provider LLM dispatch + graceful fallback
- **nuggetIds:** Juris.AI#1, TalentScore#2, agentmemory#4, courtlistener#5, harvest-mcp#1, mike#10, research-squad#15, stenoai#2
- **route:** new-exploration · **primaryTarget:** multi-provider-llm-dispatch-fallback (exists: ✗) · **wave:** P2 (P1 0 / P2 7 / P3 1) · **proposedSlug:** multi-provider-llm-dispatch-fallback · **secondaryTargets:** 8 (explorations/effect-orchestration-patterns, packages/agents/server, drivers/anthropic, drivers/nlp-mcp, drivers/openai-compat, drivers/venice-ai, drivers/xai, @beep/langextract)
- **netNew:**
  - Shared Effect dispatch Layer owning user-key>env>CLI precedence + Layer.orElse graceful fallback across @beep/{anthropic,openai-compat,xai,venice-ai}
  - Per-provider OWN env-driven default-model resolution so a fallback never inherits an incompatible model name
  - Typed PROVIDER_REGISTRY + prefix auto-detect + structured api_key_required/setupInstructions errors
  - Declarative resilience-strategy config (round-robin / ordered-fallback / named retry-policy) re-expressed over effect/unstable/ai
  - response_model → effect/Schema-validated structured output binding
- **alreadyCovered:**
  - The four per-provider LLM drivers already exist (anthropic/openai-compat/xai/venice-ai); effect/unstable/ai Toolkit likely abstracts per-provider tool dispatch (mike#10 study)
- **rationale:** GOLD_SYNTHESIS flags a shared multi-provider dispatch Layer as a real gap: the four LLM drivers exist but no Layer owns user-key>env precedence + graceful fallback + per-provider default-model resolution. Adjacent to but distinct from mcp-auth-gated-registration (MCP-side credential-keyed registration) and ingestion-security (secret storage).
- **cautions:**
  - BAML (Apache-2.0) client declarations are config-pattern reference only — do not adopt the BAML runtime.
  - Validate Layer.orElse/ExecutionPlan against vendored effect-v4 before building; reuse anthropic/openai-compat retry code, do not duplicate.
  - Fuse with effect-orchestration-patterns' centralized retry-policy library (shared Schedule policies).
  - License: harvest-mcp#1 (multi-provider factory, rec=port) is unknown-license → reimplement; courtlistener#5 (ref) + mike#10 (study) are AGPL-3.0 → port patterns only.

### Agent skills + cost-tiered routing + ethical-wall identity
- **nuggetIds:** TalentScore#9, doc-haus#12, patent-search-mcp-server#7, patents-mcp-server#9, research-squad#13, uspto_pfw_mcp#13
- **route:** mixed · **primaryTarget:** goals/agentic-professional-runtime (exists: ✓) · **wave:** P1 (P1 4 / P2 2 / P3 0) · **proposedSlug:** null · **secondaryTargets:** 11 (goals/agent-governance-control-plane, goals/epistemic-claim-lifecycle-gate, mcp-auth-gated-registration, packages/agents + domain/server/use-cases, drivers/anthropic, drivers/uspto, law-practice/server, workspace/server)
- **netNew:**
  - Concrete cost-tiered tool-routing Skill + mandatory not-legal-advice gate (today Skill/approvalGates are name-only stubs)
  - DI-injected CurrentUser Context.Tag + RpcMiddleware + matter-scoped query filter (ThreadStore hardcodes orgId=1; only m365 auth exists)
  - Pre-pipeline research/triage decision gate (needs_research/requires_clarification/estimated_complexity) — complements ClaimGate
  - IP-attorney agent Skill prompt-workflows (prior_art_search, validity, FTO, PTAB, landscape; 102/103/101 invalidity scaffold)
- **alreadyCovered:**
  - packages/agents/domain Agent/Skill + use-cases ProfessionalRuntime approvalGates exist as stubs/fixtures; retrieval-grounded agent prompt + per-agent tool allowlist maps onto them (doc-haus#12)
- **rationale:** Mixed: extends the existing goals/agentic-professional-runtime packet. The Skill/ProfessionalRuntime/approvalGate scaffolds exist (alreadyCovered) but cost-tiered routing, CurrentUser/RpcMiddleware ethical-wall identity, the triage gate, and concrete IP-attorney skill workflows are net-new concretizations.
- **cautions:**
  - patent-search/patents-mcp-server MIT (portable); reimplement skill prompts natively.
  - CurrentUser identity is a cross-cutting standards decision (ethical wall / per-tenant) — coordinate with workspace + iam.
  - not-legal-advice gate is a compliance invariant, not optional.

### IP-law domain depth (claim-chart, PTAB, clause taxonomy, prior-art)
- **nuggetIds:** Juris.AI#7, Legal-AI_Project#1, LegalEase#6, patent-search-mcp-server#2, patent-search-mcp-server#3, patent-search-mcp-server#4, us-legal-tools#8, uspto_pfw_mcp#8
- **route:** extend-goal · **primaryTarget:** goals/law-practice-office-action-spike (exists: ✓) · **wave:** P3 (P1 0 / P2 3 / P3 5) · **proposedSlug:** null · **secondaryTargets:** 10 (court-vocabulary-resolver, goals/epistemic-claim-lifecycle-gate, goals/ip-law-knowledge-graph, goals/law-practice-office-action-extraction-rung, goals/ontology-modeling-foundation, drivers/nlp-mcp, drivers/uspto, epistemic/domain, law-practice/domain, rag-retrieval-projection)
- **netNew:**
  - ClaimElement value object: Claim → elements → cited PriorArtReference with spans (no element-level decomposition today)
  - PTAB validity-challenge entity (IPR/PGR/CBM) + controlled outcome/challenge-type vocab
  - CUAD 41-category contract/IP-licensing clause taxonomy (no contract/clause model in law-practice)
  - Keyword→statute-section two-tier confidence lookup (0.9 deterministic / 0.5 LLM-fallback) template
  - Composite risk-verdict {riskLabel, signals{inForce,expiration,challengeCount,...}} keeping AI rationale separable from sound signals
  - Richer PriorArtReference field-set (caseName/citation[]/court_id/bm25 score) + relevance scoring
- **alreadyCovered:**
  - beep has Claim (claimNumber/independent/text), TextAnchor-grounded Distinction, PriorArtReference thin stub, RejectionGround union + OfficeActionReview loop
- **rationale:** Extends goals/law-practice-office-action-spike: deepens the law-practice domain slice with element-level claim decomposition, PTAB/clause/statute taxonomies, risk-verdict aggregation, and PriorArtReference enrichment that grow once the office-action spike passes.
- **cautions:**
  - Mostly P2/P3 domain modeling — gated behind the office-action spike landing first.
  - patent-search-mcp-server MIT; CUAD is a public research dataset (attribution).
  - Keep AI rationale separable from deterministic signals in the risk verdict.

### Governance control plane (bulk-mutation dry-run, audit trace)
- **nuggetIds:** agentmemory#10, research-squad#12
- **route:** extend-goal · **primaryTarget:** goals/agent-governance-control-plane (exists: ✓) · **wave:** P2 (P1 0 / P2 1 / P3 1) · **proposedSlug:** null · **secondaryTargets:** 3 (goals/agentic-professional-runtime, packages/epistemic/server, packages/foundation/capability/observability)
- **netNew:**
  - Previewable filter-gated bulk-mutation op (>=1 filter for non-dryRun) with dryRun preview + audit trail over the authoritative graph
  - Tamper-evident agent activity / LLM+tool-call audit trace (behind the ethical wall)
- **alreadyCovered:** (none)
- **rationale:** Extends goals/agent-governance-control-plane with two deferred governance research notes: a safe bulk-mutation primitive (dry-run + filter gate + audit) and an observability/audit trace of agent tool calls.
- **cautions:**
  - Attach as dated research notes, not new packets.
  - Audit trace must be tamper-evident and ethical-wall aware.

### Claim-lifecycle gate (SHACL severity, transition guard, deterministic scoring)
- **nuggetIds:** TalentScore#5, research-squad#14, research-squad#6
- **route:** mixed · **primaryTarget:** goals/epistemic-claim-lifecycle-gate (exists: ✓) · **wave:** P2 (P1 0 / P2 2 / P3 1) · **proposedSlug:** null · **secondaryTargets:** 3 (deterministic-doc-structure-extraction, packages/epistemic/domain, packages/epistemic/use-cases)
- **netNew:**
  - SHACL severity reporting + non-blocking warnings with source-span metadata on validation results (research-squad#14)
- **alreadyCovered:**
  - validTransitions table + canTransitionTo guard == the shipped forward-only ClaimLifecycle state machine (completed-retained, 11 tests); deterministic weighted scoring + dealbreaker rules == epistemic/use-cases ClaimGate (RETRIEVAL/LOGIC split)
- **rationale:** Mostly attach/dup against the completed-retained epistemic-claim-lifecycle-gate: the transition-guard and deterministic-scoring nuggets are already owned (dup/alreadyCovered). Only SHACL severity + non-blocking warning metadata is a small net-new attach. Mixed.
- **cautions:**
  - Do NOT reopen the completed gate; severity reporting attaches as an additive validation-result field.
  - Keep zero IP-law vocabulary in the epistemic slice (federation invariant).

### MCP scaffold / transport / packaging (already shipped)
- **nuggetIds:** google-patents-mcp#2, harvest-mcp#5, us-legal-tools#11, uspto-patents-mcp#5
- **route:** dup-skip · **primaryTarget:** packages/drivers/nlp-mcp (exists: ✓) · **wave:** P3 (P1 0 / P2 0 / P3 4) · **proposedSlug:** null · **secondaryTargets:** 1 (packages/drivers/m365-mcp)
- **netNew:** (none)
- **alreadyCovered:**
  - Minimal stdio MCP scaffold (Server/ListTools/CallTool stubs), hand-rolled ~90-line JSON-RPC transport, dual library+./mcp packaging, interface-segregated tool contexts == already shipped by @beep/nlp-mcp + @beep/m365-mcp on McpServer.toolkit/layerStdio with Tools/Handlers split
- **rationale:** Dup-skip: every nugget is a bare-MCP-scaffold/transport/packaging lesson already owned by the two shipped Effect-native MCP servers. Reference-only; the high-value MCP gaps (auth-gated registration, progressive disclosure) live in mcp-auth-gated-registration.
- **cautions:**
  - Reference only — do not re-scaffold the MCP servers.

### Secure document download proxy (opaque TTL-gated links)
- **nuggetIds:** patents-mcp-server#11, uspto_pfw_mcp#11
- **route:** new-exploration · **primaryTarget:** secure-document-download-proxy (exists: ✗) · **wave:** P2 (P1 0 / P2 2 / P3 0) · **proposedSlug:** secure-document-download-proxy · **secondaryTargets:** 2 (apps/professional-desktop, packages/drivers/uspto)
- **netNew:**
  - Edge-gated secure resource route (strict-UUID guard, no-store private PDFs) as the desktop-sidecar @beep/uspto File-Wrapper download proxy
  - Encrypted opaque TTL-gated download links (Fernet/DPAPI analog) over the desktop sidecar
- **alreadyCovered:** (none)
- **rationale:** New-exploration: a small desktop-sidecar secure-document-download wedge (UUID/TTL-gated opaque links serving private File-Wrapper PDFs). Two nuggets converge on the same capability.
- **cautions:**
  - Pairs with @beep/uspto File-Wrapper download + the desktop portal; keep keys server-side (no key on desktop).
  - P2 — depends on the uspto driver depth + desktop sidecar.

### Relational grounded-extraction grid (per-cell citations)
- **nuggetIds:** mike#13
- **route:** extend-goal · **primaryTarget:** goals/law-practice-office-action-extraction-rung (exists: ✓) · **wave:** P2 (P1 0 / P2 1 / P3 0) · **proposedSlug:** null · **secondaryTargets:** 3 (packages/epistemic/domain, @beep/langextract, packages/law-practice/domain)
- **netNew:**
  - Relational grounded-extraction grid: tabular columns_config + cells (content + citations jsonb + status per document × column) — a grid of GroundedExtractions with per-cell provenance at scale
- **alreadyCovered:** (none)
- **rationale:** Extends goals/law-practice-office-action-extraction-rung: a relational/tabular model of grounded extraction (document × column grid with per-cell citations + status) layered on the existing GroundedExtraction → IrToLaw rung.
- **cautions:**
  - Keep per-cell citations span-bearing (do not route through the entity-level-span-lossy AnnotatedDocument envelope).
  - License: sole source mike#13 is AGPL-3.0 → reimplement the tabular_cells/per-cell-citation shape from spec into the first-party goal, do not copy.

### IPC/CPC classification SKOS taxonomy seed
- **nuggetIds:** patents-mcp-server#7
- **route:** extend-goal · **primaryTarget:** goals/ip-law-knowledge-graph (exists: ✓) · **wave:** P2 (P1 0 / P2 1 / P3 0) · **proposedSlug:** null · **secondaryTargets:** 4 (court-vocabulary-resolver, drivers/nlp-mcp, drivers/uspto, foundation/modeling/rdf)
- **netNew:**
  - WIPO-IPC / CPC classification taxonomy (section+class hierarchical lookup) as an IP controlled-vocabulary / SKOS-taxonomy seed
- **alreadyCovered:** (none)
- **rationale:** Extends goals/ip-law-knowledge-graph with a deferred SKOS-taxonomy scope note: the IPC/CPC classification hierarchy seeds the IP controlled vocabulary on the IP-law graph.
- **cautions:**
  - Deferred scope note on the IP-law graph; IPC/CPC are public WIPO/EPO-USPTO schemes.

### Conversation branching (branchIndex sibling ordering)
- **nuggetIds:** LegalEase#7
- **route:** extend-goal · **primaryTarget:** goals/workspace-thread-domain (exists: ✓) · **wave:** P2 (P1 0 / P2 1 / P3 0) · **proposedSlug:** null · **secondaryTargets:** 1 (packages/workspace/domain)
- **netNew:**
  - Conversation branching via branchIndex sibling-ordering alongside the existing Turn.parentTurnId
- **alreadyCovered:**
  - goals/workspace-thread-domain already owns Turn branching (parentTurnId)
- **rationale:** Extends goals/workspace-thread-domain: adds a branchIndex sibling-ordering variant to the existing parent_id Turn branching model.
- **cautions:**
  - Additive field on the existing Turn model; no new packet.

### Local-first projection sync (EventStreamHub)
- **nuggetIds:** TalentScore#10
- **route:** new-exploration · **primaryTarget:** local-first-projection-sync (exists: ✗) · **wave:** P2 (P1 0 / P2 1 / P3 0) · **proposedSlug:** local-first-projection-sync · **secondaryTargets:** 3 (apps/professional-desktop, goals/desktop-chat-surface, packages/workspace/server)
- **netNew:**
  - Per-user live connection hub (EventStreamHub) refreshing projections after an authority write — zero EventStreamHub exists today
- **alreadyCovered:** (none)
- **rationale:** New-exploration: a @beep/workspace-server EventStreamHub for real-time local-first projection sync after authority writes. Single high-signal desktop nugget; verified absent.
- **cautions:**
  - P2 desktop/local-first concern; coordinate with the authority/projection/cache standard.

### Contract-first RPC + OTLP tracing (already shipped)
- **nuggetIds:** TalentScore#11
- **route:** dup-skip · **primaryTarget:** packages/agents/use-cases (exists: ✓) · **wave:** P2 (P1 0 / P2 1 / P3 0) · **proposedSlug:** null · **secondaryTargets:** 2 (goals/agent-governance-control-plane, packages/foundation/capability/observability)
- **netNew:** (none)
- **alreadyCovered:**
  - Contract-first RPC (Chat.rpc.ts) + OTLP tracing (@beep/observability) already shipped
- **rationale:** Dup-skip: contract-first RPC + OTLP tracing already owned.
- **cautions:**
  - Reference only.

### LLM HttpClient wrapper + JSON repair (already owned)
- **nuggetIds:** LegalEase#2, google-patents-mcp#3
- **route:** dup-skip · **primaryTarget:** packages/drivers/anthropic (exists: ✓) · **wave:** P2 (P1 0 / P2 1 / P3 1) · **proposedSlug:** null · **secondaryTargets:** 3 (packages/agents, packages/drivers/openai-compat, packages/drivers/runpod)
- **netNew:** (none)
- **alreadyCovered:**
  - AbortController timeout + URLSearchParams + Redacted key log-redaction == existing LLM HttpClient wrapper; balanced-bracket JSON recovery == Anthropic.repair.ts / AnthropicTurnKernel BlockRepair
- **rationale:** Dup-skip: HTTP driver-wrapper + chatty-LLM JSON repair already owned by @beep/anthropic.
- **cautions:**
  - Reference only.

### Env-first Redacted secret resolution (already owned)
- **nuggetIds:** google-patents-mcp#4
- **route:** dup-skip · **primaryTarget:** packages/drivers/uspto (exists: ✓) · **wave:** P3 (P1 0 / P2 0 / P3 1) · **proposedSlug:** null · **secondaryTargets:** 1 (packages/foundation/modeling/schema)
- **netNew:** (none)
- **alreadyCovered:**
  - Env-first fail-fast Redacted secret resolution == Uspto.config.ts S.RedactedFromValue + Effect Config
- **rationale:** Dup-skip: env-first Redacted secret resolution already owned by @beep/uspto config.
- **cautions:**
  - Reference only; not the uspto-patent-driver-depth packet.

### Closed-struct extraction contracts (already owned)
- **nuggetIds:** courtlistener#6
- **route:** dup-skip · **primaryTarget:** packages/epistemic/domain (exists: ✓) · **wave:** P3 (P1 0 / P2 0 / P3 1) · **proposedSlug:** null · **secondaryTargets:** 1 (packages/foundation/modeling/schema)
- **netNew:** (none)
- **alreadyCovered:**
  - extra='forbid' closed-struct + annotated-description extraction discipline == schema kit + epistemic.CandidateClaim
- **rationale:** Dup-skip: closed-struct extraction contracts already owned.
- **cautions:**
  - Reference only.

### Boundary validation -> structured result (already owned)
- **nuggetIds:** agentmemory#13
- **route:** dup-skip · **primaryTarget:** packages/foundation/modeling/schema (exists: ✓) · **wave:** P2 (P1 0 / P2 1 / P3 0) · **proposedSlug:** null · **secondaryTargets:** 1 (packages/epistemic/domain)
- **netNew:** (none)
- **alreadyCovered:**
  - Boundary validation returning structured result == S.decodeUnknownEffect field-path-prefixed ParseError at the retrieval→logic wall
- **rationale:** Dup-skip: boundary validation → structured result already the core schema-kit pattern.
- **cautions:**
  - Reference only.

### 35 USC 101/102/103/112 rejection taxonomy (already owned)
- **nuggetIds:** patent-search-mcp-server#1, patents-mcp-server#5
- **route:** dup-skip · **primaryTarget:** packages/law-practice/domain (exists: ✓) · **wave:** P2 (P1 0 / P2 2 / P3 0) · **proposedSlug:** null · **secondaryTargets:** 1 (packages/law-practice/use-cases)
- **netNew:** (none)
- **alreadyCovered:**
  - 35 USC 101/102/103/112 vocabulary == RejectionGround tagged union (Rejection.values.ts) + OfficeActionReview loop
- **rationale:** Dup-skip: the office-action rejection taxonomy already shipped as RejectionGround.
- **cautions:**
  - Reference only.

### Typed-JSONB persistence (already owned)
- **nuggetIds:** TalentScore#8
- **route:** dup-skip · **primaryTarget:** packages/workspace/server (exists: ✓) · **wave:** P2 (P1 0 / P2 1 / P3 0) · **proposedSlug:** null · **secondaryTargets:** 1 (packages/foundation/modeling/schema)
- **netNew:** (none)
- **alreadyCovered:**
  - Typed-JSONB persistence == ThreadStore Drizzle repo + EntitySchema.persist.jsonb read-revalidation
- **rationale:** Dup-skip: typed-JSONB persistence already owned.
- **cautions:**
  - Reference only.

## Cautions & provenance (rolled up)

Cross-cutting cautions seen across clusters, rolled up:

- **PatentsView / USPTO-ODP sunset:** api.patentsview.org ended Feb-2025 (410 / 301-redirects HTML to data.uspto.gov/odp); PatentSearch → USPTO Open Data Portal on 2026-03-20 with mandatory key reissue; legacy USPTO Developer Hub decommissioned 2026-06-05. Target data.uspto.gov/odp + api.uspto.gov X-API-KEY only; port any PatentsView DSL *shape* but never the dead endpoint. (gov-legal-data-driver-codegen, uspto-patent-driver-depth, mcp-auth-gated-registration, four-tier agent-memory)
- **CourtListener V4 Token auth:** anonymous = 401; header must be literally `Authorization: Token <key>` (DRF TokenAuthentication, not Bearer/Api-Key), target /api/rest/v4/ (V3 legacy); SCOTUS visualization endpoints deprecated — do not generate them.
- **License gravity:**
  - AGPL → clean-room reimplement from spec, never copy source: courtlistener/eyecite (citation parse, MinHash/LSH dedup, multi-provider ref), mike (ground-before-cite contract, version-lineage enum, tabular per-cell grid).
  - Unknown license → reimplement, do not copy: harvest-mcp, lawyergpt (also pins decommissioned Gemini embeddings), us-gov-open-data-mcp (treat as reimplement).
  - Commercial (most restrictive in corpus) → reference shapes only: screenpipe (LicenseRef-Screenpipe-Commercial).
  - SerpApi → Google Patents access is via SerpApi (commercial gateway); keep as an opt-in alternative source.
  - Permissive (MIT/BSD-2/Apache-2.0) → port with attribution: us-legal-tools (MIT, port the pipeline not the Orval output), doc-haus (MIT), courts-db (BSD-2), doctor (BSD-2, verify), agentmemory (Apache-2.0), patent-search/patents-mcp-server/mcp-uspto/uspto_pfw (MIT), CUAD (public research dataset).
- **langextract streaming-lock conflict:** the langextract V1 SPEC (L88-89) defers streaming ('raw AI stream chunks are not public API'); the TalentScore Partial/Complete streaming gate is catalog-marked dup but is actually net-new-conflicting — route it (and the deterministic no-model extractors) to the sibling **deterministic-doc-structure-extraction** packet, do NOT reopen the lock.
- **RRF single-owner:** the hybrid 3-channel RRF retrieval layer has exactly one designated owner — **rag-retrieval-projection**. agent-memory-tiers-bitemporal-edges and goals/trustgraph-port (FalkorDB/GraphRAG) must CONSUME that shared layer, never build a second/third.
- **null nugget patents-mcp-server#12:** carried with an imputed P2 priority and routed into the **mcp-auth-gated-registration** cluster (no own catalog priority; folded into that cluster's MCP-design gap set).
- **Dangling effect-capability-kg ATLAS ref:** an `effect-capability-kg` reference appears in ATLAS provenance with no corresponding directory on disk — flagged as a stale navigation entry, not a routing target.

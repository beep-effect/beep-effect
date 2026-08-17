# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-06-29 — Gold-intake seed

Synthesis pointer: see the `### Legal / court / patent data ingestion` section
of [`explorations/_gold-intake/GOLD_SYNTHESIS.md`](../_gold-intake/GOLD_SYNTHESIS.md)
(USPTO/patent subsections: ppubs handshake, PatentsView/USPTO query-DSL +
friendly→API field mapping, PatentsView v1 sunset → ODP migration guard, Lucene
escaping, EPO OPS new driver, Google Patents BigQuery new driver, USPTO
error-shape normalization), plus exec-summary items 6 ("USPTO ODP depth") and 7
("PatentsView/PatentSearch query DSL + Lucene escaping").

Cluster rationale: the hand-rolled `@beep/uspto` driver already speaks ODP
(api.uspto.gov) for the application-metadata core
(getApplication/getContinuity/getDocuments/downloadDocument/searchApplications)
with number-normalization helpers and a typed `UsptoError` model, so those
nuggets are refinements rather than gaps and the cluster routes as
**extend-in-place** onto `packages/drivers/uspto`, NOT a restart. The genuine
depth is net-new: a Lucene/ODP query-DSL surface (escaping, friendly→API field
mapping, identifier disambiguation, structured filter/rangeFilter/sort POST
body), deeper prosecution data (/transactions timeline, status-code +
document-code vocabularies, PTAB/assignments/foreign-priority endpoints,
parameter-object validation), and a graceful 403→source-document fallback. EPO
OPS is fully net-new (`packages/drivers/epo` does not exist) and BigQuery +
ppubs + Google-Patents/SerpApi add alternative international/full-text retrieval
tiers the ODP driver cannot cover. Codegen precedent is **runpod** (openapi.json
+ scripts/generate.ts), but uspto is deliberately hand-rolled — extend it
directly without bolting on generate.ts/Orval/axios/Zod.

route=mixed · wave=P2 (histogram P1:6 / P2:15 / P3:5) · primaryTarget=`packages/drivers/uspto` (exists) · themeSpan=[data-ingestion, effect-ts, ip-domain-models, legal-nlp, provenance-evidence] · secondaryTargets=[goals/ip-law-knowledge-graph, goals/law-practice-office-action-extraction-rung, goals/law-practice-office-action-spike, mcp-auth-gated-registration, packages/agents, packages/drivers/epo (NEW — EPO OPS OAuth2, international patent family + legal status), packages/drivers/google-patents, packages/drivers/google-patents-bigquery, packages/drivers/govinfo, packages/drivers/nlp-mcp, packages/foundation/capability/langextract (@beep/langextract span-grounded extraction over File-Wrapper office-action PDFs), packages/foundation/capability/semantic-web, packages/law-practice/domain (PatentAsset/OfficeAction/Rejection/PriorArtReference fed by status-code/doc-tier/continuity/PTAB vocab), ingestion-security-secret-governance + onepassword skill (EPO OAuth2 + BigQuery/GCP creds), court-vocabulary-resolver / official-data-sync-foundation (CPC/IPC taxonomy + docket-normalization eval fixtures)]

Routing split: **netNew (19 ids)** = courtlistener#4, google-patents-mcp#1, mcp-uspto#4, mcp-uspto#5, patents-mcp#1, patents-mcp#2, patents-mcp#3, patents-mcp-server#2, patents-mcp-server#4, patents-mcp-server#8, patents-mcp-server#10, patents-mcp-server#13, us-gov-open-data-mcp#7, uspto-patents-mcp#1, uspto_pfw_mcp#1, uspto_pfw_mcp#2, uspto_pfw_mcp#3, uspto_pfw_mcp#7, uspto_pfw_mcp#14. **alreadyCovered (7 ids — reuse/refine, not new)** = mcp-uspto#3, mcp-uspto#6, patents-mcp#6, patents-mcp#7, patents-mcp-server#6, uspto-patents-mcp#3, uspto-patents-mcp#8.

### Nuggets (26)

Net-new — query DSL / Lucene / identifiers / search params:

- **uspto_pfw_mcp#2** (uspto_pfw_mcp) — Lucene query-term escaping with documented safe/unsafe character policy. `src/patent_filewrapper_mcp/api/helpers.py:45-78`. → netNew "Lucene query-term escaping with documented safe/unsafe metacharacter policy + length cap (anti-injection)" → `Uspto.search.ts` escaping helper. Snippet: `specials = r'[\\\\\\+&|\\!\\(\\)\\{\\}\\^~]'; escape, leave : " [ ] - * unescaped; raise if len>1000`.
- **uspto_pfw_mcp#3** (uspto_pfw_mcp) — User-friendly to API field-name mapping for Lucene queries. `src/patent_filewrapper_mcp/api/helpers.py:621-676`. → netNew "Friendly to API nested field-name mapping (patentNumber: -> applicationMetaData.patentNumber:)" → `Uspto.search.ts` field map. Snippet: `field_pattern = r'(\\w+(?:\\.\\w+)*)\\s*:'; if '.' in name pass-through else map friendly→nested API path`.
- **mcp-uspto#5** (mcp-uspto) — PatentsView query DSL builder (CPC/date/assignee filters). `src/tools/patentsview-search.ts:74-107`. → netNew "ODP structured search + JSON query-DSL builder over ODP fields" (port the DSL *shape* `_or/_and/_text_any/_begins/_gte/_lte`, RETARGET to ODP — NEVER PatentsView) → `Uspto.search.ts`. Snippet: `{_or:[{_text_any:{patent_title:q}},{_text_any:{patent_abstract:q}}]}; _begins:{cpc_group_id:cpc}; _gte:{patent_date:from}`.
- **uspto-patents-mcp#1** (uspto-patents-mcp) — PatentsView query-DSL builder (text/assignee/inventor/date → API query). `src/patentsview.ts:151-161`. → netNew "ODP/JSON query-DSL builder + identifier disambiguation feed" (port shape, retarget ODP — NEVER PatentsView) → `Uspto.search.ts`. Snippet: `_text_any over title+abstract; nested assignees.assignee_name/inventors.inventor_name; _gte/_lte patent_date combined under _and`.
- **uspto_pfw_mcp#1** (uspto_pfw_mcp) — Smart patent identifier normalization (disambiguates app vs patent vs publication + confidence). `src/patent_filewrapper_mcp/util/identifier_normalization.py:36-165`. → netNew "Smart identifier disambiguation (application vs patent vs publication, confidence) emitting the correct Lucene field query" → `Uspto.search.ts` / identifier normalization (8-digit series-08-17 ambiguity heuristic). Snippet: `strip US/USPTO + kind code [A-Z]\\d+$; identifier_type=application; search_query=f'applicationNumberText:{cleaned}'`.
- **uspto_pfw_mcp#14** (uspto_pfw_mcp) — Parameter-object pattern with invariant validation for search APIs. `src/patent_filewrapper_mcp/models/search_params.py:11-57`. → netNew "Search parameter-object validation + attorney filters (art_unit/examiner/customer_number/filing+grant date ranges)" → effect/Schema-validated request models. Snippet: `@dataclass SearchParameters(limit, art_unit, examiner_name, filing_date_start...); __post_init__ raise if limit>500`.
- **us-gov-open-data-mcp#7** (us-gov-open-data-mcp) — USPTO ODP SDK: PTAB trials, continuity chains, prosecution transactions, assignments, query DSL. `src/apis/uspto/sdk.ts:42-67`. → netNew "ODP structured search POST body (filter/rangeFilter/sort)" + "PTAB trials (IPR/PGR/CBM/DER) + assignments + foreign-priority + patent-term-adjustment ODP endpoints" → new ODP endpoint surface on `@beep/uspto`. Snippet: `applicationTypeCodes{UTL,DES,PLT,PPA,REI}; trialTypeCodes{IPR,PGR,CBM,DER}; OdpSearchResult{count,requestIdentifier,results[],facets}`.

Net-new — prosecution timeline / status / document tiers / fallback:

- **mcp-uspto#4** (mcp-uspto) — Prosecution-timeline transaction model (status code / date / description). `src/tools/patent-status.ts:13-53`. → netNew "Prosecution-timeline endpoint /transactions (statusCodeBag -> status/date/description model)" → `@beep/uspto` prosecution-timeline model; feeds law-practice OfficeAction + provenance dated events. Snippet: `data.statusCodeBag.map(s => ({status:s.statusCodeText, date:s.statusDate, description:s.statusDescriptionText}))`.
- **patents-mcp-server#8** (patents-mcp-server, adopt) — USPTO application status-code dictionaries (prosecution lifecycle vocabulary). `src/tools/utility.tools.ts:15-46`. → netNew "USPTO numeric status-code to prosecution-state controlled vocabulary (lifecycle dictionary)" → status-code vocab; feeds law-practice ClaimLifecycle / OfficeAction state transitions (note: a divergent 2nd map lives in src/resources/index.ts). Snippet: `STATUS_CODE_MAP {"30":"Patented Case","41":"Non Final Action Mailed","47":"Final Rejection Mailed","70":"Notice of Allowance","160":"RCE Filed"}`.
- **uspto_pfw_mcp#7** (uspto_pfw_mcp, adopt) — USPTO prosecution document-code litigation importance tiers. `src/patent_filewrapper_mcp/util/package_manager.py:57-60`. → netNew "Prosecution document-code litigation-importance tiers (critical/important/standard/administrative)" → document-tier vocab; feeds law-practice OfficeAction/Rejection/PriorArtReference + doc prioritization. Snippet: `CRITICAL=[NOA,CTFR(Final Rej),CTNF(Non-Final Rej),CLM,ABST]; IMPORTANT=[892,1449,REM,FWCLM,DRW,SPEC]; STANDARD=[RCEX,EXIN,CTAV,IDS,WFEE]`.
- **patents-mcp-server#4** (patents-mcp-server, reference) — 403-aware fallback that reroutes the agent to the authoritative document path. `src/tools/office-actions.tools.ts:20-27`. → netNew "403 structured-endpoint to source-document graceful-degradation fallback (always reach the primary PDF)" → matches beep provenance ethos. Snippet: `OA_FALLBACK_MESSAGE: on 403 → list documents (odp-get-documents) then download office-action PDF (OCR if scanned)`.

Net-new — ppubs full-text tier (undocumented, fragile):

- **patents-mcp#1** (patents-mcp) — USPTO Public Search (ppubs) session + search auth pattern. `src/patent_mcp_server/uspto/ppubs_uspto_gov.py:68-118`. → netNew "ppubs Public Search session/auth handshake + 403 reauth / 429 backoff for full-text not in ODP" → `Uspto.ppubs.service.ts` (CAUTION: undocumented reverse-engineered endpoint, may break). Snippet: `GET /pubwebapp/ seeds cookies; POST /api/users/me/session X-Access-Token:"null" → caseId+token; 403→re-session; 429→wait x-rate-limit-retry-after-seconds`.
- **patents-mcp#2** (patents-mcp) — ppubs searchWithBeFamily query template (JSON payload schema). `src/patent_mcp_server/json/search_query.json:1-34`. → netNew "ppubs searchWithBeFamily JSON request wire format (.pn./brs qt, per-database filters, family preference)" → `Uspto.ppubs.models.ts` PpubsSearchRequest. Snippet: `familyIdFirstPreferred:US-PGPUB; query{op:OR, q:'("6103599").pn.', qt:"brs", databaseFilters:[US-PGPUB,USPAT,USOCR]}`.

Net-new — EPO OPS driver (packages/drivers/epo — does NOT exist yet):

- **patents-mcp-server#2** (patents-mcp-server) — EPO OPS OAuth2 client-credentials client with token cache, throttle detection, namespace-aware XML parsing. `src/clients/epo-ops.client.ts:40-127`. → netNew "EPO OPS OAuth2 client-credentials driver (token cache, x-throttling 'black' detect, force-array XML parse) — packages/drivers/epo (NEW)" (CAUTION: OAuth2 secrets, gate behind 1Password). Snippet: `base64 client-credentials grant, 19-min cached token (1-min buffer), retry on 400/401 token-clear; x-throttling-control "black" → throw; force-array family-member/classification-cpc/applicant/inventor/priority-claim/legal`.
- **patents-mcp-server#13** (patents-mcp-server, reference) — EPO CQL + BigQuery + ODP query-syntax cheat-sheet as an MCP resource. `src/resources/index.ts:60-90`. → netNew "EPO CQL / ODP / BigQuery query-syntax cheat-sheet resource for prose-to-query agents" → resource for NLP query-construction agents. Snippet: `EPO CQL ti/pa/cpc/pd fields, max 10 terms/2000 results; ODP free-text + patent-number; BigQuery SEARCH() + CROSS JOIN UNNEST(claims_localized)`.

Net-new — BigQuery + Google Patents alternative retrieval tiers:

- **patents-mcp-server#10** (patents-mcp-server) — BigQuery full-text patent search with mandatory dry-run cost gating and UNNEST struct handling. `src/clients/bigquery.client.ts:33-72`. → netNew "BigQuery patents-public-data global retrieval with mandatory dry-run cost gating + UNNEST localized text" → `packages/drivers/google-patents-bigquery` (NEW) (CAUTION: GCP creds + billing; keep dry-run gate mandatory). Snippet: `always dryRun first → estimateCost($5/TB, 1TB free); EXISTS+UNNEST localized title/abstract with CONTAINS_SUBSTR; depth-1/2 citation CTE`.
- **patents-mcp#3** (patents-mcp) — Google Patents BigQuery parameterized search queries (claims/description/CPC/inventor/assignee). `src/patent_mcp_server/google/bigquery_client.py:260-320`. → netNew "Google Patents BigQuery parameterized queries (nested claims_localized/description_localized extraction)" → `packages/drivers/google-patents-bigquery` (NEW); feeds CandidateClaim/PriorArtReference ingestion (CAUTION: GCP). Snippet: `SELECT publication_number, claims_localized FROM patents-public-data WHERE publication_number=@param; claims/descriptions NESTED in publications, no separate tables`.
- **google-patents-mcp#1** (google-patents-mcp, reference) — Google Patents search input schema (filter taxonomy). `src/index.ts:291-298`. → netNew "Google Patents via SerpApi alternative source + prior-art filter taxonomy (status/type/date-prefix vocab)" → `packages/drivers/google-patents`. Snippet: `before:'publication:20231231'/'filing:YYYYMMDD'; status enum GRANT|APPLICATION; type enum PATENT|DESIGN; country/language/inventor/assignee`.

Net-new — docket/serial-number normalization prompt + eval fixtures:

- **courtlistener#4** (courtlistener, port) — Few-shot LLM prompt for docket-number normalization. `cl/search/llm_prompts.py:77-92`. → netNew "Few-shot docket/serial-number normalization prompt + reusable eval/test fixture corpus" → `@beep/langextract` / `packages/drivers/nlp-mcp` (USPTO application numbers behave like dockets); the ~55-example corpus is reusable eval fixtures. Snippet: `F_PROMPT = guidelines + OUTPUT_FORMAT(JSON keyed by unique_id) + ~55 F_EXAMPLES; sibling F_TIE_BREAKER adjudicates two attempts`.

Already-covered — reuse/refine in `@beep/uspto`, NOT new build:

- **mcp-uspto#3** (mcp-uspto) — Patent continuity (family-tree) data model — parent/child + continuity type. `src/tools/patent-continuity.ts:14-23`. → alreadyCovered "ODP continuity (parent/child) resolution + model — @beep/uspto getContinuity/UsptoContinuity"; refine continuity-type enum (continuation/divisional/CIP/provisional); feeds goals/ip-law-knowledge-graph derivation edges + law-practice PatentAsset. Snippet: `ContinuityRecord{parent/childApplicationNumber, parent/childPatentNumber, parent/childFilingDate, continuityType, claimType}`.
- **mcp-uspto#6** (mcp-uspto) — File-wrapper document listing model (office actions / responses / claims). `src/tools/patent-documents.ts:57-63`. → alreadyCovered "ODP File-Wrapper document listing — @beep/uspto getDocuments/UsptoDocumentReference + downloadDocument"; refine directionCategory (incoming/outgoing); feeds @beep/langextract span extraction. Snippet: `documentBag → {document_id, description(documentCodeDescriptionText), date(officialDate), direction(directionCategory), page_count}`.
- **patents-mcp#6** (patents-mcp) — USPTO Open Data Portal (ODP) endpoint map for application metadata. `src/patent_mcp_server/patents.py:412-464`. → alreadyCovered "ODP application-metadata endpoints (meta-data/continuity/documents) already spoken — @beep/uspto getApplication, api.uspto.gov"; catalogs the full v1 endpoint surface (/adjustment, /assignment, /attorney, /foreign-priority, /transactions, /associated-documents) to extend toward. Snippet: `{BASE}/api/v1/patent/applications/{n}/meta-data|continuity|foreign-priority|transactions; X-API-KEY header`.
- **patents-mcp-server#6** (patents-mcp-server) — Patent number normalization (country prefix + kind code stripping). `src/lib/patent-number.ts:1-21`. → alreadyCovered "Patent/application number normalization (prefix + kind-code strip) — @beep/uspto normalizeUsptoPatentNumber/normalizeUsptoApplicationNumber"; cross-check multi-country prefix coverage. Snippet: `countryPrefix /^(US|EP|WO|JP|CN|KR|DE|FR|GB|CA|AU)/; kindCode /[-\\s]?([A-Z]\\d?)$/; strip separators → canonical id`.
- **patents-mcp#7** (patents-mcp, reference) — Standardized ApiError response factory. `src/patent_mcp_server/util/errors.py:14-68`. → alreadyCovered "Typed driver error model (config/not-found/rate-limited/response-status/transport) — @beep/uspto UsptoError/UsptoErrorReason"; enumerates real USPTO error field variants (error/message/errorCode/errorDetails) worth modeling as tagged errors. Snippet: `{error:true, message, status_code?, error_code?, details?}; from_http_error normalizes errorCode/errorDetails`.
- **uspto-patents-mcp#3** (uspto-patents-mcp, reference) — PatentsView v1 sunset detection — graceful upstream-migration error. `src/patentsview.ts:177-183`. → alreadyCovered "ODP-targeted client with PatentsView sunset already avoided — @beep/uspto USPTO_API_URL"; confirms NEVER-PatentsView caution; model as `UsptoEndpointSunset` tagged error. Snippet: `if content-type !json → throw "PatentsView v1 sunset; migrate to data.uspto.gov/odp (API key registration)"`.
- **uspto-patents-mcp#8** (uspto-patents-mcp, reference) — USPTO MCP tool schemas (search/read/portfolio/citation-graph) + PatentSummary model. `src/tools.ts:6-32`. → alreadyCovered "Core search/read tool surface + canonical patent record models — @beep/uspto searchApplications/UsptoApplicationMetadata"; record as refinement, not new. Snippet: `uspto_patent_search inputSchema{query,assignee,inventor,date_from,date_to,limit}; PatentSummary{patent_id,title,date,abstract,assignees[],inventors[],claims[]}`.

### netNew (build list)

- Lucene query-term escaping with documented safe/unsafe metacharacter policy + length cap (anti-injection)
- Friendly to API nested field-name mapping for Lucene queries (patentNumber: -> applicationMetaData.patentNumber:)
- Smart identifier disambiguation (application vs patent vs publication, confidence) emitting the correct Lucene field query
- ODP structured search POST body (filter/rangeFilter/sort) + JSON query-DSL builder over ODP fields
- Prosecution-timeline endpoint /transactions (statusCodeBag -> status/date/description model)
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

### alreadyCovered (reuse, don't rebuild)

- ODP continuity (parent/child) resolution + model — @beep/uspto (getContinuity, UsptoContinuity)
- ODP File-Wrapper document listing — @beep/uspto (getDocuments, UsptoDocumentReference) + downloadDocument
- ODP application-metadata endpoints (meta-data/continuity/documents) already spoken — @beep/uspto (getApplication, USPTO_API_URL api.uspto.gov)
- Patent/application number normalization (prefix + kind-code strip) — @beep/uspto (normalizeUsptoPatentNumber, normalizeUsptoApplicationNumber)
- Core search/read tool surface + canonical patent record models — @beep/uspto (searchApplications, UsptoApplicationMetadata)
- Typed driver error model (config/not-found/rate-limited/response-status/transport) — @beep/uspto (UsptoError, UsptoErrorReason)
- ODP-targeted client with PatentsView sunset already avoided — @beep/uspto (USPTO_API_URL)

### Cautions

- NEVER PatentsView: api.patentsview.org was sunset Feb-2025 (410 / 301-redirects HTML to data.uspto.gov/odp). The query-DSL nuggets mcp-uspto#5 and uspto-patents-mcp#1 document PatentsView's JSON _or/_and/_text_any DSL — port the DSL *shape* but retarget it to ODP, never the dead endpoint.
- ODP key reissue 2026-03-20 (PatentSearch -> ODP) and legacy Developer Hub decommissioned 2026-06-05 — pin to data.uspto.gov/odp + api.uspto.gov X-API-KEY only.
- EPO OPS (patents-mcp-server#2, patents-mcp-server#13) requires OAuth2 client-credentials secrets — out of offline scope; gate the epo driver behind secret governance (1Password), never commit creds.
- BigQuery nuggets (patents-mcp-server#10, patents-mcp#3, patents-mcp-server#13) require GCP creds + billing; keep the dry-run cost gate mandatory; out of the default scope on cost grounds.
- ppubs (patents-mcp#1, patents-mcp#2) is an undocumented reverse-engineered USPTO endpoint — fragile and may break without notice; treat as a best-effort full-text tier behind ODP, not a primary source.
- Codegen precedent = runpod (openapi.json + scripts/generate.ts), but uspto is hand-rolled — EXTEND in place; do NOT add generate.ts blindly or introduce Orval/axios/Zod.


## 2026-08-17 — correction note (in-place edit above)

The 2026-08-17 operator-directed provider-language sweep rephrased one earlier
line in place ("offline/privilege-safe default scope" became a cost-scoped
default). Original wording lives in git history; recorded here so the
append-only trail stays honest without resurrecting retired phrasing.

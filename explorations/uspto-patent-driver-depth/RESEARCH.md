# USPTO Patent Driver Depth — Research

Synthesis of five research subtopics + CAPTURE for the **extend-in-place** depth
build on the hand-rolled `@beep/uspto` driver plus two net-new credentialed
sibling drivers. Raw, fully-cited findings live in `research/*.md`; this file is
the navigable summary. Verified against the live tree on 2026-06-29.

---

## External Landscape

### 1. ODP query/search surface — the core extend-in-place target
Raw: [`research/odp-query-dsl-and-lucene-surface.md`](research/odp-query-dsl-and-lucene-surface.md)

- The search endpoint is `…/api/v1/patent/applications/search` on
  `api.uspto.gov`; the existing driver already calls it as a **GET** with `?q=`
  (returns top-25 by default). A structured **POST** body with keys (all
  optional) `q, filters, rangeFilters, sort, fields/fieldList, pagination,
  facets, downloadType` is **documented by secondary connectors, NOT yet
  live-probed against this applications endpoint** — the Microsoft Power
  Platform connector (mirrors the ODP OpenAPI)
  <https://learn.microsoft.com/en-us/connectors/uspatenttrademarkoff/> and
  `patent_client`
  <https://patent-client.readthedocs.io/en/latest/user_guide/open_data_portal.html>.
  The POST structured-body acceptance is **confirmed for PTAB
  `/proceedings/search`** but **unconfirmed for `applications/search`** (see
  Unresolved below). **Keep `searchStructured` behind a spike** until a
  key-authenticated probe or a real-browser Swagger read confirms the
  applications endpoint accepts the POST body; do not ship it against an
  assumed method/body combination.
- **Shape gotcha** (when the POST body is confirmed): `filters` use
  `name`/`value[]` (exact-match, multi-value OR), while `rangeFilters` and
  `sort` use `field` — model the asymmetry exactly.
- The `q` parameter is USPTO **"Simplified Query Syntax"**, which **appears to
  be** OpenSearch/Lucene `query_string`-like, not raw Lucene; spec PDF
  <https://data.uspto.gov/documents/documents/ODP-API-Query-Spec.pdf>. The Lucene
  `query_string` grammar (`field:value`, `AND/OR/NOT`, `[a TO b]`, `term~`,
  `"a b"~10`, `*`/`?`, `^boost`) per
  <https://lucene.apache.org/core/2_9_4/queryparsersyntax.html> is the *upper
  bound* of what such an endpoint can express — **do not assume ODP accepts the
  full grammar.** That 2.9.4 reference predates modern OpenSearch `query_string`,
  and the exact ODP-accepted feature set is still UNVERIFIED behind the
  WAF/Swagger gate (see Unresolved). **Implement a tested subset**: gate each
  grammar feature (ranges, fuzzy, proximity, boost, wildcards) behind
  fixtures/live probes, use **literal-term escaping by default**, and expose
  advanced field-query pass-through only as an explicitly **unsafe/advanced
  mode**.
- **Escaping is two-mode.** Classic Lucene reserves
  `+ - && || ! ( ) { } [ ] ^ " ~ * ? : \` (no `/`); modern Elasticsearch/OpenSearch
  `query_string` reserves a **broader** set adding `= > < /`, where `<`/`>`
  **cannot be escaped at all** (must be stripped) and a literal `\` inside a JSON
  body must be doubled <https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-query-string-query>.
  So the driver needs (i) a LITERAL-TERM escaper (full modern set, strip `<>`) and
  (ii) a FIELD-QUERY/composition escaper (the `uspto_pfw_mcp#2` narrow policy that
  leaves `: " [ ] - *` unescaped so callers can still field-scope) plus a
  schema-enforced length cap (~1000 chars) as a DoS/injection guard.
- **Friendly→API nested field mapping:** ODP nests bibliographic fields under
  `patentFileWrapperDataBag[].applicationMetaData.*`; a bare friendly name
  (`patentNumber:`) rewrites to its dotted path
  (`applicationMetaData.patentNumber:`) unless it already contains a `.` or is the
  top-level `applicationNumberText`. Safe default: always emit fully-qualified
  dotted paths (bare-alias server acceptance is UNVERIFIED).
- **Identifier disambiguation ladder** (app vs patent vs publication + confidence):
  kind code `A1/A2/A9` → publication; `B1/B2/E/P/S` → granted patent; 11-digit
  year-prefixed → publication; letter prefix `D/RE/PP/H/T` → patent; 8-digit with a
  known series code (`08`–`19`) → application **but genuinely ambiguous** since
  8-digit utility patent numbers now exist (utility crossed 11M in 2021). Series
  codes encode era/type (provisional `60–63`, design `29`); MPEP 503
  <https://www.uspto.gov/web/offices/pac/mpep/s503.html>, kind codes
  <https://www.uspto.gov/patents/search/authority-files/uspto-kind-codes>. Return a
  confidence score, never a hard guess.
- **PatentsView DSL port:** keep the `_and/_or/_not/_gte/_lte/_text_any/_begins/...`
  AST *shape* (operators verified via rOpenSci
  <https://docs.ropensci.org/patentsview/articles/writing-queries.html>) but
  **compile it to ODP** — Lucene-clause leaves into the `q` string, exact-match/range
  leaves into `filters`/`rangeFilters` — never the dead `api.patentsview.org`
  endpoint, and remap PatentsView field names to ODP equivalents.

### 2. Prosecution vocabularies & document tiers — adversarially reconciled
Raw: [`research/prosecution-vocabulary-and-document-tiers.md`](research/prosecution-vocabulary-and-document-tiers.md)

- **Both MCP status-code maps are corrupted; do not port either.** Checked against
  USPTO Appendix A (`status_codes`, **225 codes**, Table A-7) and Appendix B
  (transaction `event_codes`, **1,873 codes**, Category taxonomy), the
  `patents-mcp-server#8` map (`30→Patented Case`, `70→Notice of Allowance`,
  `160→RCE Filed`) is wrong on 4 of 5 entries: `150` (not `30`) = Patented Case;
  `30` = "Docketed New Case"; Notice of Allowance is `90`/`92`; "RCE Filed" is a
  category error (RCE is event `RCEX`, which drives status to `30`). Source of
  truth = the ODP `/status-codes` endpoint / PatEx `status_codes` file, keyed by the
  integer `applicationStatusCode`. Appendix A
  <https://www.uspto.gov/sites/default/files/documents/Appendix%20A.pdf>,
  Appendix B <https://www.uspto.gov/sites/default/files/documents/Appendix%20B.pdf>.
- **`/transactions` field is `eventDataBag`, not `statusCodeBag`** (the `mcp-uspto#4`
  field names are wrong). Authoritative shape:
  `eventDataBag: [{ eventCode, eventDate, eventDescriptionText }]`, with a USPTO-native
  `Category` (EX/AA/PE/AD/ISS/ABN/PCT). `statusCodeBag` is the *separate*
  `/status-codes` search response. Confirmed against the OpenAPI-generated Go types
  <https://raw.githubusercontent.com/patent-dev/uspto-odp/main/generated/types_gen.go>.
- **Document-code tiers: codes real, tiers are product opinion.** All 16
  `uspto_pfw_mcp#7` codes (NOA/CTFR/CTNF/CLM/892/1449/REM/…) verify against the IFW
  Document Codes spreadsheet (**1,053 codes** + `Doc Code Direction` + `Publicly
  Available`) <https://www.uspto.gov/sites/default/files/documents/IFW-Doc-Codes-and-Descriptions.xlsx>.
  **Namespace collision warning:** `RCEX/EXIN/CTAV/CTNF/CTFR` exist as BOTH
  documentCodes and event codes — anchor the tier vocab to `documentCode`. The 4-tier
  critical/important/standard/administrative rollup is a derived litigation judgment,
  not a USPTO field.
- **PTAB/assignment/foreign-priority/PTA shapes** all live inside
  `patentFileWrapperDataBag[]`; PTAB v3 is served in ODP with trial types
  `IPR|PGR|CBM|DER`, queried via `trialMetaData.trialTypeCode:IPR`
  <https://developer.uspto.gov/api-catalog/ptab-api-v3-data-odp>. Continuity adds
  `claimParentageTypeCode` (continuation/divisional/CIP/provisional); decode quirk —
  `childApplicationStatusCode` is `float32` while `parentApplicationStatusCode` is
  `int`.

### 3. ppubs full-text fallback tier — fragile, downgrade to deferred
Raw: [`research/ppubs-fulltext-fallback-tier.md`](research/ppubs-fulltext-fallback-tier.md)

- ODP search is **bibliographic only ("not full-text claims and specifications")**;
  ppubs is the only no-key, no-login, no-cost full-text search of `USPAT`/`US-PGPUB`/
  `USOCR` <https://data.uspto.gov/patent-file-wrapper>. So a ppubs tier behind ODP is
  non-duplicative *in principle*.
- The **general public-search workflow is multi-sourced**, but the exact base
  URL and session/header requirements are **version-sensitive** — treat this as
  a per-implementation matrix, not a single triple-confirmed handshake:
  - `patent_client`
    <https://github.com/parkerhancock/patent_client/blob/master/patent_client/_async/uspto/public_search/api.py>
    and `riemannzeta/patent_mcp_server`
    <https://github.com/riemannzeta/patent_mcp_server/blob/main/src/patent_mcp_server/uspto/ppubs_uspto_gov.py>
    — **maintained `/api/` base**: `GET /pubwebapp/` seeds cookies →
    `POST /api/users/me/session` (body literal `-1`, header
    `X-Access-Token: "null"`) → read `caseId` + live token from the response
    header.
  - `swinc/fetch-ppubs-patents` (2023) and `layer1labs/specsmith` (pushed
    2026-06-29) — **legacy `/dirsearch-public/` base**, a different path family
    that is still live in fresh code, so the base URL is not settled.
  - Common workflow shape across impls: two-step
    `counts`-then-`searchWithBeFamily`, `qt:"brs"`, `.pn.` field suffix, ~1800 s
    token resetting on use; re-session on **401 OR 403**, `429` honors
    `x-rate-limit-retry-after-seconds`.
  Keep the existing DEFERRED decision unless a live capture proves one path;
  pin `/api/` as primary with `/dirsearch-public/` fallback and live-probe both.
- **ADVERSARIAL DOWNGRADE: likely dead/fragile.** `patent_client` was **archived
  read-only 2026-04-24** citing PPS-endpoint blocking
  <https://github.com/parkerhancock/patent_client/issues/63>; endpoint base is split
  (`/api/` in maintained impls vs `/dirsearch-public/` in `layer1labs/specsmith`
  pushed 2026-06-29). The durable pattern is the **403→source-document fallback**
  (always reach the primary PDF); the ppubs full-text tier itself should be
  **DEFERRED to a clearly-marked best-effort experiment**, not built in the P2 wave.

### 4. EPO OPS + BigQuery + SerpApi — net-new credentialed tiers
Raw: [`research/epo-ops-and-bigquery-credentialed-tiers.md`](research/epo-ops-and-bigquery-credentialed-tiers.md)

- **EPO OPS v3.2** (`packages/drivers/epo`, NEW): OAuth2 client-credentials with HTTP
  Basic to `POST https://ops.epo.org/3.2/auth/accesstoken`; token expires **~20 min,
  surfaced as HTTP 400 (not 401)** — refresh on 400 and clear the cache
  <https://github.com/ip-tools/python-epo-ops-client>. `X-Throttling-Control` header
  = a global status word + per-service `color:limit` pairs over services
  `images/inpadoc/other/retrieval/search`; **`black` = limit 0 → honor `Retry-After`**,
  otherwise space requests `60/limit` s (verbatim regex + `delay_for` logic at
  <https://raw.githubusercontent.com/ip-tools/python-epo-ops-client/main/epo_ops/middlewares/throttle/storages/sqlite.py>).
  Free registered fair-use ≈ **4 GB/week**; responses are namespace-heavy XML where
  `family-member/classification-cpc/applicant/inventor/priority-claim/legal` must be
  **force-arrayed**. Port *logic* from the **Apache-2.0** python client, not the
  license-UNVERIFIED TS source named in CAPTURE. **Reuse the existing XML stack —
  do not add a new parser:** root `package.json` already catalogs `fast-xml-parser`
  (`:164`) and `@beep/schema/Xml` exports `XmlTextToUnknown` (`Xml.ts:85`) and
  `decodeXmlTextAs` (`Xml.ts:121`) over `XMLParser`/`SyntaxValidator`
  (`packages/foundation/modeling/schema/src/Xml.ts`). Extend `@beep/schema/Xml`
  with an EPO-specific `isArray`/force-array parser hook for those node names and
  decode EPO XML **through schema** rather than introducing a parallel XML layer.
- **Google Patents BigQuery** (`packages/drivers/google-patents-bigquery`, NEW):
  canonical table `patents-public-data.patents.publications`; claims/descriptions are
  **nested REPEATED RECORD** columns (`claims_localized`, etc., subfields
  `{text, language, truncated}`), extracted via `UNNEST(...) WHERE language='en'`
  (verbatim notebook SQL
  <https://raw.githubusercontent.com/google/patents-public-data/master/examples/claim-text/claim_text_extraction.ipynb>).
  **Full text is US-only**; rest is bibliographic. Pricing **$6.25/TiB scanned, first
  1 TiB/month free, 10 MB min** <https://cloud.google.com/bigquery/pricing>; the
  **mandatory dry-run cost gate is real and free** (`dryRun:true` returns
  `totalBytesProcessed` without executing) — belt-and-suspenders with
  `maximumBytesBilled` <https://docs.cloud.google.com/bigquery/docs/best-practices-costs>.
  Auth via ADC (best practice) or SA-key JSON; data **CC BY 4.0** (attribution
  required) <https://www.kaggle.com/datasets/bigquery/patents>.
- **Google Patents via SerpApi** (`packages/drivers/google-patents`, lower priority):
  a **paid scraping API** (`engine=google_patents` + `api_key`), carrying
  Google-Patents-ToS/scraping risk that the sanctioned BigQuery dataset does not;
  port the date-prefix filter taxonomy *shape* only
  <https://serpapi.com/google-patents-api>.

### 5. Architecture / codegen / MCP-gating / docket-prompt
Raw: [`research/extend-in-place-architecture-and-codegen.md`](research/extend-in-place-architecture-and-codegen.md)

- **Codegen does NOT generalize to uspto.** runpod earns codegen (clean broad
  OpenAPI 3, near-full coverage); `@beep/uspto` wants a narrow, security-hardened
  ~11-field projection of a multi-envelope API with bespoke SSRF/credential logic
  codegen cannot express. **Recommendation: extend in place; do NOT add
  `generate.ts`/`openapi.json` or Orval/axios/Zod.**
- **Proposed module decomposition** (keep the 5 files, add cohesive modules reusing
  `UsptoError`/`$UsptoId`/`@beep/schema`): `Uspto.search.ts` (escaping, field map,
  structured body, identifier disambiguation, parameter-object validation),
  `Uspto.prosecution.ts` (`/transactions` + assignment/adjustment/attorney/
  foreign-priority/associated-documents), `Uspto.ptab.ts` (19 PTAB endpoints),
  `Uspto.vocab.ts` (status-code + document-code dictionaries — public-domain US-gov
  facts), extend `Uspto.errors.ts` (`UsptoEndpointSunset`, richer `errorCode`),
  add a `searchStructured` POST path; `Uspto.ppubs.*` DEFERRED.
- **Credential-gated MCP registration depends on the active
  `explorations/mcp-auth-gated-registration` packet** — this is NOT net-new
  design space. That packet already shapes the full Effect/MCP design: Shapes
  A/B (build-time conditional mounting that makes a tool *disappear* when its
  `Config.option` credential is absent) vs Shape C (always-register + handler-time
  `api_key_required` structured-content guard), plus a per-module
  `ModuleMeta { auth }` carrier. Reuse its shapes; do not re-derive them here.
  Pattern: read each driver credential via `Config.option`, conditionally
  include its `McpServer.toolkit(...)` layer (present→real, absent→`Layer.empty`),
  so EPO/BigQuery tools stay off the advertised list when unconfigured.
- **v4 layer-API gotcha (deprecation):** the raw research proposes folding with
  `Layer.unwrapEffect`
  ([research/extend-in-place-architecture-and-codegen.md:73](research/extend-in-place-architecture-and-codegen.md)),
  but **`Layer.unwrapEffect` is not an Effect v4 API** — `node_modules/effect/src/Layer.ts`
  exports `unwrap` (`:1498`), and `rg unwrapEffect` over `effect/src/Layer.ts`
  returns nothing against the pinned `effect@4.0.0-beta.91`. The
  `mcp-auth-gated-registration` packet also records that `Layer.orElse` was
  removed in v4 (use `Layer.catch`/`Layer.catchTag("ConfigError",…)`), and that a
  dynamically-built `Array<Layer>` cannot satisfy `Layer.mergeAll`'s non-empty
  tuple — fold with `layers.reduce((acc, l) => Layer.merge(acc, l), Layer.empty)`.
  Use `Layer.unwrap`/`Layer.catch` + the `Layer.empty` fold, and **add a dtslint
  spike before committing to dynamic layer folding.**
- **CourtListener docket-prompt is an AGPL LICENSE BLOCKER** (see Constraints).

---

## In-Repo Capability Inventory

All paths verified via `rg`/`ls` on 2026-06-29.

### `@beep/uspto` — the extend-in-place baseline (exists, 5 files)
`packages/drivers/uspto/src/{index,Uspto.config,Uspto.errors,Uspto.models,Uspto.service}.ts`.
Deps are only `@beep/identity`, `@beep/schema`, `@beep/utils`, `effect` — **no
`scripts/generate.ts`, no `openapi.json`, no `_generated/`** (verified
`package.json` + dir listing), confirming the hand-rolled premise.
- **Service ops already spoken** (`Uspto.service.ts`): `getApplication`,
  `getContinuity`, `getDocuments`, `downloadDocument`, `searchApplications`
  (search is a **GET** `…/applications/search?q=` — the structured POST body is the
  gap). Verified at service lines 47–73, 281–340.
- **Same-origin credential scoping is bespoke and reusable**: `isSameUsptoHost`
  (`Uspto.service.ts:218`) scopes the `X-API-KEY` header so it is never forwarded
  cross-origin (lines 247–253) and gates document downloads (line 291). API key read
  via `Config.redacted("USPTO_API_KEY").pipe(Config.option)` (line 398) — the exact
  credential-presence primitive the conditional-MCP gate and the new drivers reuse.
- **SSRF guard is shared, not bespoke**: `assertAllowedRemoteUrl` is imported from
  `@beep/schema` (`Uspto.service.ts:9`, used at `:285`); the definition lives at
  `packages/foundation/modeling/schema/src/SafeRemoteHost.ts` — directly reusable by
  the new EPO/BigQuery drivers.
- **Models** (`Uspto.models.ts`): `normalizeUsptoApplicationNumber` (line 109) and
  `normalizeUsptoPatentNumber` (line 133) return `O.Option<string>` — reuse for the
  well-formed branch of identifier disambiguation. `UsptoApplicationMetadata`
  (line 154) is a thin `S.Class` projection exposing `earliestPublicationNumber`
  (line 160) but **drops the numeric `applicationStatusCode`** — capture it to drive
  the lifecycle dictionary.
- **Config** (`Uspto.config.ts`): `USPTO_API_URL = "https://api.uspto.gov"` (line 26),
  `UsptoConfigInput` uses `S.optionalKey(S.String.pipe(S.RedactedFromValue))` for the
  key (line 45) — the canonical Redacted-secret pattern to mirror for
  `EpoConfigInput`/`GooglePatentsBigQueryConfigInput`.
- **Errors** (`Uspto.errors.ts`): `UsptoErrorReason` is a `LiteralKit`
  (`config/not-found/rate-limited/response-decoding/response-status/transport`,
  line 29); `UsptoError` is a `TaggedErrorClass` (line 72) — extend with
  `UsptoEndpointSunset` + richer `errorCode` variants.

### Codegen precedent — `@beep/runpod` (exists, reference-only)
`packages/drivers/runpod/{openapi.json,scripts/generate.ts,src/_generated/Runpod.generated.ts}`
verified present; `package.json` has `"generate": "bun run scripts/generate.ts …"`
(line 32) and the generated module is **export-blocked** (`"./_generated/*": null`,
lines 41/60). This is the repo's own Effect-native codegen path — cited as the
precedent the depth build deliberately does NOT follow for uspto.

### MCP composition — `@beep/nlp-mcp` (exists, reference for the gating pattern)
`packages/drivers/nlp-mcp/src/Server.ts` uses `effect/unstable/ai/McpServer` (line 26)
with a **static** `Layer.mergeAll(McpServer.toolkit(NlpToolkit)…, McpServer.toolkit(
StreamingToolkit)…)` over `McpServer.layerStdio` (lines 104–107). Registration is a
build-time layer concern — the substrate to add conditional inclusion onto.
**Conditional/credential-gated registration: not yet implemented in driver
source** (verified `rg "Layer.empty|unwrapEffect"` across `nlp-mcp/src` +
`m365-mcp/src` returned nothing) — **but the design is NOT net-new**: the active
`explorations/mcp-auth-gated-registration` packet already shapes it (Shapes A/B/C,
`api_key_required` helper, the v4 `Layer.unwrap`/`Layer.catch` fold, and the
`McpServer.registerToolkit` `isError` wire-encoding gotcha). This depth build
**depends on / imports that packet's shapes**, it does not re-invent them. Note
`Layer.unwrapEffect` is not a v4 API (use `Layer.unwrap`; see External Landscape
§5).

### Span extraction — `@beep/langextract` (exists, Apache-2.0)
`packages/foundation/capability/langextract/src/{Target,Service}/index.ts`. `buildPrompt`
(`Service/index.ts:87`), `ExtractionTarget` (`Target/index.ts:54`), and
`ExtractionTargetKind` (`LiteralKit`, line 27) already render few-shot examples —
the clean primitives to host a fresh, license-clean USPTO docket-normalization
few-shot prompt. License is `Apache-2.0` (`package.json:5`), which is why AGPL prose
**cannot** be ported in (see Constraints).

### Law-practice domain — `@beep/law-practice-domain` (exists, the vocab consumer)
`packages/law-practice/domain/src/entities/` contains `Claim, Distinction, LegalClient,
LegalContact, Matter, OfficeAction, PatentAsset, PriorArtReference, Rejection`.
- `PatentAssetStatus = LiteralKit(["pre_filing"])` (`PatentAsset/PatentAsset.values.ts:26`)
  — a **single literal**; the prosecution-phase rollup derived from numeric status
  codes lands here (proposed `ProsecutionPhase`, NOT `ClaimLifecycle`).
- `Rejection` already encodes statutes via `RejectionStatute = LiteralKit(["102","103",
  "101","112"])` → `RejectionGround.toTaggedUnion` (`Rejection/Rejection.values.ts:14,39`)
  — the target for OA→rejection code mapping.
- The driver→domain translation home exists: `OfficeActionReview`
  (`packages/law-practice/use-cases/src/OfficeActionReview/`).

### Naming-collision guard — `ClaimLifecycle` is NOT prosecution vocab
`packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:38` defines
`ClaimLifecycle = LiteralKit(["candidate","shape_valid","consistency_checked",
"admitted"])` — a shared-kernel **admission-state** vocabulary explicitly
"deliberately shared across knowledge verticals" (`ClaimLifecycle.model.ts:4-8`).
It is **already reused beyond epistemic**: `law-practice/domain` types
`Distinction.lifecycleState` from it
(`packages/law-practice/domain/src/entities/Distinction/Distinction.model.ts:12,44`),
so it is the admission-state axis for law-practice work product too. The
prosecution **phase** axis is a *different* axis — author a separate
`ProsecutionPhase`/`PatentAssetStatus` value rather than overloading
`ClaimLifecycle`. **Do not overload it.**

### Net-new sibling drivers — confirmed absent
- `packages/drivers/epo` — **NOT FOUND** (verified `ls`). Fully net-new (EPO OPS OAuth2).
- `packages/drivers/google-patents-bigquery` — **NOT FOUND** (verified `ls`). Net-new.
- `packages/drivers/google-patents` — **NOT FOUND** (verified `ls`). Net-new (SerpApi),
  lower priority.
- No `@google-cloud/bigquery` or `ops.epo.org` dependency anywhere in `packages/*/
  package.json` (verified `rg`) — **NOT FOUND**, i.e. all credentialed-tier deps are
  net additions.

### Adjacent attach homes (exist, secondary targets)
`goals/ip-law-knowledge-graph` (stub: `PLAN.md/SPEC.md/research/`), `@beep/file-processing`
+ drivers `tika`/`libpff` (OCR for scanned office actions), bare-skeleton gov-legal
drivers (`courtlistener`, `ecfr`, `dol`, `federal-register` = 1 file each; `govinfo`
= 27 files). Per the tree snapshot.

---

## Constraints

### Deprecations & dead endpoints (date-pinned)
- **NEVER PatentsView.** Legacy `api.patentsview.org` support announced to end Feb-2025;
  actual discontinuation slipped to **2025-05-01 → HTTP 410 Gone**
  <https://patentsview.org/data-in-action/support-legacy-api-end-february-2025-switch-patentsearch-api-now>.
  PatentsView itself **migrates onto ODP `data.uspto.gov` on 2026-03-20**, with
  PatentSearch interruptions and **no committed relaunch date**; prior PatentSearch
  keys are **NOT ODP-compatible**
  <https://data.uspto.gov/support/transition-guide/patentsview>. Port the DSL *shape*,
  execute against ODP only.
- **PEDS retired 2025-03-14** (redirects to ODP Patent File Wrapper).
- **OCE Patent Examination Status Codes API decommissioned 2026-01-30**
  <https://developer.uspto.gov/api-catalog/oce-patent-examination-status-codes> — the
  legacy OCE status dataset is a dead-end; use the live ODP `/status-codes` endpoint
  for the lifecycle dictionary.
- **Legacy Developer Hub decommissioned 2026-06-05; ODP key reissue 2026-03-20** —
  pin to `data.uspto.gov`/`api.uspto.gov` + `X-API-KEY` only (per CAPTURE).
- **ODP account-binding tightening:** signed-in USPTO.gov account required from
  **2026-06-18**; four additional profile fields required from **2026-08-18**
  <https://data.uspto.gov/support>. Plan live integration-test gating around
  account-bound key issuance.
- **`google/patents-public-data` examples repo archived 2026-04-18** (read-only) — the
  **BigQuery dataset is unaffected and live**; port the archived SQL, target the live
  dataset, do not read the archive as a sunset.
- **`parkerhancock/patent_client` archived read-only 2026-04-24** citing PPS-endpoint
  blocking — the best ppubs reference impl is now frozen.

### Licensing gravity (reimplement-not-copy)
- **AGPL-3.0 BLOCKER (the #1 finding): CourtListener.** `LICENSE.txt` is verbatim GNU
  AGPL v3 (GitHub reports `NOASSERTION` only because a custom copyright line precedes
  the AGPL body). `cl/search/llm_prompts.py` (guidelines + **54** docket examples +
  tie-breaker) **cannot** be relicensed into the Apache-2.0 `@beep/langextract`, and
  AGPL §13 network copyleft would attempt to infect the runtime. **Do NOT verbatim-port.**
  Worse, the corpus is **court** dockets, not USPTO serial numbers — wrong domain.
  → Clean-room reimplement the *pattern* (few-shot + tie-breaker + JSON-keyed output)
  on existing langextract primitives with a **fresh USPTO-specific** example corpus.
- **EPO OPS:** port throttle/auth *logic* from **Apache-2.0**
  `ip-tools/python-epo-ops-client`; the CAPTURE-named TS source
  (`patents-mcp-server/src/clients/epo-ops.client.ts`) repo license is **UNVERIFIED** —
  prefer the Apache-2.0 source to avoid ambiguity.
- **BigQuery `patents-public-data`: CC BY 4.0** — attribution required if results are
  surfaced (IFI CLAIMS + Google).
- **SerpApi:** commercial/paid scraping API + Google-Patents-ToS/scraping risk — opt-in,
  lower priority than the sanctioned BigQuery dataset.
- **ppubs reference impls** are permissive (`patent_client` Apache-2.0,
  `patent_mcp_server`/`swinc` MIT) and the handshake is factual API behavior; a fresh
  Effect re-implementation citing patent_client is clean.
- **Other pattern-source MCP repos** (`uspto_pfw_mcp`, `mcp-uspto`, `uspto-patents-mcp`,
  `us-gov-open-data-mcp`, `google-patents-mcp`): licenses **UNVERIFIED** — the nuggets
  are pattern/clean-room adoption (escaping policy, field maps, DSL shape, public-domain
  USPTO dictionaries), so risk is low, but check each LICENSE before any verbatim copy.
- **USPTO status/event/document dictionaries are US-government public-domain facts** —
  license-safe to encode directly in `Uspto.vocab.ts`.

### Locked decisions / routing cautions
- **Extend-in-place, not restart.** Keep the 5 hand-rolled files; do NOT add
  `generate.ts`/`openapi.json` or introduce Orval/axios/Zod. The runpod codegen path is
  precedent-NOT-applicable here.
- **Do not port the hand-curated status-code maps** (both MCP maps are corrupted —
  4-of-5 wrong). "Sync" is not an implementation verb without an owner, cadence,
  and proof gate — pick one of two concrete mechanisms for the canonical 225-code
  table: **(a)** a **versioned generated artifact** `Uspto.vocab.generated.ts`
  built from PatEx/ODP `/status-codes` with embedded **source date + checksum +
  a refresh command**, export-blocked like the runpod `_generated` precedent; or
  **(b)** a **runtime `/status-codes` cache** with typed **stale/offline**
  behavior. Note that (b) couples vocab decode to secret availability (the
  endpoint is key-authenticated), so (a) is preferred for a stable, offline-safe
  repo artifact. Do not leave it as a bare "sync."
- **Vocabulary-ownership boundary:** `@beep/uspto` owns USPTO-native vocab as decoded
  data (codes-as-strings + native categories, faithful decode, zero interpretation);
  `@beep/law-practice-domain` owns the opinionated overlays (litigation-importance tiers,
  prosecution-PHASE rollup, OA→rejection semantics). The moment a mapping encodes
  legal/strategic judgment it crosses into the domain via `OfficeActionReview`.
- **Do not overload `ClaimLifecycle`** (shared-kernel evidence-admission gate) with
  prosecution status — author a separate `ProsecutionPhase` value in law-practice/domain.
- **ppubs DEFERRED** to a clearly-marked best-effort experiment (likely dead/fragile);
  the durable pattern is the 403→source-document fallback. Live-probe `/api/` vs
  `/dirsearch-public/` at implementation time if revived.
- **Two distinct 403 behaviors — do not conflate:** ppubs internal session-expiry
  401/403 (auto re-handshake) vs ODP structured-endpoint 403 (reroute to the
  authoritative document PDF).

### Auth / secret / offline boundaries
- **Separate "official/public-source" from "privilege-safe" — they are not the
  same axis.** ODP and ppubs are *official/public USPTO* sources, but they still
  **transmit free-text query text to external USPTO systems**; for pre-filing
  invention disclosures the confidentiality risk is **not** eliminated merely
  because the endpoint is official or no-key. Only offline/local search and
  public-identifier-only lookups (a known application/patent number, not
  free-text disclosure language) are truly privilege-safe by default.
- **Encode this as a source policy in the driver/MCP auth matrix.** For
  pre-filing/privileged matters, **default to offline/local or
  public-identifier-only**, and require **explicit matter-level consent for any
  external free-text search** — ODP and ppubs included, alongside the three
  credentialed tiers (EPO OAuth2, BigQuery GCP, SerpApi). The credentialed tiers
  transmit search terms — which may encode unfiled invention disclosures / client
  work product — to third-party clouds, so they remain **OPT-IN per matter with
  explicit consent**; the key correction is that free-text ODP/ppubs queries
  carry a confidentiality cost too and must not be treated as a consent-free
  default.
- **The opt-in gate is structural, not a runtime flag:** absence of a Redacted secret →
  the driver `Layer` fails fast / is simply not constructed, and its MCP toolkit layer
  resolves to `Layer.empty`. Mirror the `UsptoConfigInput` Redacted pattern for each new
  config.
- **1Password governance:** store EPO `consumerKey`/`consumerSecret`, the GCP
  service-account JSON (single multiline secret), and the SerpApi `api_key` as `op://`
  secret references via the `onepassword-secret-refs` skill; never commit. Prefer GCP
  workload identity / ADC over a long-lived JSON key in prod
  <https://cloud.google.com/bigquery/docs/authentication>.
- **BigQuery cost gate is mandatory:** dry-run first (free, no execution) → reject above
  a configured ceiling → also set `maximumBytesBilled` as a hard server-side cap.

### Unresolved (verify at align/shape)
- Which two net-new sibling drivers — most defensible pair is `epo` +
  `google-patents-bigquery`; if GCP/billing is deferred, `epo` + `google-patents`
  (SerpApi).
- The exact ODP escaping reserved-character set, bare-alias acceptance, publication-number
  query field, hard pagination ceiling, and full queryable `applicationMetaData` field
  list — the ODP-API-Query-Spec PDF and `data.uspto.gov` doc pages are JS-rendered SPAs
  behind an AWS WAF challenge and did not render to fetchers; confirm against
  `data.uspto.gov/swagger/index.html` in a real browser before finalizing the search
  surface. Default to the broader OpenSearch reserved set and fully-qualified dotted paths.
- Whether the patent-applications `/search` endpoint accepts the POST structured body
  (confirmed for PTAB `/proceedings/search`) — confirm before wiring `searchStructured`;
  keep it behind a spike until proven (see External Landscape §1).

---

_Codex gate-1 folded 2026-06-29: 3 blocking + 5 advisory addressed._

## 2026-07-14 — `PTMNFEE2` maintenance-fee dataset hole closure

- Raw note: [`research/ptmnfee2-maintenance-fee-dataset.md`](research/ptmnfee2-maintenance-fee-dataset.md).
- `PTMNFEE2` is the official USPTO Patent Maintenance Fee Events product, covering grants from 1981-09-01 forward.
- USPTO publishes it weekly; every new event file is cumulative, so refresh means validated full-snapshot replacement, never append.
- The catalog identifies ASCII/text plus `MaintFeeEventsFileDocumentation.doc`; USPTO's launch notice also names `MaintFeeEventsDesc`.
- The current exact delimiter/width/null/date/header contract remains NEEDS-VERIFICATION against the downloaded 2026 documentation.
- Current compressed/uncompressed size is NOT FOUND in accessible primary metadata; record observed sizes in the refresh manifest.
- `MaintFeeEventsDesc`, shipped with the product, is the authoritative dataset-specific event vocabulary.
- No semantic version for that vocabulary was found; version it by release date plus event/doc/code-list checksums and diff each refresh.
- The 3.5/7.5/11.5-year payments, six-month surcharge periods, 4/8/12-year lapse, and possible reinstatement form an event sequence, not a final-status scalar.
- Reissue due dates continue from the original grant; post-2018 multiple-reissue families can require multiple payments and must not be naïvely collapsed.
- ODP site access requires a USPTO.gov account since 2026-06-18; bulk APIs require an API key; direct resolved-file anonymity remains NEEDS-VERIFICATION.
- The dataset is marked Public Domain Mark 1.0; minimal attributed structured-row fixtures are supportable with release/checksum/extraction provenance.
- `@beep/uspto` should own authenticated bulk discovery, deterministic parse, raw vocabulary, checksums, fixtures, and network-free generated artifacts.
- `law-docketing-patent-spine` should own calendar/legal interpretation, patent-family/reissue rules, alerts, provenance, and human review.
- Remaining gates: retrieve the current `.doc`/description file, enumerate all codes, measure the release, and live-probe direct-download authentication.

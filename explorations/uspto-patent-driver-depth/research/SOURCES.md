# USPTO Patent Driver Depth — Sources & Provenance

Traceability ledger for the **USPTO/patent driver depth (ODP, query DSL, File
Wrapper, EPO, BigQuery)** gold-intake cluster: it joins every mined nugget to its
upstream repo + `file:line`, the upstream license + port discipline, the external
research citation on disk, and the in-repo `@beep/*` capability it composes. An
implementing agent should be able to trace any decision in this packet back to one
of these rows.

- **Cluster:** USPTO/patent driver depth (ODP, query DSL, File Wrapper, EPO, BigQuery) · 26 nuggets · histogram P1 6 / P2 15 / P3 5
- **Route:** `mixed` → primaryTarget `packages/drivers/uspto` (exists ✓, extend-in-place)
- **Gold-intake provenance:** [`explorations/_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) (§ "USPTO/patent driver depth", line ~133) · [`explorations/_gold-intake/routing.json`](../../_gold-intake/routing.json) · [`explorations/_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) (§ "Legal / court / patent data ingestion")
- **Packet codex review:** [`reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md) (research-gate critique, 3 blocking + 5 advisory folded)
- **Packet research detail:** [`../RESEARCH.md`](../RESEARCH.md) + the five raw notes under [`./`](.)

---

## 1. Mined source corpus (gold nuggets)

All 26 cluster nuggets, with the disposition the implementing agent should apply
(port = lift logic with attribution where license allows; clean-room = pattern
only; reference = read for shape, do not copy; adopt = encode the controlled
vocabulary directly).

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| mcp-uspto#5 | PatentsView query DSL builder (CPC/date/assignee) | mcp-uspto | `src/tools/patentsview-search.ts:74-107` | data-ingestion | P1 | port DSL *shape*, retarget to ODP |
| patents-mcp#1 | ppubs session + search auth handshake | patents-mcp | `src/patent_mcp_server/uspto/ppubs_uspto_gov.py:68-118` | data-ingestion | P1 | port (DEFERRED tier) |
| patents-mcp#2 | ppubs `searchWithBeFamily` JSON wire format | patents-mcp | `src/patent_mcp_server/json/search_query.json:1-34` | data-ingestion | P1 | port as request schema (DEFERRED) |
| uspto-patents-mcp#1 | PatentsView query-DSL builder (text/assignee/inventor/date) | uspto-patents-mcp | `src/patentsview.ts:151-161` | data-ingestion | P1 | port DSL *shape*, retarget to ODP |
| uspto_pfw_mcp#2 | Lucene query-term escaping (safe/unsafe char policy + length cap) | uspto_pfw_mcp | `src/patent_filewrapper_mcp/api/helpers.py:45-78` | data-ingestion | P1 | port (the rationale comments are gold) |
| uspto_pfw_mcp#3 | Friendly→API nested field-name mapping | uspto_pfw_mcp | `src/patent_filewrapper_mcp/api/helpers.py:621-676` | data-ingestion | P1 | port |
| courtlistener#4 | Few-shot LLM docket-number normalization prompt | courtlistener | `cl/search/llm_prompts.py:77-92` | legal-nlp | P2 | **clean-room** (AGPL blocker, wrong domain) |
| mcp-uspto#3 | Patent continuity (family-tree) data model | mcp-uspto | `src/tools/patent-continuity.ts:14-23` | ip-domain-models | P2 | port |
| mcp-uspto#4 | Prosecution-timeline transaction model | mcp-uspto | `src/tools/patent-status.ts:13-53` | ip-domain-models | P2 | port (fix field name → `eventDataBag`) |
| mcp-uspto#6 | File-wrapper document listing model | mcp-uspto | `src/tools/patent-documents.ts:57-63` | ip-domain-models | P2 | port |
| patents-mcp#3 | Google Patents BigQuery parameterized queries | patents-mcp | `src/patent_mcp_server/google/bigquery_client.py:260-320` | data-ingestion | P2 | port → NEW BigQuery driver (credentialed) |
| patents-mcp#6 | ODP endpoint map for application metadata | patents-mcp | `src/patent_mcp_server/patents.py:412-464` | ip-domain-models | P2 | port (ODP endpoint expansion) |
| patents-mcp-server#10 | BigQuery dry-run cost gating + UNNEST struct handling | patents-mcp-server | `src/clients/bigquery.client.ts:33-72` | data-ingestion | P2 | port → NEW BigQuery driver |
| patents-mcp-server#2 | EPO OPS OAuth2 client (token cache, throttle, XML force-array) | patents-mcp-server | `src/clients/epo-ops.client.ts:40-127` | data-ingestion | P2 | port *logic* → NEW EPO driver (prefer Apache-2.0 py source) |
| patents-mcp-server#6 | Patent-number normalization (prefix + kind-code strip) | patents-mcp-server | `src/lib/patent-number.ts:1-21` | ip-domain-models | P2 | port (multi-country) |
| patents-mcp-server#8 | USPTO status-code dictionaries (prosecution lifecycle) | patents-mcp-server | `src/tools/utility.tools.ts:15-46` | ip-domain-models | P2 | **adopt vocab axis, do NOT port the map** (4/5 wrong) |
| us-gov-open-data-mcp#7 | ODP SDK: PTAB / continuity / transactions / assignments / query DSL | us-gov-open-data-mcp | `src/apis/uspto/sdk.ts:42-67` | ip-domain-models | P2 | port (type codes, PTAB, structured POST) |
| uspto-patents-mcp#3 | PatentsView v1 sunset detection (migration error) | uspto-patents-mcp | `src/patentsview.ts:177-183` | data-ingestion | P2 | reference → `UsptoEndpointSunset` error |
| uspto_pfw_mcp#1 | Smart identifier disambiguation (app/patent/pub + confidence) | uspto_pfw_mcp | `src/patent_filewrapper_mcp/util/identifier_normalization.py:36-165` | ip-domain-models | P2 | port (the 8-digit ambiguity heuristic is the gold) |
| uspto_pfw_mcp#14 | Parameter-object pattern with invariant validation | uspto_pfw_mcp | `src/patent_filewrapper_mcp/models/search_params.py:11-57` | effect-ts | P2 | adopt → `effect/Schema` request models |
| uspto_pfw_mcp#7 | Document-code litigation-importance tiers | uspto_pfw_mcp | `src/patent_filewrapper_mcp/util/package_manager.py:57-60` | ip-domain-models | P2 | adopt (codes real, tiers = domain opinion) |
| google-patents-mcp#1 | Google Patents (SerpApi) search input schema / filter taxonomy | google-patents-mcp | `src/index.ts:291-298` | ip-domain-models | P3 | reference (filter *shape* only; SerpApi opt-in) |
| patents-mcp#7 | Standardized ApiError response factory | patents-mcp | `src/patent_mcp_server/util/errors.py:14-68` | data-ingestion | P3 | reference (enumerate real USPTO error fields) |
| patents-mcp-server#13 | EPO CQL + BigQuery + ODP query-syntax cheat-sheet | patents-mcp-server | `src/resources/index.ts:60-90` | legal-nlp | P3 | reference → `@beep/agents` query-construction skill |
| patents-mcp-server#4 | 403-aware fallback rerouting agent to source PDF | patents-mcp-server | `src/tools/office-actions.tools.ts:20-27` | provenance-evidence | P3 | reference (the durable provenance pattern) |
| uspto-patents-mcp#8 | USPTO MCP tool schemas + `PatentSummary` model | uspto-patents-mcp | `src/tools.ts:6-32` | ip-domain-models | P3 | reference (field set for PatentAsset/PriorArtReference) |

### How these inform this packet

**Query/search surface (extend-in-place core) — mcp-uspto#5, uspto-patents-mcp#1, uspto_pfw_mcp#2, uspto_pfw_mcp#3, uspto_pfw_mcp#1, uspto_pfw_mcp#14, uspto-patents-mcp#3.**
Take the PatentsView `_and/_or/_text_any/_gte/_lte/_begins` AST *shape* and the
escaping/field-map/identifier-disambiguation logic; **leave** the dead
`api.patentsview.org` endpoint — compile the AST to ODP (`q` string + `filters`/
`rangeFilters`). The load-bearing contract is the two-mode escaper: port
`uspto_pfw_mcp#2`'s narrow field-query policy that *deliberately leaves*
`: " [ ] - *` unescaped (so callers can field-scope) plus the length cap
(`if len(escaped) > 1000: raise ValidationError`), and pair it with a literal-term
escaper for value positions (RESEARCH §1 — modern OpenSearch reserved set strips
`<>`). uspto-patents-mcp#3 becomes the `UsptoEndpointSunset` guard, not a runtime
path. All land in `packages/drivers/uspto/src/Uspto.search.ts`.

**Prosecution + document vocabularies — mcp-uspto#3, mcp-uspto#4, mcp-uspto#6, patents-mcp#6, patents-mcp-server#8, uspto_pfw_mcp#7, us-gov-open-data-mcp#7.**
Take the endpoint map and record shapes (continuity parent/child + type,
`/transactions` timeline, `/documents` listing, PTAB `IPR|PGR|CBM|DER` type codes).
**Leave** the hand-curated status-code map: per RESEARCH §2 + the codex review,
*both* MCP status maps are corrupted (`patents-mcp-server#8` is wrong on 4/5
entries — `150` not `30` = Patented Case; NoA is `90/92`), and `mcp-uspto#4`'s
field name is wrong (`/transactions` returns `eventDataBag`, not `statusCodeBag`).
Adopt only the *vocabulary axis*; source the canonical 225-code table from the ODP
`/status-codes` endpoint as a versioned generated artifact (DECISIONS Q4). The
document-tier rollup (`uspto_pfw_mcp#7`) is a derived litigation judgment — anchor
the codes to `documentCode`, keep the tier opinion in `@beep/law-practice-domain`.

**Identity normalization — patents-mcp-server#6, uspto_pfw_mcp#1.**
Port the multi-country prefix/kind-code stripper and the app-vs-patent-vs-publication
disambiguation heuristic (the 8-digit series-code ambiguity is expensive domain
knowledge). Extends the existing `normalizeUspto*` helpers, which only cover the
well-formed branch.

**Net-new credentialed tiers — patents-mcp#3, patents-mcp-server#10, patents-mcp-server#2, google-patents-mcp#1.**
EPO OPS (`patents-mcp-server#2`) and BigQuery (`patents-mcp#3`, `patents-mcp-server#10`)
are fully net-new drivers. Take the OAuth2 token-cache + `x-throttling-control`
"black" detection, the mandatory `dryRun:true` cost gate, and the `UNNEST`-of-
localized-text technique. **Leave** the bundled fast-xml-parser layer — reuse
`@beep/schema/Xml` with an EPO force-array hook (codex advisory). SerpApi
(`google-patents-mcp#1`) is reference-only, opt-in, lower priority than the
sanctioned BigQuery dataset.

**ppubs full-text fallback — patents-mcp#1, patents-mcp#2 (DEFERRED).**
The session handshake (`POST /api/users/me/session` with `X-Access-Token: "null"`,
403 re-handshake, 429 `x-rate-limit-retry-after-seconds` backoff) and the
`searchWithBeFamily` wire format are real, but RESEARCH §3 + the codex advisory
downgrade this to a best-effort experiment (`patent_client` archived 2026-04-24;
base URL split `/api/` vs `/dirsearch-public/`). The **durable** pattern is the
403→source-document fallback (`patents-mcp-server#4`), not the ppubs tier.

**Error taxonomy + agent grounding — patents-mcp#7, patents-mcp-server#13, patents-mcp-server#4, uspto-patents-mcp#8.**
Reference-only: enumerate USPTO's real error field variants as tagged errors, host
the EPO CQL/BigQuery/ODP cheat-sheet as an `@beep/agents` query-construction skill,
and use `PatentSummary`'s field set to shape `PatentAsset`/`PriorArtReference`.

**Docket normalization — courtlistener#4 (clean-room only).**
The few-shot + tie-breaker + JSON-keyed-output *pattern* is excellent, but the
upstream is **AGPL-3.0** and the corpus is *court* dockets (wrong domain).
Clean-room reimplement on `@beep/langextract` primitives with a fresh USPTO-specific
example corpus — never verbatim-port (see §2 caution).

---

## 2. Upstream repositories & licenses

Port discipline is derived from each upstream's license: **permissive** (MIT /
Apache-2.0) may be ported *with attribution*; **copyleft** (AGPL/GPL/MPL) is
**clean-room reimplement only** — pattern, never vendored code.

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| patents-mcp-server | T1 | MIT | port-with-attribution | EPO OPS OAuth2 client, BigQuery cost gate + UNNEST, patent-number normalizer, status-code axis, PTAB design, 403→PDF fallback, query cheat-sheet |
| uspto_pfw_mcp | T1 | MIT | port-with-attribution | Lucene escaping policy + length cap, friendly→API field map, identifier disambiguation, parameter-object validation, document-code tiers |
| courtlistener | T1 | **AGPL-3.0-only** | **clean-room reimplement only** | docket-normalization *pattern* (few-shot + tie-breaker + JSON output) — fresh USPTO corpus, no verbatim port |
| mcp-uspto | T2 | MIT | port-with-attribution | continuity model, `/transactions` timeline shape, `/documents` listing, PatentsView DSL shape |
| patents-mcp | T2 | MIT | port-with-attribution | ppubs handshake + `searchWithBeFamily` schema (DEFERRED), BigQuery queries, ODP endpoint map, ApiError shape |
| uspto-patents-mcp | T2 | MIT | port-with-attribution | PatentsView DSL builder shape, sunset-detection guard, MCP tool schemas + `PatentSummary` |
| us-gov-open-data-mcp | T2 | MIT | port-with-attribution | ODP SDK type codes, PTAB modeling, structured filter/rangeFilter/sort POST body |
| google-patents-mcp | T2 | MIT | reference (swappable) | SerpApi Google Patents filter taxonomy *shape* only |

> **Cautions (echoed from the bundle — load-bearing):**
> - **NEVER PatentsView.** `api.patentsview.org` was sunset Feb-2025 (410 /
>   301-redirects HTML to `data.uspto.gov/odp`). The DSL nuggets (mcp-uspto#5,
>   uspto-patents-mcp#1) document PatentsView's `_or/_and/_text_any` shape — port
>   the *shape*, retarget to ODP, never the dead endpoint.
> - **ODP key reissue 2026-03-20** (PatentSearch → ODP); legacy Developer Hub
>   decommissioned 2026-06-05. Pin to `data.uspto.gov/odp` + `api.uspto.gov`
>   `X-API-KEY` only.
> - **EPO OPS** (patents-mcp-server#2, #13) requires OAuth2 client-credentials
>   secrets — out of offline scope; gate behind 1Password secret governance, never
>   commit creds. The bundled TS source license is UNVERIFIED — prefer porting
>   *logic* from the Apache-2.0 `ip-tools/python-epo-ops-client` (RESEARCH §4).
> - **BigQuery** (patents-mcp-server#10, patents-mcp#3, patents-mcp-server#13)
>   requires GCP creds + billing; the dry-run cost gate is mandatory; out of the
>   offline/privilege-safe default scope. Dataset is **CC BY 4.0** (attribution
>   required when results surfaced).
> - **ppubs** (patents-mcp#1, #2) is an undocumented reverse-engineered endpoint —
>   fragile, may break without notice; best-effort tier behind ODP, not primary.
> - **Codegen precedent = runpod** (`openapi.json` + `scripts/generate.ts`), but
>   uspto is hand-rolled — **EXTEND in place**; do NOT add `generate.ts` blindly or
>   introduce Orval/axios/Zod.
> - **License-UNVERIFIED pattern sources:** the four MCP repos above marked MIT in
>   the verdict are pattern/clean-room adoptions (escaping policy, field maps, DSL
>   shape, public-domain USPTO dictionaries); RESEARCH §"Licensing gravity" notes
>   several repo LICENSEs were not independently confirmed — check each LICENSE
>   before any *verbatim* copy. USPTO status/event/document dictionaries are
>   US-government public-domain facts and are license-safe to encode directly.

---

## 3. External research sources

Citations that actually appear on disk in this packet (RESEARCH.md + `research/*.md`).
Titles are paraphrased; URLs reproduced verbatim from the notes.

- USPTO ODP API query spec PDF — <https://data.uspto.gov/documents/documents/ODP-API-Query-Spec.pdf>
- Microsoft Power Platform USPTO connector (mirrors ODP OpenAPI) — <https://learn.microsoft.com/en-us/connectors/uspatenttrademarkoff/>
- `patent_client` ODP guide — <https://patent-client.readthedocs.io/en/latest/user_guide/open_data_portal.html>
- Lucene 2.9.4 query-parser syntax (upper-bound grammar reference) — <https://lucene.apache.org/core/2_9_4/queryparsersyntax.html>
- Elasticsearch/OpenSearch `query_string` reserved-char reference — <https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-query-string-query>
- rOpenSci `patentsview` query-writing guide (DSL operators) — <https://docs.ropensci.org/patentsview/articles/writing-queries.html>
- MPEP §503 (application series codes) — <https://www.uspto.gov/web/offices/pac/mpep/s503.html>
- USPTO kind codes authority file — <https://www.uspto.gov/patents/search/authority-files/uspto-kind-codes>
- USPTO Appendix A (status codes, 225) — <https://www.uspto.gov/sites/default/files/documents/Appendix%20A.pdf>
- USPTO Appendix B (event codes, 1,873) — <https://www.uspto.gov/sites/default/files/documents/Appendix%20B.pdf>
- USPTO IFW Document Codes spreadsheet (1,053 codes) — <https://www.uspto.gov/sites/default/files/documents/IFW-Doc-Codes-and-Descriptions.xlsx>
- `patent-dev/uspto-odp` generated Go types (OpenAPI shapes) — <https://raw.githubusercontent.com/patent-dev/uspto-odp/main/generated/types_gen.go>
- PTAB API v3 (ODP) catalog — <https://developer.uspto.gov/api-catalog/ptab-api-v3-data-odp>
- USPTO Patent File Wrapper / full-text scope — <https://data.uspto.gov/patent-file-wrapper>
- `parkerhancock/patent_client` ppubs API (maintained `/api/` base) — <https://github.com/parkerhancock/patent_client/blob/master/patent_client/_async/uspto/public_search/api.py>
- `riemannzeta/patent_mcp_server` ppubs handshake — <https://github.com/riemannzeta/patent_mcp_server/blob/main/src/patent_mcp_server/uspto/ppubs_uspto_gov.py>
- `patent_client` archived read-only (PPS blocking) — <https://github.com/parkerhancock/patent_client/issues/63>
- `ip-tools/python-epo-ops-client` (Apache-2.0 throttle/auth logic) — <https://github.com/ip-tools/python-epo-ops-client>
- `python-epo-ops-client` throttle storage (verbatim regex + delay logic) — <https://raw.githubusercontent.com/ip-tools/python-epo-ops-client/main/epo_ops/middlewares/throttle/storages/sqlite.py>
- Google `patents-public-data` claim-text extraction notebook (UNNEST SQL) — <https://raw.githubusercontent.com/google/patents-public-data/master/examples/claim-text/claim_text_extraction.ipynb>
- BigQuery pricing ($6.25/TiB, 1 TiB/mo free) — <https://cloud.google.com/bigquery/pricing>
- BigQuery cost best-practices (dry-run, `maximumBytesBilled`) — <https://docs.cloud.google.com/bigquery/docs/best-practices-costs>
- BigQuery authentication (ADC vs SA-key) — <https://cloud.google.com/bigquery/docs/authentication>
- Kaggle `bigquery/patents` dataset (CC BY 4.0) — <https://www.kaggle.com/datasets/bigquery/patents>
- SerpApi Google Patents API — <https://serpapi.com/google-patents-api>
- PatentsView legacy-API end notice — <https://patentsview.org/data-in-action/support-legacy-api-end-february-2025-switch-patentsearch-api-now>
- USPTO PatentsView→ODP transition guide — <https://data.uspto.gov/support/transition-guide/patentsview>
- USPTO OCE status-codes API (decommissioned 2026-01-30) — <https://developer.uspto.gov/api-catalog/oce-patent-examination-status-codes>
- USPTO data support / account-binding tightening — <https://data.uspto.gov/support>
- USPTO `PTMNFEE2` bulk-data product page — <https://data.uspto.gov/bulkdata/datasets/ptmnfee2> — accessed 2026-07-14; official landing page; portal required sign-in in this session; license recorded by the federal catalog as Public Domain Mark 1.0.
- Federal catalog record for USPTO Patent Maintenance Fee Events — <https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present> — accessed 2026-07-14; official harvested metadata for cadence, cumulative semantics, ASCII format, data dictionary, public access, and Public Domain Mark 1.0.
- USPTO Official Gazette launch notice for the Maintenance Fees Event File — <https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm> — accessed 2026-07-14; official source for Tuesday delivery and the `MaintFeeEventsDesc`/documentation-file contract; government-authored/public-domain terms apply.
- USPTO ODP bulk-data Search API documentation — <https://data.uspto.gov/apis/bulk-data/search> — accessed 2026-07-14; official API-key requirement and Product Data routing; no numeric rate limit found.
- USPTO ODP registration announcement — <https://www.uspto.gov/about-us/news-updates/uspto-open-data-portal-require-registration-access-beginning-june-18-2026> — accessed 2026-07-14; official account requirement effective 2026-06-18; government-authored/public-domain terms apply.
- USPTO maintenance-fee guidance — <https://www.uspto.gov/patents/maintain> — accessed 2026-07-14; official windows, grace/expiration, reinstatement, eligible-patent, timing, and holiday rules; government-authored/public-domain terms apply.
- USPTO current fee schedule, patent maintenance fees — <https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule#patent-maintenance-fees> — accessed 2026-07-14; official payment/surcharge/petition fee-code families; government-authored/public-domain terms apply.
- MPEP §1415.01, maintenance fees on original/reissue patents — <https://www.uspto.gov/web/offices/pac/mpep/s1415.html> — accessed 2026-07-14; official reissue-family timing and post-2018 separate-payment rules; government-authored/public-domain terms apply.
- MPEP §2520, maintenance fee amounts — <https://www.uspto.gov/web/offices/pac/mpep/s2520.html> — accessed 2026-07-14; official terminal-disclaimer/no-proration rule; government-authored/public-domain terms apply.
- MPEP §2591, intervening rights in reinstated patents — <https://www.uspto.gov/web/offices/pac/mpep/s2591.html> — accessed 2026-07-14; official evidence that reinstatement changes the legal posture after expiration; government-authored/public-domain terms apply.
- USPTO Terms of Use — <https://www.uspto.gov/terms-use-uspto-websites> — accessed 2026-07-14; public-domain/acknowledgement, third-party-material, seal/logo, URL-stability, and anti-abusive-access terms; dataset-specific catalog license is Public Domain Mark 1.0.

In-repo RESEARCH sections that carry the load-bearing synthesis (read alongside the
URLs above): RESEARCH.md §"External Landscape" 1–5, §"In-Repo Capability Inventory",
§"Constraints" (Deprecations / Licensing gravity / Auth-secret-offline boundaries /
Unresolved), and the five raw notes: [`research/odp-query-dsl-and-lucene-surface.md`](odp-query-dsl-and-lucene-surface.md),
[`research/prosecution-vocabulary-and-document-tiers.md`](prosecution-vocabulary-and-document-tiers.md),
[`research/ppubs-fulltext-fallback-tier.md`](ppubs-fulltext-fallback-tier.md),
[`research/epo-ops-and-bigquery-credentialed-tiers.md`](epo-ops-and-bigquery-credentialed-tiers.md),
[`research/extend-in-place-architecture-and-codegen.md`](extend-in-place-architecture-and-codegen.md).

---

## 4. In-repo capability references

The `@beep/*` bricks this packet composes (from the bundle `secondaryTargets` +
`alreadyCovered` and RESEARCH §"In-Repo Capability Inventory"). Reuse =
already-spoken, extend = present-but-shallow, NET-NEW = confirmed absent.

| Capability | Package path | Status | Role |
| --- | --- | --- | --- |
| `@beep/uspto` driver | `packages/drivers/uspto/src/{index,Uspto.config,Uspto.errors,Uspto.models,Uspto.service}.ts` | **extend** | The extend-in-place baseline (5 files, no codegen) — search DSL, prosecution endpoints, vocab, errors land here |
| `Uspto.service` ops | `packages/drivers/uspto/src/Uspto.service.ts` | reuse | `getApplication/getContinuity/getDocuments/downloadDocument/searchApplications` (search is GET; structured POST is the gap) |
| Same-origin key scoping + SSRF guard | `Uspto.service.ts:218,247-253,285` + `packages/foundation/modeling/schema/src/SafeRemoteHost.ts` | reuse | `isSameUsptoHost` + `assertAllowedRemoteUrl` — reused by new EPO/BigQuery drivers |
| `normalizeUspto*` helpers | `packages/drivers/uspto/src/Uspto.models.ts:109,133` | extend | well-formed branch of identifier disambiguation |
| `UsptoError` / `UsptoErrorReason` | `packages/drivers/uspto/src/Uspto.errors.ts:29,72` | extend | add `UsptoEndpointSunset` + richer `errorCode` |
| `@beep/runpod` codegen precedent | `packages/drivers/runpod/{openapi.json,scripts/generate.ts,src/_generated/}` | reference | the codegen path uspto deliberately does NOT follow |
| `@beep/nlp-mcp` server | `packages/drivers/nlp-mcp/src/Server.ts` | reference | static `Layer.mergeAll` MCP substrate to add conditional gating onto |
| `@beep/schema/Xml` | `packages/foundation/modeling/schema/src/Xml.ts:85,121` | extend | `XmlTextToUnknown`/`decodeXmlTextAs` — add EPO force-array hook (no new XML parser) |
| `@beep/langextract` | `packages/foundation/capability/langextract/src/{Target,Service}/index.ts` | extend | Apache-2.0 few-shot host for the clean-room USPTO docket prompt |
| `@beep/law-practice-domain` | `packages/law-practice/domain/src/entities/{PatentAsset,OfficeAction,Rejection,PriorArtReference}/` | extend | consumes status/doc-tier/continuity vocab; owns `ProsecutionPhase` overlay |
| `ClaimLifecycle` (do NOT overload) | `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:38` | reuse (guard) | shared-kernel admission axis — author a separate `ProsecutionPhase`, never overload |
| `OfficeActionReview` use-case | `packages/law-practice/use-cases/src/OfficeActionReview/` | reuse | the driver→domain translation home |
| `packages/drivers/epo` | — | **NET-NEW** | EPO OPS OAuth2 driver (confirmed absent) |
| `packages/drivers/google-patents-bigquery` | — | **NET-NEW** | cost-gated BigQuery driver (confirmed absent) |
| `packages/drivers/google-patents` | — | **NET-NEW** | SerpApi driver, lower priority (confirmed absent) |
| `@beep/agents` query-construction skill | `packages/agents` | extend | hosts the EPO CQL/BigQuery/ODP cheat-sheet (patents-mcp-server#13) |
| `explorations/mcp-auth-gated-registration` | `explorations/mcp-auth-gated-registration` | reuse (dependency) | supplies Shapes A/B/C + v4 `Layer.unwrap`/`Layer.catch` fold for credential gating — do NOT re-derive |

`alreadyCovered` (do not rebuild — refinements only): continuity resolution +
model, File-Wrapper document listing + download, ODP application-metadata
endpoints, number normalization, core search/read surface, typed error model, and
the ODP-targeted client that already avoids the PatentsView sunset — all in
`@beep/uspto`.

---

## 5. Cross-links & provenance

- **Cluster id:** `uspto-patent-driver-depth` (route `mixed`, wave P2, 26 nuggets) — [`ROUTING.md`](../../_gold-intake/ROUTING.md) § "USPTO/patent driver depth (ODP, query DSL, File Wrapper, EPO, BigQuery)".
- **Gold synthesis:** [`GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) § "Gold catalog by theme → Legal / court / patent data ingestion" (USPTO ppubs handshake, PatentsView/USPTO query-DSL builder, Lucene escaping, EPO OPS, BigQuery, USPTO error normalization) + § "TRUE GAPS" rows for USPTO ODP depth.
- **Exploration ⇄ goal links:** secondaryTargets attach to `goals/ip-law-knowledge-graph` (continuity/PTAB/assignment edges as provenance), `goals/law-practice-office-action-spike` + `goals/law-practice-office-action-extraction-rung` (PatentAsset/OfficeAction/Rejection/PriorArtReference fed by status-code/doc-tier/continuity vocab). The packet manifest records no graduated goal yet (`links.goals: []`).
- **Sibling exploration dependency:** `explorations/mcp-auth-gated-registration` (credential-gated MCP registration shapes) — this packet *depends on* it, does not re-invent it (RESEARCH §5 / codex blocking #2). Cross-cutting deprecation note shared with `gov-legal-data-driver-codegen` + the agent-memory cluster (PatentsView/ODP sunset).
- **Packet internals:** [`CAPTURE.md`](../CAPTURE.md), [`RESEARCH.md`](../RESEARCH.md), [`DECISIONS.md`](../DECISIONS.md) (7 pre-drafted branch-closing questions Q1–Q7), [`BRIEF.md`](../BRIEF.md), [`MAP.md`](../MAP.md).
- **Codex review:** [`reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md) — research-gate critique; its 3 blocking findings (searchStructured POST ambiguity, mcp-auth-gated dependency, ODP/ppubs consent boundary) and 5 advisories are already folded into RESEARCH.md (see footer "Codex gate-1 folded 2026-06-29").

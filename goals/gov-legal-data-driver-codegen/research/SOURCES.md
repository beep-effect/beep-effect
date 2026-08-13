# Gov/Legal Data Driver Codegen — Sources & Provenance

Provenance ledger for this goal: it joins the mined gold nuggets (with upstream
repo + `file:line`), the upstream repositories and their licenses, the external
research citations on disk, and the in-repo `@beep/*` bricks this packet
composes. It exists so an implementing agent can trace every decision in
`SPEC.md` / `PLAN.md` back to a source.

- **Cluster:** Gov/legal data drivers + OpenAPI codegen (19 nuggets, 12 upstream repos)
- **Route:** `new-exploration` → graduated goal (primary target `gov-legal-data-driver-codegen`)
- **Source exploration (primary research home):** [`explorations/gov-legal-data-driver-codegen`](../../../explorations/gov-legal-data-driver-codegen) — RESEARCH.md, DECISIONS.md, BRIEF.md, MAP.md, and `research/*.md` (see [`research/README.md`](./README.md) for the full link set)
- **Gold-intake provenance:**
  [`explorations/_gold-intake/ROUTING.md`](../../../explorations/_gold-intake/ROUTING.md) ·
  [`explorations/_gold-intake/routing.json`](../../../explorations/_gold-intake/routing.json) ·
  [`explorations/_gold-intake/GOLD_SYNTHESIS.md`](../../../explorations/_gold-intake/GOLD_SYNTHESIS.md) — "Legal / court / patent data ingestion" section
- **Codex spec-gate review:** [`research/2026-06-29-codex-spec.md`](./2026-06-29-codex-spec.md)

---

## 1. Mined source corpus (gold nuggets)

Every row is a verified nugget routed to this cluster. `Disposition` is the
mining recommendation (`port` = lift the pattern with attribution where license
permits; `adopt` = adopt the shape into beep idiom; `study`/`reference` =
pattern-reference only). Licenses gate ports — see §2.

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| TalentScore#7 | Effect HttpClient API-wrapper: versioned base URL + Redacted auth header + retry | TalentScore | `packages/server/src/public/files/upload-thing-api.ts:70-102` | data-ingestion | P1 | adopt |
| doc-haus#14 | CourtListener case-law client (DUP of beep skeleton — caveat) | doc-haus | `dochaus/tool/case-law.ts:45-58` | data-ingestion | P1 | port |
| mcp-uspto#1 | Per-API token-bucket rate limiter with multi-tier auth fetcher | mcp-uspto | `src/lib/fetcher.ts:15-81` | data-ingestion | P1 | port |
| mike#11 | CourtListener client: bulk-first fallback + citation parse/normalize/verify | mike | `backend/src/lib/courtlistener.ts:457-467` | data-ingestion | P1 | port |
| us-gov-open-data-mcp#2 | Config-object API client factory: auth (query/header/body) + disk TTL cache + retry/backoff + rate limit | us-gov-open-data-mcp | `src/shared/client.ts:22-65` | data-ingestion | P1 | port |
| us-gov-open-data-mcp#3 | Token-bucket rate limiter with FIFO fairness + batch drain | us-gov-open-data-mcp | `src/shared/client.ts:115-182` | data-ingestion | P1 | port |
| us-legal-tools#3 | CourtListener token-auth axios mutator (`Authorization: Token <env>`) | us-legal-tools | `packages/courtlistener-sdk/src/api/client.ts:8-22` | data-ingestion | P1 | port |
| harvest-mcp#8 | Typed error hierarchy with code + structured data payload | harvest-mcp | `src/types/index.ts:854-908` | effect-ts | P2 | adopt |
| patent-search-mcp-server#6 | Status-code humanization + typed API error mapping | patent-search-mcp-server | `src/api/client.ts:78-106` | effect-ts | P2 | adopt |
| patents-mcp-server#14 | OpenAPI→Zod response-validation codegen pipeline (Hey API) committed to repo | patents-mcp-server | `package.json:32-33` | governance-ops | P2 | adopt |
| us-legal-tools#1 | Single OpenAPI spec → dual SDK + MCP server codegen (Orval) | us-legal-tools | `packages/orval-config/src/index.ts:9-47` | mcp-design | P2 | study |
| us-legal-tools#4 | MCP tool registration with structured path/query/body param groups | us-legal-tools | `packages/courtlistener-sdk/src/mcp/server.ts:148-155` | mcp-design | P2 | adopt |
| uspto-patents-mcp#6 | KV memoize cache: TTL jitter + stable cache-key builder | uspto-patents-mcp | `src/cache.ts:15-39` | data-ingestion | P2 | port |
| courtlistener#11 | Citation-aware rate throttle (eyecite parse reused downstream) | courtlistener | `cl/api/utils.py:1078-1136` | data-ingestion | P3 | study |
| harvest-mcp#4 | Auth-analysis domain model: TokenInfo / TokenLifecycle / AuthenticationEndpoint | harvest-mcp | `src/types/index.ts:28-123` | data-ingestion | P3 | study |
| lawyergpt#5 | Configurable CSS-selector legal-corpus scraper (NigerianLII) | lawyergpt | `extractor/main.go:64-93` | data-ingestion | P3 | study |
| us-legal-tools#10 | Turbo codegen-as-build-step (generate → build, uncached generate) | us-legal-tools | `turbo.json:4-33` | governance-ops | P3 | adopt |
| us-legal-tools#12 | Scalar + Hono aggregated OpenAPI docs portal | us-legal-tools | `packages/scalar-ui/src/server.ts:1-7` | desktop-portal | P3 | study |
| us-legal-tools#2 | Per-spec orval.config one-liner (driver registration pattern) | us-legal-tools | `packages/ecfr-sdk/orval.config.ts:1-3` | data-ingestion | P3 | reference |

### How these inform this packet

**Codegen pipeline (the substrate, P0–P1, Q1/Q2/Q7).** `us-legal-tools#1` is the
load-bearing pattern — one OpenAPI input emitting *two* targets (typed SDK + MCP
server). Take the **two-target architecture**, leave the Orval/axios/Zod output:
beep ports it onto Effect `HttpApi` + effect-`Schema`, emitting Schema +
operation descriptors only into `src/_generated/*` (transport stays
hand-authored). `patents-mcp-server#14` supplies the **committed-codegen +
deterministic-CI** discipline (`fetch-specs` → `codegen`, generated output
committed so CI is a `git diff --exit-code` drift check) — adopt the discipline,
not Hey API. `us-legal-tools#10` is the **turbo edge** (`generate` `cache:false`,
`build` depends on `generate`); SPEC scopes this *per-package*, not as a global
`build→codegen` edge (Q7), so take the cache:false generate idea and leave the
repo-wide wiring. `us-legal-tools#2` is the near-zero-boilerplate **driver
registration** convention — reference only, since it duplicates the existing eCFR
skeleton.

**Shared transport transformer (the seam, P0, Q5/Q6).** `us-gov-open-data-mcp#2`
is the closest analog to what beep needs: one declarative `ClientConfig`
(auth type query/header/body + envParams, per-source rate limit, disk TTL cache
surviving restarts, exponential-backoff-with-jitter honoring `Retry-After` on
429/502/503/504). Port the **auth-config shape and Retry-After parsing** into the
Effect transformer that incubates inside govinfo. `TalentScore#7` is the cleanest
**Effect-idiomatic** template (Redacted auth header so secrets never log,
`mapRequest` version-pin, `filterStatusOk`, `retryTransient` with exponential
schedule) — adopt directly as the transformer's spine. `us-gov-open-data-mcp#3`
and `mcp-uspto#1` are two **rate-limiter** references: take the FIFO
token-bucket / per-tier-bucket-map kernel and wrap it as an Effect primitive.
`uspto-patents-mcp#6` carries the **deterministic cache-key + TTL-jitter**
contract (`stableKey` sorts option keys; expiry adds ≤10% jitter to avoid
stampede) for the shared response cache.

**CourtListener auth + citation (P2, GATED on the data-terms matrix, Q8).**
`us-legal-tools#3` is the **canonical, correct** auth contract — literally
`Authorization: Token ${COURTLISTENER_API_TOKEN}` (DRF `TokenAuthentication`,
*not* Bearer), base URL `…/api/rest/v4`. Reuse this exact env+header convention.
`mike#11` and `doc-haus#14` both **duplicate** beep's CourtListener skeleton
target — take the reusable parts only: `mike#11`'s `parseCitationParts` regex +
local-cache-then-API fallback, and `doc-haus#14`'s result-shaping
(caseName/citation/court/citeCount/snippet) + the remote-MCP-vs-hand-rolled-client
comparison. `courtlistener#11` (AGPL, study-only) shows **cost-metering**: parse
citations once, charge per-citation, reuse the parse downstream. Do not ship any
CourtListener cache/fixtures before the per-upstream data-terms matrix exists
(SPEC Stop Conditions).

**Typed errors + auth descriptors (P0–P2, cross-cutting).**
`patent-search-mcp-server#6`'s status→code→message table (401→unauthenticated,
402→payment_required, 429→rate_limited, …) transfers directly into per-driver
`Schema.TaggedError` variants. `harvest-mcp#8`'s code+structured-data error
hierarchy is the **class-based predecessor** of beep's `Data.TaggedError` — mine
it as a catalog of which failure modes a codegen/extraction pipeline surfaces to
the human gate. `harvest-mcp#4` is a ready-made **auth-descriptor vocabulary**
(TokenInfo type/location/scope/expiry, TokenLifecycle, securityIssues channel) —
study for the shared driver auth-descriptor schema. All three are
pattern-reference (harvest-mcp is unknown-license; see §2).

**MCP surface + portal (DEFERRED follow-ons, Q3).** `us-legal-tools#4` (MCP tool
registration with structured param groups + operationId-derived names) and
`us-legal-tools#12` (Scalar+Hono aggregated docs portal) feed the deferred
`gov-legal-mcp` server and a future local data-source portal — **out of v1
scope** (gated behind ≥2 proven drivers). `lawyergpt#5` (config-selector
case-law scraper) is a serendipitous study-only reference for any future
jurisdiction-specific harvesting driver.

> **Sibling note:** `courtlistener#11`, `harvest-mcp#4/#8`, `mcp-uspto#1`,
> `patent-search-mcp-server#6`, `patents-mcp-server#14`, `uspto-patents-mcp#6`
> also touch the USPTO/patents surface (`@beep/uspto`, the FalkorDB projection).
> Those are owned by the patents cluster — this packet takes only the
> driver-substrate (auth/retry/cache/rate-limit/codegen) slice and leaves the
> patent-entity / citation-graph modeling to the sibling.

---

## 2. Upstream repositories & licenses

Licenses are load-bearing. **Copyleft (AGPL)** upstreams are
clean-room-reimplement only (pattern, never vendored code). **Permissive
(MIT)** may be ported with attribution. **Unknown-license** is
reimplement-don't-copy (treat as if poisoned for vendoring).

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| us-legal-tools | T1 | MIT | Port-with-attribution — but value is the **pipeline/patterns**, not the Orval/axios/Zod output | OpenAPI→dual (SDK+MCP) codegen architecture, turbo generate→build edge, CourtListener Token-auth shape, per-spec registration convention |
| TalentScore | T1 | MIT | Port-with-attribution | Effect `HttpClient` wrapper: Redacted auth header + `retryTransient` + version-pinned `mapRequest` |
| courtlistener | T1 | AGPL-3.0-only | **Clean-room reimplement only** | Citation-aware rate-throttle / parse-once cost-metering pattern (study) |
| mike | T1 | AGPL-3.0-only | **Clean-room reimplement only** | CourtListener citation regex + local-cache-then-API fallback architecture (pattern, not code) |
| doc-haus | T1 | MIT | Port-with-attribution | CourtListener result-shaping + token-vs-unauth rate-limit pattern; remote-MCP option |
| patents-mcp-server | T1 | MIT | Port-with-attribution | Committed OpenAPI→validation codegen + deterministic-CI discipline (adopt the discipline, not Hey API) |
| mcp-uspto | T2 | MIT | Port-with-attribution | Per-tier token-bucket rate limiter + multi-tier auth fetcher |
| patent-search-mcp-server | T2 | MIT | Port-with-attribution | HTTP status→code→message mapping table |
| uspto-patents-mcp | T2 | MIT | Port-with-attribution | Deterministic cache-key (`stableKey`) + TTL-jitter memoize |
| us-gov-open-data-mcp | T2 | MIT (LICENSE unverified) | **Reimplement-don't-copy** | Declarative `ClientConfig` auth/cache/retry/rate-limit shape + Retry-After parsing (pattern only) |
| harvest-mcp | T2 | unknown (no LICENSE file) | **Reimplement-don't-copy** | Typed-error taxonomy + auth-descriptor vocabulary (pattern only) |
| lawyergpt | T2 | unknown | **Reimplement-don't-copy** | Config-selector scraper shape (study only) |

> **Cautions (echoed from the source bundle):**
> - **Licensing:** `us-legal-tools` is MIT, but port the *architecture* onto
>   Effect/HttpApi/effect-Schema — do not copy the generated axios/Zod output.
>   `us-gov-open-data-mcp` license is unverified → reimplement, don't copy.
> - **API state (verified 2026-06, all five upstreams ACTIVE):** CourtListener V4
>   **enforces auth** (anonymous = 401); header must be literally
>   `Authorization: Token <key>` (DRF `TokenAuthentication`, **not** Bearer/Api-Key);
>   target `/api/rest/v4/` (V3 is legacy); the SCOTUS visualization endpoints are
>   **deprecated — do not generate them**.
> - GovInfo + DOL require an `api.data.gov` `api_key` (query param); eCFR and
>   Federal Register are **keyless** (FedReg is an "unofficial prototype"; GovInfo
>   is the official source).
> - Orval `@orval/mcp` generator works **single-mode only** (one spec per config) —
>   relevant only if Orval is used directly (beep is not).
> - **Cross-cutting deprecation (NOT in this repo — flag for any sibling patents
>   driver):** PatentsView ended Feb 2025; PatentSearch → USPTO Open Data Portal
>   (`data.uspto.gov`) on 2026-03-20 with mandatory key reissue; legacy USPTO
>   Developer Hub decommissioned 2026-06-05.

---

## 3. External research sources

These citations appear on disk in the source exploration's `RESEARCH.md`
(verbatim URLs — not invented). Full annotated treatment lives in the exploration
`research/*.md` deep-research reports linked from [`research/README.md`](./README.md).

**Upstream API contracts & terms**
- CourtListener REST v4 overview — https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview
- CourtListener v4 citation-lookup — https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup
- CourtListener API in memberships (auth hardening) — https://free.law/2026/05/07/api-included-in-memberships/
- GovInfo API features — https://www.govinfo.gov/features/api
- GPO usgpo/api repo + LICENSE — https://github.com/usgpo/api · https://raw.githubusercontent.com/usgpo/api/main/LICENSE.md
- api.data.gov developer manual — https://api.data.gov/docs/developer-manual/
- eCFR API v1 docs + spec — https://www.ecfr.gov/developers/documentation/api/v1 · https://www.ecfr.gov/developers/documentation/api/v1.json
- Federal Register API v1 docs + legal status — https://www.federalregister.gov/developers/documentation/api/v1 · https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status
- DOL API beginners guide / user guide — https://developer.dol.gov/beginners-guide/ · https://www.dataportal.dol.gov/pdf/dol-api-user-guide.pdf · https://usdepartmentoflabor.github.io/DOLAPI/

**Codegen prior art & licensing**
- us-legal-tools (Orval pipeline) — https://github.com/beshkenadze/us-legal-tools
- us-gov-open-data-mcp — https://github.com/lzinga/us-gov-open-data-mcp
- Orval MCP guide + LICENSE — https://orval.dev/docs/guides/mcp/ · https://github.com/orval-labs/orval/blob/master/LICENSE
- Hey API openapi-ts — https://www.npmjs.com/package/@hey-api/openapi-ts · https://heyapi.dev/openapi-ts/migrating
- fortanix/openapi-to-effect (Effect-native codegen prior art) — https://github.com/fortanix/openapi-to-effect

**Effect v4 HTTP/MCP/rate-limit primitives**
- Effect RateLimiter API — https://effect-ts.github.io/effect/effect/RateLimiter.ts.html
- effect-smol migration guide + issue — https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md · https://github.com/Effect-TS/effect-smol/issues/1978
- Effect AI/MCP integration architecture — https://deepwiki.com/Effect-TS/effect/10.1-ai-integration-architecture
- MCP server tools spec — https://modelcontextprotocol.io/specification/2025-06-18/server/tools

**Rate-limit / retry standards**
- IETF RateLimit headers draft — https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
- RFC 9110 Retry-After — https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after

**Turbo determinism**
- Turborepo caching + task config — https://turborepo.dev/docs/crafting-your-repository/caching · https://turborepo.dev/docs/crafting-your-repository/configuring-tasks

**Deprecation gravity**
- PatentsView legacy-API end-of-support — https://patentsview.org/data-in-action/patentsview-ends-support-legacy-api
- USPTO ODP transition guide — https://data.uspto.gov/support/transition-guide/patentsview

---

## 4. In-repo capability references

The `@beep/*` bricks this packet composes (from the bundle `secondaryTargets` /
`alreadyCovered` / `netNew` and the exploration's in-repo inventory).

| Capability | Package path | Status |
| --- | --- | --- |
| GovInfo driver (Search HttpApi contract + value models: SearchResult/PackageInfo/GranuleMetadata) | `packages/drivers/govinfo` | **extend** — PARTIAL (schemas only; add service/config/auth/retry/cache layer) |
| CourtListener driver | deleted `packages/drivers/courtlistener` (2026-08-13) | **recreate** via `goals/honest-repo-signal/research/FOLLOW-UPS.md` when delivery resumes; do not extend a deleted tree |
| eCFR driver | `packages/drivers/ecfr` | **extend** — live keyless driver; delivery P1 grew it to 15 ops |
| DOL driver | deleted `packages/drivers/dol` (2026-08-13) | **recreate** via FOLLOW-UPS when delivery resumes |
| Federal Register driver | deleted `packages/drivers/federal-register` (2026-08-13) | **recreate** via FOLLOW-UPS when delivery resumes |
| Effect-native OpenAPI/JSON-schema codegen precedent (`openapi.json` + `scripts/generate.ts`, `*.generated`/`*.service`/`*.config` split) | `packages/drivers/runpod`, `packages/drivers/acp` | **reuse** — the codegen precedent to mirror instead of adopting Orval/axios |
| Identity composer + schema kit (manifest repair: govinfo needs both) | `@beep/identity`, `@beep/schema` | **reuse** |
| MCP tool-registration convention (deferred `gov-legal-mcp` consumer) | `@beep/nlp-mcp` | **reuse** (follow-on only) |
| Shared auth/retry/cache/rate-limit transport transformer | incubates in `packages/drivers/govinfo` → promotes to `foundation/capability/<name>` | **NET-NEW** (≥2-consumer gate per `standards/architecture/07-non-slice-families.md`) |
| Tiered OpenAPI→effect-Schema codegen pipeline (`scripts/generate.ts` + `src/_generated/*` per driver) | per-driver under `packages/drivers/*` | **NET-NEW** |

> **Out of scope (do not rebuild):** static official-dataset sync
> (ISO4217/IANA/CLDR) is owned by `goals/official-data-sync-foundation`.
> `explorations/solo-firm-docketing` is a downstream consumer, not a target here.

---

## 5. Cross-links & provenance

- **Source exploration (primary research ledger):**
  [`explorations/gov-legal-data-driver-codegen`](../../../explorations/gov-legal-data-driver-codegen)
  — graduated into this goal on 2026-06-29 (all 8 ALIGN questions resolved; see
  `SPEC.md` Decision Log). Its `RESEARCH.md`, `DECISIONS.md`, `BRIEF.md`, `MAP.md`,
  and five `research/*.md` deep-research reports are the authoritative narrative
  source — this `SOURCES.md` is the provenance join for implementation convenience.
- **Cluster id:** `gov-legal-data-driver-codegen` (route `new-exploration`,
  wave histogram P1×7 / P2×6 / P3×6).
- **This packet:** [`SPEC.md`](../SPEC.md) (normative contract + Q1–Q8 Decision
  Log) · [`PLAN.md`](../PLAN.md) (P0–P3) · [`GOAL.md`](../GOAL.md) (launcher) ·
  [`ops/manifest.json`](../ops/manifest.json).
- **Codex review:** [`research/2026-06-29-codex-spec.md`](./2026-06-29-codex-spec.md)
  (spec-gate critique: verifier↔acceptance-criteria gaps, falsifiability,
  ODP/official-source ambiguity).
- **Gold-intake provenance:**
  [`ROUTING.md`](../../../explorations/_gold-intake/ROUTING.md) ·
  [`routing.json`](../../../explorations/_gold-intake/routing.json) ·
  [`GOLD_SYNTHESIS.md`](../../../explorations/_gold-intake/GOLD_SYNTHESIS.md)
  ("Legal / court / patent data ingestion" + "Risks, deprecations & licensing").

# Gov/Legal Data Drivers + OpenAPI Codegen — Sources & Provenance

Provenance ledger for this exploration: it joins every mined gold nugget in this
cluster to its upstream repo + `file:line`, the upstream license (port
discipline), the external research actually cited on disk, and the in-repo
`@beep/*` capabilities this packet composes. Derived from the **Gov/legal data
drivers + OpenAPI codegen** cluster (19 nuggets, route `new-exploration`).

- **Cluster:** Gov/legal data drivers + OpenAPI codegen — route `new-exploration`, wave P1 (histogram P1 7 / P2 6 / P3 6)
- **Gold-intake provenance:** [`../../_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) · [`../../_gold-intake/routing.json`](../../_gold-intake/routing.json) · [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) (see the **Data-ingestion & drivers** cluster)
- **Graduated goal:** [`../../../goals/gov-legal-data-driver-codegen`](../../../goals/gov-legal-data-driver-codegen)
- **Codex review:** [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)
- **Theme span:** data-ingestion · desktop-portal · effect-ts · governance-ops · mcp-design

---

## 1. Mined source corpus (gold nuggets)

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| TalentScore#7 | Effect HttpClient wrapper: versioned base URL + Redacted auth header + retry | TalentScore (MIT) | `packages/server/src/public/files/upload-thing-api.ts:70-102` | data-ingestion | P1 | port-with-attribution (adopt the wrapper/auth template) |
| doc-haus#14 | CourtListener case-law client (duplicates beep skeleton) | doc-haus (MIT) | `dochaus/tool/case-law.ts:45-58` | data-ingestion | P1 | reference — compare result-shape + token vs anonymous; remote-MCP option |
| mcp-uspto#1 | Per-API token-bucket rate limiter + multi-tier auth fetcher | mcp-uspto (MIT) | `src/lib/fetcher.ts:15-81` | data-ingestion | P1 | port-with-attribution (token-bucket kernel) |
| mike#11 | CourtListener v4 client: bulk-first fallback + citation parse/normalize/verify | mike (AGPL-3.0-only) | `backend/src/lib/courtlistener.ts:457-467` | data-ingestion | P1 | clean-room reimplement (citation regex + cache-then-API fallback) |
| us-gov-open-data-mcp#2 | Config-object API client factory: auth (query/header/body) + disk-TTL cache + retry/backoff + rate limit | us-gov-open-data-mcp (MIT, **unverified — treat as reimplement**) | `src/shared/client.ts:22-65` | data-ingestion | P1 | clean-room reimplement (declarative auth-config shape + Retry-After parsing) |
| us-gov-open-data-mcp#3 | Token-bucket rate limiter with FIFO fairness + batch drain | us-gov-open-data-mcp (MIT, **unverified**) | `src/shared/client.ts:115-182` | data-ingestion | P1 | clean-room reimplement (Effect-wrappable FIFO token bucket) |
| us-legal-tools#3 | CourtListener token-auth axios mutator (`Authorization: Token <env>`) | us-legal-tools (MIT) | `packages/courtlistener-sdk/src/api/client.ts:8-22` | data-ingestion | P1 | port-with-attribution (header/env convention, not axios) |
| harvest-mcp#8 | Typed error hierarchy with code + structured data payload | harvest-mcp (**unknown license — do not vendor**) | `src/types/index.ts:854-908` | effect-ts | P2 | reference (failure-mode catalog → Data.TaggedError) |
| patent-search-mcp-server#6 | Status-code humanization + typed API error mapping | patent-search-mcp-server (MIT) | `src/api/client.ts:78-106` | effect-ts | P2 | port-with-attribution (status→code→message table → Schema.TaggedError) |
| patents-mcp-server#14 | OpenAPI→Zod response-validation codegen (Hey API), committed to repo | patents-mcp-server (MIT) | `package.json:32-33` | governance-ops | P2 | port-with-attribution (OpenAPI→Schema validation + committed-codegen CI) |
| us-legal-tools#1 | Single OpenAPI spec → dual SDK + MCP server codegen (Orval) | us-legal-tools (MIT) | `packages/orval-config/src/index.ts:9-47` | mcp-design | P2 | study — port the **two-target idea**, not the Orval/axios/Zod code |
| us-legal-tools#4 | MCP tool registration with structured path/query/body param groups | us-legal-tools (MIT) | `packages/courtlistener-sdk/src/mcp/server.ts:148-155` | mcp-design | P2 | port-with-attribution (param grouping + operationId-derived names) |
| uspto-patents-mcp#6 | KV memoize cache with TTL jitter + stable cache-key builder | uspto-patents-mcp (MIT) | `src/cache.ts:15-39` | data-ingestion | P2 | port-with-attribution (deterministic key + TTL jitter) |
| courtlistener#11 | Citation-aware rate throttle (eyecite parse reused downstream) | courtlistener (AGPL-3.0-only) | `cl/api/utils.py:1078-1136` | data-ingestion | P3 | clean-room reimplement (parse-once cost metering); pagination lives in `cl/api/pagination.py` |
| harvest-mcp#4 | Auth-analysis domain model: TokenInfo / TokenLifecycle / AuthenticationEndpoint | harvest-mcp (**unknown license — do not vendor**) | `src/types/index.ts:28-123` | data-ingestion | P3 | study (normalized auth-descriptor vocabulary) |
| lawyergpt#5 | Configurable CSS-selector legal-corpus scraper | lawyergpt (**unknown license — do not vendor**) | `extractor/main.go:64-93` | data-ingestion | P3 | study (env-driven selector + batched ingestion pattern) |
| us-legal-tools#10 | Turbo codegen-as-build-step pipeline (generate → build, uncached generate) | us-legal-tools (MIT) | `turbo.json:4-33` | governance-ops | P3 | port-with-attribution (cache:false generate determinism) |
| us-legal-tools#12 | Scalar + Hono aggregated OpenAPI docs portal | us-legal-tools (MIT) | `packages/scalar-ui/src/server.ts:1-7` | desktop-portal | P3 | study (optional local data-source portal) |
| us-legal-tools#2 | Per-spec `orval.config` one-liner (driver registration pattern) | us-legal-tools (MIT) | `packages/ecfr-sdk/orval.config.ts:1-3` | data-ingestion | P3 | reference (near-zero-boilerplate driver registration surface) |

### How these inform this packet

**Shared client foundation (auth + retry + cache + rate limit).** The center of
gravity. `us-gov-open-data-mcp#2` carries the load-bearing contract — a
declarative `auth.type: "query" | "header" | "body"` config with `envParams`
mapping param→env var, plus Retry-After-honoring backoff on 429/502/503/504 —
take that **shape** but reimplement on Effect `HttpClient` (AGPL-adjacent
caution does not apply, but the license is unverified, so reimplement, don't
copy). `TalentScore#7` is the concrete Effect template to mirror (Redacted auth
header so the secret never logs, `retryTransient` with exponential schedule,
`Effect.Service`). `mcp-uspto#1` + `us-gov-open-data-mcp#3` supply two
token-bucket variants (per-tier bucket map vs FIFO-fair single-timer drain) —
take the FIFO no-thundering-herd algorithm. `uspto-patents-mcp#6` adds the
deterministic `stableKey()` (sorted-key serialization) + TTL jitter for the
response cache. Net: implementing agent builds one shared driver base, not six.

**CourtListener auth + citation handling.** Three nuggets converge on the same
target. `us-legal-tools#3` fixes the exact wire contract — `Authorization: Token
<COURTLISTENER_API_TOKEN>` (DRF TokenAuthentication, **not** Bearer/Api-Key),
base `…/api/rest/v4`, 30s timeout — port the header/env convention verbatim.
`doc-haus#14` confirms the same shape from a second source and flags the
remote-MCP-vs-hand-rolled-client fork worth comparing. `mike#11` (AGPL —
reimplement) contributes the citation regex parser + bulk-cache-then-live-API
fallback architecture. `courtlistener#11` (AGPL — reimplement) adds parse-once
cost metering; note the cited correction that V4 pagination actually lives in
`cl/api/pagination.py`.

**Typed-error taxonomy.** `patent-search-mcp-server#6` gives a ready
status→code→message table (401→unauthenticated, 402→payment_required,
429→rate_limited) to model as `Schema.TaggedError` variants. `harvest-mcp#8` +
`harvest-mcp#4` (unknown license — study only) catalog which failure modes a
codegen/extraction pipeline produces and a normalized auth-descriptor vocabulary
for the human gate.

**Codegen pipeline + governance.** `us-legal-tools#1` is the headline pattern —
one OpenAPI spec → both a typed SDK and an MCP server — but is marked **study**:
port the two-target idea onto Effect/effect-rpc/effect-Schema, do not adopt
Orval/axios/Zod (the value is the pipeline, not the generated output).
`patents-mcp-server#14` shows committed-codegen-for-deterministic-CI with a
`looseParse` fallback. `us-legal-tools#10` wires `build` to depend on a
`cache:false` `generate` step. `us-legal-tools#4` + `#2` define the MCP
tool-registration convention and the per-driver one-liner registration surface.
The repo already has an Effect-native precedent (`runpod`/`acp`) to reuse
instead — see §4.

**Adjacent / optional.** `us-legal-tools#12` (Scalar+Hono docs portal) and
`lawyergpt#5` (CSS-selector scraper) are serendipitous — park them as optional
desktop-portal / scraping-driver follow-ons.

---

## 2. Upstream repositories & licenses

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| TalentScore | T1 | MIT | port-with-attribution | Effect HttpClient wrapper: Redacted auth header + versioned base URL + `retryTransient` |
| doc-haus | T1 | MIT | port-with-attribution | CourtListener result-shape + token-vs-anonymous rate pattern; remote-MCP option |
| us-legal-tools | T1 | MIT | port-with-attribution (architecture, **not** Orval/axios/Zod output) | OpenAPI→SDK+MCP two-target codegen idea, Token-auth convention, turbo generate→build, MCP tool registration |
| patents-mcp-server | T1 | MIT | port-with-attribution | OpenAPI→Schema response-validation + committed-codegen CI pattern |
| courtlistener | T1 | **AGPL-3.0-only** | **clean-room reimplement (pattern only, never vendor)** | Citation-aware throttle / parse-once metering; jurisdiction + pagination design |
| mike | T1 | **AGPL-3.0-only** | **clean-room reimplement (pattern only, never vendor)** | Citation parse/normalize + bulk-cache-then-API fallback architecture |
| mcp-uspto | T2 | MIT | port-with-attribution | Per-tier token-bucket rate limiter + multi-tier auth fetcher |
| patent-search-mcp-server | T2 | MIT | port-with-attribution | Status→code→message mapping table → Schema.TaggedError variants |
| uspto-patents-mcp | T2 | MIT | port-with-attribution | KV memoize cache: deterministic `stableKey` + TTL jitter |
| us-gov-open-data-mcp | T2 | MIT (**unverified — treat as reimplement**) | clean-room reimplement | Declarative auth-config shape, Retry-After parsing, FIFO token bucket |
| harvest-mcp | T2 | **unknown — do not vendor** | reference / study only | Typed-error code+data hierarchy; auth-analysis domain vocabulary |
| lawyergpt | T2 | **unknown — do not vendor** | reference / study only | Config-driven CSS-selector + batched ingestion pattern |

> **Caution (from bundle.cautions):**
> - **Licensing:** `us-legal-tools` is MIT but the value is the codegen
>   **pipeline/patterns**, not the Orval-generated axios/Zod output — port the
>   architecture onto Effect/HttpApi/effect-Schema. `us-gov-open-data-mcp`
>   license is unverified → reimplement, don't copy. `courtlistener` + `mike`
>   are AGPL-3.0 → clean-room only. `harvest-mcp` + `lawyergpt` have no LICENSE
>   → do not vendor.
> - **API state (verified 2026-06, all five upstreams ACTIVE):** CourtListener
>   V4 **enforces** auth (anonymous = 401); header must be literally
>   `Authorization: Token <key>` (DRF TokenAuthentication, **not** Bearer/Api-Key);
>   target `/api/rest/v4/` (V3 legacy); SCOTUS visualization endpoints are
>   deprecated — do not generate them. GovInfo + DOL require an `api.data.gov`
>   `api_key` (query param); eCFR + Federal Register are keyless (FedReg is an
>   "unofficial prototype", GovInfo is the official source). `@orval/mcp` runs
>   single-mode only (one spec per config) — relevant only if Orval is used directly.
> - **Cross-cutting deprecation (NOT in this repo — flag for any sibling patents
>   driver):** PatentsView ended Feb 2025; PatentSearch → USPTO Open Data Portal
>   (`data.uspto.gov`) on 2026-03-20 with mandatory key reissue; legacy USPTO
>   Developer Hub decommissioned 2026-06-05.

---

## 3. External research sources

Citations that actually appear on disk in this packet's `RESEARCH.md` /
`research/*.md` / `reviews/*.md`. Clustered by sub-area; not exhaustive of every
inline link.

**Upstream gov/legal API contracts (the per-driver matrix):**
- CourtListener REST v4 — overview / change-log / citation-lookup: `https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview`, `https://wiki.free.law/c/courtlistener/help/api/rest/change-log`, `https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup`, `https://www.courtlistener.com/api/rest/v4/`, `https://free.law/2026/05/07/api-included-in-memberships/`, `https://github.com/freelawproject/courtlistener/discussions/6895`
- eCFR — keyless API v1: `https://www.ecfr.gov/developers/documentation/api/v1`, `https://www.ecfr.gov/developers/documentation/api/v1.json`, `https://www.ecfr.gov/reader-aids/ecfr-developer-resources`
- Federal Register ("unofficial prototype") API v1: `https://www.federalregister.gov/developers/documentation/api/v1`, `https://www.federalregister.gov/reader-aids/developer-resources/rest-api`, `https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status`, `https://github.com/rOpenGov/federalregister`
- GovInfo (official, api.data.gov key): `https://api.govinfo.gov/docs/`, `https://www.govinfo.gov/developers`, `https://www.govinfo.gov/features/api`, `https://www.govinfo.gov/api-signup`, `https://github.com/usgpo/api`
- DOL (api.data.gov key): `https://developer.dol.gov/`, `https://dataportal.dol.gov/api-keys`, `https://usdepartmentoflabor.github.io/DOLAPI/`, `https://www.dataportal.dol.gov/pdf/dol-api-user-guide.pdf`
- api.data.gov shared key + RateLimit headers: `https://api.data.gov/docs/developer-manual/`, `https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/`, `https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after`

**Codegen engines studied:**
- Orval (OpenAPI→SDK+MCP, single-mode MCP): `https://orval.dev/docs/guides/mcp/`, `https://orval.dev/docs/reference/configuration/output/`, `https://www.npmjs.com/package/@orval/mcp`, `https://github.com/orval-labs/orval/blob/master/LICENSE`
- Hey API / openapi-ts: `https://github.com/hey-api/hey-api`, `https://heyapi.dev/openapi-ts/migrating`, `https://www.npmjs.com/package/@hey-api/openapi-ts`
- Effect-native OpenAPI generators: `https://github.com/fortanix/openapi-to-effect`, `https://registry.npmjs.org/@effect/openapi-generator`

**Effect / Turbo platform references:**
- Effect v4 beta + smol migration: `https://effect.website/blog/effect-v4beta-launch-to-may-recap/`, `https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md`, `https://effect-ts.github.io/effect/effect/RateLimiter.ts.html`
- MCP tools spec: `https://modelcontextprotocol.io/specification/2025-06-18/server/tools`
- Turbo caching/tasks: `https://turborepo.dev/docs/crafting-your-repository/caching`, `https://turborepo.dev/docs/crafting-your-repository/configuring-tasks`

**Upstream repos cited by URL (license verification):**
- `https://github.com/beshkenadze/us-legal-tools` (us-legal-tools), `https://github.com/lzinga/us-gov-open-data-mcp` + `https://raw.githubusercontent.com/lzinga/us-gov-open-data-mcp/main/LICENSE` (license check)

**Patents deprecation (sibling-driver flag, not this repo):** `https://patentsview.org/data-in-action/support-legacy-api-end-february-2025-switch-patentsearch-api-now`, `https://data.uspto.gov/support/transition-guide/patentsview`

---

## 4. In-repo capability references

The `@beep/*` bricks this packet composes (from bundle.secondaryTargets +
RESEARCH.md In-Repo Capability Inventory).

| Capability | Path | Status |
| --- | --- | --- |
| CourtListener driver | `packages/drivers/courtlistener` | **NET-NEW** (bare `VERSION='0.0.0'` skeleton) |
| eCFR driver | `packages/drivers/ecfr` | **NET-NEW** (bare skeleton) |
| DOL driver | `packages/drivers/dol` | **NET-NEW** (bare skeleton) |
| Federal Register driver | `packages/drivers/federal-register` | **NET-NEW** (bare skeleton) |
| GovInfo driver | `packages/drivers/govinfo` | **extend** — PARTIAL: Search HttpApi domain contract + value models scaffolded; add client/auth(api.data.gov)/retry/cache |
| RunPod driver | `packages/drivers/runpod` | **reuse precedent** — checked-in `openapi.json` + `scripts/generate.ts` bespoke renderer over `effect/http` |
| ACP driver | `packages/drivers/acp` | **reuse precedent** — library-driven + pinned remote-spec download codegen |
| USPTO driver | `packages/drivers/uspto` | **reference / extend-elsewhere** — hand-rolled Redacted-header auth; depth extension routed to `uspto-patent-driver-depth` |
| M365 driver | `packages/drivers/m365` | **reference** — Retry-After-honoring + status→error mapping precedent |
| nlp-mcp server | `packages/drivers/nlp-mcp` | **reference** — Effect-native MCP server / tool-registration convention target |
| `@beep/identity` | `packages/*` ($I composer: `$I.annote`/`$I.annoteSchema`) | **reuse** |
| `@beep/schema` | `packages/*` (`LiteralKit`, `TaggedErrorClass`, `HttpStatus2XX/4XX/5XX`) | **reuse** |
| `@beep/utils` | `packages/*` | **reuse** (note: no `@beep/utils` hit yet in `packages/drivers/govinfo/src`) |

Sibling exploration: `explorations/solo-firm-docketing` (consumes the
CourtListener / Federal Register drivers downstream).

---

## 5. Cross-links & provenance

- **Cluster id:** Gov/legal data drivers + OpenAPI codegen (`new-exploration`, 19 nuggets)
- **Exploration ⇄ goal:** this packet graduated into [`goals/gov-legal-data-driver-codegen`](../../../goals/gov-legal-data-driver-codegen) (2026-06-29)
- **Packet artifacts:** [`../CAPTURE.md`](../CAPTURE.md) · [`../RESEARCH.md`](../RESEARCH.md) · [`../DECISIONS.md`](../DECISIONS.md) · [`../BRIEF.md`](../BRIEF.md) · [`../MAP.md`](../MAP.md)
- **Companion research notes:** [`./conditional-mcp-registration-and-auth-gating.md`](./conditional-mcp-registration-and-auth-gating.md) · [`./inrepo-codegen-precedent-and-licensing.md`](./inrepo-codegen-precedent-and-licensing.md) · [`./openapi-to-effect-sdk-mcp-codegen.md`](./openapi-to-effect-sdk-mcp-codegen.md) · [`./shared-effect-http-client-layer.md`](./shared-effect-http-client-layer.md) · [`./upstream-api-contract-matrix.md`](./upstream-api-contract-matrix.md)
- **Codex review:** [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)
- **Gold-intake roots:** [`../../_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) · [`../../_gold-intake/routing.json`](../../_gold-intake/routing.json) · [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) (Data-ingestion & drivers cluster)

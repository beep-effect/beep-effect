# Gov/Legal Data Drivers + OpenAPI Codegen — Research

<!--
Stage 1 synthesis (2026-06-29). Distilled, cited view over the five raw deep-
research reports in research/*.md. Cite source URLs inline; link back to
research/<subtopic>.md for raw detail. In-repo claims verified via rg/ls
against /home/elpresidank/YeeBois/projects/beep-effect on 2026-06-29.
-->

## External Landscape

The wedge is "one OpenAPI spec → dual target (typed SDK + MCP server)" for five
bare gov/legal drivers, ported off the donor stack (Orval/axios/Zod) onto
beep's Effect-native codegen. The external prior art splits into four threads:
the codegen-pipeline pattern, the per-upstream API contracts, the Effect v4
HTTP/MCP primitives that replace the hand-rolled donor machinery, and the
licensing/deprecation gravity. Raw detail:
[`research/openapi-to-effect-sdk-mcp-codegen.md`](research/openapi-to-effect-sdk-mcp-codegen.md),
[`research/upstream-api-contract-matrix.md`](research/upstream-api-contract-matrix.md),
[`research/shared-effect-http-client-layer.md`](research/shared-effect-http-client-layer.md),
[`research/conditional-mcp-registration-and-auth-gating.md`](research/conditional-mcp-registration-and-auth-gating.md),
[`research/inrepo-codegen-precedent-and-licensing.md`](research/inrepo-codegen-precedent-and-licensing.md).

### Codegen-pipeline prior art (port the architecture, not the runtime)

- **Orval `@orval/mcp` is the originating "single spec → dual target" idea** —
  one config emits an axios SDK *and* an MCP `server.ts`/`handlers.ts`. Orval is
  MIT (https://github.com/orval-labs/orval/blob/master/LICENSE) and the
  `operationId` is the default MCP tool name
  (https://orval.dev/docs/guides/mcp/). **Hard constraint:** the `mcp` client
  "currently only works in `single` mode" — one spec per config, `tags`/`split`
  unsupported (https://orval.dev/docs/guides/mcp/), so the Orval route is
  one-config-per-driver. beep ports the *pattern* (operationId→tool-name,
  generate-as-build-step) onto Effect primitives, not the axios/Zod output.
- **Hey API `@hey-api/openapi-ts`** (the patents-mcp-server donor precedent for
  OpenAPI→Zod validation codegen) is MIT
  (https://www.npmjs.com/package/@hey-api/openapi-ts) and supplies the
  governance lessons that *do* transfer: download the upstream spec into the
  package, commit both spec and generated output, treat the generated dir as a
  read-only dependency ("do not directly modify its contents"), and pin an exact
  generator version (https://heyapi.dev/openapi-ts/migrating).
- **Turborepo generate-before-build** is the canonical deterministic-CI shape:
  `"build": { "dependsOn": ["codegen", "^build"] }` with `"codegen": { "cache":
  false }`; Turbo "assumes tasks are deterministic" so identical-input→identical-
  output codegen is required, and `dependsOn: []` must be avoided (it breaks
  invalidation) (https://turborepo.dev/docs/crafting-your-repository/configuring-tasks,
  https://turborepo.dev/docs/crafting-your-repository/caching).
- **`fortanix/openapi-to-effect`** (v0.9.3, 2025-11-28) generates effect/Schema
  from OpenAPI 3.1, but it is **MPL-2.0** weak-copyleft, single-document /
  JSON-only, and `$allOf`-on-objects-only — prefer the first-party MIT
  `@effect/openapi-generator` to keep the license surface MIT and stay on the
  Effect release train (https://github.com/fortanix/openapi-to-effect).

### Effect v4 primitives that subsume the donor's hand-rolled machinery

The donor `us-gov-open-data-mcp` factory (declarative auth + disk-TTL cache +
retry/backoff + token-bucket rate limiter) is largely native in
`effect@4.0.0-beta.91`, so most of it is reuse, not reimplementation:

- **Native rate limiting.** v4 has NO top-level `RateLimiter` (the v3
  `effect/RateLimiter` is gone — contrast
  https://effect-ts.github.io/effect/effect/RateLimiter.ts.html); the only one
  is `effect/unstable/persistence/RateLimiter` (algorithm `"fixed-window" |
  "token-bucket"`, `window`, `limit`, per-call `tokens`, in-process
  `layerStoreMemory`). `HttpClient.withRateLimiter` applies it per request,
  honors `Retry-After` in **both** RFC 9110 forms (`delay-seconds` and
  `HTTP-date`), auto-retries 429, and adaptively reads the IETF
  `RateLimit-*`/`X-RateLimit-*` header family (draft-11, May 2026 —
  https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/). Its
  `key`/`tokens` callbacks cover the CourtListener "charge N tokens per citation"
  case natively.
- **Native retry.** `HttpClient.retryTransient` retries transport errors,
  timeouts, and statuses 408/429/500/502/503/504 on a configurable `Schedule`
  (`Schedule.exponential` ⊕ `Schedule.jittered`). It does NOT itself read
  `Retry-After` (use `withRateLimiter` for that). RFC 9110 §10.2.3 defines
  `Retry-After = HTTP-date / delay-seconds`
  (https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after).
- **Native cache.** `Cache.makeWith({ lookup, capacity, timeToLive })` takes a
  `timeToLive(exit, key)` function — the hook for the uspto-patents-mcp "+10%
  random TTL jitter to avoid stampede" plus shorter negative-cache TTLs on
  failure `Exit`s; the static `Cache.make` form cannot do either.
- **Native MCP server.** `effect/unstable/ai/McpServer` (`layerStdio` routes
  logs to stderr to keep stdout pure JSON-RPC; `toolkit`/`registerToolkit`)
  plus `Toolkit`/`Tool.make` ARE the MCP target — not
  `@modelcontextprotocol/sdk`. The same `Tool`/`Toolkit` abstraction also drives
  `@effect/ai` LLM function-calling, so one generated toolkit serves both an MCP
  server and in-process tool-calling — a cleaner dual-target than Orval's two
  unrelated generators (https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md,
  https://deepwiki.com/Effect-TS/effect/10.1-ai-integration-architecture).
- **MCP gating mechanics.** `registerToolkit` emits each tool with `name:
  tool.name` 1:1 (no transformation), so `operationId→Tool.make(operationId,…)`
  lands the Orval naming pattern. Boot-time credential gating uses
  `Config.option(Config.redacted("ENV"))` + `Layer.unwrap(... ? toolkit :
  Layer.empty)` so a keyless driver's tools are absent from `tools/list` *and*
  uncallable. The MCP spec defines `name` only as "unique identifier" with no
  published regex (https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
  — but "no regex in the prose spec" is NOT sufficient for *generated* tools.
  OpenAPI operationIds can be absent, duplicated, long, mixed-case, or carry
  characters that downstream MCP clients/providers reject even when Effect
  accepts them (historically some SDK JSON schemas constrain names to
  `^[a-zA-Z0-9_-]+$` with ~64–128 char caps), and merging five drivers into one
  server adds cross-driver collision risk
  (`research/conditional-mcp-registration-and-auth-gating.md:78`). **Required
  generated-name contract:** driver-prefixed stable names (m365's `m365_` prefix
  is the in-repo precedent), safe-character normalization, a max-length policy,
  duplicate detection with a checked-in collision report, and integration tests
  against the Effect MCP JSON schemas plus at least one MCP client/provider
  constraint. Treat raw `operationId` as metadata/description, not necessarily
  the wire name.
  Effect's separate `McpSchema.EnabledWhen` annotation gates on the *client's*
  declared capabilities and is applied only to `*/list` (not `tools/call`), so
  it is discovery-shaping, NOT server-side credential access control — wrong tool
  for key-gating.

### Per-upstream contract matrix (docs-verified 2026-06-29; runtime probes pending)

Five upstreams, **three** auth families (CAPTURE implied two). Status is
**docs-indicate-active, live runtime probes pending** — sourced from current
published docs, not reproduced live `curl` probes (external DNS was blocked in
the verifying session), so this is not runtime proof for every path.
Auth-enforcement on DOL and CourtListener especially must be probed before MCP
gating is finalized. **Build-out proof checklist** (run before align closes):
unauthenticated + authenticated CourtListener sample request, DOL `/v4/datasets`
catalog + keyed dataset request, GovInfo `DEMO_KEY` or real-key request capturing
`X-RateLimit-*` headers, eCFR spec fetch, FedReg keyless request.

| Upstream | Auth | Credential | Base URL | Rate limit (current) |
|---|---|---|---|---|
| CourtListener V4 | Token-header (DRF) | `Authorization: Token <key>` (literal `Token`, NOT `Bearer`) | `https://www.courtlistener.com/api/rest/v4/` | **50/hr, 5/min, 125/day** default post-2026-05-07; 5,000/hr grandfathered |
| eCFR | keyless | — | `https://www.ecfr.gov` `/api/{search,versioner,admin}/v1/` | none published (429 on abuse) |
| DOL v4 | agency-native key | `X-API-KEY` (header or query) from `dataportal.dol.gov` | `https://apiprod.dol.gov/v4/` | undocumented in primary |
| Federal Register | keyless | — | `https://www.federalregister.gov/api/v1/` | none published; **2000-result pagination cap** |
| GovInfo | api.data.gov key | `api_key` query param (or `X-Api-Key` header) | `https://api.govinfo.gov/` | documented **36,000/hr** GPO tier — confirm per-key from live `X-RateLimit-Limit`; `DEMO_KEY` is far lower |

Key external facts and corrections the reports surfaced:

- **CourtListener** auth is literally `Authorization: Token <key>` — the docs
  warn "a common mistake is to forget the word 'Token'"; cursor pagination is
  blocked past page 100; the Citation Lookup endpoint has its own throttle (60
  valid citations/min, 250 citations/request, per-citation `status: 429` past the
  cap). A **major rate-limit cut landed 2026-05-07**: default dropped from
  5,000/hr to 50/hr-5/min-125/day, with a "≥1,000 lifetime requests"
  grandfather clause, and full API access is now bundled with membership
  (https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview,
  https://free.law/2026/05/07/api-included-in-memberships/,
  https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup). No
  machine-readable OpenAPI is published, but CourtListener is Django REST
  Framework-backed and its docs point at the API root / `OPTIONS`-style endpoint
  metadata (https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview) — so
  the choice is NOT binary "clean OpenAPI vs. hand-author everything." A DRF
  metadata spike (API-root/`OPTIONS` introspection) may seed a first
  field/endpoint inventory before any hand-authored subset is frozen.
- **DOL correction:** the current API is **v4 on `apiprod.dol.gov`** using a
  DOL-native `X-API-KEY` from `dataportal.dol.gov` — NOT api.data.gov (CAPTURE
  line 74 conflated it with GovInfo). The legacy `developer.dol.gov` hub no
  longer resolves (DNS ENOTFOUND, 2026-06-29) and v4 defaults to XML unless sent
  `Accept: application/json` (https://www.dataportal.dol.gov/pdf/dol-api-user-guide.pdf,
  https://usdepartmentoflabor.github.io/DOLAPI/, https://developer.dol.gov/beginners-guide/).
  No clean machine-readable OpenAPI surfaced, but DOL v4 exposes per-dataset
  **metadata endpoints** (`/v4/get/<agency>/<endpoint>/json/metadata`,
  `research/upstream-api-contract-matrix.md:52`) that can seed a field/endpoint
  inventory rather than freezing field sets by hand.
- **eCFR / Federal Register are keyless and always-on.** eCFR's machine-readable
  spec is at `https://www.ecfr.gov/developers/documentation/api/v1.json`
  (three service groups: search / versioner / admin) — but it is a **Swagger 2.0**
  document, not OpenAPI 3.x. `@effect/openapi-generator` claims Swagger 2.0
  normalization (`node_modules/@effect/openapi-generator/dist/OpenApiGenerator.d.ts`
  header: "It normalizes Swagger 2.0 input"), so the acp-style path is plausible
  but unproven — run a generator spike against the eCFR dialect and record
  warnings before choosing it. FedReg `per_page` defaults 20 / max 1000 with a
  hard 2000-result pagination cap
  (https://www.ecfr.gov/developers/documentation/api/v1,
  https://www.federalregister.gov/developers/documentation/api/v1).
- **Federal Register legal-status correction (supersedes both CAPTURE *and* the
  earlier "no prototype disclaimer" reading).** Three load-bearing facts, kept
  distinct: (1) the Federal Register API is a **current official-site API and
  keyless**; (2) FederalRegister.gov nonetheless still carries an
  **unofficial/prototype "Legal Status" caveat** — its rendered content "is not an
  official legal edition of the Federal Register," and only the official editions
  give legal/judicial notice under 44 U.S.C. 1503 & 1507
  (https://www.federalregister.gov/developers/documentation/api/v1,
  https://www.federalregister.gov/reader-aids/understanding-the-federal-register/legal-status);
  (3) **GovInfo remains the official legal-edition source** for authoritative
  documents. So "hosted by official federalregister.gov / NARA / GPO" is NOT the
  same as "official legal source." **Implementation constraint:** FedReg-derived
  outputs must preserve source/status metadata and should link or reconcile to
  GovInfo when legal authority matters — do NOT treat FedReg API data as legally
  authoritative the way GovInfo is.
- **GovInfo is the official legal-edition source**, US-Gov public-domain spec,
  api.data.gov `api_key` query param, `offsetMark`+`pageSize` pagination,
  documented 36,000/hr GPO tier (confirm per-key from the live
  `X-RateLimit-Limit` header) (https://www.govinfo.gov/features/api,
  https://github.com/usgpo/api, https://api.data.gov/docs/developer-manual/).

## In-Repo Capability Inventory

Verified by `ls`/`rg` against the working tree on 2026-06-29. **The repo already
owns the *primitives and precedents* this wedge composes — schema generation,
Effect HTTP, MCP server hosting, and package-private generated output are all in
place — but that is "good primitives, not the whole substrate."** At least three
rails are still net-new or unsettled and this packet owns them: (1) a shared
gov/legal HTTP-client transformer (auth + retry + cache + rate-limit), (2) an
operation→MCP-`Toolkit` generation strategy (or an explicit manual-toolkit
policy), and (3) a CI codegen drift/check gate. Those three are **align-stage
open questions** — appetite and sequencing must size the net-new work, not just
"implement five drivers on existing rails."

### Codegen precedent — three distinct Effect-native styles already shipping

- **`runpod` = bespoke renderer over a checked-in spec.** `packages/drivers/runpod/openapi.json`
  (151 KB, committed) + `packages/drivers/runpod/scripts/generate.ts` (decodes
  the spec through an effect/Schema `OpenApiDocument` model, string-renders
  `src/_generated/Runpod.generated.ts` with `S.Class` models, `LiteralKit`
  enums, per-operation request DTOs, a `RUNPOD_OPERATION_SPECS` table, and a
  typed `RunpodOperationsShape<E>` interface). The generated module is
  package-private (`"./_generated/*": null` in `packages/drivers/runpod/package.json`,
  confirmed) and the `generate` script reformats post-emit. This is the
  no-library-dep fallback for partial/non-conformant upstreams.
- **`acp` = library-driven + pinned remote-spec download.** `packages/drivers/acp/scripts/generate.ts`
  imports `make as makeJsonSchemaGenerator` from
  `@effect/openapi-generator/JsonSchemaGenerator`, downloads a pinned upstream
  release (`const CURRENT_SCHEMA_RELEASE = "v0.11.3"`, confirmed) over
  `FetchHttpClient`, and emits package-private `src/_generated/*`. This is the
  lowest-LOC path where a clean OpenAPI 3.x spec exists.
- **`box` = typed-SDK / `.d.ts`-declaration-driven generator.**
  `packages/drivers/box/scripts/generate.ts` parses `box-node-sdk`'s
  `node_modules/box-node-sdk/lib/**/*.d.ts` with the TypeScript compiler API
  (`sdkRoot`/`lib/client.d.ts`/`lib/managers/*.d.ts`, confirmed), emits
  package-private `src/_generated/Box.models.gen.ts` + `Box.operations.gen.ts`
  (effect/Schema models + generated operation groups), and feeds a hand-written
  `packages/drivers/box/src/Box.service.ts` (`Context.Service`) runner. This is a
  **third** style — materially different from runpod (bespoke renderer over a
  checked-in OpenAPI doc) and acp (`@effect/openapi-generator` over a downloaded
  spec): codegen driven by typed SDK *declarations*, not an OpenAPI document. It
  is the closest precedent if CourtListener or DOL expose a typed client surface
  or rich metadata but no clean OpenAPI (see the metadata spike in Genuine gaps).
- **`@effect/openapi-generator` is already a repo dependency, MIT, pinned
  `4.0.0-beta.91`** in the root catalog (`package.json:32`, confirmed) and
  consumed by `@beep/acp` (`packages/drivers/acp/package.json:86`, `catalog:`).
  Its `OpenApiGenerator.generate(spec, { format })` emits one of `"httpclient" |
  "httpclient-type-only" | "httpapi"`
  (`node_modules/@effect/openapi-generator/dist/OpenApiGenerator.d.ts:36`,
  confirmed) — the `"httpapi"` format aligns directly with govinfo's existing
  HttpApi contract. **No production Orval/axios/Zod exists** in the tree (`rg`
  over package.json deps returns only a test fixture under
  `packages/tooling/library/repo-utils/test/fixtures/mock-monorepo` — confirmed).
- **Hand-written transport is the boundary codegen does NOT cross.** runpod
  ships `packages/drivers/runpod/src/Runpod.service.ts` (on `effect/unstable/http`
  `HttpClient` + `FetchHttpClient`, with a `RunpodRawRequest` escape hatch for
  endpoints ahead of the checked-in spec) and `packages/drivers/runpod/src/Runpod.config.ts`
  (`apiKey` as `S.optionalKey(S.String.pipe(S.RedactedFromValue))`, never
  logged). Codegen emits Schema/descriptors; **auth + retry + cache + service
  wiring is hand-authored** — exactly the boundary the five gov drivers need.

### Driver state (the gap this wedge fills)

- **Four bare VERSION-only skeletons** (confirmed each `src/index.ts` exports
  only `export const VERSION = "0.0.0" as const`):
  `@beep/courtlistener`, `packages/drivers/ecfr`, `@beep/dol`,
  `@beep/federal-register`. These are net-new builds.
- **`packages/drivers/govinfo` is PARTIAL — domain-only, 27 src files, no
  transport** (confirmed: `find … -name '*.service.ts' -o '*.config.ts' -o
  '*.client.ts'` returns nothing). It has `S.Class` value models
  (`SearchResult`, `PackageInfo`, `GranuleMetadata`, `SearchBody`,
  `SearchResponse`, etc. under `src/domain/values/`) and one `Search` HttpApi
  contract (`src/domain/contracts/Search/{Search.contract.ts,Search.http.ts}` —
  `HttpApiEndpoint.post("search","/search",…)` from `effect/unstable/httpapi`,
  Failure as `S.toTaggedUnion` of bad-request/not-found/internal-error). "Finish
  govinfo" = tighten placeholder `/** change me */` annotations + **add the
  missing client/config/auth(api_key query)/retry/cache layer** on top of the
  existing Search contract. Do NOT restart. **Local integration gap to repair:**
  `packages/drivers/govinfo/src/domain/**` already imports `@beep/identity` (11
  hits) and `@beep/schema` (4 hits), but `packages/drivers/govinfo/package.json`
  declares only `effect` under dependencies — the finish work must add at least
  `@beep/identity` and `@beep/schema` (plus any transport/client deps the driver
  layer introduces) to the package manifest, not only add transport code.
- **`packages/drivers/uspto`** is hand-rolled (5 src files: `Uspto.service.ts`,
  `Uspto.config.ts`, `Uspto.errors.ts`, `Uspto.models.ts` — confirmed), already
  targets ODP `api.uspto.gov`, and already does Redacted header auth
  (`HttpClientRequest.setHeader(request, "X-API-KEY", Redacted.value(key))`). It
  is OUT of this cluster's scope (routes to `uspto-patent-driver-depth`) but is
  the canonical in-repo precedent for the auth/error shape the gov drivers copy.

### MCP server precedent — two Effect-native servers already exist

- **`packages/drivers/nlp-mcp`** (`src/Server.ts`, `StreamingTools.ts`,
  `StreamingHandlers.ts`, `bin.ts` — confirmed) and **`packages/drivers/m365-mcp`**
  (`src/Server.ts`, `M365Tools.ts`, `M365Handlers.ts`, `bin.ts` — confirmed)
  both build on `McpServer.toolkit(X).pipe(Layer.provide(Handlers),
  Layer.provide(McpServer.layerStdio({name,version})), Layer.orDie)`. **`nlp-mcp`
  already proves N-toolkits→one-server merge** via `Layer.mergeAll(...)` over one
  `layerStdio` — so a gov-legal MCP server is just `Layer.mergeAll(<keyless
  toolkits>, <Layer.unwrap key-gated toolkits>)`, purely additive. Both prove
  tool-naming casings: `Tool.make("Tokenize",…)` (nlp) and
  `Tool.make("m365_list_drives",…)` (m365, the per-driver-prefix pattern).
- **Shared HTTP-client primitives are all present in `effect@4.0.0-beta.91`**
  (confirmed pinned, `package.json:157`): `effect/unstable/http`
  (`FetchHttpClient`, `HttpClient.mapRequest`/`filterStatusOk`/`retryTransient`/
  `withRateLimiter`/`catchTag`, `HttpClientRequest.setHeader`/`bearerToken`),
  `effect/unstable/persistence/RateLimiter`, `effect/Cache`, `Redacted`,
  `Config.redacted`, and the `HttpApiClient.make(api, { transformClient })` seam
  — the single generalization point that lets one shared
  auth+retry+cache+rate-limit transformer serve both raw-client drivers and the
  govinfo HttpApi-client driver. Repo precedents for these in
  `packages/drivers/uspto/src/Uspto.service.ts` (Redacted header auth),
  `packages/drivers/m365/src/M365.service.ts` (Retry-After honoring + status→
  TaggedError), and `packages/foundation/capability/nlp/src/Backend/Composition.ts`
  (`effect/Cache` with capacity+TTL).

### Supporting schema/identity kit (reuse, do not rebuild)

- `@beep/identity` ($I composer: `$I.annote`/`$I.annoteSchema`), `@beep/schema`
  (`LiteralKit`, `TaggedErrorClass`, `HttpStatus2XX/4XX/5XX`), `@beep/utils`
  (`A`/`Str`/`Struct`/`R`/`O`/`P`). The runpod generator
  (`packages/drivers/runpod/scripts/generate.ts`) consumes all three; govinfo
  source currently imports only `@beep/identity` and `@beep/schema` — there is
  **no `@beep/utils` hit in `packages/drivers/govinfo/src`** (confirmed), so it
  may or may not need utils during transport implementation. Reuse what each
  driver actually needs; do not cargo-cult all three.

### Genuine gaps

- **NOT FOUND: a first-party OpenAPI→MCP-`Toolkit` generator.** `@effect/openapi-generator`
  emits SDK formats only (`httpclient`/`httpapi`); no evidence it emits an MCP
  `Toolkit`. The MCP target must be assembled separately (hand-written or a
  second small generator pass over the same parsed operations).
- **NOT FOUND: repo-wide `build → codegen` turbo edge.** `turbo.json` defines a
  `codegen` task (`"cache": false`, `"dependsOn": ["^codegen"]`) but the `build`
  task `dependsOn` is `["^build"]` only — it does NOT depend on `codegen`
  (confirmed at `turbo.json:30-34,143-147`). Determinism is currently enforced
  per-package via the generate-first audit convention + committed `_generated/`
  artifact, NOT a turbo edge. Wiring `build→codegen` (or keeping per-package
  audit + a `git diff --exit-code` drift check) is a net-new align decision.
- **NOT FOUND: full machine-readable OpenAPI for CourtListener and DOL** — but
  NOT a clean binary "OpenAPI or hand-author everything." CourtListener (DRF)
  exposes API-root/`OPTIONS` metadata and DOL v4 exposes per-dataset metadata
  endpoints; both are prior art for auto-seeding a schema/endpoint inventory.
  **Required pre-align research item:** prototype metadata extraction for the
  CourtListener API root/`OPTIONS` and DOL v4 dataset metadata, diff the emitted
  fields/statuses/pagination/auth against a hand-authored subset, then decide
  whether the generator consumes OpenAPI 3.x, Swagger 2.0, DRF metadata, DOL
  metadata, or a normalized intermediate operation model. The runpod
  `RunpodRawRequest` escape-hatch and the Box `.d.ts`-driven generator (above)
  generalize as fallbacks if the metadata proves too thin.
- **NOT FOUND: a committable GovInfo `openapi.json` file path** in `usgpo/api`
  (interactive docs + Postman collection only); confirm the exact downloadable
  artifact before wiring an acp-style `download` step.

## Constraints

### Deprecations & dated API changes

- **CourtListener rate-limit cliff (2026-05-07):** default authenticated quota
  cut to **50/hr, 5/min, 125/day** (was 5,000/hr); "≥1,000 lifetime requests"
  grandfather clause; full access now bundled with membership
  (https://free.law/2026/05/07/api-included-in-memberships/,
  https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview). v4.5 removed
  text-filter ops `contains`/`icontains`/`endswith`/`iendswith`; flat citation
  fields deprecated since v3.6. **V3 is legacy but has NO published sunset date**
  — re-check before assuming a cutoff. Target `/api/rest/v4/`.
- **CourtListener "anonymous = 401" (CAPTURE line 73) is DISPUTED.** The FLP wiki
  says "many of CourtListener's APIs are open by default" (lower unauthenticated
  rate limits) — conflicts with the CAPTURE caution. Per-endpoint
  auth-enforcement is UNVERIFIED and must be probed live with/without a token;
  it affects key-gated-vs-always-on MCP registration. The `Token` header format
  and base URL are consistent across sources.
- **CourtListener "SCOTUS / visualization endpoints deprecated" (CAPTURE line 73)
  is UNVERIFIED** — the change-log shows visualization APIs *introduced* in v3.10
  with no removal notice. Treat "do not generate them" as a design preference,
  not a documented deprecation, until confirmed against the live schema.
- **DOL:** legacy `developer.dol.gov` hub decommissioned (DNS ENOTFOUND
  2026-06-29); current API is v4 on `apiprod.dol.gov`; v4 defaults to XML unless
  sent `Accept: application/json`; up to 5 keys per account.
- **USPTO/PatentsView cliff (NOT in this cluster — flag for any sibling patents
  driver):** legacy PatentsView (`api.patentsview.org`) ended **2025-05-01** and
  now returns `410 Gone` (CAPTURE's "Feb 2025" was the original, extended date);
  PatentsView → USPTO Open Data Portal (`data.uspto.gov`) migration starts
  **2026-03-20** with **mandatory key reissue** (old keys incompatible); legacy
  USPTO Developer Hub decommissioned **2026-06-05**; ODP adds a four-field
  account requirement **2026-08-18**
  (https://patentsview.org/data-in-action/patentsview-ends-support-legacy-api,
  https://data.uspto.gov/support/transition-guide/patentsview). Any patents
  driver must be **ODP-only, NEVER PatentsView**.
- **Effect v4 beta churn:** `effect` + `@effect/openapi-generator` both pinned
  `4.0.0-beta.91`; `unstable/` modules (`http`, `ai/McpServer`, `cli`,
  `persistence/RateLimiter`) "may receive breaking changes in minor releases"
  (https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md). Pin exact
  versions in the codegen template; the acp generator already pins both upstream
  release and effect version.
- **`@effect/openapi-generator` `httpclient` format is lossy (open bug #1978):**
  keeps only the first JSON representation when a status has multiple, and
  emits only streaming variants for binary success. Validate generated SDKs
  against any endpoint returning both `application/problem+json` and
  `application/json` on the same status; fix pending in PR #1979
  (https://github.com/Effect-TS/effect-smol/issues/1978).

### Licensing gravity (reimplement-don't-copy is architectural, not legal)

- **Both donor repos are MIT** — verified via GitHub API:
  `beshkenadze/us-legal-tools` (https://github.com/beshkenadze/us-legal-tools)
  and `lzinga/us-gov-open-data-mcp` (https://github.com/lzinga/us-gov-open-data-mcp,
  Copyright (c) 2026 lzinga). **This overturns the CAPTURE caution that
  us-gov-open-data-mcp's license was "unverified."** Both are legally copyable
  with attribution — the "do not copy" constraint is **architectural** (the donor
  value is the *pipeline/pattern*, not the Orval/axios/Zod or plain-TS runtime;
  port onto Effect/`@effect/openapi-generator`/`effect/Schema`/`effect/unstable/httpapi`),
  reinforced by standing repo law to avoid Orval/axios/Zod.
- **AVOID vendoring or copying MPL-2.0** `fortanix/openapi-to-effect` source
  unless Legal accepts file-level MPL obligations. MPL-2.0 is *file-level* weak
  copyleft — using the package, vendoring unmodified files, modifying MPL files,
  and copying snippets each carry different obligations, so "taint the MIT
  surface" overstates it; dependency or CLI use needs separate review. Keep the
  first-party MIT `@effect/openapi-generator` as the preferred path.
- **GovInfo / eCFR / Federal Register specs are US-Government works (17 U.S.C.
  105 + CC0 1.0 for `usgpo/api`) — public domain, freely committable** into the
  repo (https://raw.githubusercontent.com/usgpo/api/main/LICENSE.md). DOL's
  DOLAPI repos are likewise US-Gov works. CourtListener/DOL have no committable
  OpenAPI, so any hand-authored spec is original repo work.
- **Code/spec licensing ≠ data/API-use terms — the latter is still OPEN.** The
  analysis above clears *code and spec* licenses; it does NOT clear *data and
  API-use* terms. CourtListener is not a U.S.-Government publisher, may expose
  PACER/RECAP-sourced opinions, dockets, and documents, and the proposed shared
  client adds caching. Whether cached CourtListener content, citation-lookup
  results, opinions, docket entries, or documents may be stored, redistributed,
  used commercially, or shipped in fixtures is **unanswered**. **Required before
  shape:** a per-upstream data/source-terms matrix — data license, API terms of
  use, commercial-use limits, caching/retention permission, redistribution/fixture
  rules, attribution requirements, and source-of-authority caveat (esp. FedReg
  prototype vs. GovInfo legal edition, above). **Default until verified:**
  CourtListener caching is in-process/ephemeral only, and third-party legal
  content is excluded from committed fixtures.

### Locked decisions / cautions from the routing record

- **Use the repo's own Effect codegen path; do NOT introduce Orval/axios/Zod** —
  reuse the runpod (bespoke renderer) / acp (`@effect/openapi-generator`)
  precedent. (CAPTURE alreadyCovered; tree-snapshot "Codegen precedent.")
- **Finish `@beep/govinfo`, do not restart** — its Search HttpApi contract +
  value models are already scaffolded and reused. (CAPTURE alreadyCovered.)
- **Static official-dataset sync (ISO4217/IANA/CLDR) is owned by
  `goals/official-data-sync-foundation` — out of scope, do not rebuild.**
  (CAPTURE alreadyCovered; tree-snapshot.)
- **`packages/drivers/uspto` extends in place → `uspto-patent-driver-depth`; do
  NOT restart it, do NOT add `generate.ts` blindly, ODP-only.** (tree-snapshot.)
- **MCP target is "patterns, not a 3rd server"** per the tree-snapshot — whether
  the gov toolkits merge into one new `gov-legal-mcp` bin (following the
  `nlp-mcp` template) or attach to an existing server is an **align-stage
  decision**, not settled here.
- **CourtListener citation-lookup** also routes to a sibling exploration
  (`citation-grounding-hallucination-guard`); this packet owns the driver/client,
  not the hallucination-guard layer. (tree-snapshot.)

### Auth / secret / offline boundaries

- **Three auth families, not two:** Token-header (CourtListener), api.data.gov
  query key (GovInfo), agency-native `X-API-KEY` (DOL) — the env-auth matrix
  needs a third branch (CAPTURE line 74 conflated DOL with api.data.gov).
- **Secrets via `Redacted` only** — `Config.redacted("ENV")` per driver; absent
  key → omit auth gracefully (keyless eCFR/FedReg always-on). Proposed env vars:
  `COURTLISTENER_API_TOKEN`, `DOL_API_KEY`, `GOVINFO_API_KEY`. Never log raw
  keys (runpod/uspto `RedactedFromValue` precedent).
- **Offline build/check law:** "Root `codegen` wiring may invoke the package
  generator, but build/check must remain offline" (`packages/drivers/acp/AGENTS.md`).
  The acp `--skip-download` flag and runpod's checked-in spec both honor this —
  download is a codegen-only step; the committed spec + `_generated/` artifact
  make build/check network-free.
- **MCP stdio purity:** anything on stdout that isn't JSON-RPC corrupts the
  stream — `layerStdio` routes logs to stderr; generated handlers must never
  `console.log` to stdout
  (https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md).
- **Spec-drift escape hatch:** a checked-in `openapi.json` lags the live API;
  plan a per-driver raw-request path (runpod `RunpodRawRequest`) and a CI
  `git diff --exit-code` drift check on re-run of `generate`.

_Codex gate-1 folded 2026-06-29: 5 blocking + 7 advisory addressed._

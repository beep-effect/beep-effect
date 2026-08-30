# api-docs lab — design

One local app hosting docs UIs for every HttpApi contract and committed OpenAPI
spec in the repo. Dev URL: `http://api-docs.labs.beep.localhost:1355`.

Decisions locked 2026-08-26 (grill session): audience = dev browsing of
everything, tagged `served` vs `consumed`; home = this lab; transport = hybrid
catalog (contract entries + spec-file entries); v1 coverage below.

## Proven mechanics (runtime-verified on effect 4.0.0-rc.112)

- `HttpApiScalar.layer(api, { path })` is `Layer<never, never, HttpRouter>`.
  It serves a Scalar UI for the HttpApi DEFINITION with zero handler
  implementations. `HttpApiBuilder` is only for real traffic; never needed here.
- `OpenApi.fromApi(api)` is a pure sync function `HttpApi -> OpenAPISpec`
  (memoized). Use it for raw `openapi.json` routes.
- rc.112 inlines the spec into the Scalar HTML (~3.1MB page, bundled JS, no CDN
  fetch). No separate spec route is registered by the layer; we add our own.
- Committed-spec pages serve the installed Effect runtime's embedded Scalar
  bundle from a versioned same-origin `/assets/scalar-api-reference-<version>.js`
  route. Their CSP is `script-src 'self'`; CDN scripts are not permitted. Effect
  upgrades must revalidate the internal embedded-module path, the Scalar version,
  the public asset path, and their pinned route regression together.
- Boot pattern (already in `src/main.ts`, keep it): route layers require
  `HttpRouter`; `HttpRouter.serve(App)` provides the router; provide
  `BunHttpServer.layer`; `BunRuntime.runMain(Layer.launch(...))`.
- **Do NOT use `api.prefix`.** We serve no real traffic, so route collisions
  between APIs cannot happen, and prefixing would corrupt the documented paths
  (e.g. eCFR's spec must show ecfr.gov paths, the collector's must show
  `/events`, not `/apis/qa-collector/events`). Only OUR page/spec routes carry
  the `/apis/<slug>/` namespace.

## Route map

| Route | What |
| --- | --- |
| `GET /` | index page: catalog grouped `served` / `consumed`, links to docs + raw spec |
| `GET /health` | scaffold health endpoint (keep as-is) |
| `GET /apis/<slug>/docs` | docs UI. Contract entry: `HttpApiScalar.layer(api, { path })`. Spec entry: hand-rolled HTML loading the installed, version-pinned Scalar asset from the same origin, with `data-url` pointing at our spec route and a self-only script CSP. JSON-Schema dialect entries get no docs page (raw link only). |
| `GET /assets/scalar-api-reference-<version>.js` | immutable same-origin Scalar bundle extracted from Effect's installed embedded Scalar module. The route version and regression test must move together on upgrade. |
| `GET /apis/<slug>/openapi.json` (or `.yaml`) | raw spec. Contract entry: `HttpServerResponse.jsonUnsafe(OpenApi.fromApi(api))`. Spec entry: file bytes with correct content type, read per request (fresh on every reload; no caching). |

## Files (all under `src/`)

- `Catalog.models.ts` — schemas first:
  - `ApiAudience` via `LiteralKit`: `"served" | "consumed"`.
  - `SpecDialect` via `LiteralKit`: reuse codegen-kit's dialect domain if it is
    exported publicly (search `@beep/codegen-kit` first — Discovery & Reuse
    law); else lab-local: `"swagger-2.0" | "openapi-3.0" | "openapi-3.1" |
    "json-schema-2020-12"`. Add a separate content-format flag or literal for
    yaml vs json rather than inventing a fake dialect.
  - `CatalogSlug` — branded kebab-case string (`S.String` + pattern check).
  - `CatalogEntryMeta` — `S.Class`: slug, title, description, audience.
  - Source union (NOT a schema — it carries an `HttpApi` value):
    tagged union `ContractSource { api: HttpApi.Any } | SpecSource { specPath,
    dialect, format }`. Use `Data.taggedEnum` or a plain tagged union with a
    `Match`-based fold — match helpers over conditional chains (repo law).
- `Catalog.ts` — the catalog value (see table below). Spec paths are
  repo-root-relative; resolve the repo root from `import.meta` (this file lives
  at `apps/labs/api-docs/src/`, so root is four dirs up) via the Path service,
  never from cwd.
- `Docs.routes.ts` — fold `CatalogEntry -> Layer` (Scalar layer + spec route
  for contract entries; same-origin embed page + file route for spec entries),
  serve the pinned installed Scalar asset with a self-only script CSP, and add
  the index route. Merge with `Layer.mergeAll`.
- `runtime/Layer.ts` — keep the health `ApiLive`, merge in the catalog layers.
- `test/` — keep health test; add: catalog invariants (slugs unique, spec files
  exist on disk, every contract entry's `OpenApi.fromApi` succeeds — this is a
  cheap, high-value drift test).

## v1 catalog

Contract entries (import the definition module, never the package barrel — the
qa-capture and ecfr barrels drag Bun-only / live-client baggage):

| slug | audience | import | api value |
| --- | --- | --- | --- |
| `pacer-pcl` | consumed | `@beep/pacer/Pcl.api` | `PclHttpApi` |
| `govinfo-search` | consumed | `@beep/govinfo/domain/contracts/Api` | `GovinfoApi` |
| `qa-collector` | served | `@beep/qa-capture/Collector.api` | `QaCollectorApi` |
| `ecfr` | consumed | `@beep/ecfr/contract` (new subpath, lane 1) | `EcfrApi` |

Spec entries (committed files, served as-is):

| slug | audience | path | dialect/format |
| --- | --- | --- | --- |
| `govinfo-full` | consumed | `packages/drivers/govinfo/openapi.json` | openapi-3.0, json |
| `runpod` | consumed | `packages/drivers/runpod/openapi.json` | openapi-3.0, json (pre-patch source; say so in description) |
| `ecfr-source` | consumed | `packages/drivers/ecfr/openapi.json` | swagger-2.0, json (hand-maintained source of the `ecfr` contract entry — description should say "compare with /apis/ecfr/docs") |
| `acp` | consumed | `packages/drivers/acp/spec/schema.unstable.json` | json-schema-2020-12 — raw link only, NO Scalar page (Scalar renders OpenAPI, not bare JSON Schema) |
| `venice-ai` | consumed | `packages/drivers/venice-ai/swagger.yaml` | read the file's `openapi:`/`swagger:` field to pick the dialect; yaml format |

Deferred by decision: oip-web contact (apps publish no API); govinfo generated
oracle stays private (`govinfo-full` spec covers it).

## Index page

Server-rendered HTML string, no framework, no external assets. Scalar on embed
pages is served from the versioned same-origin asset route. Two sections:
"APIs we serve" and "APIs we consume". Each row: title, slug, description,
links to docs UI + raw spec.
Style: minimal inline CSS, dark background with green accents (repo taste),
readable without JS.

## Laws checklist for the implementer

- Effect v4 only; validate any API against `.repos/effect` or existing repo
  usage before writing it — never from priors. `effect/unstable/http` /
  `effect/unstable/httpapi` only, never `node:http`.
- `Effect.fn` / `Effect.fnUntraced` for generator-returning functions.
- `HashMap`/`HashSet` (or their Mutable variants) — never native `Map`/`Set`.
- `LiteralKit` for literal unions; no `as const` on inline arrays passed to it.
- Match helpers over conditional chains.
- Design order inside the code too: models file first, then route services.
- This lab publishes no exports (see CLAUDE.md); keep everything app-local.
- New workspace deps: `@beep/pacer`, `@beep/govinfo`, `@beep/qa-capture`,
  `@beep/ecfr` (`workspace:^`). Mirror how sibling labs wire tsconfig
  package-references (check `apps/labs/semantica`); rerun `bun install`.
- Dev servers only via the portless script. For one-shot boot verification,
  `PORTLESS=0 PORT=<port> bun src/main.ts` is the allowed diagnostic bypass;
  verify death by port probe, not pgrep (pkill self-match gotcha).

## Verification bar (before reporting done)

1. `bun run check`, `bun run test`, `bun run lint` green in this app.
2. Touched driver packages typecheck green.
3. Boot via the diagnostic bypass; curl and confirm: `/` lists all 9 entries;
   `/apis/qa-collector/docs` returns Scalar HTML; `/apis/qa-collector/openapi.json`
   is valid JSON with the collector paths un-prefixed; `/apis/govinfo-full/openapi.json`
   serves the committed file; `/apis/venice-ai/docs` returns the self-only CSP
   embed page and loads the installed version-pinned Scalar asset from the same origin;
   `/apis/acp/openapi.json` serves the JSON Schema and no acp docs page exists.

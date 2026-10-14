# conditional-credential-keyed-toolkit-composition

Scope: How to build an `effect/ai` Toolkit/MCP surface from only the driver Layers whose Effect `Config` resolved (CourtListener optional vs USPTO/GovInfo/DOL keyed), the Effect-idiomatic conditional-inclusion shape, and whether it works without re-scaffolding the two existing beep MCP servers.

## Findings

### The Effect AI Toolkit/MCP primitives (primary source: installed `effect@4.0.0-beta.91`)

- The repo runs **`effect@4.0.0-beta.91`** and both MCP drivers import from `effect/ai` (not `@effect/ai`). Verified: `node_modules/effect/package.json` (`"version": "4.0.0-beta.91"`) and `packages/drivers/m365-mcp/src/M365Tools.ts` / `packages/drivers/nlp-mcp/src/StreamingTools.ts` both `import { Tool, Toolkit } from "effect/ai"`. Source of all API claims below: `node_modules/effect/src/ai/Toolkit.ts` and `.../McpServer.ts` (vendored source, authoritative for this version).

- **`Toolkit.make(...tools)`** is the primary constructor (variadic array of `Tool.make` defs → `Toolkit<ToolsByName<Tools>>`). **`Toolkit.merge(...toolkits)`** combines tools from multiple toolkits into one; later toolkits override on name conflict; **`Toolkit.empty`** is documented as "a default toolkit value that can be extended with `merge`." At runtime `merge` is just a loop over `toolkit.tools` (so a dynamically-built list works), but its *type* `MergedTools<Toolkits>` requires the toolkits to be statically known to stay fully typed. Source: `node_modules/effect/src/ai/Toolkit.ts` L437-554.

- A `Toolkit` is itself an `Effect<WithHandler<Tools>, never, Tool.HandlersFor<Tools>>`; handlers are attached via **`toolkit.toLayer(handlers)` → `Layer<Tool.HandlersFor<Tools>, EX, …>`** (or `toHandlers`). Handler context is keyed by **`tool.id`** (`context.set(tool.id, …)`), so each toolkit must have its own handlers provided. Source: `Toolkit.ts` L60-99, L384-404.

- **`McpServer.toolkit(tk)` returns a `Layer<never, never, Tool.HandlersFor<Tools> | …>`** — it registers each tool of `tk` into a memoized `McpServer` (`Layer.effectDiscard(registerToolkit(tk)).pipe(Layer.provide(McpServer.layer))`). `registerToolkit` reads each tool's annotations (`Tool.Readonly/Destructive/Idempotent/OpenWorld`, `Tool.Title`, `Tool.Meta`) onto the MCP `annotations`. `McpServer.layerStdio({name,version})` provides the stdio transport (`Layer<McpServer | McpServerClient, never, Stdio>`). Source: `McpServer.ts` L627-635, L673-758.

### How the two existing beep servers already compose (in-repo, no web)

- `@beep/nlp-mcp` already **mounts two toolkits into one server by merging their `McpServer.toolkit(...)` layers**, not by merging the toolkits: `Layer.mergeAll(McpServer.toolkit(NlpToolkit).pipe(Layer.provide(WinkNlpToolkitLive)), McpServer.toolkit(StreamingToolkit).pipe(Layer.provide(StreamingToolkitHandlersLive))).pipe(Layer.provide(McpServer.layerStdio(...)), Layer.orDie)`. Source: `packages/drivers/nlp-mcp/src/Server.ts` L101-107. `@beep/m365-mcp` uses the single-toolkit variant. Source: `packages/drivers/m365-mcp/src/Server.ts` L45-55. **Conditional, credential-keyed composition slots into exactly this seam — the `Layer.mergeAll(...)` argument list — so neither server's `Tool.make` defs, handler layers, nor `McpServer.toolkit`/`layerStdio` scaffold change. No re-scaffolding required.**

- Tool annotation hints (netNew #5) are already wired the canonical way: `M365Tools.ts` chains `.annotate(Tool.Readonly, true).annotate(Tool.Destructive, false).annotate(Tool.Idempotent, true).annotate(Tool.OpenWorld, true)` and `registerToolkit` propagates them to MCP `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`. Source: `packages/drivers/m365-mcp/src/M365Tools.ts` L100-103; `McpServer.ts` L696-705.

### Config gating: the repo already does capability-gated drivers

- The repo's canonical optional-credential idiom is **`Config.redacted("X_API_KEY").pipe(Config.option)`** + **`Config.string(...).pipe(Config.withDefault(default))`**, used across `phoenix`, `sanity`, `hubspot`, `runpod`, `xai`, `m365`, and `uspto`. Source: `rg "Config\.(redacted|option|withDefault)" packages/drivers` (e.g. `packages/drivers/uspto/src/Uspto.service.ts` L398-399, `packages/drivers/m365/src/M365.service.ts` L951-958).

- `@beep/uspto` is **already built key-optional**: its layer resolves `apiKey: O.Option<Redacted>` and only sets the `X-API-KEY` header when present (`O.match(config.apiKey, …)`), with `USPTO_API_URL = "https://api.uspto.gov"` (ODP, not PatentsView). This is the in-repo precedent for "driver self-gates on credential availability." Source: `packages/drivers/uspto/src/Uspto.service.ts` L198-253, L398-399; `packages/drivers/uspto/src/Uspto.config.ts` L26.

### The Effect-idiomatic conditional-composition shapes (the decision)

- **`Config.option(self): Config<Option<A>>`** returns `None` when the var is missing (never fails); **`Config.withDefault`/`Config.orElse`** supply fallbacks. So availability can be computed without throwing. Source: `node_modules/effect/src/Config.ts` (`export const option = …`, `orElse`, `withDefault`); also Effect docs <https://effect.website/docs/configuration/>.

- **GOTCHA / deprecation:** **`Layer.orElse` does NOT exist in effect v4 (beta.91).** The fallback combinators are **`Layer.catch(onError)`**, **`Layer.catchTag("ConfigError", …)`**, and **`Layer.catchCause(…)`** (all `@since 4.0.0`). Source: `node_modules/effect/src/Layer.ts` L3192-3258, L3433+. Web results citing `Layer.orElse` (<https://effect-ts.github.io/effect/effect/Layer.ts.html>) are **v3 docs — do not use that name here**.

- **Shape A — centralized build-time availability matrix (RECOMMENDED for `getAvailableSources`/`check-api-status`).** Wrap the merge in `Layer.unwrap(Effect.gen(...))`, read each key via `Config.option(Config.redacted(...))`, and include a driver's `McpServer.toolkit(tk).pipe(Layer.provide(handlersLive))` sub-layer only when `Option.isSome`. This both gates registration *and* yields the `ApiStatus[]` availability matrix (the absorbed `patents-mcp-server#12` `getAvailableSources` pattern) for a health/status tool. `Layer.unwrap: Effect<Layer<A,E1,R1>,E,R> → Layer<A, E|E1, R1|Exclude<R,Scope>>`. Source: `Layer.ts` L1498-1503.

- **Shape B — per-driver "disappear on missing key."** Make the driver's registration sub-layer read its `Config` at **build time** so a missing key surfaces a `ConfigError` in the *layer error channel*, then `…​.pipe(Layer.catch(() => Layer.empty))` drops it (`Layer.catch` returns `Layer<ROut & ROut2, …>`; `never & never = never`, so the tool is simply not registered). Decentralized, simplest types. Source: `Layer.ts` L3192-3209, `Layer.empty` L1095.

- **Shape C — always-register + call-time graceful `api_key_required` (mcp-uspto#2; netNew #3).** Register unconditionally; the handler reads `Config.option` at **call time** and returns structured `{error:"api_key_required", tool, envVar, registration}` content rather than failing. This is what `@beep/uspto` already approximates with `O.match(apiKey,…)`, and it is the better fit for *discoverability* (the tool stays on the surface) and for the optional/degraded CourtListener case.

- **CRITICAL distinction:** Config gating only *removes* a tool if the key is read at **layer-build time** (Shapes A/B). `toolkit.toLayer(handlers)` handlers read Config at **call time**, so a missing key there does **not** drop the tool — it errors (or returns `api_key_required`) on invocation (Shape C). Choose build-time read for "tool disappears," call-time read for "tool present, graceful error." Source: handler execution path `Toolkit.ts` L260-374 (handlers run inside `handle`, i.e. per-call).

- **`Layer.mergeAll` requires a non-empty tuple `[Layer<never,…>, ...]`**; a dynamically-built `Array<Layer>` won't satisfy that type. Fold instead: `layers.reduce((acc, l) => Layer.merge(acc, l), Layer.empty)` — `Layer.merge` is the dual binary form and also has an overload `(self, that: [Any, ...Array<Any>])` for one-layer-plus-array. Since every `McpServer.toolkit(...)` layer has `ROut = never`, the fold stays `Layer<never, E, R-union>`. Source: `Layer.ts` L1566 (`mergeAll`), L1184/L1140 overloads (`merge` array form), L1095 (`empty`).

- **Verdict:** effect Toolkit composition fully supports per-`Config` inclusion. Recommended blend: **public/optional drivers (CourtListener) always-registered with Shape C graceful degradation; hard-keyed drivers (USPTO ODP / GovInfo / DOL) either Shape A (centralized, powers the status matrix) or Shape B (per-driver disappear)** — implemented purely by changing the `Layer.mergeAll(...)` arguments inside a new gov-legal MCP `makeServerLayer`, reusing the nlp-mcp seam verbatim. MCP also supports *runtime* re-gating via `notifications/tools/list_changed` (<https://github.com/modelcontextprotocol/typescript-sdk>), but boot-time layer composition (static surface) is the right fit for stdio/solo-firm.

### External auth / availability current state (the "public vs keyed" matrix, 2026)

- **USPTO ODP (`api.uspto.gov`): keyed.** ODP/PTAB endpoints return **403 without an Open Data Portal API key** (`X-API-KEY`). **PatentsView shut down 2026-03-20** (data migrated to ODP bulk datasets); the **Office Action and Enriched Citation APIs were decommissioned in early 2026** — corroborates the CAPTURE sunset caution and the repo's ODP-only target. Source: <https://github.com/riemannzeta/patent_mcp_server> README; lzinga summary above.

- **GovInfo: keyed.** "An api.data.gov key is required to use the govinfo API"; `DEMO_KEY` works only for low-rate exploration. Source: <https://www.govinfo.gov/features/api>, <https://api.data.gov/docs/developer-manual/>.

- **DOL: catalog open, data keyed.** `apiprod.dol.gov/v4/datasets` (dataset catalog) is reachable without a key, but data endpoints require an `X-API-KEY` (`DOL_API_KEY`) obtained via `dataportal.dol.gov/registration`. Source: <https://developer.dol.gov/beginners-guide/>, <https://www.dataportal.dol.gov/pdf/dol-api-user-guide.pdf>.

- **CourtListener v4: CONFLICTING / in-flux — treat as optionally-keyed + degraded.** The wiki overview still says "many of our APIs are open by default" and demonstrates anonymous calls succeeding (no hard 401), with authenticated limits of 5/min, 50/hr, 125/day. But 2026 sources report anonymous requests now returning **401** and a **default 5 req/min** anonymous/default-token cap, with **full API access folded into paid membership since 2026-05-07**. Sources: <https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview> vs <https://free.law/2026/05/07/api-included-in-memberships/> and the v4 changes log <https://www.courtlistener.com/help/api/rest/changes/>. **Design implication:** do not hard-code CourtListener as "no-auth public"; model it as optional-token with graceful degradation (Shape C), which is robust to the tightening.

### Licensing (port-source provenance)

- **`riemannzeta/patent_mcp_server` (patents-mcp anchor): MIT** — portable. Verified `gh api repos/riemannzeta/patent_mcp_server → spdx_id MIT`.
- **`lzinga/us-gov-open-data-mcp` (module-auto-discovery + 18-no-key matrix anchor): MIT** — portable; the CAPTURE did not record its license, this fills that gap. Verified `gh api repos/lzinga/us-gov-open-data-mcp → spdx_id MIT`.
- patents-mcp-server (TS, `registerAllTools`/`epoConsumerKey`), `mcp-uspto`, `uspto_pfw_mcp`: CAPTURE records MIT; not independently re-verified here (see Open/Unverified).

## Sources

- `node_modules/effect/src/ai/Toolkit.ts` (effect@4.0.0-beta.91, vendored — `make`, `merge`, `empty`, `toLayer`, handler-by-`tool.id`, per-call `handle`)
- `node_modules/effect/src/ai/McpServer.ts` (`toolkit`, `registerToolkit`, `layerStdio`, annotation propagation)
- `node_modules/effect/src/Layer.ts` (`unwrap` L1498, `catch`/`catchTag`/`catchCause` L3192-3558, `merge`/`mergeAll`/`empty`)
- `node_modules/effect/src/Config.ts` (`option`, `orElse`, `withDefault`, `redacted`)
- `packages/drivers/nlp-mcp/src/Server.ts`, `packages/drivers/m365-mcp/src/Server.ts` + `M365Tools.ts` (in-repo composition + annotation precedent)
- `packages/drivers/uspto/src/{Uspto.service.ts,Uspto.config.ts}` (key-optional driver precedent, ODP base URL)
- https://effect.website/docs/configuration/ — Config / Config.option semantics
- https://effect-ts.github.io/effect/effect/Layer.ts.html — v3 `Layer.orElse` (deprecated-name reference, do-not-use)
- https://github.com/riemannzeta/patent_mcp_server — ODP 403-without-key, PatentsView/OA/Citation sunset, MIT
- https://github.com/lzinga/us-gov-open-data-mcp — module auto-discovery, 18-no-key sources, MIT
- https://www.govinfo.gov/features/api + https://api.data.gov/docs/developer-manual/ — GovInfo/api.data.gov key requirement, DEMO_KEY
- https://developer.dol.gov/beginners-guide/ + https://www.dataportal.dol.gov/pdf/dol-api-user-guide.pdf — DOL key, catalog-open/data-keyed, X-API-KEY
- https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview + https://free.law/2026/05/07/api-included-in-memberships/ + https://www.courtlistener.com/help/api/rest/changes/ — CourtListener auth (conflicting)
- https://github.com/modelcontextprotocol/typescript-sdk — `notifications/tools/list_changed` runtime tool discovery

## Open / Unverified

- **CourtListener auth is genuinely contradictory across sources (2026).** Wiki "open by default" vs blog/changelog "anonymous 401 + membership-gated." Resolve before locking CourtListener's gating tier; current recommendation (optional-token + graceful degradation) is deliberately robust to either outcome. UNVERIFIED which is live as of 2026-06-29.
- **The TS `patents-mcp-server` (`src/tools/index.ts` `registerAllTools`, `src/lib/config.ts` `getAvailableSources`, `epoConsumerKey`/`epoConsumerSecret`) could not be relocated** via `gh search code` (returned empty — likely auth-scope/rate limited). Its MIT license and the exact `registerAllTools` body are taken from the CAPTURE catalog, **not re-verified** here. Confirm the repo identity + LICENSE before porting (it is distinct from the Python `riemannzeta/patent_mcp_server`, which is MIT-verified).
- **`mcp-uspto` and `uspto_pfw_mcp` licenses** asserted MIT in CAPTURE; not independently re-checked in this pass.
- **lzinga lists USPTO as a "no-key" source** while riemannzeta reports ODP 403-without-key — these target *different* USPTO endpoints (Patent Public Search vs ODP/PTAB). The beep `@beep/uspto` driver targets ODP (`api.uspto.gov`, keyed). UNVERIFIED whether any ODP path is usable key-less; assume keyed.
- `Toolkit.merge` over a **dynamically-built** array works at runtime but loses static `MergedTools` typing; the layer-level fold (`reduce`+`Layer.merge`/`Layer.empty`) is preferred for the conditional case. Not yet exercised in repo — needs a small dtslint/spike to confirm inferred requirements union is clean.

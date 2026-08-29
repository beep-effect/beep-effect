# Gov Legal MCP P0 Contract and Naming Audit

Date: 2026-07-31

Phase: P0 audit only

Verdict: **STOP CONDITION NOT TRIGGERED; P1 may proceed under the frozen contract below.**

The SPEC stops P1 when a driver lacks a public schema/operation surface, the installed Effect MCP API has decision-invalidating drift, or the naming/report contract cannot be made deterministic (`goals/gov-legal-mcp/SPEC.md:101-109`). Neither driver is blocked: GovInfo publicly exposes its sole search endpoint, request/success contracts, and service method (`packages/drivers/govinfo/src/domain/contracts/Search/Search.http.ts:27-31`; `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts:44-90`; `packages/drivers/govinfo/src/Govinfo.service.ts:63-66`), while eCFR publicly re-exports its generated descriptors/responses and service parameter schemas (`packages/drivers/ecfr/src/index.ts:7-34`; `packages/drivers/ecfr/src/Ecfr.service.ts:69-268`). Effect moved the audited internals from the beta.92 line locations but retained the relevant behavior at beta.102 (section 4). Section 6 freezes a deterministic, fail-closed naming/report algorithm.

This audit treats current public barrels as authoritative, as required by P0 (`goals/gov-legal-mcp/PLAN.md:25-28`). It does not infer operation coverage from the historical exploration map, whose current-driver gate explicitly requires a fresh source audit (`explorations/gov-legal-data-driver-codegen/MAP.md:13-22`).

## 1. Live driver export inventory

### 1.1 `@beep/govinfo`

#### Public boundary and complete operation surface

The root barrel exports the domain barrel, config, errors, and service (`packages/drivers/govinfo/src/index.ts:16-37`); the package exposes the root and one-level source modules (`packages/drivers/govinfo/package.json:38-43`). The domain barrel exports contracts and values (`packages/drivers/govinfo/src/domain/index.ts:9-24`).

| Surface | Complete public members | Evidence |
| --- | --- | --- |
| Service | `Govinfo.search(payload: Search.Payload): Effect<Search.Success, GovinfoError>` and diagnostic `Govinfo.rateLimit: Effect<Option<RateLimitSnapshot>>` | `packages/drivers/govinfo/src/Govinfo.service.ts:63-66` |
| HttpApi | `Search.Http`: `POST` endpoint identifier `search`, path `/search`, payload `Search.Payload`, success `Search.Success` with status 200, failure `Search.Failure` | `packages/drivers/govinfo/src/domain/contracts/Search/Search.http.ts:27-31` |
| Api assembly | `GovinfoApiGroup` is top-level group `govinfo` containing `Search.Http`; `GovinfoApi` is API `govinfo` containing that group | `packages/drivers/govinfo/src/domain/contracts/Api.ts:13-44` |
| Search contracts | `Search.Payload`, `Search.Success`, `Search.FailureBadRequest`, `Search.FailureNotFound`, `Search.FailureInternalServerError`, and union `Search.Failure` | `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts:44-90`; `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts:110-220` |
| Operation descriptors | None. The endpoint identifier `search` is the only public operation identity; there is no descriptor registry analogous to `ECFR_OPERATIONS`. | `packages/drivers/govinfo/src/domain/contracts/index.ts:9-24`; `packages/drivers/govinfo/src/domain/contracts/Search/Search.http.ts:27-31` |

The implementation confirms that `search` is not a façade over undisclosed public operations: it creates the `GovinfoApi` client and its cache lookup invokes only `client.search({ payload })` (`packages/drivers/govinfo/src/Govinfo.service.ts:112-135`). Collection, granule, and package schemas are data models, not callable service methods (`packages/drivers/govinfo/src/Govinfo.service.ts:63-66`).

#### Complete public value/error/config surface

The public values barrel exports these value families: `CollectionContainer`, `CollectionSummary`, `GranuleContainer`, `GranuleMetadata`, `PackageInfo`, `SearchBody`, `SearchResult`, `SortBase`, `SortASC`, `SortDESC`, `Sort`, and `SummaryItem` (`packages/drivers/govinfo/src/domain/values/index.ts:11-79`; `packages/drivers/govinfo/src/domain/values/CollectionContainer/CollectionContainer.model.ts:48-84`; `packages/drivers/govinfo/src/domain/values/CollectionSummary/CollectionSummary.model.ts:36-66`; `packages/drivers/govinfo/src/domain/values/GranuleContainer/GranuleContainer.model.ts:51-96`; `packages/drivers/govinfo/src/domain/values/GranuleMetadata/GranuleMetadata.model.ts:51-81`; `packages/drivers/govinfo/src/domain/values/PackageInfo/PackageInfo.model.ts:40-75`; `packages/drivers/govinfo/src/domain/values/SearchBody/SearchBody.model.ts:43-67`; `packages/drivers/govinfo/src/domain/values/SearchResult/SearchResult.model.ts:47-97`; `packages/drivers/govinfo/src/domain/values/Sort/Sort.model.ts:36-45`; `packages/drivers/govinfo/src/domain/values/Sort/Sort.model.ts:104-113`; `packages/drivers/govinfo/src/domain/values/Sort/Sort.model.ts:177-186`; `packages/drivers/govinfo/src/domain/values/Sort/Sort.model.ts:246-269`; `packages/drivers/govinfo/src/domain/values/SummaryItem/SummaryItem.model.ts:38-65`).

The root error surface is `GovinfoErrorReason`, `GovinfoHttpStatus`, `GovinfoErrorOptions`, and `GovinfoError` (`packages/drivers/govinfo/src/Govinfo.errors.ts:28-54`; `packages/drivers/govinfo/src/Govinfo.errors.ts:71-93`; `packages/drivers/govinfo/src/Govinfo.errors.ts:110-179`).

The public config constants are `GOVINFO_API_URL = "https://api.govinfo.gov"`, query parameter `GOVINFO_API_KEY_PARAM = "api_key"`, credential variable `GOVINFO_API_KEY_ENV = "GOVINFO_API_KEY"`, request budget `GOVINFO_RATE_LIMIT = 1000`, window `GOVINFO_RATE_LIMIT_WINDOW = "1 hour"`, and cache TTL `GOVINFO_CACHE_TTL = "5 minutes"` (`packages/drivers/govinfo/src/Govinfo.config.ts:27-102`). `GovinfoConfigInput` accepts an optional redacted string key with a `None` default and a defaulted API URL (`packages/drivers/govinfo/src/Govinfo.config.ts:121-136`). The live environment layer reads the exact optional-secret shape `Config.redacted(GOVINFO_API_KEY_ENV).pipe(Config.option)` and `GOVINFO_API_URL` through `Config.string(...).pipe(Config.withDefault(...))` (`packages/drivers/govinfo/src/Govinfo.service.ts:138-142`).

#### Deterministic projection inputs and export gaps

P1 shall project the one GovInfo tool from public `Search.Http`, `Search.Payload`, `Search.Success`, and `Govinfo.search`; these provide a stable endpoint identity, wire input/output schemas, and runtime operation (`packages/drivers/govinfo/src/domain/contracts/Search/Search.http.ts:27-31`; `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts:44-90`; `packages/drivers/govinfo/src/Govinfo.service.ts:124-135`). The host shall not reach into `src/` through a relative path.

Two internal building blocks are not directly re-exported by the public values barrel: `SearchResponse` is defined internally but represented publicly by `Search.Success`, which extends it, and `NonNegativeInt64` is used by public models but omitted from the values barrel (`packages/drivers/govinfo/src/domain/values/SearchResponse/SearchResponse.model.ts:46-67`; `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts:84-90`; `packages/drivers/govinfo/src/domain/values/GovinfoNumeric.ts:28-57`; `packages/drivers/govinfo/src/domain/values/index.ts:11-79`). Neither is needed by the frozen projection, so this is **not** a blocker. The absence of a GovInfo operation-descriptor registry is also non-blocking because the public HttpApi endpoint and contracts are sufficient.

### 1.2 `@beep/ecfr`

#### Public boundary and complete operation surface

The root barrel publicly re-exports every generated model/descriptor plus config, errors, and service (`packages/drivers/ecfr/src/index.ts:7-34`). The package intentionally exposes only its root and `package.json`, blocking generated/private subpaths, so consumers must use those root exports (`packages/drivers/ecfr/package.json:41-46`).

The complete public service shape is:

| Service member | Public input | Public output | Descriptor/implementation evidence |
| --- | --- | --- | --- |
| `getAncestry` | `EcfrVersionerParams` | `AncestryResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:248-251`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:971-975` |
| `getFullTitleXml` | `EcfrVersionerParams` | `string` | `packages/drivers/ecfr/src/Ecfr.service.ts:249-250`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:990-994` |
| `getStructure` | `EcfrDatedTitleParams` | `StructureNode` | `packages/drivers/ecfr/src/Ecfr.service.ts:250-251`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1009-1013` |
| `listAgencies` | none | `AgenciesResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:252-252`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1028-1032` |
| `listCorrections` | optional `EcfrCorrectionsParams` | `CorrectionsResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:253-253`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1047-1051` |
| `listTitleCorrections` | `EcfrTitleParams` | `CorrectionsResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:254-254`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1066-1070` |
| `listTitles` | none | `TitlesResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:255-255`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1085-1089` |
| `listVersions` | `EcfrVersionsParams` | `VersionsResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:256-256`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1104-1108` |
| `searchCount` | optional `EcfrSearchParams` | `SearchCountResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:258-258`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1123-1127` |
| `searchDailyCounts` | optional `EcfrSearchParams` | `SearchDailyCountsResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:259-259`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1142-1146` |
| `searchHierarchyCounts` | optional `EcfrSearchParams` | `SearchHierarchyCountsResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:260-262`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1161-1165` |
| `searchResults` | optional `EcfrSearchParams` | `SearchResultsResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:263-263`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1180-1184` |
| `searchSuggestions` | optional `EcfrSearchParams` | `SearchSuggestionsResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:265-265`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1199-1203` |
| `searchSummary` | optional `EcfrSearchParams` | `SearchSummaryResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:266-266`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1218-1222` |
| `searchTitleCounts` | optional `EcfrSearchParams` | `SearchTitleCountsResponse` | `packages/drivers/ecfr/src/Ecfr.service.ts:267-267`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1237-1241` |
| `searchResultsAll` | optional `EcfrSearchParams` | `Stream<SearchResult, EcfrError>` | Convenience pagination over `searchResults`; no separate upstream descriptor (`packages/drivers/ecfr/src/Ecfr.service.ts:263-265`; `packages/drivers/ecfr/src/Ecfr.service.ts:524-536`) |
| `rateLimit` | none | `Option<RateLimitSnapshot>` | Transport diagnostic; no upstream descriptor (`packages/drivers/ecfr/src/Ecfr.service.ts:257-257`; `packages/drivers/ecfr/src/Ecfr.service.ts:366-371`) |

`EcfrOperationDescriptor` contains exactly `method`, `operationId`, and `path` (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:947-956`). `ECFR_OPERATIONS` is the complete 15-entry descriptor/response registry for the upstream calls and binds each descriptor to its response schema (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1256-1272`). It intentionally has no entries for the local pagination convenience `searchResultsAll` or diagnostic `rateLimit` (`packages/drivers/ecfr/src/Ecfr.service.ts:257-267`).

#### Complete public value/error/config surface

The six public request models are `EcfrCorrectionsParams`, `EcfrTitleParams`, `EcfrSearchParams`, `EcfrVersionerParams`, `EcfrDatedTitleParams`, and `EcfrVersionsParams` (`packages/drivers/ecfr/src/Ecfr.service.ts:69-78`; `packages/drivers/ecfr/src/Ecfr.service.ts:94-97`; `packages/drivers/ecfr/src/Ecfr.service.ts:119-136`; `packages/drivers/ecfr/src/Ecfr.service.ts:153-168`; `packages/drivers/ecfr/src/Ecfr.service.ts:186-194`; `packages/drivers/ecfr/src/Ecfr.service.ts:211-229`).

The generated public value models are `CfrReference`, `AgencyChild`, `Agency`, `AgenciesResponse`, `HierarchyNode`, `AncestryResponse`, `ContentVersion`, `CorrectionHierarchy`, `CorrectionReference`, `Correction`, `CorrectionsResponse`, `DailyCount`, `HierarchyCount`, `SearchCountResponse`, `SearchDailyCountsResponse`, `SearchHierarchyCountsResponse`, `SearchMeta`, `SearchResult`, `SearchResultsResponse`, `SearchSuggestionsResponse`, `SearchSummaryResponse`, `TitleCount`, `SearchTitleCountsResponse`, `StructureChild`, `StructureNode`, `Title`, `TitlesMeta`, `TitlesResponse`, `VersionsMeta`, and `VersionsResponse` (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:30-205`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:221-365`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:390-500`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:529-704`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:731-919`).

The root error surface is `EcfrErrorReason`, `EcfrErrorOptions`, and `EcfrError` (`packages/drivers/ecfr/src/Ecfr.errors.ts:35-60`; `packages/drivers/ecfr/src/Ecfr.errors.ts:78-96`; `packages/drivers/ecfr/src/Ecfr.errors.ts:112-159`).

eCFR is keyless: `EcfrConfigInput` has only a defaulted `apiUrl`, the transport uses `ApiAuth.NoAuth()`, and the live environment reads only `ECFR_API_URL` with a default (`packages/drivers/ecfr/src/Ecfr.config.ts:73-85`; `packages/drivers/ecfr/src/Ecfr.service.ts:366-371`; `packages/drivers/ecfr/src/Ecfr.service.ts:549-552`). There is no eCFR credential env var and no `Config.redacted(...).pipe(Config.option)` shape. Its public constants are `ECFR_API_URL`, `ECFR_RATE_LIMIT`, and `ECFR_RATE_LIMIT_WINDOW` (`packages/drivers/ecfr/src/Ecfr.config.ts:27-57`).

#### Deterministic projection inputs and export gaps

P1 shall use root-public operation descriptors/`ECFR_OPERATIONS`, the six root-public parameter schemas, root-public response schemas, and `Ecfr` service methods (`packages/drivers/ecfr/src/index.ts:7-34`; `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:947-1272`; `packages/drivers/ecfr/src/Ecfr.service.ts:69-268`). The registry does not bind parameter schemas, so the package-local candidate table must explicitly bind each chosen descriptor to its request schema; that is a host mapping, not a reason to patch the driver. Nothing the frozen tool set needs is trapped behind a private barrel. **No export blocker.**

## 2. `@beep/mcp-kit` shipped surface

The kit root barrel exports flat symbols from `ApiKeyRequired`, `FieldTier`, `McpCaller`, `SanitizedSpan`, `SourceAuth`, `TierGate`, `ToolAnnotations`, and `ToolkitComposition` (`packages/foundation/capability/mcp-kit/src/index.ts:16-81`). The exact host-relevant surface is:

### Source auth and credential-keyed composition

- `SourceAuthGate = LiteralKit(["none", "soft", "hard"])`; its semantics are none=always mount, soft=mount and degrade at call time, hard=vanish when absent (`packages/foundation/capability/mcp-kit/src/SourceAuth.ts:29-71`).
- `SourceAuthRegistration.make({ name, envVar, gate, signupUrl? })` carries the human name, credential env var, gate, and optional signup URL (`packages/foundation/capability/mcp-kit/src/SourceAuth.ts:73-114`).
- `resolveSourceCredential(registration): Effect<Option<Redacted<string>>, ConfigError>` executes `Config.redacted(registration.envVar).pipe(Config.option)` (`packages/foundation/capability/mcp-kit/src/SourceAuth.ts:116-145`).
- `SourceAuthDecision` is `Mount { credential } | Vanish {}` and `decideSourceAuthMount(registration)` keeps none/soft mounted while only hard+missing vanishes (`packages/foundation/capability/mcp-kit/src/SourceAuth.ts:146-189`; `packages/foundation/capability/mcp-kit/src/SourceAuth.ts:191-229`).
- `gatedLayer<ROut,E,RIn>(registration, layer): GatedLayer<ROut,E,RIn>` pairs a source registration with a layer (`packages/foundation/capability/mcp-kit/src/ToolkitComposition.ts:51-89`).
- `composeGatedLayers<E = never, RIn = never>(...entries: ReadonlyArray<GatedLayer<never,E,RIn>>): Layer<never, ConfigError | E, RIn>` evaluates each source decision and merges only mounted layers with `Layer.mergeAll` (`packages/foundation/capability/mcp-kit/src/ToolkitComposition.ts:91-143`).

The host needs two registrations: eCFR `{ name: "eCFR", envVar: "ECFR_API_KEY", gate: "none" }` and GovInfo `{ name: "GovInfo", envVar: GOVINFO_API_KEY_ENV, gate: "hard" }`. The eCFR env-var string is deliberately inert because the none branch does not resolve a credential (`packages/foundation/capability/mcp-kit/src/SourceAuth.ts:217-227`); using a stable placeholder preserves the shipped registration schema without inventing eCFR authentication.

### `api_key_required`, span sanitization, and annotations

- `ApiKeyRequiredFailure` is the envelope `{ error: "api_key_required", tool, envVar, registration }`; `ApiKeyRequiredFailure.forTool(params)` and `apiKeyRequiredFailure(params)` construct it (`packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts:41-90`; `packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts:92-123`). It is required to preserve the general soft-gate contract, but no frozen gov-legal tool is soft-gated.
- `defaultSanitizedSpanKeys` is `['parameters']`; `sanitizeTracerAttributes` has data-first/data-last forms `(tracer, keys?) => tracer` and `(keys?) => tracer => tracer`; `withSanitizedToolSpan` likewise has data-first/data-last forms around an `Effect` (`packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:41-141`; `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:143-191`).
- `sanitizedToolkit<Tools>(toolkit): Layer<never, never, HandlersFor<Tools> | Exclude<HandlerServices<Tools>, McpServerClient>>` mirrors toolkit registration, wraps `built.handle(...)` in a sanitized span, and emits the wire definition (`packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:224-315`; `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:318-368`). It sets `isError` for typed failures except the deliberate `api_key_required` return envelope (`packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:288-309`).
- `FourHintAnnotations` contains `readOnly`, `destructive`, `idempotent`, and `openWorld`; `annotateFourHints(hints)(tool)` and `annotateFourHints(tool, hints)` apply all four; `readOnlyToolHints` is exactly `{ readOnly: true, destructive: false, idempotent: true, openWorld: true }` (`packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:21-73`; `packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:75-123`).
- Supporting but not directly host-authored: `CurrentMcpCaller`/`McpCallerIdentity` are injected by `sanitizedToolkit` at dispatch (`packages/foundation/capability/mcp-kit/src/McpCaller.ts:36-63`; `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:260-286`). The `FieldTier` file exports projection primitives, but this bounded four-tool host has no SPEC-mandated field-budget transform and shall not add one in P1 (`packages/foundation/capability/mcp-kit/src/index.ts:23-81`).

### Promised-name drift

The kit and shipped-host specs use conceptual/module labels `SourceAuth`, `ToolkitComposition`, `ApiKeyRequired`, and `FieldTier` (`goals/mcp-kit/SPEC.md:58-95`; `goals/uspto-mcp/SPEC.md:112-113`), but the root barrel does **not** export namespace values with those exact names; it flat-re-exports their concrete symbols (`packages/foundation/capability/mcp-kit/src/index.ts:16-81`). `sanitizedToolkit` does ship under the promised exact name (`packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:365-368`). This is a documentation/name mismatch, not an API capability blocker: P1 must import the flat symbols listed above and must not invent wrapper namespaces.

## 3. Worked thin-host conventions

### What to copy

- **Layout:** mirror `@beep/uspto-mcp`: `src/{Server,SourceAuth,Tools,Handlers,bin,index}.ts`, package root configs, and `test/Server.test.ts`; its root barrel re-exports the public modules (`packages/drivers/uspto-mcp/src/index.ts:12-36`). Add package-local `scripts/generate.ts`, `tsconfig.scripts.json`, and `src/_generated/tool-name-collision-report.json` for this host's required collision artifact, following generated-driver precedent (`packages/drivers/acp/package.json:17-39`; `packages/drivers/acp/scripts/generate.ts:125-141`).
- **Identity composer:** copy `const $I = $UsptoMcpId.create("Server")` and corresponding identity-package registration, renamed to `$GovLegalMcpId` (`packages/drivers/uspto-mcp/src/Server.ts:16-27`; `packages/foundation/modeling/identity/src/packages.ts:1735-1749`). The create-package workflow registers missing workspace identity packages (`packages/tooling/tool/cli/src/commands/CreatePackage/internal/IdentityRegistration.ts:281-323`).
- **Tool definition/handler split:** copy USPTO's `Tool.make` + `annotateFourHints(..., readOnlyToolHints)` + `Toolkit.make` definition style and thin handlers that call the driver (`packages/drivers/uspto-mcp/src/UsptoTools.ts:206-215`; `packages/drivers/uspto-mcp/src/UsptoTools.ts:269-296`; `packages/drivers/uspto-mcp/src/UsptoHandlers.ts:101-134`).
- **Bootstrap seam:** register each source with `sanitizedToolkit`, wrap each with `gatedLayer`, combine with `composeGatedLayers`, then provide `McpServer.layerStdio({ name, version })`; this is the USPTO pattern (`packages/drivers/uspto-mcp/src/Server.ts:83-92`). If per-source registration layers must first be merged for a shared server, use the proven `Layer.mergeAll(...).pipe(Layer.provide(McpServer.layerStdio(...)))` seam from NLP (`packages/drivers/nlp-mcp/src/Server.ts:102-108`). M365 confirms the one-toolkit `sanitizedToolkit` + `layerStdio` shape (`packages/drivers/m365-mcp/src/Server.ts:65-75`).
- **Bin:** export a `SERVER_CONFIG`, expose an explicit run function, and guard launch with `if (import.meta.main)` so importing the bin cannot start stdio (`packages/drivers/uspto-mcp/src/bin.ts:13-52`).
- **Tests:** build fixture `HttpClient` layers with `HttpClient.make`/`HttpClientResponse.fromWeb`, inject synthetic config, and call the in-memory `McpServer` (`packages/drivers/uspto-mcp/test/Server.test.ts:71-112`; `packages/drivers/uspto-mcp/test/Server.test.ts:141-173`). Use `@effect/vitest`'s `layer(...)` for mounted service/toolkit assertions as NLP and M365 do (`packages/drivers/nlp-mcp/test/Server.test.ts:32-44`; `packages/drivers/m365-mcp/test/Server.test.ts:248-260`).
- **Manifest/config:** copy USPTO's drivers-family metadata, build/check/test scripts, root/source exports, dependencies, and dev dependencies, replacing the driver dependency with both `@beep/govinfo` and `@beep/ecfr` and adding the generator script config (`packages/drivers/uspto-mcp/package.json:14-75`). Copy its composite package/test TypeScript layout and shared Vitest config (`packages/drivers/uspto-mcp/tsconfig.json:1-26`; `packages/drivers/uspto-mcp/tsconfig.test.json:1-15`; `packages/drivers/uspto-mcp/vitest.config.ts:1-11`). Turbo already supplies generic build/check/test/codegen task conventions; package-specific behavior belongs in package scripts (`turbo.json:33-166`).

### Scaffold command and root wiring

P1 shall scaffold with exactly `bun run beep create-package gov-legal-mcp --family drivers`, the same command form used by the shipped USPTO host (`goals/uspto-mcp/PLAN.md:9-13`). The root command delegates to `bun run beep create-package` (`package.json:369-377`), and the live CLI accepts the positional package name plus `--family drivers` (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:769-811`). Drivers are individually listed workspaces, so the scaffold is expected to add the package and identity entry, then run shared config sync for aliases/references (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1048-1064`). The scaffold's standard library manifest already supplies Effect, source exports, Vitest scripts, `@effect/vitest`, and Node types (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1341-1409`); P1 adds only the dependencies/files/scripts this host actually needs. Root TypeScript reference and alias updates are idempotent live CLI operations (`packages/tooling/tool/cli/src/commands/CreatePackage/ConfigUpdater.ts:312-400`; `packages/tooling/tool/cli/src/commands/CreatePackage/ConfigUpdater.ts:472-490`).

## 4. Installed Effect MCP baseline

The root catalog and installed package both report `effect` **4.0.0-beta.102** (`package.json:179-179`; `node_modules/effect/package.json:1-5`). The kit SPEC's prior baseline was beta.92; current verdicts follow.

| Concern | Current beta.102 evidence | Drift verdict |
| --- | --- | --- |
| `failureMode: "return"` | Toolkit includes success, declared failure, and `AiError` in the result schema and converts handler failure to an in-band `{ isFailure: true }` stream item (`node_modules/effect/src/unstable/ai/Toolkit.ts:245-256`; `node_modules/effect/src/unstable/ai/Toolkit.ts:369-380`; installed distribution: `node_modules/effect/dist/unstable/ai/Toolkit.js:21-28`; `node_modules/effect/dist/unstable/ai/Toolkit.js:112-122`). Upstream `McpServer.registerToolkit` still maps that item to `CallToolResult({ isError: false, ... })` (`node_modules/effect/src/unstable/ai/McpServer.ts:774-830`; installed distribution: `node_modules/effect/dist/unstable/ai/McpServer.js:528-562`). | **Moved, semantically unchanged** from the beta.92 `McpServer.ts:717-728` observation. The kit's stricter wrapper remains intentional (`packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:293-309`). |
| `EnabledWhen` | Direct `server.callTool` looks up `toolMap` and invokes the handler without `EnabledWhen` (`node_modules/effect/src/unstable/ai/McpServer.ts:243-263`; installed distribution: `node_modules/effect/dist/unstable/ai/McpServer.js:96-116`). Protocol `tools/call` delegates directly, while `tools/list` uses `filterByClient`; only that filter reads `EnabledWhen` (`node_modules/effect/src/unstable/ai/McpServer.ts:1560-1569`; `node_modules/effect/src/unstable/ai/McpServer.ts:1606-1627`; installed distribution: `node_modules/effect/dist/unstable/ai/McpServer.js:993-1002`; `node_modules/effect/dist/unstable/ai/McpServer.js:1032-1045`). | **Moved, semantically unchanged** from the former `:255-262` versus `:1450` locations. Auth disappearance must therefore happen at composition, not through `EnabledWhen`. |
| Raw-parameter span annotation | Toolkit dispatch still calls `Effect.annotateCurrentSpan({ tool: name, parameters: params })` before parameter decoding (`node_modules/effect/src/unstable/ai/Toolkit.ts:269-275`; installed distribution: `node_modules/effect/dist/unstable/ai/Toolkit.js:40-45`). | **Moved, semantically unchanged** from `Toolkit.ts:263-265`; `sanitizedToolkit` remains required. |
| MCP protocol version | `LATEST_PROTOCOL_VERSION` remains `2025-06-18`; the supported list also includes `2025-03-26`, `2024-11-05`, and `2024-10-07` (`node_modules/effect/src/unstable/ai/McpServer.ts:337-356`; installed distribution: `node_modules/effect/dist/unstable/ai/McpServer.js:204-212`). | **Moved only / unchanged value** from the beta.92 `:336-341` observation. |

The exact installed MCP JSON-schema surfaces integration tests shall decode against are:

1. `McpSchema.Tool` for every listed tool definition, including annotations (`node_modules/effect/src/unstable/ai/McpSchema.ts:1409-1484`; installed distribution: `node_modules/effect/dist/unstable/ai/McpSchema.js:1235-1307`).
2. `McpSchema.ListToolsResult` for the whole `tools/list` envelope (`node_modules/effect/src/unstable/ai/McpSchema.ts:1492-1509`; installed distribution: `node_modules/effect/dist/unstable/ai/McpSchema.js:1314-1328`).
3. `McpSchema.CallTool` for request payloads and `McpSchema.CallToolResult` for responses (`node_modules/effect/src/unstable/ai/McpSchema.ts:1526-1563`; installed distribution: `node_modules/effect/dist/unstable/ai/McpSchema.js:1344-1377`).

`McpSchema.Tool.inputSchema` is currently `Schema.Any` and the installed Tool wire schema has no `outputSchema` field (`node_modules/effect/src/unstable/ai/McpSchema.ts:1455-1484`; installed distribution: `node_modules/effect/dist/unstable/ai/McpSchema.js:1280-1307`). Consequently, integration tests must additionally encode/decode arguments and structured results with the package-local source schemas; passing `McpSchema.Tool` alone proves the MCP envelope shape, not the correctness of the embedded JSON Schema. This is a test-design constraint, not decision-invalidating drift.

## 5. Frozen candidate tool inventory

The host shall expose exactly four tools in P1. This is bounded by design: GovInfo contributes its only callable operation; eCFR contributes title discovery, paged search, and dated hierarchy lookup. Full-title XML, all-pages streaming, corrections, versions, aggregates, and suggestion variants remain outside this proving host even though the driver exposes them (`packages/drivers/ecfr/src/Ecfr.service.ts:248-268`). All four are read-only calls to external official data, so their frozen hints are `readOnlyHint=true`, `destructiveHint=false`, `idempotentHint=true`, `openWorldHint=true`, matching `readOnlyToolHints` (`packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:60-65`; `packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:107-123`).

| Source symbol | Upstream operationId | Stable wire name | Auth gate | Four hints `(R,D,I,O)` | Input schema source | Output schema source | Collision-report row |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Search.Http` / `Govinfo.search` (`packages/drivers/govinfo/src/domain/contracts/Search/Search.http.ts:27-31`; `packages/drivers/govinfo/src/Govinfo.service.ts:124-135`) | `search` (HttpApi endpoint identifier) | `govinfo_search` | `hard` via `GOVINFO_API_KEY` (`packages/drivers/govinfo/src/Govinfo.config.ts:49-57`) | `(true,false,true,true)` | `Search.Payload` (`packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts:44-49`) | `Search.Success` (`packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts:84-90`) | candidate=`govinfo_search`; normalized=`govinfo_search`; truncated=false; digest=null; final=`govinfo_search`; unique |
| `listTitlesOperation` / `Ecfr.listTitles` (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1085-1089`; `packages/drivers/ecfr/src/Ecfr.service.ts:491-491`) | `listTitles` | `ecfr_list_titles` | `none` | `(true,false,true,true)` | package-local named `EcfrListTitlesParams = S.Struct({})` because the service takes no input | `TitlesResponse` (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:859-883`) | candidate=`ecfr_listTitles`; normalized=`ecfr_list_titles`; truncated=false; digest=null; final=`ecfr_list_titles`; unique |
| `searchResultsOperation` / `Ecfr.searchResults` (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1180-1184`; `packages/drivers/ecfr/src/Ecfr.service.ts:431-435`) | `searchResults` | `ecfr_search_results` | `none` | `(true,false,true,true)` | `EcfrSearchParams` (`packages/drivers/ecfr/src/Ecfr.service.ts:119-136`) | `SearchResultsResponse` (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:598-622`) | candidate=`ecfr_searchResults`; normalized=`ecfr_search_results`; truncated=false; digest=null; final=`ecfr_search_results`; unique |
| `getStructureOperation` / `Ecfr.getStructure` (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1009-1013`; `packages/drivers/ecfr/src/Ecfr.service.ts:456-466`) | `getStructure` | `ecfr_get_structure` | `none` | `(true,false,true,true)` | `EcfrDatedTitleParams` (`packages/drivers/ecfr/src/Ecfr.service.ts:186-194`) | `StructureNode` (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:762-794`) | candidate=`ecfr_getStructure`; normalized=`ecfr_get_structure`; truncated=false; digest=null; final=`ecfr_get_structure`; unique |

The package-local empty input schema is a named tool-boundary schema, not a driver-domain model; all non-empty inputs and every output come from public driver schemas. The candidate string is deliberately the driver prefix plus the original operation id; the stable wire name is its section-6 normalization.

## 6. Frozen naming and collision-report contract

The collision requirement originates in the exploration contract: normalized tool names must be safe, length-bounded, deterministically disambiguated, and accompanied by a checked-in collision report (`explorations/gov-legal-data-driver-codegen/MAP.md:43-43`). P1 shall implement the following exact rules without further judgment calls.

### 6.1 Candidate construction and normalization

1. Registry input is `{ source, operationId }`. For production, `source` is exactly `govinfo` or `ecfr`; `operationId` is the public upstream id. Construct `candidate = source + "_" + operationId`.
2. Apply Unicode `NFKD` normalization.
3. Delete every Unicode combining mark matching `\p{M}+`.
4. Before lowercasing, insert `_` at both ASCII case boundaries: replace `([A-Z]+)([A-Z][a-z])` with `$1_$2`, then replace `([a-z0-9])([A-Z])` with `$1_$2`.
5. Lowercase with locale-independent `toLowerCase()`.
6. Replace every maximal run outside ASCII `[a-z0-9_-]` with one `_`.
7. Collapse every maximal `_+` run to `_`; collapse every maximal `-+` run to `-`.
8. Trim all leading/trailing `_` and `-` characters.
9. Reject an empty result. Assert the result matches `^[a-zA-Z0-9_-]+$` (the algorithm emits the lowercase subset). This result is `normalized`.

The policy is lowercase snake-style while preserving a single hyphen where the upstream name used hyphens. Case-boundary insertion means `listTitles` becomes `list_titles`; punctuation/whitespace/slashes become `_`. Normalization is pure and does not consult registration order.

### 6.2 64-character cap

- Measure the ASCII character length of `normalized` (equal to UTF-8 bytes after the allowed-character assertion).
- If length is at most 64: `truncated=false`, `digest=null`, and `finalWireName=normalized`.
- If length exceeds 64: compute SHA-256 over the UTF-8 bytes of the **full pre-truncation `normalized` string**; encode the digest as lowercase hexadecimal; take the first 8 hex characters; set `digest` to those 8 characters; take exactly the first 55 characters of `normalized`; and set `finalWireName = prefix55 + "_" + digest`. The separator is one underscore, so the final length is exactly 64 and `truncated=true`.

No trimming or re-normalization occurs after truncation. Digest input is not the raw operation id, candidate, JSON row, or truncated prefix.

### 6.3 Duplicate failure semantics

Generation shall group rows twice: once by `normalized`, then by `finalWireName`. Any group of size greater than one at either stage is a hard typed generation/registration failure. This includes cross-driver, punctuation/case normalization, and digest/truncation collisions. Generation must fail before registering tools and before overwriting the checked-in report. There is no last-write-wins map, no numeric suffix, no collision retry, and no order-dependent resolution.

The exact truncation-collision fixture is frozen:

- `ecfr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_000000000g50`
- `ecfr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_0000000011bm`

Both are 68-character normalized inputs, share the first 55 characters, and have SHA-256 lowercase-hex prefix `a06e92ed`; both therefore produce `ecfr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_a06e92ed` and must fail closed.

### 6.4 Checked-in report

Path: `packages/drivers/gov-legal-mcp/src/_generated/tool-name-collision-report.json`.

Top-level JSON object, with exact fields:

```json
{
  "candidates": [],
  "duplicateVerdict": "clean",
  "schemaVersion": "gov-legal-mcp/tool-name-collision-report/v1"
}
```

Each `candidates` row has exactly these fields:

```json
{
  "candidate": "ecfr_listTitles",
  "digest": null,
  "duplicateVerdict": "unique",
  "finalWireName": "ecfr_list_titles",
  "normalized": "ecfr_list_titles",
  "originalOperationId": "listTitles",
  "source": "ecfr",
  "truncated": false
}
```

Allowed row verdicts are `unique`, `duplicate_normalized`, and `duplicate_final`; the checked-in successful report contains only `unique` rows and top-level `duplicateVerdict: "clean"`. A failed in-memory report uses top-level `duplicateVerdict: "duplicate"` but is not written over the last clean artifact.

Serialization contract: sort rows by `finalWireName`, then `source`, then `originalOperationId`, comparing Unicode code points directly (all production sort keys are ASCII); sort every object key lexicographically; pretty-print with two spaces; use LF only; emit no timestamps, absolute paths, tool versions, hostnames, or random values; and end with exactly one trailing newline. Re-running from an unchanged candidate registry must be byte-identical.

### 6.5 Regeneration command

Add package scripts `"generate": "bun run scripts/generate.ts"` and `"codegen": "bun run generate"`; invoke regeneration with `bun run --cwd packages/drivers/gov-legal-mcp generate`. The script is offline and reads only the package-local candidate registry. This mirrors the ACP package-local generator/script convention and `src/_generated` output location (`packages/drivers/acp/package.json:17-39`; `packages/drivers/acp/scripts/generate.ts:125-141`; `packages/drivers/acp/scripts/generate.ts:176-181`) and the Runpod deterministic sorting-before-render pattern (`packages/drivers/runpod/scripts/generate.ts:584-615`).

## 7. Offline fixture/test plan

Use `@effect/vitest` and package tests imported through `@beep/*` aliases, as required for package tests (`AGENTS.md:26-29`). Focused P2 invocation: `npx vitest run --config packages/drivers/gov-legal-mcp/vitest.config.ts packages/drivers/gov-legal-mcp/test`; the scaffolded package script remains the repo-standard `bunx --bun vitest run` (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1392-1403`). No test may use the network or a real credential.

1. **Keyless eCFR mount:** build `McpServer.McpServer.layer`, the eCFR `none`-gated sanitized toolkit, fixture `HttpClient`, and in-memory rate limiter; assert `tools/list` includes all three `ecfr_*` tools and fixture calls succeed. The driver supports explicit injection through `Ecfr.makeLayer`, requiring `HttpClient` and `RateLimiterStore` (`packages/drivers/ecfr/src/Ecfr.service.ts:573-595`). Use `layer(...)` for the mounted fixture, following the NLP/M365 idiom (`packages/drivers/nlp-mcp/test/Server.test.ts:32-44`; `packages/drivers/m365-mcp/test/Server.test.ts:248-260`).
2. **Absent GovInfo hard gate:** build composition under `ConfigProvider.fromUnknown({})` provided **upstream** of `composeGatedLayers`; assert `tools/list` contains no `govinfo_*` name and direct `server.callTool({ name: "govinfo_search", ... })` fails with tool-not-found. Hard absence maps to `Vanish` (`packages/foundation/capability/mcp-kit/src/SourceAuth.ts:217-227`), while direct call lookup rejects an unregistered tool (`node_modules/effect/src/unstable/ai/McpServer.ts:256-263`).
3. **Present GovInfo hard gate:** inject `ConfigProvider.fromUnknown({ GOVINFO_API_KEY: "fixture-secret" })` upstream of composition, not as a sibling; mount `Govinfo.makeLayer(GovinfoConfigInput.make({ apiKey: Redacted.make("test-key") }))` with a fixture `HttpClient` and in-memory rate limiter, assert listing includes `govinfo_search`, invoke it, and decode the fixture result as `Search.Success`. The explicit driver layer accepts redacted config and injected transport requirements (`packages/drivers/govinfo/src/Govinfo.config.ts:121-136`; `packages/drivers/govinfo/src/Govinfo.service.ts:163-185`); USPTO demonstrates fixture `HttpClient` construction and synthetic keys (`packages/drivers/uspto-mcp/test/Server.test.ts:71-98`).
4. **Cross-driver collision:** pure generator fixture sources `agency.alpha/search` and `agency_alpha/search` normalize to the same `agency_alpha_search`; assert typed failure before write/registration.
5. **Normalization collision:** pure fixture `ecfr/search.results` and `ecfr/search/results` both normalize to `ecfr_search_results`; assert `duplicate_normalized` and hard failure.
6. **Truncation collision:** use the two exact 68-character values frozen in section 6.3; assert both yield digest `a06e92ed`, the same 64-character final name, `duplicate_final`, and hard failure.
7. **Installed MCP schemas:** decode every registered definition with `McpSchema.Tool`, the listing with `McpSchema.ListToolsResult`, request envelopes with `McpSchema.CallTool`, and call results with `McpSchema.CallToolResult`; separately encode/decode each tool's arguments and structured result with its source schema because installed `McpSchema.Tool.inputSchema` is `Schema.Any` and has no output schema (`node_modules/effect/src/unstable/ai/McpSchema.ts:1455-1563`).
8. **Sanitized span:** install a recording tracer, invoke every tool with a sentinel raw parameter, and assert no completed span has a `parameters` attribute or sentinel value while non-sensitive attributes remain. The wrapper suppresses the default `parameters` key and encloses the actual dispatch (`packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:41-56`; `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:282-309`).
9. **Four hints:** inspect/decode every `McpSchema.Tool.annotations` and assert all four explicit booleans equal `(true,false,true,true)`, not merely defaults. `sanitizedToolkit` maps all four annotations to the wire tool (`packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:234-252`).
10. **Report no-diff:** render twice to temporary paths and compare bytes; then compare rendered bytes with the checked-in report. Assert sorted rows/keys, no timestamps, LF, and one trailing newline. Also run the package generator and verify `git diff --exit-code -- packages/drivers/gov-legal-mcp/src/_generated/tool-name-collision-report.json` in P2 proof, not in this audit.
11. **Import-safe bin:** import `@beep/gov-legal-mcp/bin` and assert metadata/run function without launching stdio, matching the guarded USPTO proof (`packages/drivers/uspto-mcp/src/bin.ts:31-52`; `packages/drivers/uspto-mcp/test/Server.test.ts:141-149`).

## 8. Drift, blockers, and open decisions

### Blockers

**None.** No SPEC stop condition is triggered. Public driver schemas and operations are sufficient (section 1), beta.102 preserves the four audited MCP semantics (section 4), and the naming/report contract is fully frozen (section 6).

### Recorded drift/non-blocking constraints

1. **Kit promised-name drift:** `SourceAuth`, `ToolkitComposition`, `ApiKeyRequired`, and `FieldTier` are module/concept names in the kit/host specs, not actual root namespace exports; P1 uses flat concrete exports. `sanitizedToolkit` matches exactly (`goals/mcp-kit/SPEC.md:58-95`; `goals/uspto-mcp/SPEC.md:112-113`; `packages/foundation/capability/mcp-kit/src/index.ts:16-81`; `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:365-368`).
2. **GovInfo descriptor asymmetry:** GovInfo has one public HttpApi endpoint but no generated operation descriptor/registry; its public endpoint and request/success contracts are sufficient (`packages/drivers/govinfo/src/domain/contracts/Search/Search.http.ts:27-31`; `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts:44-90`).
3. **eCFR request-binding asymmetry:** `ECFR_OPERATIONS` binds descriptors to responses but not parameter schemas; the host's frozen registry supplies the explicit binding (`packages/drivers/ecfr/src/_generated/Ecfr.generated.ts:1256-1272`; `packages/drivers/ecfr/src/Ecfr.service.ts:69-229`).
4. **Effect line drift:** all four audited internals moved between beta.92 and beta.102, but none changed in a way that invalidates the host design (`node_modules/effect/src/unstable/ai/McpServer.ts:243-263`; `node_modules/effect/src/unstable/ai/McpServer.ts:337-356`; `node_modules/effect/src/unstable/ai/McpServer.ts:774-830`; `node_modules/effect/src/unstable/ai/McpServer.ts:1560-1627`; `node_modules/effect/src/unstable/ai/Toolkit.ts:269-275`).
5. **Installed MCP schema limitation:** the wire Tool schema accepts any input-schema payload and has no output-schema field, so source-schema assertions are required in addition to MCP envelope assertions (`node_modules/effect/src/unstable/ai/McpSchema.ts:1455-1484`).

### SPEC constraint 2: soft-gate preservation

The host has only `none` (eCFR) and `hard` (GovInfo), but it must compose through the full shipped `SourceAuthGate`/`composeGatedLayers` contract. It must not replace that contract with a boolean “has key” filter, narrow the gate schema, or remove the `soft` branch. The shipped decision function explicitly mounts soft registrations and carries their optional credential (`packages/foundation/capability/mcp-kit/src/SourceAuth.ts:191-229`), and the shipped `api_key_required` envelope remains the call-time degradation mechanism (`packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts:41-123`). That preserves the SPEC's future soft-source requirement even though this package has no soft source (`goals/gov-legal-mcp/SPEC.md:50-56`).

### Open decisions requiring ratification before P1

**None.** The tool set, auth gates, annotations, schema bindings, name algorithm, digest/cap, collision behavior, report path/shape/order, generator invocation, and offline tests are frozen above. Any proposal to expose more than the four tools, change a gate, add field-tier projection, or alter the name/report format is scope expansion and must return to the orchestrator rather than being decided inside P1.

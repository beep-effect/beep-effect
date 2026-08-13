# S1 Rule-Card Notes — merged from per-batch fragments (P1 baseline, 2026-07-05/06)


---

<!-- batch FA -->
# S1 Rule Card Notes - batch FA

## SFV4-fn-schema refinements

- Treat exported option objects as actionable only when the fields are plain data and map directly to schema-owned domain fields. Examples from this batch: `renderLogBanner` (`@beep/observability`) and `Md.taskItem` / `Md.pre` / `Md.table` (`@beep/md`) are reasonable assisted targets for named option schemas or Fn contracts.
- Do not flag function-like contracts whose object parameters primarily carry Effect runtime handles, Layer/Context/service handles, adapter callbacks, or generic environment/error parameters. Examples: observability metric-handle option surfaces, semantic-web Context.Service shapes, `Md.render` adapters, and `IdentityComposer`.
- Preserve literal-preserving overload APIs when a separate schema boundary already exists. Examples: `@beep/identity` CURIE `expand` / `contract` overloads and `makeCurieCodec` sit beside `makeCurieFromIri`, which is the runtime schema codec.

## Schema-first-inventory refinements

- Public DSL shorthand aliases are not schema targets when they normalize into schema classes before becoming persisted/domain data. Example: `@beep/md` builder input aliases (`InlineInput`, `BlockInput`, `TaskListItemInput`) normalize into `Md.model.ts` S.TaggedClass nodes.
- `declare namespace` / companion namespace Type and Encoded blocks around recursive schema unions should remain exceptions. Example: `@beep/md` uses these names around `S.suspend` recursive AST schemas.
- Guard helper walls are actionable when the guard names a public syntax/domain invariant and can be derived from a package-local schema without changing semantics. Example: `@beep/identity` PN_LOCAL predicates should become schema-owned guards.
- Guard helper walls are exceptions when they are private bootstrap aliases over literal schemas or generic-preserving decode wrappers. Example: `@beep/identity` `isBeepNamespace` and `validateSegment` helpers already delegate to schemas and preserve literal type inference.

## Boundary-codec refinements

- Treat `S.decodeUnknownResult`, `S.decodeUnknownEffect`, and `S.decodeTo(..., SchemaTransformation.transformOrFail(...))` at actual input boundaries as positive schema-boundary evidence, not as helper-wall smells.
- Do not propose `@beep/schema` helpers inside `@beep/identity` without first checking dependency direction. `@beep/identity` currently depends only on `effect` at runtime, so schema-colocation targets there should use pure `effect/Schema` APIs or require a separate dependency-design decision.
- For tolerant public string transforms currently documented as codecs, record a judgment exception unless the accepted/rejected input behavior is clear enough to model as a schema transform without changing behavior. Example: `escapeLocal` / `unescapeLocal` in `@beep/identity`.

---

<!-- batch FB -->
# S1 Rule Card Notes - batch FB

## React package refinements

- In `@beep/editor`, React component prop interfaces remain S1 exceptions when they primarily carry `ReactNode`, DOM events, `React.ComponentProps`, `LexicalEditor`, or render callbacks. Durable data still needs to be traced to the schema that owns it.
- Do flag non-React factories inside UI packages when they create schema-modeled runtime data from untyped inputs. Examples from this batch: `$createArtifactRefNode` and `$createYouTubeNode` construct Lexical nodes whose serialized contracts are already pinned to `@beep/lexical-schema`.
- Callback schemas declared with `S.declare` can be a legitimate endpoint for UI callbacks whose values are live framework handles or Promise-returning sources. Examples: editor `EditorEffect` and `MentionSource`.

## Utility-package refinements

- In `@beep/types` and `@beep/utils`, generic mapped/conditional type utilities, dual-arity overload surfaces, and third-party adapter overloads should be recorded as exceptions instead of actionables unless they describe a concrete decoded/persisted payload.
- Node/Bun compatibility overloads can need inline literal option structs for return-type narrowing. Example: `FileSystem.readdirSync({ withFileTypes: true })` beside the schema-backed general options model.
- Atom runtime command envelopes with live UI/framework handles are port boundaries. Follow the data they produce; if the surviving value is schema-modeled, the command envelope is usually not an S1 target.

---

<!-- batch FC -->
# S1 Rule-Card Notes - Batch FC

Packages audited:

- `@beep/html` (`packages/foundation/modeling/html`)
- `@beep/nlp` (`packages/foundation/modeling/nlp`)
- `@beep/rdf` (`packages/foundation/modeling/rdf`)

## Detector Refinements

- Treat bidirectional adapter functions between two schema-owned DTO families as strong `SFV4-boundary-codec` candidates. In `@beep/rdf`, `EvidenceSelector`/`EvidenceTarget`/`EvidenceAnchor` and the Web Annotation DTOs are all schema-owned, but the adapter boundary currently lives in paired functions. Prefer a named `S.decodeTo(..., { decode: SchemaGetter.transform(...), encode: SchemaGetter.transform(...) })` codec, with existing functions kept as wrappers when public API stability matters.
- Treat exported decode wrappers around inline schema expressions as `SFV4-fn-schema` only when naming the schema would expose a reusable domain contract. In `@beep/nlp`, `PatternFromString` is actionable because the parsing schema expression is the actual contract and can become a named schema with codec statics.
- Treat schema-modeled static data that disagrees with a parallel runtime table as actionable `schema-first-inventory`. In `@beep/nlp`, `KindContainment` defaults and `KindContainment.containment` disagree, so the target is one schema-owned data value rather than another helper.
- For generated data ingestion scripts, generic `readJson<T>` plus `UnknownFromJsonString` only proves JSON syntax. If the generator relies on structured document fields, record `SFV4-boundary-codec` and target `S.fromJsonString(documentSchema)` / `S.decodeUnknownEffect`.

## Escape Hatches

- Companion namespace `Type` / `Encoded` projections beside `S.Class` / `S.TaggedClass` declarations are not findings when the runtime truth is already the colocated schema. This includes leaf nodes and recursive schema surfaces.
- Test-local decode/encode aliases are not helper-wall findings when they are unexported assertion helpers invoking the package schema directly.
- Operation definitions, generic Kleisli arrows, type-class dictionaries, Graph/HashMap-backed indexes, and callback-bearing algorithm surfaces stay outside S1 schema-ification.
- Overloaded builder DSLs and constructor conveniences should usually be exceptions when they normalize into schema classes via `.make(...)` or schema decode and preserve public data-first/data-last ergonomics.
- Serialization, sorting, equivalence, and normalization helpers over already schema-typed values are not `Fn` targets by default. They derive lexical strings, booleans, or ordering from schema values; wrapping them in `Fn` would usually add call-time validation without moving a domain invariant into a schema.
- Schema annotation helpers and AST metadata introspection should be exceptions when metadata construction already decodes through a schema and reads preserve optional annotation behavior.

## Verified API Notes

- `S.decodeTo` and `SchemaGetter.transform` are the correct Effect v4 pair for total bidirectional schema transformations. Verified in `.repos/effect-v4/packages/effect/src/Schema.ts:5408` and `.repos/effect-v4/packages/effect/src/SchemaGetter.ts:499`.
- `S.fromJsonString(schema)` is the current v4 JSON-string boundary codec constructor; pair it with `S.decodeUnknownEffect` or the repo's codec statics depending on the call site.
- `S.is(schema)` and `S.decodeUnknownResult(schema)` remain valid v4 helpers, but one-off schema-derived helpers are not automatically S1 findings when they stay adjacent to the schema and serve a single runtime boundary.

---

<!-- batch FD -->
# S1 Rule-Card Notes - Batch FD

Package audited:

- `@beep/schema` (`packages/foundation/modeling/schema`)

## Detector Refinements

- Treat exported pure payload aliases inside schema-modeled source as strong `schema-first-inventory` candidates even inside `@beep/schema`. `CuidSeed` is the fixture: it is an exported seed DTO with numeric/byte/string fields and no schema, while nearby modules already use `S.Class`, `S.Uint8Array`, and local integer schemas.
- Treat hand-rolled parser probes as `SFV4-boundary-codec` only when a verified Effect v4 codec is a direct fit and no trust-boundary semantics are being preserved. `URL.isURLStr` is actionable because the same file already uses `S.decodeUnknownOption(S.URLFromString)` for `HttpsUrl`.
- Do not flag the schema package's own factory constraints as payload models. Examples: `Csv.RowSchemaWithFields`, `FnSchemaUnary`, `VariantSchema.Struct`, `Model.FieldOption`, `GraphFromSelf`, and `MutableHashMap` are public schema-constructor/type-level surfaces whose values are schemas or Effect runtime collections, not durable payload DTOs.
- For exported functions in schema-modeled files, require evidence that the function's parameter or return contract bypasses a schema. Constructors/factories that take `S.Top`, return `S.decodeTo`, return `S.Class` instances, or preserve overload ergonomics are usually escape hatches rather than `Fn` targets.

## Escape Hatches

- `Graph` and `MutableHash*` hits are mandatory S1 exceptions. The SPEC explicitly fences them out; their interfaces in `@beep/schema` are schema constructors around Effect runtime values, not data models to be converted to `S.Class`.
- Security/trust-boundary helpers such as `SafeRemoteHost.assertAllowedRemoteUrl` should not be auto-rewritten to boundary codecs. The visible `new URL` parse, host normalization, allowlist, injected resolver callback, and typed `BlockedHostError` construction are part of the audit surface.
- Parser-local schema-derived aliases such as the SemVer `S.is(...)`/`S.decodeUnknownOption(...)` helpers are not actionable helper walls when they remain private and feed a named `S.Class`/`S.decodeTo` codec.
- Overload surfaces for builder DSLs and typed-error constructors are false positives when durable payloads already live in schemas and the remaining plain object types only describe partial-application call shapes.

## Verified API Notes

- `S.URLFromString` is the current Effect v4 URL string codec (`.repos/effect-v4/packages/effect/src/Schema.ts:10320`, `:10338`), and `S.decodeUnknownOption` is available at `:1500`.
- `S.decodeUnknownEffect`, `S.decodeTo`, `S.fromJsonString`, `S.Class`, `S.Finite`, `S.Int`, and `S.Uint8Array` were re-verified in `.repos/effect-v4/packages/effect/src/Schema.ts` before being cited in this inventory.
- `Fn.implementSync` / `Fn.implement` / `Fn.implementEffect` split is defined by this package's own `Fn` primitive; do not make the detector suggest wrapping `Fn` internals in `Fn`.

---

<!-- batch FE -->
# S1 Rule-Card Notes - Batch FE

Package audited:

- `@beep/data` (`packages/foundation/primitive/data`)

## Detector Refinements

- Keep `SFV4-fn-schema` narrow: require a schema-modeled file signal plus an exported function/arrow with an inline object parameter or return contract. Data-only facades such as `@beep/data/MimeTypes` may export typed function aliases, but without `S.Class`/`S.Struct`/`Fn` in the file and without inline object contracts they are not function-schema bypasses.
- Treat public `typeof ...Values[number]` and indexed-access aliases in `@beep/data` as data-source projection aliases, not automatic `schema-first-inventory` candidates. The existing detector already skips non-type-literal aliases; this package confirms that behavior is important for generated registry facades.
- Distinguish generated registry facades from hand-authored public finite-domain tables. `Blockchain.Networks` is hand-authored source with no downstream schema wrapper, so it is a judgment S1 candidate; generated registries such as currency, territory, timezone, MIME, and calendar data should stay raw in `@beep/data` and feed downstream schemas.

## Escape Hatches

- `@beep/data` is the primitive data-source package and does not depend on `@beep/schema`; adding schema annotations or `Fn` wrappers in this package would invert the established dependency direction. Downstream wrappers are the right schema home, as shown by `CurrencyCode`, `Timezone`, `TerritoryNameFromCode`, `MimeType`, and `FileExtension`.
- MIME `lookup` intentionally mirrors the vendored `mime-types` compatibility surface, including `false` for misses and broad path/extension input. S2/S4/S5 own normalization, sentinel, precision, and helper-shape tuning; S1 should not also flag the facade as a function-schema bypass.
- Tests and dtslint files here are excluded or fixture-only for S1. They assert raw data integrity and type-level assignability, not durable payload models that should be converted to schemas inside `@beep/data`.

## Verified API Notes

- No new Effect v4 Schema API was needed for this batch's findings. Local schema targets were verified against repo source: `LiteralKit` overloads at `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:743-748` and `MappedLiteralKit` at `packages/foundation/modeling/schema/src/MappedLiteralKit/MappedLiteralKit.schema.ts:348`.
- `Struct.entriesNonEmpty` and `Struct.keysNonEmpty` are repo-local helpers verified at `packages/foundation/modeling/utils/src/Struct.ts:519` and `:570`; existing wrappers use them in `CurrencyCode.ts:43` and `TerritoryCode.ts:54`.

---

<!-- batch FF -->
# S1 Rule-Card Notes - Batch FF

Package audited:

- `@beep/ui` (`packages/foundation/ui-system/ui`)

## Detector Refinements

- For React UI packages, keep `SFV4-fn-schema` focused on exported functions in schema-modeled files whose parameter or return contract is a first-party data payload. React components, hooks, `forwardRef` callables, `React.FC` exports, and JSX render callbacks should be escape hatches unless they carry a non-UI data model that is not otherwise schema-backed.
- Treat files with `LiteralKit` or a small local `S.Class` as "schema-modeled" only after checking the hit kind. This package has many schema-modeled UI files where the actual schema is already the finite domain (`ThemeMode`, `ToastVariant`, `NotificationAction`, `BoundaryParams`) and the remaining exported functions are component/hook surfaces.
- Let the detector flag split schema/guard pairs when the guard duplicates a schema-owned invariant. `country-select.tsx:401` is the concrete fixture candidate: `CountryCode` is the `LiteralKit` source of truth, but `isCountryCode` scans `countryOptions` instead of deriving from `S.is(CountryCode)`.
- Keep `schema-first-inventory` candidates for primitive aliases with named validation helpers. `phone-input.tsx:86` / `:146` is the concrete fixture candidate: `PhoneNumberE164` is a bare `string` alias while `isValidPhoneNumberE164` carries the invariant.

## Escape Hatches

- Component prop interfaces in `@beep/ui` are normally carve-outs: `UploadBoxProps`, `NotificationCardProps`, `CountrySelectProps`, `PhoneInputProps`, `ToastRootProps`, and similar surfaces extend DOM/React/third-party props and carry callback ports. Schema the durable payloads inside them, not the whole JSX prop bag.
- Hook option/result surfaces are also carve-outs when they include callbacks, React state controls, or third-party SDK handles. Examples from this pass: `UseNumberInputOptions`, `UseScribeOptions`, `UseScribeResult`, and `ThemeModeControls`.
- Third-party adapter shapes should not be schema-ified automatically: D3 mutates `GraphNode`/`GraphLink`, `react-dropzone` owns many upload options, MUI owns theme option aliases, Base UI owns toast object props, and ElevenLabs owns realtime transcript/error message payloads.
- Single-use local schema-derived guards/decoders are not enough for an actionable helper-wall finding. `isNumberInputText`, `isNumberInputEventKey`, and `decodeSpinnerSchedule` are local aliases over nearby schemas; they are cleanup candidates only if a broader helper wall accumulates.

## Verified API Notes

- Effect v4 APIs cited for proposed targets were re-checked in `.repos/effect-v4`: `S.is` at `Schema.ts:1256`, `S.decodeUnknownResult` at `:1564`, `S.optionalKey` at `:2270`, `S.String` at `:2968`, `S.Struct` at `:3403`, `S.NullOr` at `:4829`, `S.makeFilter` at `:6393`, `S.makeFilterGroup` at `:6458`, `S.isPattern` at `:6521`, `S.OptionFromOptionalKey` at `:8668`, `S.fromJsonString` at `:10983`, `S.File` at `:11015`, `S.Finite` at `:11380`, and `S.Class` at `:12696`.
- `LiteralKit` helper reality was re-checked locally: helper statics are declared at `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:657`, per-literal `.is` guards at `:659`, `.toTaggedUnion` at `:667`, overloads at `:743-748`, and guard construction at `:257`.
- In-repo exemplars used for target shaping: `CurrencyCode` + `isCurrencyCode` at `packages/foundation/modeling/schema/src/CurrencyCode.ts:43` and `:118`; `HexColorInput` / `HexColor` string schemas at `packages/foundation/modeling/schema/src/Color/Color.hex.ts:114` and `:143`; `ToastData` at `packages/foundation/ui-system/ui/src/components/toast.tsx:135`; and `CountryOption` at `packages/foundation/ui-system/ui/src/components/country-select.tsx:324`.

---

<!-- batch DA -->
# S1 Rule Card Notes - batch DA

## ACP driver refinements

- Treat ACP service shapes and protocol handles as durable S1 exceptions when their members are `Context.Service` shapes, `Stdio`, `Layer`, `Stream`, unstable RPC protocol services, `HashSet`, callbacks, overload surfaces, or Effect-valued resource operations. Examples: `AcpAgentShape`, `AcpClientShape`, `AcpPatchedProtocol`, `AcpTerminal`, and `MakeTerminalOptions`.
- Derived option interfaces that extend a schema-backed data class are still exceptions when the added fields are live callbacks or runtime handles. Examples: `AcpAgentOptions`, `AcpClientOptions`, and `AcpPatchedProtocolOptions` extend `AcpProtocolLoggingOptions`, but the pure logging flags already live in the schema and the remaining fields are service-construction hooks.
- Schema-derived guard aliases are positive boundary evidence when they are direct `S.is(SomeSchema)` aliases used for transport/RPC classification. Do not flag aliases like `isAcpProtocolError` or `isAcpRequestError` as actionable helper walls. Do flag hand-rolled guards for the same schema-shaped payload, such as `isProtocolError` in `AcpProtocol.service.ts`, and target `S.is(AcpSchema.Error)` instead.
- Exported Effect.fn constructors returning live protocol/service handles are `SFV4-fn-schema` escape hatches even inside schema-modeled files. `makeAcpPatchedProtocol` should remain an Effect constructor over runtime handles; schema-as-truth applies to the ACP messages, log events, and RPC payloads that cross the boundary.
- Test helpers that export `S.Struct` JSON-RPC fixture builders are fixture boundaries, not package API. They should be ignored by `SFV4-fn-schema` tuning unless they start modeling durable package data instead of test wire envelopes.

---

<!-- batch DB -->
# S1 Rule-Card Notes - Batch DB

Packages scanned:

- `@beep/firecrawl` (`packages/drivers/firecrawl`)
- `@beep/runpod` (`packages/drivers/runpod`)
- `@beep/wink` (`packages/drivers/wink`)

## SFV4-fn-schema Heuristic Notes

- Keep the core heuristic: exported functions in schema-modeled files are candidates only when their parameter or return contract is a plain object/function shape that duplicates, or plainly warrants, a schema.
- Do not flag a function only because it is exported from a schema-modeled file when its parameter and return contracts are already schema classes, schema-derived literal domains, primitives with no extra invariant, or service/runtime handles.
- For effectful parser-style functions with stable input/output/error contracts, prefer an `Fn({ input, output, error })` schema plus `.implementEffect(...)`. `@beep/runpod` has a good fixture candidate: `packages/drivers/runpod/src/RunpodDocs.service.ts:205` `parseRunpodDocsIndex`.
- For static constructors on schema classes, consider a follow-up detector branch only when a plain object alias duplicates nearby schema fields. `@beep/firecrawl` fixture candidate: `packages/drivers/firecrawl/src/Firecrawl.errors.ts:269` `FirecrawlError.fromReason` accepts `FirecrawlErrorOptionsInput` next to `FirecrawlErrorOptions`.

## Escape Hatches From This Batch

- Service and port shapes: `FirecrawlShape`, `RunpodShape`, `RunpodDocsShape`, `WinkEngineShape`, `WinkVectorizerShape`, `WinkCorpusManagerShape`, `WinkUtilsShape`, `ScopedVectorizer`, and SDK client/watcher ports are legitimate carve-outs. They are service contracts or runtime ports, not data payload schemas.
- Third-party SDK boundary adapters: `FirecrawlSdkClient`, `FirecrawlSdkWatcher`, and opaque Firecrawl SDK request aliases used behind `typedUnknown` should not be treated as first-party schema payloads unless the driver intentionally takes ownership of the upstream protocol.
- Generic operation helper contracts: `JsonOperationSpec` and `VoidOperationSpec` in `@beep/runpod` tie generated descriptors to `S.ConstraintDecoder` handles; they are generic type-level helpers, not domain payloads.
- Schema-derived local guards/decoders that only centralize a boundary check are usually exceptions, not `SFV4-fn-schema`: examples include `decodeWith`, `emitWatcherEvent`, `decodeQueryValueOption`, `isRunpodError`, `isRunpodOperationDescriptor`, and `decodeDocumentIdOption`.
- Runtime-handle state is out of scope even when exported. `WinkEngineRuntimeState` intentionally includes a live `wink-nlp` runtime object; the serializable metadata is already modeled by `WinkEngineState`.

## Detector Refinement Ideas

- Suppress interfaces/type literals when the declaration name ends in `Shape` and the same file has `Context.Service<..., Shape>()`.
- Suppress exported interfaces documented with `@category services` when every member is function-like or Effect-returning.
- Suppress generic operation-spec contracts whose members are `S.ConstraintDecoder` handles plus generated descriptors.
- Keep hand-rolled validation separate from `SFV4-fn-schema`: Wink output decoders are actionable S1 findings, but they should be classified as schema-first-inventory/hand-rolled validation, not function-schema misses.

---

<!-- batch DC -->
# S1 Rule Card Notes - batch DC

## Driver boundary refinements

- Service, port, and runtime-handle shapes should stay exception-biased. Examples from this batch: `BoxShape`, `BoxStreamingOperations`, `XAiShape`, `XAiEndpointMethod` / `XAiStreamMethod` / `XAiWebSocketMethod`, `XAiWebSocketSession`, and `makeServerLayer`. Payload schemas can be crisp while the service surface remains a `Context.Service`, `Layer`, `Stream`, callback, or live session contract.
- Schema-derived decode/guard aliases are positive boundary evidence when they are direct aliases over Effect v4 schema APIs and used at one boundary. Examples: `decodeWith`, `isXAiEndpointDescriptor`, `decodeJsonOption`, `decodeJson`, and `decodeJsonLine`. Do not mark these actionable unless the helper hides hand-rolled parsing or a schema-fit object contract.
- Recursive `S.suspend` companion namespaces are durable S1 exceptions. The `SerializedData` / `SerializedDataList` / `SerializedDataMap` `Encoded` namespaces in Box are load-bearing type projections around the recursive schema graph, not replacement data models.
- Generated and generator-adjacent surfaces need two separate filters: hard-exclude generated output such as `packages/drivers/box/src/_generated/**`, and treat generator traversal state over `MutableHashSet` as a fence-6 exception rather than a schema target.
- Trust-boundary guards should not be collapsed into schemas by default. `DatasetLoader` keeps explicit SSRF/private-host checks and `TextStream.resolveLocalPath` keeps path allow-list resolution close to filesystem effects; these are security gates, not schema-as-truth defects.

## Actionable S1 patterns

- Static error constructors that accept plain `*OptionsInput` objects next to schema-owned error option classes are high-signal `SFV4-fn-schema` targets. `BoxError.fromReason` should move the input object contract into a named schema rather than maintaining a parallel type literal.
- Primitive subset aliases that duplicate part of a public schema union should be promoted into the model file. `XAiQueryScalar` is the scalar half of `XAiQueryValue`; making it a named schema lets both the public union and service decode helper share one truth.
- Public lower-level helpers in schema-modeled modules should not rely on inline option/result object contracts just because MCP tool-facing parameters are already schema-backed. `DatasetLoader`, `Jsonl`, and `Pipeline` all need named option/result schemas that can be reused by `StreamingTools` parameter classes.
- Existing ledgered nested `S.Struct` option envelopes in `@beep/nlp-mcp` should remain non-actionable until the dedicated extraction pass, but the target extraction should prefer reusing lower-level named option schemas (`TextStreamOptions`, future `JsonlReadOptions`, future dataset load options, future `PipelineProcessOptions`) rather than inventing tool-only duplicates.

---

<!-- batch DD -->
# S1 Rule Card Notes - batch DD

## Driver service and callback surfaces

- Treat aliases that simply name native service handles or provider callbacks as durable S1 exceptions when their payloads are already schema-modeled elsewhere. Examples from this batch: `PostgresDrizzleDatabase`, `PostgresPoolConfig`, `M365InteractiveAuthorizer`, `OpenAiCompatProvider`, `VeniceAIMethod`, and `VeniceAIStreamMethod`.
- `SFV4-fn-schema` should avoid Effect layer/model factories whose package-owned options are already `S.Class` values and whose remaining fields are service handles. Examples: `OpenAiCompatLanguageModel.makeFromProvider`, `OpenAiCompatLanguageModel.layerFromProvider`, `VeniceAiLanguageModel.make`, and `VeniceAiLanguageModel.model`.
- Inline `Context.Service` object shapes remain service-contract exceptions even when they appear in schema-modeled files. Example: `VeniceAiChat` has an inline `{ chat: ... }` service shape; the underlying request/response values are the schema-owned boundary.

## Decode and guard helper escape hatches

- Direct schema-derived helper aliases used to name one boundary decode or one overload discriminator are usually S1 exceptions, not actionables. Examples: `M365.decodeRequest`, `OpenAiCompat.decodeUnknownRecordOption`, `VeniceAI.decodeChatCompletionTextResponse`, `VeniceAI.isVeniceAIOperationDescriptor`, and the Postgres `isPostgresError` guards.
- Query normalization should be distinguished from those escape hatches: when a package loops over record entries and manually guards each value against a schema (`VeniceAI.normalizeQuery`), the better S1 target is a named record schema plus `S.decodeUnknownEffect(...)` mapped to the package error.

## Options and resolved config data

- Error-constructor option objects are recurring actionable S1 targets when they are plain type literals beside schema-backed error classes. This batch adds `M365ErrorOptionsInput` and `VeniceAIErrorOptions`, matching the earlier Box/Firecrawl pattern.
- Resolved runtime config can be schema-owned when it is pure data assembled from public config input. `VeniceAI` still has a local `ResolvedVeniceAIConfig` type literal; `M365` and `GovInfo` provide local exemplars with `ResolvedM365Config` and `ResolvedConfig` schema classes.

---

<!-- batch DE -->
# S1 RULE-CARD-NOTES batch-DE

## SFV4-fn-schema tuning notes

- Treat exported service shapes and adapter ports as escape hatches, even when they contain Effect- or Promise-returning function members. This batch had `FFmpegShape`, `PhoenixSdkShape`, `PhoenixShape`, `LoadedFaceDetector`, `FaceDetectionServiceShape`, `DrizzleClient`, `DrizzleShape`, `DuckDbClient`, `DuckDbShape`, and `HubSpotShape`.
- Treat higher-order resource/service callbacks as escape hatches. Examples: `FFmpegEventSink`, `FaceDetection.withDetector`, DuckDB transaction callbacks, and Drizzle transaction callbacks. The payloads may be schema classes, but the callback itself is a runtime port with generic Effect channels.
- Treat SDK/native-handle aliases as escape hatches, not schema candidates. Examples: DuckDB query parameters over `@duckdb/node-api` `DuckDBValue`, Drizzle `TableFor`/column-builder type projections, and Drizzle `columns = getColumns`.
- Treat direct schema-derived boundary decoders as non-actionable when they centralize error mapping at an external boundary: `decodeFfprobeOutput`, DuckDB `decodeRows`, HubSpot request/response decoders, and face-detection public model decoders. The detector should prefer walls that bypass schemas or duplicate logic, not one-line schema adapters at trust boundaries.
- Actionable positive examples from this batch: `FFmpeg.formatFrameFileName` and `FFmpeg.buildExtractFramesArgs` accept inline first-party option objects in a schema-modeled file. These should become named S.Class option schemas plus `Fn({ input, output }).implementSync(...)`.
- Static tagged-error constructors need a split heuristic: `PhoenixError.operation` is actionable because one overload accepts a plain `{ cause?: unknown }` object beside `PhoenixErrorOptions`; `HubSpotError.fromReason` is an escape hatch because both parameters are already schema-carried.

---

<!-- batch DF -->
# S1 Rule-Card Notes Batch DF

Packages: `@beep/uspto`, `@beep/libpff`, `@beep/sanity`, `@beep/uspto-mcp`, `@beep/anthropic`, `@beep/tika`, `@beep/m365-mcp`, `@beep/discord`, `@beep/ecfr`, `@beep/ai-provider-cli`, `@beep/onepassword-cli`, `@beep/pglite`, `@beep/rdf-canonize`, `@beep/federal-register`, `@beep/dol`, `@beep/courtlistener`.

## Detector Refinements

- Error-constructor inline option bags are high-signal SFV4-fn-schema candidates when the options duplicate fields already declared on a tagged error schema. Batch examples: `UsptoError.fromReason`, `LibpffError.fromReason`, and `TikaError.fromReason`. Preferred target is an adjacent `*ErrorOptions extends S.Class`, matching `GovinfoErrorOptions`.
- Function type aliases that are named runner ports should default to exception unless they describe a durable data contract. Batch examples: `AiProviderCliRunner` and `OnePasswordCliRunner`; their stable results are schema-backed, while `command` / `args` are runtime argv details supplied by the service.
- Layer factories with schema-backed config and `Layer.Layer<...>` output should be an escape hatch for SFV4-fn-schema. Batch examples: `makeServerLayer` in `@beep/uspto-mcp` and `@beep/m365-mcp`; the output is runtime MCP server wiring, not data.
- Schema-container helpers should be excepted. Batch example: `usptoDocumentFieldTiers = defineFieldTiers({ minimal: S.Struct(...), ... })`; the container members are already schema values and `defineFieldTiers` anchors the mcp-kit tier contract.
- Inline callback members remain actionable when both sides are schema-fit payloads and the callback is part of a public data/options contract. Batch example: `projectDocumentsWithinBudget` repeats the mcp-kit `mintFetchableHandle` callback shape; the shared target should be an annotated `Fn({ input: OversizedFieldProjection, output: FetchableHandle })`.

## Escape Hatches

- Service shapes and `Context.Service` contracts remain exceptions even when exported and even when every method payload is schema-backed. Batch examples: `UsptoShape`, `SanityShape`, `DiscordShape`, `EcfrShape`, `AiProviderCliShape`, and `OnePasswordCliShape`.
- Direct schema-derived decoders at trust boundaries should not be treated as helper walls when they centralize unknown HTTP/subprocess JSON decoding and do not hand-roll validation. Batch examples: USPTO response envelope decoders, Sanity request/response decoders, Discord raw response decoders, eCFR `runJson`, and tika-app `decodeTikaJsonRows`.
- Third-party type passthroughs and ambient declarations should be exceptions unless they become first-party domain payloads. Batch examples: `PgliteClientOptions = Pglite.PgliteClientConfig.Create` and the `rdf-canonize` ambient module declarations.

## Fixture Candidates

- Positive: `packages/drivers/uspto-mcp/src/UsptoDocumentTiers.ts:144` for an exported function with an inline options bag and function-typed member whose input/output are schema-modeled.
- Positive: `packages/drivers/uspto/src/Uspto.errors.ts:89` for an inline error-options object duplicating a tagged error schema.
- Negative: `packages/drivers/m365-mcp/src/Server.ts:46` for a schema-configured Layer factory.
- Negative: `packages/drivers/ai-provider-cli/src/AiProviderCli.service.ts:55` for an injected process runner port.

---

<!-- batch TA1 -->
# S1 Rule-Card Notes - batch TA1

Package/scope scanned:

- `@beep/repo-cli` (`packages/tooling/tool/cli`) part 1 only:
  `src/commands/{AIMetrics,Architecture,Codex,Corpus,CreatePackage,Docgen,Docs,Files}/**`
  plus `src/index.ts` for public-surface relevance.

## SFV4-fn-schema Heuristic Notes

- In tooling command modules, the strongest `SFV4-fn-schema` hits are exported workflow functions whose inputs are stable command option objects or parser result objects while the surrounding file already exports `S.Class`/`LiteralKit` models. Fixture candidates from this scan: `makeArchitecturePackageOperationPlan`, `DocgenLocalOptions` consumers, `resolveDocgenQualityTargets`, `aggregateGeneratedDocs`, `extractCorpusDocket`, and `classifyRecycleBinName`.
- Do not flag exported helpers only because they are dual overloads. If all data-bearing parameters and returns are already schema classes or LiteralKit domains, the overload object is a function-call ergonomics surface, not a schema-truth miss.
- Small parser/classifier result objects are worth catching when they cross module boundaries, especially `O.Option<{ ... }>` results whose fields later feed schema-modeled manifest rows. `extractCorpusDocket` and `classifyRecycleBinName` are good examples.
- For workflow options that include runtime-only values such as `Duration.Duration`, split the detector advice: schema-model the serializable selector/config fields and leave runtime handles or scheduler knobs as explicit carve-outs unless the package has an established schema for them.

## Escape Hatches From This Batch

- `*ServiceShape` and `*CommandServiceShape` declarations paired with `Context.Service<..., Shape>()` are fence-1 exceptions even when the service methods use schema-modeled payloads. Examples: `TemplateServiceShape`, `FileGenerationPlanServiceShape`, `TsMorphIntegrationServiceShape`, `CorpusCommandServiceShape`, and `FilesCommandServiceShape`.
- Adapter/runner ports with Effect-returning members are exceptions when their data payloads are already schemas. Examples: `TsMorphMutationAdapter` and `DocgenQualityWorkerEvalRunner`.
- Direct `S.is(...)` and `S.decodeUnknownEffect(...)` aliases at CLI flag boundaries should not be actionable S1 findings when they only attach command-specific `DomainError` text and delegate validation to existing schemas. Examples: CreatePackage kind/family decoders and Architecture stage/role decoders.
- Exported direct guard aliases over public schemas can be left to S4/static-colocation tuning. Examples: `Files.media.ts` file-extension guards.
- Schema JSON codecs (`S.fromJsonString`, `S.UnknownFromJsonString`) are positive boundary-codec evidence, not `SFV4-boundary-codec` findings; no `JSON.parse` hit was found in the assigned scope.

## Detector Refinement Ideas

- Suppress exported type literals named `*ServiceShape` when the same file declares `Context.Service<..., *ServiceShape>()`.
- Suppress exported function type aliases documented as `@category services` or used as runner/adapter injection ports when the input and output types are schema classes.
- Consider a detector branch for exported `O.Option<{ ... }>` parser results in schema-modeled files; these often mark small missing result schemas.
- Consider a detector branch for non-exported `*Options` type literals when they are used by exported functions in schema-modeled files. This catches `DocgenLocalOptions` and `RunDocgenForPackageOptions` without flagging local implementation-only work records.

---

<!-- batch TA2 -->
# S1 Rule-Card Notes - batch TA2

Package/scope scanned:

- `@beep/repo-cli` (`packages/tooling/tool/cli`) part 2 only:
  `src/commands/**` except `AIMetrics`, `Architecture`, `Codex`, `Corpus`,
  `CreatePackage`, `Docgen`, `Docs`, and `Files`; plus `src/internal/**` and
  `src/test/**`.

## SFV4-fn-schema Heuristic Notes

- In tooling internals, exported constructor helpers that assemble schema
  models from a stable anonymous object are strong `SFV4-fn-schema` candidates.
  Fixture candidate from this scan: `buildYeetVerdict`, whose output is
  `YeetVerdict.make(...)` but whose input remains a large anonymous object.
- Exported helpers with small inline "extras" objects are weaker but useful
  candidates when they are reused across schema-modeled target modules. Fixture
  candidate: `sourceMetadata(..., { version?, published? })`.
- Direct `JSON.parse` was checked with an AST pass in this assigned scope; no
  real call expressions were found, so there are no `SFV4-boundary-codec`
  findings for TA2.

## Escape Hatches From This Batch

- `*ServiceShape` type literals/interfaces paired with `Context.Service<..., Shape>()`
  are fence-1 exceptions. Examples: `ImageCommandServiceShape`,
  `CategorySelectionServiceShape`, `ReportRendererServiceShape`,
  `ResolverServiceShape`, and `UpdateApplierServiceShape`.
- Explicit `ForTesting`/`@category testing` helpers with inline object fixtures
  should not be automatic `SFV4-fn-schema` actionables when production payloads
  inside the fixture are already schemas. Examples:
  `shouldInstallProxyServiceForTesting`, `shouldRecoverGraphitiStackForTesting`,
  `closeoutGateStatesForTesting`, and `buildYeetRunPlanForTesting`.
- External tool-output boundary structs can stay `S.Struct` when they mirror
  non-owned JSON and are already annotated schema decoders. Examples:
  `FallowAuditRawReport` and sibling raw Fallow report decoders.
- Generic mapped-type utility overloads are type-level utilities, not schema
  payloads. Example: `optionalProp`.

## Detector Refinement Ideas

- Add a higher-confidence branch for exported functions in schema-modeled files
  whose return type is an `S.Class` and whose only parameter is an inline type
  literal; this catches `buildYeetVerdict` without sweeping dual overload helpers.
- Suppress exported symbols ending in `ForTesting` or documented with
  `@category testing` unless the helper returns a durable schema-modeled artifact
  consumed outside tests.
- Consider a detector branch for exported augmented/intersection payload aliases
  such as `Array<Row> & { columns: ... }`; these are high-value schema-as-truth
  misses because runtime property attachment and casts hide invariants from
  schemas.

## API Verification Notes

- Effect v4 APIs cited in this batch were verified against `.repos/effect-v4`:
  `S.Class`, `S.Struct`, `S.Array`, `S.optionalKey`, `S.Option`, and
  `S.Uint8Array`.
- `Fn.implementSync` was verified in the repo-local `@beep/schema`
  implementation at `packages/foundation/modeling/schema/src/Fn/Fn.schema.ts`.

---

<!-- batch TB -->
# S1 Rule-Card Notes - batch TB

Package/scope scanned:

- `@beep/repo-utils` (`packages/tooling/library/repo-utils`), excluding
  `test/fixtures/mock-monorepo/**` per orchestrator instruction.

## SFV4-fn-schema Heuristic Notes

- Exported constructor helpers in schema model files are strong candidates when
  their sole parameter is an object type alias rather than a schema. Fixture
  candidate from this scan: `makeSymbol(input: SymbolInit): Symbol`, where
  `Symbol` is an `S.Class` but `SymbolInit` is a hand-written object alias.
- Exported classifier helpers in schema taxonomy modules are strong candidates
  when both input and output payloads are object literals/type aliases. Fixture
  candidate: `getCandidateCategories`, whose input is an inline array of
  `{ category, confidence }` objects and whose output is `ScoredCategoryCandidate`.
- Direct `JSON.parse`/`JSON.stringify` call expressions were checked in `src/`;
  the production JSON boundary uses schema codecs and the shared `JsonUtils`
  wrappers instead, so there are no `SFV4-boundary-codec` findings for this
  package.

## Escape Hatches From This Batch

- `*Shape` service contracts paired with `Context.Service<..., Shape>()` are
  fence-1 exceptions. Examples: `FsUtilsShape` and `TSMorphServiceShape`.
- Third-party AST adapter unions are type-level utility surfaces, not schema
  payloads. Example: `OutlineDeclaration`, a union of `ts-morph` declaration
  node classes consumed by reader helpers.
- Single private decode helpers at a runtime boundary are weak hits when they
  already use schema codecs and have exactly one call site. Example:
  `decodeJsonString` wraps `S.fromJsonString(S.Json)` for `FsUtils.readJson`.
- Test-local decode walls in `test/**/*.ts` should stay outside production S1
  actionables unless the same helper wall appears in `src/`; this scan saw
  large test decode blocks for model assertions only.

## Detector Refinement Ideas

- Raise confidence for exported object aliases named `*Init`, `*Input`, or
  `*Candidate` in files that already export `S.Class`/`LiteralKit` schemas,
  especially when an exported function accepts or returns that alias.
- Suppress `*Shape` aliases/interfaces when the same file contains
  `Context.Service<Symbol, Shape>()`; these are service-contract carve-outs.
- Suppress exported unions whose members are imported from third-party AST or
  framework packages and whose consumers are adapter helpers rather than wire
  payloads.
- Add a helper-wall branch for clusters of three or more local
  `S.decodeUnknown*`/`S.is` constants in `src/` files. Prefer assisted output
  unless the target schemas already expose equivalent statics.

## API Verification Notes

- Effect v4 APIs cited in this batch were verified against
  `.repos/effect-v4/packages/effect/src/Schema.ts`: `S.Class`, `S.Struct`,
  `S.optionalKey`, `S.decodeUnknownEffect`, `S.decodeUnknownResult`,
  `S.decodeOption`, `S.is`, `S.Finite`, `S.makeFilterGroup`,
  `S.isGreaterThanOrEqualTo`, `S.isLessThanOrEqualTo`, and
  `S.fromJsonString`.
- Repo-local `Fn.implementSync` was verified in
  `packages/foundation/modeling/schema/src/Fn/Fn.schema.ts`.
- Repo-local schema statics exemplars were verified at
  `packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts`,
  `packages/tooling/library/repo-utils/src/TypeScript/models/TSSyntaxKind.model.ts`,
  and `packages/tooling/library/repo-utils/src/JSDoc/models/TSCategory.model.ts`.

---

<!-- batch TC -->
# S1 Rule-Card Notes - batch TC

Package/scope scanned:

- `@beep/repo-ai-metrics` (`packages/tooling/library/ai-metrics`)
- `@beep/repo-docgen` (`packages/tooling/tool/docgen`)

## SFV4-fn-schema Heuristic Notes

- Named object aliases that feed exported functions should be considered along
  with inline type literals. Fixture candidate from this batch:
  `summarizeTranscriptText(input: TranscriptTextSummaryInput)`, where the file
  already has schema-modeled transcript output and neighboring packages use
  input `S.Class` models.
- Static constructors on schema classes can hide type-literal contracts outside
  the current exported-arrow/function detector. Fixture candidates:
  `Doc.new(... options: DocNewOptions)` and
  `Class.new(... options: ClassNewOptions)` in `@beep/repo-docgen`.
- Existing schema unions duplicated by exported type aliases are high-signal
  S1 findings even when the alias is not a type literal. Fixture candidate:
  `CompilerOptionsInput = string | S.Schema.Type<typeof CompilerOptionsShape>`
  while `CompilerOptionsSchema` already exists.

## Escape Hatches From This Batch

- `dual(...)` overload object literals are overload surfaces, not function
  schema misses, when their parameters are already schema-modeled or primitive.
  Examples: `runAiMetricsRetentionDelete`,
  `runAiMetricsRetentionCompact`, `hashPrivateIdentifier`, and
  `runAiMetricsOtlpProjectionBatchExport`.
- `Context.Service` shapes and runtime adapter handles stay out of S1
  schema-ification. Examples: `ProcessShape` and `SourceShape` in docgen.
- Third-party ambient declarations should be suppressed. Example:
  `markdown-toc.d.ts` declares `MarkdownTocOptions` and `MarkdownTocResult`
  for `@effect/markdown-toc`.
- Static SQL/migration descriptor aliases are weak S1 hits when they are
  compile-time arrays checked with `satisfies` and never decoded. Examples:
  `MirrorTableProjection`, `MigrationColumn`, and
  `DerivedStorageMigration`.
- One or two local schema codec constants at a file boundary are often correct
  if they already use `S.decodeUnknownEffect` / `S.fromJsonString` and have a
  single boundary purpose. Dense walls of three or more row/JSON codecs should
  stay candidates for assisted cleanup.

## Detector Refinement Ideas

- Extend `SFV4-fn-schema` discovery beyond inline type literals to named
  aliases used by exported functions/static methods when the alias declaration
  is a pure object type and the file exports `S.Class`, `S.Struct`, or `Fn`.
- Suppress `dual(...)` overload declarations when no overload parameter or
  return is an inline object payload and the referenced named types are schema
  classes.
- Add a helper-wall branch for clusters of three or more local
  `S.decodeUnknown*` / `S.encodeUnknown*` constants in production source,
  especially when they decode row/result schemas defined directly above.
- Suppress `.d.ts` ambient module declarations and `Context.Service` payload
  shapes before emitting schema-first inventory records.

## API Verification Notes

- Effect v4 APIs cited in this batch were verified against
  `.repos/effect-v4/packages/effect/src/Schema.ts`: `S.Class`, `S.Struct`,
  `S.decodeUnknownEffect`, `S.encodeUnknownEffect`, `S.fromJsonString`,
  `S.OptionFromOptionalKey`, `S.withConstructorDefault`, and
  `S.UnknownFromJsonString`, plus primitive/collection helpers `S.Array`,
  `S.String`, `S.Boolean`, `S.Finite`, `S.Literal`, `S.toEncoded`,
  `S.encodeEffect`, and `S.encodeUnknownSync`.
- Repo-local `Fn`, `.implement`, `.implementEffect`, and `.implementSync` were
  verified in `packages/foundation/modeling/schema/src/Fn/Fn.schema.ts`.
- In-repo exemplars used for proposed targets include
  `packages/tooling/library/ai-metrics/src/source-discovery.ts:83`,
  `packages/foundation/capability/colors/src/internal/ColorsSchema.ts:66`,
  `packages/tooling/tool/cli/src/commands/Corpus/Corpus.schemas.ts:183`, and
  `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:294`.

---

<!-- batch TD -->
# S1 Rule Card Notes — Batch TD

## Packages

- `@beep/repo-configs` (`packages/tooling/policy-pack/repo-configs`)
- `@beep/ai-sync` (`packages/tooling/library/ai-sync`)
- `@beep/test-utils` (`packages/tooling/test-kit/test-utils`)
- `@beep/lint-rules` (`packages/tooling/policy-pack/lint-rules`)
- `@beep/infra` (`infra`)

## SFV4-fn-schema Heuristic Refinements

- Treat exported functions with inline object parameters as actionable when the package already has nearby schema-backed models and the input is a stable first-party payload. Example fixture candidate: `packages/tooling/library/ai-sync/src/validation.ts:89` (`validateRepoConfig`) can grow a `ValidateRepoConfigInput` S.Class and a `Fn({ input, output, error }).implementEffect(...)` wrapper.
- Keep generic injected-function ports as exceptions. Example fixture candidate: `packages/tooling/library/ai-sync/src/drift.ts:169` (`checkSourceDriftWithFetcher`) carries a generic fetcher with environment `R`; Fn would erase the port semantics rather than make the contract truer.
- Keep overload/dual helper surfaces as exceptions. Example fixture candidates: `packages/tooling/policy-pack/lint-rules/src/rules/utils.ts:351` (`toRepoPath`) and `:379` (`pathMatchesSuffix`) intentionally expose data-first/data-last overloads via `dual(2, ...)`.
- Constructor/factory functions that immediately decode through an adjacent schema or return an S.Class instance should not be auto-actionable unless they carry an inline object contract that bypasses the schema. `repo-configs` has several valid boundary constructors (`defineNextConfig`, `defineBeepNextConfig`, secure header helpers) that are already schema-backed.

## Schema-First Inventory Escape Hatches

- Recursive `S.suspend` schemas may need a same-named type anchor before the schema const. Example fixture candidates: `packages/tooling/policy-pack/repo-configs/src/next/models/Turbopack.schema.ts:25` (`JSONValue`) and `:171` (`TurbopackRuleCondition`). These should be inventoried as exceptions, not rewritten blindly to `typeof Schema.Type`.
- Schema-class constructor input aliases over `Partial<SchemaClass> | undefined` are false positives when the implementation decodes through the schema before use. Example fixture candidates: `packages/tooling/test-kit/test-utils/src/SqlTest.ts:203` and `:261`.
- Runtime handle and port interfaces remain exceptions: `SqlTestDriver` includes `Layer` factories and `Context.Key`; `PgliteTestcontainerResource` includes a live `StartedTestContainer`; `OipWebRuntimeSecrets` contains Pulumi secret `Input<string>` values.
- Third-party AST adapter types are exceptions when they mirror parser-provided node unions (`AstNode`, `MemberAccess`). A smaller normalized first-party union such as `ImportBinding` remains actionable because it is repo-authored data with a `kind` discriminator.

## Boundary Codec Notes

- JSONC parsers should not be auto-rewritten to `S.fromJsonString`; they intentionally accept comments/trailing commas and should re-enter schema decoding after parse. Fixture candidate: `packages/tooling/policy-pack/repo-configs/src/internal/eslint/EffectLawsAllowlistSchemas.ts:69`.
- Direct `JSON.stringify` can be a false positive when rendering a closed codegen string literal or provider-required policy string. Fixture candidates: `packages/tooling/library/ai-sync/src/generator.ts:59` and `infra/src/OipWeb.ts:520`.

## Positive Fixture Candidates

- `infra/src/OipWeb.ts:485`: Pulumi string config is cast to a LiteralKit type. This should be decoded through `S.decodeUnknownResult(...)`, matching `infra/src/Storybook.ts:93-104` and `infra/src/AIMetrics.ts:39-50`.
- `packages/tooling/test-kit/test-utils/src/SqlTest.ts:276`: bare string-literal mode alias should become a `LiteralKit` domain, matching nearby `TestDatabaseDriver` and `PgExternalIsolationMode`.
- `packages/tooling/policy-pack/lint-rules/src/index.ts:124`: exported `RULES` metadata registry should get a schema-backed rule metadata model when the literal-domain work lands.

---

<!-- batch AA -->
# S1 Rule-Card Notes - batch AA

Package/scope scanned:

- `@beep/oip-web` (`apps/oip-web`), excluding `.next/**`.
- `@beep/professional-desktop` (`apps/professional-desktop`).
- `@beep/architecture-lab-proof` (`apps/architecture-lab-proof`).
- `@beep/storybook` (`apps/storybook`), excluding `storybook-static/**`, `node_modules/**`, and local caches.

## SFV4-fn-schema Heuristic Notes

- App route and adapter modules produce many legitimate framework-surface hits. Next.js route handlers (`GET`, `POST`, page props, `generateMetadata`, and `RootLayout`) should be suppressed unless the function constructs a first-party wire payload whose shape is not already carried by a schema.
- Stronger app findings are injected workflow aliases where the surrounding code has already decoded a payload schema but the alias still accepts `unknown`. Fixture candidate from this batch: `ContactRouteResponse.SubmitContact`, because `readContactFormPayload` returns the contact payload schema before invoking the injected workflow.
- Machine-readable payload builders are worth a judgment-tier branch even outside schema-modeled files. Fixture candidate: `makeJsonLdGraph(content)`, which builds JSON-LD with an inferred object return shape. This branch should stay low-confidence unless the payload is emitted over HTTP, script JSON, storage, or another wire boundary.
- Promise-returning app functions should not be flagged by default when they exist only to satisfy framework boundaries and their resolved value is already schema-modeled. Examples: `getOipSiteContent`, `GET`, `POST`, and Next page/layout functions.
- Exported Effect values should not be treated as missing `EffectSchema` automatically. `runArchitectureLabProof` is an executable workflow requiring `WorkItemServer`, while its success value is already an `S.Class`.

## Escape Hatches From This Batch

- Browser/platform boundary objects such as `FormData`, `Request`, `Response`, `NextRequest`, and `NextResponse` are not schema payloads by themselves. Flag only the first-party object extracted from them when that object bypasses an available schema.
- One-use boundary decoders are not helper walls when they sit at a real unknown boundary and delegate directly to a schema. Examples: `decodeSidecarTransport`, `decodeInboundFrame`, `decodeSidecarClosedPayload`, `decodeJsonContactSubmissionPayload`, and `decodeWorkItemId`.
- `Context.Service` port interfaces remain fence-1 exceptions. Example: `UsageRecordSinkShape`.
- App-local adapter factories over acquired services should be suppressed when a separate RPC or HttpApi schema is the public wire contract. Examples: `makeChatOperations` -> `ChatRpcs` and `makeOipContactHttpApiWebHandlerWithSubmit` -> `OipHttpApi`.
- Fixture helpers should be suppressed when they exist for smoke/contract tests and delegate directly to a shared schema. Example: `decodeWorkspaceId` in `ChatFixtures.ts`.

## Detector Refinement Ideas

- Suppress Next.js framework signatures by file/path convention (`src/app/**/route.ts`, `src/app/**/page.tsx`, `src/app/**/layout.tsx`) unless the detector sees an inferred object return that is later serialized or injected as JSON.
- Add a high-signal branch for function aliases whose input is `unknown` while the same file has a nearby schema decoder producing a narrower payload before invocation.
- Add a low-confidence branch for exported JSON/JSON-LD builders returning inferred object literals. Require evidence of serialization (`Response.json`, script `application/ld+json`, `S.UnknownFromJsonString`, or `S.Json`) before surfacing.
- Keep a boundary-decoder suppression for one or two local `S.decodeUnknown*` constants with a single unknown-boundary use; reserve helper-wall findings for repeated decode/guard clusters or exported aliases that bypass statics.

## API Verification Notes

- Effect v4 APIs cited in this batch were verified against `.repos/effect-v4/packages/effect/src/Schema.ts`: `S.Class`, `S.Struct`, `S.TaggedUnion`, `S.NonEmptyString`, `S.OptionFromNullOr`, `S.decodeUnknownEffect`, `S.decodeUnknownSync`, `S.decodeUnknownResult`, `S.is`, `S.encodeUnknownSync`, and `S.UnknownFromJsonString`.
- Repo-local `Fn`, `.implement`, `.implementEffect`, and `.implementSync` were verified in `packages/foundation/modeling/schema/src/Fn/Fn.schema.ts`.
- Repo-local `EffectSchema()` was verified as a factory in `packages/foundation/modeling/schema/src/EffectSchema.ts`; `PromiseSchema` was verified as a value in `packages/foundation/modeling/schema/src/PromiseSchema.ts`.
- In-repo exemplars used for proposed targets include `packages/foundation/capability/colors/src/internal/ColorsSchema.ts:66`, `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:94`, `apps/oip-web/src/contact/ContactSubmission.http.ts:38`, `apps/oip-web/src/contact/ContactSubmission.http.ts:66`, and `apps/oip-web/src/app/api/contact/ContactHttpApiRoute.ts:14`.

---

<!-- batch AB -->
# S1 Rule-Card Notes - batch AB

Package/scope scanned:

- `@beep/agents-domain` (`packages/agents/domain`).
- `@beep/agents-use-cases` (`packages/agents/use-cases`).
- `@beep/agents-server` (`packages/agents/server`).
- `@beep/agents-client` (`packages/agents/client`).

## SFV4-fn-schema Heuristic Notes

- Strong hits in this batch were exported workflow/atom functions in schema-modeled files whose write/return shape is still inline. Fixture candidates: `scanChunk` returns a raw `[ScanState, Array<string>]` tuple while `ScanState` is an `S.Class`; `createThreadAtom` accepts an inline write object that duplicates the `CreateThreadRpc` payload schema.
- Do not flag exported mappers just because they are functions over schema-derived values. `inlineToMd`, `blockToMd`, and `assistantContentToDocument` are pure projections from `AssistantBlock`/`InlineNode` into `@beep/md` schema classes, not missing input schemas.
- Atom/Reactivity selectors should be suppressed when their input is a schema-derived id and the returned value is a framework atom/query. Examples: `threadsAtoms`, `threadTimelineAtoms`, and `draftAtoms`.
- Runtime atom functions should be suppressed when the write input is already a named schema. Example: `runTurnAtom` writes `TurnRequest`, which is the tagged union of `SendTurnRequest` and `EditTurnRequest`.
- Function type aliases used as dependency-injection ports should be treated like service contracts. Examples: `BlockRepairCall` and `RepairInvalidBlocks`; their data payloads are already schema-modeled and the alias names an Effectful adapter capability.

## Escape Hatches From This Batch

- `Context.Service` and SDK facade interfaces stay interfaces. Examples: `AgentTurnKernelShape` and `ProfessionalRuntimeSdk`.
- Deterministic fixture decoders are not helper walls when they construct large fixture literals through schemas. Examples: `decodeBlock` in `AssistantTurn.fixture.ts` and `decodeOutputSet` in `ProfessionalRuntime.fixtures.ts`.
- Provider/tool boundary decoder clusters using `S.fromJsonString`, `S.Json`, or provider-adapted codecs should not be treated as ad-hoc parsing. Examples: `decodeEnvelopeJson`/`decodeJsonString`/`decodeJsonValue`/`decodeRepairedBlock` in `BlockRepair.ts`, and `decodeSlice` in `AnthropicTurnKernel.ts`.
- Browser/runtime configuration helpers are outside S1 unless they emit a first-party payload. `ClientObservabilityLive` uses runtime environment checks but exports a `Layer`, not a schema payload.

## Detector Refinement Ideas

- Add a branch for exported runtime atoms with inline object generic inputs (`ChatClient.runtime.fn<{ ... }>()`) when the surrounding file exports schemas or the same shape exists in an RPC payload declaration.
- Add a branch for exported tuple-returning state transitions in schema-modeled files, especially when one tuple element is an `S.Class` and the function is consumed by stream/scan machinery.
- Suppress `Atom.family((id: SchemaDerivedId) => ...)` surfaces unless the callback accepts an inline object or emits a first-party serialized payload.
- Suppress function type aliases whose docs or call sites show dependency injection/provider adapter roles and whose payloads are already schema classes.
- Suppress local decoder aliases at JSON/tool/provider boundaries when they use `S.fromJsonString` or a provider codec and have no local schema static surface to absorb them.

## API Verification Notes

- Effect v4 APIs cited in this batch were verified against `.repos/effect-v4/packages/effect/src/Schema.ts`: `S.Class`, `S.Struct`, `S.Tuple`, `S.Array`, `S.is`, `S.decodeUnknownEffect`, `S.decodeUnknownOption`, `S.decodeSync`, `S.fromJsonString`, `S.UnknownFromJsonString`, `S.OptionFromNullOr`, `S.OptionFromOptionalKey`, `S.TaggedUnion`, and `S.toTaggedUnion`.
- Repo-local `Fn`, `.implement`, `.implementEffect`, `.implementSync`, and `decodeInputSync` behavior were verified in `packages/foundation/modeling/schema/src/Fn/Fn.schema.ts`.
- In-repo exemplars used for proposed targets include `packages/foundation/capability/colors/src/internal/ColorsSchema.ts:66`, `packages/foundation/modeling/schema/src/ParserOptions/ParserOptions.types.ts:61`, `packages/foundation/modeling/ontology/src/Ontology.models.ts:695`, `packages/agents/client/src/Chat.atoms.ts:563`, `packages/agents/client/src/Chat.atoms.ts:619`, and `packages/agents/use-cases/src/processes/Chat/Chat.rpc.ts:67`.

---

<!-- batch AC -->
# S1 batch AC notes

Packages scanned:

- `@beep/architecture-lab-domain`
- `@beep/architecture-lab-use-cases`
- `@beep/architecture-lab-server`
- `@beep/architecture-lab-tables`
- `@beep/architecture-lab-config`
- `@beep/architecture-lab-client`
- `@beep/architecture-lab-ui`

## SFV4-fn-schema heuristic refinements

- Keep the current service/port escape hatch broad enough for client transports, repository ports, and use-case service shapes. Examples from this batch: `WorkItemClientTransport`, `WorkItemClientShape`, `WorkerUseCasesShape`, `WorkItemUseCasesShape`, `WorkerRepositoryShape`, and `WorkItemRepositoryShape`. Their method payloads are schema-backed commands/entities/errors, but the interfaces themselves are behavior ports.
- Treat exported factories over service/transport ports as an escape hatch unless they expose inline payload contracts. Example: `makeWorkItemClient(transport: WorkItemClientTransport): WorkItemClientShape` is only a facade over a port; an `Fn` schema would not add executable payload truth.
- Keep overload/dual surfaces out of SFV4-fn-schema unless an overload branch carries a plain inline payload object. Example: `toWorkItemSummaryViewModel` is a `dual` overload whose inputs and output are already schema-backed; wrapping it in `Fn` would remove the data-first/config-first public API.
- Consider a future companion heuristic for public static methods on exported schema classes. `WorkItemInvalidTransition.fromStatus(input: { ... })` duplicates its `TaggedErrorClass` fields but is not an exported function declaration/arrow initializer, so the current detector misses it. The better target is `TaggedErrorNewInput<typeof WorkItemInvalidTransition>` (verified at `packages/foundation/modeling/schema/src/TaggedErrorClass/TaggedErrorClass.errors.ts:84`) or direct `.make(...)`.

## Adjacent non-Fn observations

- Several same-name error union types are hand-written beside `S.Union` values or lack a value entirely. This is not SFV4-fn-schema, but it is a useful `schema-first-inventory` refinement candidate: detect `export type X = A | B | C` where every member is a schema class and either require `export const X = S.Union([...])` or derive `export type X = typeof X.Type`.
- Small top-of-file `S.is(...)` guard walls around tagged-error unions are easier to remove once those unions are schema values piped through `S.toTaggedUnion("_tag")`. Effect v4 exposes `match` and `guards` on that combinator (`.repos/effect-v4/packages/effect/src/Schema.ts:6036`-`:6094`).

---

<!-- batch AD -->
# S1 batch AD notes

Packages scanned:

- `@beep/epistemic-domain`
- `@beep/epistemic-use-cases`
- `@beep/epistemic-tables`
- `@beep/epistemic-server`
- `@beep/law-practice-domain`
- `@beep/law-practice-use-cases`
- `@beep/law-practice-server`

## SFV4-fn-schema heuristic refinements

- Keep service-port interfaces as durable S1 exceptions even when the method payloads are schema-backed. Examples in this batch: `ClaimGateShape`, `ClaimTransitionShape`, `OfficeActionReviewDeps`, and `OfficeActionReviewShape`. These are behavior ports over `Effect`, not wire/persisted/config payloads.
- Treat exported factories over service ports as escape hatches when their inputs/outputs are service shapes and no inline data payload is exposed. Examples: `makeClaimGate`, `makeClaimTransition`, `makeOfficeActionReview`, and `makeIrToLaw`; the stable payload contracts are either schema classes (`OfficeActionReviewInput`, `LawEntities`) or existing service ports.
- Keep Drizzle row aliases and table converters out of function-schema actionability when they are table-boundary adapters. `UsageRecordRow` / `UsageRecordInsert` come from `Table.$inferSelect` / `$inferInsert`, and `toUsageRecordInsert` / `fromUsageRecordRow` bridge the schema-backed `UsageRecord` entity to SQL row shape.
- Keep overload/dual helper surfaces as an escape hatch unless an overload branch carries a stable data payload that should be named separately. `spikeEntityInput` is an internal `dual` overload returning the schema-backed `EntityInput`; wrapping it in `Fn` would remove the public calling convention rather than improve schema truth.
- Do flag exported function type aliases whose whole contract is the function. `ClaimProjection` is a clear `Fn` target: input can be `S.Array(CandidateClaim)` and output is `ClaimProjectionView`, matching `Formatter` (`packages/foundation/capability/colors/src/internal/ColorsSchema.ts:66`) and `IrToLawShape.toLaw` (`packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:95`-`97`).

## Adjacent S1 observations

- Module-scope decode/encode helper walls are common in spike/use-case adapters. Some are legitimate boundary codecs (`UsageRecord` <-> Drizzle row, test fixtures), but repeated production walls such as `IrToLaw.service.ts` and `OfficeActionReview.service.ts` are better future candidates for named schema-backed construction boundaries.
- Internal function contracts can still reveal schema truth even when they are below the current exported-function detector. `anchorOf` returns an inline `{ startChar, endChar, quote }` object that duplicates `@beep/provenance` `TextAnchor`, which is already the schema used by `Distinction.anchor`.
- Effect v4 / repo API checks used this batch: `EffectSchema` is called as a factory in `IrToLawShape.toLaw` (`packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:97`), `Fn` exposes `implementSync` / `implement` / `implementEffect` in `packages/foundation/modeling/schema/src/Fn/Fn.schema.ts:169`, and `PromiseSchema` is a value at `packages/foundation/modeling/schema/src/PromiseSchema.ts:91`.

---

<!-- batch AE -->
# S1 Rule-Card Notes - batch AE

Packages: `@beep/workspace-domain`, `@beep/workspace-tables`, `@beep/workspace-server`, `@beep/workspace-use-cases`, `@beep/shared-domain`, `@beep/shared-tables`, `@beep/db-admin`.

## SFV4-fn-schema heuristic refinements

- Add a candidate branch for exported functions whose parameter or return annotation names a file-local object type alias in a schema-modeled file. Batch example: `packages/shared/domain/src/values/LocalDate/LocalDate.behavior.ts:46` uses `CalendarParts` for `make` / `makeOption` / `makeEffect`; that alias duplicates `LocalDate.Model` constructor fields but the landed detector only sees inline object type literals.
- Keep exported service constructors and runtime workflows exception-biased. Batch examples: `makeInMemoryThreadStore`, `makeDrizzleThreadStore`, `migrateOnBoot`, and `listDbAdminMigrationTargets`. Their payloads are already schema-backed, while the return values are service/runtime `Effect` workflows.
- Preserve overload and generic type-level utility surfaces. Batch examples: `EntityRef.makeResult` / `make` and `EntityId.factory`; `Fn` would erase the entity-specific generic relation rather than move a payload contract into a schema.

## Decode, guard, and boundary-codec notes

- Direct schema-derived guards are usually exceptions when they are public compatibility predicates or local classifier aliases, not parallel validation. Batch examples: `isOnePasswordReference` and `isLocalDate`.
- `S.declare` implementation predicates are not guard-wall actionables when the value is callable or behavioral and cannot be represented as an object struct. Batch example: `isIdentityComposer` backs `AnyIdentityComposer`.
- Positive boundary-codec fixture candidate: `LocalDate.fromString` duplicates the `LocalDateFromString` codec. The target is to route the public parser through `S.decodeUnknownEffect(LocalDateFromString)` after moving/ordering the codec so the ISO parse and calendar validation live in one schema transform.

## Table/package escape hatches

- Drizzle row aliases and converters remain S1 exceptions when the row type comes from `Table.$inferSelect` / `$inferInsert` and conversion passes through the domain schema. Batch examples: workspace `Message`, `Thread`, and `Turn` converters. SPEC fence 2 applies: SQL absence such as `parentTurnId` stays `null` at the row boundary.
- `DbSchema` object/type pairs in table packages are Drizzle metadata registries, not decoded payload schemas. Batch examples: `@beep/workspace-tables` and `@beep/shared-tables`.

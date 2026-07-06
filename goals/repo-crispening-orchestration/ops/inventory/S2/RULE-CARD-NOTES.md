# S2 Rule-Card Notes — merged from per-batch fragments (P1 baseline, 2026-07-05/06)


---

<!-- batch FA -->
# S2 Rule-Card Notes — batch FA

## SFV4-normalization refinements

- Treat explicit trust-boundary sanitizers as first-class escape hatches. Examples from this batch: `packages/foundation/modeling/md/src/Md.escape.ts:150` URL protocol normalization and `packages/foundation/capability/observability/src/CauseRedaction.ts:190` secret/path redaction. These should not be auto-suggested into schema transforms.
- Distinguish projection behavior from field normalization. `packages/foundation/modeling/identity/src/Id.ts:1165` (`toTitle`) and `Id.ts:1194` (`toSlug`) transform already-validated identifiers into display/accessor strings; `packages/foundation/modeling/md/src/Md.ts:331` trims template formatting whitespace before deciding whether to create a `Text` node. These are not codec leaks.
- Keep cross-package normalization visible. `packages/foundation/capability/semantic-web/src/adapters/jsonld-document.ts:435` lowercases JSON-LD `@language`, but the modeled field is owned by `@beep/rdf` at `packages/foundation/modeling/rdf/src/JsonLd.ts:317`; the detector should allow inventories to record cross-package proposed targets instead of forcing a local fix.
- Still flag modeled-field normalization when a schema exists nearby. `packages/foundation/capability/observability/src/CauseDiagnostics.ts:340` normalizes the chunk used in `CauseFingerprint.value` while the schema is bare `S.String`; this is a useful `SFV4-normalization` fixture candidate.

## SFV4-null-return refinements

- Exported helpers returning `undefined` remain strong candidates even when private Option helpers exist. `packages/foundation/modeling/identity/src/Curie.ts:89` / `:116` / `:143` are good examples: the implementation is already Option-first, but the exported fallback overloads expose `undefined`.
- Private parser helpers returning `undefined` should be lower severity but not invisible. `packages/foundation/modeling/identity/src/PnLocal.ts:102` can mechanically return `O.Option<ReadonlyArray<LocalUnit>>`; adjacent string-indexing guards in the same file are parser-boundary false positives and should be separate.
- Third-party or diagnostic adapters can legitimately return or consume `undefined`. Examples: `packages/foundation/capability/observability/src/experimental/server/OtlpPacketLab.ts:161` reads content types from Effect HTTP bodies; `packages/foundation/capability/semantic-web/src/adapters/shacl-engine.ts:84` uses a private sentinel after an already-Option schema field.

## Defaults / Option escape hatches

- Missing `SchemaUtils.withNoneDefault` on `S.OptionFromOptionalKey(...)` fields is a high-signal S2 pattern. This batch found it across `@beep/semantic-web` service contracts (`services/jsonld-document.ts:86`, `services/shacl-validation.ts:77`, `services/sparql-query.ts:75`, etc.).
- Presentation defaults should not be treated like schema defaults. Examples: `packages/foundation/modeling/md/src/Md.render.ts:268` renders absent code-fence language as an empty info string; `packages/foundation/capability/semantic-web/src/adapters/jsonld-document.ts:416` uses empty sort-key pieces for absent `@type` / `@language`.
- Third-party option bags need a boundary exception when the local wrapper is intentionally thin. Example: `packages/foundation/capability/observability/src/server/Prometheus.ts:52` mirrors Effect v4 `PrometheusMetrics.HttpOptions` and `/metrics` default behavior from `.repos/effect-v4/packages/effect/src/unstable/observability/PrometheusMetrics.ts:59-64` and `:175-190`.

---

<!-- batch FB -->
# S2 Rule-Card Notes - batch FB

## SFV4-normalization refinements

- Allowlist explicit sanitizer modules that are already consumed by schema getters. `packages/foundation/modeling/lexical/src/Lexical.normalize.ts:138` and `:160` trim/sanitize untrusted serialized style strings, but `Lexical.model.ts:619-620` and `:652-653` wire them through schema decode/encode. The detector should treat this as "already absorbed", not a fix target.
- Distinguish projection/output contracts from field normalization. `packages/foundation/modeling/lexical/src/Lexical.behavior.ts:74` trims the plain-text projection; `packages/foundation/modeling/pandoc-ast/src/Pandoc.report.ts:161` emits the RFC 6901 root pointer as `""`; `packages/foundation/modeling/utils/src/Struct.ts:416` formats rootless paths. These are formatter/projection features.
- UI search and command guards are noisy normalization false positives. `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:65` normalizes a transient query, and `packages/foundation/ui-system/editor/src/chat/atoms.ts:519` trims live editor content to suppress empty sends. Neither value is persisted or decoded into a domain model.
- Still flag clamp/coerce logic when a schema sits next to it. `packages/foundation/ui-system/editor/src/chat/attachment-model.ts:323` clamps `maxBytes` beside `AttachmentSizeBytes`; a named schema/codec for the capture limit would make a good `SFV4-normalization` fixture.

## SFV4-null-return refinements

- TypeScript assertion functions are false positives when the only `undefined` is the void success branch. Example: `packages/foundation/modeling/utils/src/Struct.ts:57` and `:72`.
- React components and plugins legitimately return `null` to render nothing. Examples: `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:103`, `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:351`, and `packages/foundation/ui-system/form/src/internal/FieldShell.tsx:75-77`.
- Third-party UI contracts can require `null`: `packages/foundation/ui-system/form/src/internal/FieldBinding.tsx:430` bridges date/time picker values where `null` is the empty value.
- Low-level primitive helpers in `@beep/utils` may expose an unsafe/nullish form only when the safe Option form also exists. Example: `packages/foundation/modeling/utils/src/internal/StructPath.ts:173` feeds `Struct.dotGet`; the public Option counterpart is the escape hatch.

## Defaults / Option escape hatches

- Optional React props and DOM attribute omission should be rule-card escape hatches. Examples: `packages/foundation/ui-system/editor/src/composer.tsx:50`, `packages/foundation/ui-system/form/src/internal/FieldBinding.tsx:284`, and `packages/foundation/ui-system/form/src/fields/ToggleField.tsx:37`.
- Schema-default bridges should not be flagged as body defaults. `packages/foundation/ui-system/form/src/core/FormOptions.ts:143` is the intended fallback from omitted TanStack `defaultValues` to `getEncodedDefaultFormValues(params.schema)`.
- Storybook `Default` exports and schema-default fixtures are test/demo vocabulary, not package debt. Examples: `packages/foundation/ui-system/editor/stories/chat-composer.stories.tsx:36` and `packages/foundation/ui-system/form/test/FormOptions.test.ts:16`.
- `@beep/types` and `@beep/utils` need package-charter allowlists: type-level conditional utilities such as `packages/foundation/primitive/types/src/TString.types.ts:30`, shared thunk helpers such as `packages/foundation/modeling/utils/src/thunk.ts:142`, and primitive string/text helpers such as `packages/foundation/modeling/utils/src/Text.ts:33` are the reusable vocabulary other packages should schema-wrap as needed.

---

<!-- batch FC -->
# S2 Rule-Card Notes - batch FC

## SFV4-normalization refinements

- Generated-output files must stay excluded, but generator source can still be the source of a future generated smell. In `@beep/html`, `packages/foundation/modeling/html/src/Html.model.ts` is generated and excluded; the actionable source is `packages/foundation/modeling/html/scripts/generate.ts:222`, which emits optional-key attribute fields.
- Codegen parser/naming normalization should be an escape hatch. `packages/foundation/modeling/html/scripts/generate.ts:102` uppercases class identifiers and `:174` trims Effect `SchemaRepresentation` source text before emission; neither is runtime field normalization.
- NLP operation/test payload transforms should be ignored when the transform is the behavior under test or the feature. Examples: `packages/foundation/modeling/nlp/test/Graph/GraphOps.test.ts:41` and the `IdentifierText` variant generator at `packages/foundation/modeling/nlp/src/IdentifierText.ts:40`.
- Still flag exported normalization helpers when schema codecs are nearby. Good fixtures from this batch: `packages/foundation/modeling/nlp/src/QueryText.ts:33` / `:54` and `packages/foundation/modeling/nlp/src/Core/PatternOperations.ts:110`, with same-package schema-transform exemplars in `Core/PatternParsers.ts:107-115`.
- RDF/URI canonicalization needs a split rule. `packages/foundation/modeling/rdf/src/Rdf.ts:1112` lowercases `LanguageTag` during serialization even though the schema owns the tag, so it is actionable. `packages/foundation/modeling/rdf/src/Uri.ts:362` is an explicit opt-in canonicalization utility and should be an exception.
- Serialization escaping is a trust-boundary escape hatch. `packages/foundation/modeling/rdf/src/Rdf.ts:1080` uppercases blank-node escape digits while preventing invalid label output; SPEC fence 4 applies.

## SFV4-null-return refinements

- Exported helpers that unwrap an existing Option to `undefined` are strong candidates. `packages/foundation/modeling/nlp/src/Core/PatternBuilders.ts:404`, `:453`, and `:510` should return `Option` instead of `undefined`.
- Private parser sentinels should be grouped and downranked, not exploded into one finding per branch. `packages/foundation/modeling/rdf/src/Iri.ts:33` defines `ParseEnd = number | undefined` for internal RFC parser control flow while the exported surfaces are schemas/checks.
- Upstream annotation bags need an Effect-specific escape hatch. `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:319` augments `effect/Schema` annotations with an optional property; this matches the verified v4 correction that annotations require optional access.
- Exported readers over optional annotation metadata can still be actionables. `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:460` returns payload-or-undefined and should prefer `O.Option` even though the upstream annotation bag itself is optional.

## Defaults / Option escape hatches

- Missing `SchemaUtils.withNoneDefault` on `S.OptionFromOptionalKey(...)` fields remains the highest-signal S2 default detector. This batch found it heavily in `@beep/nlp` core models and `@beep/rdf` metadata/PROV/JSON-LD models.
- Plain `S.optionalKey(...)` in source-of-truth domain schemas should be flagged even when the encoded key must stay optional. Examples: `packages/foundation/modeling/nlp/src/Graph/Schema.ts:85`, `packages/foundation/modeling/html/src/Html.attributes.ts:173`, and `packages/foundation/modeling/html/src/Html.nodes.ts:99`.
- Algorithmic lookup identities are defaults but not schema defaults. Examples: mutable-map counts in `packages/foundation/modeling/nlp/src/Algebra/NLPMonoid.ts:43`, TF-IDF smoothing at `:732`, vector combine zeroes in `packages/foundation/modeling/nlp/src/Algebra/Monoid.ts:447`, and search-index misses in `packages/foundation/modeling/nlp/src/Graph/GraphOps.ts:614`.
- Optional-options adapters to upstream APIs should be exceptions when the callee contract is explicitly `options?`. Example: `packages/foundation/modeling/nlp/src/Graph/GraphOps.ts:184` bridges Effect `Graph.bfs/dfs(graph, options?)`.
- External dataset/codegen defaults are boundary exceptions. HTML generator examples: `packages/foundation/modeling/html/scripts/generate.ts:192`, `:200`, `:252`, and `:265` default missing webref metadata while generating committed source.

---

<!-- batch FD -->
# S2 Rule-Card Notes - batch FD

## SFV4-normalization refinements

- `@beep/schema` has many true-positive-looking normalization helpers that are already inside schema codecs. Examples: `packages/foundation/modeling/schema/src/CommonTextSchemas.ts:36-43`, `:81-88`, and `:126-133` use `SchemaTransformation.transform`; `packages/foundation/modeling/schema/src/Semver.ts:397-404` feeds `SemverFromString` at `:626-630`; `packages/foundation/modeling/schema/src/Jsonl.ts:72` is inside the `JsonlTextToUnknown` decoder at `:103-107`. The detector should avoid flagging normalization when the containing function is the decode/encode implementation of a schema transformation.
- Parser behavior is distinct from schema-field normalization. `packages/foundation/modeling/schema/src/CsvParser/CsvParser.parser.ts:45-58` trims CSV fields according to decoded parser flags; this is the CSV codec's parsing behavior, not a missing field transform.
- Trust-boundary host/URL normalization must stay explicit. `packages/foundation/modeling/schema/src/SafeRemoteHost.ts:110` lowercases and bracket-strips hostnames for SSRF classification; SPEC fence 4 applies.
- Still flag exported utility normalization when a schema codec is nearby but absent. `packages/foundation/modeling/schema/src/BinaryFileExtension.ts:148-152` lowercases an extracted extension for `hasBinaryExtension`; a `BinaryFileExtensionFromPath` transformation schema would be a useful fixture.

## SFV4-null-return refinements

- Internal soft decoders returning `null` are strong candidates when callers immediately branch on null. Examples: `packages/foundation/modeling/schema/src/CryptoTxnHash/CryptoTxnHash.schema.ts:22-32` and `packages/foundation/modeling/schema/src/CryptoWalletAddress/CryptoWalletAddress.schema.ts:41-85`; both can return `Option<Uint8Array>`.
- UI adapter contracts can legitimately return `null`. `packages/foundation/modeling/schema/src/DateTimeUtcFromValid/DateTimeUtcFromValid.adapter.ts:114-120` bridges date/time picker empty values; keep this as a 3rd-party/UI boundary escape hatch.
- Encoded HTTP-header omission can legitimately use `undefined` when the decoded/domain side is already `Option`. Example: one-way secure-header transforms such as `packages/foundation/modeling/schema/src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts:137-144`.
- Exported helpers that duplicate an existing Option surface are still candidates. `packages/foundation/modeling/schema/src/Csp/Csp.schema.ts:824-830` returns `string | undefined`, while `ContentSecurityPolicyHeader.createValue` at `:885-904` already exposes `Effect<Option<string>, SecureHeaderError>`.

## Defaults / Option escape hatches

- Missing `SchemaUtils.withNoneDefault` on `S.OptionFromOptionalKey(...)` / `S.OptionFromUndefinedOr(...)` fields is especially high-signal in this package because `@beep/schema` owns the helper. Examples: secure-header error `cause` at `packages/foundation/modeling/schema/src/SecureHeaderError/SecureHeaderError.errors.ts:16`, `ResponseHeader.value` at `packages/foundation/modeling/schema/src/Http/Http.headers.shared.ts:171`, and secure header response values such as `CrossOriginEmbedderPolicy.schema.ts:104`.
- Same-value constructor + decode defaults should prefer `SchemaUtils.withKeyDefaults` / `BoolKeyDefaultFalse` / `BoolKeyDefaultTrue`. The raw Effect/Schema primitives are correct inside `SchemaUtils` implementation files, but not ideal in consumer schemas such as `ParserOptions.schema.ts:140-210` and `CsvCodecOptions.schema.ts:49-95`.
- Header config defaults are actionable when optional config fields are formatted with `??` or `P.isUndefined`. Examples: `ForceHttpsRedirectConfig.maxAge` plus `formatForceHttpsRedirectValue` at `ForceHttpsRedirect.schema.ts:40-42` / `:141-150`, and `ExpectCTConfig` at `ExpectCt.schema.ts:40-42` / `:133-163`.
- Arbitrary-generation and schema-factory internals need escape hatches. Examples: `MutableHashMap.ts:218-236` and `MutableHashSet.ts:180-194` default fast-check generation constraints; `EntitySchema.factory.ts:276` derives a table name from an identifier. These are schema-tooling defaults, not domain field defaults.

---

<!-- batch FE -->
# S2 Rule-Card Notes - batch FE

## Scope Notes

- Package scanned: `@beep/data` at `packages/foundation/primitive/data`.
- Generated and output surfaces were skipped: `src/generated/**`, `dist/**`, `docs/**`, `coverage/**`, `node_modules/**`, and other generated/build output.
- Hand-authored source was about 9k lines after excluding generated data. The only production S2 detector cluster was `src/internal/data/mime-types/index.ts`; public facades mostly re-export constant data.

## SFV4-normalization Refinements

- Useful true-positive fixture: `packages/foundation/primitive/data/src/internal/data/mime-types/index.ts:179` normalizes caller input for `lookup` by extracting an extension and lowercasing it in a function body. A small `S.decodeTo(..., SchemaTransformation.transform(...))` lookup-input schema would mirror existing normalization exemplars such as `packages/foundation/modeling/schema/src/CommonTextSchemas.ts:36-43` and `packages/foundation/modeling/schema/src/internal/email.ts:36-39`.
- Constant-data construction needs an escape hatch. `packages/foundation/primitive/data/src/internal/data/utils.ts:4` uses `Str.capitalize` to derive formal calendar literals from static lowercase arrays; this is not boundary normalization of user input.
- Tests need an escape hatch. `packages/foundation/primitive/data/test/keyboard-shortcuts.test.ts:56` uses `Str.capitalize` as a fixture invariant for curated shortcut rows; do not flag test assertions as schema-normalization targets.

## SFV4-null-return Refinements

- Private void/no-op branches should be low-signal unless they are exported or their result flows as domain absence. Examples from `packages/foundation/primitive/data/src/internal/data/mime-types/index.ts`: `setTypeMapping` at `:316`, lazy-cache guard at `:343`, and empty-extension map population at `:350`.
- The detector should distinguish `() => undefined` used only as a private mutation no-op from exported helpers whose return type includes `undefined`.

## Defaults / Option Escape Hatches

- Vendored API compatibility can legitimately terminate Option lookups with a non-nullish sentinel. `packages/foundation/primitive/data/src/internal/data/mime-types/index.ts:195` and `:271` convert lookup misses to `false` to preserve the `mime-types.lookup`-style public contract.
- Local `extname` compatibility can legitimately default to `""`. `packages/foundation/primitive/data/src/internal/data/mime-types/index.ts:172` mirrors Node `path.extname` behavior in an edge-compatible private helper.
- Vendored mime-db source precedence can include `undefined` as an ordered source bucket. `packages/foundation/primitive/data/src/internal/data/mime-types/index.ts:278` should be an escape hatch unless `undefined` starts flowing into exported decoded domain data.

---

<!-- batch FF -->
# S2 Rule Card Notes - Batch FF

## Scope Notes

- Package scanned: `@beep/ui` at `packages/foundation/ui-system/ui`.
- This is a large React UI package, so component props, JSX render-null returns, `cva` defaults, theme `defaultProps`, controlled-input sentinels, and third-party adapter option bags were treated as boundaries unless the data was already schema-modeled or exported as a reusable parsing/lookup helper.
- Generated/build outputs and vendored dependency trees were not scanned. Effect/Schema APIs cited in findings were verified against `.repos/effect-v4`, and repo helper targets were verified against live `packages/foundation/modeling/schema` source.

## SFV4-defaults Refinements

- Strong positives in this package are schema-modeled records whose renderers or hooks immediately supply the same semantic defaults: `NumberInput` numeric params, `NotificationActionFields.executed/style`, `ToastData.variant`, and `CountryOption.callingCode`.
- React-only defaults should remain out of scope: component default props, `cva` `defaultVariants`, MUI theme `defaultProps`, upload/dropzone option bags, and ElevenLabs SDK hook options. These are adapter or presentation defaults, not domain/model defaults.
- Empty string is only actionable when it enters a schema-modeled data record (`CountryOption.callingCode`) or an exported reusable value parser (`parsePhoneDraft`). Empty string in a controlled input prop remains a JSX boundary.

## SFV4-normalization Refinements

- Actionable normalization was limited to exported reusable parsers or schema-adjacent values: `toNumber` and `parsePhoneDraft`.
- Trust-boundary normalization must be kept explicit. `src/lib/url.ts` trims/lowercases protocol candidates as part of an href sanitizer, and `chart.tsx` contains CSS selector hardening for generated chart styles.
- Display-only text normalization, such as trimming transcript display text or item labels inside components, should not be inventoried unless it constructs a schema-modeled value.

## SFV4-null-return Refinements

- Strong positives are helpers that already work in Option-like pipelines and then leak `undefined`, especially `findCountryOption` and `normalizeHexColorInput`.
- React render-null is not a model absence smell. Representative audited exceptions include `ChartStyle` returning null to omit a style tag and React context hooks that use `null` as the standard context sentinel before throwing.
- Third-party contracts that require `null`, such as the MUI X date adapter `parse` method, should be recorded as exceptions rather than proposed for Option rewrites.

---

<!-- batch DA -->
# S2 Rule-Card Notes - batch DA

## SFV4-normalization refinements

- Codegen source needs a generator-text escape hatch. In `@beep/acp`, `packages/drivers/acp/scripts/generate.ts:465` trims generated TypeScript lines while collecting schema entries and `:632` trims `json-schema-to-effect-schema` output before emission. These are source-parser/output cleanup steps, not runtime field normalization leaks; generated files under `src/_generated` remain excluded.
- Keep detecting private generator/parser normalization when it feeds modeled runtime values, but downrank codegen-only text shaping. The ACP generator examples are good negative fixtures for `Str.trim`/`.trim()` heuristics.

## SFV4-null-return refinements

- Private codegen parser helpers returning `undefined` are valid but lower-priority findings, not automatic exceptions. `packages/drivers/acp/scripts/generate.ts:355` returns `string | undefined` from `propertyNameToString`, and the caller branches at `:384-386`; an `Option<string>` return would be a small assisted cleanup.
- Function-valued service handler registries should be an escape hatch when `undefined` means "no callback registered" and is immediately mapped to a protocol error. Example: `packages/drivers/acp/src/internal/shared.ts:27` mirrors ACP handler slots and fails with method-not-found at `:45-46`.

## Defaults / Option escape hatches

- Optional fields on tagged error classes remain high-signal S2 targets. `@beep/acp` has repeated `S.optionalKey(...)` error fields in `Acp.errors.ts` (`cause`, `command`, `code`, `data`) plus constructor/body `undefined` handling; target `S.OptionFromOptionalKey(...).pipe(SchemaUtils.withNoneDefault)` with same-PR call-site wrapping.
- Function/effect-valued protocol options are defaults but not schema defaults. `packages/drivers/acp/src/AcpProtocol.service.ts:339` defaults an optional logger callback and `:658` defaults an optional termination-error effect; both should be false-positive escape hatches unless the local API is intentionally redesigned.
- Empty-object protocol response fallbacks can be legitimate adapter behavior. `packages/drivers/acp/src/AcpClient.service.ts:525`, `:549`, and `:555` map handler `void` to ACP empty response objects; this is an external wire adapter plus service-contract carve-out, not a schema field default.
- CLI/config parser defaults should be boundary exceptions. `packages/drivers/acp/scripts/generate.ts:722` uses `Flag.withDefault(false)`, and `packages/drivers/acp/test/fixtures/acp-mock-peer.ts:14` uses `Config.withDefault("0")` for fixture process-env behavior.

---

<!-- batch DB -->
# S2 Rule-Card Notes - batch DB

## SFV4-normalization refinements

- Driver config URL normalization is high-signal when a nearby config schema already exists. `Firecrawl.service.ts:463` and `Runpod.service.ts:223` both normalize config URLs after decode; prefer moving same-type string normalization onto the config input schema with `S.decodeTo` / `SchemaTransformation.transform`.
- NLP/token text transforms are usually domain operations, not incidental schema-field normalization. `WinkTools.service.ts:58`, `WinkTools.service.ts:814`, and `WinkUtils.service.ts:287` should stay exception-biased unless the transformed value is simply being stored into a modeled field unchanged.
- Dynamic clamps should be split. Schema can own fixed lower bounds or finite numeric input guarantees, but runtime must keep result-dependent upper bounds and SDK span repair, as in `WinkCorpus.service.ts:224` and `WinkTools.service.ts:220`.

## SFV4-null-return refinements

- Adapter helpers that return `undefined` solely to satisfy third-party SDK optional-property boundaries should be recorded as exceptions, not omitted. Examples include `Firecrawl.service.ts:274`, `WinkTokenization.service.ts:74`, and `Wink.models.ts:128`.
- Private source helpers returning `string | undefined` for local-only caller logic remain good Option targets. `packages/drivers/runpod/scripts/generate.ts:962` is a codemod-tier example because callers already branch locally on presence.

## Defaults / Option escape hatches

- Optional driver config, observability, and raw request fields that are immediately fed through `O.fromUndefinedOr` or `?? {}` are high-signal S2 defaults targets. Examples: `Firecrawl.config.ts:51`, `Runpod.config.ts:64`, `Runpod.service.ts:119`, and `WinkObservability.ts:81`.
- Error constructors that pass `cause: undefined` into a required `S.Defect` field are high-signal schema-shape problems. Prefer optional cause modeling with `S.OptionFromOptionalKey(S.Defect(...)).pipe(SchemaUtils.withNoneDefault)` or split constructor/schema variants.
- Whole-argument optional method defaults and effectful identity generation are escape hatches. `Runpod.service.ts:530` defaults an optional request object, and `WinkCorpus.service.ts:522` must generate a fallback id inside Effect.
- Cross-package defaults in Wink toolkit handlers often belong upstream in `@beep/nlp-processing` tool parameter schemas. Record them as package-visible findings, but downrank package-only remediation because fixing the local handler does not update all tool call sites.

---

<!-- batch DC -->
# S2 Rule-Card Notes - batch DC

## SFV4-normalization refinements

- Driver config URL normalization remains high-signal when a config schema already exists. `packages/drivers/xai/src/XAi.service.ts:217-221` strips trailing slashes after `XAiConfigInput` has decoded/defaulted the URL fields; prefer a normalized URL schema using `S.decodeTo` / `SchemaTransformation` while retaining `SchemaUtils.withKeyDefaults`.
- Codegen-only identifier or emitted-text shaping needs an escape hatch. `packages/drivers/box/scripts/generate.ts:131` uppercases identifier parts, and nearby helpers render string literals / generated schema text; these are generator formatting rules, not runtime schema-field normalization.
- Protocol parsers and explicit text tools should be exception-biased. Examples from this batch: HTTP media-type parsing in `packages/drivers/xai/src/XAi.service.ts:423`, SSE `data:` trimming at `:538`, JSONL line trimming in `packages/drivers/nlp-mcp/src/Streaming/Jsonl.ts:111`, and user-selected line transforms in `packages/drivers/nlp-mcp/src/Streaming/TextStream.ts:329` / `Streaming/Pipeline.ts:144`.
- Trust-boundary normalization must stay explicit. `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts:305` lowercases and bracket-strips hostnames inside the URL/SSRF guard; this is fence-4 security logic, not codec cleanup.

## SFV4-null-return refinements

- SDK option-bag readers returning `undefined` can be valid adapter boundaries when the undefined value is immediately consumed by the SDK contract. `packages/drivers/box/src/Box.streaming.ts:705` is the representative negative fixture for `AbortSignal | undefined`.
- Codegen / compiler-API parser helpers returning `undefined` should be downranked or exempted when the absence mirrors TypeScript AST shape and a local `crispen:` note explains why Option would add traversal noise. `packages/drivers/box/scripts/generate.ts:44-53` is the best fixture from this run.
- Do not generalize this escape hatch to exported domain helpers. Optional decoded fields that force `O.fromUndefinedOr` in driver/service code remain actionable S2 defaults findings.

## Defaults / Option escape hatches

- Optional diagnostic fields on driver error schemas are high-signal targets. `BoxError` / `BoxErrorOptions` and `XAiError` / `XAiErrorOptions` repeat `S.optionalKey(...)` plus `R.getSomes` / `O.fromUndefinedOr`; align them with the existing `@beep/firecrawl` `S.OptionFromOptionalKey(...)` pattern.
- MCP tool parameter schemas with handler-local `?? 1000`, `?? false`, `?? "utf-8"`, or `{}` defaults are high-signal defaults targets. `@beep/nlp-mcp` repeats this across `StreamingTools.ts` parameter structs and `StreamingHandlers.ts`; favor named option schemas with `SchemaUtils.withKeyDefaults`.
- Descriptor-derived or protocol-derived defaults are escape hatches. `packages/drivers/xai/src/XAi.service.ts:305` defaults `Accept` from the endpoint descriptor, so it belongs in service logic unless the descriptor schema grows a derived request profile.
- Tool output optional keys are judgment-tier, not codemod-tier. For MCP JSON outputs such as `FileInfoOutput` / `JsonlOutput`, choose deliberately between `OptionFromOptionalKey` (domain-side absence) and empty-array/defaulted outputs (wire-shape change risk).

---

<!-- batch DD -->
# S2 Rule-Card Notes - batch DD

## SFV4-normalization refinements

- Driver base URL normalization remains high-signal when a config schema already exists. `packages/drivers/m365/src/M365.config.ts:252` and `packages/drivers/venice-ai/src/VeniceAI.service.ts:1308` strip trailing slashes after schema decode/defaults; prefer a named normalized URL codec using `S.decodeTo` / `SchemaTransformation` while retaining `SchemaUtils.withKeyDefaults`.
- Environment-delimited string parsers are worth detecting when they feed schema input. `packages/drivers/m365/src/M365.service.ts:762` splits and trims `M365_SCOPES` before `M365ConfigInput.make`; suggest a boundary schema built from the local `SchemaUtils/split.ts` pattern plus trim/drop-empty semantics.
- Header/protocol parsers need escape hatches. Negative fixtures from this run: Postgres migration SQL splitting at `packages/drivers/postgres/src/PostgresDrizzle.service.ts:132`, HTTP `Content-Type` parsing at `packages/drivers/openai-compat/src/OpenAiCompatClient.service.ts:215` and `packages/drivers/venice-ai/src/VeniceAI.service.ts:1503`, and SSE line/block trimming at `packages/drivers/venice-ai/src/VeniceAI.service.ts:1600`.
- Case-folding that is product behavior should be downranked. `packages/drivers/m365/src/M365.service.ts:915` lowercases filenames only for protected-extension classification; it does not normalize the Graph item name.

## SFV4-null-return refinements

- Private helpers that return `undefined` only to branch immediately remain high-signal. `packages/drivers/govinfo/src/Govinfo.service.ts:83` should return `Option<number>` from status extraction instead of `number | undefined`.
- Third-party nullable results should be exempted when converted immediately at the boundary. `packages/drivers/m365/src/M365.auth.ts:153` adapts MSAL `AuthenticationResult | null` through `O.fromNullishOr`.
- Wire-model nullability for OpenAI-compatible providers should be exempted when preserving provider JSON shape. Examples: `packages/drivers/openai-compat/src/OpenAiCompat.models.ts:250` and `packages/drivers/venice-ai/src/VeniceAI.service.ts:702`.

## Defaults / Option escape hatches

- Optional driver config fields are high-signal when service constructors immediately apply fixed defaults or `O.fromUndefinedOr`: `@beep/govinfo` config (`Govinfo.config.ts:121`), `@beep/openai-compat` client options (`OpenAiCompatClient.service.ts:55`), and `@beep/venice-ai` API key (`VeniceAI.service.ts:319`).
- Request option bags are high-signal when `headers`, `path`, or `query` default to `{}` / `undefined` in request-building code. `@beep/venice-ai` repeats this at `VeniceAI.service.ts:286` and `:1379`; keep descriptor-derived `accept` defaults (`:1406`) as an escape hatch unless a descriptor-aware request-profile schema is introduced.
- Optional response `contentType` and driver error diagnostic fields are high-signal. `@beep/venice-ai` repeats the pattern on response variants (`VeniceAI.service.ts:379,411,445`) and `VeniceAIError` (`:547-552`); use `OptionFromOptionalKey(...).pipe(SchemaUtils.withNoneDefault)` and perform the consumer sweep in the same PR.
- Tests and coverage helpers should be exception-biased unless the same smell exists in source. This batch saw several `O.getOrElse` and nullish fixtures in driver tests, but the actionable source targets were separate and were recorded there.

---

<!-- batch DE -->
# S2 Rule-Card Notes - batch DE

## SFV4-normalization refinements

- Driver base URL cleanup is a strong positive when it happens after config schema defaults. `packages/drivers/phoenix/src/Phoenix.service.ts:133` and `packages/drivers/hubspot/src/HubSpot.service.ts:284` strip trailing slashes in service code; prefer a named config URL codec using `S.decodeTo` / `SchemaTransformation` while retaining `SchemaUtils.withKeyDefaults`.
- Clamp-style normalization is high-signal when a matching scalar schema already exists. `packages/drivers/ffmpeg/src/FFmpeg.service.ts:437` clamps progress while `FFmpegProgressEvent.percent` is `S.Finite`; `packages/drivers/face-detection/src/FaceDetection.service.ts:492` clamps raw model scores while `FaceDetectionConfidence` already encodes [0, 1].
- Geometry and tensor-boundary clamps need escape hatches. Negative fixtures from this run: `packages/drivers/face-detection/src/FaceDetection.service.ts:535` clamps image-specific coordinates, and `packages/drivers/face-detection/src/FaceDetection.service.ts:590` defaults missing ONNX tensor slots to zero while decoding a fixed external tensor layout.
- Error-string parsing trims should be exception-biased. `packages/drivers/drizzle/src/Drizzle.errors.ts:102` trims query/params extracted from a native Drizzle error message as part of defensive parser/redaction behavior, not field normalization.

## SFV4-null-return refinements

- Private helpers returning `undefined` to feed optional schema keys are high-signal. Examples: `packages/drivers/ffmpeg/src/FFmpeg.service.ts:260`, `packages/drivers/ffmpeg/src/FFmpeg.errors.ts:43`, `packages/drivers/face-detection/src/FaceDetection.errors.ts:18`, and `packages/drivers/duckdb/src/DuckDb.errors.ts:22`.
- Intermediate context schemas should not be exempted just because the final error already uses Option. `packages/drivers/drizzle/src/Drizzle.errors.ts:55` keeps `DrizzleErrorContext` optional-key based even though final `DrizzleError` uses `S.OptionFromOptionalKey`.
- Boundary encoders may still return null after the decoded domain moves to Option. `packages/drivers/phoenix/src/Phoenix.service.ts:195` should remain allowed to emit the Phoenix SDK nullable split shape while `PhoenixDatasetExample` moves decoded fields to Option.

## Defaults / Option escape hatches

- Config `headers ?? {}` defaults are strong positives when a config schema exists. `packages/drivers/hubspot/src/HubSpot.service.ts:306` should become `SchemaUtils.withKeyDefaults(R.empty())`, matching Phoenix and Runpod config patterns.
- Descriptor defaults are lower-confidence when owned by another package. `packages/drivers/drizzle/src/EntityTable.models.ts:388` points upstream to `@beep/schema` `PersistDescriptorFields.indexHints`; the driver finding should coordinate with the foundation/schema wave.
- SQL nullability is a hard escape hatch. `packages/drivers/drizzle/src/EntityTable.models.ts:63` checks encoded nullability to choose nullable SQL column builders and must not be rewritten as decoded Option at the row boundary.
- Service/native optional parameters and lazy memoization are false positives. Examples: `packages/drivers/duckdb/src/DuckDb.service.ts:96` mirrors optional native query parameters, and `packages/drivers/duckdb/src/DuckDb.service.ts:239` uses `??=` for shared connection promise memoization.
- HTTP header fallbacks and tests should be exception-biased unless the same smell exists in source models. Examples: `packages/drivers/hubspot/src/HubSpot.service.ts:410` treats missing content-type as non-JSON, and `packages/drivers/hubspot/test/HubSpot.service.test.ts:58` is a test capture fallback.

---

<!-- batch DF -->
# S2 Rule-Card Notes - Batch DF

## SFV4-normalization

- Config URL normalization showed up in several drivers (`@beep/uspto`, `@beep/sanity`, `@beep/discord`): trailing-slash stripping in service constructors should be a strong fixture candidate because the same field already has a config schema and a default.
- Exported free-text normalizers beside schemas (`@beep/uspto` application/patent number helpers) are good `SFV4-normalization` fixtures: the helper already returns `Option`, but the string cleanup should travel as a `S.decodeTo(...)` codec.
- Escape hatch: trust-boundary URL host normalization should not be absorbed. `@beep/uspto` lowercases parsed hostnames inside a credential-scoping/SSRF guard; fence 4 says these guards stay explicit.
- Escape hatch: canonicalization algorithms may intentionally trim serialized text. `@beep/rdf-canonize` trims N-Quads canonical text as part of the adapter algorithm, not as a field invariant.
- Escape hatch: secret values must not be generically trimmed. `@beep/onepassword-cli` should only normalize diagnostics/account labels; `read` returns the raw `op read --no-newline` stdout as a redacted secret.

## SFV4-null-return

- Test-only helpers returning `undefined` or using early bare `return` should stay non-actionable when they are local fixtures for HTTP capture or mock tuple narrowing.
- Cross-package boundary matching should stay non-actionable when a package is consuming an imported source shape and failing explicitly (`@beep/tika` `decodeSourceText` over file-processing operation sources).

## SFV4-defaults

- Driver error classes are a strong recurring fixture family: many older drivers still use `S.optionalKey(...)` for diagnostic context, while `@beep/pglite` and sibling packages already show `S.OptionFromOptionalKey(...)` as the target shape.
- Config defaults are usually actionable when an explicit `S.Class` config model exists and a service resolver repeats `??` defaults. Effect Config's ambient `Config.withDefault(...)` can remain an environment-boundary exception when the explicit config model is separately schema-defaulted.
- Generator scripts should be an escape hatch when defaulting only protects a renderer from incomplete external specs; do not turn generator input fallbacks into package runtime findings.

---

<!-- batch TA1 -->
# S2 Rule-Card Notes - batch TA1

## SFV4-normalization refinements

- Treat schema-transformation implementation bodies as positive fixtures, not findings. `packages/tooling/tool/cli/src/commands/CreatePackage/TemplateService.ts:116` wraps nullish/default helper-string behavior in `S.decodeTo(..., SchemaTransformation.transform(...))`; detectors should not flag the `O.getOrElse` inside that transform as leaked business logic.
- Preserve trust-boundary path sanitizers. `packages/tooling/tool/cli/src/commands/Corpus/Corpus.service.ts:2161` strips path separators/NULs and trims corpus-derived names before filesystem materialization. That is fence-4 path safety, not a generic string-normalization smell.
- Distinguish query/display normalization from field normalization. `packages/tooling/tool/cli/src/commands/Docs/Docs.command.ts:200` normalizes a transient docs search topic; `Files.media.ts:839` and related render helpers default labels/suffixes for display. These should be escape hatches unless the normalized value is written into a domain model.
- Keep detecting exported normalization utilities that feed modeled fields. `packages/tooling/tool/cli/src/commands/Files/Files.media.ts:355` lowercases and strips file extensions before literal/schema checks; this is a useful `SFV4-normalization` candidate for a `BareFileExtension` transformation schema.

## SFV4-null-return refinements

- JSON report models with `S.NullOr(...)` are not covered by the SQL-null fence. `packages/tooling/tool/cli/src/commands/Docgen/internal/Quality.ts:311` and `QualityWorkerRunpodEval.ts:127` are good candidates for `S.OptionFromNullOr(...).pipe(SchemaUtils.withNoneDefault)` while preserving null on the encoded report boundary.
- Config/secret helpers that start with `Option` and return `undefined` should stay visible even when they sit near CLI/env boundaries. `packages/tooling/tool/cli/src/commands/AIMetrics/AIMetrics.command.ts:451` is a low-confidence but useful pattern: return `O.Option<string>` through the local pipeline, convert only at third-party boundaries.

## Defaults / Option escape hatches

- Effect CLI `Flag.withDefault(...)` should be an escape hatch for parser defaults. It is the parser boundary, not a schema-field default. Still flag the subsequent command-domain decode if it converts empty strings or undefined into Option/defaults by hand.
- SQL row encoders must keep `null` output. `packages/tooling/tool/cli/src/commands/Corpus/Corpus.service.ts:2487` and `:2871` are legitimate SQL-boundary nulls; the actionable S2 target is the decoded/domain model before those row encoders.
- Sibling-derived defaults need a whole-record transformation, not a field default. `packages/tooling/tool/cli/src/commands/CreatePackage/ConfigUpdater.ts:257` derives alias targets from `packagePath`; detector suggestions should prefer `S.decodeTo(..., SchemaTransformation.transform(...))` over `withKeyDefaults` for that shape.

---

<!-- batch TA2 -->
# S2 Rule-Card Notes - batch TA2

## SFV4-defaults refinements

- Command-suite tagged errors are a useful repo-cli detector family. `Graphiti.errors.ts:41`, `Quality.errors.ts:47`, `Yeet.errors.ts:44`, `SyncDataToTs.errors.ts:44`, `Skills.errors.ts:63`, `Image.errors.ts:32`, `Ci.errors.ts:32`, and `VersionSync.errors.ts:45` repeat optional-key `cause` or context fields. Prefer `S.OptionFromOptionalKey(...)` for context/cause and schema defaults for `exitCode`.
- Treat `Flag.withDefault(...)` as a parser-boundary escape hatch, but keep detecting a second post-parser defaults wall. `Yeet.command.ts:236-296` is the useful distinction: CLI flags may have parser defaults, but `SharedOptions` still re-defaults a schema-modeled option bag before `YeetRunOptions`.
- Whole-record defaults are needed when defaults depend on sibling fields or Effect services. `JSDocDocumentationInventory.ts:144-183` needs a raw-input -> resolved-options transform, not only per-field `withKeyDefaults`.
- Positive fixture: `Graphiti/internal/ProxyConfig.ts:19-70` keeps env string/default/positive-int/boolean/url normalization in schema getters plus `S.withConstructorDefault` and `S.withDecodingDefault`. Detectors should not flag the `O.getOrElse` inside those schema transforms as leaked business logic.

## SFV4-normalization refinements

- Official-data sync targets are good `SFV4-normalization` candidates when the normalized value is written into generated `@beep/data` entries. `SyncDataToTs/targets/Iso4217.ts:121-145` and `IanaMediaTypes.ts:231-242` should become transformation-schema fixtures.
- Extension normalization that feeds a literal schema remains worth detecting. `Image/Image.service.ts:90-97` repeats the same `strip leading dot + lowercase + literal guard` shape seen in the part1 Files finding; a shared bare-extension schema would remove both.
- Preserve explicit trust-boundary guards. `Graphiti/internal/ProxyServices.ts:267-468` normalizes endpoint paths, docker health text, and content-length headers at an HTTP/proxy boundary; keep those helpers explicit unless a dedicated request-boundary schema is introduced with equivalent guard coverage.
- Positive fixtures: `VersionSync/internal/resolvers/NodeResolver.ts:103-114`, `DockerResolver.ts:152-163`, and `updaters/YamlFileUpdater.ts:20-31` already use `S.decodeTo(..., SchemaTransformation.transform(...))` for unknown-value-to-string normalization.

## SFV4-null-return refinements

- Distinguish repo-owned JSON reports from raw third-party reports. Part1 Docgen report nulls are actionable because repo-cli owns the report schema; `Quality/FallowQuality.command.ts:219` mirrors an external Fallow raw JSON field and should be an escape hatch at the raw-input layer.
- Testing helpers can keep partial option defaults. `Yeet/internal/Handler.ts:2844-2854` is `@category testing`; avoid turning fixture ergonomics into schema-default findings unless the same pattern appears on production inputs.

---

<!-- batch TB -->
# S2 Rule-Card Notes - batch TB (`@beep/repo-utils`)

## SFV4-normalization refinements

- Strong signal: exported normalizers that turn free-form strings into schema-modeled result classes. `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts:295` and `:365` normalize `@category` text into `JSDocCategoryNormalization`; this is a good fixture for moving trim/case/slug normalization behind `S.decodeTo` + `SchemaGetter.transformOrFail`.
- Escape hatch: ts-morph AST extraction helpers may trim source text as adapter logic. `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.shared.ts:201` reads third-party JSDoc nodes and already returns `Option`; do not flag it unless the trimmed value is a canonical reusable schema invariant rather than extraction cleanup.
- Escape hatch: search-index normalization can be algorithmic. `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:1106` lowercases a query to compare against precomputed search text; that is not automatically a schema-field normalization target.

## SFV4-null-return refinements

- Strong signal: exported schema-metadata lookup helpers that unwrap optional annotations to `undefined`. `getJSDocTagMetadata` (`JSDocTagAnnotation.model.ts:69`), `getTSCategoryMetadata` (`TSCategory.model.ts:261`), and `getCategory` (`TSCategory.model.ts:1252`) should return `Option` and let callers match/fold.
- Escape hatch: module augmentation fields for Effect Schema annotations must remain optional because annotation bags are sparse by contract. Flag public helpers that unwrap them to `undefined`, not the `declare module "effect/Schema"` optional property declarations themselves.
- Escape hatch: Effect Schema callback sentinels are not domain returns. `packages/tooling/library/repo-utils/src/schemas/PackageJson.ts:126` returns `undefined` from an `S.makeFilter` issue callback to mean "no issue"; detectors should not treat that as an exported null-return helper.

## SFV4-defaults / Option refinements

- Strong signal: optional schema field plus immediate `?? EMPTY_*` fallback. `DocgenAliasSource.subpathAliasTargets` (`DocgenConfig.ts:90`) is followed by `aliasSource.subpathAliasTargets ?? EMPTY_STRING_RECORD` (`:565`), making it a good `SchemaUtils.withKeyDefaults` fixture.
- Strong signal: shared optional field fragments used across many first-party tag-value schemas. `_fields.ts:35`, `:61`, and `:74` are one edit point for replacing optional strings with `S.OptionFromOptionalKey(...).pipe(SchemaUtils.withNoneDefault)`.
- Escape hatch: external config codecs keep external null sentinels. `PackageJson.ts:706` (`exports`/`imports` null blockers) and `TSConfig.ts:524` (`paths` target null) are package-manager/TypeScript wire semantics, not domain absence.

---

<!-- batch TC -->
# S2 Rule-Card Notes — Batch TC

Packages scanned:
- `@beep/repo-ai-metrics` (`packages/tooling/library/ai-metrics`)
- `@beep/repo-docgen` (`packages/tooling/tool/docgen`)

## SFV4-normalization heuristic refinements

- Treat trim/case operations over decoded schema fields as actionable when the same field is already modeled with `S.optionalKey(S.String)` or `S.UndefinedOr(S.String)`. Good fixtures from this batch: `ai-metrics/src/privacy.ts:426` (`firstNonEmptyString`) and `repo-docgen/src/Parser.ts:130-141` (`parseComment` description/tag normalization).
- Keep markdown/product parsers as escape hatches. `repo-docgen/src/Core.ts:226-274` lowercases/trims code-fence metadata to choose `.ts`/`.tsx` outputs, and `repo-docgen/src/Printer.ts:74-85` trims rendered JSDoc labels/fence metadata. These are docgen rendering/parsing behavior, not schema field normalization.
- Keep raw text/file splitting as an escape hatch. `ai-metrics/src/internal/transcript-utils.ts:54-57` trims JSONL lines before schema decoding; the schema boundary starts after line splitting.
- Keep privacy/security fallback decisions explicit. `ai-metrics/src/privacy.ts:352-370` trims only to decide whether to use the local insecure smoke salt/status; that should not be silently absorbed into a generic string codec.
- Useful schema targets verified this run: Effect v4 `S.Trim`, `S.OptionFromOptionalKey`, `S.OptionFromUndefinedOr`, and `S.decodeTo`; repo helper exemplars are `NonEmptyTrimmedStr` and `SchemaUtils.withNoneDefault`.

## SFV4-null-return heuristic refinements

- SQL parameter helpers returning `null` should be auto-exception candidates when the call site feeds DuckDB/SQL row parameters. Fixtures: `ai-metrics/src/scorecard.ts:584` (`noteOrNull`) and `ai-metrics/src/derived-storage.ts:819-820` (`optionalStringOrNull` / `optionalBooleanOrNull`). This is SPEC fence 2.
- Existing `crispen:` comments that document a `S.NullOr` wire field should become exception fixtures, not actionable findings, until the owning field migrates. Fixture: `ai-metrics/src/agent-effectiveness.ts:1644-1647`.
- Domain models that still use `S.UndefinedOr` for absence should remain actionable, especially when parser/printer code branches on `undefined`. Fixture: `repo-docgen/src/Domain.ts:123` plus `Parser.ts:130-135` and `Printer.ts:91-102`.

## SFV4-defaults heuristic refinements

- Constant constructor defaults inside smart constructors are good codemod candidates when the class field is schema-modeled and has no cross-field dependency. Fixture: `repo-docgen/src/Domain.ts:793` (`File.new` defaulting `isOverwritable`).
- Constant decoded config defaults can move to configuration schemas. Fixture: `repo-docgen/src/Configuration.ts:461-475` for `srcDir`, `outDir`, `theme`, booleans, `include`, and `exclude`.
- Defaults derived from sibling fields, package metadata, `Path.Path`, or resolved platform paths should be exception candidates unless the package introduces an explicit resolved-config transformation schema. Fixtures: `ai-metrics/src/install.ts:1175-1176`, `ai-metrics/src/source-discovery.ts:525-637`, and `repo-docgen/src/Configuration.ts:451-459`.

---

<!-- batch TD -->
# S2 Rule-Card Notes - Batch TD

Packages scanned:
- `@beep/repo-configs` (`packages/tooling/policy-pack/repo-configs`)
- `@beep/ai-sync` (`packages/tooling/library/ai-sync`)
- `@beep/test-utils` (`packages/tooling/test-kit/test-utils`)
- `@beep/lint-rules` (`packages/tooling/policy-pack/lint-rules`)
- `@beep/infra` (`infra`, tooling wave family per `ops/progress.json` infraAssignment)

## SFV4-defaults / Option refinements

- Strong signal: repo-owned config classes with `S.optionalKey(S.String)` followed by `O.fromUndefinedOr` / `O.getSomesStruct` at constructor boundaries. Fixtures from this batch: `infra/src/Storybook.ts:177`, `infra/src/OipWeb.ts:232-239`, `infra/src/OipWeb.ts:266-275`, and `infra/src/AIMetrics.ts:268`. Preferred target is `S.OptionFromOptionalKey(...).pipe(SchemaUtils.withNoneDefault)`, with provider omission handled at the Pulumi/Vercel/Cloudflare boundary.
- Strong signal: schema-owned constants duplicated in body helpers. Fixtures: `repo-configs/src/next/SharedNextConfig.model.ts:389-400`, `repo-configs/src/next/security/index.ts:166-199`, and `infra/src/AIMetrics.ts:42-50` where `AiMetricsInstallInput` already owns target/tool defaults in `packages/tooling/library/ai-metrics/src/install.ts:146-167`.
- Escape hatch: raw third-party config snapshots may stay optional/nullish at the adapter edge. Fixtures: `repo-configs/src/next/NextConfig.model.ts:193`, `repo-configs/src/next/models/ImageConfig.schema.ts:383`, `ai-sync/src/transforms.ts:15-65`, and the Pulumi raw config schemas in `infra/src/Storybook.ts:120`, `infra/src/OipWeb.ts:102`, and `infra/src/AIMetrics.ts:203`.
- Escape hatch: sibling-derived defaults belong in a colocated smart constructor unless the package introduces an explicit resolved-config transformation schema. Fixtures: `infra/src/OipWeb.ts:165-182`, `infra/src/AIMetrics.ts:394-398`, and display/error-message fallbacks that derive from sibling fields.
- Escape hatch: test harnesses and test utilities can keep pragmatic defaults that normalize third-party reports or fixture options. Fixtures: `test-utils/src/Schema.ts:42`, `test-utils/src/SqlTest.ts:624-634`, `lint-rules/test/harness.ts:101`, and `lint-rules/test/oxlint-harness.ts:144`.

## SFV4-normalization refinements

- Strong signal: first-party decoded values normalized after schema decode. Fixtures: `repo-configs/src/internal/eslint/EffectLawsAllowlistSchemas.ts:117` path normalization and `ai-sync/src/transforms.ts:132` instruction-document whitespace cleanup. Good schema targets verified this run include `NativePathToPosixPath` (`packages/foundation/modeling/schema/src/PosixPath.ts:70-80`) and Effect v4 `S.decodeTo` / `SchemaTransformation.transform`.
- Escape hatch: lint-rule or provider resource-name derivation is product behavior, not schema-field normalization. Fixtures: `lint-rules/src/rules/namespace-node-imports.ts:21`, `lint-rules/src/rules/utils.ts:330`, and `infra/src/OipWeb.ts:609`.
- Escape hatch: trust-boundary escaping stays explicit per SPEC fence 4. Fixture: `infra/src/AIMetrics.ts:68` (`shellQuote`).

## SFV4-null-return refinements

- Strong signal: exported first-party registries or metadata helpers that expose `null` / `undefined` for repo-owned absence. Fixture: `lint-rules/src/index.ts:100` (`RuleMetadata.replaces` / `scope`).
- Escape hatch: raw CLI, Pulumi, ESTree, and provider-resource boundaries may return or accept `undefined` where the external contract requires it. Fixtures: `ai-sync/scripts/ai-sync.ts:13-24`, `lint-rules/src/rules/utils.ts:48`, `infra/src/Storybook.ts:97`, `infra/src/OipWeb.ts:597-621`, and `infra/src/AIMetrics.ts:577-658`.
- Escape hatch: function/effect-valued hooks and non-serializable callback defaults should stay in the canonical helper rather than forcing a schema. Fixtures: `test-utils/src/SqlTest.ts:356-518` and similar test-layer hooks.

---

<!-- batch AA -->
# S2 Rule-Card Notes - Batch AA

Packages: `@beep/oip-web`, `@beep/professional-desktop`, `@beep/architecture-lab-proof`, `@beep/storybook`.

## SFV4-normalization

- Treat form/body text helpers as actionable when a nearby schema already owns the payload. `apps/oip-web/src/contact/ContactSubmission.model.ts:220` hand-trims `FormDataEntryValue | null` before `ContactSubmissionFormPayload` decodes it; this is a useful fixture for a form-entry boundary transform escape hatch that still keeps File/null handling explicit.
- Treat derived domain labels as possible schema targets when they feed a modeled command. `apps/professional-desktop/src/chat/ChatOrchestrator.ts:55` trims and clamps a thread title candidate before `SetThreadTitleIfEmptyInput.title`, whose current schema is only `S.NonEmptyString`.
- Escape hatch: runtime config and secret presence checks are boundary normalization. `apps/oip-web/src/contact/ContactSubmission.service.ts:68`, `apps/oip-web/src/content/OipContent.runtime.ts:67`, and their `Redacted.value(secret)` checks should not be auto-absorbed into a domain schema.
- Escape hatch: UI-only search/render normalization should stay non-actionable. `apps/professional-desktop/src/chat/ui/Composer.tsx:71` lowercases a transient mention query; `apps/professional-desktop/src/chat/ui/StreamingBlocks.tsx:40` bounds untrusted render-key materialization and is a trust/performance guard, not a codec smell.

## SFV4-null-return

- Actionable helper pattern: first-party data transformation helpers returning bare `undefined` to mean "skip". `apps/professional-desktop/scripts/sync-migration-bundle.ts:32` and `:38` should be a detector fixture for `Effect<undefined | T>` / `undefined` sentinel results that can be `Option`.
- Escape hatch: React components and render helpers returning `null` remain framework boundary results (`apps/oip-web/src/components/HeroVideo.tsx:298`, `apps/professional-desktop/src/chat/ui/ChatTurnErrorToasts.tsx:32`, `apps/professional-desktop/src/chat/ui/Thread.tsx:57`).
- Escape hatch: Vite/Storybook transform hooks returning `null` are plugin API sentinels (`apps/storybook/.storybook/main.ts:16`, `apps/professional-desktop/vite.config.ts:16`).
- Escape hatch: callback signatures supplied by Node/Bun streams may carry `Error | null | undefined` (`apps/professional-desktop/server/IpcStdoutGuard.ts:16`); wrapping those parameters is not schema crispening.

## Detector Refinements

- `Config.withDefault(...)` should not count as `SFV4-defaults` by itself. In this batch, `apps/professional-desktop/src/runtime/Layer.ts:63`, `Pglite.ts:57`, and `Observability.ts:77-82` are correct Effect Config boundary defaults.
- `??` inside Storybook/Vite/Next config merging should route to a framework-config escape hatch unless the value is first decoded into an app-owned schema.
- `O.getOrElse` over React key fallback or display fallback should remain exception-only unless the same value is persisted or sent across a wire boundary.

---

<!-- batch AB -->
# S2 Rule-Card Notes - Batch AB

Packages: `@beep/agents-domain`, `@beep/agents-use-cases`, `@beep/agents-server`, `@beep/agents-client`.

## SFV4-normalization

- Treat projection-time codec folding as actionable when the source field is already schema-modeled. `packages/agents/domain/src/values/AssistantContent/AssistantContent.behavior.ts:104` folds `CodeBlock.language` through `Md.CodeFenceLanguage.decodeOption`; the model field at `AssistantContent.model.ts:274` should own the optional safe-language codec, following the `Md.Pre.language` transform pattern.
- Treat user-facing error-message cleanup as actionable when the message is carried by a typed error schema. `packages/agents/client/src/Chat.atoms.ts:436-437` trims and falls back before constructing `ChatActionError`; a `ChatActionErrorMessage` schema/static in `@beep/agents-use-cases` would make the client body a raw-error extractor instead of the normalization owner.
- Escape hatch: property-test input shaping is not runtime field normalization. `packages/agents/server/test/scanChunk.test.ts:17` clamps arbitrary chunk cuts before feeding a parser property test; this is a fixture helper, not a codec target.

## SFV4-null-return

- No production `SFV4-null-return` actionables were found in this batch.
- Escape hatch: test-only `undefined` sentinels inside narrowed assertions should remain non-actionable. `packages/agents/server/test/BlockRepair.test.ts:87` uses a ternary `undefined` only inside an expectation after narrowing a repaired paragraph block.
- Escape hatch: JSDoc examples with defensive `??` fallbacks should not become null-return findings. `packages/agents/server/src/AssistantTurn/BlockRepair.ts:123` is documentation-only example code, not exported domain behavior.

## Defaults / Option Refinements

- Optional JSON-contract fields are high-signal S2 candidates even when the encoded key must stay optional. `RuntimeEvidenceRef.spanId`, `RuntimeEvidenceRef.spanIds`, `RuntimeCandidateClaim.eventDate`, and `RuntimeActivity.artifactId/spanIds` show the useful split: `S.OptionFromOptionalKey(...).pipe(SchemaUtils.withNoneDefault)` for semantic absence, `SchemaUtils.withEmptyArrayDefaults` when absence means an empty collection.
- Option fields on `S.Class` should still be considered when they force `O.none()` at every make site. `packages/agents/client/src/Chat.atoms.ts:367` (`StreamingTurn.truncateFrom`) is a small but clear fixture for `SchemaUtils.withNoneDefault` on `S.Option(...)`.
- Empty-string sentinels are worth a separate defaults/Option heuristic. `packages/agents/client/src/ClientObservability.ts:70` gates telemetry with `Str.isEmpty(otlpBaseUrl)` after the resolver returns `""`; returning `Option<string>` is the crisper client-runtime boundary.
- Escape hatch: algorithmic empty-batch checks in streaming/repair loops should remain exceptions unless the checked collection is a schema field default. Examples: `BlockRepair.ts:400`, `:436`, `:487`, `:494`, `AnthropicTurnKernel.ts:153`, and `Chat.atoms.ts:723`.
- Positive fixture: `packages/agents/server/src/AssistantTurn/ScanState.ts:33-37` already uses `SchemaUtils.withKeyDefaults` for parser carry-state defaults; detectors should not flag those as default smells.

---

<!-- batch AC -->
# S2 Rule-Card Notes - Batch AC

Packages: `@beep/architecture-lab-domain`, `@beep/architecture-lab-use-cases`, `@beep/architecture-lab-server`, `@beep/architecture-lab-tables`, `@beep/architecture-lab-config`, `@beep/architecture-lab-client`, `@beep/architecture-lab-ui`.

## SFV4-normalization

- Escape hatch: UI read-model display formatting should not be auto-absorbed into a schema transform when it derives presentation text from an already-modeled enum. `packages/architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts:125` uppercases `WorkItemStatus` for `statusLabel`; Effect v4 has `SchemaTransformation.toUpperCase()` / `SchemaGetter.toUpperCase()`, but this is display projection, not domain or wire normalization.
- No production trim/lowercase/clamp actionables were found in this batch.

## SFV4-null-return

- No production `SFV4-null-return` actionables were found in this batch.
- No React component `return null` escape hatches surfaced in the architecture-lab packages scanned here.

## Defaults / Option Refinements

- High-signal fixture: `S.OptionFromOptionalKey(...).pipe(S.withConstructorDefault(Effect.succeed(O.none())))` in command/query schemas should normalize to `SchemaUtils.withNoneDefault`. This appears in `packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.model.ts:88`, `packages/architecture-lab/use-cases/src/entities/Worker/Worker.commands.ts:97`, and `packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.commands.ts:45` / `:221`.
- Option fields on `S.Class` without `withNoneDefault` remain useful S2 fixtures when direct constructors need explicit `O.none()` or should accept omitted semantic absence. Examples: `WorkItem.assignee` at `packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.model.ts:53` and `WorkItemSummaryViewModel.assigneeLabel` at `packages/architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts:116`.
- Config package refinement: bare config schemas plus exported `default*Config` values are actionable defaults candidates, but `Config.withDefault(...)` itself should remain a boundary escape hatch. In this batch, `packages/architecture-lab/config/src/aggregates/WorkItem/WorkItem.layer.ts:104-117` correctly consumes defaults at the Effect Config boundary; the schema-default target is `WorkItem.config.ts:35`, `:65`, and `:94`.
- SQL boundary escape hatch: `O.getOrNull` / `O.fromNullishOr` in table projections is correct when it bridges domain Option to nullable row columns. Examples: `packages/architecture-lab/tables/src/aggregates/WorkItem/WorkItem.table.ts:172-173` and `:219-220`.
- Repository adapter escape hatch: `O.getOrElse(() => input)` after Drizzle `returning()` is a persistence adapter fallback, not a schema-field default. Examples: `packages/architecture-lab/server/src/entities/Worker/Worker.repo.ts:185` and `packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.repo.ts:197` / `:220`.

---

<!-- batch AD -->
# S2 Rule-Card Notes batch AD

- `SFV4-normalization`: keep `.trim().length === 0` as a strong hit when the value is a schema-owned text field and the source schema is only `S.NonEmptyString`. In this batch, `IrToLaw.requiredExtraction` checks `GroundedExtraction.text`, while `@beep/langextract` owns both `ExtractionCandidate.text` and `GroundedExtraction.text`; a named nonblank/trimmed schema is the right target.
- Normalization fixer note: `TrimmedNonEmptyText` is an in-repo codec exemplar (`CommonTextSchemas.ts:36-43`), but remediation must choose whether to trim decoded values or only reject whitespace-only values. The detector should not assume trim-on-decode is behavior-preserving.
- `SFV4-defaults`: optional fields on `TaggedErrorClass` remain candidates when encoded absence can stay optional but decoded domain shape should be `Option`. `IrToLawExtractionError.alignmentStatus` is the local example: `S.optionalKey(S.String)` should become `S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault)` with the constructor updated intentionally.
- Escape hatch: SQL row/test fixtures that use concrete `null` for nullable columns are fence-2 exceptions. The `@beep/epistemic-tables` round-trip test also uses `?? null` to bridge Drizzle `$inferInsert` optional-null typing to a selected-row shape; keep this out of actionable S2 findings.
- Escape hatch: test-only `O.getOrElse` assertions over already Option-modeled fields are not defaults. The `@beep/epistemic-domain` UsageRecord assertions only verify decoded Option values.
- Escape hatch: cross-package DTO adapters that immediately lift `undefined` to `Option` and fail typed should be recorded as boundary exceptions for the consuming package, not package-local actionables. Examples in this batch: `GroundedExtraction.span` in `anchorOf` and `ExtractionResult.text` in `sourceTextFrom`.
- Escape hatch: sibling-derived fallbacks cannot be moved to field-level defaults. `anchorOf` falling back from missing `matchedText` to sibling `text` is an anchor-construction rule, not a schema-field default, unless a future whole-object transformation schema owns both fields together.
- Effect v4 APIs cited in this batch were verified in `.repos/effect-v4`: `S.OptionFromOptionalKey` at `Schema.ts:8668`, `S.decodeTo` at `Schema.ts:5408`, `S.Trim` at `Schema.ts:11544`, and `SchemaTransformation.trim()` at `SchemaTransformation.ts:428`.

---

<!-- batch AE -->
# S2 Rule-Card Notes batch AE

- `SFV4-defaults`: Option fields created with `S.Option(...)`, `S.OptionFromNullOr(...)`, or `S.OptionFromOptionalKey(...)` should hit when they lack `SchemaUtils.withNoneDefault` and callers/tests must pass `O.none()` or nullable sentinel values only to satisfy constructor shape. Examples in this batch: `AppendTurnInput.parentTurnId`, `TimelineTurn.parentTurnId`, `Turn.parentTurnId`, and Principal on-behalf-of fields.
- `SFV4-defaults`: a literal default object that duplicates an `S.Class` whose every field already has `S.withConstructorDefault` is a strong codemod candidate. `InMemoryState` in `@beep/workspace-server` can use `InMemoryState.make({})` instead of a separate `emptyState` literal.
- `SFV4-defaults`: table packages and migration tests should keep nullable SQL column assertions out of actionables. `parentTurnId: null`, `parent_turn_id: null`, and Drizzle `$inferInsert` optional-null bridges are fence-2 exceptions when they prove persisted row shape.
- `SFV4-defaults`: repository adapter fallbacks over empty Drizzle `returning()` results (`A.head` -> `O.getOrElse(seed)`) are database-adapter fail-closed behavior, not schema-field defaults.
- `SFV4-defaults`: sibling/parameter-derived default blocks should not be blindly flagged as field-default moves. `EntityId.buildDefinition` derives metadata from `slice`, `name`, and `entityType`; the actionable part is modeling `Options` override absence as Option, not moving those derived defaults to independent field defaults.
- `SFV4-normalization`: helper duplication should still hit when a module already exposes a transformation schema. `LocalDate.fromString` repeats parse/validation logic that can route through `LocalDateFromString`; by contrast, the `parseInt` calls inside `decodeLocalDateFromString` are schema-transformation internals and should be an escape hatch.
- `SFV4-null-return`: `return undefined` inside a side-effecting `Effect` workflow with unit-like success is a false-positive boundary. `migrateOnBoot` is the batch example; it returns `Effect`, not nullish domain data.
- Effect v4 APIs cited in this batch were verified in `.repos/effect-v4`: `S.decodeUnknownEffect` at `Schema.ts:1325-1330`, `S.OptionFromNullOr` at `Schema.ts:8576-8580`, `S.OptionFromOptionalKey` at `Schema.ts:8668-8672`, and `S.decodeTo` at `Schema.ts:5408-5416`. Repo helper verified: `SchemaUtils.withNoneDefault` at `packages/foundation/modeling/schema/src/SchemaUtils/withConstructorDefaults.ts:46-51`.

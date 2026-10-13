I'll review the schema-org slice at that commit against the upstream oracle and the round-1 inventory, and I'll only report findings the gates do not already enforce.The review surface is named, so I'll read the binding decisions, the round-1 inventory, and the port ledger before the source.Round 1 is closed in the ledger. I'll read the focus files at the pinned commit and compare them with the upstream oracle.The prior pass closed round-1 items and recorded deviations. I am checking the few spots that could still be new findings in these files before I report.### grok-2-1
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:553
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-3 and checklist item 16   evidence: `toScriptBody` calls `JSON.stringify(this.toJsonLd())` at JsonLdDocument.ts:553. The same call quotes diagnostic strings at JsonLdDocument.ts:61 and :109, NodeRef.ts:61, and Conformance.ts:101, :156, and :304. `preferSchemaOverJson` only flags `JSON.parse` / `JSON.stringify` inside `Effect.try` or `Effect.gen` / `Effect.fn` (`effect-tsgo/internal/rules/prefer_schema_over_json.go:14-15`, `:50-64`), so a green tsgo run leaves these plain methods alone. `S.fromJsonString` encodes by calling `JSON.stringify` (`~/YeeBois/references/effect/effect/packages/effect/src/Schema.ts:9787-9791`), so the schema encoder keeps the current bytes.
- failure: The script serializer and the diagnostic formatters call `JSON.stringify` directly. EF-3 forbids that on domain paths, and the Effect diagnostic never sees these call sites.
- fix: Encode with `Result.getOrThrow(S.encodeResult(S.fromJsonString(S.Json))(this.toJsonLd()))` in `toScriptBody`, and with `S.fromJsonString(S.String)` for each quoted diagnostic field. Keep the existing `<`, `>`, and `&` escapes after the document encode. Leave `schemaSync` / `encodeSync` unused.

### grok-2-2
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:553
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5 and checklist item 6; effect-laws-v1 law 21; round-1 req-11   evidence: `toScriptBody` chains three `String.prototype.replace` calls. `effect/String` `replace` is `(searchValue, replaceValue) => (self) => self.replace(searchValue, replaceValue)` (`~/YeeBois/references/effect/effect/packages/effect/src/String.ts:247-268`); a global regexp replaces every match. Round-1 req-11 records that `NoNativeRuntime` only sees string methods in hotspot scope and that this module is outside that scope, which is why the green native-runtime gate does not report this line.
- failure: The script serializer still uses native string replacement in domain logic, the same gate gap req-11 already treated as required on this module.
- fix: Import `effect/String` as `Str` and `pipe` from `effect/Function`, and write `pipe(json, Str.replace(/</g, "\\u003c"), Str.replace(/>/g, "\\u003e"), Str.replace(/&/g, "\\u0026"))`. Keep the escape characters and the idempotent byte result.

### grok-2-3
- file: scratchpad/effected/schema-org/Conformance.ts:683
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-34; effect-laws-v1 law 13 and law 19   evidence: `UnknownTermPolicy`, `DeprecationPolicy`, and `DanglingReferencePolicy` already carry the defaults through `S.withDecodingDefault(Effect.succeed(...Enum.report|ignore))` at Conformance.ts:438-454. `validateResult` repeats them as `?? "report"`, `?? "ignore"`, and `?? "ignore"` at :683-685 and compares with `=== "fail"` / `=== "report"` at :690-693. No production path decodes `ConformanceOptions`. Round-1 req-7 records that schema-first lint does not cover this lab, so the green gates do not see the duplicate literals. `Conformance.test.ts` still requires omitted fields to default and out-of-union strings to stay non-failing.
- failure: The gate's policy defaults and comparisons are a second copy of the schema literals. Changing a schema default leaves `validateResult` on the old string, which is the split EF-34 forbids.
- fix: Hoist one constant per default from `UnknownTermPolicy.Enum.report`, `DeprecationPolicy.Enum.ignore`, and `DanglingReferencePolicy.Enum.ignore`. Pass those constants to both `withDecodingDefault` and the `??` fallbacks. Compare with `UnknownTermPolicy.is.fail`, `DeprecationPolicy.is.report`, and `DanglingReferencePolicy.is.report`. Keep the per-field `??` so an out-of-union string still fails no check.

### grok-2-4
- file: scratchpad/effected/schema-org/Conformance.ts:578
- class: docs   severity: backlog
- standard: D11 backlog for a public-doc correction that is not a JSDoc hard-requirement break   evidence: `Conformance.check` says "A prefixed term is skipped entirely, with no issue." `nativeTerm` (Conformance.ts:495-500) returns `O.some` for a `schema:` term after stripping the prefix, returns `O.some` of the whole term when the prefix is absent from `FOREIGN_PREFIX_SET`, and returns `O.none` only for a declared foreign prefix. `check` pushes issues only on the `onSome` path (:612-638). The `gs1:telephone` example in the same bullet is the one case that is actually skipped.
- failure: The public method doc tells callers that every prefixed term bypasses checking. `schema:softwareVersion` is still domain-checked, and an undeclared prefix such as `bogus:telephone` is still reported as an unknown term.
- fix: State that only a prefix declared in the vocabulary `@context` is skipped, and that `schema:` terms and undeclared prefixes are checked. Leave `nativeTerm` and the issue order unchanged.

### grok-2-5
- file: scratchpad/effected/schema-org/Thing.ts:29
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-3   evidence: Published examples call `S.decodeUnknownSync` at Thing.ts:29, TechArticle.ts:22, CreativeWork.ts:34, and Conformance.ts:28 and :424. EF-3 reserves synchronous decoding for the non-throwing Result/Option forms and says not to use `decodeUnknownSync` by default. Docgen only checks that the examples typecheck, so the green docgen run does not catch the called API. Other examples in this module already use `Result.getOrThrow`.
- failure: The published examples teach the throwing sync decoder that EF-3 tells callers not to use by default.
- fix: Decode those five examples with `Result.getOrThrow(S.decodeUnknownResult(Schema)(input))`. Keep the logged values the same.

### grok-2-6
- file: scratchpad/effected/schema-org/Vocabulary.ts:241
- class: effect-idiom   severity: backlog
- standard: effect-laws-v1 law 21   evidence: `ancestorsInOrder` is `A.getSomes(A.map(ancestorIndices(index), (ancestor) => A.get(TYPE_NAMES, ancestor)))` at Vocabulary.ts:241, and `propertiesInOrder` repeats that shape at :295. `A.filterMap` is the single-pass form of map-then-drop-none. Missing names were already dropped. Round-1 backlog-5 placed this kind of helper consolidation in backlog.
- failure: Each ordered vocabulary query allocates an intermediate `Option` array and walks the indices twice. Membership and order stay the same.
- fix: Replace both expressions with `A.filterMap(ancestorIndices(index), (ancestor) => A.get(TYPE_NAMES, ancestor))` and `A.filterMap(propertyIndices(index), (property) => A.get(PROPERTY_NAMES, property))`.

REQUIRED: 3
BACKLOG: 3

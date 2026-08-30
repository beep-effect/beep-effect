# Round 1 inventory — remainder-microdata

Slice: `scratchpad/microdata/Microdata.model.ts` only (remainder pack filter).
Census mechanical status: module open (`missing-module-summary|missing-packageDocumentation|missing-module-since`); **0** open owning exports.

Reviewed 1 exporting module and all **131** owning exports (66 value, 65 type, 0 re-exports). Census export findings are empty and match the source: every value has a useful lead, canonical `@category`, `@since 0.0.0`, and a titled Example; every type alias has prose, a described `@see`, `@category models`, and `@since 0.0.0`. No `@example` / `@remarks` / `@module` / `@template`. Every exported non-class schema has `$I.annoteSchema(...)` and a same-name `export type` immediately after the const. `makeHtmlUrlFromString` is a factory, not a schema const, so it correctly has no same-name alias.

Do not spend fixer budget on schema-annotation or same-name-alias rewrites. The remaining work is the module header plus sibling-choice `@see` and Gotchas already implied by implementation comments or codec/lexical splits.

---

### remainder-microdata-R1-001: Module header missing fileoverview contract

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (module header; `@packageDocumentation` not `@module`); scratchpad/.jsdoc-loop/census.ts (`missing-module-summary`, `missing-packageDocumentation`, `missing-module-since`)
- `affectedFiles`: scratchpad/microdata/Microdata.model.ts:1
- `symbol`: Microdata.model
- `kind`: module
- `evidence`: File opens at `import { $ScratchpadId }` with no leading `/**`. Census: `hasFileoverview=false`, `hasPackageDocumentation=false`, `hasSince=false`, `hasLead=false`. Confirmed rules: `missing-module-summary`, `missing-packageDocumentation`, `missing-module-since`. No `@module` to convert.
- `impact`: The 131 owning exports are HTML / XSD / RFC 6350 lexical spaces plus Effect codecs. Without a module lead, callers cannot tell when to pick a WHATWG string, an XSD subset, a vCard VALUE type, or a `*FromString` runtime codec.
- `suggestedFix`: Add a fileoverview before the first import with one useful lead (WHATWG HTML microdata / Microdata-to-RDF / RFC 6350 vCard lexical schemas and Effect codecs), then `@packageDocumentation` and `@since 0.0.0`. Never `@module`. Fold the line-28 transport-budget warning into a module `**Gotchas**` (see R1-002) rather than leaving it as a bare `//` comment.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-microdata
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-microdata-R1-002: Unbounded lexical spaces warned in code, absent from docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (`**Gotchas**` for invariants not visible from the signature)
- `affectedFiles`: scratchpad/microdata/Microdata.model.ts:28
- `symbol`: Microdata.model
- `kind`: module
- `evidence`: Implementation comment at line 28: `Lexical spaces without specification bounds remain unbounded; transport layers must apply payload-size budgets.` No JSDoc on the module or on unbounded string schemas (`HtmlYearString` `\d{4,}`, `HtmlUrlTokenString`, `VCardTextString`, `VCardIanaValueTypeString`, integer lexemes, and similar) restates this. Census cannot see it; it is a missing Gotcha the comment already warns about.
- `impact`: Callers will treat these schemas as safe request/body validators. A multi-megabyte year, TEXT-CHAR, or URL token still decodes. The payload-size budget belongs at the transport layer, not inside these filters.
- `suggestedFix`: Put one module-level `**Gotchas**` on the fileoverview from R1-001. Do not clone the sentence onto every string schema. Optional one-line `{@link}` from `VCardTextString` and `HtmlUrlTokenString` only if the module hover is too easy to miss.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-microdata
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-microdata-R1-001
- `status`: open
- `fixedCommit`: pending

### remainder-microdata-R1-003: Value-level siblings lack described `@see` for caller choice

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (described `@see` / `{@link}` when a sibling helps the reader choose)
- `affectedFiles`: scratchpad/microdata/Microdata.model.ts:309, scratchpad/microdata/Microdata.model.ts:651, scratchpad/microdata/Microdata.model.ts:735, scratchpad/microdata/Microdata.model.ts:851, scratchpad/microdata/Microdata.model.ts:883, scratchpad/microdata/Microdata.model.ts:924, scratchpad/microdata/Microdata.model.ts:1073, scratchpad/microdata/Microdata.model.ts:1119, scratchpad/microdata/Microdata.model.ts:1177, scratchpad/microdata/Microdata.model.ts:1214, scratchpad/microdata/Microdata.model.ts:1281, scratchpad/microdata/Microdata.model.ts:1385, scratchpad/microdata/Microdata.model.ts:1422, scratchpad/microdata/Microdata.model.ts:1467, scratchpad/microdata/Microdata.model.ts:1511, scratchpad/microdata/Microdata.model.ts:1707, scratchpad/microdata/Microdata.model.ts:1753, scratchpad/microdata/Microdata.model.ts:1887, scratchpad/microdata/Microdata.model.ts:2150, scratchpad/microdata/Microdata.model.ts:2330, scratchpad/microdata/Microdata.model.ts:2609, scratchpad/microdata/Microdata.model.ts:3028, scratchpad/microdata/Microdata.model.ts:3070
- `symbol`: HtmlDurationString, MicrodataDurationFromString, HtmlGlobalDateTimeString, MicrodataDateTimeFromString, MicrodataXsdDateString, MicrodataRdfTimeValueFromString, MicrodataRuntimeValueFromString, MicrodataUrlFromString, VCardUriString, VCardIntegerFromString, VCardTypedScalarFromString
- `kind`: value
- `evidence`: Type aliases already have described `@see` back to their own runtime schema (`for runtime validation and Effect codecs`). Value exports have no `@see` tags. Callers must choose among same-shaped `S.Top` values: `HtmlIsoDurationString` / `HtmlHumanDurationString` / `HtmlDurationString` / `HtmlDurationValue` / `MicrodataDurationFromString`; `HtmlGlobalDateTimeString` vs `MicrodataDateTimeFromString`; each `Html*String` vs its `MicrodataXsd*` subset (`Date`/`Time`/`Year`/`YearMonth`/`DateTime`); `XsdIntegerString` / `XsdIntegerFromString` / `XsdIntegerValue` vs `VCardIntegerString` / `VCardIntegerFromString` / `VCardIntegerValue` (bigint vs Int64); `XsdDoubleFromString` vs `VCardFloatFromString` (IEEE-754 + exponent vs BigDecimal, no scientific notation); `makeHtmlUrlFromString` (document-relative) vs `MicrodataSerializedUrlString` / `MicrodataUrlFromString` (already-absolute microdata URL); `HtmlUrlTokenString` vs `HtmlUrlPotentiallySurroundedBySpaces`; `MicrodataNumericValueFromString` vs `MicrodataDataValueFromString`; `MicrodataRdfTimeValueFromString` vs `MicrodataRuntimeValueFromString` vs `MicrodataContextualValueFromString`; `VCardValueType` / `VCardValueTypeString` / `VCardValueTypeFromString` / `VCardDeclaredValueTypeString`; `VCardTimestampString` / `VCardZonedTimestampString` / `VCardTimestampFromString`; `VCardUriString` vs `VCardUrlFromString`.
- `impact`: Picking the lexical schema when the caller wanted a Duration / DateTime / URL / bigint (or the HTML superspace when RDF typing requires the XSD subset) typechecks and then silently changes downstream types or rejects legal HTML lexemes.
- `suggestedFix`: Add one described `@see` on each value-level schema in a choice cluster, after Examples and before `@category`. Do not add extra Examples. Purpose phrases must state the difference, e.g. `@see {@link MicrodataDurationFromString} to decode either HTML duration lexeme to an Effect Duration.` `@see {@link HtmlDurationString} to validate the lexical form without converting.` `@see {@link VCardIntegerFromString} for the Int64-bounded codec; {@link XsdIntegerFromString} for unbounded xsd:integer.` Keep existing type-alias `@see` tags as they are.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-microdata
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-microdata-R1-004: `VCardIntegerFromString` missing Int64-vs-unbounded-lexical Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (`**Gotchas**` for failure modes not visible from the signature)
- `affectedFiles`: scratchpad/microdata/Microdata.model.ts:2436, scratchpad/microdata/Microdata.model.ts:2609, scratchpad/microdata/Microdata.model.ts:2643
- `symbol`: VCardIntegerFromString
- `kind`: value
- `evidence`: `VCardIntegerString` is `/^[+-]?\d+$/` with no magnitude bound. `VCardIntegerFromString` decodes through `VCardIntegerValue` = `Int64` (`-2^63..2^63-1`). The file already documents the same split for `MicrodataDateTimeFromString` (HTML lexeme vs Effect instant range) and `VCardTimestampFromString` (floating / leap-second lexemes vs `DateTime.Utc`). `VCardIntegerFromString` only says "backed by a signed 64-bit bigint" and its Example decodes `"+42"` with no failure case. `XsdIntegerFromString` is unbounded `S.BigInt` sitting in the same file.
- `impact`: A syntactically valid RFC 6350 INTEGER such as `9223372036854775808` passes `VCardIntegerString` and fails only at the codec. Callers who validate with the lexical schema then decode, or who grab `XsdIntegerFromString` by mistake, will not see that bound until runtime.
- `suggestedFix`: Add `**Gotchas**` on `VCardIntegerFromString` (and a one-line pointer on `VCardIntegerString` / `VCardIntegerValue`): lexical integers outside int64 remain accepted by {@link VCardIntegerString} and fail only here; use {@link XsdIntegerFromString} for arbitrary-precision XML Schema integers. Keep the existing Example; do not add a second one unless the fixer wants a single observable `Effect.exit` of an overflow lexeme inside the current fence.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-microdata
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-microdata-R1-003
- `status`: open
- `fixedCommit`: pending

### remainder-microdata-R1-005: `HtmlHumanDurationString` omits fractional-seconds-only rule

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (`**Gotchas**` / Details only for facts not obvious from the signature)
- `affectedFiles`: scratchpad/microdata/Microdata.model.ts:256, scratchpad/microdata/Microdata.model.ts:701
- `symbol`: HtmlHumanDurationString
- `kind`: value
- `evidence`: Lead: "Human-readable WHATWG duration syntax with unique scales in any order." Predicate `isHtmlHumanDuration` also requires `unit === "S" || !Str.includes(".")(amount)` (line 267). `1.5h` / `1.5m` reject; `1.5s` accepts. Unique-order is in the lead; the fractional-unit rule is only in the helper.
- `impact`: Callers will assume any unique `W|D|H|M|S` token may carry a millisecond fraction. The schema rejects fractional non-second units that look like the documented "human-readable" form.
- `suggestedFix`: Add a short `**Gotchas**` (or one Details sentence): only the `S` scale may include a `.` fraction, at most three digits; duplicate scales still fail. Keep the current `1h 30m` Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-microdata
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-microdata-R1-006: `*FromString` codecs canonicalize on encode; JSDoc calls them reversible without saying how

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (`**Gotchas**` for encoding/ownership not visible from `S.decodeTo`)
- `affectedFiles`: scratchpad/microdata/Microdata.model.ts:1031, scratchpad/microdata/Microdata.model.ts:1119, scratchpad/microdata/Microdata.model.ts:1314, scratchpad/microdata/Microdata.model.ts:1385, scratchpad/microdata/Microdata.model.ts:2573, scratchpad/microdata/Microdata.model.ts:2796, scratchpad/microdata/Microdata.model.ts:2870, scratchpad/microdata/Microdata.model.ts:2922, scratchpad/microdata/Microdata.model.ts:2989
- `symbol`: MicrodataDurationFromString, VCardBooleanFromString, VCardUtcOffsetFromString, VCardTimestampFromString, XsdDoubleFromString
- `kind`: value
- `evidence`: Several leads say "reversible" / "codec" but encode is canonical, not spelling-preserving. `formatHtmlDuration` always emits `P…T…` ISO, so `1h 30m` decodes then encodes as `PT1H30M`. `VCardBooleanFromString` encodes `TRUE`/`FALSE` (annotation description mentions uppercase; JSDoc lead does not). `formatVCardUtcOffset` always writes `±HHMM`, so `+05` becomes `+0500`. `isoUtcToVCardTimestamp` drops offsets to a `Z` UTC spelling. `formatXsdDouble` turns integer-looking numbers into `n.0` and `-0` into `-0.0`. Examples only decode; none show the encoded spelling.
- `impact`: Equality on the encoded string, HTTP content hashing, or round-trip fixtures against the original lexeme will fail even when decode succeeded. Duration callers who stored human form will see ISO after encode.
- `suggestedFix`: One `**Gotchas**` on each named codec stating the canonical encode spelling. `MicrodataDurationFromString` is the highest-priority (human vs ISO). Do not add extra Examples; a single `console.log` of encode next to the existing decode is enough if the fixer touches the fence.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-microdata
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-microdata-R1-007: `VCardUrlFromString` accepts a subset of `VCardUriString` with no Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (Gotchas + described sibling `@see`)
- `affectedFiles`: scratchpad/microdata/Microdata.model.ts:2150, scratchpad/microdata/Microdata.model.ts:3028
- `symbol`: VCardUrlFromString
- `kind`: value
- `evidence`: `VCardUriString` Example decodes `urn:example:item` (absolute RFC 3986 URI). `VCardUrlFromString` is `VCardUriString.pipe(S.decodeTo(S.URLFromString, { decode: passthroughSubtype }))`. Lead only says "URL-compatible subset". No Gotcha that URNs and other non-WHATWG absolute URIs pass `VCardUriString` and fail this codec. No `@see` either direction.
- `impact`: vCard `URI` / `URL` properties are easy to wire to the wrong schema. `urn:…` is the documented success case for the lexical schema and a failure case for the URL codec.
- `suggestedFix`: Gotcha on `VCardUrlFromString`: values such as `urn:example:item` remain valid {@link VCardUriString} and fail WHATWG URL parsing here. Described `@see` both ways. Keep both Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-microdata
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-microdata-R1-003
- `status`: open
- `fixedCommit`: pending

### remainder-microdata-R1-008: `HtmlTimeZoneOffsetString` rejects `-00:00` without a Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (`**Gotchas**` for non-obvious domain constraints)
- `affectedFiles`: scratchpad/microdata/Microdata.model.ts:36, scratchpad/microdata/Microdata.model.ts:523
- `symbol`: HtmlTimeZoneOffsetString
- `kind`: value
- `evidence`: Lead: "WHATWG time-zone offset microsyntax, including offsets through 23:59." Pattern `htmlTimeZoneOffsetPattern` allows `Z` and `+00:00` / `+0000`, and rejects negative zero via `-(?!00:?00$)`. Example only shows `+05:30`. `VCardUtcOffsetString` in the same file admits `-0000` / `-00` as a signed offset (no `Z`, no colon).
- `impact`: Callers normalizing "UTC" as `-00:00` (common in ISO-ish dumps) will fail HTML offset validation while `+00:00` and `Z` succeed. The lead's "through 23:59" reads as if both signs of zero are in range.
- `suggestedFix`: Gotcha: negative zero (`-00:00` / `-0000`) is rejected; use `Z` or `+00:00`. Optional described `@see` {@link VCardUtcOffsetString} for the RFC 6350 `±HHMM` form without `Z`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-microdata
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-microdata-R1-009: `VCardTypedScalarFromString` mixed lexical vs runtime branches undocumented

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (`**Details**` / `**Gotchas**` for union-branch semantics)
- `affectedFiles`: scratchpad/microdata/Microdata.model.ts:3114
- `symbol`: VCardTypedScalarFromString
- `kind`: value
- `evidence`: Details explain the `_tag` boundary against ambiguous strings (`TRUE`, `10`, `urn:example:x`). The union is not uniform: `boolean` / `integer` / `float` / `utc-offset` decode through `*FromString` codecs (boolean, Int64, BigDecimal, Duration); `text` / `uri` / `date` / `time` / `date-time` / `date-and-or-time` / `timestamp` / `language-tag` stay lexical strings (`timestamp` is `VCardTimestampString`, not `VCardTimestampFromString`). Example only shows `{ _tag: "text", value: "plain text" }`.
- `impact`: A caller who tags `timestamp` expecting `DateTime.Utc`, or `uri` expecting `URL`, gets a branded string. The adjacent `MicrodataContextualValueFromString` *does* decode URL / numeric / runtime branches. That mismatch is not in the Details.
- `suggestedFix`: Extend Details or add Gotchas: only `boolean`, `integer`, `float`, and `utc-offset` decode to runtime values; `timestamp` remains {@link VCardTimestampString} — convert with {@link VCardTimestampFromString} separately. `@see` {@link VCardTimestampFromString} and {@link VCardUrlFromString}. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-microdata
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-microdata-R1-003
- `status`: open
- `fixedCommit`: pending

---

## Census confirmation (no extra mechanical items)

Owning exports in `microdata/Microdata.model.ts` (131) are mechanically closed. Confirmed, not false positives:

- Value consts: lead + `@category` (`schemas` or `constructors` for `makeHtmlUrlFromString`) + `@since 0.0.0` + titled `**Example** (Title)` with one `ts` fence and a decode/`S.is` call.
- Type aliases: "Decoded value produced by {@link …}" + described `@see` + `@category models` + `@since 0.0.0` (matches annotation-patterns.md; Example optional).
- `$I.annoteSchema` present on every exported schema, including LiteralKit wrappers `HtmlDurationUnit` and `VCardValueType` (pipe + `annoteSchema` is equivalent to `.annotate($I.annote(...))` here).
- Same-name `export type X = typeof X.Type` immediately after each exported non-class schema (65/65). `makeHtmlUrlFromString` is a factory; no alias required.
- No named `Schema`/`Option`/`Array` imports inside Examples; no `@effected/*`; no `void` discards.

## Rejected (do not open)

- Extra Examples on the 66 value exports that already have one titled, observable fence.
- Empty `**When to use**` / `**Details**` to fill the section shape.
- Rewording formulaic same-name type-alias leads ("Decoded value produced by {@link X}").
- Switching `@category models` on those aliases to `type-level` (file convention + annotation-patterns.md).
- Switching runtime schema `@category schemas` to `codecs`/`decoding` (file-wide convention).
- LiteralKit `.annotate($I.annote)` vs `$I.annoteSchema` style churn.
- Mass-flagging `console.log(value)` after `decodeUnknownEffect` as vacuous: each fence runs the schema on a realistic lexeme (not `console.log(fn)`). Stronger `// =>` assertions are cleanup-on-touch if a fixer already edits that fence (R1-006).
- Census type-level "missing `@example`" — not flagged; types are prose-only by kind split.

## Pack verdict

- files reviewed: 1
- owning exports reviewed: 131
- confirmed mechanical items: 1
- editorial items: 8
- rejected false positives: 0
- accepted findings: 9

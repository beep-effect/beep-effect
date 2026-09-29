---
"@beep/schema": minor
"@beep/shared-use-cases": patch
"@beep/observability": minor
"@beep/agents-client": patch
"@beep/epistemic-domain": patch
"@beep/law-practice-server": patch
"@beep/uspto": minor
"@beep/repo-ai-metrics": patch
"@beep/repo-configs": patch
"@beep/oip-web": patch
"@beep/professional-desktop": patch
"@beep/ciops": patch
---

Retire the text and misc schema concepts under the "Upstream-First Foundation/Modeling"
decision (`standards/architecture/DECISIONS.md`, 2026-09-29): `String`, `CommonTextSchemas`,
`KebabStr`, `PascalStr`, `SnakeStr`, `BigDecimal`, `Logs`, `StatusCauseError` and `FileInfo` are
deleted with their barrel and subpath exports, together with the zero-consumer
`SchemaUtils` facades `encodeEffect`, `encodeUnknownEffect`, `encodeExit`, `encodeUnknownExit`,
`encodeOption`, `encodeUnknownOption`, `encodeResult`, `encodeUnknownResult`, `encodePromise`,
`encodeUnknownPromise`, `split` and `classStatics` (and its effect-laws allowlist entry). No alias
is left behind; every consumer migrates in the same change.

Upstream covers each consumed facet. Trimmed non-empty text is `S.Trim.check(S.isNonEmpty(...))`
(`TrimmedNonEmptyText` sites use `S.String` decoded to `S.NonEmptyString` with
`SchemaTransformation.trim()`, its exact behavior). UUIDs add `S.isUUID()`; repo-cli and the
effect-ontology scratchpad each declare the composition once. Log levels are
`S.Literals(LogLevel.values)` from `effect/LogLevel`. Status/cause fields are inlined into the
`@beep/observability` HTTP errors. File-system stat checks read `FileSystem.File.Info["type"]`.
`ISOStr` keeps the boundary-table composition, so its persisted bytes and issue messages do not
change. `PromotionBlockReason`, a promoted `shared/use-cases` field, keeps its decoded type, brand
keys (`NonEmptyTrimmedStr`, `KebabCaseStr`, `PromotionBlockReason`), accepted values and bytes
through a consumer-local composition.

`URL` (`URLStr`, `HttpsUrl`) is held out of this change for an operator ruling (SPEC goal-time
row 2026-09-29). The planned upstream target `S.URL` / `S.URLFromString` re-encodes a
canonicalized `href` (`"https://api.govinfo.gov"` becomes `"https://api.govinfo.gov/"`, hosts are
lowercased, spaces become `%20`), which would change stored and served bytes (`EvidenceReceipt`
`uri`/`id`/`resourceUri`, uspto-mcp `downloadUrl`, Box payload URLs) and break six driver base-URL
invariants. The byte-preserving string wire is a composition,
`S.Trim.check(S.isNonEmpty(...), S.makeFilter(flow(S.decodeUnknownOption(S.URLFromString), O.isSome)))`,
but upstream has no named string-wire URL schema, so retiring means a local schema in each of 22
consuming packages (about 175 lines; `URLStr` in 41 files, `HttpsUrl` in 13). `JSONSchema` moves
to its own follow-up change.

Type-check cost, tsgo 7.0.2, fresh build-info, before → after. The gate is the
`--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 694,907 | 202,571 → 198,872 | 0.997 → 1.019 s |
| `@beep/repo-cli` | 4,126,448 → 4,125,297 | 1,059,620 → 1,059,228 | 10.951 → 10.316 s |
| `@beep/law-practice-domain` | 874,541 → 874,541 | 259,729 → 259,729 | 1.144 → 1.225 s |

Check time is advisory within a 5% band. Flagged: `@beep/law-practice-domain` single-threaded
check time rose 7.1% (1.144 → 1.225 s) with identical instantiations and types, on a package
whose sources this change does not touch, measured on a shared, loaded workstation; three
repeat runs on the same tree read 1.137, 1.203 and 1.176 s, and its four-checker time fell
(0.714 → 0.659 s).

The default four-checker run is advisory:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,097,553 | 367,663 → 365,013 | 0.563 → 0.518 s |
| `@beep/repo-cli` | 8,433,860 → 8,430,731 | 2,153,175 → 2,152,580 | 4.952 → 4.579 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,290,676 | 376,265 → 376,265 | 0.714 → 0.659 s |

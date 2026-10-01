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
"@beep/professional-desktop": minor
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

Type-check cost, tsgo 7.0.2, fresh build-info, before (`origin/main` at 7cc0aa9b33) → after.
The gate is the `--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 695,062 | 202,571 → 198,941 | 1.168 → 1.122 s |
| `@beep/repo-cli` | 4,152,690 → 4,151,579 | 1,067,045 → 1,066,662 | 12.810 → 12.612 s |
| `@beep/law-practice-domain` | 874,541 → 874,541 | 259,729 → 259,729 | 1.275 → 1.437 s |

Check time is advisory within a 5% band. Flagged: `@beep/law-practice-domain` single-threaded
check time read 12.7% higher (1.275 → 1.437 s) with identical instantiations and types, on a
package whose sources this change does not touch, measured on a shared, loaded workstation;
interleaved repeat runs read 1.739 and 1.375 s on the base against 1.562 and 1.504 s on this
change.

The default four-checker run is advisory:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,098,167 | 367,663 → 365,290 | 0.581 → 0.496 s |
| `@beep/repo-cli` | 8,429,151 → 8,427,182 | 2,149,366 → 2,148,624 | 4.855 → 5.093 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,290,676 | 376,265 → 376,265 | 0.735 → 0.820 s |

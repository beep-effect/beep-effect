---
"@beep/schema": minor
"@beep/acp": patch
"@beep/ai-provider-cli": patch
"@beep/ai-sync": patch
"@beep/documents-domain": patch
"@beep/documents-server": patch
"@beep/documents-use-cases": patch
"@beep/drizzle": patch
"@beep/duckdb": patch
"@beep/ecfr": patch
"@beep/editor": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-use-cases": patch
"@beep/exiftool": patch
"@beep/face-detection": patch
"@beep/ffmpeg": patch
"@beep/file-processing": patch
"@beep/govinfo": patch
"@beep/html": patch
"@beep/hubspot": patch
"@beep/law-practice-server": patch
"@beep/law-practice-tables": patch
"@beep/law-practice-use-cases": patch
"@beep/lexical-schema": patch
"@beep/mcp-kit": patch
"@beep/md": patch
"@beep/nlp-mcp": patch
"@beep/nlp-processing": patch
"@beep/obs": patch
"@beep/observability": patch
"@beep/onepassword-cli": patch
"@beep/openai-compat": patch
"@beep/openclaw": patch
"@beep/pandoc-ast": patch
"@beep/pglite": patch
"@beep/phoenix": patch
"@beep/postgres": patch
"@beep/practice-kg-mcp": patch
"@beep/professional-desktop": patch
"@beep/qa-capture": patch
"@beep/repo-ai-metrics": patch
"@beep/runpod": patch
"@beep/sanity": patch
"@beep/shared-domain": patch
"@beep/tailscale": patch
"@beep/test-utils": patch
"@beep/wink": patch
"@beep/workspace-domain": patch
"@beep/xai": patch
---

Retire the `@beep/schema` Opaque, Record, SafeObject, Primitive, Options and
Transformations concepts and the zero-consumer SchemaUtils helpers under the
"Upstream-First Foundation/Modeling" decision (`standards/architecture/DECISIONS.md`,
2026-09-29; goal `effect-schema-parity`, P3 PR 3-ii). Deleted with their barrel,
subpath and path-alias entries, with no alias left behind: `Defect`,
`OpaqueUnknown`, `UnknownRecord`, `SafeObject`, `SafeObjectFromObjectKeyword`,
`Primitive`, `OptionFromOptionalNullishKey`, `destructiveTransform`, and
`SchemaUtils.optional`, `optionalKeyWithDefault`, `pluck`, `withEncodeDefault`,
`boolWithDefault`, `BoolDefaultFalse`, `BoolDefaultTrue` and `boolKeyWithDefault`.
`SchemaUtils.BoolKeyDefaultFalse` / `BoolKeyDefaultTrue` stay, rebuilt directly on
`S.withConstructorDefault` + `S.withDecodingDefaultTypeKey` with unchanged
behavior. Every consumer migrates in the same change.

Codemod evidence: commit 52050b5de9 cherry-picks ce83cf6929 (from PR 3-i) to add
the transient repo-cli rules `unknown-json-retirement` and
`opaque-record-retirement`. This PR applies `opaque-record-retirement` to
packages, apps, scratchpad and infra, tooling first (147 files, 0 quarantined;
the 4 residue sites are the archival research probe
`goals/effect-schema-parity/research/tools/facet-probe.ts`, left as recorded
evidence) and removes both rules in its last commit.

- `Defect(options)` becomes `S.Defect(options).pipe(S.overrideToEquivalence(() => () => true))`
  at the owning field, so `S.toEquivalence` of the owning error keeps ignoring
  the cause; `OpaqueUnknown` becomes the same override over `S.Unknown`. Encoded
  JSON is unchanged. repo-cli's 44 cause fields share that composition as one
  internal `OpaqueDefect` schema, and the epistemic use-case errors share their
  optional-defect field through one internal helper.
- `UnknownRecord` becomes `S.Record(S.String, S.Unknown)` (a file-local
  `UnknownRecord` const where a file uses it more than once) and
  `Readonly<Record<string, unknown>>` in type positions.
- `SafeObject` moves into scratchpad CodeMode as a local schema with the same
  `SafeObject` brand; `OptionFromOptionalNullishKey(S.String)` becomes
  `S.OptionFromOptionalNullOr(S.String)`; `FileDiff`'s `file` and `patch` keep
  the retired `SchemaUtils.optional` shape through a file-local
  `S.optionalKey(S.String)` decoded to `S.toType(S.optional(S.String))`: the key
  stays optional on the wire, `{ file: undefined }` still fails to decode, and the
  decoded type keeps `| undefined`, so `make({ file: undefined })` encodes with
  the key omitted.
- Schemas that referenced the retired members lose their `@beep/schema`
  identifier annotations. `@beep/schema` drops its now-unused `@beep/types`
  dev dependency.

Type-check cost, tsgo 7.0.2, fresh build-info, before (PR 3-i head 579c05d32d) → after.
The gate is the `--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 709,201 → 703,163 | 202,247 → 200,410 | 1.085 → 1.020 s |
| `@beep/repo-cli` | 4,152,422 → 4,152,561 | 1,067,031 → 1,066,974 | 11.644 → 10.784 s |
| `@beep/law-practice-domain` | 874,290 → 874,290 | 259,707 → 259,707 | 1.092 → 1.208 s |
| `@beep/repo-cli`, cumulative from `origin/main` 7cc0aa9b33 (before PR 3-i) | 4,152,690 → 4,152,561 | 1,067,045 → 1,066,974 | 11.846 → 10.784 s |

Flagged: `@beep/repo-cli` rises by 139 instantiations. The retired `Defect()`
hid `S.overrideToEquivalence` behind a declared `S.Defect` return type; the
first use of the override in the repo-cli program costs about 150
instantiations (sharing one `S.Defect({ includeStack: true })` without the
override measures 4,152,409). Keeping the always-true equivalence facet the
audit requires makes that cost unavoidable; the shared `OpaqueDefect` removes
the per-site cost (inline at all 44 sites measured 4,152,904). Against
`origin/main` 7cc0aa9b33 (4,152,690) repo-cli is 129 lower after PRs 3-i and
3-ii. `@beep/law-practice-domain` check time rose 10.6% with identical
instantiations and types, on a shared, loaded workstation; check time is
advisory within a 5% band.

The default four-checker run is advisory:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,109,966 → 1,110,150 | 366,181 → 368,595 | 0.487 → 0.473 s |
| `@beep/repo-cli` | 8,427,502 → 8,428,353 | 2,149,094 → 2,149,041 | 4.329 → 4.237 s |
| `@beep/law-practice-domain` | 1,289,799 → 1,289,799 | 376,131 → 376,131 | 0.665 → 0.696 s |

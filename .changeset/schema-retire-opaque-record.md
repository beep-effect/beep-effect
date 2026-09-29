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

Codemod evidence: commit 7c88e924ec cherry-picks ce83cf6929 (from PR 3-i) to add
the transient repo-cli rules `unknown-json-retirement` and
`opaque-record-retirement`. This PR applies `opaque-record-retirement` to
packages, apps, scratchpad and infra, tooling first (147 files, 0 quarantined;
the 4 residue sites are the archival research probe
`goals/effect-schema-parity/research/tools/facet-probe.ts`, left as recorded
evidence) and removes both rules in its last commit.

- `Defect(options)` becomes `S.Defect(options).pipe(S.overrideToEquivalence(() => () => true))`
  at the owning field, so `S.toEquivalence` of the owning error keeps ignoring
  the cause; `OpaqueUnknown` becomes the same override over `S.Unknown`. Encoded
  JSON is unchanged. The epistemic use-case errors share the rewritten
  optional-defect field through one internal helper.
- `UnknownRecord` becomes `S.Record(S.String, S.Unknown)` (a file-local
  `UnknownRecord` const where a file uses it more than once) and
  `Readonly<Record<string, unknown>>` in type positions.
- `SafeObject` moves into scratchpad CodeMode as a local schema with the same
  `SafeObject` brand; `OptionFromOptionalNullishKey(S.String)` becomes
  `S.OptionFromOptionalNullOr(S.String)`; `FileDiff`'s `file` and `patch` use
  `S.optionalKey(S.String)`, dropping `| undefined` from the decoded type.
- Schemas that referenced the retired members lose their `@beep/schema`
  identifier annotations. `@beep/schema` drops its now-unused `@beep/types`
  dev dependency.

MEASUREMENTS_PLACEHOLDER

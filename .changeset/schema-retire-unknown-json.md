---
"@beep/schema": minor
"@beep/agents-use-cases": patch
"@beep/ai-sync": patch
"@beep/db-admin": patch
"@beep/discord": patch
"@beep/dock": patch
"@beep/duckdb": patch
"@beep/editor": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-ui": patch
"@beep/exiftool": patch
"@beep/ffmpeg": patch
"@beep/gov-legal-mcp": patch
"@beep/html": patch
"@beep/infra": patch
"@beep/langextract": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-server": patch
"@beep/law-practice-tables": patch
"@beep/lexical-schema": patch
"@beep/lint-rules": patch
"@beep/mcp-kit": patch
"@beep/md": patch
"@beep/nlp-mcp": patch
"@beep/oip-web": patch
"@beep/openai-compat": patch
"@beep/openclaw": patch
"@beep/pacer": patch
"@beep/pandoc-ast": patch
"@beep/professional-desktop": patch
"@beep/repo-ai-metrics": patch
"@beep/repo-configs": patch
"@beep/repo-docgen": patch
"@beep/runpod": patch
"@beep/skill-contract": patch
"@beep/ui": patch
"@beep/uspto-mcp": patch
"@beep/venice-ai": patch
"@beep/xai": patch
---

Retire the `@beep/schema` Unknown and Json concepts under the "Upstream-First
Foundation/Modeling" decision (`standards/architecture/DECISIONS.md`, 2026-09-29;
goal `effect-schema-parity`, P3 PR 3-i). `@beep/schema/Unknown` and
`@beep/schema/Json` are deleted with their barrel and subpath exports (`Unknown`,
`UnknownFromJsonString`, `JsonObject`, `JsonArray`, `decodeJsonString`,
`encodeJsonString`), and no alias is left behind. Upstream covers each one:
`S.fromJsonString(S.Unknown)`, `S.Unknown`, `S.JsonObject` and `S.Array(S.Json)`.
Every consumer migrates in the same change.

Codemod evidence: commit ce83cf6929 adds the transient repo-cli codemod rules
`unknown-json-retirement` and `opaque-record-retirement` (one shared planner,
fixture tests on Bun and Node). This PR applies `unknown-json-retirement` to
packages, apps, scratchpad and infra (186 files, 0 residue, 0 quarantined, plus
24 test files re-run after merging main) and removes both rules in its last
commit, since a rule whose target concept is gone can never run again. The
follow-up PR cherry-picks ce83cf6929 for `opaque-record-retirement`.

- Bound codec statics (`UnknownFromJsonString.decodeUnknownEffect` and the rest)
  and `decodeJsonString` / `encodeJsonString` become codecs compiled at module
  level: in place for module-level reads, and a hoisted runner such as
  `decodeUnknownJsonEffect` for reads inside function bodies, so no codec is
  compiled inside a function. A file that needs the composition more than once
  shares one `UnknownJson` const.
- Behavior change: the Sync statics (`encodeUnknownSync`, `decodeUnknownSync`;
  51 codec declarations) become `flow(S.<codec>Result(schema), Result.getOrThrow)`, because
  `effect(schemaSync)` rejects `S.*Sync` calls. On failure they now throw the
  `SchemaError` value instead of the `Error` the Sync runner threw. No caller
  catches, inspects or asserts on that thrown value: every site encodes a
  string or a plain JSON record, and the nearby `try`/`catch` blocks wrap
  other operations.
- Encoded JSON bytes are unchanged; `S.fromJsonString(S.Unknown)` is the
  composition the retired schema was built from. Schemas that referenced
  `Unknown`, `UnknownFromJsonString` or `JsonObject` as a value lose those
  members' `@beep/schema` identifier annotations.

Type-check cost, tsgo 7.0.2, fresh build-info, before (`origin/main` at 7cc0aa9b33) → after.
The gate is the `--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 709,201 | 202,571 → 202,247 | 1.190 → 1.282 s |
| `@beep/repo-cli` | 4,152,690 → 4,152,422 | 1,067,045 → 1,067,031 | 11.846 → 11.982 s |
| `@beep/law-practice-domain` | 874,541 → 874,290 | 259,729 → 259,707 | 1.208 → 1.352 s |

Check time is advisory within a 5% band. Flagged: `@beep/schema` (+7.7%) and
`@beep/law-practice-domain` (+11.9%) single-threaded check times rose with lower
instantiations and types, on a shared, loaded workstation; two immediate repeats
read 1.022 s and 1.091 s for `@beep/schema` and 1.195 s and 1.273 s for
`@beep/law-practice-domain`, inside the band.

The default four-checker run is advisory; its totals depend on how files split
across checkers:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,109,966 | 367,663 → 366,181 | 0.540 → 0.522 s |
| `@beep/repo-cli` | 8,429,151 → 8,427,502 | 2,149,366 → 2,149,094 | 4.677 → 5.064 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,289,799 | 376,265 → 376,131 | 0.716 → 0.697 s |

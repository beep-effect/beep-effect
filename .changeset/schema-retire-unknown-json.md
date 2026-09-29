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
Every consumer migrates in the same change, through the new repo-cli
`unknown-json-retirement` codemod rule (`opaque-record-retirement` is registered
and tested for the follow-up PR).

- Bound codec statics (`UnknownFromJsonString.decodeUnknownEffect` and the rest)
  and `decodeJsonString` / `encodeJsonString` become codecs compiled at module
  level: in place for module-level reads, and a hoisted runner such as
  `decodeUnknownJsonEffect` for reads inside function bodies, so no codec is
  compiled inside a function. A file that needs the composition more than once
  shares one `UnknownJson` const.
- Behavior change: the Sync statics (`encodeUnknownSync`, `decodeUnknownSync`;
  57 sites) become `flow(S.<codec>Result(schema), Result.getOrThrow)`, because
  `effect(schemaSync)` rejects `S.*Sync` calls. On failure they now throw the
  `SchemaError` value instead of the `Error` the Sync runner threw. No caller
  catches, inspects or asserts on that thrown value: every site encodes a
  string or a plain JSON record, and the nearby `try`/`catch` blocks wrap
  other operations.
- Encoded JSON bytes are unchanged; `S.fromJsonString(S.Unknown)` is the
  composition the retired schema was built from. Schemas that referenced
  `Unknown`, `UnknownFromJsonString` or `JsonObject` as a value lose those
  members' `@beep/schema` identifier annotations.

Type-check cost, tsgo 7.0.2, fresh build-info, before (the codemod engine
branch at 3ceb39e76c) → after. The gate is the `--singleThreaded` instantiation
count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 709,201 | 202,571 → 202,247 | 1.057 → 1.125 s |
| `@beep/repo-cli` | 4,152,142 → 4,157,895 | 1,066,767 → 1,068,623 | 10.849 → 10.092 s |
| `@beep/law-practice-domain` | 874,541 → 874,290 | 259,729 → 259,707 | 1.157 → 1.214 s |

Flagged: `@beep/repo-cli` rises by 5,753 instantiations. The retirement itself
lowers it: with the new rule module removed and the rule-id kit and registry
back at the engine branch, repo-cli measures 4,151,882 (−260). The increase is
the new codemod rules: registering the two rule ids with do-nothing bodies costs
+1,099, and the rule bodies the rest. Check time is advisory within a 5% band;
`@beep/schema` single-threaded check time rose 6.4% on a shared, loaded
workstation while its instantiations fell.

The default four-checker run is advisory; its totals depend on how files split
across checkers:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,109,966 | 367,663 → 366,181 | 0.515 → 0.476 s |
| `@beep/repo-cli` | 8,428,407 → 8,496,231 | 2,149,058 → 2,164,854 | 4.226 → 4.008 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,289,799 | 376,265 → 376,131 | 0.692 → 0.703 s |

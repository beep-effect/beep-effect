---
"@beep/schema": minor
"@beep/acp": patch
"@beep/agents-client": patch
"@beep/agents-domain": patch
"@beep/agents-server": patch
"@beep/agents-use-cases": patch
"@beep/ai-provider-cli": patch
"@beep/ai-sync": patch
"@beep/anthropic": patch
"@beep/architecture-lab-config": patch
"@beep/architecture-lab-domain": patch
"@beep/architecture-lab-ui": patch
"@beep/architecture-lab-use-cases": patch
"@beep/box": patch
"@beep/box-provisioning": patch
"@beep/brand": patch
"@beep/chalk": patch
"@beep/ciops": patch
"@beep/cosmos": patch
"@beep/discord": patch
"@beep/dock": patch
"@beep/dock-react": patch
"@beep/doc-text": patch
"@beep/documents-use-cases": patch
"@beep/drizzle": patch
"@beep/duckdb": patch
"@beep/ecfr": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-use-cases": patch
"@beep/exiftool": patch
"@beep/face-detection": patch
"@beep/ffmpeg": patch
"@beep/firecrawl": patch
"@beep/freshbooks": patch
"@beep/govinfo": patch
"@beep/graph-3d": patch
"@beep/html": patch
"@beep/hubspot": patch
"@beep/infra": patch
"@beep/langextract": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-server": patch
"@beep/law-practice-use-cases": patch
"@beep/lejeune-bolt-workbench": patch
"@beep/lexical-schema": patch
"@beep/libpff": patch
"@beep/m365": patch
"@beep/m365-mcp": patch
"@beep/mcp-kit": patch
"@beep/md": patch
"@beep/n3": patch
"@beep/nlp": patch
"@beep/nlp-mcp": patch
"@beep/nlp-processing": patch
"@beep/obs": patch
"@beep/observability": patch
"@beep/oip-web": patch
"@beep/onepassword-cli": patch
"@beep/ontology": patch
"@beep/ontology-client": patch
"@beep/ontology-use-cases": patch
"@beep/openai": patch
"@beep/openai-compat": patch
"@beep/openclaw": patch
"@beep/pacer": patch
"@beep/pandoc-ast": patch
"@beep/pglite": patch
"@beep/phoenix": patch
"@beep/postgres": patch
"@beep/pretext": patch
"@beep/professional-desktop": patch
"@beep/qa-capture": patch
"@beep/rdf": patch
"@beep/repo-ai-metrics": patch
"@beep/repo-configs": patch
"@beep/runpod": patch
"@beep/sanity": patch
"@beep/semantica": patch
"@beep/semantic-web": patch
"@beep/shared-domain": patch
"@beep/test-utils": patch
"@beep/tika": patch
"@beep/ui": patch
"@beep/uspto": patch
"@beep/uspto-mcp": patch
"@beep/venice-ai": patch
"@beep/wink": patch
"@beep/workspace-domain": patch
"@beep/workspace-use-cases": patch
"@beep/xai": patch
---

Retire the `SchemaUtils` default helpers under the "Upstream-First Foundation/Modeling" decision
(`standards/architecture/DECISIONS.md`, 2026-09-29): `withNoneDefault`, `withConstantDefault`,
`withKeyDefaults`, and `withEmptyArrayDefaults` are deleted with the
`SchemaUtils/withConstructorDefaults` module and their barrel exports, and no alias is left
behind. Every consumer moves to upstream `effect/Schema` in the same change:

- `withNoneDefault` becomes `S.withConstructorDefault(Effect.succeedNone)`.
- `withConstantDefault(v)` becomes `S.withConstructorDefault(Effect.succeed(v))`, keeping any
  explicit type argument on `Effect.succeed`.
- `withKeyDefaults(v)` becomes `S.withConstructorDefault(Effect.succeed(v))` followed by
  `S.withDecodingDefaultTypeKey(Effect.succeed(v))`. A constructed default is bound to one const
  first, so both defaults still share one instance. A literal default on a literal-typed schema
  takes `as const`, because `Effect.succeed` would otherwise widen it.
- `withEmptyArrayDefaults` becomes the same pair over one `A.empty<T>()` const, with
  `S.withDecodingDefaultType`.

`boolKeyWithDefault`, `BoolKeyDefaultFalse`, and `BoolKeyDefaultTrue` stay and are rebuilt on the
upstream pair. Defaults affect construction and decoding only: persisted and served encodings are
byte-identical. A probe over the 354 rewritten modules found identical encoded JSON Schema and
seeded-sample JSON bytes for all 2,862 schema exports.

Type-check cost, tsgo 7.0.2, fresh build-info, before (`origin/main` at 7cc0aa9b33) → after.
The gate is the `--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 700,855 | 202,571 → 200,297 | 1.083 → 1.032 s |
| `@beep/repo-cli` | 4,152,690 → 4,138,154 | 1,067,045 → 1,063,262 | 13.217 → 10.813 s |
| `@beep/law-practice-domain` | 874,541 → 860,388 | 259,729 → 257,436 | 1.182 → 1.171 s |

The default four-checker run is advisory, because its totals depend on how files split across
checkers:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,089,912 | 367,663 → 362,450 | 0.540 → 0.521 s |
| `@beep/repo-cli` | 8,429,151 → 8,388,188 | 2,149,366 → 2,139,796 | 4.425 → 4.411 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,258,022 | 376,265 → 370,753 | 0.661 → 0.701 s |

Check time is advisory within a 5% band. Flagged: the `@beep/law-practice-domain` four-checker
time rose 6.1% (0.661 → 0.701 s) on a shared, loaded workstation while its instantiations fell
2.5%; its single-checker time fell.

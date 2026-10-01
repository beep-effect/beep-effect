---
"@beep/codegen-kit": minor
"@beep/repo-ai-metrics": minor
"@beep/schema": minor
"@beep/shared-domain": minor
"@beep/acp": patch
"@beep/agents-domain": patch
"@beep/agents-server": patch
"@beep/agents-use-cases": patch
"@beep/ai-sync": patch
"@beep/architecture-lab-domain": patch
"@beep/architecture-lab-server": patch
"@beep/architecture-lab-ui": patch
"@beep/architecture-lab-use-cases": patch
"@beep/box": patch
"@beep/box-provisioning": patch
"@beep/brand": patch
"@beep/chalk": patch
"@beep/discord": patch
"@beep/dock": patch
"@beep/dock-react": patch
"@beep/documents-domain": patch
"@beep/documents-use-cases": patch
"@beep/drizzle": patch
"@beep/duckdb": patch
"@beep/ecfr": patch
"@beep/editor": patch
"@beep/epistemic-config": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-server": patch
"@beep/epistemic-use-cases": patch
"@beep/exiftool": patch
"@beep/face-detection": patch
"@beep/ffmpeg": patch
"@beep/file-processing": patch
"@beep/govinfo": patch
"@beep/html": patch
"@beep/infra": patch
"@beep/langextract": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-server": patch
"@beep/law-practice-use-cases": patch
"@beep/lexical-schema": patch
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
"@beep/ontology-domain": patch
"@beep/ontology-ui": patch
"@beep/ontology-use-cases": patch
"@beep/openai-compat": patch
"@beep/openclaw": patch
"@beep/pacer": patch
"@beep/pandoc-ast": patch
"@beep/professional-desktop": patch
"@beep/rdf": patch
"@beep/repo-configs": patch
"@beep/runpod": patch
"@beep/sanity": patch
"@beep/semantic-web": patch
"@beep/test-utils": patch
"@beep/tika": patch
"@beep/ui": patch
"@beep/uspto": patch
"@beep/uspto-mcp": patch
"@beep/utils": patch
"@beep/wink": patch
"@beep/workspace-domain": patch
"@beep/workspace-server": patch
"@beep/workspace-use-cases": patch
"@beep/xai": patch
---

Retire `SchemaUtils.withCodecStatics` and the codec facades attached through
`SchemaUtils.withStatics` under the "Upstream-First Foundation/Modeling"
decision (`standards/architecture/DECISIONS.md`, 2026-09-29; goal
`effect-schema-parity`, P5). A codec static was a bound copy of an
`effect/Schema` free function; Effect caches each schema's parser per AST, so
calling the free function where it is used compiles nothing again. No alias is
left behind.

- Deleted from `@beep/schema`: `withCodecStatics`, `CodecStaticRegistry`,
  `CodecStaticKey`, `CodecStaticKeys`, `SelectedCodecStatics`,
  `CodecStaticSelectionError`, and the `toEquivalence` / `DualEquivalence`
  wrapper (use `S.toEquivalence(schema)`). `alwaysEquivalent` stays.
  `withStatics` stays for non-codec helpers; the `SFV4-codec-static` schema-first
  rule rejects codec facades attached through it.
- Reads move to the free functions: `X.decodeUnknownEffect(u)` becomes
  `S.decodeUnknownEffect(X)(u)`, `X.is(u)` becomes `S.is(X)(u)`, renamed
  facades map through their initializer (`fromUnknown`, `decodeOption`, ...).
  Sync statics become `Result.getOrThrow(S.<codec>Result(X)(u))` (or
  `flow(S.<codec>Result(X), Result.getOrThrow)` as a value), because
  `effect(schemaSync)` rejects `S.*Sync`; the thrown `SchemaError` is unchanged for
  schema failures. Only the defect path differs: a non-schema failure inside the
  parser reads "Result adapter can only return schema issues" instead of the sync
  adapter's message.
- `@beep/codegen-kit` drops `GenerateConfig.schemaCodecStatics` and its emitter;
  no generated file used it (runpod `generate --check` passes, box regenerates
  byte-identical).
- `@beep/shared-domain` drops `EntityIdCodecStatics` and the codec intersection
  on `PublicEntityId`; decode ids with `S.decodeUnknownEffect(OrganizationId)`.
- `@beep/repo-ai-metrics` exports `FlightRecordWriteEventJson`,
  `SessionLeaseEventJson`, `SessionLeaseTransitionJson` and
  `SessionLeaseReconciliationJson` in place of the `decodeJsonEffect` /
  `encodeJsonEffect` statics.
- Encoded bytes are unchanged everywhere: every replacement runs the same
  schema (or the same `S.fromJsonString` composition) the static was bound to.

Codemod evidence: phase 1 removed 390 `withCodecStatics` steps in 170 files and
every codec facade attached through `withStatics`; phase 2 rewrote the 833 reads
tsgo then reported as `TS2339` (whole-repo program, plus each app's own
tsconfig), and 25 reads were rewritten by hand; a third pass adjusted 453 reads
the Effect language service then flagged (`schemaSync`, `preferTypedSchemaDecoder`).

Type-check cost, tsgo 7.0.2, fresh build-info, before (`origin/main` at
a69b1956ee) → after (67ba9397d3). The gate is the `--singleThreaded`
instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Check time |
| --- | --- | --- |
| `@beep/schema` | 460,260 → 446,382 | 628 → 594 ms |
| `@beep/repo-cli` | 4,206,806 → 4,202,582 | 11,545 → 10,390 ms |
| `@beep/law-practice-domain` | 830,007 → 799,552 | 1,149 → 1,121 ms |

# SPEC — NLP Adjunct Port & MCP Toolkit Expansion

## Scope

Expand `@beep/nlp-mcp` to expose the full NLP tool surface to MCP clients, by
converging the driver onto the canonical `@beep/nlp` `NlpToolkit`, reaching adjunct
NLP-tool parity, and adding the streaming/file-IO suite. The capability
(`@beep/nlp`) stays product-neutral and emits the generic graph IR
(`@beep/nlp/Handoff`).

Out of scope (downstream / deferred): the FalkorDB knowledge graph and the
generic→IP-law node/edge mapping (owned by `goals/ip-law-knowledge-graph`); the
`law-practice` product slice; raw-document decoding (`.doc`/`.docx`/`.pst`) and the
corpus dedup pass.

## Locked decisions

1. **Convergence:** the MCP driver mounts `@beep/nlp/Tools/NlpToolkit` backed by
   `@beep/wink`'s `WinkNlpToolkitLive` (`McpServer.toolkit(...)`); the hand-rolled
   5-tool system (`nlp-mcp/src/Tools.ts` + `Schemas.ts`) is deleted. No tool/schema
   re-declaration in the driver.
2. **Tool output schemas are `S.Struct`, not `S.Class`.** The Effect AI Toolkit
   encodes results via `Schema.encodeUnknown`, which is nominal for `S.Class`
   (rejects plain objects). Tool success/output schemas must be structural; tool
   *parameter* schemas may stay `S.Class` (decode is structural); `AiToolError`
   stays `S.Class` (the failure path constructs instances via `.make()`).
3. **Parity:** add the 6 standalone tools adjunct exposed that the repo lacked —
   `Paragraphize`, `Stem`, `RemoveStopWords`, `WordCount`, `BagOfWords`, `Analyze`.
   Tool defs in `@beep/nlp/Tools`; handlers in `@beep/wink`. `PosTag`/`Lemmatize`
   are already carried in `Tokenize`'s token output; `Normalize`/`Similarity` map to
   existing `TransformText`/`TextSimilarity`/`Tversky`/`BowCosine`.
4. **Streaming:** full 17-tool suite over 4 modules (`TextStream`, `Jsonl`,
   `DatasetLoader`, `Pipeline`) ported into `@beep/nlp-mcp`, mounted as a second
   toolkit, using `effect/encoding/Ndjson` + `effect/FileSystem` +
   `@effect/platform-node` (no new dependencies).
5. **Trace/data hygiene:** streaming tools read local files by path — never put raw
   file content into span attributes or metric dimensions (wink law); tests use
   synthetic temp fixtures only (never the real Oppold corpus).

## Exit criteria

- `@beep/nlp-mcp` mounts ~42 MCP tools (19 base + 6 parity + 17 streaming); a
  representative tool from each group returns schema-valid output via `.handle`.
- No duplicated tool system remains in the driver; `repo-exports:catalog:check`
  clean.
- `nlp-mcp` registered in `.mcp.json` with a stdio entry.
- Green across `@beep/nlp`, `@beep/wink`, `@beep/nlp-mcp`: `check`, `test`,
  `test:integration`, `lint`, `build` (run with `TURBO_FORCE=1`), plus
  `docgen:local`.
- READMEs/CLAUDE.md surface maps updated; changeset added.

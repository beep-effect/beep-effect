# Reflection Log

## 2026-06-02 — Resume: "what's next?" → MCP toolkit expansion

Resumed long after the original port landed. Re-audited the repo: the adjunct→v4
port (PR #199) is complete and green on `main`; `@beep/nlp`, `@beep/wink`, and a
5-tool `@beep/nlp-mcp` MVP all exist. Chose the **expand-MCP-toolkit** direction.

### Key reframing

The "13 more tools" framing was wrong: `@beep/nlp/Tools/NlpToolkit` already defined
**19** schema-first tools and `@beep/wink` already exported `WinkNlpToolkitLive`
(handlers for all 19). The MCP driver had simply hand-rolled its own parallel 5-tool
system and never mounted the real toolkit. So P1 was a *convergence* (mount the real
toolkit, delete the duplicate), not new tools.

### Two latent bugs surfaced by the convergence

Mounting the real toolkit and adding a `.handle`-based smoke test exposed two bugs
that no existing test had hit (no test invoked a wink tool via `.handle` expecting
**success**):

1. **Detached `RegExp.test`** — `WinkTools.service.ts` had
   `P.not(/[Xxd]/.test)`, passing the `.test` method without its `this` binding →
   `"Builtin RegExp exec can only be called on a RegExp object"`. Fixed with a named
   predicate that owns the regex call (`hasAlphaNumericShape`).
2. **`S.Class` tool success schemas break toolkit encode** — the Effect AI Toolkit
   encodes results via `Schema.encodeUnknownEffect(Union([success, failure, AiError]))`,
   and `S.Class.encodeUnknown` is **nominal**: it rejects plain objects and requires
   class instances (verified empirically). Every wink handler returns plain objects,
   so every tool's success path threw `ToolResultEncodingError`. The old hand-rolled
   nlp-mcp "worked" only because it returned `.make()` instances. **Fix (decided):**
   convert all tool output/success schemas from `S.Class` to `S.Struct` (structural
   encode; matches every Effect AI Toolkit doc example). Parameters stay `S.Class`
   (decode is structural); `AiToolError` stays `S.Class` (failure path uses
   `.make()`). 30 schemas converted across `_schemas.ts` + per-tool `*Success`.

**Durable lesson:** tool I/O schemas for the Effect AI Toolkit must be structural
(`S.Struct`), never `S.Class`. Class success schemas typecheck (structural TS typing)
but fail at runtime encode.

### Status

- P1 convergence: DONE, green (`@beep/nlp`, `@beep/wink`, `@beep/nlp-mcp` check+test).
- P2 parity tools (+6): in progress.
- P3 streaming suite, P4 register/verify/docs: pending.

## 2026-06-02 — P3 streaming/file-IO suite + P4 register/verify

Ported the full 17-tool streaming suite into `@beep/nlp-mcp` as a second toolkit
(`StreamingToolkit` + `StreamingToolkitHandlersLive`) over four helper modules
(`Streaming/{TextStream,Jsonl,DatasetLoader,Pipeline}`). `makeServerLayer` now
`Layer.mergeAll`s both `McpServer.toolkit(...)` layers onto one stdio server; `bin.ts`
provides `NodeStdio` + `NodeFileSystem` + `NodePath` + `FetchHttpClient`. Final MCP
surface: **42 tools** (25 NLP + 17 streaming), verified live over stdio via a
JSON-RPC `tools/list` boot probe.

### Deviation from plan: line-based JSONL, not `Ndjson`

The plan named `effect/encoding/Ndjson` for JSONL. The actual port parses
line-by-line on top of `TextStream.streamLines` with
`S.decodeResult(S.UnknownFromJsonString)` — this gives per-line `Result` outcomes,
which the error-collecting tools (`stream_read_jsonl` w/ `collectErrors`,
`stream_validate_jsonl`, `stream_jsonl_stats`) need for `{ lineNumber, error }`
reporting. `Ndjson`'s channel decode doesn't surface per-line failures as cleanly.
Net: simpler and a better fit; no dependency change.

### Bugs / law violations surfaced (all pre-merge, fixed)

1. **Integration-test harness mistyped `use`.** `withTempFixture`'s callback was typed
   `(file) => Effect.Effect<A>` (i.e. `Effect<A, never, never>`), so every test body's
   real `AiError` error and `HandlersFor` requirement failed to assign — 8× TS2375 /
   377003 / 377004 under `tsconfig.test.json`. Fixed by making the helper generic over
   `E`/`R`. (Lesson: a `layer(...)`-scoped `it.effect` body legitimately carries the
   layer's `E`/`R`; helper signatures must propagate them, not flatten to `never`.)
2. **Raw node built-ins + `async` in the test.** The first fixture helper used
   `node:fs`/`node:path`/`node:os` and `Effect.promise(async …)` → effect-plugin
   `nodeBuiltinImport` / `asyncFunction` errors. Rewrote fixtures over Effect
   `FileSystem`/`Path` (`fs.makeTempDirectory` + `acquireUseRelease`), matching the
   ffmpeg/duckdb driver-test precedent.
3. **Invalid user regex became a defect.** `stream_filter_lines`/`stream_extract_matches`
   compiled `new RegExp(userPattern)` synchronously inside `Effect.fn`, so a bad pattern
   threw → unhandled defect, defeating `failureMode: "return"`. Hardened with a
   `compileRegex` helper using `Effect.try` + a tagged `InvalidPatternError` (the
   effect plugin rejects the global `Error` type in `Effect.try.catch`), which
   `finalize` maps to `AiToolError`. Covered by an invalid-pattern integration test
   asserting `first.isFailure === true`.

### Status (updated)

- P1, P2, P3, P4: DONE, all green. `@beep/nlp-mcp` = 5 unit + 18 integration tests;
  full `TURBO_FORCE=1 check/test/test:integration/lint/build` graph green; docgen (3
  packages) clean; `repo-exports:catalog` refreshed + `:check` clean. Registered in
  `.mcp.json` as the `nlp` stdio server and verified **42 tools** live over stdio via a
  JSON-RPC `tools/list` probe (25 NLP + 17 streaming). One docgen fix along the way:
  the converged barrel `src/index.ts` needed a `@since`/`@category` doc block above
  each re-export statement (matching the `@beep/wink` barrel convention).

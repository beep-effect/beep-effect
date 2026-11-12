# @beep/practice-kg-mcp

Local-first practice knowledge-graph MCP app: builds the portable data bundle
(PGlite kg store + DuckDB catalog/FTS) from a corpus root, and (from PR-3 on)
serves it to Claude Desktop as a read-only stdio MCP server.

Part of `goals/practice-kg-mcp`; placement per the D-9 architecture ruling —
this app owns the runnable process and runtime layers only, while tool
declarations live in `law-practice/use-cases` and projections in
`law-practice/server`.

## Bundle build

```bash
bun run apps/practice-kg-mcp/src/build.ts \
  --corpus-root /path/to/corpus \
  --bundle-out /path/to/bundle \
  # optional: --include-refresh --skip-emails --max-text-bytes 2097152 --overwrite
```

The bundle is self-contained and disposable: replace the folder as a unit when
a newer bundle is delivered. Corpus content and PII never enter this repo.

## Candidate claims batch

The workstation-only claims command resolves the Anthropic model and redacted
API key from `AI_ANTHROPIC_MODEL` and `AI_ANTHROPIC_API_KEY`. Remote extraction
must be explicitly enabled for this write batch:

```bash
BEEP_LANGEXTRACT_ALLOW_REMOTE=true \
bun run apps/practice-kg-mcp/src/claims.ts \
  --inputs /path/to/staging/oppold-demo-inputs \
  --bundle-out /path/to/bundle
```

Tests inject a deterministic fake `LanguageModel` and never use this live layer.

## Distribution

Ships as an MCP Bundle (`.mcpb`) built by `@beep/mcpb-kit`:

```bash
bun run --cwd apps/practice-kg-mcp package:mcpb --target windows-x64  # dist/mcpb/practice-kg-mcp-windows-x64.mcpb
bun run --cwd apps/practice-kg-mcp package:mcpb:linux                 # dist/mcpb/practice-kg-mcp-linux-x64.mcpb
bun run --cwd apps/practice-kg-mcp smoke:compiled                     # packages Linux, then drives the host over stdio
```

| Target | What the bundle holds | How Claude starts it |
| --- | --- | --- |
| `windows-x64` | the official signed `bun.exe`, `practice-kg-mcp.js`, `initdb.wasm`, `pglite.data`, `pglite.wasm`, `node_modules/@duckdb/node-bindings-win32-x64` | `bun.exe --no-env-file practice-kg-mcp.js` |
| `linux-x64` | one compiled `practice-kg-mcp` executable, `node_modules/@duckdb/node-bindings-linux-x64` | `practice-kg-mcp` |

Since 0.5.2 the Windows bundle holds no compiled executable. Smart App Control
on the attorney PC blocked the unsigned `practice-kg-mcp.exe` 0.5.1 on
2026-11-12, after it had run there for two weeks; the official `bun.exe` is
signed and starts. The finding, the runtime pin and the packaging checks are in
the [`@beep/mcpb-kit` README](../../packages/tooling/library/mcpb-kit/README.md#windows-ships-no-compiled-executable).

`src/NativeAddon.ts` finds DuckDB's addon in `node_modules` beside
`process.execPath`. That is the compiled executable on Linux and `bun.exe` on
Windows, so `bun.exe` must stay in the bundle root beside `node_modules`.

Bump `PRACTICE_KG_EXTENSION_VERSION` in `src/Version.ts` for every bundle
handed to a user: Claude Desktop tells installs apart by name and version.
Before an install on the attorney PC, unpack the new bundle to a folder under
`C:\` there and run `bun.exe --no-env-file practice-kg-mcp.js --self-check`
from it with `BUNDLE_DIR` set.

Packaging spike evidence: [goals/practice-kg-mcp/history/p0/](https://github.com/beep-effect/beep-effect-goals-archive/tree/main/goals/practice-kg-mcp/history/p0).

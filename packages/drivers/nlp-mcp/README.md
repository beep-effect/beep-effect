# @beep/nlp-mcp

Model Context Protocol server exposing `@beep/nlp` operations and the generic IR handoff contract as MCP tools. The default NLP backend is provided by `@beep/wink`.

The server mounts two toolkits into a single stdio MCP server (~42 tools total):

- **NLP toolkit (25 tools)** — the canonical `@beep/nlp-processing/Tools/NlpToolkit`, bound to
  the wink-backed `WinkNlpToolkitLive` handlers. The driver does not redeclare these
  tools; it reuses the product-neutral contract.
- **Streaming toolkit (17 tools)** — driver-local file/JSONL/dataset/pipeline tools
  (`stream_read_lines`, `stream_read_jsonl`, `stream_load_text`, `stream_process_file`,
  …) backed by `effect/FileSystem` + `effect/Path` (and `HttpClient` for URL loads).
  Every tool fails with a structured `AiToolError` (`failureMode: "return"`); handler
  spans record counts/`path_length`/`size_bytes` only — never raw file content.

## Installation

`@beep/nlp-mcp` is a private workspace package; depend on it from another package
in the monorepo:

```jsonc
// package.json
{
  "dependencies": {
    "@beep/nlp-mcp": "workspace:^"
  }
}
```

## Usage

```ts
import { VERSION } from "@beep/nlp-mcp"
```

Run the server over stdio from the repository root (the entrypoint provides the
Node `Stdio`, `FileSystem`, `Path`, and `HttpClient` layers):

```bash
bun run packages/drivers/nlp-mcp/src/bin.ts
```

This is the exact command the repo `.mcp.json` registers as the `nlp` stdio
server, so MCP clients launch it the same way.

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/nlp-mcp` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT

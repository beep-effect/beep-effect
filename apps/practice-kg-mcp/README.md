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

## Distribution

Ships as an MCP Bundle (.mcpb) with a bun-compiled Windows binary plus DuckDB
native sidecars (see `goals/practice-kg-mcp/history/p0/` packaging spike
evidence). PR-5 adds the packaging lane and install runbook.

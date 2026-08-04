# @beep/m365-mcp

Read-only Model Context Protocol server for Microsoft 365. The package exposes
selected `@beep/m365` driver verbs as schema-first MCP tools over stdio.

## Scope

- OneDrive and SharePoint read tools for drives, sites, drive item deltas,
  downloads, list item fields, and versions.
- Outlook read tools for mail messages and calendar events.
- No write tools, HTTP transport, SSE transport, ingestion wiring, Teams, Excel,
  or Graph query logic.

## Entrypoint

The executable is `src/bin.ts`. It launches `makeServerLayer` with
`NodeStdio.layer` and the live `M365.layer`; authentication and Graph transport
remain owned by `@beep/m365`.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/m365-mcp` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT

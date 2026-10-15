# @beep/practice-gateway

Practice gateway MCP extension: setup doctor plus the providers a practice profile selects.

## Usage

The gateway ships as a Claude Desktop extension (`.mcpb`):

```bash
# from the repository root
bun run --cwd apps/practice-gateway package:mcpb:linux    # dist/mcpb/practice-gateway-linux-x64.mcpb
bun run --cwd apps/practice-gateway package:mcpb:windows  # dist/mcpb/practice-gateway-windows-x64.mcpb
```

`practice-gateway --self-check` runs the setup doctor once over the saved
profile and prints its report as one JSON line without serving MCP.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/practice-gateway` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT

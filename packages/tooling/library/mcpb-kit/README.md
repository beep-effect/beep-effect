# @beep/mcpb-kit

Package Bun-compiled MCP servers with DuckDB native bindings as Claude Desktop .mcpb bundles

## Usage

An app's `src/package.ts` describes its bundle and runs the shared command:

```ts
import { McpbManifestFields, McpbPackageSpec, mcpbPackageProgram, runMcpbEntrypoint } from "@beep/mcpb-kit"

const program = mcpbPackageProgram(
  McpbPackageSpec.make({
    appName: "example-mcp",
    commandName: "example-package",
    repoRoot: Bun.fileURLToPath(new URL("../../..", import.meta.url)),
    forbiddenArchiveFragments: ["package.ts", "src/"],
    manifest: McpbManifestFields.make({
      name: "beep-example",
      displayName: "Beep Example",
      version: "0.1.0",
      description: "An example server.",
      env: {},
      userConfig: {},
      tools: [],
    }),
  })
)
runMcpbEntrypoint({ isMain: import.meta.main, program })
```

`bun run src/package.ts --target linux-x64` compiles `apps/<appName>/src/bin.ts`
with `bun build --compile`, ships the DuckDB native bindings beside it, writes
`apps/<appName>/dist/mcpb/<appName>-<target>.mcpb`, and audits the archive.
The Windows target downloads the pinned DuckDB win32 bindings and checks their
sha512 first; a DuckDB catalog bump must update the pin in
`src/internal/steps.ts`.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/mcpb-kit` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT

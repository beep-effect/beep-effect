# @beep/mcpb-kit

Package Bun MCP servers with DuckDB native bindings as Claude Desktop .mcpb bundles

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

`bun run src/package.ts --target <target>` builds `apps/<appName>/src/bin.ts`,
ships the DuckDB native bindings beside it, writes
`apps/<appName>/dist/mcpb/<appName>-<target>.mcpb`, and audits the bundle and
the archive.

| Target | Launch | Bundle root |
| --- | --- | --- |
| `linux-x64` | `compiled`: one `bun build --compile` executable | `manifest.json`, `<appName>`, `node_modules/@duckdb/node-bindings-linux-x64` |
| `windows-x64` | `runtime-script`: the official Bun runtime runs a script bundle | `manifest.json`, `bun.exe`, `<appName>.js`, the spec's `assets`, `node_modules/@duckdb/node-bindings-win32-x64` |

`assets` names the files the entrypoint imports `with { type: "file" }` (the
PGlite `initdb.wasm`, `pglite.data` and `pglite.wasm`, for example). A compiled
executable embeds them; a script bundle ships them beside the script.

The Windows manifest starts the runtime with the script:

```json
"server": {
  "type": "binary",
  "entry_point": "bun.exe",
  "mcp_config": {
    "command": "${__dirname}/bun.exe",
    "args": ["--no-env-file", "${__dirname}/example-mcp.js"],
    "env": { "NODE_PATH": "${__dirname}/node_modules" }
  }
}
```

## Windows ships no compiled executable

Smart App Control blocks a `bun build --compile` executable. On 2026-11-12 the
attorney PC (Windows 11, Smart App Control in enforce mode) refused the
compiled `practice-kg-mcp.exe` 0.5.1: CodeIntegrity event 3077, status
`0xc0e90002`, and Claude Desktop logged `spawn UNKNOWN`. The same block
happened on 2026-10-20 and 2026-10-22. Three facts decide the layout:

- A compiled executable is unsigned. Smart App Control lets an unsigned file
  run only on cloud reputation, and that verdict can change: the same file ran
  for two weeks before it was blocked.
- Smart App Control has no per-file exception. The only switch is off, for the
  whole machine.
- The official `bun.exe` carries the Bun publisher's Authenticode signature
  (Codeblog CORP, issued by DigiCert, on Bun 1.4.4), so it starts.

The Windows target therefore ships `bun.exe` from the Bun release archive
`bun-windows-x64.zip` and runs `<appName>.js`. This layout has run on that PC
since 2026-11-12 without any change to its security settings.

Packaging enforces it:

- `mcpbWindowsRuntime` pins the release version and the archive's sha256 from
  the release's `SHASUMS256.txt`. Its version must equal the repository's
  `.bun-version`; packaging and the unit tests fail when they differ.
- The archive is downloaded once per pin into `<output>/.cache` and checked
  against the sha256 before `bun.exe` is unpacked.
- Every `.exe`, `.dll` and `.node` file staged in a Windows bundle must have a
  certificate table in its PE header. An unsigned file fails packaging before
  the archive is written. The check proves a signature is present; the pinned
  sha256 is what ties `bun.exe` to the official release.
- The archive must hold exactly the files in the table above. A compiled
  executable, a missing script and an undeclared asset each delete the archive
  and fail.

Known gap: DuckDB publishes `duckdb.node` in
`@duckdb/node-bindings-win32-x64` unsigned (`duckdb.dll` beside it is signed by
the DuckDB Foundation). It is the one named exception to the signature
check, it has not been blocked so far, and it passes on reputation only.
Packaging logs a warning each time it ships.

Linux keeps `--compile`: Smart App Control is Windows-only, and the compiled
host smoke (`apps/practice-kg-mcp/src/smoke.ts`) runs the Linux executable. To
move Linux to the same layout, add a Linux `McpbRuntimePin` and return a
`runtime-script` launch from the `linux-x64` branch of `mcpbTargetSpec`.

## Moving a pin

- Bun: after `.bun-version` changes, set `mcpbWindowsRuntime.version` in
  `src/McpbKit.package.ts` and copy the `bun-windows-x64.zip` line of
  `https://github.com/oven-sh/bun/releases/download/bun-v<version>/SHASUMS256.txt`
  into `sha256`. Package the Windows target once: it fails if the new
  `bun.exe` is unsigned.
- DuckDB: a catalog bump must update `DuckDbVersion` and
  `WindowsBindingsSha512` in `src/internal/steps.ts`.

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

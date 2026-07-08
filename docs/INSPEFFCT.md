# Inspeffct

`inspeffct` captures and inspects Effect runtime spans and logs from local commands.

## Commands

Use the root scripts so every capture and inspection command reads the same
repository-root SQLite database at `.beep/inspeffct.db`. The helper scripts
create `.beep/` before calling the CLI, so capture commands work from a fresh
checkout and still use the same database when launched from a nested directory.

```bash
bun run inspeffct -- --help
bun run inspeffct:run -- <command> [args...]
bun run inspeffct:traces
bun run inspeffct:trace -- <trace-id>
bun run inspeffct:span -- <trace-id> <span-id>
bun run inspeffct:logs
```

Examples:

```bash
bun run inspeffct:run -- bun run test
bun run inspeffct:traces -- --json
bun run inspeffct:logs -- --since 30m
```

The CLI requires Node.js 22.16 or newer. Captured data is local-only because
`.beep/` is gitignored.

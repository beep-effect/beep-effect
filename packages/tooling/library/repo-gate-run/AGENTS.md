# @beep/repo-gate-run

Gate run services: the recorder, the agent and terminal console projections, audience selection, the type-checker adapter and the gate query services

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Import only the `process/OutputBound` leaf of `@beep/repo-cli-kit` (no platform layer), never its root, and no test kit at runtime.
- Command trees stay in the repo CLI; this package holds the services they call.
- Persistence and history never block or change the console: a failure there becomes an `Omission` line, and `runGate` returns the tool's exit code.
- Before handing back a change, run `bun run beep quality package-verify @beep/repo-gate-run` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.

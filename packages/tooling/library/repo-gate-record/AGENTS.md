# @beep/repo-gate-record

Gate report record and raw log writer: the gate-report/v1 codec, package and root record paths, newest-20 retention

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Runtime dependencies stay `@beep/gate-report`, `@beep/identity`, `@beep/schema` and `effect`: this package is in the closure of every `test` task. No platform package at runtime; the caller supplies `FileSystem` and `Path`.
- No `bun:` module may become reachable; `test/RuntimeBoundary.test.ts` loads the package under Node to prove it.
- Before handing back a change, run `bun run beep quality package-verify @beep/repo-gate-record` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.

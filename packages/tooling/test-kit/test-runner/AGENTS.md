# @beep/test-runner

Instrumented Effect Vitest runner without application package dependencies

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Before handing back a change, run `bun run beep quality package-verify @beep/test-runner` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.

- This bootstrap package must not depend on identity, schema, utils or test-utils,
  including through its tests. Preserve the historical test-utils schema identity
  metadata as literals in Vitest.errors.ts; a composer import would create a cycle.
- Test-utils compatibility exports must reference the same runner and error
  constructors. Do not duplicate runtime instances or error classes.

# Local qualification harness

`Trial.ts` is an Effect entrypoint, not a package task or a general benchmark
runner. It reuses repository admission, requires a real per-attempt scope,
enforces four CPU equivalents/4 GiB/no swap, and captures elapsed time, CPU
accounting, memory peak/events, exit status, and the explicit child command.

The schema-defined request contains `id`, `root`, `cwd`, `executable`, `args`,
`env` (approved nonsecret values only), `expectedExit`, and `maxSeconds` (1–600).
`root` is the authoring checkout and owns the shared execution ledger; `cwd`
can point to the isolated package. The harness inherits other environment
settings; this is not the unimplemented Turbo strict-mode qualification.

Run from the authoring checkout:

```sh
bun scratchpad/bun-test/pilot/Trial.ts .beep/bun-test-pilot/<id>.request.json
```

Requests and receipts are immutable by id. To repeat a saved request, copy it,
assign a new id, and change any output paths to a fresh directory. Preserve all
existing receipts: their elapsed times reduce the shared 3,600-second budget.
Never run multiple requests concurrently or delete the ledger to replenish it.
An exclusive lock prevents overlap; a pending attempt stops further execution
until its interrupted work is accounted for. External timeout kills are failed
qualification, not expected test-timeout behavior.

Before reproducing, verify the recorded base revision and dirty overlay,
installed dependencies/binaries, worktree source aliases, and request paths.
The saved requests contain machine-local absolute paths and are not portable
without explicit rebasing. No dependency installation or download is implicit.

Files:

- `preload.ts` maps `@effect/vitest` for controls and sets a 100 ms default.
- `vitest.qualification.ts` supplies the corresponding serial reference setup.
- `schema-preload.ts` maps direct/transitive runner and assertion imports and
  chooses ordinary/property/coverage defaults for the native diagnostic.
- `vitest.schema.ts` inherits repository configuration with explicit resource
  settings; it preserves the repository property selector.
- `vitest.runtime.ts` and `runtime-witness.ts` are qualification-only worker
  provenance instrumentation. They must not silently enter confirmation runs.
- `tsconfig.json` checks the harness using repository compiler policy.

The isolated worktree's `aliases.json` is generated from
`vitest.aliases.generated.json` with its absolute worktree base. Bun parallel
workers emitted an internal directory-mismatch diagnostic for that override.
That setup remains unqualified. The harness in this directory intentionally does not
present a ready-to-use canonical Bun/Turbo configuration.

The latest run stopped at the correctness gate. Read
[PILOT-RESULTS.md](../PILOT-RESULTS.md) before extending execution; no confirmation
benchmark should start while those blockers remain.

The first 56 executed trials used a 16 GiB cap and four admission tokens.
Their maximum observed peak was below 1.84 GiB. After the initial one-worker
follow-up remained queued without executing, subsequent trials use a matched
4 GiB cap and one token. Receipts retain each actual resource limit; compare
only runs with the same limits, and do not pool the two resource envelopes.
The cancelled pre-admission loop retains its log and consumed no execution budget.

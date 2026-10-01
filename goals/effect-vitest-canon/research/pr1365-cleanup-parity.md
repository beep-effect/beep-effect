# PR #1365 scoped cleanup parity repair

The published LiteralKit integration head `7bea05db3c` passed full package
verification: CLI audit 699.8 seconds and docgen 21.1 seconds; schema audit
9.3 seconds and docgen 4.5 seconds. Hosted Property Laws nevertheless failed
in the Yeet no-stash publish test. The assertion passed, but the directory
finalizer reported `NotFound: FileSystem.makeTempDirectoryScoped`.

The migration changed cleanup semantics: the previous fixture removed its
directory recursively with `force: true`; the platform scoped helper removes
recursively without that option. The hosted evidence does not identify the
actor that removed the directory. The regression deliberately removes it
before closure and reproduced the same failure before the repair.

The repair uses `Effect.acquireRelease` in the runner-owned scope and retains
the original removal options. Other cleanup errors still become defects.
The regression itself uses the runner scope, with no manual runtime, retry,
baseline refresh, or policy exception. Existing assertions remain intact.

Focused repair proof before dependency integration:

- Node: 172 tests passed, 16.49 seconds.
- Bun: 172 tests passed, 14.27 seconds.
- Actual CLI test-type artifact: exit 0, empty diagnostics.
- Effect Vitest ratchet: 2,852 findings, zero introduced, 2,167 resolved.
- No PR review threads were present at the repair review snapshot.

Main subsequently contributed the Hono security update `e324f01e1e` (#1361),
which merged without conflicts. The earlier attached full publication proof
was deliberately interrupted before this source repair, so it is not a
completed proof of the repaired head. Full package and publication proof
must run again, followed by hosted tier 1, heavy admission, and strict PR
closeout. This is an intermediate goal checkpoint, not goal completion.

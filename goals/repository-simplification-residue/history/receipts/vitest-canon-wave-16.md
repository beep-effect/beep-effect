# #1875 Effect Vitest canon wave 16: record

Branch `claude/vitest-canon-w16` off `main` `c561801dd9`. Scope: the 42 open rows wave 15 left.
The effect 4.1.0 bump (#2415) and the ai-metrics observability PR (#2364) added them as new
test code. This wave migrates the 22 rows outside EV010 and leaves the 20 EV010 rows to wave 17.

## Migrations

| Rule | File | Rows | Change |
| --- | --- | ---: | --- |
| EV002 | `langextract/test/VerifiedSpanHistory.test.ts` | 9 | The suite runs under `it.layer(Digest.layerWebCrypto)` instead of providing it per test. The counting-digest test wraps the suite's `Digest` and installs it with `Effect.provideService`. |
| EV002 | `ai-metrics/test/native-intake.test.ts` | 1 | The reopen case builds its fresh connection with `SqliteClient.make` in the test scope and provides it with `Effect.provideService`, instead of a per-test `SqliteClient.layer`. |
| EV004 | `gov-legal-mcp/test/Server.test.ts` | 1 | The tool-name collision and determinism tests run under `it.layer(NodeCrypto.layerDigest)`, which retires the `Layer.build` + `Effect.scoped` helper. |
| EV004 | `cli/test/vitest-bun-serve-shim.test.ts` | 1 | The rebind helper is no longer scoped in its own definition. Each call is `Effect.scoped(serve(...))` in the test body, followed by the socket-removal assertion. |
| EV006 | `ciops/test/lane-plan.test.ts` | 2 | `exit.pipe(Exit.hasDies, assertTrue)` and `exit.pipe(Exit.findErrorOption, assertNone)` replace the hand-rolled Boolean `expect`s. This is stricter: it asserts that no typed error is present. |
| EV013 | `ai-metrics/test/native-http.test.ts`, `observation-launch-http.test.ts` | 2 | The busy probes are `Effect.repeat({ until: status === 503, times: 19 })` over a 5 ms-delayed probe, the same 20-attempt bound as before. |
| EV013 | `ai-metrics/test/observation-worker.test.ts` | 2 | The two waits are `Effect.repeat({ until, schedule: Schedule.spaced(5) })`. |
| EV013 | `ai-metrics/test/native-schedule.test.ts` | 1 | The eight reconstruct-and-send rounds are `Effect.replicateEffect(8, { discard: true })`. |
| EV013 | `ai-metrics/test/payload-reclamation.test.ts`, `transcript-export.test.ts` | 3 | The per-event state checks are `Effect.forEach(..., { discard: true })` instead of a `for` loop around `yield*`. |

Assertions and bounds are unchanged unless the table says otherwise.

## Inventory, paired by `(ruleId, file, occurrence)` against `c561801dd9`

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 482 | 440 | 42 |
| After | 460 | 440 | 20 |

Gone: 22 (EV002 10, EV013 8, EV004 2, EV006 2). New: 0. No exception was added.

## Held for wave 17: 20 EV010 `NodeServices` rows

Their subjects are native, so a move to `MemoryFileSystem` would delete what they test:

- process death: SIGKILL of a spawned fixture in seven ai-metrics `*-crash` tests and
  `AgentMessage.observation`;
- SQLite files reopened across connections;
- POSIX file modes (`mode: 0o600`, `lstat`, `chmod`);
- Unix sockets (`vitest-bun-serve-shim`);
- spawned `git` (`git-root-evidence`, `observation-root-probe`, `transcript-discovery`).

Two of these tests reach `chmod` through a fixture field (`f.fs.chmod`), which the
native-operation check does not follow. Wave 17 needs a detector rule for native subjects, a
killed child process first, with counterexamples. Without one, these rows can only be retired by
adding exceptions.

## Verification

| Check | Result |
| --- | --- |
| Touched test files, Bun (`bunx --bun vitest run`) and Node (`bunx vitest run`) | all pass on both: ciops 21, gov-legal-mcp 30, langextract 9, ai-metrics 79 (7 files), repo-cli shim 9 (Bun runs 2, skips 7) |
| `bun run check` in ciops, gov-legal-mcp, langextract, ai-metrics, repo-cli | exit 0 |
| `bun run beep lint effect-vitest --write` | 482 → 460 rows, 0 new |
| `quality fallow audit --base origin/main` | 0 introduced |
| Biome on the touched files | clean |

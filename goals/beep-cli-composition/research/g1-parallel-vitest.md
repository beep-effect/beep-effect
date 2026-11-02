# G1: parallel vitest projects for repo-cli

Measured 2026-10-31 on the operator workstation (64 logical cores), every run
through `beep-heavy` (32 GB cap), from `packages/tooling/tool/cli`. Other
sessions shared the host the whole time: load average 65 to 85 on 64 cores
during the after-runs, so their spread is host contention, not test variance.

## Change

`packages/tooling/tool/cli/vitest.config.ts` now defines two Vitest projects
instead of one serial, isolated run:

| Project | Files | `isolate` | Workers |
| --- | --- | --- | --- |
| `shared` | 305 | `false` (one worker evaluates many files) | parallel |
| `isolated` | 85 | `true` (fresh worker per file) | parallel |

Both share the root `maxWorkers = min(8, availableParallelism - 1)`. Tests
inside one file stay sequential (`sequence.concurrent: false`). Doctest mode and
the property sweep keep the old single serial isolated run, because both
resolve their own file lists.

The isolated list is a census, not a guess. `test/vitest-isolation-census.test.ts`
scans every test file for state that would leak into the next file of a shared
worker, and fails when a match is missing from `isolatedSuites` or an entry no
longer matches:

| Hazard | Pattern | Files |
| --- | --- | --- |
| Process state | `process.chdir`, `temporaryWorkingDirectory` / `withTempWorkingDirectory` (`test/support/CommandTest.ts`), any `process.<name> =` (`cwd`, `argv`, ...), `vi.spyOn(process, ...)`, `Object.defineProperty(process, ...)` | 66 |
| Module mocks | `vi.mock`, `vi.doMock` | 6 |
| Global and env stubs | `vi.stubGlobal`, `vi.stubEnv`, `globalThis.<name> =`, `Object.defineProperty(globalThis, ...)` | 14 |
| Env writes | `process.env.<NAME> =`, `delete process.env.<NAME>` | 2 |

(Files can match more than one row; 85 files in total, counted on `main` at
b30cd9e6dd.) The first grep census missed 7 files that swap `process.cwd` (a
`process.cwd = () => root` getter or `vi.spyOn(process, "cwd")`) instead of
calling `chdir`; the guard test caught them. Review on #2395 then widened the
patterns to any mid-line reassignment, any `vi.spyOn(process, ...)` and
`Object.defineProperty`, which added `process-identity` (spies on
`process.kill`) and `research-library-views` (a `globalThis.pwned=` inside an
XSS fixture string, a harmless false positive). The timings below ran with 83
isolated files.

The isolated project runs its files in parallel, not serially as the PLAN row
first said: each file gets its own forked worker, so a `chdir` or stub cannot
reach another file, and hosted coverage already ran every repo-cli file with
isolation and `--fileParallelism=true --maxWorkers=2` (SPEC D21).

## Wall time (local)

| Run | Runtime | Config | Result | Wall |
| --- | --- | --- | --- | --- |
| Baseline | Bun (`beep:test`) | `main`: serial, isolated | 385 files passed, 1 skipped | 1,512 s |
| After, 8 workers (explicit) | Bun | split | 386 passed, 1 skipped | 206 s |
| After, default | Bun | split | 386 passed, 1 skipped | 238 s |
| After, default | Bun | split | 1 failed (fixed below) | 183 s |
| After, default, shuffled files (seed 4242) | Bun | split | 386 passed, 1 skipped | 228 s |
| After, default | Bun | split | 386 passed, 1 skipped | 289 s |
| After, default, shuffled files (seed 99) | Bun | split | 386 passed, 1 skipped | 502 s |
| After, 3 workers (4-vCPU hosted shape) | Bun | split | 386 passed, 1 skipped | 568 s |
| After, default | Node | split | 387 passed | 330 s |
| After, default, shuffled files (seed 777) | Node | split | 387 passed | 480 s |
| After, coverage with the hosted flags (`--coverage --fileParallelism=true --maxWorkers=2`) | Node | split | 387 passed; lcov written | 1,481 s |

The default local run went from 1,512 s to 183 to 502 s (3 to 8 times faster;
206 s, 7.3 times, on the quietest host). With three workers, the shape of a
4-vCPU hosted runner, the run took 568 s, 2.7 times faster than baseline. The
hosted shards (two halves of 14 to 15 minutes before G2, four `--shard`
quarters since #2392) should fall by roughly the same factor; Vitest applies
`--shard` across both projects, and this lane leaves the shard matrix to G2.

## Findings

- **Worker cap.** The first after-run used Vitest's default worker count
  (cores minus one, 63 here) and was OOM-killed at the 32 GB cap after 45 s.
  Eight workers peaked at 12.8 GB, about 1.5 GB per worker, because each loads
  most of the repo-cli module graph. Vitest does not clamp a numeric
  `maxWorkers` to the core count, so the config takes the minimum of 8 and
  cores minus one; a 4-vCPU runner keeps its default of 3, and a CLI
  `--maxWorkers` still overrides it.
- **Load-sensitive fixture.** `agent-message-store` "two real processes race
  for one destination dispatch slot" failed once: the losing child's
  `claimNext` hit SQLite `LockTimeoutError` (100 ms busy timeout) while the
  winner held the write lock on a loaded host. The fixture already retried that
  classified lock error during schema setup but not during the claim. It now
  retries the claim the same way; a retried lock timeout still leaves exactly
  one winner, because the claim is one transaction. Not an isolation leak: the
  children are separate processes.
- **`extends: true` concatenates `include`.** A project that extends the root
  config inherits the root `include` and appends its own, so the first
  `isolated` project listed all 386 files. The split config clears the root
  `include` and gives each project its own.

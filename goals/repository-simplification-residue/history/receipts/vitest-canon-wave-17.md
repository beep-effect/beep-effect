# #1875 Effect Vitest canon wave 17: record

Branch `claude/vitest-canon-w17` off `main` `e99f80e1b0`. Scope: the 20 open EV010
`platform-resource-provenance-review` rows that wave 16 held. They are `NodeServices` imports
in new #2364 and #2415 tests whose subjects are native.

## Detector repair: a killed child process is a native subject

`harnessKillsChildProcess` in `EffectVitestDetectors.ts` accepts a platform bundle harness when
the harness callback, or a same-file helper it reaches, calls `.kill(...)` on a handle to a
spawned process. A handle is a `const` bound by `yield* ChildProcess.make(...)`, from
`effect/process/ChildProcess`, or by `yield* run(...)` through a same-file
`const run = (...) => ChildProcess.make(...)`.

A test that SIGKILLs a process it spawned is testing that process's death (crash recovery, commit
boundaries). Only the native spawner produces a process that can be killed, so the platform
bundle is the subject; a scripted spawner or a memory filesystem cannot stand in for it. Every
harness the bundle reaches must satisfy the rule, as with the existing native-filesystem proof.

`harnessEvidence` now holds the callback-plus-helpers region walk. The native-filesystem proof
and the new rule share it.

Counterexamples (`test/effect-vitest-detectors.test.ts`):

- accepted: a direct kill; a kill inside a same-file helper; a kill through a spawn factory
  arrow; two harnesses that both kill;
- still judged: a spawn with no kill; a kill on a `Fake.make` handle; a kill on an unrelated
  value; a `let` handle; a spawn factory over `Fake.make`; two harnesses where only one kills.

Each case reads `FileSystem`, so the existing rule for harnesses that never read the filesystem
cannot be what accepts it.

## Inventory, paired by `(ruleId, file, occurrence)` against `e99f80e1b0`

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 460 | 440 | 20 |
| After | 454 | 440 | 14 |

Gone: 6 EV010 open rows, the ai-metrics crash suites `delivery-ledger-crash`,
`evidence-retention-crash`, `native-delivery-crash`, `native-http-crash`,
`payload-reclamation-crash` and `transcript-intake-crash`. New: 0. No exception added. No test
file changed.

## The 14 rows still open, by native class

Each class needs its own rule or a source seam. None is a kill.

| Class | Rows | Files |
| --- | ---: | --- |
| Concurrent independent processes (a file-lock race, no kill) | 1 | `observation-launch-claims-crash` (second harness) |
| A spawned child killed through a `Deferred` handle from `ChildProcessSpawner.spawn` | 1 | `AgentMessage.observation` |
| Spawned `git` (prior reviewed exits ask for a scripted spawner) | 3 | `git-root-evidence`, `observation-root-probe`, `transcript-discovery` |
| SQLite journal files reopened across connections | 5 | `observation-claim-population`, `observation-launch-claims`, `observation-launch-claims-restore`, `observation-launch-outbox`, `observation-worker` |
| Owner and link metadata (`uid`, `nlink`, modes) from a real `lstat` | 1 | `observation-file` |
| Unix-domain sockets | 1 | `vitest-bun-serve-shim` |
| Node and Bun crypto plus filesystem in one suite | 2 | `corpus-provenance-index` |

Two suites call `chmod` through a fixture field (`f.fs.chmod`). The native-operation proof does
not follow that receiver, so a receiver-flow repair there would cover part of the SQLite and
mode classes.

## Verification

| Check | Result |
| --- | --- |
| `test/effect-vitest-detectors.test.ts`, Bun and Node | 261 passed each |
| repo-cli `bun run check` | exit 0 |
| `bun run beep lint effect-vitest --write` | 460 → 454 rows, 0 new |
| `quality fallow audit --base origin/main` | 0 introduced |
| Biome on the two touched files | clean |

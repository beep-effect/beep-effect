# #1875 Effect Vitest canon wave 21: record

Branch `claude/vitest-canon-w21` off `main` `b4a6140271`. Scope: the last 7 open effect-vitest
rows, all EV010 `platform-resource-provenance-review`.

## Ruling (orchestrator, route B)

These tests exist to exercise real git, process concurrency, helper processes and sockets. Two
routes were weighed:

- **A, rewrite onto doubles:** scripted git, process or listener doubles. This would remove the
  coverage the tests exist for.
- **B, owner/exit exceptions:** the #1855 waves 7–8 precedent for live-resource rows.

The orchestrator chose B, as an agent decision under the charter (Decision Log, 2026-11-01).

A detector rule was tried first and rejected: "a harness that spawns any process through
`effect/process/ChildProcess` has a native subject". It would have retired the 3 git and race
rows, but it also silently retired 12 reviewed exceptions whose exits ask for a scripted spawner
or a memory filesystem (for example `changeset-graph`, `goals-graph`, `cache-baseline-merge`,
and `circuit-breaker`, whose exit calls it a memfs candidate). The narrow wave 17 kill rule stays.
A `git-root-evidence` memfs tweak was also tried. It only moved that file's row to another class,
so it was dropped.

## The 7 exceptions

| File | Owner | Subject | Exit |
| --- | --- | --- | --- |
| `ai-metrics/test/git-root-evidence.test.ts` | `@beep/repo-ai-metrics` | real git repositories (plain, separate-git-dir, worktree) | a scripted git double covers the three layouts; real-git cases move to an opt-in live suite |
| `ai-metrics/test/observation-root-probe.test.ts` | `@beep/repo-ai-metrics` | real git working-tree layout | the probe runs behind a scripted git double; real-git cases move to an opt-in suite |
| `ai-metrics/test/observation-launch-claims-crash.test.ts` | `@beep/repo-ai-metrics` | two independent producer processes racing on real files | EV010 recognises concurrently spawned independent processes, or a scripted two-process double |
| `ai-metrics/test/observation-worker.test.ts` | `@beep/repo-ai-metrics` | real transcript discovery through the worker | discovery takes an injected scanner the worker test can script |
| `ai-metrics/test/transcript-discovery.test.ts` | `@beep/repo-ai-metrics` | helper processes walking real trees (symlinks, permissions, non-UTF-8 names) | a scripted helper double over a memory volume that models permissions and non-UTF-8 names |
| `cli/test/AgentMessage.observation.test.ts` | `@beep/repo-cli` | a spawner child held in a `Deferred`, recorded, closed and SIGKILLed | EV010 follows a spawner handle through a `Deferred` to its kill, or a scripted spawner with an opt-in live check |
| `cli/test/vitest-bun-serve-shim.test.ts` | `@beep/repo-cli` | real Unix-domain sockets and TCP ports | an injected listener double, or EV010 recognises a Unix-socket server |

Each row's full reason in `standards/effect-vitest.inventory.jsonc` names the subject, the owner
and the exit. Reversal, per row: take the named exit (route A or the detector rule) and drop the
exception.

## Inventory, paired by `(ruleId, file, occurrence)` against `b4a6140271`

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 447 | 440 | 7 |
| After | 447 | 447 | 0 |

Open → exception: 7. Gone: 0. New: 0. A second `--write` is byte-stable, and the check-mode scan
reports `introduced=0 resolved=0`. No test or detector file changed.

## Burn-down since the hold lifted (waves 15–21)

| Wave | PR | Open rows |
| --- | --- | ---: |
| start (after #2415 and #2364) | — | 137 |
| 15, EV014 crypto layers, restored reviews | #2452 | 42 |
| 16, non-EV010 migrations | #2455 | 20 |
| 17, killed child process | #2456 | 14 |
| 18, SQLite file | #2458 | 12 |
| 19, memfs directory open | #2460 | 9 |
| 20, one platform bundle | #2461 | 7 |
| 21, owner/exit exceptions | this PR | 0 |

## Open question for the operator: the D4 empty baseline

The canon goal's D4 close requires an empty baseline: all 447 exceptions retired, not owned.
Most of them are the same choice this wave made. The test exercises a real resource (git, child
processes, sockets, SQLite or PGlite files, or the real clock), and its exit names a double or
seam that would replace it. Closing D4 means either:

- doing those rewrites, which trades live coverage for hermetic tests, in many packages; or
- amending D4 so that individually owned exceptions with exits satisfy the close.

This is the operator's call and is not decided here.

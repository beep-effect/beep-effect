# Worker-host acceptance: a forced gate on dankserver

Recorded 2026-11-13 on dankserver (15 GiB installed, worker profile, 7 GiB agent slice) from the
lane `test/compute-profile-worker-acceptance-3` (sibling `-worktrees` root, base `origin/main` at
`da56016e51`, the merge of #3281, verified with `git merge-base --is-ancestor origin/main HEAD`).
This is the third worker-host run. It proves the one fact the repeat run
(`2026-11-13-worker-host-acceptance-repeat.md`) left open: a forced gate completing on a real
worker and leaving a receipt with `forceLocal: true`. The agent ran inside the T3 agents slice, one
substantive command at a time. Home paths are written as `~`.

**Verdict, criterion 2b: pass.** `final-check --force-local --gates coverage` measured
`@beep/github-references` with one Turbo task at a time, passed in 34.9 s with a largest process of
588 MB and a scope peak of 1.39 GB, wrote a receipt with a passed `coverage` step and
`forceLocal: true`, and journalled an `admission-routed` row with `gateRoute: coverage`,
`outcome: bypass`, `forceLocal: true`. A forced `fallow` refused at once with its measured reason,
wrote a refusal row and left a receipt with no forced step and `forceLocal: false`.

## Step 1: probe

```text
$ bun run beep compute profile --json
{"profile":"worker","source":"probe","ceilingGib":7,"envelopeGib":20,"overrideRequested":null}
```

## Step 2: the source change and the package

The package was chosen for the smallest forced plan: `@beep/github-references`
(`packages/foundation/modeling/github-references`, 4 source files, no workspace dependents).

| Query | Result |
| --- | --- |
| `turbo run coverage --filter=...@beep/github-references --dry-run=json` coverage tasks | 1 |
| `turbo run build --filter=@beep/github-references --dry-run=json` tasks | 8 (`types`, `test-runner`, `fc-runs`, `identity`, `utils`, `data`, `schema`, itself) |

Candidates rejected: `@beep/spdx` (75 coverage dependents), `@beep/eyecite` and
`@beep/github-commands` (9 each), `@beep/types` (200).

The change adds a test that `harvestIssueReferences` finds references wrapped in markdown and
punctuation (`(fixes #3).`, `**Fixes #4**`, `- closes #5`, a code span, a link label) and that each
match's span runs from the keyword through the last digit, excluding the wrapping. The function's
**Details** section now says the same. 24 tests pass (3.0 s, 362 MB);
`lint effect-vitest --files` on the test file reported 0 findings (6.0 s, 469 MB).

Commit `dd8a99d5da` (`LEFTHOOK_VERBOSE=1 git commit`, identity set per command, 16.5 s, 186 MB):

```text
│  [lefthook] skip/only: bun run beep compute profile --is worker
│             result:    true
│  schema-catalog (skip) by condition
│  [lefthook] skip/only: bun run beep compute profile --is worker
│             result:    true
│  instrumentation-catalog (skip) by condition
✔️ biome (2.92 seconds)
✔️ gitleaks (10.11 seconds)
✔️ typos (15.64 seconds)
✔️ commitlint (0.39 seconds)
```

## Step 3: plain `final-check`

```text
$ bun run beep yeet final-check          # exit 0, 63.0 s, 596 MB
  skipped final-check:fallow (0): Fallow Advisory Envelopes — compute-profile=worker
  skipped final-check:coverage (0): Heavy / Coverage Regression, Test Unit (affected packages) — compute-profile=worker
[yeet] final-check deferred to hosted CI (compute-profile=worker): cheap-gates, lint-policy, check, docgen, fallow, coverage
```

`expectation-rewrite`, `lint`, `lint:changed-files`, `lint:effect-vitest-files` and `repo-sanity`
passed locally.

## Step 4: forced coverage (the proof)

Plan first:

```text
$ bun run beep yeet final-check --force-local --gates coverage --dry-run    # 1.8 s, 341 MB
[yeet] final-check plan for dd8a99d5da7e (merge base da56016e517b):
  coverage: TURBO_SCM_BASE=da56016e517b… bun run coverage --affected --concurrency=1
[yeet] final-check --force-local on the worker profile runs coverage one task at a time (concurrency 1)
[yeet] final-check --force-local measures coverage for @beep/github-references (this diff's affected plan)
```

The run used the repeat note's approach: a capped scope plus a watchdog that polled
`user-1001.slice` `memory.pressure` every 5 s and would stop the scope above `some avg10=15` or after
25 minutes, sampling the scope's `memory.peak` and its processes by RSS on each poll.

```sh
systemd-run --user --scope -q -p MemoryHigh=2G -p MemoryMax=3G -p MemorySwapMax=0 --unit=<unit> \
  /usr/bin/time -f 'FORCED %e s %M KB' bun run beep yeet final-check --force-local --gates coverage
```

Slice `some avg10` was 0.00 before the start (20:09:19Z).

```text
[yeet] final-check --force-local on the worker profile runs coverage one task at a time (concurrency 1)
[yeet] final-check --force-local measures coverage for @beep/github-references (this diff's affected plan)
[yeet] final-check coverage: TURBO_SCM_BASE=da56016e517b… bun run coverage --affected --concurrency=1
[beep-cli] coverage:affected: selected @beep/github-references
[beep-cli] coverage:ratchet: bunx turbo run coverage --cache=local:rw --cache-dir=~/.cache/beep/turbo --concurrency=1 --filter=@beep/github-references -- --fileParallelism=true --maxWorkers=1
   • Packages in scope: @beep/github-references
::group::@beep/types:build          … tsrs -p tsconfig.json --emitDeclarationOnly
::group::@beep/test-runner:build    … (identity, utils, data, schema likewise, all cache misses)
::group::@beep/github-references:coverage
 Test Files  9 passed (9)
      Tests  102 passed (102)
All files          |     100 |      100 |     100 |     100 |
  Tasks:    8 successful, 8 total
[coverage-ratchet] ok: compared 1 package(s) with epsilon 0.001; …
  passed final-check:coverage (21s 569ms): Heavy / Coverage Regression, Test Unit (affected packages)
FORCED 34.91 s 588252 KB
```

On the selected-plan path there is no separate `turbo run build` prebuild invocation: the build
closure ran as the `^build` dependencies inside the one `turbo run coverage --concurrency=1` graph,
so every build and the coverage task ran one at a time. The process sampler saw exactly one Turbo
command line, the one above (`… turbo run coverage … --concurrency=1 --filter=@beep/github-references
…`), and at most one `tsrs` at a time.

| Measure | Value |
| --- | --- |
| Wall | 34.9 s (`/usr/bin/time`); 37 s scope lifetime |
| Peak RSS, largest process (`%M`) | 588 MB |
| Largest processes sampled | `git add -A -- .` 551 MB and 538 MB (final-check's tree snapshot, at 6 s and 32 s); `beep-cli` 407 MB; `tsrs` 183 MB |
| Scope `memory.peak` (page cache included) | 1.39 GB, under the 2G `MemoryHigh` |
| Slice pressure peak, `some avg10` | 0.00 on every poll |
| Watchdog | not triggered; exit 0 |

Receipt `.beep/yeet/final-check/dd8a99d5da7ef87f01990a0ff863b4a8fcd55a9a.json` after the run:

```text
keys: base, complete, computeProfile, expectationRewrites, finishedAt, forceLocal, gateSetDigest,
      headSha, mergeBase, route, schemaVersion, startedAt, steps, verdict
schemaVersion: yeet-final-check/v2   complete: false (gate subset)   verdict: pass
computeProfile: worker               forceLocal: true
steps: [{"gate":"coverage","label":"final-check:coverage","status":"passed","durationMs":21569,
         "command":"TURBO_SCM_BASE=da56016e517b… bun run coverage --affected --concurrency=1"}]
```

Admission journal (`~/.beep/runtime/beep-admit-uid-1001/journal.ndjson`), the row this run added:

```text
{"_tag":"admission-routed","schemaVersion":"yeet-admission-journal/v3","command":"bun run beep yeet final-check",
 "envProfile":"local","computeProfile":"worker","forceLocal":true,"gateRoute":"coverage","outcome":"bypass"}
```

Attempt journal: `attempt-started` with `mode: final-check`, `computeProfile: worker`,
`forceLocal: true`, then `attempt-finished`.

## Step 5: one refusal

```text
$ bun run beep yeet final-check --force-local --gates fallow     # exit 0, 2.3 s, 326 MB
[yeet] final-check --force-local refused fallow on the worker profile: run serially, its first sub-lane
fallow:audit:check (204 packages) held a 2 GB-capped scope at its ceiling (2.15 GB aggregate) until slice
pressure passed 15 at 523 s (2026-11-13-worker-host-acceptance-repeat.md); unserialized it reached 3.06 GB
and gave no result in 29.5 minutes (2026-11-13-worker-host-acceptance.md); push with
`bun run beep yeet open --body-file <md>` and let hosted CI prove it
  skipped final-check:fallow (0): Fallow Advisory Envelopes — compute-profile=worker
```

Receipt for the head after the refusal: `complete: false`, `verdict: pass`,
`computeProfile: worker`, `forceLocal: false`, one step
`{"gate":"fallow","status":"skipped","reason":"compute-profile=worker"}`. Journal row:

```text
{"command":"bun run beep yeet final-check","gateRoute":"fallow","outcome":"refusal","forceLocal":true,"computeProfile":"worker"}
```

The journal row's `forceLocal: true` records what was requested; the receipt's `forceLocal: false`
records that no step was forced, as the amended criterion requires.

```text
$ bun run beep quality scheduler history
- worker routes: 41 (15 bypass, 26 refusal; 5 forced)
```

## Host notes

- Each `--gates` run rewrites the head's single receipt file, so the refusal run replaced the forced
  coverage receipt quoted above (as the runbook says, a subset receipt never admits `yeet ready`, and
  the plain `final-check` was run again on the final head). Evidence of a forced run therefore lives
  in the journal rows and in notes like this one, not in a receipt that survives the next run.
- The largest process in the forced run was not the measurement but final-check's own
  `git add -A -- .` snapshot of the worktree, at 551 MB.
- The primary clone still carries the interim `lefthook-local.yml`; the lane had none, so the hook
  skips above come from the profile. The host still has no git identity; commits set
  `GIT_AUTHOR_*` and `GIT_COMMITTER_*` per command. Host configuration was not changed.
- `beep worktree new … --base origin/main` took 88.8 s at 628 MB including its install; the rerun
  `bun install` took 11.9 s at 336 MB.

# Worker-host acceptance run on dankserver

Recorded 2026-11-13 on dankserver (15 GiB installed, worker profile) from the
lane `test/compute-profile-worker-acceptance` (sibling `-worktrees` root, base
`origin/main` at `3adc7cabc2`), PR
[#3267](https://github.com/beep-effect/beep-effect/pull/3267). The agent ran
inside the T3 agents slice. Home paths are written as `~`.

## Verdict per acceptance criterion

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Probe prints `worker`; `--is worker` exits 0/1 in under a second | pass | `worker`, exit 0 / exit 1, 0.73 to 0.76 s wall |
| 2a | Worker `final-check` refuses hosted-only gates and prints the `yeet open` route | pass | six gates skipped with reason `compute-profile=worker`, route printed, receipt `computeProfile: worker` |
| 2b | `--force-local` runs them and the receipt records it | not proven | `--force-local --gates fallow` ran for 29.5 min under a 3 GiB cap without finishing; stopped to protect T3; attempt row has `forceLocal: true`, no receipt written |
| 3 | edit → commit (hooks skipped by profile) → `yeet open` → hosted regeneration commit → hosted green → `yeet ready`, no process above 1.5 GB | fail | the commit skipped both hooks by profile and the hosted regeneration commit `856a171a7` landed, but every workflow on that head is `action_required` (the bot push needs a maintainer's approval). Hosted CI ran only after a later lane push. The draft-to-ready flip was made by the `kriegcloud` account, not by `yeet ready`. Hosted Check and Lint Policy then went red on the lane's own test, and the worker only learned of it from hosted CI 36 minutes after the push. Core lane commands stayed at 600 MB or less; the optional local test type-check reached 2.59 GB and was stopped. |
| 5 | Attempt and admission facts carry `computeProfile` beside the env profile; receipts name auto-skipped gates | partial | attempt journal and receipt pass; no admission journal row was written on this host for any run in the lane |

Criterion 4 (workstation commit) belongs to DankStation and was not part of
this run.

## Step 0: interim overrides on the host

- The primary clone still has the 2026-11-07 interim `lefthook-local.yml`
  (excluded through `.git/info/exclude`). It sets `skip: true` on
  `schema-catalog` and `instrumentation-catalog`, and its own comment says
  "Remove once the profile skip lands". It was left in place because other
  lanes in that clone may rely on it.
- `bun run beep worktree new` does not copy it: the lane had no
  `lefthook-local.yml` (copied files were `.env` and
  `.claude/settings.local.json` only).
- `LEFTHOOK_EXCLUDE` and `LEFTHOOK` were absent from the shell, the systemd
  user environment and the usual profile files. Lane commands were also run
  with both unset.

So the lane's hook skips below come from the profile probe, not the interim.

## Criterion 1: the probe

```text
$ bun run beep compute profile
worker
$ bun run beep compute profile --json
{"profile":"worker","source":"probe","ceilingGib":7,"envelopeGib":20,"overrideRequested":null}
```

| Command | Exit | Wall | Peak RSS |
| --- | --- | --- | --- |
| `compute profile --is worker` (3 runs) | 0, 0, 0 | 0.75, 0.73, 0.73 s | 195 MB |
| `compute profile --is workstation` (3 runs) | 1, 1, 1 | 0.74, 0.73, 0.76 s | 198 MB |

Measured with `/usr/bin/time -f '%e s %M KB'` around `bun run beep …`, so the
wall time includes the `bun run` script hop.

Ceiling source: Bun's `process.constrainedMemory()` returns 7 GiB, the
tightest `memory.high` on the process's cgroup path:

| cgroup | `memory.high` | `memory.max` |
| --- | --- | --- |
| `user-1001.slice` | 7 GiB | 8 GiB |
| `app-t3code-agents.slice` | 9 GiB | 11.25 GiB |
| every other ancestor and the session scope | max | max |

## Step 2: the source change

`makeReservationCapacity` in
`packages/tooling/tool/cli/src/internal/repo-run/MemoryStats.service.ts`
(the cgroup admission-budget read) ran as `Effect.fnUntraced`, while all four
test stubs in `quality-scheduler.test.ts` already named it
`MemoryStats.reservationCapacity`. It now runs as
`Effect.fn("MemoryStats.reservationCapacity")`.
`test/compute-profile.test.ts` gains a test that drives the real layer over
`FileSystem.layerNoop` under a recording tracer and asserts the span. With the
span reverted the new test fails (1 failed, 10 passed); with it, 11 passed.
The span adds one entry to
`standards/instrumentation-catalog/@beep/repo-cli.generated.jsonc`, which the
lane did not regenerate.

## Criterion 3: the lane

### Commit (`LEFTHOOK_VERBOSE=1 git commit`, commit `7e50645d71`)

```text
│  [lefthook] run: sh -c bun run beep compute profile --is worker
│  [lefthook] skip/only: bun run beep compute profile --is worker
│             result:    true
│  instrumentation-catalog (skip) by condition
│  [lefthook] skip/only: bun run beep compute profile --is worker
│             result:    true
│  schema-catalog (skip) by condition
│  instructions-drift (skip) no matching staged files
│  cache-profile (skip) no matching staged files
│  jsdoc (skip) no files for inspection
✔️ gitleaks (2.23 seconds)
✔️ biome (2.84 seconds)
✔️ typos (22.51 seconds)
✔️ commitlint (2.06 seconds)
```

Both catalog commands were skipped by the profile condition. Every other
command ran or skipped for having no matching files. 26.3 s wall, 181 MB peak.

The first commit attempt failed with `empty ident name`: the host has no git
identity, so commits need `GIT_AUTHOR_*` and `GIT_COMMITTER_*` set.

### `bun run beep yeet final-check` (no `--force-local`)

```text
  passed final-check:expectation-rewrite (23ms)
  skipped final-check:cheap-gates (0): … — compute-profile=worker
  skipped final-check:lint-policy (0): … — compute-profile=worker
  passed final-check:lint (38s 686ms): Lint (package Biome, GritQL laws)
  passed final-check:lint:changed-files (151ms)
  passed final-check:repo-sanity (1s 859ms): Repo Sanity
  skipped final-check:check (0): Heavy / Check — compute-profile=worker
  skipped final-check:docgen (0): Heavy / Docgen — compute-profile=worker
  skipped final-check:fallow (0): Fallow Advisory Envelopes — compute-profile=worker
  skipped final-check:coverage (0): Heavy / Coverage Regression, Test Unit (affected packages) — compute-profile=worker
[yeet] final-check deferred to hosted CI (compute-profile=worker): cheap-gates, lint-policy, check, docgen, fallow, coverage
[yeet] worker profile: hosted-only gates deferred; publish with `bun run beep yeet open --body-file <md>` and let hosted CI prove them
```

Receipt `.beep/yeet/final-check/7e50645d….json`:
`schemaVersion: yeet-final-check/v2`, `complete: true`, `verdict: pass`,
`computeProfile: worker`, `forceLocal: false`, and the six skipped steps each
carry `reason: compute-profile=worker`. 83 s wall, 600 MB peak.

### Publish posture

`bun run beep yeet publish --plan --message "…"` printed:

```text
[yeet] compute-profile=worker: publish takes the yeet open posture (push the committed HEAD, draft PR, no local proof; hosted CI is the proof). Pass --force-local to run the local publish.
```

The commit already existed, so the PR was opened with
`bun run beep yeet open --body-file <md>`:

```text
[yeet] --pr: created draft pull request through REST -> https://github.com/beep-effect/beep-effect/pull/3267
[yeet] applied compute-profile-worker to PR #3267
[yeet] applied ready-for-heavy to PR #3267
```

The PR was a draft labelled `ready-for-heavy` and `compute-profile-worker`.
The `--plan` output lists the `ready-for-heavy` label step but not the
`compute-profile-worker` one, which `open` still applies.

The first `yeet open` failed after pushing: `GitHub access failed (the GitHub
token reference (--token-ref or BEEP_GH_TOKEN_REF) must be an op://
reference)`. The host's `gh` wrapper reference names its 1Password item with
spaces, and `OpReference` (`^op://[^\s]+$`, from #3068) rejects spaces. The
rerun used the same item addressed by its ID.

### Hosted regeneration

- Run [43423380715](https://github.com/beep-effect/beep-effect/actions/runs/43423380715)
  (`labeled`, draft, label present): success in 81 s. An earlier run from the
  first `labeled` event (43423378421) was cancelled by the job's concurrency
  group.
- Log: `[schema-catalog] wrote @beep/repo-cli` (no content change) and
  `standards/instrumentation-catalog/@beep/repo-cli.generated.jsonc: wrote`,
  then `[detached HEAD 856a171a7] chore(catalogs): regenerate shards for the
  worker-profile lane`, 1 file changed, 1 insertion, pushed
  `7e50645d7..856a171a7`.
- The lane pulled `856a171a7` fast-forward.

### Every Catalog Regeneration run for this PR

| Run | Event | Head | Conclusion | Committed |
| --- | --- | --- | --- | --- |
| 43423378421 | `pull_request` (`labeled`) | `7e50645d71` | cancelled (concurrency group, superseded by the next `labeled` event) | no |
| [43423380715](https://github.com/beep-effect/beep-effect/actions/runs/43423380715) | `pull_request` (`labeled`) | `7e50645d71` | success | yes: `856a171a7`, 1 file, +1 line |
| 43423589561 | `pull_request` (`synchronize`, the bot push) | `856a171a7f` | `action_required` (never ran) | no |
| [43428550233](https://github.com/beep-effect/beep-effect/actions/runs/43428550233) | `pull_request` (`synchronize`, the lane push) | `9d4964d63b` | success | no: `drifted=0`, "Catalog shards are current." |

Shard provenance. The changed line is
`{"name":"MemoryStats.reservationCapacity",…}` in
`standards/instrumentation-catalog/@beep/repo-cli.generated.jsonc`:

- it is absent from the lane commit `7e50645d71`, because both catalog hooks
  were skipped by the profile and nothing else wrote the shard locally;
- it is absent from `origin/main` (`8b405079b6`);
- it was added only by the bot commit `856a171a7` (author and committer
  `github-actions[bot]`), from run 43423380715;
- it reached the final head `9d4964d63b` through the lane's merge of
  `origin/main`. Git merged it cleanly next to main's #3248 catalog lines;
  nothing regenerated it.

So the final run's clean tree means the shard was already right. It does not
mean a regeneration happened some other way: no local hook wrote the shard,
and the merge did not regenerate it.

### Hosted green on the bot's head: blocked

All three workflows on `856a171a7` (Check
[43423589914](https://github.com/beep-effect/beep-effect/actions/runs/43423589914),
Storybook 43423589737, Catalog Regeneration 43423589561) concluded
`action_required`. Their actor and triggering actor are
`github-actions[bot]`, and the commit's author and committer are
`github-actions[bot]`. The repository's approval policy is
`all_external_contributors`. The push therefore used the `github.token`
fallback of `secrets.BEEP_SKILLS_TRAIN_TOKEN || github.token`, and GitHub
holds the runs that push starts until a maintainer approves them. This token
cannot list repository secrets, so whether `BEEP_SKILLS_TRAIN_TOKEN` is unset
or unavailable to this workflow is unconfirmed.

As built, a single-push worker lane cannot reach hosted green on its
regenerated head without a maintainer approving the runs or the lane pushing
again. This run did not approve the held runs.

### Merge of main, evidence push and `yeet ready`

- `yeet open` for the evidence commit refused a stale base: `origin/main`
  had gained #3248, which also changed
  `standards/instrumentation-catalog/@beep/repo-cli.generated.jsonc`. The lane
  merged `origin/main` cleanly (`9d4964d63b`), re-ran `yeet final-check`
  (pass; the same six gates deferred with `compute-profile=worker`) and pushed
  with `yeet open`. The push came from the lane identity, so its workflows
  queued normally rather than landing at `action_required`.
- `yeet ready` at 12:53Z, PR still a draft, Check queued:
  `yeet ready refused: blocked on final-check: wait for hosted Repo Sanity
  (worker profile defers cheap-gates).` Exit 1; the PR stayed a draft.
- **External event:** at 2026-11-13T13:11:38Z the `kriegcloud` account
  marked the PR ready for review (`ready_for_review` in
  `issues/3267/events`). The lane did not do this, and from then on this run
  cannot observe its own `yeet ready` flipping a draft.
- `yeet ready` on the already-ready PR, with hosted Repo Sanity green and Lint
  Policy pending: `yeet ready refused: blocked on final-check: wait for hosted
  Heavy / Lint Policy (worker profile defers lint-policy).` Exit 1. It does
  not short-circuit on an already-ready PR: it still checks the
  worker-deferred gates against hosted results.
- Hosted Check run
  [43428550516](https://github.com/beep-effect/beep-effect/actions/runs/43428550516)
  for `9d4964d63b` came back red on two worker-deferred gates. Both reds were
  introduced by this lane's test:
  - `Heavy / Check` (job 131900126318):
    `test/compute-profile.test.ts(149,7): error TS377032: Effect.provide with
    a Layer should only be used at application entry points`.
  - `Heavy / Lint Policy` (job 131900126250): `lint:effect-vitest` reported
    `1 new finding(s)` in `packages/tooling/tool/cli/test/compute-profile.test.ts`.
    That is the same per-test `Effect.provide(layer)` (class
    `per-test-layer-provide`, EV002, replacement `it.layer`).
- Round trip. Lane push at 12:50:15Z; run created at 12:50:18Z; Check job
  queued until 13:25:06Z and red at 13:26:15Z; Lint Policy red at 13:31:42Z.
  The worker learned of a type error in its own test about 36 minutes after
  pushing, 35 of them spent in the runner queue. Locally the lane had run
  `vitest` (which does not type-check) and the worker `final-check`, which
  defers both gates by design.
- While the gates were red, `yeet ready` printed at 13:33:33Z: `yeet ready
  refused: blocked on final-check: hosted Heavy / Lint Policy is red (failure)
  on this head; the worker profile deferred lint-policy to it, fix the red
  before the flip.` Exit 1.
- Fix: the test now provides the layer through `it.layer(...)` instead of a
  per-test `Effect.provide`. `vitest run test/compute-profile.test.ts`: 11
  passed. A local type check of the test project was attempted:
  `bunx turbo run package-test-typecheck --filter=@beep/repo-cli` under
  `systemd-run --user --scope -p MemoryHigh=2G -p MemoryMax=3G`. It was
  stopped after 30 minutes with no result: `tsc` alone held 2.59 GB RSS, the
  scope sat at 2.98 GB, and `user-1001.slice` reached `some avg10=89`
  pressure. The fix was therefore pushed unproven and left to hosted CI.
- The `yeet ready` result after hosted green is recorded on the PR.

## Step 7: `--force-local` (criterion 2, second half)

Before the run, `user-1001.slice` held 6.7 GiB, of which anon was about
1 GiB; the rest was reclaimable file cache. The gate run was `fallow`. It was
chosen as the least TypeScript-bound of the six hosted-only gates; an ad-hoc
`tsgo` package check earlier in the session peaked at 4.07 GB, which ruled
out `check` and `docgen`. The run was:

```sh
systemd-run --user --scope -q -p MemoryHigh=2G -p MemoryMax=3G -p MemorySwapMax=0 \
  --unit=acceptance-force-local-fallow \
  /usr/bin/time -f 'FORCELOCAL %e s %M KB' bun run beep yeet final-check --force-local --gates fallow
```

- `fallow` runs three turbo tasks (`dead-code`, `health`, `audit` over 204
  packages) in parallel. Each is a `bun` CLI of about 275 MB under its own
  `op run` wrapper, and each has a `fallow` analyzer child of up to 398 MB.
  The scope's anon reached 2.16 GB within four minutes, and three `fallow
  --version` children went into D state under `MemoryHigh=2G` with no swap.
- `MemoryHigh` was raised at runtime to 2.9 GB, leaving `MemoryMax=3G` as the
  kill line. The scope then sat at about 2.9 GB, with peak 3.06 GB, 1.3
  million `high` throttle events and no OOM.
- After 29.5 minutes the scope's pressure was visible across
  `user-1001.slice` (`some avg300=17.6`), the slice that hosts `t3 serve`.
  The run was stopped with SIGTERM, exiting 130.

Outcome: no single process exceeded 400 MB, but the gate as a whole does not
fit in about 3 GB on this host in reasonable time. No `forceLocal: true`
receipt was written. The attempt journal recorded it:

```text
{"_tag":"attempt-started","mode":"final-check","envProfile":"local","computeProfile":"worker","forceLocal":true,…}
{"_tag":"attempt-terminated","reason":"interrupted","envProfile":"local","computeProfile":"worker",…}
```

The receipt for `7e50645d…` stayed the complete, non-forced one.

## Criterion 5: facts

Attempt journal
(`.beep/yeet/runs/test_compute-profile-worker-acceptance-*/attempts.ndjson`):
every row of this lane carries both keys. That covers final-check, both
publish attempts, the forced attempt and its termination:

```text
{"_tag":"attempt-started","mode":"final-check","envProfile":"local","computeProfile":"worker"}
{"_tag":"attempt-started","mode":"publish","envProfile":"local","computeProfile":"worker"}
{"_tag":"attempt-finished",…,"envProfile":"local","computeProfile":"worker"}
```

The final-check receipt carries `computeProfile: "worker"`, `forceLocal:
false` and per-step `reason: "compute-profile=worker"`.

Admission facts: the admission root `~/.beep/runtime/beep-admit-uid-1001/`
exists, with empty `claims`, `leases`, `promotions`, `quarantine` and `queue`
directories, but it has no `journal.ndjson`. None of this lane's commands
wrote an admission row, so the admission half of the criterion could not be
observed here.

## Peak RSS per command

`/usr/bin/time -f '%M'` reports the largest single process in the command's
tree, which is what the 1.5 GB bar measures. Systemd figures are cgroup
aggregates, page cache included.

| Command | Wall | Peak RSS | In the criterion-3 window |
| --- | --- | --- | --- |
| `beep worktree new` (includes its `bun install`) | 94.4 s | 778 MB | no |
| `bun install` (rerun in the lane) | 12.3 s | 335 MB | no |
| `compute profile --is …` | 0.73 to 0.76 s | 198 MB | no |
| `vitest run test/compute-profile.test.ts` | 10.0 s | 684 MB | no |
| ad-hoc `tsgo --noEmit -p tsconfig.check.json` (repo-cli, wrong invocation, TS6305) | 105.8 s | 4.07 GB | no |
| `git commit` (all hooks) | 26.3 s | 181 MB | yes |
| `yeet final-check` | 83.0 s | 600 MB | yes |
| `yeet publish --plan` | 1.7 s | 321 MB | yes |
| `yeet open`, first attempt (failed on the token ref) | 7.3 s | 339 MB | yes |
| `yeet open` | 15.5 s | 380 MB | yes |
| `git commit` (evidence) | 14.7 s | 185 MB | yes |
| `yeet final-check` on `28d712638a` / `9d4964d63b` | 32.6 / 55.3 s | 602 MB | yes |
| `yeet open` (stale-base refusal) / (push) | 3.8 / 14.3 s | 351 / 385 MB | yes |
| `git merge origin/main` | 4.0 s | 262 MB | yes |
| `yeet ready` (draft, refused) / (ready PR, refused) / (red gate, refused) | 9.0 / 8.3 / 8.0 s | 386 / 386 / 389 MB | yes |
| `vitest run test/compute-profile.test.ts` (fix) | 6.3 s | 684 MB | yes |
| `turbo run package-test-typecheck --filter=@beep/repo-cli` (capped scope, stopped) | 30 min, stopped | `tsc` 2.59 GB; scope 2.98 GB | yes: **exceeds 1.5 GB** |
| detached readiness monitor unit (cgroup `MemoryPeak`) | running | 337 MB aggregate | yes |
| `final-check --force-local --gates fallow` (scope) | 29.5 min, stopped | 3.06 GB aggregate; largest process 398 MB | step 7 |

The core lane commands (commit, final-check, open, ready, merge) all stayed
under 1.5 GB, at 600 MB or less. The one breach is the optional local test
type-check (`tsc` 2.59 GB), attempted to diagnose the hosted Check red;
that check is hosted-only on this profile for exactly this reason. Yeet's own
per-step RSS files under `.beep/yeet/rss/` are transient: they are deleted
after reading. The final-check steps carried no `peakRssKb`, so the figures
above come from the external wrapper.

## Findings to fix on main

1. The hosted regeneration push is made as `github-actions[bot]` with the
   `github.token` fallback. Its follow-up runs need approval
   (`action_required`), so the worker lane cannot reach hosted green on its
   own. Either provision the push token the workflow expects, or make the job
   use a token whose pushes trigger workflows.
2. `OpReference` rejects `op://` references whose item names contain spaces.
   The dankserver `gh` wrapper's reference is one, so every Yeet GitHub call on
   the host fails until the reference is rewritten by item ID.
3. `--force-local` for `fallow` does not complete in about 3 GB on a worker
   host. Its three parallel turbo tasks are about 0.7 GB each with wrappers.
   Criterion 2's second half needs either a cheaper forced gate or a
   documented memory budget for the forced run.
4. No admission journal row is written for worker-lane final-check runs, so
   criterion 5's admission half has no evidence on a worker.
5. The primary clone's interim `lefthook-local.yml` is now redundant (the
   profile skips both hooks) and can be removed by the host owner.
6. A worker lane cannot see Check or Lint Policy reds before hosted CI
   reports them, and the local test type-check alone exceeds the worker
   budget (`tsc` 2.59 GB for `@beep/repo-cli`). A test-file type error costs
   one hosted round trip, about 36 minutes here.
7. Hosted regeneration only covers the first push. When `main` later
   changes the same shard, the lane must merge `main` by hand (`yeet open`
   refuses a stale base). Git merged it cleanly here, but nothing guarantees
   that for a generated file.
8. The host has no git identity; commits need `GIT_AUTHOR_*` and
   `GIT_COMMITTER_*` set.

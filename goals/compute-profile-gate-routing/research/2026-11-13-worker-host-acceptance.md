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
| 3 | edit → commit (hooks skipped by profile) → `yeet open` → hosted regeneration commit → hosted green → `yeet ready`, no process above 1.5 GB | fail at "hosted green" | the regeneration commit landed, but every workflow on its head is `action_required`: the bot push needs a maintainer's approval before hosted CI runs. No measured lane process exceeded 1.5 GB. |
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

### Hosted green: blocked

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
again. This run did not approve the held runs. The evidence commit that
carries this note is a lane push, and it starts fresh runs on a head that
includes the regenerated shard. Hosted green and `yeet ready` on that head
are reported on the PR, because this note has to be pushed before `yeet
ready`.

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
| detached readiness monitor unit (cgroup `MemoryPeak`) | running | 337 MB aggregate | yes |
| `final-check --force-local --gates fallow` (scope) | 29.5 min, stopped | 3.06 GB aggregate; largest process 398 MB | step 7 |

No measured process in the criterion-3 window exceeded 1.5 GB. Yeet's own
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
6. The host has no git identity; commits need `GIT_AUTHOR_*` and
   `GIT_COMMITTER_*` set.

# Hosted acceptance probes, 2026-10-31

Refs #1858. This receipt appends to the
[2026-10-22 hosted-probes receipt](2026-10-22-hosted-probes.md) and the
E-12 and E-11 results posted on #1858. It records only rows with new hosted
evidence; every other row keeps its earlier disposition. This lane changed no
workflow, secret, token, environment, label, ruleset or baseline, and
dispatched no workflow.

REST observations were collected on 2026-10-31 between 16:40 and 17:10 UTC.

## Exact heads

| Alias | Exact head | Run and event |
| --- | --- | --- |
| W | `adedee335a862464e3a4997e2842daf7efd1e9a9` | [Check 41220974764](https://github.com/beep-effect/beep-effect/actions/runs/41220974764), main push after the squash merge of #2407, created 16:42:30 |
| Q | `b325e8e0771f88c3706290d152b8de861900d8e7` | [Check 41221007793](https://github.com/beep-effect/beep-effect/actions/runs/41221007793), PR #2419, created 16:42:56; its reusable Heavy workflow resolved to W |
| G | `8f619d205ca73a80135a3aa3ba7143365901a979` | [Check 41185900393](https://github.com/beep-effect/beep-effect/actions/runs/41185900393), main push after the squash merge of #2375, completed/success |
| L | `b87a1418e8b3ebeee4a1a8dcf521259a3ac84b32` | [Check 40811794656](https://github.com/beep-effect/beep-effect/actions/runs/40811794656), main push after the squash merge of #2347, attempt 2 completed/success |
| N | `f16d82e9f16d72f64d42b40284bf2867566e796b` | [Property Laws Nightly 41214248935](https://github.com/beep-effect/beep-effect/actions/runs/41214248935), 2026-10-31 schedule, completed/success |
| C | `624c7e9ab4c53ba7ffcd2e0c326e2a2800bdb278` | [Cache Warm 40423283030](https://github.com/beep-effect/beep-effect/actions/runs/40423283030), operator `workflow_dispatch` on main, 2026-10-26, completed/success |

## R41: environment-only writer after repository-token retirement

The repository-level `TURBO_TOKEN` is gone. Names-only listings read at
16:40 and again at 17:06 UTC report:

- Repository: APP_ENV, APP_LOG_FORMAT, APP_LOG_LEVEL, APP_NAME,
  KNOWLEDGE_MINT_APP_PRIVATE_KEY, NEXT_PUBLIC_ENV,
  TURBO_R2_READ_ACCESS_KEY_ID, TURBO_R2_READ_SECRET_ACCESS_KEY,
  TURBO_READ_TOKEN, TURBO_TEAM.
- `turbo-cache-write` environment: TURBO_R2_WRITE_ACCESS_KEY_ID,
  TURBO_R2_WRITE_SECRET_ACCESS_KEY, TURBO_TOKEN.

The environment has one protection rule, `branch_policy`, with custom branch
policies and exactly one policy, branch `main`. The latest 100 writer
deployments all have ref `main`. No repository record says when the operator
deleted the repository copy, so this receipt uses only runs created after the
16:40 read, which cannot have resolved a repository-scope `TURBO_TOKEN`.

**Writer (W).** All six Heavy lanes now set `uses_turbo: "true"` in
`heavy.yml`, and run W created six `turbo-cache-write` deployments at
16:48:05: 7461463341 (Build, job 124596576737), 7461463353 (Check,
124596576790), 7461463351 (Doctest, 124596576796), 7461463346 (Test
Integration, 124596576770), 7461463347 (Lint Policy, 124596576776) and
7461463364 (Docgen, 124596576841). Build, Check, Doctest and Test Integration
completed/success, and their deployment statuses were `success` at 17:06.
On the 17:25 refresh, Docgen had completed/success with deployment status
`success`. Lint Policy completed/failure on `//#lint:effect-vitest`, a code
red unrelated to the cache boundary (its writer deployment ran and reports
`failure` because the job failed); main repair belongs to the program
orchestrator. Heavy / Build's log reports
`turbo remote cache read-write (trusted push); application secrets exported (trusted push)`
and `TURBO_CACHE: local:rw,remote:rw`.

Artifact 13050321964, `turbo-summary-verify-build`, was downloaded and parsed.
Its summary records SCM SHA W on `main`, 187 tasks, 81 `HIT` with
`local=false, remote=true` and 106 `MISS`. For example, `@beep/acp#build`,
hash `b31219b774e8d3a1`, has source `REMOTE`. The file is
`3LT6BrLLP0XM1BqyFUCXymRUSl3.json`, SHA-256
`d7e314055f1839bd1ae4ff01930828f47e820f609a81afedbe862f956037dc2b`.
Remote reads used the environment writer after the repository copy was gone.

**PR (Q).** [Heavy / Build 124599021810](https://github.com/beep-effect/beep-effect/actions/runs/41221007793/job/124599021810)
completed/success. Its log reports
`turbo remote cache read-only (same-repository pull request); application secrets blank`
and `TURBO_CACHE: local:rw,remote:r`. The deployments API filtered by Q and
`turbo-cache-write` returns zero records. Every job of run Q that had
completed by 17:06 succeeded.

This closes the R41 hold: the writer works from environment scope alone, on
trusted main only, and a same-repository PR stays read-only with no writer
deployment. The 2026-10-22 restoration procedure stays the recovery path if
the repository copy must ever be recreated; recreating it reopens the
repository-scope exposure.

## Row updates

| E item | Exact head / run | Result |
| --- | --- | --- |
| E-01, main concurrency | 2026-10-31 main Check runs | Push runs share group `Check-refs/heads/main` without cancel-in-progress. Run 41219439587 at `ac8993e7773065c55b11e6b71b0f1471a0105d2f` was pending and cancelled 27 s later when 41219474964 at `2e17c92111b8a31c72771053413ee2305b955d18` arrived; neither started a job. 41219474964 stayed pending while 41217176115 at `24f5c4b2dcb8601c85e4babf83dde26eb20b4b84` ran to completion (failure, 16:46:42); 41219474964 was replaced by W's run at 16:42:32, and W's first job deployments appear at 16:46:42, the moment 41217176115 finished. The running main run is never cancelled; one pending run holds the queue and the newest wins. **Met.** |
| E-02, trusted writer boundary / R41 | W / 41220974764; Q / 41221007793 | Demonstrated after repository-token retirement; see above. **Met.** |
| E-03, nightly credentials | N / 41214248935 | Scheduled run completed/success; the 2026-10-26..30 schedules also succeeded. **Met.** |
| E-11, Cache Warm | C / 40423283030 | The operator-dispatched bounded R2 qualification (`r2_probe`) completed/success, job 121922696528. Artifact 12698657520 `ci-proof.json` (SHA-256 `3c48df0dbd31a06ce9bbc1d3eb9d3105742031bfbe4cfe4ee712e446cb3d100b`) records status `success`, a consumer `lint:effect-imports` remote HIT in `remote:r` mode, a producer MISS uploaded in `remote:w` mode with two payloads of 5,740,000 and 11,350,000 bytes, and `reader_write_rejected: true`. This qualifies bidirectional R2 read/write and the reader write rejection. A full warm with a `cache-warm.json` receipt has still not succeeded since 40026178733 failed on 10-23; the next scheduled warm is 2026-11-01 06:17 UTC (`17 6 1,15 * *`). **Partly met.** |
| E-12, docs-only classifier | PR #2165 / 40023731606; PR #2406 / 41215498052 | Docs-only case, recorded on #1858 on 2026-10-23: at `66a635c17be7cdaebef9b46b26be5c7f801a2749`, Heavy Admission job 120655098776 emitted `skip-satisfied`, `docsOnly: true`, for three Markdown paths. Application-Markdown case: PR #2406's head `bc9d2ca76106c738936442418495813080baa215` changes only `packages/foundation/modeling/identity/README.md`. [Heavy Admission job 124579536899](https://github.com/beep-effect/beep-effect/actions/runs/41215498052/job/124579536899) emitted `{"verdict":"run","admitted":true,"sources":["label"],"docsOnly":false,"changedPathCount":1}`, and [Heavy / Build 124579798882](https://github.com/beep-effect/beep-effect/actions/runs/41215498052/job/124579798882) executed 187 tasks. Package Markdown is not classified docs-only, so Heavy runs. That run's Lint Policy and Coverage Regression reds and its cancellation do not bear on classification. **Met** for both cases. |
| E-14, writer environments | W / 41220974764; Q / 41221007793 | Six Heavy writer deployments at W, one per lane, all ref `main`; zero at Q. The attachment matrix now covers every Heavy lane, since Effect Diagnostics was retired (#2262) and Lint Policy and Docgen use Turbo. **Met.** |
| E-31, merge-SHA Heavy | G / 41185900393 | Attempt 1 completed/success. `referenced_workflows` resolves `heavy.yml@main` to G itself. Heavy Admission, Build, Check, Docgen, Doctest, Lint Policy, Test Integration and Coverage Regression all succeeded, as did every other job (PR Size Label skipped on push). Actual dead-runner recovery: on L, attempt 1's Heavy / Lint Policy job 123255108086 failed on runner `beep-ci-i-07cc57211ea08d929` with the verification step still in progress. [Rerun Runner Loss 40818978007](https://github.com/beep-effect/beep-effect/actions/runs/40818978007/job/123266699848) at L returned verdict `runner-loss` and ran `gh run rerun --job 123255108086`; attempt 2 completed with 30 jobs success and one skipped. **Met.** |
| E-32, caller secret boundary | W / 41220974764; Q / 41221007793 | The writer resolves only from environment scope; the PR exporter receives a blank writer input. **Met.** |

## Still open

| E item | Needs | Owner and exact steps |
| --- | --- | --- |
| E-09, desktop release | A signed release run | Tracked by #1859; the operator supplies signing references through the protected environment and the release owner runs a disposable signed release. |
| E-11, Cache Warm full pass | A successful full warm with its `cache-warm.json` receipt | Agent: read the 2026-11-01 06:17 UTC scheduled run and its `cache-warm-<run id>` artifact. If it fails, attribute the red; only the cache owner dispatches another writer run. |
| E-13, fork admission | A real fork PR and the two distinct approval events | Operator: have a non-member account open a fork PR, then apply the fork admission approvals as documented in the E audit. Agent records the Heavy Admit and Check runs at that fork head. |
| E-16, setup cache writes / Bun cache | Actions-cache usage before and after cleanup, with a recoverable receipt | Cache owner: record `gh api repos/beep-effect/beep-effect/actions/cache/usage` before and after the G cleanup and keep the deleted-key list. |
| E-22, timeouts | A controlled timeout case | Agent: on a disposable PR, add a job step that sleeps past its `timeout-minutes` and record the cancelled job; revert in the same PR. Only if operational timeout acceptance is still required. |
| E-25, main-ref trust | A non-main push that cannot reach the writer | `ci job-env` treats every push as trusted and selects `TURBO_TOKEN`, so the boundary is GitHub's, not the exporter's: a non-main push can only be stopped at the environment or by an empty secret. Read-only is reserved for same-repository PRs and is never a valid push outcome. Agent probe: on a disposable non-main branch, push a workflow with two `on: push` jobs that run `setup-monorepo-ci` with `turbo-remote-cache: true` and `turbo-token: ${{ secrets.TURBO_TOKEN }}`. Job A declares `environment: turbo-cache-write`; expect GitHub to reject its deployment under the `main`-only branch policy before any step runs. Job B declares no environment; with the repository copy retired, expect `ci-job-env: turbo remote cache local-only` and `TURBO_CACHE: local:rw`. Either a rejected deployment or `local-only` passes, and read-write fails the probe. Delete the branch afterwards. |
| E-26, orphan secrets / Vercel | A verified recovery source per secret and a Vercel binding-owner decision | Operator: name each secret's recovery reference and the binding owner; nothing is deleted before that. |
| E-28, Heavy Admit replacement | The pending-label replacement sequence | Agent: on a PR with a Heavy Admit run pending, add an unrelated label, then `ready-for-heavy`, and record which runs were cancelled. |

Rows not listed here or above (E-04 through E-08, E-10, E-15, E-17 through
E-21, E-23, E-24, E-27, E-29, E-30, E-33) keep their 2026-10-22 disposition.
#1858 stays open until the "Still open" rows have hosted evidence.

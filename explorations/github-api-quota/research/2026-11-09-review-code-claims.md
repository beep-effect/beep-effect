# Code check of the GitHub API reduction plan

The plan's numbers mostly hold. Its fixes are wrong in five places:

1. **S1's monitor is not a read-only poller.** The `--until-ready` monitor reruns failed jobs. That needs the Actions write permission, and the App may not have it.
2. **The ruling has a second reason.** An earlier handoff says the monitor makes raw `gh` calls and can rerun jobs. The plan only answers the Workflows reason.
3. **Exporting `GH_TOKEN` into the monitor's unit environment is blocked.** Ruling 39's environment denylist rejects any name containing TOKEN.
4. **The S2 choke point does not cover the monitor's GraphQL reads.** Most per-poll reads are `gh` subprocesses. The octokit layer has no state shared between processes.
5. **T3's PR sweeps are not ETag-revalidated.** Only one REST route is.

Everything was checked read-only, with no `gh` API calls. Repo paths are relative to `~/YeeBois/projects/beep-effect`. In the tables below, `CLI` = `packages/tooling/tool/cli/src`, `Y` = `CLI/commands/Yeet/internal`, `D` = `packages/drivers/github/src`, and `BIN` = `~/.cache/beep/orchestrator/bin`.

## Basis claims

| Claim | Verdict | Evidence | Correction |
|---|---|---|---|
| until-ready polls every 30 s | Confirmed | `Y/MonitorLoop.ts:196`, used at `:2612` | `--poll-interval` already exists (`Yeet.command.ts:571-573,1220`). The detached submit never passes it (`Y/Planner.ts:712`, `Y/ReadyGate.ts:107`). |
| `--watch` polls every 10 s | Confirmed | `Y/Porcelain.ts:660,714` | — |
| Classic comment stream polls every 10 s | Confirmed | `Y/MonitorComments.ts:62` | — |
| Error budget is 5 | Confirmed | `Y/MonitorPolicy.ts:97`; consecutive count at `MonitorLoop.ts:2642-2643` | — |
| No ETag or `If-None-Match` in `drivers/github` or `Status.ts` | Confirmed | No hits for etag, if-none-match or if-modified-since in either. No response caching in `D`. | — |
| 3 remotes, no `gh-resolved` | Confirmed | `git remote -v` shows effect-upstream, github and origin. `git config --get-regexp gh-resolved` returns 1. | `github` and `origin` both point to beep-effect/beep-effect. |
| `HANDOFF.md:45` holds the ruling | Confirmed, but incomplete | `~/.cache/beep/orchestrator/HANDOFF.md:45` (the file is in the orchestrator directory, not the repo) | `HANDOFF.2026-11-02T0220Z.bak.md:47` gives other reasons: "the canonical monitor reads via raw gh (ignores gate-env) and --until-ready can rerun jobs". |

## Structural items (S1–S9)

**S1: run read-only pollers on the App token.** Refuted as written.
- **The monitor writes.** `rerunJob` sends `POST /actions/jobs/{job_id}/rerun` through the in-process client (`Y/MonitorLoop.ts:1174-1190`). On the App identity that needs Actions write, which was not checked.
- **The in-process App path already exists.** It is config, not code:
  - `selectGithubIdentity` picks `BEEP_GH_TOKEN_REF`, then `BEEP_GH_APP_*`, then the gh login (`CLI/internal/github/GithubIdentity.ts:9-11,69-71,186,205`).
  - Detached jobs already forward `BEEP_*`, including the App key reference (`Y/ProofJob.ts:281-287,1582-1584`).
  - `BIN/gate-env.sh` already exports `BEEP_GH_APP_*` for merge-gate units.
- **`GH_TOKEN` cannot go in the unit environment.** It matches the denylist regex `/^(?:OP_)|TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL/` (`Y/ProofJob.ts:237`, ruling 39). Installation tokens also expire after 1 hour, longer monitors outlive them, and the plan has no refresh step.
- **`GhCommand.ts` is the wrong place to inject.** The file is 111 lines and only defines `ghOutput` (`:91`). `runRepoCommandCapture` lives in `internal/repo-run`. The monitor-path `gh` spawns call it directly and would miss a `ghOutput` fix:
  - `Y/Status.ts:717` (pr checks, run twice per poll) and `:829` (run list)
  - `Y/WatchMode.ts:183,287`
  - `Y/MonitorLoop.ts:1034`
- **Merge-gate already runs on the App.** `BIN/merge-gate-loop5-app.sh:8` exports `GH_TOKEN` from `gh-app-token.sh`.

**S2: ETag layer in "the single octokit transport".** Partly confirmed.
- `makeTransport` (`D/internal/octokit.ts:277`) is shared code. Both `GitHubClient` (`D/GitHubClient.ts:691`) and `GitHubApp` (`D/GitHubApp.ts:1313,1325,1434`) reach it through `makeClientShape`.
- It holds no state across processes. Each build creates a fresh Octokit and Ref (`:280-281`).
- Pagination creates a second Octokit with its own `hook.wrap` (`:369,373`). The hook belongs in `makeOctokit` (`:240`), or it misses every `paginate` call, including all 3 comment reads.
- The `gh` subprocess reads bypass it entirely: pr view, pr checks ×2 and run list per until-ready poll, plus the watch view and checks.
- "3 comment reads per poll" is confirmed (`Y/MonitorComments.ts:1112-1157`).
- The watermark `since` only moves when comments are acknowledged (`Y/Converge.ts:502-506`), so ETags would survive it.
- The T3 reference is `GitHubPullRequestApi.ts:1199`, not `:1189`. Its validator store is an in-memory `Cache` (`:1189-1197`), not on disk.

**S3: adaptive interval and sleep on rate limits.** Partly refuted.
- `nextMonitorSleep` is at `Y/MonitorLoop.ts:2507`. Line 196 is the interval constant.
- `retry-after` is already honoured, up to 60 s (`D/Resilience.ts:311-315`).
- "Octokit retries 4 times per call" is false for primary exhaustion. The advised delay is time-to-reset, which is over 60 s, so `retries()` returns false and the call fails at once. Example at `D/Resilience.ts:305`; headers parsed in `D/internal/headers.ts:84-105`.
- `gh` subprocesses do not retry at all.
- The transport already records `x-ratelimit-*` in `transport.rateLimit` (`octokit.ts:282-285`). S3 and S9 should build on it.
- The "about 2.5 minutes" figure is correct (5 errors × 30 s).

**S4: one GraphQL query per poll.** Confirmed.
- Line refs are correct: `Y/Status.ts:687` (`collectRemoteChecks`), `:775` (`collectRemoteReviewThreads`), `:1094` (`readRemotePullRequest`), `:1174` (`collectRemoteStatus`).
- The `KEEP (D-13)` markers are at `:716,828,1095,1127`.
- The per-poll fan-out is at `:1212-1220`: pr checks, pr checks `--required`, threads and run list.
- The run list is 1 REST call per poll (`:829-833`), so "120 REST/h" is right.

**S5: one poller per PR with a shared snapshot.** Partly refuted.
- The lock is scoped to the checkout (`.beep/yeet/jobs`, `Y/ProofJobLauncher.ts:366,401-402`), not just a process. The constants are at `:83-89`. Dedupe across checkouts and hosts is missing.
- The monitor never writes the snapshot. `writeYeetStatusSnapshot` (`Y/Status.ts:1729`) is called only from `Y/Handler.ts:1779,2157` (status commands). S5 needs the monitor to write it on every poll first.

**S6: batch GraphQL across open PRs.** Confirmed in shape.
- Gate-table per non-draft PR: `pulls/{n}`, check-runs, commit statuses, review window (2–3 REST) and threads (`Y/GateTable.ts:617-632,687-695`). That is about 5–6 REST per PR.
- "~45 REST per cycle" fits about 8 open PRs. It scales with the open-PR count and is not a fixed number. HANDOFF line 52 recorded 11 open PRs, which is about 60 per cycle.
- `pr-health-watch.sh` already uses the batched query on `ghapp.sh` (`BIN/pr-health-watch.sh:5-10`).

**S7: webhooks.** Partly refuted.
- `Github.schemas.ts:13-29,100-101` only describes the manifest `hook_attributes`, which is set when an App is created.
- No code updates an existing App's hook config (no `/app/hook/config` anywhere).
- No webhook receiver exists, which matches the plan.
- `docs/ops/beep-reviewer-app.md:90,106` says the reviewer App runs with no webhook.

**S8: cache the App token.**
- Confirmed for the shell scripts. `BIN/ghapp.sh` mints a token on every call, and `BIN/gh-app-token.sh` runs one `op read` each time. `BIN/check-then-arm.sh:6,8` calls `ghapp.sh` twice per 60 s, which is about 120 mints and 120 1Password reads per hour. `main-run-watch.sh:6` also mints every 180 s.
- Refuted for the CLI. `GitHubApp` already caches the token in memory and re-mints before expiry (`D/GitHubApp.ts:1136-1142,1385-1434`). The per-poll mints come from H4 (rebuilding the layer), not from missing caching.

**S9: REST budget guard.** Confirmed. `GraphqlBudget` spends a 1-point `rateLimit` probe and falls back to REST `/rate_limit` (`CLI/internal/github/GraphqlBudget.ts:8-17,221-231,278`).

## Hotspots (H1–H10)

| Item | Verdict | Evidence and correction |
|---|---|---|
| H1: PR resolved from the branch 3 times per poll | Confirmed | `gh pr view` (`Status.ts:1096`) plus `gh pr checks` twice (`:717`), each without a PR number. `gh run list --branch` also keys on the branch (`:831`). |
| H2: RepositoryNetwork lookup on every spawn | Unsupported | Not traced; gh is 2.103.3. From what I remember of gh's source, which I did not check here: a non-TTY spawn falls back to the first sorted remote without a network query. `github` sorts first and resolves correctly. The "up to 480 GraphQL/h" figure is probably overstated. Check it with `GH_DEBUG=api` before counting the saving. |
| H3: reviews read in full every poll | Confirmed | The source comment says so (`MonitorComments.ts:1146-1155`). `Converge.ts:487` is `pollYeetPrCommentRows`. |
| H4: client rebuilt every poll | Confirmed, and wider than stated | `Status.ts:1211` and `GhOps.ts:1778` (review window) use `provideYeetGhLogin`, which is scoped per call (`GhOps.ts:745-756`). The loop's `makeYeetGhLoginOnce` (`MonitorLoop.ts:2633`) is not used for these reads. `--watch` does the same twice per 10 s poll (`WatchMode.ts:309,630`). On the App identity, every rebuild is a mint plus an `op read`. |
| H5: status collected twice during closeout | Confirmed, but rarer | `MonitorLoop.ts:2021`. It runs only when the verdict is `closeout-pending` (`:2100`), roughly once per head, not on every poll. |
| H6: merge-gate reads everything each attempt | Confirmed, one sub-item refuted | It reads pull, check-runs, threads, rules, squash, compare, base runs and window with no early return (`MergeGate.ts:1281-1321`). The loop sleeps 240 s (`merge-gate-loop5-app.sh:27`). But the pull is already passed into `readSquashCommitlint` (`MergeGate.ts:1300-1303`). Only `readSquashCommitlintForPullRequest` re-reads it (`SquashCommitlint.ts:936`), so drop that sub-item. |
| H7: census refetches | Confirmed, lines approximate | `Ci/LaneTimings.ts:~830` is the transient-error comment. The fetches are at `:1059,1133,2891`. The 1,000–3,000 figure is unsupported by code. |
| H8: rule-suites over a month | Confirmed, correction needed | `CompletionEvidence.ts:217-221` uses `time_period:"month"` with `ref=refs/heads/main` (`:368`). `time_period` is measured back from now, so "day around the merge timestamp" only works for merges in the last 24 h. Pick the smallest of hour, day, week or month that covers now minus mergedAt. |
| H9: about 25–30 raw `gh` spawns in about 16 files | Roughly confirmed | About 19 `ghOutput`/`runRepoCommandCapture("gh")` sites plus about 27 `"gh"` literals, including 9 in `Planner.ts`, 5 in `Library.github.ts` and `Ci/*`. |
| H10: ReadyGate re-reads status | Confirmed | `ReadyGate.ts:545` (`collectYeetStatus`) and `:603,859` (`gh pr view`). |

## Cadences, operational items and other claims

- **Until-ready baseline of 480 REST/h:** confirmed. That is 4 REST per poll: run list plus 3 comment reads. The 720–840/h window phase is also confirmed, since the window adds 2–3 REST (`Y/ReviewWindow.ts:379-443`) and is read lazily (`Status.ts:1306-1322`).
- **Watch at about 1,080 REST/h:** confirmed. It does pr view, pr checks and threads, plus 3 comment REST calls per 10 s.
- **Merge-gate on App or user:** confirmed. `merge-gate-loop5-app.sh` and `merge-gate-loop5-strict-app.sh` use the App; `merge-gate-loop5.sh` uses the user token.
- **Gate poll at 10 min, skill says 4 min:** confirmed. `HANDOFF.md:135` (600000 ms) and `.claude/skills/orchestrate/SKILL.md:275-279` (240 s).
- **Finals and health watchers at 60 s / 300 s on the user token:** confirmed. `gh-finals-watch.sh:10-12` and `gh-health-watch.sh:10,23` call plain `gh api graphql`, not `ghapp.sh`. That supports O4. `pr-health-watch.sh` runs every 180 s on the App.
- **O2, `job wait` makes 0 GitHub calls:** confirmed. `ProofJobLauncher.ts` has no GitHub client or `gh` use, only systemctl at `:462`.
- **O8, "no orchestrator watchers were running":** partly refuted. 2 `beep-proof-*` monitor units, the burst-guard timer and a running `yeet` process are live. The context counted 3 monitors. The stale `wait-arm-{2210,2488,2508,2513,2523}.sh` files exist.
- **T3 PR sweeps "already ETag-revalidated":** refuted. In the t3code checkout (cdc947b03c), `revalidatedRestRead` has one caller, `getPullRequestStack` (`GitHubPullRequestApi.ts:2042`). The file has 44 GraphQL references, and GraphQL cannot be revalidated. Treat T3 sweeps as unrevalidated.
# GitHub API usage reduction plan: beep-effect fleet (2026-11-09)

**Basis.** This plan combines the four research passes in the task with a few local checks. I made no `gh` calls. The local checks confirmed four things:
- The poll intervals in source: the until-ready poll is 30 s (`MonitorLoop.ts:196`), the watch is 10 s (`Porcelain.ts:660`), the classic comment stream is 10 s (`MonitorComments.ts:62`), and the error budget is 5 (`MonitorPolicy.ts:97`).
- `packages/drivers/github` and `Yeet/internal/Status.ts` contain no ETag or `If-None-Match` handling.
- This clone has 3 remotes and no `remote.*.gh-resolved`.
- `HANDOFF.md:45` has the 2026-10-31 ruling: "never bridge the App token into yeet monitor".

**Tags.** **[doc]** means GitHub documents it. **[inferred]** and **[uncertain]** follow the research labels. **[est]** means a derived estimate, not a measurement.

---

## 1. Do GitHub Apps have the same problem?

### Quota: partly. Only installation tokens get their own bucket.

| Token type | Bucket | Size | Shared with kriegcloud's PATs and gh OAuth? |
|---|---|---|---|
| gh CLI OAuth, classic PAT, fine-grained PAT | per user | 5,000 REST/h; 5,000 GraphQL points/h | yes, this is the bucket that ran dry **[doc]** |
| **GitHub App user-to-server token** (App acting as kriegcloud) | **the user's bucket** | same 5,000 | **yes. It is pooled with the PATs and with every other app acting for that user. It is not a new bucket.** **[doc]** |
| OAuth app user token | the user's bucket | same 5,000 | yes **[doc]** |
| **GitHub App installation token** (beep-fleet-orchestrator, beep-reviewer) | **per installation** | 5,000 REST/h and 5,000 GraphQL points/h minimum | **no, it is separate** **[doc]**. The live measurement agrees: core 29/5000 on the App while the user bucket was empty. |
| `GITHUB_TOKEN` in Actions | per repository | 1,000/h (15,000/h for GHEC resources) | no **[doc]** |

**Scaling with repo count.**
- An installation gets +50/h per repository only above 20 repositories, and +50/h per org user only above 20 users. The cap is 12,500/h **[doc]**.
- beep-fleet-orchestrator is installed on 1 repo, so it sits at the flat 5,000/h minimum. Installing it on more repos adds nothing until there are more than 20.
- The 15,000/h REST and 10,000 GraphQL figures apply only if `beep-effect` is a GitHub Enterprise Cloud org. **The research did not establish this, so do not plan on it.**

**Implications.**
- Each App installation is its own bucket (per-installation is documented). beep-fleet-orchestrator and beep-reviewer therefore hold two independent 5,000/h buckets beside the user's. Counting them as extra headroom is **[inferred]** from the per-installation wording.
- **An App bucket is as small as the user's.** At current poll costs, 15 monitors would need roughly 7,200–12,600 REST/h **[est]**, which drains an App bucket just as fast. Moving traffic to the App splits the load across buckets but does not reduce it. Reducing calls (section 2) is still required.
- **Secondary limits:** 100 concurrent requests (REST and GraphQL combined), 900 points/min per REST endpoint, 2,000 points/min for GraphQL, and 80 content-creating requests/min (500/h). These are documented, but **who they are keyed to (user, token, app or installation) is [uncertain]**. Do not assume an App escapes the user's secondary limits.
- **Minting tokens:** GitHub documents a limit of 2,000 OAuth access-token requests/h per App. Whether installation-token mints count against it is **[uncertain]**. The shell scripts mint a new token on every call (item S8).

### Permissions: the same requirements, plus one thing only an App can do

| Need | User PAT or OAuth | GitHub App | Notes |
|---|---|---|---|
| `GET …/rulesets/{id}/history` | fine-grained PAT needs **Administration: write** | needs **Administration: write** (user-to-server and installation tokens) **[doc]** | Same requirement. The App's 403 is a missing grant, not an App limitation. |
| `GET …/rulesets/rule-suites` | Administration: **read** | Administration: **read** **[doc]** | A smaller grant that may cover completion evidence |
| `GET …/rulesets`, `GET …/rulesets/{id}` | Metadata: read | Metadata: read **[doc]** | No admin needed to read the current ruleset |
| Push or merge a PR that touches `.github/workflows/` | the user token works today | needs the **Workflows** permission, which the App lacks | From the task context and the 10-31 ruling, not from the research docs |
| **Create or update check runs** | **not possible** for OAuth apps or PATs (they can read only) | **App only** **[doc]** | Apps can do strictly more here |
| Read check runs on a private repo | classic PAT needs the `repo` scope | Checks: read | Read-only pollers on the App need contents, metadata, pull_requests, checks, actions and issues **read** only |

**Answer to (1).** The same problem exists if you use an App's **user-to-server** token, because that shares kriegcloud's bucket. Use the **installation** token instead. Each installation has its own 5,000/h bucket, and a 1-repo installation does not grow. The permission requirements match those of a fine-grained PAT. Checks write is the one area where only an App works. Moving read-only pollers to the App does **not** need Administration or Workflows. Only ruleset history (Administration: write) and merges of workflow-touching PRs (Workflows) would.

---

## 2. What reduces calls

### Where the calls go [est, from code reading; nothing traced live]

| Consumer | Cadence | REST/h | GraphQL/h | Bucket |
|---|---|---|---|---|
| `yeet monitor --until-ready` (each PR) | 30 s, 120 polls/h | 480 baseline; 720–840 in the review-window phase | 720–1,440 | user |
| `yeet monitor --watch` (each session) | 10 s | ~1,080 | 2,160–3,600 | user |
| classic `yeet monitor` comment stream | 10 s | ~1,080 | 360–720 | user |
| merge-gate loop (each armed PR) | 240 s | 200–250 | ~15–30 | App or user, depending on the script |
| gate poll (T3 task plus agent follow-ups) | 10 min (the skill text says 4 min) | 330–390 (825–975 at 4 min) | 30–75 | user |
| finals and health watchers (when armed) | 60 s / 300 s | ~0 | 60–80 queries | user |
| `ci lane-timings` window census | on demand | **1,000–3,000 in a few minutes** | 0 | user |
| T3 Code PR sweeps on 6 hosts | 1 to 5 min | **not measured** | not measured | user (already ETag-revalidated) |

**Sanity check.**
- 15 lanes × 480–600 REST/h ≈ 7,200–9,000 REST/h. That is 144–180% of 5,000, so the bucket empties in about 35–40 minutes, which fits the 21:31Z exhaustion.
- After the reset, 272 calls in 5 minutes ≈ 3,260/h. That is a single 5-minute sample, so treat it as an estimate. It equals about 4–7 monitors' worth of traffic.

### (a) Structural, ranked by user-bucket REST/h saved

| # | Change | Files | Saving [est] | Effort | Risk and flags |
|---|---|---|---|---|---|
| **S1** | **Run read-only pollers on the App installation token.** Set `BEEP_GH_APP_*` in the monitor's systemd unit environment and export `GH_TOKEN=<installation token>`, so the in-process client and the `gh` subprocesses both switch. Then do the same for gate-table and merge-gate reads. Keep the user token for merges that touch workflows and for ruleset history. | `Yeet/internal/ProofJobLauncher.ts` (unit environment), `internal/github/GithubIdentity.ts`, `internal/github/GhCommand.ts` (`ghOutput` and `runRepoCommandCapture('gh')` inject GH_TOKEN for read verbs), `Yeet/internal/GhOps.ts` | Moves 480–840 REST/h per monitor off the user bucket. With 3 live monitors that is 1,440–2,520 REST/h. **This splits load; it does not reduce it.** | **Low** | **Reverses the 2026-10-31 ruling**, so it needs a decision file. The ruling's reason, the missing Workflows permission, applies to merging, not to reading. The App bucket is also 5,000, so on its own this covers only about 6–10 monitors. |
| **S2** | **ETag and conditional-request layer** in the single octokit transport. A `hook.wrap('request')` for GET routes, keyed by identity, route and params, with an on-disk store under `~/.cache/beep/github/` shared across processes. Port T3's `revalidatedRestRead` (`t3code/packages/source-control-github/src/server/GitHubPullRequestApi.ts:1189`). Also add an immutable cache keyed by SHA or run id for completed check runs, run jobs and logs. | `packages/drivers/github/src/internal/octokit.ts` (`makeTransport`), `GitHubClient.ts` | Monitor: 3 comment reads per poll × 120 = **~360 REST/h per monitor** when nothing changed, plus 240–360/h of timeline and check-suite reads in the window phase. Gate-table: most of its ~45 REST per cycle. At 15 lanes that is roughly 5,000+ REST/h. | **Medium** | Authorized 304s do not count against the primary limit **[doc]**. Their effect on **secondary limits is [uncertain]**, and the App-specific exemption is **[inferred]**. ETags help only if the URL stays identical: a `since` watermark that moves every poll would defeat them **[inferred]**. GraphQL gets **no** 304 exemption **[inferred]**. Risk of bugs from stale cache entries. |
| **S3** | **Adaptive interval and sleep on rate limits.** Poll every 30 s for 2–3 polls after a push or state change, then every 90–120 s while checks are pending or only the review window remains. Read `x-ratelimit-remaining` and `-reset`, and sleep until the reset instead of spending the 5-error budget. Honor `retry-after` and `x-poll-interval`. | `Yeet/internal/MonitorLoop.ts` (`nextMonitorSleep`, L196), `MonitorPolicy.ts:97`, `drivers/github/src/Resilience.ts` | Moving from 30 s to an average of about 90 s gives 120 → ~40 polls/h, which cuts **~2/3 of whatever per-poll cost remains** (e.g. 480 → ~160 REST/h per monitor). This also prevents the retry storm: octokit retries 4 times per call, and the monitor dies after about 2.5 minutes of errors. | **Low–medium** | Merge-ready detection lags by up to one interval. That is acceptable against a 20-minute review window. |
| **S4** | **One GraphQL query per poll** replacing `gh pr view` + `gh pr checks` + `gh pr checks --required` + reviewThreads. Key it by PR number or node id after the first poll. Use `statusCheckRollup.contexts{… isRequired(pullRequestNumber:)}`, `reviewThreads`, head oid, `mergeStateStatus`, `reviewDecision` and `updatedAt`. Fetch `gh run list` only when a required check is red. | `Yeet/internal/Status.ts` (`collectRemoteStatus` ~L1174, `collectRemoteChecks` L687, `readRemotePullRequest` L1094, `collectRemoteReviewThreads` L775), `WatchMode.ts` | GraphQL per monitor: 720–1,440 → ~120–240 (6–12 queries per poll → 1). Dropping the per-poll run list saves **120 REST/h per monitor**. | **Medium** | The `KEEP (D-13)` markers protect gh's `bucket` field, which would have to be derived from status and conclusion. **Conflict between research passes:** the infra pass suggested moving these reads to REST. That would put load on core, the bucket that actually ran dry. Prefer the single GraphQL query. |
| **S5** | **One poller per PR, with a shared snapshot.** Make the ready-monitor lock keyed by PR, host-wide first and fleet-wide later. `--watch`, `ready`, `merge-gate`, `job wait` and the orchestrator scripts read `writeYeetStatusSnapshot` instead of GitHub. | `Yeet/internal/ProofJobLauncher.ts` (lock L83–89), `WatchMode.ts`, `ReadyGate.ts` (L545), `MergeGate.ts` | Each watch session that becomes a reader saves **~1,080 REST + 2,160–3,600 GraphQL per hour**. Every duplicate poller on a PR saves 480–840 REST/h. | Medium (host-wide); high (fleet-wide) | The snapshot can go stale. A dead poller must be detected before consumers fall back to their own polling. |
| **S6** | **Batch GraphQL across all open PRs** for gate-table and the finals and health watchers. One query covers drafts, mergeable state, head oid, threads, rollup, the READY_FOR_REVIEW and HEAD_REF_FORCE_PUSHED timeline items, and check-suite createdAt. `pr-health-watch.sh` already shows this shape costs about 2 points. | `Yeet/internal/GateTable.ts`, `ReviewWindow.ts`, `~/.cache/beep/orchestrator/bin/gh-{finals,health}-watch.sh`, `pr-health-watch.sh` | Gate-table goes from ~45 REST per cycle to 1 query of 2–5 points: **~330–390 REST/h saved at the 10-minute cadence**, 825–975 at 4 minutes. The three overlapping scanners become one query. | Medium | First/last on connections is capped at 1–100, so beyond 100 PRs or threads the query needs pagination. |
| **S7** | **Webhooks** (pull_request, review, review_thread, issue_comment, check_run, check_suite, workflow_run, status) delivered to a receiver on DankStation through a tunnel such as Tailscale Funnel or smee, feeding the existing inbox and dispatch files. | new receiver; App webhook config via the `beep github app` family (`commands/Github/Github.schemas.ts`) | Removes polling for event detection. Deliveries **are not documented as costing API quota** (the docs are silent, so this is **[inferred]**). | **High** | No receiver, signature check or redelivery exists today. Must reply within 10 s, be idempotent on `X-GitHub-Delivery`, and redeliver after downtime. **The interim `/repos/{o}/{r}/events` + ETag poller the infra pass suggested was not covered by the docs research, so it is [inferred]** and its latency is unverified. |
| **S8** | **Cache the App token** in the shell scripts and in the CLI's `GitHubApp` layer. Mint once per hour per host (0600 file under `$XDG_RUNTIME_DIR` or `~/.cache/beep`, refreshed about 5 minutes before expiry). | `~/.cache/beep/orchestrator/bin/{ghapp.sh,gh-app-token.sh}`, `packages/drivers/github/src/GitHubApp.ts` | One `check-then-arm.sh` mints ~120 tokens/h; caching brings that to 1/h. The main saving is **1Password reads** (1,000/h quota), plus whatever share of the 2,000/h token-request limit those mints use **[uncertain]**. | **Low** | A token file on disk must be mode 0600 and must stay out of logs. |
| **S9** | **REST budget guard** next to `GraphqlBudget`, with a ledger of the last `remaining` and `reset` per identity and resource, shared across the workstation. Pollers yield to one-shot commands below a floor, and large fan-outs check the budget first. | `internal/github/GraphqlBudget.ts`, `drivers/github/src/internal/octokit.ts` | Prevents exhaustion rather than cutting steady load. It also removes the 1-point `rateLimit` probe from each guarded GraphQL operation. | Medium | Reads one host only, so other hosts sharing the user bucket stay invisible unless the ledger reads `/rate_limit`. That call is free on the primary limit and counts on secondary **[doc]**. |

### (b) Code hotspots

| # | Hotspot | Change | Files | Saving [est] | Effort and risk |
|---|---|---|---|---|---|
| H1 | Monitor resolves the PR from the branch 3 times per poll | Cache the PR number and node id after the first poll | `Status.ts` | Part of S4 (2–4 GraphQL per poll) | Low |
| H2 | `gh` does a RepositoryNetwork lookup on each spawn (3 remotes, no `gh-resolved`) | Run `gh repo set-default beep-effect/beep-effect` in each clone, or pass `GH_REPO` / `--repo` | per-clone git config; `GhCommand.ts` | **Up to 4 GraphQL per poll, ≈ up to 480 GraphQL/h per monitor.** **[inferred]** from gh's known behaviour; confirm with `GH_DEBUG=api` on one read. | **Trivial.** Do this first. |
| H3 | `/pulls/{n}/reviews` has no `since` and returns the full list every poll; review comments are read over both REST and GraphQL threads | Use ETags (S2); skip comment and thread reads when `updatedAt` and the head SHA are unchanged | `MonitorComments.ts` (L1112), `Converge.ts` (L487) | 120–240 REST/h per monitor | Low–medium. Make sure the comment watermark still advances correctly. |
| H4 | `collectRemoteStatus` rebuilds the GitHub client on every poll (spawning `gh auth token`, or minting an App token) | Reuse the loop's `makeYeetGhLoginOnce` | `Status.ts`, `GhOps.ts` (~L700) | One spawn or mint per poll (120/h) | Low |
| H5 | During closeout-pending, `collectYeetStatus` runs twice in the same poll | Reuse the first read | `MonitorLoop.ts` (L2021) | One full poll's cost per closeout poll | Low |
| H6 | merge-gate reads everything on every attempt | Read `pulls/{n}` and head check runs first, and return on a pending or window hold. Memoize the squash verdict, commits, window anchors and base evidence per head SHA. Compare against base only when a red check is present. Sleep until max(window end, expected check completion). Pass the already-read pull into `readSquashCommitlint`. | `MergeGate.ts` (L1218, ~L1275–1325), `SquashCommitlint.ts` (L793–940), `ReviewWindow.ts`, `merge-gate-loop5*-app.sh` | 13–17 → ~2–3 REST per held attempt, × 15/h = **~150–210 REST/h per armed PR** | Low–medium. Risk: a stale memo after a force-push, so key it strictly by SHA. |
| H7 | Census commands refetch completed runs, jobs and logs | Immutable cache by run id and attempt; check the budget before starting; run under the App identity or as a `workflow_dispatch` job (which uses GITHUB_TOKEN's separate bucket) | `Ci/LaneTimings.ts` (~L830), `Ci/CiPartitions.service.ts`, `Ci/RouteCorpus.ts` | Repeat censuses drop from **1,000–3,000** calls to near 0 | Low–medium |
| H8 | `goals completion refresh` pages through rule-suites with `time_period=month` (~12 pages) | Use `time_period=day` around the merge timestamp; cache per merge SHA | `Goals/CompletionEvidence.ts`, `Completion.ts` (L1286) | ~10 REST per goal per refresh; a few hundred per sweep without `--slug` | Low |
| H9 | About 25–30 raw `gh` spawns in about 16 files bypass the shared client's identity, rate-limit handling and ETags | Short term: inject GH_TOKEN in `ghOutput`. Long term: finish moving them to `GithubRest` | `Status.ts`, `WatchMode.ts`, `Settle.ts`, `ReadyGate.ts`, `Planner.ts`, `Research/Library/Library.github.ts`, … | Covered by S1 and S4 | Medium |
| H10 | `ReadyGate` reads the full status again right after the monitor read it | Accept the monitor snapshot if its head SHA matches and it is younger than N seconds | `ReadyGate.ts` (L545, L603, L859–960) | ~20–27 calls per invocation; a few hundred per hour fleet-wide at most | Low |

### (c) Operational. No code changes; do these now.

| # | Action | Saving [est] | Risk |
|---|---|---|---|
| O1 | Run `gh repo set-default beep-effect/beep-effect` in every clone on all six hosts, then verify with `GH_DEBUG=api` (same as H2) | up to ~480 GraphQL/h per monitor **[inferred]** | none |
| O2 | **Never run `--watch` or the classic monitor while a detached `--until-ready` job holds the same PR.** Use `yeet job wait`, which makes 0 GitHub calls. | 1,080 REST + 2,160–3,600 GraphQL per avoided watch-hour | none |
| O3 | **Cap concurrent detached monitors** until S2–S4 land. At 480–840 REST/h each, the user bucket holds only about 5 while leaving room for gate-table, merges and agents (5 × 600 ≈ 3,000 REST/h). Treat this cap as an estimate. After S1, the App bucket holds about 5 more. | Keeps the user bucket under 5,000 | Slower lanes |
| O4 | Move the finals watcher from 60 s to 180 s and onto `ghapp.sh` (it uses the user token today) | ~40 of its ~60 GraphQL/h, the rest moved to the App | Finals are detected later. They arrive a few times a day. |
| O5 | Fix the orchestrate skill's 4-minute gate cadence to match the live 10 minutes (or go event-driven) | Avoids 825–975 instead of 330–390 REST/h if someone follows the documented 4-minute rate | none |
| O6 | Run census commands (`ci lane-timings` window mode, `partitions rebalance`) under the App identity or in Actions, never during busy lane hours | 1,000–3,000 per census taken off the user bucket | none |
| O7 | Measure T3 Code's per-host PR sweeps (6 hosts on one user). Sample `x-ratelimit-used` deltas with the monitors stopped. | unknown. It is the main unmeasured consumer. | `/rate_limit` is free on the primary limit and counts on secondary |
| O8 | No orchestrator watchers were running at audit time. Delete the stale `wait-arm-<pr>.sh` copies so they are not re-armed by mistake. | Prevents duplicate loops | none |

### Recommended order

1. **Today, trivial:** O1/H2, O2, O3, O8.
2. **Low effort, large effect:** S1 (record a decision that reverses the 10-31 ruling for read-only identity), S3, S8, H4, H6.
3. **Medium effort, the real reduction:** S2 (ETag layer in `makeTransport`), S4 (single GraphQL query per poll), S5 (one poller per PR, shared snapshot), S6 (gate batch query), H7.
4. **High effort, removes polling:** S7 (webhooks into the existing inbox).

Combined estimate per monitor-hour **[est]**: S3 + S4 + S2 together take a monitor from about 480–840 REST and 720–1,440 GraphQL down to about 40 GraphQL and under 60 REST. The research gives an 85–90% reduction. At 15 lanes that is roughly 1,800 GraphQL and under 900 REST per hour, comfortably inside one bucket even before S1 splits the load.

### Which claims rest on [inferred] or [uncertain] facts

- **[uncertain]** Who secondary limits are keyed to, so whether the App escapes the user's concurrency and points-per-minute limits.
- **[uncertain]** Whether installation-token mints count against the 2,000/h token-request limit.
- **[inferred]** 304s are free for Apps too, and ETags survive `since` parameters that stay unchanged.
- **[inferred]** GraphQL has no 304 path.
- **[inferred]** Webhook deliveries cost no API quota.
- **[inferred]** gh adds a RepositoryNetwork query per spawn. It was not traced, because the quota was off-limits for this study.
- **[inferred]** The events-API interim poller in S7.
- Every per-call count comes from reading the code, not from a live trace, and assumes at most 100 rollup contexts and threads per PR.
- The GHEC status of the `beep-effect` org is unknown, so the 15,000/h figures are not assumed.
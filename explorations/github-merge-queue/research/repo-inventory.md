# Repo inventory: what a `merge_group` event would meet (read-only lane)

Checkout: worktree `merge-queue-research` at `b730601053f` (origin/main, 2026-11-09). Method: file reads
and ripgrep only. Nothing was run. Each claim cites `path:line`. GitHub-side behaviour (what the
queue does with commit messages, REST merges, ejection timing) belongs to the sibling
`github-semantics.md`. This file marks those points **[semantics]** and does not settle them.

Baseline search: `rg -n 'merge_group|gh-readonly-queue|merge_queue|mergeQueue' packages .github .claude scripts`.
The only code hits are `HeavyAdmission.ts`, `CiAdmission.ts` and `ci-heavy-admission.test.ts`. No
workflow lists `merge_group` under `on:`. `check.yml:3-10` triggers on `pull_request` and `push` only.

## A. Workflow event contract

All 15 required contexts come from `check.yml` or from `heavy.yml@main`, which it calls at
`check.yml:214`. No other workflow defines a job with one of these names (search:
`rg -n '^\s+name: (Lint|Check|Test Unit|…|JSDoc Ratchet)$' .github/workflows/*.yml`). One trigger
line in `check.yml` is enough to make every context report on a queue SHA. Every row below assumes
that line exists and nothing else changes.

### A1. Required contexts under an unmodified `merge_group` run

Legend: **runs** = executes with push shape (full, unscoped); **degraded** = executes but proves
less than on a PR; **skips** = reports skipped. No row fails outright.

| Context | Job (aggregate ← shards) | `if:` | Runner | Under `merge_group` |
| --- | --- | --- | --- | --- |
| Lint | `lint` ← `lint-shard`×2 `check.yml:695-711`, `:583-595` | `!cancelled()` / `docs_only != 'true'` | ubuntu-24.04 | **runs**, full. No `--affected`, because shape args are PR-only (`:663-667`). Wasteful. |
| Heavy / Check | `heavy.yml` `check` `:331-345` via `check.yml:203-221` | `inputs.admitted && …` (`heavy.yml:333`) | beep-ec2-heavy (`:334`) | **runs**, full. Admission returns `run` with source `merge-group` (`HeavyAdmission.ts:323`). No affected shape (`heavy.yml:266-268`). |
| Test Unit | `test-unit` ← `test-unit-shard` `check.yml:969-991`, `:812-824` | `!cancelled()` / `docs_only != 'true' && plan != '[]'` | ubuntu-24.04 | **runs** all 30 partitions. A non-PR plan is the full list (`:790-792`), with no `--affected` (`:907-911`). Wasteful. |
| Heavy / Test Integration | `test-integration` aggregate `check.yml:1124-1146` ← 20 shards `:1001-1013` | `!cancelled()` | ubuntu-24.04 | **runs** all 20 partitions (`:790-792`, `:1084-1088`). The name comes from `legacy_integration`, which `:140-168` computes for any event. |
| Heavy / Docgen | `heavy.yml` `docgen` `:351-365` | `inputs.admitted && …` | beep-ec2-heavy | **runs** `--mode full` (`:284-289`). The PR cache restore (`:211-220`) and the push cache save (`:298-304`) are both skipped. Cold and wasteful. |
| Codegen Drift | `codegen` `check.yml:427-438` (`*verification-steps`) | `docs_only != 'true'` | ubuntu-24.04 | **runs**. The path gate is PR-only (`:274-284`). |
| Repo Sanity | `verify` `check.yml:225-399` | none | ubuntu-24.04 | **runs** without `--changeset-status` (`:373-377`). The goals-only skip never fires (see A2). |
| Commitlint | `commitlint` `check.yml:1777-1891` | none | ubuntu-24.04 | **degraded**. No `pull_request` payload and no `event.before`, so `mode=last` (`:1815-1822`) lints only the HEAD commit of the queue ref. Whether that commit carries the squash message GitHub will land is **[semantics]**. |
| Secret Scanning | `secrets` `check.yml:1893-2019` | none | ubuntu-24.04 | **degraded**. `log_opts="-1"` scans only HEAD (`:1935-1960`). The base-pinned `.gitleaks.toml` and `.gitleaksignore` hardening is PR-only (`:1937-1957`), so the scan runs with the queue ref's own (PR-controlled) config. |
| Security | `security` `check.yml:2021-2075` | none | ubuntu-24.04 | **degraded**. OSV and the ruleset/settings/held-group checks run (`:2043-2075`). Dependency review is PR-only (`:2058-2065`). |
| SAST | `sast` `check.yml:2141-2188` | none | ubuntu-24.04 | **runs** normally. No event branch reaches the scan. |
| Nix Shell | `nix` `check.yml:2077-2139` | `docs_only != 'true'` | ubuntu-24.04 | **runs** on every entry. The path gate is PR-only (`:2108-2113`). Wasteful. |
| Professional Desktop IPC Stdio | `professional-desktop-ipc-stdio` `check.yml:1290-1405` | `docs_only != 'true'` | ubuntu-24.04 | **runs** with the full cargo check and clippy. The path gate is PR-only (`:1328-1337`), and `desktop_rust_relevant=true` comes from the full profile (`CiOperational.service.ts:76`). Wasteful. |
| Heavy / Doctest | `heavy.yml` `doctest` `:367-381` | `inputs.admitted && …` | beep-ec2-heavy | **runs** full (`:291-292`). |
| JSDoc Ratchet | `jsdoc-ratchet` `check.yml:1696-1775` | `docs_only != 'true'` | ubuntu-24.04 | **runs**. The docs-only skip never fires (`:1728-1731`). |

Non-required jobs that also run per entry:
- `Heavy / Lint Policy` and `Heavy / Build` on EC2 (`heavy.yml:102-118`, `:385-399`).
- Labs, Property Laws ×2, Fallow Advisory, Ecosystem, Shadcn Lint.
- Coverage Regression. On a non-PR run it compares against `github.sha`, its own head (`check.yml:22`, `:1280-1284`).

`pr-size` (`:57`) and "Cancel superseded Heavy Admit runs" (`:175`) are skipped. One unmodified
queue entry therefore costs a full push-shape `Check` run: about 50 hosted test shards plus 5 EC2
heavy lanes. The plan comment already records that 47 shard jobs once queued behind the org's
concurrent hosted-job limit (`check.yml:713-722`).

### A2. Event-reading expressions in `check.yml` and `heavy.yml`

`github.event.pull_request.*` evaluates to empty under `merge_group`, and
`github.event_name == 'pull_request'` is false. So every group below takes its non-PR branch.

| Group | Sites | `merge_group` behaves like | Outcome |
| --- | --- | --- | --- |
| Pinned diff for change-profile | env `BEEP_CI_PR_BASE_SHA/HEAD_SHA` from `pull_request.base/head.sha` (`check.yml:24-25`, `heavy.yml:98-99`). The CLI diffs only when `event === "pull_request"` (`CiOperational.service.ts:220-223`), else `fullProfile` (`:76`, `:225-227`). | push | **safe but wasteful**: docs-only and goals-only diffs get a full run. |
| Heavy admission | docs step needs `pull_request.head.repo.full_name` (`check.yml:105`). Fetching the base is PR-only (`:121`). The CLI admits on the event name (`HeavyAdmission.ts:319-333`), and `docsOnly` is PR-only (`:377-382`). | its own branch (`merge-group`) | **safe and wasteful**: always `run`, never `skip-satisfied`. |
| Trusted heavy resolution | `uses: …/heavy.yml@main` (`check.yml:214`). The `referenced_workflows` jq requires `ref == refs/heads/main` (`:148-149`). | neither (event-agnostic) | **safe**. See A4. |
| Verification route | `route_skips` are honoured only on `pull_request` (`heavy.yml:154`). `readHeavyAdmissionRoute` returns `route-not-applicable` for any other event (`HeavyAdmission.ts:633-635`). | push | **wasteful**. |
| Commitlint range | `event.before` and `pull_request.base.ref/head.sha` (`check.yml:1795-1797`). Branch selection at `:1805-1822`. | neither (falls to `--last`) | **degraded**. See A1. |
| Gitleaks range and config | `event.before` (`:1931`). The PR branch at `:1937-1957` pins the base config. | neither (`-1`) | **degraded**, with a weaker config. |
| Coverage base SHA | `BEEP_COVERAGE_BASE_SHA = pull_request.base.sha \|\| github.sha` (`check.yml:22`). Used at `:536`, `:773`, `:907`, `:1280`. | push | **vacuous** for coverage: it compares the queue SHA with itself. Not required. |
| Test planning, partitions, affected scope | Plan steps are PR-only (`:738-779`). Publish uses all partitions on non-PR (`:790-792`). `--affected` is PR-only at `:537`, `:664`, `:908`, `:1085`, `:1488`, `heavy.yml:266`. | push | **wasteful**. |
| Base fetch and path gates | 13 "Fetch pull request base" steps (`check.yml:121`, `:244`, `:462`, `:605`, `:746`, `:834`, `:1023`, `:1169`, `:1306`, `:1439`, `:1714`, `:1912`, `:2094`, `heavy.yml:128`). Lane path gates for codegen (`:274`), ecosystem (`:288`), labs (`:482`), desktop (`:1328`) and nix (`:2108`). | push | **wasteful**. |
| Turbo cache credentials and `turbo-cache-write` | `environment:` push-only (`check.yml:450`, `:589`, `:818`, `:1007`, `:1423`, `:1553`, `:1702`; `heavy.yml:109`, `:336`, `:356`, `:372`, `:390`). `turbo-token` push-only (`check.yml:503`). R2 write keys need `push && ref == refs/heads/main`; R2 read keys apply when `event_name != 'push'` (`:508-509`). | pull_request | **safe**: read-only cache, no writer environment. |
| Push-only app secrets | `DATABASE_URL` … `LIVEBLOCKS_SECRET_KEY` are push-only (`check.yml:307-314`, `:510-517`, `heavy.yml:200-207`). | pull_request | **safe**. These lanes already pass on PRs without them. |
| Docgen PR-vs-push | Docgen path gate (`heavy.yml:171-180`), cache restore (`:212`), lane mode (`:285-289`), cache save (`:299`). | push for the mode, neither for the cache | **wasteful**: full and cold. |
| PR-only steps | `pr-size` (`check.yml:57`), cancel-superseded (`:175`), dependency review (`:2059`), `--changeset-status` (`:373`). | n/a | Skipped, so dependency review is lost. |
| Trusted-summary upload | `github.event_name == 'push'` (`check.yml:382`, `:563`, `:675`, `:946`, `:1096`, `:1507`; `heavy.yml:311`). | pull_request | **safe** (no upload). |
| Fallow base | `BEFORE_SHA`, else `HEAD~1` (`check.yml:1567-1582`). | push-without-before | Not required. Base is `HEAD~1`. |

### A3. Concurrency groups

| Workflow | Group | Effect of a `refs/heads/gh-readonly-queue/main/pr-N-<sha>` ref |
| --- | --- | --- |
| `check.yml:12-14` | `Check-${{ github.ref }}`, cancel only on `pull_request` | One group per queue entry, never cancelled by a later entry. A group GitHub drops keeps running until something cancels it **[semantics]**. `workflow-lint` permits only `false` or the PR-only expression (`CiGovernance.ts:389-390`). |
| `heavy.yml` | none (it is reusable) | Runs inside the caller's run. |
| `heavy-admit.yml:25-27` | `heavy-admit-<ref>-<isAdmissionLabel>` | Never triggered: `pull_request` `labeled` only (`:14-17`). |
| `rerun-runner-loss.yml:142-144` | per `workflow_run.id` | Fires on merge-group Check completions, then declines them (D). |
| `job-context-contract-pr.yml` | none | `pull_request` with paths only (`job-context-contract-pr.yml:3-10`); not required. |

### A4. The `Heavy / *` trust chain

`check.yml:214` and `heavy-admit.yml:105` call `beep-effect/beep-effect/.github/workflows/heavy.yml@main`
with `secrets: inherit`. `admitted` is set to `verdict == 'run'` (`check.yml:217`). The admission job
then confirms through the run's `referenced_workflows` that exactly one Heavy resolved to
`refs/heads/main` (`check.yml:148-150`). That resolution reads nothing from a pull request or a push.

The EC2 runner group restricts which workflow definitions may run on it to `heavy.yml@main`
(`heavy.yml:401-402`, `docs/runbooks/ci-hosted-settings.md:11`). A dispatch from a feature ref
"reach[es] the controller queue yet remain[s] ineligible" (`docs/runbooks/aws-cost-operations.md:593-597`).
A `merge_group` caller runs from the queue ref, but the leaf it calls is still `heavy.yml@main`. It
should therefore be admitted. No probe has proven this. **Unproven, probe first.**

The producer jobs require `workflow_dispatch` on main (`heavy.yml:405-411`, `:506-512`, `:707-714`,
`:893-899`) and are input-gated off for quality callers.

## B. CLI admission and classification

What already handles `merge_group`:
- **Schema:** `HeavyAdmissionEventName` includes `merge_group` (`HeavyAdmission.ts:174`).
  `HeavyAdmissionSource` includes `merge-group` (`:107`).
- **Decision:** `sourcesFor` maps `merge_group` to `merge-group` (`:323`). `readHeavyAdmissionEvent`
  returns a bare event with no payload read and no git call (`:580-582`). The route returns
  `route-not-applicable` (`:633-635`). `ci admission` accepts the event (`CiAdmission.ts:144-150`).
- **Tests:** decision rows for `merge_group` with and without the label, draft and docs flags, all
  `run` (`ci-heavy-admission.test.ts:157-158`). No payload or git spawn for push and `merge_group`
  (`:436-441`). "merge groups never route" (`:724-730`).

That is the whole of it: `merge_group` currently means "admit everything, skip nothing".

Inputs each command needs that a merge-group payload lacks or names differently:

| Command | Reads today | Merge-group equivalent |
| --- | --- | --- |
| `beep ci change-profile` (`CiBootstrap.command.ts:43-53`) | `BEEP_CI_PR_BASE_SHA/HEAD_SHA` and `GITHUB_EVENT_NAME == pull_request` (`CiOperational.service.ts:212-223`) | `merge_group.base_sha` / `head_sha`. The workflow env (`check.yml:24-25`) **and** the event guard (`:221`) both need widening. |
| `beep ci admission` | `GITHUB_EVENT_PATH` decoded as `GhPullRequestEventPayload` (`HeavyAdmission.ts:440-452`, `:583-596`). Diff against `origin/<pull_request.base.ref>` (`:597-598`). | `merge_group.base_ref` is `refs/heads/main`, not `main`, and `branchOfBase` strips only `origin/` (`:495`). No payload schema exists for `merge_group`. |
| Verification route | merge-base of `origin/<branch>` and HEAD, then `ChangeClassifier.classify(base, head)` (`HeavyAdmission.ts:641-649`) | The classifier takes any base/head pair (`ClassifyInput`, `:649`), so `base_sha..HEAD` fits. Only the guard at `:633` blocks it. |
| Lane flags (`--affected --base <ref>`, `--plan-partitions`) | event-agnostic flags (`CiLane.ts:395-397`). The workflow picks `origin/${GITHUB_BASE_REF}` | Pass `--base "$MERGE_GROUP_BASE_SHA"`. `GITHUB_BASE_REF` is empty, so the workflow falls back to `main` via `${GITHUB_BASE_REF:-main}`. |
| `CiPartitions*`, `Route*` | No event reads (search: `rg 'GITHUB_EVENT_NAME\|pull_request\|GITHUB_BASE_REF' Route*.ts CiPartitions*.ts CiLane*.ts` → only a doc example at `Route.schemas.ts:547`) | Nothing to change. |

**Can a docs-only or goals-only verdict come from a base/head SHA pair alone? Yes.**
`classifyChangedPaths` is a pure function of a path list (`CiOperational.service.ts:86-97`). The
patterns are the checkout's own JSON (`CiOperational.patterns.json:1-6`, read at
`CiOperational.service.ts:183-204`). The diff is `git diff --name-only --no-renames base...head`
(`:205-209`).

For a queue entry, `base_sha...head_sha` covers this PR plus every PR queued ahead of it, measured
from the main tip, which is the correct set to classify. The admission `docsOnly` also needs a
non-PR branch (`HeavyAdmission.ts:377-382`), which is about S effort. A fork-repo check is irrelevant
for `merge_group`.

## C. The Yeet merge path

**The call.** Three commands merge, all through `GithubRest.mergePullRequest`, which is
`PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge` with `sha`, `merge_method` and optional
`commit_title`/`commit_message` (`internal/github/GithubRest.ts:599-621`):
- `yeet merge-gate <pr> <sha>`: squash, pinned `sha`, with an explicit `commitTitle` and
  `commitMessage` equal to the linted prediction (`MergeGate.ts:1415-1423`). It errors if
  `!result.merged` (`:1424-1429`).
- `yeet merge`: squash, pinned head, no message (`Merge.ts:224-235`). It then polls 10×3 s for
  `MERGED` (`:84-87`, `:236-238`) and runs `executeSweep` (`:327-331`).
- `yeet gh merge <n> --sha`: squash, with title `<title> (#n)` and a folded body
  (`GhOps.ts:1447-1460`).
- `OwnerCheckpoint.merge.ts:128-130` holds the same squash PUT. Its header says no command, endpoint
  or App registers it (`:1-5`).

No GraphQL merge, enqueue or auto-merge path exists in Yeet. The driver `@beep/github` has
`enablePullRequestAutoMerge`/`disable` and `setAutoMerge` (`drivers/github/src/PullRequest.ts:206-223`,
`:979-981`), but nothing outside its tests calls them (search: `rg 'setAutoMerge|enableAutoMerge'
packages apps --glob '!**/test/**'`). `enqueuePullRequest`: NOT FOUND (same search).

**Who may call it.**
- Owners, or the orchestrator for any PR (`AGENTS.md:183-188`).
- `yeet merge` is "an explicitly-run, operator-authorized action" that no loop may reach
  (`Merge.ts:15-18`, `:256-257`).
- `merge-gate` takes any PR number and never sweeps (`MergeGate.ts:1685-1688`).
- Both first run `enforceReviewerGate` (`Merge.ts:319-322`, `MergeGate.ts:1411-1414`):
  - a workstation-local merge reservation (`~/.local/state/beep/merge-reservations`, `ReviewerRuleset.ts:482-497`);
  - the `beep-reviewer` App check on the exact head and base (`:510-522`, `:547-550`).

**Credential.** `provideYeetGhLogin` tries `BEEP_GH_TOKEN_REF`, then the GitHub App, then the gh
login (`GhOps.ts:673-675`, `:716-717`, `:745-756`). Admin or bypass merge: NOT FOUND (search:
`rg -i '"--admin"|adminMerge|bypass_mode|current_user_can_bypass' packages/tooling/tool/cli/src packages/drivers`).

**Gate order** (`MergeGate.ts:1095-1112`, documented at `:1038-1045`):
1. Structural (`:740-760`): head moved, draft, `owner-merge-hold`, `mergeable_state == dirty`.
2. Squash commitlint (`:764-770`). The read predicts GitHub's default squash from
   `squash_merge_commit_title/message` and the PR commits, then lints it (`:1300-1303`,
   `SquashCommitlint.ts:2-15`, `:58-95`).
3. Required contexts from the ruleset (`:784-800`) and checks (`:804-831`).
4. Review window (`:1004-1018`): 20 min since the later of ready and the last push
   (`GhOps.ts:99`, `AGENTS.md:303-309`).
5. Threads: GraphQL, all pages, unreadable means hold (`:1020-1031`, `:1283-1287`).

**S11 path.** `--relaxed` (`MergeGate.ts:32-45`, `:1107-1108`):
- Pending checks and inherited reds pass.
- A PR-introduced required red holds as `own-red` (`:889-933`), unless the PR carries `unblocks-main` (`:902`).
- After the merge it posts a comment and cancels the merged head's active runs (`:1596-1601`, `:1500-1523`).
- Every merge broadcasts to packet siblings using the new merge SHA (`:1602-1605`).

**Places that assume a synchronous merge, or a PR that is either OPEN or MERGED:**

| Site | Assumption | What a queued state breaks |
| --- | --- | --- |
| `MergeGate.ts:1424-1435` | The PUT returns `merged` and a `mergeSha` | Enqueueing returns no SHA. `MergeGateMerged` and the merge line cannot be built. |
| `MergeGate.ts:1596-1605` | Post-merge actions run in-line | The S11 comment, cancelling runs and the sibling broadcast need a merged-event trigger, not the gate process. |
| `Merge.ts:165-188`, `:236-238` | `MERGED` within ~30 s | An enqueued PR reads `OPEN`, so `yeet merge` errors and never sweeps. |
| `GhOps.ts:1461-1465` | `merged=` printed at once | Same as `yeet merge`. |
| `MonitorPolicy.ts:131-139` | Terminal states are `merged`, `closed`, `ready`, `ready-pending-flip`, `wave`, `settle-timeout`, `poll-error-budget` | No `enqueued`, `ejected` or `merging` state. |
| `MonitorLoop.ts:955-962` | Terminal only on `MERGED`/`CLOSED` | Queued or ejected PRs read `OPEN`. The loop polls on, and an ejected PR re-reads `ready` with its reason never surfaced. |
| `MonitorPolicy.ts:422-428` | `ready` means "re-read the review threads, then merge" | Needs to mean "enqueue". |
| `Settle.schemas.ts:107-118` | Settle reasons are `registration`, `required-pending`, `heavy-not-admitted`, `closeout-pending` | Queue checks run on another SHA, so the settle census never sees them. |
| `MergeReadiness.policy.ts:81` | `BEHIND` is acceptable (strict false) | Unchanged. How the PR's `mergeStateStatus` reads while queued is **[semantics]**. |
| `Retire.ts:83-94`, `Sweep.ts:300` | Retire and done gate on `MERGED` | Safe: a queued lane is refused, as it should be. The owner must wait asynchronously for the queue. |
| `Session.schemas.ts:36` | Ledger states are `open`, `blocked`, `done` | No `queued` state. A queued lane reads as `open` with nothing to do. |
| `Inbox.ts:486-500`, `Ack.ts:286` | Base-conflict rows come from the PR's own `mergeable`/`mergeStateStatus` | A conflict with a queued predecessor shows up only as an ejection, and no row kind exists for it. |
| `CompletionEvidence.ts:362-387`, `:395-415` | Required checks bind to the accepted PR head before `mergedAt`. The rule suite is found by `after_sha == mergeCommit` | Works while PR-level required checks still run. Whether queue pushes produce a rule suite is **[semantics]**. S11-accepted heads disappear. |

## D. Red-handling machinery

- **`unblocks-main`.** The only consumers are merge-gate's `own-red` exemption and its attribution
  (`MergeGate.ts:323`, `:851`, `:902`, `:950-951`), plus the orchestrate procedure
  (`.claude/skills/orchestrate/SKILL.md:255`). Under a queue, required reds cannot reach main through
  merges. Main can still go red from flakes, environment or a post-merge-only lane.
- **`yeet gh checks cancel-queued`** (`Gh.command.ts:116-122`). It cancels runs whose
  `head_sha == pr.headSha` (`GhOps.ts:1682-1690`). It never touches a merge-group run, whose head is
  the queue SHA. The "queue starved" remedy (`orchestrate/SKILL.md:261`) would miss the largest
  consumer.
- **Base-conflict rows.** See C. The doctrine's "merge main now" (`AGENTS.md:203-205`) still applies
  to true PR-versus-main conflicts.
- **Inherited-red attribution.** `own-red` compares against the latest base-commit check runs on the
  merge base and the base tip (`MergeGate.ts:858-887`, `:1304`). Main pushes keep running Check, so
  the evidence survives. S11's purpose largely goes away (E).
- **Runner-loss rerun.**
  - `rerun-runner-loss.yml` fires on any completed `Check` or `Heavy Admit` run with conclusion
    `failure` (`:134-137`, `:151-153`).
  - The CLI head gate supports `pull_request` and `push` only. Any other event returns
    `unsupported-event`, rendered "only pull_request and push runs are re-run"
    (`CiRerunRunnerLoss.ts:356-363`, `RunnerLossRerun.ts:783`).
  - A lost EC2 runner surfaces as a failure 9 to 10 minutes later (`rerun-runner-loss.yml:115-118`),
    and the workflow waits for the whole run to finish.
  - So a Spot eviction during a queue build means an ejection, never an automatic rerun. A rerun
    would come too late in any case: the queue reacts to the failed check, not to run completion
    **[semantics]**.
  - Spot evictions on the heavy runners were observed on 2026-11-09 (Integration has since moved
    off EC2, `heavy.yml:347-349`). Check, Docgen and Doctest are still on Spot EC2.

## E. Doctrine

| Rule (short quote) | Source | Under a queue |
| --- | --- | --- |
| "Keep the `main` merge queue disabled … Before any queue activation, add and prove `merge_group` parity for all required contexts" | `standards/architecture/DECISIONS.md:1747-1751` | **UNCHANGED** gate. It still governs, and its rationale cites 17 contexts where today has 15 (`:1757`). |
| S11: "may merge over failing jobs, required ones included" | `AGENTS.md:311-315`; `orchestrate/SKILL.md:286-311` | **CONTRADICTED**. The queue requires the required contexts green on the group SHA. Only a bypass actor could merge over them, and none exists (C). |
| "the gate merges finals one at a time as they arrive, telling the remaining siblings to merge main between merges" | `AGENTS.md:206-210`; `orchestrate/SKILL.md:253` | **REDUNDANT**. The queue serializes and tests each entry on top of its predecessors, and "merge main between merges" becomes the queue's rebuild. The sibling broadcast (`MergeGate.ts:1602-1605`) drops to advisory. |
| "at most three concurrently open PRs" per packet | `AGENTS.md:206-207` | **UNCHANGED**. The cap is about review and conflict load, not merge order. |
| Unblocker: "one consolidated unblocker per red episode … cancels runs … so the unblocker gets runners and merges first" | `AGENTS.md:198-202` | **CONTRADICTED** in mechanism. The queue is FIFO, so "merges first" needs a jump-to-front **[semantics]**, and `cancel-queued` misses queue runs (D). |
| Review window: "at least 20 minutes … since the later of … ready … and the latest push" | `AGENTS.md:303-309` | **UNCHANGED**. The queue does not enforce it, so enqueue must stay gated by `merge-gate`, or the window needs a required check. |
| Squash message "passes the repo's commitlint (`yeet merge-gate` predicts it …)" | `AGENTS.md:296-302` | **UNCHANGED** rule. Mechanism at risk: merge-gate sends an explicit title and body (`MergeGate.ts:1419-1420`). Whether an enqueue can carry them is **[semantics]**. If not, the prediction must match the queue's composition exactly. |
| "Whoever merges re-reads the review threads immediately before merging" | `AGENTS.md:186-188` | **CONTRADICTED** in timing. The merge happens minutes after enqueue, so "immediately before" becomes "before enqueue". |
| `yeet merge` "merges, confirms `MERGED` by bounded poll"; "the merge never auto-runs" | `.claude/skills/yeet/references/merge-loop.md:47-49` | **CONTRADICTED** (the poll). The no-auto-run rule is **UNCHANGED**. |
| Local merged-tree proof (`yeet verify --merged`) | `MergedPreview.ts:2-23` | **REDUNDANT** for the base-plus-queue tree. The hosted group run is that proof. It stays useful as a pre-push local check. |
| Merge reservation helper | `ReviewerRuleset.ts:482-497` | **REDUNDANT**. The queue serializes merges. |

## F. Work a merge queue would require, by file

| # | File | Change | Size |
| --- | --- | --- | --- |
| 1 | `.github/workflows/check.yml` | Add `merge_group: types: [checks_requested]`. Widen `BEEP_CI_PR_BASE/HEAD_SHA` and `BEEP_COVERAGE_BASE_SHA` with `merge_group.base_sha`/`head_sha`. Give each of about 30 `event_name == 'pull_request'` scoping sites (base fetch, path gates, `--affected`, test plan) a merge-group arm using `base_sha`. | M (~150-250) |
| 2 | `check.yml` Commitlint and Secret Scanning | Explicit merge-group ranges (`base_sha..head_sha`) and the base-pinned gitleaks config at `base_sha`. | S to M |
| 3 | `check.yml` Security | Dependency review on `base_sha..head_sha`, or a recorded decision that the PR-level run suffices. | S |
| 4 | `.github/workflows/heavy.yml` (`@main`) | Merge-group arms for route skips, docgen mode, affected shape and cache restore. Two-step rollout: a PR proves the previous main version, followed by a post-merge Heavy probe (`docs/runbooks/ci-hosted-settings.md:11-16`). | M |
| 5 | `CiOperational.service.ts:220-224` | Accept `merge_group` in the change-profile guard. | S |
| 6 | `HeavyAdmission.ts` / `CiAdmission.ts` + tests | `docsOnly` for `merge_group` from a base/head diff, a `merge_group` payload schema (`base_sha`, `head_sha`, `base_ref` as `refs/heads/…`), and an optional route. Test rows at `ci-heavy-admission.test.ts:157-158`, `:436-441`, `:724-730` change. | M |
| 7 | `CiRerunRunnerLoss.ts` / `RunnerLossRerun.ts` | Decide: re-enqueue an ejected PR after runner loss, or record `unsupported-event` as intended. | S to M |
| 8 | `CiGovernance.ts` | A workflow-lint rule that any workflow producing a required context triggers on `merge_group`, and a `ruleset --capture` field for the `merge_queue` rule. Today it projects only required contexts and `strict` (`:79-93`, `:664-668`). | S to M |
| 9 | Yeet merge surfaces (`MergeGate.ts`, `Merge.ts`, `GhOps.ts`) | An enqueue path instead of the REST PUT (or auto-merge via the existing driver method), an async merged confirmation, and post-merge actions moved to a merged-event handler. | L |
| 10 | Yeet state model (`MonitorPolicy.ts`, `MonitorLoop.ts`, `Settle*.ts`, `Inbox.ts`, `Session.schemas.ts`) | Queue states (enqueued, building, ejected with reason) as terminal or wait reasons, an ejection inbox row, and a ledger state. | L |
| 11 | `SquashCommitlint.ts` | Match the queue's commit composition, or prove that merge-group Commitlint covers it. | S to M |
| 12 | S11 / `own-red` / `unblocks-main` (`MergeGate.ts`) | Retire, or redefine as a queue bypass with an actor. | M |
| 13 | `AGENTS.md`, orchestrate and yeet skills, `DECISIONS.md` | Rewrite the merge doctrine rows from E, plus a new decision superseding the 2026-08-27 entry. | M |
| 14 | Ruleset 10240248 (live, plus wherever infra declares it) | Add the `merge_queue` rule (method squash, group size, timeout). | S |

**Things that already work**
- `merge_group` is a typed admission event with a `merge-group` source, a decision branch and
  tests (`HeavyAdmission.ts:107`, `:174`, `:323`; test `:157-158`, `:436-441`, `:724-730`).
- The cache-writer environment, Turbo write token, R2 write keys and app secrets are all push-only,
  so a queue run gets read-only credentials like a PR (A2).
- `check.yml` concurrency gives each queue ref its own non-cancelling group, and `workflow-lint`
  enforces that shape (`check.yml:12-14`, `CiGovernance.ts:389-390`).
- The fail-closed aggregates (Lint, Test Unit, Heavy / Test Integration) pass with push semantics
  (`check.yml:702-711`, `:976-991`, `:1131-1146`).
- Lane CLIs take any `--base <sha>`. The change-profile classifier and the route classifier are pure
  over a base/head pair (B).
- `heavy.yml@main` resolution is event-agnostic (A4; the runner group still needs a probe).
- Sweep and retire gate on `MERGED`, so they are queue-safe as they stand (C).
- `ci ruleset --check` decodes rule types as open strings, so an added `merge_queue` rule does not
  break it (`CiGovernance.ts:79-89`).
- The GitHub driver can already enable auto-merge, which enqueues on a queue branch **[semantics]**
  (`drivers/github/src/PullRequest.ts:206-223`).

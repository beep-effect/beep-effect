# Deep research: portfolio-driver residual operational risks

**Date:** 2026-07-14  
**Scope:** Four residual unknowns in the approved autonomous-loop design.  
**Method:** Current local configuration/source inspection plus primary product documentation and upstream issue evidence. No GitHub writes were made.

## Bottom line

| Topic | Risk | Decision for the loop |
| --- | --- | --- |
| Codex CLI + Chrome unattended QA | **Critical** | Do not make `codex exec` + Chrome a required unattended gate. Route local visual QA through a desktop-app browser agent or a deterministic CLI browser harness, with a smoke gate and fail-closed artifact contract. |
| Worktrees + Bun/Turborepo/PGLite | **High** | Two edit lanes are viable, but each lane needs its own install, cache/temp paths, database, and ports. Keep the global full-verify mutex. |
| Auto-merge with `strict:false` | **Critical** | Never arm multiple ordinary auto-merges. Serialize merge, update/retest the next PR on the new `main`, and wait for post-merge `main` CI. Prefer a GitHub merge queue or strict checks if settings can change. |
| Review-thread resolution + Greptile | **Medium** | Resolve by GraphQL thread node ID only after reply/fix/rebuttal, then re-query and re-trigger Greptile. A resolved GitHub thread is not proof that the current head has a clean Greptile review. |

## 1. Codex CLI and the Chrome extension in unattended operation

### Findings

1. **The supported Chrome path is a desktop-app, headed-browser integration, not a headless Codex CLI facility.** OpenAI documents setup through the ChatGPT desktop app's Plugins directory, installation of a Chrome extension, confirmation that the extension is connected, and execution in Chrome tab groups. It can open Chrome if Chrome is not already running and is specifically intended to use an existing Chrome profile or tab. This is an attachment to a user browser session through the desktop/native-host stack, not a bundled headless browser.

2. **OpenAI explicitly says Browser is unavailable in Codex CLI and the IDE extension.** The built-in browser is offered in ChatGPT web/desktop and uses a separate browser profile. Chrome is used when regular signed-in Chrome state is needed. Consequently, the approved design's `codex exec`/background-job route cannot rely on `@Browser` or `@Chrome` being exposed merely because the plugins are installed in `~/.codex/config.toml`.

3. **`codex exec` is suitable for non-interactive agent runs, but its documented interface has no Chrome, browser, headless, display, or attach flag.** It can stream JSONL, write the last message, enforce an output schema, and run without human interaction. Those properties help make a QA *worker* deterministic, but they do not grant a browser backend. The locally installed CLI is `codex-cli 0.144.4`; the 0.144.0 release notes contain no browser/Chrome support addition.

4. **The local config proves desktop browser plumbing exists, not that CLI automation can consume it.** Both bundled Chrome and Browser plugins are enabled. A desktop `node_repl` process advertises `chrome,iab` backends, trusted browser-client hashes, a one-second native-pipe connection timeout, and `approval_mode = "approve"` ([`~/.codex/config.toml` lines 605-645 and 730-751](/home/elpresidank/.codex/config.toml)). This wiring depends on `/opt/codex-desktop` and a desktop native pipe. It is strong evidence that an active graphical desktop/app session is part of the path.

5. **Even desktop browser tasks are not approval-free by default.** OpenAI says a new website normally prompts for permission; full CDP developer access always asks for explicit approval. Hosts can be allowlisted, but consequential actions can still prompt. For localhost QA that only reads and interacts with the app, pre-allowlisting the exact local host avoids one prompt, but CDP-heavy console/network inspection cannot be assumed unattended.

6. **Observed upstream failures occur before useful page interaction.** Current open Codex issues report: extension/native host appears connected but backend acquisition or `openTabs()` times out; the Chrome plugin is missing from tool discovery; browser-client trust/native-pipe failures; Chrome opens but no controllable session is established; and proxy-sensitive ambient bootstrap requests hang. These reports concern the desktop integration, so they do not prove a 0.144.4 CLI regression; they do show that “extension says Connected” is not a sufficient health check.

7. **A prompt contract such as “open app, run checks, write findings, exit” is reliable only after browser availability is independently established.** Without that precondition, a background Codex process may correctly finish with a textual failure, time out in plugin bootstrap, or exit without the findings file. The current design treats the artifact as the gate but does not yet distinguish “clean QA” from “browser never ran.”

### Evidence and citations

- OpenAI Chrome setup, existing-profile behavior, tab groups, and per-site permissions: [Chrome extension documentation](https://developers.openai.com/codex/app/chrome-extension).
- OpenAI's explicit CLI exclusion, separate built-in profile, localhost workflow, confirmation behavior, and CDP approval requirement: [Browser documentation](https://developers.openai.com/codex/app/browser).
- `codex exec` is designed for scripted/CI runs and supports JSONL/output files/schemas, but exposes no browser option: [Codex developer command reference](https://developers.openai.com/codex/cli/reference).
- No browser integration item appears in the relevant CLI release: [Codex CLI 0.144.0 release notes](https://github.com/openai/codex/releases/tag/rust-v0.144.0).
- Representative upstream failure reports: [backend initialization timeout #21908](https://github.com/openai/codex/issues/21908), [browser-client trust failure #21781](https://github.com/openai/codex/issues/21781), [page opens but control session fails #22849](https://github.com/openai/codex/issues/22849), and [proxy-sensitive bootstrap #23504](https://github.com/openai/codex/issues/23504).
- The approved plan currently assigns `FRONTEND_QA` to “codex+Chrome” and background Codex jobs ([approved plan lines 70-102](./approved-plan-2026-07-14.md)).

### Risk rating

**Critical.** This is a capability mismatch, not merely flakiness: current product documentation excludes Browser from Codex CLI. A required `codex exec` + Chrome stage can park every frontend goal in an otherwise healthy multi-day run.

### Concrete recommendation for the loop

- Replace the normative `codex bg + Chrome` gate with one of these, in priority order:
  1. a **deterministic CLI browser harness** (for example, existing project browser tests or Playwright) using a fresh per-run profile and screenshots/traces;
  2. a **desktop-app/Fable browser subagent** using `@Browser` for localhost, provided the desktop session stays logged in and awake;
  3. `@Chrome` only when existing Chrome profile state is genuinely required.
- Before the multi-day loop, run the exact launcher in the exact execution mode. The smoke must prove: backend discovery, opening the lane-specific URL, DOM/screenshot access, findings-file creation, and clean exit. A manual desktop smoke does **not** validate `codex exec`.
- Make the artifact fail closed. Require fields such as `status: clean|findings|infra-failure`, `browserBackend`, `testedHeadSha`, `url`, checks performed, and evidence paths. Absence, timeout, wrong SHA, or `infra-failure` must never count as a clean round.
- Use a hard timeout and one browser-runtime restart retry. After that, route to the alternate harness or park with class `browser-infra`; do not spend frontend-fix rounds on an unavailable browser.
- Pre-allowlist only the lane's exact localhost host. Avoid full CDP in the unattended baseline; reserve it for an attended diagnostic rescue.

## 2. Multi-lane worktrees in this Bun + Turborepo monorepo

### Findings

1. **Worktrees share Git object/ref state but not working files.** Git gives each linked worktree its own `HEAD`, index, and working directory while sharing the repository and ordinary refs. Therefore build outputs, `node_modules`, root `.turbo`, `.beep`, and relative temp/database paths are naturally separate *if every command runs from the lane root*. Branch names and refs are shared, so lanes still need unique branches and must not concurrently manipulate the same ref.

2. **The feared shared Turbo daemon is not present in the installed version.** This checkout resolves Turborepo 2.10.5. Its live `turbo run --help` says both `--daemon` and `--no-daemon` are deprecated because the daemon is no longer used for `turbo run`. Historical daemon watcher/cache bugs remain useful background, but they are not the reason to serialize this repo today.

3. **Turbo cache/output interference is mostly lane-local, but resource pressure and cache correctness remain real.** Each worktree has a different root path and therefore separate default local cache and declared outputs. `--cache-dir` can make that isolation explicit. Remote cache is content-addressed and can be shared, but only inputs/environment included in task hashes are safe. This repo declares many build env inputs, and declares `BEEP_TEST_*` for `test:integration`; integration and coverage are already `cache:false` ([`turbo.json` lines 31-64 and 122-151](../../../turbo.json)). Concurrent full runs still compete for CPU, memory, disk, Docker, and external services.

4. **Every lane needs its own Bun install.** `node_modules` is an untracked working-tree directory, so a newly created worktree will not inherit it. This repo explicitly chooses the hoisted linker in [`bunfig.toml` lines 1-5](../../../bunfig.toml), despite lockfile `configVersion: 1`. Sharing or symlinking a mutable root `node_modules` across worktrees would couple generated bins, package additions, and install state. Bun's global download cache/hardlinks are designed to reduce duplication; that is the safe sharing layer.

5. **Plain `bun install` can modify `bun.lock`; lane bootstrap should be frozen.** Bun documents `bun ci` as equivalent to `bun install --frozen-lockfile`: exact versions, failure on manifest/lock mismatch, and no lock update. That is appropriate for lane setup. A goal that intentionally changes dependencies can run the normal install in its own lane as part of the implementation, then commit the resulting lockfile.

6. **PGLite has three materially different concurrency modes in this repo.** The default integration helper selects in-process PGLite when no external URL is set and describes it as temp-directory-backed; that is lane/process isolated ([`SqlTest.ts` lines 1536-1571 and 1583-1590](../../../packages/tooling/test-kit/test-utils/src/SqlTest.ts)). If `BEEP_TEST_DATABASE_URL` is set, lanes share the external server. The integration suite explicitly says that external PGLite accepts one connection at a time and uses long timeouts ([`SqlTest.pglite.test.ts` lines 22-29](../../../packages/tooling/test-kit/test-utils/test/integration/SqlTest.pglite.test.ts)). Two lanes pointed at the same URL can queue, terminate each other's connections, or hang. Testcontainers avoids a fixed host port when dynamically mapped, but concurrent container startup still adds Docker and memory pressure.

7. **Application QA has a concrete fixed-port collision.** The professional desktop sidecar defaults to loopback port `3939`, configurable through `CHAT_SIDECAR_PORT` ([`server/main.ts` lines 49-52](../../../apps/professional-desktop/server/main.ts)). Two lanes starting it without overrides collide. Vite/Storybook/Portless names can similarly collide or silently choose a different port, causing the browser to test the wrong lane. The app's `.beep/professional-desktop` path is relative to the worktree root and is isolated only when the command's working directory is correct ([`package.json` lines 14-30](../../../apps/professional-desktop/package.json)).

### Evidence and citations

- Worktree sharing and per-worktree state: [Git worktree documentation](https://git-scm.com/docs/git-worktree.html).
- Reproducible frozen installs, workspace behavior, global cache, and Linux hardlink backend: [Bun install documentation](https://bun.sh/docs/pm/cli/install).
- Historical reason not to generalize daemon safety from old versions: [Turborepo daemon/output-cache bug #4137](https://github.com/vercel/turborepo/issues/4137). The authoritative current evidence is this checkout's `turbo run --help` for 2.10.5, which says the run daemon is unused.
- The approved plan already proposes a global proof mutex for Turbo/PGLite contention ([approved plan lines 75-81](./approved-plan-2026-07-14.md)); the mutex is correct, but its Turbo rationale should be resource/output pressure rather than daemon contention.

### Risk rating

**High** without isolation; **Medium** with the controls below. The most likely failures are wrong-lane browser targets, fixed-port bind errors, external-PGLite hangs, memory exhaustion, and accidental lockfile churn—not shared Turbo daemon corruption.

### Concrete recommendation for the loop

- At `LANE_SETUP`, run `bun ci` once in that lane and record success. Never symlink another worktree's `node_modules`. If dependency manifests intentionally change, run normal `bun install` only in that lane and require the lockfile diff to be attributed to the goal.
- Give every lane an immutable `laneId` and derive unique runtime values: `TMPDIR`, `XDG_CACHE_HOME` where supported, `TURBO_CACHE_DIR`/`--cache-dir`, `CHAT_SIDECAR_PORT`, Vite/Storybook port, Portless hostname, browser profile/artifact directory, and any file-backed database directory.
- Prefer **unset** `BEEP_TEST_DATABASE_URL` for ordinary lane integration tests so the in-process temp-backed driver is selected. If the external lane is required, provision one server/database URL per lane or protect the shared URL with the same global integration mutex.
- Keep exactly one `yeet verify`/publish-class run machine-wide. Allow lightweight package checks concurrently only when they do not start servers, Docker, shared external PGLite, or overlapping full Turbo graphs. Also cap Turbo/Vitest concurrency inside the mutex if memory pressure appears.
- Before browser QA, allocate ports atomically, start the app in the same lane, wait on a lane-specific health endpoint, and write the resolved URL/PID/head SHA to the QA input artifact. The browser must verify that identity before testing.
- On lane cleanup/reseed, terminate only processes recorded in that lane's PID manifest. Never use broad `pkill`, Docker cleanup, cache deletion, or worktree pruning.

## 3. GitHub auto-merge with non-strict required checks

### Findings

1. **The live repository ruleset is loose.** A read-only ruleset query on 2026-07-14 returned active ruleset `main` with 17 required contexts and `strict_required_status_checks_policy: false`; it contains neither merge-queue nor required-review-thread-resolution rules. This matches the approved plan's recorded facts ([approved plan lines 17-30](./approved-plan-2026-07-14.md)).

2. **GitHub explicitly warns that loose checks can merge incompatible changes.** With strict checks, a PR must be current with the base before merge. With loose checks, it need not be current, fewer builds run, and status checks may fail after merge because the PR is incompatible with the evolved base. A clean textual merge is not a semantic integration proof.

3. **Ordinary auto-merge does not add merge-queue semantics.** `gh pr merge --auto` means merge when the PR's necessary requirements are met. GitHub documents FIFO ordering and synthetic `merge_group` testing only for a configured merge queue. There is no documented FIFO, batch validation, or “test against all previously armed PRs” guarantee for several ordinary auto-merge requests. Therefore multiple armed PRs can each be green against an older base and land in whichever order GitHub's requirement transitions occur.

4. **A base move does not make loose required checks strict or guarantee a rerun.** The point of `strict:false` is to avoid forcing the branch up to date and rebuilding after other merges. GitHub may recompute mergeability/conflicts, but it can accept the existing successful checks on the PR head. The second PR can therefore land without its full suite ever testing the composition with the first PR.

5. **Auto-merge survives the driver, which is both useful and dangerous.** The approved recovery model correctly notes that an armed request persists. If more than one is armed when the driver dies, those requests can continue merging without the driver's intended “wait for main” interlock. On the other hand, a new push by someone without write permission or a base-branch switch disables auto-merge, so recovery must not assume every armed request remains active.

6. **Skipped required jobs are considered successful by GitHub.** GitHub's status-check documentation says a skipped job reports success and does not block merge. Required workflows need an always-run aggregate gate that explicitly fails when dependencies are failed, cancelled, or skipped; otherwise auto-merge can legally land a partially untested PR.

### Evidence and citations

- Loose versus strict behavior and GitHub's explicit incompatibility warning: [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
- What auto-merge promises, who may enable it, and when it is disabled: [Automatically merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request).
- CLI semantics, including `--auto` and `--match-head-commit`: [`gh pr merge` reference](https://cli.github.com/manual/gh_pr_merge).
- FIFO ordering and testing against latest base plus earlier queued PRs exist specifically in merge queue: [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).
- Skipped checks report success: [About status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks).

### Risk rating

**Critical** if several PRs are armed at once; **High** under serialization without refreshing the next PR. This is the main path by which individually green changes can make `main` red without a Git conflict.

### Concrete recommendation for the loop

- Enforce a durable **single armed merge lease** in loop state. Before arming, query all open PRs and require that no other PR targeting `main` has `autoMergeRequest != null`. On recovery, if more than one exists, halt merge arming and reconcile rather than guessing order.
- After PR A merges: capture the new `main` SHA, wait for every required `push` check on that SHA to complete, and halt merges if any fail. Only then update/rebase PR B onto that exact SHA, rerun local proof and hosted required checks, refresh Greptile, and arm B.
- Arm with `gh pr merge --squash --auto --match-head-commit <expected-head-sha>`. This prevents a surprise head push from being merged under a stale decision, though it does not protect against a moving base.
- Immediately before arming, assert: merge base equals current `main`, head SHA equals the verified/reviewed SHA, no pending/failed required checks, no actionable threads, and Greptile's last-reviewed commit equals head.
- Prefer enabling **GitHub merge queue** for `main`; it gives the ordering and combined-base testing the loop currently implements manually. Enabling strict required checks is the simpler alternative but causes extra branch updates/builds. Until either setting changes, retain the manual serialization protocol.
- Audit required workflows for a final `if: always()` aggregate job that fails on failed/cancelled/skipped dependencies; do not treat GitHub's green “skipped” conclusion as execution evidence.

## 4. GitHub GraphQL review-thread resolution and Greptile

### Findings

1. **`resolveReviewThread` requires the review-thread node ID, not a comment ID, review ID, database ID, or URL.** The mutation input is `ResolveReviewThreadInput { threadId: ID! }` and returns the thread. The ID is obtained from `pullRequest.reviewThreads.nodes[].id`; pagination is required beyond 100 threads.

2. **Permission is straightforward and can be preflighted.** GitHub says the PR opener or a user with write access to the repository can resolve a conversation. GraphQL exposes `viewerCanResolve` and `viewerCanUnresolve`; the driver should check these rather than infer permission from token scopes. The bot authorship of the first comment does not make the thread bot-owned or prevent an authorized PR author/maintainer from resolving it.

3. **Resolution changes GitHub thread state only.** It sets `isResolved`, records `resolvedBy`, and collapses the conversation. It does not delete the comments, dismiss the bot review, change Greptile's score/status check, or prove that the issue was fixed. New commits can make the original thread `isOutdated`; a new Greptile pass can create new threads. There is no documented contract that manually resolving an old thread suppresses or reopens findings in a later independent review.

4. **Greptile does not necessarily review every push.** Its documented default is an initial PR review; `triggerOnUpdates` defaults to false. A manual PR comment containing `@greptileai` forces a review; `@greptileai review` is also accepted and is the exact string this repo's Yeet closeout uses. Greptile documents each review as an independent single pass and offers a re-trigger control against the current PR state.

5. **The repo's existing Yeet implementation is already the right primitive.** It pages `reviewThreads(first: 100)`, returns node ID/resolution/outdated state and comments ([`Gh.schemas.ts` lines 915-935](../../../packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Gh.schemas.ts)); validates requested IDs against freshly collected known thread IDs; and calls `resolveReviewThread(input:{threadId:$threadId})` ([`WritePlan.ts` lines 45-58 and 105-147](../../../packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/WritePlan.ts)). Closeout refreshes after writes, excludes resolved/outdated threads from actionable count, and re-triggers with `@greptileai review` ([`Closeout.ts` lines 58-90 and 123-142](../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Closeout.ts)).

6. **The timing invariant matters.** If the loop resolves threads and then pushes a fix, the subsequent head is not the head that was gated. If it pushes first and Greptile is not configured for update triggers, the old score remains stale. The safe sequence is fix/rebuttal reply -> push -> wait for CI -> explicitly re-trigger -> wait for terminal Greptile review -> fetch all pages -> resolve only stale/addressed threads -> re-query final gates. Any later push invalidates that gate and repeats the sequence.

### Evidence and citations

- Mutation input/output, `threadId`, `isResolved`, `isOutdated`, `resolvedBy`, and viewer permission fields: [GitHub GraphQL pull-request reference](https://docs.github.com/en/graphql/reference/pulls).
- Who may resolve and the UI/state semantics: [GitHub pull-request commenting documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request).
- Manual trigger, default initial-review behavior, update-trigger configuration, and independent reviews: [Greptile trigger documentation](https://www.greptile.com/docs/code-review-bot/trigger-code-review) and [developer quick reference](https://www.greptile.com/docs/developer-quick-reference).
- Review counter/current-commit re-trigger UI: [Greptile anatomy of a review](https://www.greptile.com/docs/code-review/first-pr-review).

### Risk rating

**Medium.** The APIs are stable and already wrapped locally. The remaining risk is stale-state logic: resolving the wrong identifier, assuming resolution changes Greptile's verdict, or gating a review for an earlier head SHA.

### Concrete recommendation for the loop

- Use Yeet closeout rather than hand-written `gh api graphql` wherever its flags cover the operation. It already validates thread IDs, paginates, serializes writes, refreshes state, and uses the repo's canonical Greptile trigger string.
- Before any write, collect `id`, authors, `isResolved`, `isOutdated`, `viewerCanResolve` (add this field to the driver query if Yeet does not expose it), path/line, and latest comment. Refuse unknown IDs and refuse resolution when `viewerCanResolve` is false.
- Require a reviewed reply/fix classification for every resolution. Resolve bot threads exactly like human threads; bot authorship provides no special bypass and no special obstacle.
- After every push, explicitly re-trigger Greptile unless repository configuration demonstrably has `triggerOnUpdates: true`. Wait for a terminal review and verify its reviewed commit equals the PR head before evaluating score or issue count.
- Treat a resolved old thread and an outdated thread as historical evidence only. The merge gate is: current head reviewed, required Greptile score met, inferred issue count zero, and zero unresolved non-outdated actionable threads after a fresh query.

## Required changes to the approved loop design

1. Change `FRONTEND_QA` from “codex background job + Chrome extension” to a browser-capable desktop agent or deterministic CLI harness; retain Codex for analysis/distillation after browser artifacts exist.
2. Keep the machine-wide verify mutex, but document its current causes as resource pressure, integration services, fixed ports, and external PGLite—not a Turbo 2.10 daemon.
3. Add lane bootstrap/runtime isolation (`bun ci`, unique cache/temp/database/port/browser paths) and a lane process manifest.
4. Persist a single-armed-merge lease; after every merge, require green `main`, refresh the next PR onto the new base, and rerun all gates.
5. Make Greptile gating head-SHA-aware and always re-query after reply/resolve/re-trigger operations.

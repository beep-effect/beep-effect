# PR Event Awareness for Orchestrating Agents — Sources & Provenance

<!--
The provenance ledger for this packet. Started at capture because the
in-repo inventory was verified while the packet opened; §1 and §2 are dropped
because research mined vendor documentation and live measurement rather than a
source corpus. Never fabricate a URL; cite the CAPTURE/RESEARCH section that
carries a claim when none exists on disk.
-->

- **Cluster / origin:** the time-to-certainty C3 closeout session
  (2026-09-12), where the operator was the PR-event notification path for
  PRs #1102, #1126, #1130, and #1131.
- **Provenance:** [`../CAPTURE.md`](../CAPTURE.md) (spark, proposal,
  assessment, live-checkout inventory); [`../RESEARCH.md`](../RESEARCH.md)
  (2026-09-24 external landscape, refreshed in-repo inventory, harness
  primitives, first end-to-end measurement, binding-gap verdict).

## 3. External research sources

Every URL cited in [`../RESEARCH.md`](../RESEARCH.md), 2026-09-24. Vendor
documentation is reference-only: it informs a design, it is not ported.
Repository rows state the port discipline — permissive (MIT/Apache/BSD/ISC) may
be ported with attribution, copyleft is clean-room only, and a missing or
source-available licence is reference-only.

### 3a. GitHub platform documentation (docs.github.com)

Licence: GitHub Docs content is CC-BY; treat as **reference only** (quote with
attribution, do not vendor).

| Title | URL |
|---|---|
| Webhook events and payloads — `pull_request_review_comment` | https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review_comment |
| Webhook events and payloads — `issue_comment` | https://docs.github.com/en/webhooks/webhook-events-and-payloads#issue_comment |
| Webhook events and payloads — `pull_request_review` | https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review |
| Webhook events and payloads — `pull_request_review_thread` | https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review_thread |
| Webhook events and payloads — `check_run` | https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run |
| Webhook events and payloads — `check_suite` | https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_suite |
| Webhook events and payloads — `workflow_job` | https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_job |
| Webhook events and payloads — `push` | https://docs.github.com/en/webhooks/webhook-events-and-payloads#push |
| Webhook events and payloads — `status` | https://docs.github.com/en/webhooks/webhook-events-and-payloads#status |
| Webhook events and payloads — payload cap (25 MB) | https://docs.github.com/en/webhooks/webhook-events-and-payloads#payload-cap |
| About webhooks — choosing webhooks or the REST API | https://docs.github.com/en/webhooks/about-webhooks#choosing-webhooks-or-the-rest-api |
| Types of webhooks (repository vs org vs App; 20-per-event limit) | https://docs.github.com/en/webhooks/types-of-webhooks |
| Best practices for using webhooks — respond within 10 seconds | https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks#respond-within-10-seconds |
| Best practices for using webhooks — use the `X-GitHub-Delivery` header | https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks#use-the-x-github-delivery-header |
| Handling failed webhook deliveries (no automatic redelivery) | https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries |
| Validating webhook deliveries (`X-Hub-Signature-256`) | https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries |
| Delivering webhooks to private systems | https://docs.github.com/en/webhooks/using-webhooks/delivering-webhooks-to-private-systems |
| Troubleshooting webhooks — deliveries are out of order | https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks#webhooks-deliveries-are-out-of-order |
| Troubleshooting webhooks — URL host `localhost` is not supported | https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks#url-host-localhost-is-not-supported |
| Viewing webhook deliveries (3-day history) | https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries |
| Using the GitHub CLI to forward webhooks for testing | https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/using-the-github-cli-to-forward-webhooks-for-testing |
| REST — create a repository webhook (hook `config` surface) | https://docs.github.com/en/rest/repos/webhooks#create-a-repository-webhook |
| REST — list repository webhooks | https://docs.github.com/en/rest/repos/webhooks#list-repository-webhooks |
| REST — list deliveries for a repository webhook | https://docs.github.com/en/rest/repos/webhooks#list-deliveries-for-a-repository-webhook |
| REST — get a pull request (`mergeable` null semantics) | https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request |
| REST guides — checking mergeability of pull requests (webhook-then-poll) | https://docs.github.com/en/rest/guides/getting-started-with-the-git-database-api#checking-mergeability-of-pull-requests |
| REST — rate limit endpoint | https://docs.github.com/en/rest/rate-limit/rate-limit |
| REST — rate limits for the REST API | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |
| REST rate limits — primary limit for GitHub App installations | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#primary-rate-limit-for-github-app-installations |
| REST rate limits — about secondary rate limits | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#about-secondary-rate-limits |
| REST rate limits — checking the status of your rate limit | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#checking-the-status-of-your-rate-limit |
| REST best practices — use conditional requests (free 304s) | https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests |
| REST best practices — avoid polling | https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#avoid-polling |
| REST best practices — make requests that can be cached | https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#make-requests-that-can-be-cached |
| REST — activity: events (X-Poll-Interval, 30s–6h latency) | https://docs.github.com/en/rest/activity/events |
| REST — activity: notifications (classic-PAT-only, reason taxonomy) | https://docs.github.com/en/rest/activity/notifications |
| REST — GitHub event types (Events API type list) | https://docs.github.com/en/rest/using-the-rest-api/github-event-types |
| REST — fine-grained PAT permissions for webhooks | https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens#repository-permissions-for-webhooks |
| GraphQL — rate limits and query limits | https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api |
| GraphQL limits — node limit and timeouts | https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api#node-limit |
| GraphQL limits — returning the point value of a query | https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api#returning-the-point-value-of-a-query |
| GraphQL reference — pulls (`MergeStateStatus`, `MergeableState`) | https://docs.github.com/en/graphql/reference/pulls |
| Actions — events that trigger workflows | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |
| Actions — trigger a workflow (PAT / App token workaround) | https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow |
| Copilot — about coding agent (Actions-powered, 59-minute cap) | https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent |
| Copilot — use cloud agent on GitHub (comment batching) | https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github |

### 3b. Machine-readable descriptions and first-party source

| Title | URL | Licence | Discipline |
|---|---|---|---|
| github/rest-api-description — `api.github.com.yaml` (`synchronize`, `mergeable_state`, `throttled_at`, delivery `guid`) | https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.yaml | MIT | port-with-attribution (schema shapes) |
| cli/cli — `pkg/cmd/pr/checks/checks.go` (10 s default, pending-only loop) | https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/pr/checks/checks.go | MIT | port-with-attribution |
| cli/cli — `pkg/cmd/run/watch/watch.go` (3 s default) | https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/run/watch/watch.go | MIT | port-with-attribution |
| github/docs commit 10928975 — adds the `Authorization` clause to the 304 rule (2025-05-06) | https://github.com/github/docs/commit/10928975 | CC-BY (docs content) | reference only |
| github/docs commit 29d8e509 — efficient polling and caching guidance (2026-07-27) | https://github.com/github/docs/commit/29d8e509 | CC-BY (docs content) | reference only |

### 3c. Repositories

| Repo / page | URL | Licence | Discipline |
|---|---|---|---|
| cli/gh-webhook — the official forwarding extension | https://github.com/cli/gh-webhook | MIT | port-with-attribution |
| cli/gh-webhook — `webhook/create_webhook.go` (hook name `cli`, `ws_url`, PATCH active) | https://github.com/cli/gh-webhook/blob/main/webhook/create_webhook.go | MIT | port-with-attribution |
| cli/gh-webhook — `webhook/forward.go` (frame headers copied onto the local POST) | https://github.com/cli/gh-webhook/blob/main/webhook/forward.go | MIT | port-with-attribution |
| cli/gh-webhook issue #43 — 1006 reconnect never fires; socket closes ~every 5 min | https://github.com/cli/gh-webhook/issues/43 | issue text, community data | reference only |
| anthropics/claude-code-action | https://github.com/anthropics/claude-code-action | MIT | port-with-attribution |
| anthropics/claude-code-action — `docs/usage.md` (trigger events, `classify_inline_comments`) | https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md | MIT | port-with-attribution |
| anthropics/claude-code-action — `docs/solutions.md` (per-push review recipes) | https://github.com/anthropics/claude-code-action/blob/main/docs/solutions.md | MIT | port-with-attribution |
| anthropics/claude-code-action — `docs/capabilities-and-limitations.md` | https://github.com/anthropics/claude-code-action/blob/main/docs/capabilities-and-limitations.md | MIT | port-with-attribution |
| OpenHands/OpenHands | https://github.com/OpenHands/OpenHands | MIT | port-with-attribution |
| OpenHands — commit history of `.github/workflows/openhands-resolver.yml` (V0 resolver removed 2026-04-23) | https://github.com/OpenHands/OpenHands/commits/main/.github/workflows/openhands-resolver.yml | MIT | reference only (removed code) |
| All-Hands-AI/openhands-resolver (archived) | https://github.com/All-Hands-AI/openhands-resolver | MIT | reference only (archived) |
| probot/smee.io (unauthenticated channels, development-only) | https://github.com/probot/smee.io | MIT (server); `smee-client` ISC | reference only (ruled out on privacy) |
| sweepai/sweep (sunset notice) | https://github.com/sweepai/sweep | Sweep Enterprise Edition; GitHub reports NOASSERTION | **reference only** — source-available, derivative works forbidden outside its MIT Expat parts |

### 3d. Anthropic Claude Code documentation (code.claude.com)

Licence: proprietary vendor documentation — **reference only**.

| Title | URL |
|---|---|
| Hooks reference (33 events, `asyncRewake`, `FileChanged`, `Notification`) | https://code.claude.com/docs/en/hooks |
| Push events into a running session with channels | https://code.claude.com/docs/en/channels |
| Channels reference (contract, localhost webhook receiver, permission relay) | https://code.claude.com/docs/en/channels-reference |
| Message your other Claude Code sessions (idle wake, inbox socket, inbound control) | https://code.claude.com/docs/en/cross-session-messaging |
| Environment variables (`CLAUDE_CODE_MESSAGING_SOCKET` / `_TOKEN`) | https://code.claude.com/docs/en/env-vars |
| Tools reference (Monitor tool, WebSocket source) | https://code.claude.com/docs/en/tools-reference |
| Run prompts on a schedule (`/loop`, `CronCreate`, jitter) | https://code.claude.com/docs/en/scheduled-tasks |
| Plugin components (monitors) | https://code.claude.com/docs/en/plugins/components |
| Connect Claude Code to tools via MCP (`list_changed`, `MCP_PROTOCOL_NEGOTIATION`) | https://code.claude.com/docs/en/mcp |
| CLI reference (`--resume`, `--continue`, `--fork-session`, `--channels`) | https://code.claude.com/docs/en/cli-reference |
| Agent SDK — work with sessions | https://code.claude.com/docs/en/agent-sdk/sessions |
| Agent SDK — streaming vs single mode | https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode |
| Claude Code in the cloud — auto-fix pull requests (no conflict webhook) | https://code.claude.com/docs/en/claude-code-on-the-web |
| Code Review (managed App: trigger policy, per-PR queue, 20-minute average) | https://code.claude.com/docs/en/code-review |
| GitHub Actions (interactive vs automation mode, actor gating) | https://code.claude.com/docs/en/github-actions |
| Automate work with routines (GitHub + API triggers, no session reuse) | https://code.claude.com/docs/en/routines |
| Remote Control (unavailable with a custom `ANTHROPIC_BASE_URL`) | https://code.claude.com/docs/en/remote-control |

### 3e. Other vendor documentation and blogs

Licence: proprietary vendor documentation — **reference only**.

| Title | URL |
|---|---|
| Cursor — Bugbot (git patch-id dedupe, incremental reviews) | https://cursor.com/docs/bugbot |
| Cursor — Cloud Agents (`@cursor` on a PR) | https://cursor.com/docs/cloud-agent |
| Cursor — Automations (broadest PR trigger taxonomy; no conflict trigger) | https://cursor.com/docs/cloud-agent/automations |
| CodeRabbit — automatic review controls (`auto_incremental_review`, auto-pause) | https://docs.coderabbit.ai/configuration/auto-review |
| CodeRabbit — review commands reference | https://docs.coderabbit.ai/reference/review-commands |
| Devin — GitHub integration (`/devin` routed into the live session) | https://docs.devin.ai/integrations/gh |
| Cognition — Devin 101: automatic PR reviews with the Devin API (5–10 min) | https://cognition.com/blog/devin-101-automatic-pr-reviews-with-the-devin-api |
| OpenAI Codex — GitHub integration / code review | https://learn.chatgpt.com/docs/third-party/github |
| OpenAI Codex — non-interactive mode (does **not** document `codex queue`) | https://learn.chatgpt.com/docs/non-interactive-mode |
| OpenHands — GitHub installation (`@openhands`, `openhands` label) | https://docs.openhands.dev/openhands/usage/cloud/github-installation |
| OpenHands — event-based automations (JMESPath filters; no CI/review trigger) | https://docs.openhands.dev/openhands/usage/automations/event-automations |
| OpenHands blog — open-source coding agents in your GitHub (`fix-me` label) | https://www.openhands.dev/blog/open-source-coding-agents-in-your-github-fixing-your-issues |
| Ellipsis — code review docs | https://www.ellipsis.dev/docs/code-review |
| Tailscale Funnel — KB 1223 (beta, 443/8443/10000, TLS-only, `funnel` attribute) | https://tailscale.com/kb/1223/funnel |
| Cloudflare — TryCloudflare quick tunnels (dev-only, 200 in-flight, no SSE) | https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/ |
| ngrok — pricing (free tier caps) | https://ngrok.com/pricing |
| Webhook Relay — pricing (150 webhooks/month free) | https://webhookrelay.com/pricing/ |
| ntfy — home (push to phone or desktop) | https://docs.ntfy.sh/ |
| ntfy — publishing and limits | https://docs.ntfy.sh/publish/ |

Client licences worth recording: the Tailscale client (`tailscale/tailscale`) is
BSD-3-Clause and `cloudflare/cloudflared` is Apache-2.0 — both
port-with-attribution if any adapter code is ever written; ntfy
(`binwiederhier/ntfy`) is Apache-2.0 and self-hostable; the ngrok agent has no
public source repository (reference only) while its Go SDK is MIT.

### 3f. Specifications and man pages

| Title | URL | Licence | Discipline |
|---|---|---|---|
| MCP specification 2025-06-18 — Resources (`resources/subscribe`, `notifications/resources/updated`) | https://modelcontextprotocol.io/specification/2025-06-18/server/resources | MIT (spec repo) | port-with-attribution |
| MCP specification 2025-06-18 — Logging (`notifications/message`) | https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging | MIT (spec repo) | port-with-attribution |
| `systemd.path(5)` — inotify, dotfile exclusion, trigger limit, busy-loop protection | https://www.freedesktop.org/software/systemd/man/systemd.path.html | LGPL-2.1-or-later (systemd docs) | **clean-room only** if any text is reused; behaviour facts are free to cite |
| `systemd.exec(5)` — `$TRIGGER_UNIT` / `$TRIGGER_PATH` are lossy | https://www.freedesktop.org/software/systemd/man/systemd.exec.html | LGPL-2.1-or-later | clean-room only |
| `systemd.timer(5)` — `AccuracySec=` defaults to 1min | https://www.freedesktop.org/software/systemd/man/systemd.timer.html | LGPL-2.1-or-later | clean-room only |
| `inotify(7)` — `max_queued_events`, `IN_Q_OVERFLOW` | https://man7.org/linux/man-pages/man7/inotify.7.html | GPL-compatible (man-pages) | clean-room only |

### 3g. Sources with no URL

Two classes of evidence in [`../RESEARCH.md`](../RESEARCH.md) have no citable
URL and must be re-derived rather than trusted later:

- **Observed tool schemas** in the Claude Code desktop app on the operator
  workstation (`ccd_pr.set_monitor`, `ccd_pr.get_status`, `ReadNotifications`,
  `Monitor`, `CronCreate`, `SendMessage`, `FetchInboxMessage`). Read from the
  live tool registry on 2026-09-24; not repo code, not a documented API, not
  under version control. Carried in RESEARCH.md §"Harness-side primitives".
- **Live measurement** against this repo's GitHub state and this workstation's
  on-disk artifacts, 2026-09-24/25. Commands and caveats are in RESEARCH.md
  §"Measurement"; the webhook endpoint and hook id are deliberately withheld.
- `codex queue --thread … --message …` and `codex agents` are verified only
  against `--help` on codex-cli 0.156.1; the published non-interactive docs
  document neither, so treat both as undocumented surfaces.

## 4. In-repo capability references

Yeet internals are under
`packages/tooling/tool/cli/src/commands/Yeet/internal/` (package
`@beep/repo-cli`) and abbreviated to the file name. Rows carried from the
2026-09-12 capture keep their dispositions; line numbers are the 2026-09-24
re-read. Full tables with roles are in
[`../RESEARCH.md`](../RESEARCH.md) §"In-Repo Capability Inventory".

| Brick | Path | Role for this packet | Disposition |
|-------|------|----------------------|-------------|
| `YeetWatchEvent` | `WatchStream.ts:739-748` | typed PR transition union — 9 arms now, `settle-changed` added at `:503` | reuse |
| `runYeetWatchStream` | `WatchMode.ts:953-1047`; interval `Porcelain.ts:506`, `:556` | 10 s poll, NDJSON transitions, inbox convergence | extend (push source) |
| `collectYeetWatchSnapshot` | `WatchMode.ts:381-464` | one poll's reads; the `gh pr checks` pair at `:403` is **sequential** (bare `Effect.all`) | reuse |
| `diffYeetWatchSnapshots` | `WatchStream.ts:881-964` | pure differ; `mergeability-changed` fires only on a `mergeable` delta (`:942-945`) | extend |
| `convergeYeetWatchDispatch` | `WatchMode.ts:595-656` | the watch's whole durable surface: `check-failed`, `review-thread` P1, `base-drift` P2 on `BEHIND` only | extend |
| wave record | `Remediation.ts:670-729`, `dispatch.json` `:419`, reset `386-394` | per-head coalescing of check reds; supersede on push (its A4 lease prose is historical) | extend (threads, conflicts, lane dispatch) |
| `supersedeYeetDispatchState` | `WatchMode.ts:822`, `:1009`; `Remediation.ts:759-780` | the only wave re-pin, and only from the watch stream | reuse |
| `watchStreamEnd` | `WatchMode.ts:838-861` | `--until-event` exit contract: required reds and settled comment batches only | extend |
| `YeetInboxRow` | `Inbox.ts:649-656` | P0/P1/P2 checkout inbox rows with deterministic ids — **7 kinds now**, no conflict kind | extend |
| `yeetInboxPaths` | `Inbox.ts:1081-1092`, cap `:1094` | every row lands under `<repoRoot>/.beep/inbox/`; no cross-checkout path | extend |
| comment watermarks | `MonitorComments.ts:40`, `1102`/`1108`/`1117`, `:1122` | REST comment polling cursors, three collections at concurrency 3 | reuse |
| flake fingerprints | `MonitorLoop.ts:1416-1452` | one rerun per job per head; attribution before dispatch — but the required-red branch writes no row | extend |
| settle rule (B7) | `Settle.ts:485-486`, `937-979`, `1128-1129`; `CheckOutcome.ts:86-92` | `base-conflict` ∨ `registration` ∨ … named waits; a conflict is `budgetApplies: false` and never terminal | extend |
| `--until-ready` ready loop | `MonitorLoop.ts:129`, `:1581`, readiness `1361-1401` | 30 s merge loop; its **only** inbox write is one `pr-merge-ready` P1 row per head | extend |
| `YeetHeadTimeline` / `readPushedAt` | `MonitorPolicy.ts:336-347`, `:437`; `MonitorLoop.ts:1052-1069` | push→ready stamps; `pushedAt` is the commit's committer date, merge-loop only | extend |
| monitor route table | `Yeet.command.ts:962-978`, `:1000` | seven routes; `--until-ready` forbids `--watch`/`--until-merged`/`--until-event` | reuse |
| `PrSessionRegistry` | `PrSessionRegistry.ts:188-195`, `213-214`, `235` | PR → local session rows (append-only, local-only, out-of-repo state root) | reuse |
| `classifyHarness` | `Provenance.ts:1301-1302` | harness/sessionId come only from `CODEX_THREAD_ID` / `CLAUDE_CODE_SESSION_ID` | extend |
| `HarnessResumer` | `Resume.ts:117`, `171-178`, `234-266`, `360-367` | live-session match by session id + `/proc`; resume command construction | extend |
| `transcriptFallback` | `Resume.ts:268-358`, gate `:453` | transcript `pr-link` repair — gated on an **empty** registry lookup, so it never repairs an unresumable PR | extend |
| provenance footer | `ProvenanceFooter.ts:604-661`; projection `Provenance.ts:682-691`, `:919` | public resume block, concurrent-edit reconcile; no sessionId/path/runId crosses | reuse |
| inbox hook | `.claude/hooks/yeet-inbox.sh:230-311`; wiring `.claude/settings.json:109`, `194`, `212`, `237` | delivery at four event boundaries; PreToolUse injects context, Stop/SubagentStop is the one hard gate; no timer | extend |
| hook vs CLI liveness | `.claude/hooks/yeet-inbox.sh:141-145`; `InboxView.ts:154` | two different liveness rules (capsule shape vs row kind) that agree only by accident | extend |
| ack vocabulary | `Ack.ts:46`, `79-251`; observed kinds `Inbox.ts:693` | six attributed ack forms plus `--observed`; no pruning anywhere | extend |
| `ProofJob` detached launcher | `Yeet.command.ts:701-730`; `ProofJob.ts:1268-1302`, `:57`, `:74` | `--detach` → `beep-proof-<jobId>.service` under `agent-runs.slice`, in-checkout log | reuse |
| proof-job env allowlist | `ProofJob.ts:146-165`, `:182`, `1221-1231` | 18 names + `BEEP_`/`TURBO_`; admits **neither** harness session id, which is why detached monitors write `harness=unknown` | extend |
| proof-job finalizer + `job wait` | `ProofJobLauncher.ts:248-267`, `339-372`, `498-527`; `ProofJob.ts:1139` | systemd `ExecStopPost` classification, idempotent row, 2 s record poll, 2/0/1 exits | reuse |
| `ProcessIdentity` | `ProcessIdentity.ts:62`, `82-86`, `347-354` | procStart pid-reuse fence — already used for proof jobs, unused by PR ownership | reuse |
| `detectRunScopeSupport` | `internal/repo-run/RunScope.ts:153-161` | the systemd availability gate every detached lane inherits | reuse |
| systemd timer renderer | `Research/internal/Timers.ts:82-119`, `160-174`; schemas `internal/systemd/SystemdUnit.schemas.ts:41-45`, `:59`, `101-106` | the in-repo user-unit renderer pattern (`Type=oneshot` + `OnCalendar`) plus the shared unit-path safety layer | extend |
| long-running unit renderers | `infra/src/OpenClaw.ts:1300`; `packages/tooling/library/ai-metrics/src/forwarder.ts:690-691`, `702-705` | `Type=simple`, `Restart=on-failure`, `RestartSec`, `OnUnitInactiveSec` already exist for `systemd --user` units | extend |
| worktree lifecycle | `Worktree.command.ts:912-940`, `:942`; `Retire.ts:99-152`, `229-240` | fixer-lane birth and archive-retirement already exist as verbs | reuse |
| `CiWorkflowJob` timestamp reader | `Ci/LaneTimings.ts:133`, `:142`, `:456` | already decodes job `started_at`/`completed_at` — the missing check timestamps, in another command | reuse |
| `CiFleetController` (webhook receiver stack) | `infra/src/CiFleetController.ts:1-7`, `784-789`, `875`, `949`, `1035`; output `internal/ci-runners-entry.ts:139` | the only in-repo GitHub-webhook receiver; carries `workflow_job` only and is the CI autoscaler's | extend |
| `eventbridge` module input | `infra/ci-runners/sdks/ghaRunners/types/input.ts:42-45`; `module.ts:399-405`, `:102` | the config lever that turns the receiver into an EventBridge publisher — unset today | extend |
| webhook-secret chain | `infra/ci-runners/Pulumi.production.yaml:11-12`; `CiFleetController.ts:29`, `916-919` | 1Password reference → SSM SecureString under KMS → Lambda reads SSM; Pulumi holds only the ARN | reuse |
| `CiTurboCache` receiver shape | `infra/src/CiTurboCache.ts:510-695`; `infra/lambda/turbo-cache/src/hmac.ts:41-51` | repo-authored HTTP API + Lambda REQUEST authorizer + constant-time HMAC — the second-receiver precedent | reuse |
| CiRunners reaper shape | `infra/src/CiRunners.ts:1286-1362` | EventBridge rule → Lambda whose source is an inline `StringAsset`; no artifact pipeline | extend |
| workstation AWS CLI consumer | `Runners.service.ts:224-231`, `721-728` | the only workstation→AWS code path (shells `aws`, schema-decodes stdout) | extend |
| workstation ↔ API Gateway contract | `standards/turbo-remote-cache.md:3-26`; `scripts/enable-turbo-remote-reads.sh:54-56` | HTTPS + `op://`-referenced bearer token, fail-closed resolver | reuse |
| `@beep/tailscale` driver | `packages/drivers/tailscale/src/Tailscale.service.ts:312`, `:362`, `:427` | tailnet ingress only; **zero functional consumers** (production uses the CLI at `infra/src/AIMetrics.ts:191`) | reuse |
| `@pulumi/command` | `infra/package.json:50` | the in-workspace way to wrap `gh api` as IaC | reuse |
| webhook-router design prior art | `goals/ship-velocity/research/c2-yeet-monitor-backpressure.md:371-385` | an existing in-repo design: minimal App/repo webhook on the seven PR events, Effect `HttpRouter` verifying `X-Hub-Signature-256`, delivery-GUID dedupe, journal, normalized to `YeetWatchEvent` | reuse |
| ntfy escalation ladder | `.claude/hooks/sequence-break-notifier.sh:2-7`, `442`, `501`, `687-688`; `hook-pulse.sh:377` | content-free human escalation; armed only by a PermissionRequest, never by a row | reuse |
| `FileChanged` / `asyncRewake` spike | `scratchpad/claudecode/Hook/Events/FileChanged.ts:1-5`; `Settings/HooksSection.ts:140`; ruling 46 `goals/time-to-certainty/research/decisions.md:528-540` | the sanctioned idle-wake experiment — modelled in the scratchpad, **unwired** in `.claude/` | NET-NEW |
| desktop `ccd_pr` ci-monitor (`bind_pr`, `set_monitor auto_fix`, `get_status`) | — external harness, observed tool schema | already wakes a bound session on CI failures, merge conflicts and review comments | EXTERNAL (evaluate before building) |
| desktop `ReadNotifications` / `SendMessage` / `FetchInboxMessage` | — external harness, observed tool schema | per-session inbox and cross-session delivery surfaces | EXTERNAL |
| cross-session inbox socket | — harness env: `CLAUDE_CODE_MESSAGING_SOCKET`, `CLAUDE_CODE_MESSAGING_TOKEN` | the documented idle-wake primitive a plain local script may write to; own-child verification is the escape from the bypass-session HOLD default | NET-NEW |
| webhook receiver / `gh webhook forward` adapter | — | push source | NET-NEW |
| per-PR dispatch policy + detached fixer-lane launcher | — | one lane per actionable capsule, serialized per PR | NET-NEW |
| conflict row kind + a conflict terminal | — | the `base-drift`/`base-conflict` hole: zero `base-drift` rows exist across 64 checkouts and no loop mode ends on a conflict | NET-NEW |
| `YeetSiblingCollisionRow` producer | `Inbox.ts:245-294` (schema only) | the one row kind designed for cross-checkout delivery has no producer outside tests | NOT FOUND |
| workstation consumer of an AWS push transport | — | no SQS/SNS/EventBridge consumer, no AWS SDK driver, no standing credential, no Actions OIDC role | NOT FOUND |
| GitHub Pulumi provider | — | `@pulumi/github` is in neither the root catalog nor `infra/package.json`; org hooks need `admin:org_hook` | NOT FOUND |
| sub-minute systemd user unit renderer | — | no renderer emits `OnUnitActiveSec` (closest is `OnUnitInactiveSec`, `forwarder.ts:703`) | NOT FOUND |

## 5. Cross-links & provenance

- This packet: [`../CAPTURE.md`](../CAPTURE.md) →
  [`../RESEARCH.md`](../RESEARCH.md) (2026-09-24 research synthesis: external
  landscape, in-repo inventory, harness primitives, measurement, binding gap).
- [`goals/ship-velocity`](../../../goals/ship-velocity/README.md) — live:
  A1 streaming watch + remediate, A2 hook-mutex + ACK inbox, A3 Stop gate,
  A7 monitor hardening (completed-retained). Retired: A4 dead-owner takeover
  + warm fixer, removed by operator PR #921 (2026-08-30) together with the
  published-PR lease, watcher, and mutation fence; only stale `Remediation.ts`
  comments still narrate it.
- [`goals/ship-velocity` C2 backpressure research](../../../goals/ship-velocity/research/c2-yeet-monitor-backpressure.md)
  — Rank 4 already designs the webhook-to-workstation router this packet's
  push-source gap describes (repository webhook or minimal App on the seven
  PR/review/comment events, `HttpRouter` signature verification, delivery-GUID
  dedupe, delivery journal, normalization to `YeetWatchEvent`, routing by
  repository id + PR number + head SHA). Align starts from that design, not a
  blank page.
- [`goals/yeet-pr-resume-footer`](../../../goals/yeet-pr-resume-footer/README.md)
  — the resume footer, session registry, and `yeet resume` (completed-retained;
  PR 2 surfaces still listed in its PLAN). Research measured a 20.3% hole in
  the registry's harness attribution, concentrated in `role=monitored` rows
  written by detached monitors.
- [`goals/time-to-certainty/research/OPPORTUNITIES.md`](../../../goals/time-to-certainty/research/OPPORTUNITIES.md)
  — the 2026-09-12 receipt that opened this packet.
- [`goals/time-to-certainty` B7](../../../goals/time-to-certainty/research/b7-brief.md) —
  the polling half of this packet's gap, built 2026-09-16 as `yeet monitor --until-ready`
  (settle rule, automatic closeout, ready terminal, `pr-merge-ready` row; rulings 41–49).
  Research found the ship has a producer gap: that mode writes only
  `pr-merge-ready`.
- [`goals/time-to-certainty/research/decisions.md`](../../../goals/time-to-certainty/research/decisions.md)
  — ruling 46 scheduled the `FileChanged` + `asyncRewake` idle-wake spike as a
  bounded PR2 experiment (lines 528-540); it is still unexercised and unwired
  eight days later. Ruling 49 narrowed the settle budget to registration waits,
  which is why a conflict is a named unbounded wait rather than a timeout.
- [`goals/ci-fleet-endgame`](../../../goals/ci-fleet-endgame/README.md) — owns
  the only live GitHub-webhook receiver in the repo (the CI runner autoscaler),
  its 1Password → SSM secret chain
  ([`research/secrets.md`](../../../goals/ci-fleet-endgame/research/secrets.md)),
  and the signed cost ceiling
  ([`research/runner-endgame-decision-record.md`](../../../goals/ci-fleet-endgame/research/runner-endgame-decision-record.md)).
  Any change to that receiver is a CI-availability decision, not a side project.
- [`explorations/fleet-coordination`](../../fleet-coordination/README.md) —
  routing and lease laws for sibling checkouts, and — in
  [`research/T3-delivery-vector.md`](../../fleet-coordination/research/T3-delivery-vector.md)
  and `research/T6-cross-session-messaging.md` — the measured answer to this
  packet's idle-wake gap: `asyncRewake` exit 2 wakes an idle session but is
  unreachable before a session's first tool call and cannot interrupt an
  in-flight tool call, and `FileChanged` is a measured trap with no injection
  and no decision control.
- 2026-09-25 grill-with-docs round (`DECISIONS.md` D16–D27): the doctrine
  surfaces audited were `standards/ARCHITECTURE.md`,
  `standards/architecture/{README,GLOSSARY,DECISIONS,03,04,06,07,09,10,12}.md`,
  `standards/git-worktrees.md`, `standards/generated-artifacts.policy.md`,
  `standards/memory-architecture/04-decision-log.md` and `AGENTS.md`; the
  sibling packets were `goals/time-to-certainty` (rulings 39, 41, 42, 46–48;
  proposed amendments now recorded there as round 22),
  `goals/ship-velocity` (A1 acceptance and spawn clause, now annotated;
  `research/c2-yeet-monitor-backpressure.md` Rank 4 constraints carried into
  the brief's receiver gate), `goals/yeet-pr-resume-footer` (Codex live guard,
  unshipped PR-2 scope), `goals/fleet-mirror` and
  `explorations/fleet-coordination` D7 (rung-2 push is mirror-fact
  acceleration; this packet's wake is a distinct delivery). New bricks named
  by that round: `internal/cli/EnvConfig.ts` (redacted config reads),
  `internal/repo-run/ProcessIdentity.ts` (pid-reuse fence for the tail's
  self-reap), `internal/repo-run/ProcessAttachment.ts` and
  `Worktree.service.ts:1289-1300` (the retire fence a detached tail must not
  trip), `packages/foundation/modeling/utils/src/FileSystem.ts:507-515`
  (`makeWaitForFile`, the only in-repo file watcher), and
  `test/yeet-status-triage.test.ts:861-869` (the legacy status snapshot the
  widened check schema must keep decoding).

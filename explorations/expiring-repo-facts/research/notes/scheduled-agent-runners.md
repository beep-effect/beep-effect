# Scheduled / event-triggered unattended AI coding agents that open PRs (2025-2026)

Research date: 2026-10-22. Primary sources fetched live where noted; third-party sources flagged.

## Claude Code: scheduled tasks (formerly routines), claude-code-action on `schedule:`, headless `claude -p`

### Takeaway
Anthropic ships two distinct unattended paths. (1) Cloud "scheduled tasks" (renamed from "routines"; research preview) run on Anthropic infra or a self-hosted environment, with schedule (recurring or one-off at a timestamp), API `/fire`, and GitHub PR/release triggers, and push to `claude/` branches. (2) `anthropics/claude-code-action@v1` runs on your own GitHub runner in "automation mode" whenever a `prompt` input is given, including `on: schedule`. Neither is provider-agnostic (Claude models only, via Anthropic API, subscription OAuth token, Bedrock, Vertex/Agent Platform, or Foundry).

### Cited Findings
**Cloud scheduled tasks (routines)**
- A scheduled task is "a saved Claude Code configuration: a prompt, one or more repositories, and a set of connectors"; runs on Anthropic-managed cloud or "your organization's self-hosted environment when routed there". Status: research preview. — [Claude Code docs: scheduled tasks](https://code.claude.com/docs/en/routines)
- Triggers: Schedule (hourly/nightly/weekly or "once at a specific future time"), API (HTTP POST with bearer token), GitHub (repository events). A task can combine triggers and needn't have a schedule. — [same](https://code.claude.com/docs/en/routines)
- Custom cron supported via edit dialog or `/schedule update`; "Expressions that run more often than once per hour are rejected." Runs scheduled exactly on the hour "can start several minutes late"; docs advise e.g. 9:07. — [same](https://code.claude.com/docs/en/routines)
- One-off runs: "runs the task a single time at a specific timestamp"; afterwards it turns itself off and is marked Completed. CLI: `/schedule in 2 weeks, open a cleanup PR that removes the feature flag`; Claude resolves natural language to an absolute timestamp and confirms. — [same](https://code.claude.com/docs/en/routines)
- Availability: Pro, Max, Team, Enterprise. Managed at claude.ai/code/routines or via `/schedule` (alias `/routines`). `/schedule` requires a claude.ai subscription login (not Console API key or Bedrock/Vertex/Foundry). — [same](https://code.claude.com/docs/en/routines)
- API trigger: `POST https://api.anthropic.com/v1/claude_code/routines/<trig_id>/fire` with beta header `experimental-cc-routine-2026-04-01`; optional `text` field arrives wrapped in a `<routine-fire-payload>` block labeled untrusted; prompt must opt in to acting on it. Returns session id/URL. — [same](https://code.claude.com/docs/en/routines)
- GitHub triggers: only Pull request and Release event categories; PR filters on author, title, body, base/head branch, labels, is-draft, is-merged; per-task and per-account hourly caps, excess events dropped. Requires Claude GitHub App. — [same](https://code.claude.com/docs/en/routines)
- Output: each repo cloned per run; Claude pushes to `claude/`-prefixed branches; branch protection/rulesets control what it can push. Commits/PRs appear as the user's GitHub identity. A green run status "does not mean the work your prompt describes succeeded." — [same](https://code.claude.com/docs/en/routines)
- Permissions: cloud runs start in auto mode (classifier allows/blocks); runs stop and wait on ask-rule matches or repeated-block thresholds. — [same](https://code.claude.com/docs/en/routines)
- Network: Default environment "Trusted" allowlist; non-allowlisted hosts get 403 `x-deny-reason: host_not_allowed`. — [same](https://code.claude.com/docs/en/routines)
- Limits: scheduled runs 100/hour per account; Run now + API fires 30/hour per task; on hitting subscription usage limits, runs are rejected until reset unless usage credits (metered overage) are on. GitHub disconnection: skips runs up to 72 h, then the task turns off. — [same](https://code.claude.com/docs/en/routines)
- Two other local schedulers exist: Desktop scheduled tasks and `/loop` (in-session). — [same](https://code.claude.com/docs/en/routines)

**claude-code-action (GitHub Action)**
- v1; mode auto-detected: Interactive (no `prompt`, waits for `@claude`) vs Automation (`prompt` given, runs on any event "including a cron schedule"). — [Claude Code docs: GitHub Actions](https://code.claude.com/docs/en/github-actions)
- Scheduled example: `on: schedule: - cron: "0 9 * * *"`, `prompt:` plus `claude_args: --model claude-opus-5-5 --allowedTools "mcp__github__list_commits,..."`. With a plain prompt Claude "has no shell or GitHub API access until you grant the tools". GitHub runs scheduled workflows only from the default branch and disables schedules after 60 days of inactivity in public repos. — [same](https://code.claude.com/docs/en/github-actions)
- Auth: `anthropic_api_key`, `claude_code_oauth_token` (subscription; from `claude setup-token`), workload identity federation via OIDC (`anthropic_federation_rule_id` etc., needs `id-token: write`), `use_bedrock` / `use_vertex` / `use_foundry`. Org-shared secret should be an API key, since an OAuth token is tied to one person's subscription. — [same](https://code.claude.com/docs/en/github-actions)
- Actor checks: write-access check skipped for `schedule`; bot actors rejected unless in `allowed_bots` (applies to scheduled runs attributed to the last cron editor). — [same](https://code.claude.com/docs/en/github-actions)
- Gotcha: commits made with default `GITHUB_TOKEN` do not trigger CI; use the Claude App or a custom app token. — [same](https://code.claude.com/docs/en/github-actions)
- Least privilege: the official Claude GitHub App bundles a broad permission set (Actions RW, Workflows RW, Repository hooks RW, etc.); docs recommend a custom GitHub App with only Contents/Issues/Pull requests if you need narrower scope. — [same](https://code.claude.com/docs/en/github-actions)
- Action is built on the Claude Agent SDK; repo landing page notes v1.0 + migration guide from v0.x/beta (`direct_prompt`→`prompt`, `mode` removed). — [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action); [docs](https://code.claude.com/docs/en/github-actions)

### Inferences
- For a self-hosted workstation, the provider-agnostic route is not the cloud routine but `claude -p` (or any CLI) launched by a local scheduler; cloud routines are Anthropic-locked and bill the subscription.
- Cloud routines are the only first-party product found with a native "one-off at datetime T" trigger, but they are hour-granular-ish (no sub-hourly cron, on-the-hour skew).

### Gaps
- I did not fetch a dedicated page for headless `claude -p` flags in this pass (covered generally by `claude_args` accepting any CLI argument). Self-hosted environment routing details were not fetched.

## GitHub Agentic Workflows (gh-aw): architecture, engines, safe-outputs, schedules

### Takeaway
gh-aw (now at `github/gh-aw`, docs at github.github.com/gh-aw) is the most fully developed provider-agnostic, PR-only, schedule-native design: Markdown + YAML frontmatter compiled by `gh aw compile` into a `.lock.yml` Actions workflow whose agent job is read-only and sandboxed, with all writes buffered as "safe outputs" and applied by separate permission-scoped jobs only after an AI threat-detection job approves. Engines are pluggable (copilot default, claude, codex, pi, gemini [deprecated], agy [experimental], plus custom engine definitions / `command` override), but fallback is same-provider model fallback only; cross-provider chains fail compilation.

### Cited Findings
**Format and repo**
- Each workflow is a Markdown file; YAML frontmatter configures triggers, permissions, tools, engine; body is the instruction. `gh aw compile` validates and generates `.lock.yml`. Repo page at github.com/github/gh-aw (~5.4k stars, ~19k commits on main at fetch). Security advisory GHSA-8h78-hpm7-29gg affected `>= 0.83.3, < 0.85.4` (those releases retired). — [github/gh-aw](https://github.com/githubnext/gh-aw)
- Agent jobs default to read-only GitHub access and sandboxed execution; writes buffered, validated, then applied in separate jobs with scoped permissions. — [github/gh-aw](https://github.com/githubnext/gh-aw)

**Job graph (architecture)**
- Pre-Activation (role/permission check, stop-after deadline, skip-if-match, command-position validation) → Activation (context, sanitize event text, validate lock file) → Agent (checkout, runtime setup, cache, start MCP containers, generate prompt, run engine, redact secrets, upload artifact) → Detection (download artifact, AI + custom analysis, verdict) → Safe output jobs (`create_issue`, `add_comment`, `create_pull_request`, `add_labels`, each scoped) → Conclusion. — [gh-aw architecture](https://github.github.com/gh-aw/introduction/architecture/)
- Writes are "buffered as artifacts by SafeOutputs" in `agent_output.json`. Detection job downloads `agent_output.json`, `aw.patch`, `prompt.txt`, runs a security-prompted agent plus optional custom steps (e.g. TruffleHog, Semgrep), has no write permission, and "A threat blocks all external writes." — [same](https://github.github.com/gh-aw/introduction/architecture/)
- Network firewall (AWF): agent runs in a container; iptables redirects HTTP/HTTPS through a Squid proxy enforcing a domain allowlist; AWF drops iptables capabilities before agent launch. Chroot mode mounts host dirs read-only under `/host`. ARC DinD enforces egress via Docker network topology. Cloud Hypervisor (preview) runs the agent in a KVM microVM. — [same](https://github.github.com/gh-aw/introduction/architecture/)
- MCP gateway `gh-aw-mcpg` spawns MCP server containers; for supported engines AWF can create a trusted `api-proxy` that routes model traffic; gateway agent ID should be "treated as leaked by design". Secrets passed as env vars; redaction runs `if: always()` over `/tmp/gh-aw`. — [same](https://github.github.com/gh-aw/introduction/architecture/)

**Engine abstraction**
- Engines: `copilot` (default, or omit), `claude`, `codex`, `pi` (built-in), `gemini` (deprecated), `agy` (experimental). — [gh-aw engines reference](https://github.github.com/gh-aw/reference/engines/)
- Object form options: `id` (built-in or imported custom engine ID), `model` (exact, alias, or provider-prefixed), `version` (override compiler-pinned CLI version), `env`, `args` (extra native-CLI args), `command` (replaces executable, skips installer), `api-target` (endpoint hostname), `harness` (wrapper/retry settings for Copilot/Claude/Codex), `bare` (disable ambient discovery). — [same](https://github.github.com/gh-aw/reference/engines/)
- Custom engines supported via imported engine definitions, custom `command`, or custom `harness`. — [same](https://github.github.com/gh-aw/reference/engines/)
- Fallback: no cross-engine fallback. `fallback-models` gives an ordered same-provider list; AWF retries on server errors, timeouts, unsupported models, some availability errors; does NOT switch on auth failures, rate limits (HTTP 429), policy failures, cancellations, or job timeouts. "Cross-provider chains fail compilation." — [same](https://github.github.com/gh-aw/reference/engines/)

**Safe outputs for PRs**
- `create-pull-request`: `title-prefix`, `labels`, `reviewers`, `team-reviewers`, `assignees`; `draft` defaults true and "is a policy, not a default, so the agent cannot override it"; `max` default 1, a per-run quota shared by all agents/sub-agents; `if-no-changes` warn/error/ignore; `fallback-as-issue` default true; `github-token` / `head-github-token` / `head-github-app`. — [gh-aw PR safe outputs](https://github.github.com/gh-aw/reference/safe-outputs-pull-requests/)
- Branch controls `base-branch`, `allowed-base-branches` (glob), `allowed-branches`; patch limits `max-patch-files` (default 100), `max-patch-size` (default 4096 KB); `excluded-files`; `allowed-files` exclusive allowlist; protected files on by default with policy `request-review` (creates PR and submits REQUEST_CHANGES), alternatives `blocked`, `fallback-to-issue`, `allowed`. — [same](https://github.github.com/gh-aw/reference/safe-outputs-pull-requests/)
- `push-to-pull-request-branch`: gated by `required-title-prefix` / `required-labels`; agent "does not specify the destination branch"; `signed-commits` default true; `fallback-as-pull-request` on non-fast-forward. — [same](https://github.github.com/gh-aw/reference/safe-outputs-pull-requests/)
- Copilot handoff safe outputs: `create-agent-session` (spawns Copilot coding agent session; max default 1, up to 10) and `assign-to-agent` (assign Copilot to existing issues/PRs); both need a fine-grained PAT. — [gh-aw Copilot cloud agent reference](https://github.github.com/gh-aw/reference/copilot-cloud-agent/)

**Schedules and triggers**
- Fuzzy schedules (`daily`, `daily on weekdays`, `hourly`, `every 2h`, `weekly on monday`, `bi-weekly`, `daily around 14:00`, `between`) "distribute workflow execution times deterministically across all workflows", derived from file path; compile to cron (e.g. `43 5 * * *`); `on: daily` also adds `workflow_dispatch`. Fixed cron in list form, UTC default, optional IANA `timezone`; GitHub Actions 5-minute minimum. — [gh-aw schedule syntax](https://github.github.com/gh-aw/reference/schedule-syntax/)
- `stop-after` (absolute date or `+7d`, hour granularity) disables triggering after a deadline; `skip-if-match` / `skip-if-no-match` gate on GitHub search query counts; `manual-approval` uses GitHub environment protection rules; `roles` exact-match allowlist default `[admin, maintainer, write]`; `label_command` one-shot label trigger; no dedicated one-shot datetime trigger documented. — [gh-aw triggers](https://github.github.com/gh-aw/reference/triggers/)

### Inferences
- gh-aw's `skip-if-match` + fuzzy `daily` is effectively a "poll and act only if there is due work" pattern, not an exact-time wakeup; for "wake at T" it would rely on a GitHub search query (e.g. issues with a due label) evaluated at each scheduled tick.
- `stop-after` is the closest thing to an expiring workflow; it expires the workflow rather than a fact.
- The engine abstraction is the strongest model for "swap the CLI" but intentionally refuses cross-provider quota fallback, which is the opposite of the user's Claude→Codex→Cursor→Grok chain; that logic must live outside gh-aw (e.g. separate workflows or a custom `command` wrapper).

### Gaps
- Exact wire format of safe outputs (MCP tool vs JSONL file) was not stated on the architecture page; the docs nav lists a "Safe Outputs MCP Gateway Specification" I did not fetch.
- Required secrets per engine were deferred to an Authentication reference I did not fetch.
- Whether gh-aw can run on self-hosted runners outside GitHub (it compiles to Actions; ARC DinD is mentioned) was not explored beyond the ARC note.

## Other platforms: Copilot coding agent, Codex action, Cursor, Jules, OpenHands, Devin/aider/Continue/Sweep/Factory

### Takeaway
Most vendor cloud agents now have native schedules (Cursor Automations Mar 2026, Jules scheduled tasks ~Jan 2026, OpenHands Automations beta) but each is locked to its vendor's runtime. Copilot coding agent has no native cron but is assignable via GraphQL API, so a scheduled workflow (or gh-aw `assign-to-agent`) can drive it. `openai/codex-action@v1` is a runner-side primitive with notable privilege-reduction controls but no built-in PR creation.

### Cited Findings
- **Copilot coding agent**: issues can be assigned via the GraphQL API with a user token (PAT or GitHub App user-to-server); `suggestedActors` reveals whether the agent is enabled; Copilot reads title, description, existing comments only at assignment. — [GitHub docs: using Copilot to work on an issue](https://docs.github.com/en/copilot/using-github-copilot/coding-agent/using-copilot-to-work-on-an-issue)
- Copilot opens a draft PR on a `copilot/` branch; draft PRs need human approval before CI runs; GA March 2026 — third-party, unverified against GitHub: [noqta](https://noqta.tn/en/blog/github-copilot-coding-agent-autonomous-pr-issues-2026). Jira assignment in public preview 2026-03-05 — [GitHub changelog](https://github.blog/changelog/2026-03-05-github-copilot-coding-agent-for-jira-is-now-in-public-preview/)
- **openai/codex-action@v1**: inputs `prompt`/`prompt-file`, `model`, `effort`, `permission-profile` (recommended `":workspace"`, needs Codex CLI ≥ 0.138.0), legacy `sandbox`, `safety-strategy` = `drop-sudo` (default; revokes sudo and root-owned sockets incl. Docker), `unprivileged-user`, `read-only` (API key still flows through proxy, readable from process memory), `unsafe` (required on Windows); `allow-users`/`allow-bots`; output `final-message`. Auth: `openai-api-key` (Azure OpenAI via custom `responses-api-endpoint`). Example is a PR review bot chained with `actions/github-script`; no PR-creation or schedule example. — [openai/codex-action](https://github.com/openai/codex-action)
- **Cursor Automations** (launched 2026-03-05): Cloud Agents in background on schedule or events (GitHub, GitLab, Slack, webhooks, Linear); each run gets an isolated environment; credits per run; created in Agents Window or cursor.com/automations/new. — [Cursor changelog 03-05-26](https://cursor.com/changelog/03-05-26); [Cursor help: Automations](https://cursor.com/help/ai-features/automations); [TechCrunch](https://techcrunch.com/2026/03/05/cursor-is-rolling-out-a-new-system-for-agentic-coding). Raw cron syntax not confirmed.
- **Google Jules**: scheduled tasks for recurring maintenance/dependency checks and "suggested tasks" (scans TODOs); reported for AI Pro/Ultra plans; Render integration proposes fix PRs on failed deploys. Sources are secondary (Jan 2026). — [Tessl](https://tessl.io/blog/google-wants-to-make-jules-a-more-proactive-coding-colleague); [HackerNoon](https://sia.hackernoon.com/googles-jules-starts-surfacing-work-on-its-own-signaling-a-shift-in-ai-coding-assistants). Free tier 15 tasks/24h, 3 concurrent (checked 2026-09-15, secondary) — [rywalker.com](https://rywalker.com/research/jules)
- **OpenHands**: Automations (beta, Cloud/Enterprise only) schedule full OpenHands conversations; GitHub Action / resolver is label- (`fix-me`) or `@openhands-agent`-triggered, not cron; model-agnostic via LiteLLM (`LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL` incl. local Ollama/vLLM). — [OpenHands Automations](https://docs.openhands.dev/openhands/usage/automations/overview); [OpenHands GitHub Action](https://docs.openhands.dev/openhands/usage/run-openhands/github-action); [Railway template (third-party)](https://railway.com/deploy/openhands-issue-resolver)
- OpenHands CLI headless mode hardcodes always-approve; current CLI is `uv tool install openhands`, `openhands-ai` is legacy V0 SDK — third-party skill doc: [Hermes agent OpenHands skill](https://hermes-agent.nousresearch.com/docs/user-guide/skills/optional/autonomous-ai-agents/autonomous-ai-agents-openhands)

### Inferences
- OpenHands is the only mainstream agent here that is model-agnostic at the LLM layer (LiteLLM) and self-hostable; gh-aw is agnostic at the agent-CLI layer.
- Any GitHub Action wrapper (claude-code-action, codex-action, OpenHands action) can be put on `on: schedule` even if its docs only show event triggers, since automation mode / prompt input is event-independent.

### Gaps
- Devin, aider-in-CI, Continue CI agents, Sweep, and Factory droids: not researched in this pass (budget). Factory Droid appears in the ACP agent list (below). No sourced statements on their schedulers.
- Copilot coding agent native scheduling: no evidence found of a built-in cron; only API/assignment entry points.
- Codex cloud tasks scheduling: not researched.

## Multi-CLI orchestrators and quota fallback (ACP, agentapi, vibe-kanban, claude-squad)

### Takeaway
ACP (Zed's Agent Client Protocol) has become the de facto abstraction over agent CLIs, with a very large agent directory (Claude via adapter, Codex via codex-acp, Gemini CLI, Cursor, Copilot preview, Junie, Factory Droid, OpenHands, Goose, OpenCode, Kiro, Qwen, etc.). coder/agentapi, the older terminal-scraping HTTP wrapper, is deprecated and archived. No orchestrator found documents automatic cross-provider quota fallback; gh-aw explicitly excludes 429s from its fallback.

### Cited Findings
- ACP agent directory lists Claude Agent (via Zed SDK adapter), Codex CLI (codex-acp adapter), Gemini CLI, Cursor (CLI ACP docs), GitHub Copilot (public preview), Junie by JetBrains, Factory Droid, Goose, OpenCode, OpenHands, Kiro CLI, Qwen Code, Kimi CLI, Mistral Vibe, Pi (pi-acp adapter), Cline, Augment, Docker cagent, and many others. — [ACP agents](https://agentclientprotocol.com/overview/agents)
- coder/agentapi: HTTP API over Claude Code, Amazon Q, Opencode, Goose, Aider, Gemini, Copilot, Amp, Codex, Auggie, Cursor CLI via an in-memory terminal emulator (keystroke injection, snapshot diffing); endpoints `GET /messages`, `POST /message`, `GET /status` (stable/running), `GET /events` SSE. "AgentAPI is deprecated and no longer maintained"; repo archived; recommends Coder Agents / Coder Registry modules. — [coder/agentapi](https://github.com/coder/agentapi)
- Vibe Kanban integrates Claude Code, Codex, etc., runs agents in parallel/sequence, creates PRs; runs agents with `--dangerously-skip-permissions`/`--yolo` by default; bloop announced shutdown, project continues community-maintained (secondary sources). — [jimmysong.io](https://jimmysong.io/en/ai/vibe-kanban); [Mark Ferree](https://markferree.substack.com/p/agent-orchestration-for-the-timid)
- gh-aw same-provider `fallback-models` explicitly does not switch on HTTP 429 and forbids cross-provider chains. — [gh-aw engines](https://github.github.com/gh-aw/reference/engines/)

### Inferences
- A provider-agnostic scheduled runner should target ACP (structured JSON sessions) rather than PTY scraping (agentapi's approach, now abandoned).
- Quota-exhaustion fallback across providers appears to be a gap in published tooling; it would need to be owned by the scheduler/orchestrator (classify failure as quota/availability vs code failure, then relaunch on the next CLI).

### Gaps
- claude-squad and terragon: no primary sources fetched; feature claims unverified. Terragon status (2026) unknown.
- ACP protocol mechanics (stdio JSON-RPC, session model) not fetched from the spec page in this pass.

## Durable "wake me at time T" schedulers for a self-hosted box

### Takeaway
For per-item exact-time wakeups, systemd transient timers (`systemd-run --user --on-calendar=...`), Temporal timers, Inngest `step.sleepUntil` / event `ts`, Trigger.dev `wait.until`, and Restate delayed sends all provide event-driven, non-polling wakeups at an absolute time; GitHub Actions cron and Claude routines are periodic ticks that must poll for due items. systemd is the lowest-dependency choice on a workstation, but transient units need a durability plan.

### Cited Findings
- `systemd-run --on-calendar=` "Defines a calendar timer for starting the specified command" (shortcut for `--timer-property=OnCalendar=`); creates a transient timer unit alongside the service; `--user` talks to the calling user's manager; cannot combine with `--scope`/`--pty`. Man page does not state reboot persistence of transient units. — [systemd-run(1)](https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html)
- `systemd.timer`: `Persistent=` stores last trigger time on disk to catch up missed runs (OnCalendar only, default false); `AccuracySec=` defaults to 1min; `RandomizedDelaySec=` spreads timers; `WakeSystem=` can resume from suspend (generally system manager only). — [systemd.timer(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)
- Temporal durable timers: stored by the service, survive Worker/service outages, can last days to years, "millions of Timers off a single Worker". — [Temporal Go timers](https://docs.temporal.io/develop/go/timers); [Temporal timers tag](https://docs.temporal.io/tags/timers)
- Inngest: `step.sleep()`, `step.sleepUntil()` for a specific date-time; sleeps up to a year (7 days on free plan); or schedule a function by setting event `ts`; durable across restarts/redeploys. — [Inngest delayed functions](https://www.inngest.com/docs/guides/delayed-functions.md); [Inngest sleeps](https://www.inngest.com/docs/features/inngest-functions/steps-workflows/sleeps)
- Trigger.dev: `wait.for()`, `wait.until(date)`, `wait.forToken()`; waits > ~5 s are checkpointed and consume no compute. — [Trigger.dev wait](https://trigger.dev/docs/wait)
- Restate: `ctx.sleep()` durable with no hard limit; delayed one-way sends are durably stored and delivered "no earlier than specified ... but may happen later"; Restate recommends delayed messages over long sleeps. — [Restate durable timers (TS)](https://docs.restate.dev/develop/ts/durable-timers); [ClientSendOptions](https://docs.restate.dev/tsdocs/types/_restatedev_restate-sdk.ClientSendOptions)
- GitHub Actions scheduled workflows have a 5-minute minimum interval — [gh-aw schedule syntax](https://github.github.com/gh-aw/reference/schedule-syntax/); run only from default branch and auto-disable after 60 days inactivity in public repos — [Claude Code GitHub Actions docs](https://code.claude.com/docs/en/github-actions). Claude routines reject sub-hourly cron — [routines](https://code.claude.com/docs/en/routines).

### Inferences
- Transient systemd units live in the runtime directory and are generally lost on reboot (inference; not stated on the fetched man page). A robust pattern is: the source-of-truth ledger (a file in the repo with expiry dates) is re-reconciled by a persistent daily `OnCalendar=` timer with `Persistent=true`, which (re)creates per-item transient timers or simply acts on items now due. That combines exact-time wakeups with reboot safety.
- Temporal/Restate/Inngest/Trigger.dev each require running a server (all four have self-host options, not verified in this pass); for one workstation, systemd plus a reconciler is lighter.
- Poll vs exact: GH Actions cron, gh-aw fuzzy schedules, Claude routines, Cursor/Jules automations = periodic poll; systemd OnCalendar per item, Temporal timers, Inngest sleepUntil/ts, Trigger.dev wait.until, Restate delayed send = per-item exact (within AccuracySec / "no earlier than" semantics).

### Gaps
- Self-hosting status and licensing of Inngest, Trigger.dev, Restate not verified here. `at`(1) not researched. Trigger.dev max wait length not found.

## Safety patterns: least-privilege tokens, PR-only outputs, review gates

### Takeaway
The converging pattern across gh-aw, Claude routines, Copilot agent and codex-action is: read-only agent sandbox, writes only through a narrow PR channel on a prefixed branch, draft-by-default, branch protection as the hard boundary, scoped/short-lived tokens (OIDC federation or minimal GitHub App), egress allowlists, and an untrusted-input wrapper for trigger payloads. gh-aw adds a separate AI threat-detection gate before any write.

### Cited Findings
- gh-aw: agent job read-only; writes in separate scoped jobs after a detection verdict; Squid egress allowlist; secret redaction; draft PR enforced as policy; patch size/file limits; protected-files default `request-review`; `manual-approval` via environment protection; `roles` allowlist. — [architecture](https://github.github.com/gh-aw/introduction/architecture/); [PR safe outputs](https://github.github.com/gh-aw/reference/safe-outputs-pull-requests/); [triggers](https://github.github.com/gh-aw/reference/triggers/)
- Claude routines: `claude/` branch prefix; branch protection/rulesets are the control; fire payload wrapped as untrusted; Trusted network allowlist; fired prompt "can't act as approval or consent". — [routines](https://code.claude.com/docs/en/routines)
- claude-code-action: OIDC workload identity federation avoids long-lived secrets; custom minimal GitHub App recommended for least privilege; `allowed_bots` loop prevention; tools must be explicitly allowed via `--allowedTools`. — [GitHub Actions docs](https://code.claude.com/docs/en/github-actions)
- codex-action: `drop-sudo` default, `unprivileged-user`, `read-only`; explicit warning that the API key is readable from process memory even in read-only. — [openai/codex-action](https://github.com/openai/codex-action)
- Vibe Kanban runs agents with permission bypass by default (counter-example). — [Mark Ferree](https://markferree.substack.com/p/agent-orchestration-for-the-timid)

### Inferences
- For a self-hosted scheduled runner, the gh-aw split (agent produces a patch artifact with no push credentials; a separate privileged step validates and opens a draft PR) is reproducible locally: run the agent CLI without GitHub write tokens in a worktree, then have the wrapper push and open the PR.

### Gaps
- No quantitative data on incident rates or effectiveness of AI threat-detection gates.

# Sources

Carried from the exploration ledger `explorations/cursor-agent-pool/research/SOURCES.md` (primary);
this copy reproduces the corpus for implementation. Lane reports live in the exploration packet.

## In-repo bricks

| Brick | Path | Disposition |
| --- | --- | --- |
| Cursor lane recipe (D13) | `goals/tsgo-045-effect-idiom-sweep/ops/prompts/50-cursor-lane.md` | promote to `docs/runbooks/agent-pools.md` |
| Cursor smoke test record | `goals/tsgo-045-effect-idiom-sweep/history/2026-09-12-cursor-smoke.md` | cite as admission proof |
| Claude hooks | `.claude/settings.json`, `.claude/hooks/*.sh` | parity target |
| Codex hooks + subagents | `.codex/hooks.json`, `.codex/agents/*.toml` | parity target, mirror into `.cursor/` |
| AI metrics forwarder | `packages/tooling/tool/cli/src/commands/AIMetrics/` | Cursor lanes must be visible here |
| Cloud Agent bootstrap | `.cursor/environment.json`, `.cursor/install.sh` | existing Cursor surface |
| Pool-selection doctrine | `AGENTS.md` "Token-heavy Codex work" | amend into pool order |

## Upstream repos (reference only — none vendored)

| Repo | License | Disposition |
| --- | --- | --- |
| github.com/SinanTufekci/agent-intern (cursor_bridge.py) | unverified | reference only: stream-json parse + resume pattern |
| github.com/StrawCoding/hermes-cursor-agent | unverified | reference only: model-exhausted retry with `auto` |
| github.com/cnwinds/cursor-pulse, github.com/robinebers/openusage | unverified | reference only: private usage endpoints — NOT to be used (D17) |
| github.com/openai/codex (codex-rs/app-server README) | Apache-2.0 | cite for `account/rateLimits/read` |

## External citations

Full per-lane `## Sources` sections live in `research/2026-09-16-L*-*.md`; the merged table follows.

## External citations (merged from lane sidecars, accessed 2026-09-16)

| Lane | URL | Supports |
| --- | --- | --- |
| L2b | https://agent-plugins.org/plugin-authors/manifest.md | Portable root plugin.json closed schema ($schema, name, version, extensions) |
| L3b | https://artificialanalysis.ai/articles/benchmarking-gpt-6-astra | 2026-09-09: Astra Index 53 tie Fable; Coding Agent 62; TB v4 59 vs Fable 52 vs Sol 40; cost/task $3.26 vs $7.6 |
| L3b | https://cursor.com/blog/grok-4-6 | 2026-08-12 jointly trained; matches Sol on AA Intelligence Index; $2/$6; Fast 2x |
| L1b | https://cursor.com/changelog | --add-dir 2026-06-29; --auto-review 2026-06-22; --yolo covers trust/MCP Feb 2026; stdin hang fix; persist/deta |
| L3b | https://cursor.com/changelog/composer-2-5 | 2026-05-18 announcement; Fast prices; benchmark tables are images |
| L3b | https://cursor.com/composer | Composer 2.5 CursorBench 4.0 27.7 percent, $0.68/task, 17347 tokens, 41 steps |
| L3b | https://cursor.com/data-use | ZDR with providers except designated Non-ZDR; Privacy Mode off may train; Customer Data not used for Cursor tr |
| L3b | https://cursor.com/docs/account/pricing | Ultra $200/mo; 20x Pro limits on Agent; no live $400 figure |
| L3b | https://cursor.com/docs/account/teams/admin-api | Team-only POST /teams/spend, /teams/daily-usage-data, /teams/filtered-usage-events; Basic auth; no individual  |
| L1b | https://cursor.com/docs/agent/security/run-modes | Auto-review/Allowlist/Run Everything; --force approximates Run Everything; Cloud Agents ignore Run Modes; Linu |
| L4 | https://cursor.com/docs/cli/acp | agent acp JSON-RPC dialect vs -p |
| L1b | https://cursor.com/docs/cli/github-actions | CI example uses CURSOR_API_KEY; omits --trust/--force/--sandbox so not a D13 template |
| L1b | https://cursor.com/docs/cli/headless | print mode; --force/--yolo; --trust; CURSOR_API_KEY; jq consumer; sample exit 0/1; proposed changes not applie |
| L4 | https://cursor.com/docs/cli/overview | Install, modes, sandbox, resume, Cloud handoff |
| L1b | https://cursor.com/docs/cli/reference/authentication | agent login; CURSOR_API_KEY; --api-key; NO_OPEN_BROWSER; AGENT_CLI_CREDENTIAL_STORE=file; documented string No |
| L1b | https://cursor.com/docs/cli/reference/configuration | ~/.cursor/cli-config.json vs <project>/.cursor/cli.json; project file is permissions-only |
| L1b | https://cursor.com/docs/cli/reference/output-format | text/json/stream-json schemas; event types system/user/assistant/tool_call/result; partial-output timestamp_ms |
| L1b | https://cursor.com/docs/cli/reference/parameters | flag table; -p full write+shell; --output-format default text; --force/--yolo alias; --mode plan/ask; --trust; |
| L1b | https://cursor.com/docs/cli/reference/permissions | allow/deny Shell/Read/Write/WebFetch/Mcp; deny wins; approvalMode allowlist/auto-review/unrestricted |
| L1b | https://cursor.com/docs/cli/reference/slash-commands | /ask /plan /run-everything /auto-run /max-mode /resume /sandbox /mcp /config; no /detach or persist on this pa |
| L1b | https://cursor.com/docs/cli/using | Ask is read-only; Plan is planning-first not FS lock; -p has full write access; MCP/rules/AGENTS.md; worktree  |
| L2b | https://cursor.com/docs/cloud-agent | Repo .cursor/hooks.json and environment.json; team MCP; user home hooks unavailable |
| L1b | https://cursor.com/docs/cloud-agent/api/endpoints | https://api.cursor.com v1 public beta; POST /v1/agents; SSE stream; usage; artifacts; GET /v1/models; Basic or |
| L2b | https://cursor.com/docs/cloud-agent/best-practices.md | Cloud reads committed .cursor/rules/*.mdc; recommend skills and agents.md |
| L2b | https://cursor.com/docs/cloud-agent/capabilities | Team-configured MCP; no extra claims about loading AGENTS.md/hooks from this page |
| L1b | https://cursor.com/docs/cloud-agent/self-hosted | agent worker; My Machines vs Team Pools; outbound api2.cursor.sh/S3; caps 200 workers/user 1000/team; not a dr |
| L1b | https://cursor.com/docs/cloud-agent/setup | Cloud VM env; .cursor/environment.json precedence repo>personal>team; not consumed by local -p |
| L2b | https://cursor.com/docs/cloud-agent/setup.md | environment.json install/build.dockerfile; env resolution repo > personal > team |
| L1b | https://cursor.com/docs/configuration/worktrees | --worktree under ~/.cursor/worktrees/<reponame>/<name>; max 25/machine; --worktree-base; --skip-worktree-setup |
| L1b | https://cursor.com/docs/cursor-router | auto-smart; optimize_for cost/balanced/intelligence; Teams/Enterprise only; auto is fallback Auto |
| L2b | https://cursor.com/docs/enterprise/opentelemetry-export | Enterprise OTLP metrics/logs including cursor.hook.execution_complete; no prompts or traces |
| L3b | https://cursor.com/docs/enterprise/privacy-and-data-governance | Most models ZDR; Non-ZDR designated; Privacy Mode training claim |
| L2b | https://cursor.com/docs/enterprise/privacy-and-data-governance.md | Privacy Mode, ZDR, Fable 5/5.1 retention exception, Cloud Agent temporary repo storage |
| L4 | https://cursor.com/docs/grok-bot/teams | Grok Bot can delegate to Cloud Agents |
| L2b | https://cursor.com/docs/hooks | Native hook events, stdin/stdout schemas, Cloud vs local availability, env vars, failClosed, loop_limit, exit  |
| L2b | https://cursor.com/docs/mcp | .cursor/mcp.json and ~/.cursor/mcp.json; ${env:VAR} interpolation; stdio/SSE/HTTP; OAuth callbacks |
| L3b | https://cursor.com/docs/models | Pool membership and $/M prices for Composer, Grok 4.6, Kimi K3, GLM 5.2, Fable, Sol |
| L1b | https://cursor.com/docs/models-and-pricing | Cursor Models vs Other Models; Ultra includes both; Composer 2.5 $0.50/$2.50; Composer 2.5 Fast 6x; Grok 4.6 F |
| L3b | https://cursor.com/docs/models/claude-fable-5-1 | NO ZDR; Anthropic stores I/O ~30 days for harm prevention; admin opt-in if Privacy Mode on |
| L3b | https://cursor.com/docs/models/cursor-composer-2-5 | Fast is default variant; 200k context; Cursor Models pool; $0.50/$2.50 vs Fast $3/$15 |
| L2b | https://cursor.com/docs/plugins | Agent Plugin vs Cursor Plugin component matrix; marketplace install modes; ${CURSOR_PLUGIN_ROOT} |
| L2b | https://cursor.com/docs/reference/permissions.md | mcpAllowlist terminalAllowlist autoRun; team admin > permissions.json > IDE |
| L2b | https://cursor.com/docs/reference/plugins.md | Cursor Plugin manifest fields, folder discovery, commands/agents/hooks/MCP formats, marketplace.json schema |
| L1b | https://cursor.com/docs/reference/sandbox | sandbox.json layers; network default deny; private/loopback/link-local/cloud-metadata blocked; protected .git/ |
| L2b | https://cursor.com/docs/reference/third-party-hooks | Claude settings.json import, event-name map, Notification and PermissionRequest unsupported, Bash→Shell tool m |
| L2b | https://cursor.com/docs/rules | AGENTS.md native nested files, .cursor/rules/*.mdc frontmatter (description, globs, alwaysApply), Team→Project |
| L1b | https://cursor.com/docs/sdk/python | cursor-sdk 3.10+; Agent.prompt ~= -p; LocalAgentOptions.dirs; RateLimitError; local sandbox disabled by defaul |
| L1b | https://cursor.com/docs/sdk/typescript | @cursor/sdk Node 22.13+; dashboard tag SDK; model.params[]; local.autoReview denies in headless; sandboxOption |
| L2b | https://cursor.com/docs/skills | SKILL.md frontmatter, discovery of .cursor/.agents/.claude/.codex skills dirs, Cloud sync only ~/.cursor/skill |
| L1b | https://cursor.com/docs-static/cloud-agents-openapi.yaml | OpenAPI for Cloud Agents; worker/pool under /v0/private-workers; max 4 SSE streams per service account |
| L2b | https://cursor.com/docs/subagents | Agents dirs including .claude and .codex markdown; model/readonly/is_background; editor+CLI+Cloud |
| L3b | https://cursor.com/help/account-and-billing/overages | On-demand must be enabled; hard stop at 100%; individual on-demand no markup; spend-limit lag |
| L3b | https://cursor.com/help/account-and-billing/pricing | Plan pricing help twin of account/pricing |
| L2b | https://cursor.com/help/customization/ignore-files | .cursorignore plus .gitignore exclude AI context; shell and MCP may still read ignored files |
| L2b | https://cursor.com/help/customization/mcp | Project and user mcp.json merge with project-name priority; Cloud team MCP dashboard |
| L2b | https://cursor.com/help/customization/rules | CLAUDE.md always-on, .cursorrules deprecated, ~/.cursor/rules, Agent-chat-only applicability |
| L2b | https://cursor.com/help/customization/skills | Same discovery list; slash-command migration to skills; / and @ invocation |
| L3b | https://cursor.com/help/grok-bot/plans | Grok Bot weekly included vs monthly on-demand; Ultra highest weekly; does not stack SuperGrok; stop if on-dema |
| L3b | https://cursor.com/help/models-and-usage/usage-limits | Cursor Models vs Other Models; no rollover; Pro/Pro+/Ultra include both pools |
| L2b | https://cursor.com/help/security-and-privacy/privacy.md | Privacy Mode how-to; BYOK ZDR exception; Grok Bot separate surface |
| L2b | https://cursor.com/llms.txt | Canonical URL list for rules, skills, hooks, subagents, MCP, plugins, CLI, cloud agents, OTel, privacy |
| L3b | https://cursor.com/pricing | Individual $20 card; Ultra as FAQ power-user recommendation |
| L3b | https://cursor.com/settings | Staff-endorsed individual usage UI plus CSV export; no public JSON API |
| L4 | https://cursor.com/terms-of-service | Updated 2026-09-03; §1.5 reverse-engineer/scrape/probe |
| L4 | https://deepakness.com/raw/composer-2-5-worker/ | Jul 2026 Composer-as-worker vs Grok/GPT planner |
| L4 | https://forum.cursor.com/t/agent-cli-linux-sandbox-preflight-fails-unshare-eperm-unless-run-under-strace-apparmor-restrict-unprivileged-userns-1/160039 | AppArmor missing userns rule; staff Dean Rie |
| L4 | https://forum.cursor.com/t/api-error-we-encountered-an-unexpected-error-repeatedly-when-calling-cloud-agent/165792 | Startup failures used no tokens |
| L4 | https://forum.cursor.com/t/can-anyone-tell-me-how-good-composer-2-5-is/161218 | Worker bees not thinkers; Claude plans Composer implements |
| L3b | https://forum.cursor.com/t/clarification-needed-is-the-2x-included-usage-temporary-and-how-does-it-relate-to-the-50-discount/165990 | zhedream 2026-07-17 in-product 2x popup; Grok 4.5 50% off through 2026-07-21 is a separate expired promo |
| L4 | https://forum.cursor.com/t/cloud-agent-runs-fail-immediately-with-stream-unavailable-run-stream-is-no-longer-available-agent-often-deleted-404-after-first-failed-bootstrap/171407 | Sep 2026 Docker Hub / stream_unavailable failures |
| L4 | https://forum.cursor.com/t/cloud-agents-api-follow-up-runs-accepted-but-end-in-error-with-no-error-payload/165610 | Follow-up 409/ERROR empty payload |
| L4 | https://forum.cursor.com/t/cloud-agents-api-sdk-stream-delivers-intermediate-messages-steps-20-40s-later-than-cursor-com-agents-ui-on-the-same-run/170833 | 20-40s SSE lag vs UI; stream_unavailable race |
| L4 | https://forum.cursor.com/t/cloud-agents-freeze-mid-run-and-never-reach-a-terminal-state-60-consecutive-account-wide-since-18-aug/168957 | v1 status is lifecycle; execution state on runs |
| L4 | https://forum.cursor.com/t/cloud-agent-time-to-live/163040 | Billed tokens plus env setup, not idle |
| L4 | https://forum.cursor.com/t/composer-2-5-is-now-live/160934 | Composer 2.5 based on Kimi K2.5 plus CPT |
| L4 | https://forum.cursor.com/t/cursor-agent-cli-never-invokes-hooks-json-on-linux-2026-08-11-same-version-works-on-macos/168326 | Linux hook spawn exit 127; works on macOS |
| L4 | https://forum.cursor.com/t/cursor-agent-p-hangs-with-zero-output-on-2026-07-01-41b2de7-macos-intel-all-output-formats-even-trivial-prompts/164841 | July 2026 macOS Intel zero-byte hang |
| L4 | https://forum.cursor.com/t/cursor-agent-p-print-headless-mode-hangs-indefinitely-and-never-returns/150246 | Jan-Mar 2026 hang; staff later said fixed |
| L4 | https://forum.cursor.com/t/cursor-agent-print-doesnt-exit-after-completing/150296 | No-exit worker; CI silent --plan; git-diff workaround |
| L4 | https://forum.cursor.com/t/cursor-cli-not-updating-sandboxing-doesnt-work/152649 | uid_map EPERM; chmod 4755 is a bad idea |
| L3b | https://forum.cursor.com/t/cursor-no-longer-allow-to-go-above-100-usage/156209 | 2026-03-30 user-reported auto-switch to Composer 2 at 100%; superseded by current hard-stop docs |
| L4 | https://forum.cursor.com/t/custom-openai-compatible-model-shows-200k-context-limit-for-glm-5-2-even-though-it-supports-1m-context/163360 | Custom OpenAI-compatible models capped at 200K in UI |
| L4 | https://forum.cursor.com/t/disable-permissions-ask-in-sandbox/157243 | Headless --print --trust --sandbox enabled recipe |
| L4 | https://forum.cursor.com/t/does-using-oh-my-pi-s-cursor-provider-or-an-openai-compatible-proxy-to-the-same-endpoints-violate-cursor-s-tos/167778 | Staff: unofficial proxy of private endpoints can ban accounts |
| L4 | https://forum.cursor.com/t/glm-5-2-support/163533 | BYOK; OpenRouter unsupported; 200K context display |
| L4 | https://forum.cursor.com/t/gpt-5-2-sandbox-issues/147855 | Sandbox cmds exit 0 with empty output |
| L4 | https://forum.cursor.com/t/grok-4-6-is-now-live/168189 | Long-running agents plus Extra High; 2x first week |
| L4 | https://forum.cursor.com/t/grok-bot-spend-cursor-usage-i-cant-accept-it/169796 | Grok Bot is a separate weekly included pool |
| L4 | https://forum.cursor.com/t/hooks-afteragentresponse-afteragentthought-not-firing-in-headless-cli/156220 | Staff: afterAgentResponse/Thought known gap in --print |
| L3b | https://forum.cursor.com/t/how-much-usage-is-available-on-the-200-subscription/163309 | Staff mohitjain 2026-06-15: Pro $20, Pro+ $70, Ultra $400 API; 20x = $20x20; Auto/Composer separate |
| L3b | https://forum.cursor.com/t/included-usage-exhausted-why-did-composer-2-5-fast-stop-being-available-for-free/170709 | mmochi 2026-09-05/06 on-demand off: Free Fast leftover then error Total usage limit reached |
| L4 | https://forum.cursor.com/t/kimi-k3-completely-broken-multimodal-capabilities/167295 | Cursor-served Kimi K3 is text-only |
| L3b | https://forum.cursor.com/t/kimi-k3-disoriented-and-expensive-in-cursor/168699 | Josh_Barnett ~$20 on-demand in ~5 minutes looping; staff Colin 2026-08-25: loop evaded protection, not intenti |
| L4 | https://forum.cursor.com/t/linux-sandbox-error-failed-to-apply-sandbox-io-error-step-4-7-mount-denies-failed-mount-count-limit-reached-1000/150926 | Linux sandbox mount-count 1000 |
| L3b | https://forum.cursor.com/t/now-available-2x-included-usage-your-plan-now-includes-2x-usage-for-all-cursor-models-composer-2-5-and-cursor-grok-4-5/166007/4 | Staff deanrie 2026-07-19: 2x first-party Auto/Composer/Grok 4.5 is permanent; not $400 to $800; third-party no |
| L4 | https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032 | Staff: Cursor Models spill into Other Models |
| L3b | https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032/5 | Staff deanrie 2026-08-23: not a bug; Cursor models drain Cursor Models first then spill into Other Models |
| L4 | https://forum.cursor.com/t/praise-for-cursor-composer-2-5/162448 | Frontier plans, Composer executes; staff agrees |
| L4 | https://forum.cursor.com/t/running-out-of-ultra-plan-credits-before-renewal/150012 | Community $400 Other Models figure; 20-day exhaustion |
| L4 | https://forum.cursor.com/t/share-your-thoughts-on-composer-2-5/160935 | Quality mixed; Ultra exhausted in 5-6 days |
| L4 | https://forum.cursor.com/t/share-your-thoughts-on-grok-4-6/168190 | Mixed quality; XHigh fills context; post 91 vs Composer |
| L4 | https://forum.cursor.com/t/subagents-not-working-in-cursor-cli/151046 | CLI Task tool missing Feb 2026; staff working now Mar 5 |
| L3b | https://forum.cursor.com/t/usage-api-cli-command/160967 | Staff Mohit 2026-05-19: no public individual usage API or CLI; settings CSV instead |
| L3b | https://forum.cursor.com/t/will-2x-first-party-be-removed/166672 | Linked thread on 2x persistence; primary staff quote is 166007/4 |
| L4 | https://github.com/awslabs/cli-agent-orchestrator/blob/main/docs/cursor-cli.md | Interactive flags; deliberately omits -p and --trust |
| L4 | https://github.com/BloopAI/vibe-kanban | Sunsetting; Cursor listed among agents |
| L3b | https://github.com/cnwinds/cursor-pulse/blob/master/docs/cursor-usage-api.md | Unofficial api2.cursor.sh DashboardService/GetCurrentPeriodUsage; cents; autoPercentUsed vs apiPercentUsed |
| L2b | https://github.com/cursor/plugin-template | starter-simple and starter-advanced plugin trees (rules, skills, agents, commands, hooks, MCP) |
| L4 | https://github.com/danielsinewe/ralph-cursor | agent --print --force; 20 min timeout; circuit breaker |
| L4 | https://github.com/LarsCowe/bmalph | cursor-agent -p --force --output-format json --resume |
| L4 | https://github.com/lockstride/ralph-wiggum-plugin | stream-json token rotate 150k; DEFER on rate limit |
| L4 | https://github.com/moosl/cursor-auto-pilot | agent -p --output-format=stream-json orchestration |
| L4 | https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md | account/rateLimits/read JSON-RPC |
| L4 | https://github.com/raiyanyahya/loop | cursor-agent -p --force; ralph template |
| L4 | https://github.com/robinebers/openusage/blob/main/docs/providers/cursor.md | Session-token Cursor meter; Cursor vs Other vs Grok Bot |
| L4 | https://github.com/router-for-me/CLIProxyAPI/issues/573 | No Cursor provider; issue closed unresolved |
| L4 | https://github.com/SinanTufekci/agent-intern/blob/main/cursor_bridge.py | create-chat, --resume, stream-json parser, stdin disabled |
| L4 | https://github.com/StrawCoding/hermes-cursor-agent | stream-json OpenAI shim; retry once with auto |
| L4 | https://github.com/taberoajorge/ralph | Ralph loop agent -p --force stream-json sandbox disabled |
| L4 | https://github.com/yinguangyao/coding-agent-runner | Cursor via ACP not -p; Codex app-server; Claude stream-json |
| L4 | https://ianlpaterson.com/blog/tracking-claude-codex-gemini-quotas-from-one-script/ | Unified quota script; Codex rateLimits; no Cursor collector |
| L3b | https://openai.com/index/gpt-6-astra/ | HTTP 403 this pass; do not cite body |
| L3b | https://openai.com/index/introducing-gpt-5-3-codex/ | HTTP 403 this pass; do not cite body |
| L3b | https://raw.githubusercontent.com/cnwinds/cursor-pulse/master/docs/cursor-usage-api.md | Same unofficial individual usage endpoints fetched as raw markdown |
| L2b | https://raw.githubusercontent.com/cursor/plugin-template/main/plugins/starter-advanced/.cursor-plugin/plugin.json | Example Cursor Plugin manifest fields |
| L2b | https://raw.githubusercontent.com/cursor/plugin-template/main/plugins/starter-advanced/hooks/hooks.json | Example plugin hook events afterFileEdit beforeShellExecution sessionEnd |
| L2b | https://raw.githubusercontent.com/cursor/plugin-template/main/README.md | Multi-plugin marketplace.json vs single-plugin .cursor-plugin/plugin.json |
| L4 | https://tovren.com/cursor-composer-2-5-daily-coding-default/ | Composer as daily driver; keep Claude/Codex/Gemini |
| L4 | https://www.conductor.build/docs/concepts/agent-modes | Conductor launches Cursor with CURSOR_API_KEY |
| L1b | https://www.cursor.com/schemas/environment.schema.json | Cloud env JSON schema; no magic .cursor/install.sh filename |
| L4 | https://www.learncursor.dev/learn/cursor-for-teams/cursor-usage-limits | Secondary source: Ultra Other Models $400 |
| L1b | https://x.com/360Axe/status/2100139325228752986 | operator report that Ultra included usage and Grok Bot weekly are separate meters |
| L4 | https://x.com/codedibia/status/2072358774757556499 | 2026-07-01 cursor-agent -p stream-json --stream-partial-output gotchas |
| L4 | https://x.com/GitTrend0x/status/2088436058602238084 | 2026-08-15 hermes-cursor-agent and cursor-hermes-plugin |
| L4 | https://x.com/grok/status/2086484877860339853 | 2026-08-09 session_id preserved for Cursor/Grok backends |
| L1b | https://x.com/grok/status/2100073210888819194 | Cursor CLI draws the Cursor plan; SuperGrok linking grants Grok Bot on Cursor but does not transfer quota to C |
| L1b | https://x.com/jintageal/status/2099399646238101711 | unbounded agent loop can burn a month of included usage in a day; host timeout/retry budget required |
| L4 | https://x.com/nearygy/status/2077603830645293062 | 2026-07-16 Cursor via ACP; Codex app-server; Claude stream-json |
| L1b | https://x.com/steipete/status/1954594876743389444 | Cursor/Codex bash has no auto-timeout; tail -f / file-watch hangs the agent; Claude Code has default timeouts |

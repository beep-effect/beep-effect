# Grok Bot facts (as of 2026-09-03)

Research lane for beep-effect automation planning. Claims are tagged `[high|medium|low]` with dated sources. Silent or conflicting sources are called out. Do not treat this as a product spec.

**Access date for all live fetches in this file:** 2026-09-03.
**Local CLI inspected:** `grok 1.0.13 (<redacted-build>) [stable]` at `~/.local/bin/grok`.

**Do not conflate four surfaces:**

| Surface | What it is | Where it runs |
| --- | --- | --- |
| **Grok** | grok.com / iOS / Android chat | xAI consumer apps |
| **Grok Build / CLI** | local coding agent (`grok`) | your machine (or grok.com/code driving a local agent via relay) |
| **Grok Bot** | named teammates with a persistent cloud computer | **Cursor-hosted Firecracker microVM** (US) |
| **xAI API** | billed Responses/Chat + server-side tools (`x_search`, etc.) | `api.x.ai` |

Plugins in Grok Bot are **Cursor Marketplace MCP bundles**. Grok.com “Connectors” (Gmail/Drive/Salesforce catalog) are a different product, last updated 2026-07-17 — before Bot launched.

---

## Q1. What Grok Bot is

### Official description [high]

xAI markets **Grok Bot** as persistent “AI teammates you can give real work to.” Each Bot is a named, durable agent with its own conversation, role, skills, and routines. All Bots on an account share **one persistent cloud computer** (browser + filesystem + terminal) that keeps running when the laptop/app is closed. Bots can sign into existing apps, use plugins/MCP, collaborate in group threads, and request approval only when needed.

Cursor’s enterprise write-up is more precise: Grok Bot is a computer-use agent that “runs in Cursor's cloud”; the desktop/mobile apps are thin clients for chat, review, and approvals. Each user gets a dedicated **Firecracker microVM** (Linux, non-root). Isolation is **per user, not per Bot**.

Sources:
- https://x.ai/bot (accessed 2026-09-03)
- https://x.ai/news/introducing-grok-bot (2026-08-11)
- https://docs.x.ai/grok-bot/overview (accessed 2026-09-03)
- https://docs.x.ai/grok-bot/teams-and-enterprises (accessed 2026-09-03)
- https://cursor.com/docs/grok-bot/work (accessed 2026-09-03)

### Launch timeline [high]

- **2026-08-11:** “Introducing Grok Bot — Early beta.” https://x.ai/news/introducing-grok-bot
- **2026-08-26:** “Grok Bot is now included with more plans” — all SuperGrok tiers + Cursor Pro + Cursor Teams. https://x.ai/news/grok-bot-more-plans
- **2026-08-29:** “Grok Bot now works with X.” https://x.ai/news/grok-bot-and-x
- Product page still labels it **Early beta** as of 2026-09-03. https://x.ai/bot
- Troubleshooting docs last updated **2026-09-02**. https://docs.x.ai/grok-bot/troubleshooting

Related but distinct:
- **Grok Automations** (2026-07-16) — scheduled jobs *inside Grok chat* (once/daily/weekdays/weekly/monthly/yearly **or incoming email**). Not Grok Bot. https://x.ai/news/grok-automations
- **Grok Build / CLI** (2026-05-25; workflows 2026-07-23; web/mobile 2026-08-19) — local coding agent. https://x.ai/news/grok-build-cli

### SuperGrok Heavy inclusion, bot counts, usage

**Eligible plans (canonical Cursor matrix, post-2026-08-26)** [high]:

| Situation | Grok Bot usage language |
| --- | --- |
| Cursor Ultra | “Highest weekly usage” |
| Cursor Pro+ | “Generous weekly usage, below Ultra” |
| Cursor Pro | “Weekly usage, below Pro+” |
| Cursor Teams (self-serve) | Seat allowance; on-demand on by default |
| Cursor Enterprise | Admin-enable |
| **Individual SuperGrok Heavy** (linked) | **“Highest linked usage”** |
| Individual SuperGrok Plus (linked) | “Generous linked usage, below Heavy” |
| Individual SuperGrok (linked) | “Linked usage, below Plus” |
| X Premium+ (linked) | “Linked usage, below SuperGrok Plus” |
| SuperGrok Team / Enterprise | Linking **unsupported**; not included |
| SuperGrok Lite | Not included |

Source: https://cursor.com/help/grok-bot/plans (accessed 2026-09-03)

**Stale conflict:** `docs.x.ai/grok-bot/get-started` still lists only SuperGrok Plus/Heavy and Cursor Pro+/Ultra, omitting SuperGrok and Cursor Pro. Prefer the 2026-08-26 news post + Cursor plans page. [high]

**Pricing (consumer Grok)** [high for listed $; Heavy $ unpublished on official HTML]:
- SuperGrok: **$30/month** — “Grok Bot access”, Grok 4.6, connectors. https://x.ai/pricing
- SuperGrok Plus: **$100/month**. https://x.ai/pricing
- SuperGrok Heavy: comparison-table column + x.ai/bot toggle (“Highest usage / Most powerful intelligence / Dedicated support”). **No numeric Heavy price in official HTML on 2026-09-03.** Third-party sites commonly say **$300/month** (or ~$250/mo annualized) — **unverified**. Check logged-in https://grok.com/supergrok or in-app plan picker. FAQ notes unexpected large invoices are often a **yearly SuperGrok Heavy** charge, not API. https://docs.x.ai/grok/faq

**How SuperGrok Heavy actually funds a Bot** [high]:
- Grok Bot is a **Cursor product**. Usage is metered on the **Cursor account**, not on grok.com.
- SuperGrok Heavy must be **linked** from the Grok Bot plan screen (`cursor.com/help/grok-bot/supergrok`). Linking is a **usage grant**, permanent (cannot unlink/move), and does not change the Cursor plan.
- “Grok Bot comes with its own usage, separate from your Grok and Cursor plans.” https://x.ai/news/grok-bot-more-plans
- Dual Cursor+SuperGrok: grok-bot FAQ says the service uses **whichever provides more usage**; Cursor plans page says the SuperGrok link grants Bot usage onto the same Cursor meter. Treat as: one Cursor-side Bot bucket, sized by the better grant. [medium]
- Included usage **resets weekly**. Extra continues on **on-demand spend** if enabled. No separate Grok Bot spend cap. https://cursor.com/help/grok-bot/plans ; https://docs.x.ai/grok-bot/teams-and-enterprises
- **No official numeric Bot weekly quota, token pool, or hours** published. Check in-app **Settings → Usage and billing** / plan screen.

**Hard published limits** [high]:
- Max **50 Bots and group chats combined** per account. https://docs.x.ai/grok-bot/bots
- Max **50 routines per Bot**; **20 most recent run records** per routine. https://docs.x.ai/grok-bot/skills-routines-and-automations
- Teach-a-task recordings: **10 minutes**. https://docs.x.ai/grok-bot/faq
- Desktop composer: **6 attachments**; 25 MB docs/images/audio; 200 MB video. https://docs.x.ai/grok-bot/files-and-results
- Group chat: **2–6 Bots**. Bot-to-group handoffs are **text-only**. https://cursor.com/docs/grok-bot/work
- One Bot: **one computer-use task per screen at a time**. https://docs.x.ai/grok-bot/computer-and-apps

### How bots are created and configured [high]

**Desktop/mobile UI. No public Bot-as-code API, YAML spec, or “load AGENTS.md from GitHub” path.**

1. Install **Grok Bot desktop** (macOS / Windows / Linux `.deb`/`.rpm`/AppImage) from https://x.ai/bot — binaries served from `api2.cursor.sh`. Companion iOS 18+ / Android 9+. Cursor account required. Cloud storage required; **Legacy Privacy Mode blocks Bot**.
2. **New → Create new agent.** Profile: name, title, description, avatar. Description = lasting responsibilities, preferences, safety boundaries. Task-specific directions go in chat.
3. **Settings → Plugins**: marketplace + “Yours”. `@` attaches a plugin; `/` a skill.
4. Skills (how) + routines (when + which Bot). Duplicate copies profile/skills/routines, **not** memory/history.
5. Public share link copies configuration (identity, description, skills, routines) — **not** computer/logins/history.

A Bot *could* be told in its description to `cat` a file from a cloned repo; that is **not** first-class config. Grok Build’s `AGENTS.md` / plugins / hooks apply to the **CLI**, not hosted Bot.

**Model selection** [high]: “Cursor manages model selection, so there is no model picker.” Serving mix can change; team model allowlists are “honored by default” but **enforcement is not guaranteed**. Usage analytics show the model that actually served. https://docs.x.ai/grok-bot/settings-and-notifications ; https://docs.x.ai/grok-bot/teams-and-enterprises

### Where configuration lives [high]

- Cursor/Grok Bot cloud account: profile, skills, routines, plugins, Auto-review rules (per-desktop, synced to Agent Computer).
- Durable files on the shared computer under `/workspace`.
- **Not established:** a git-tracked `bot.yaml` the hosted Bot auto-loads.

---

## Q2. Triggers and scheduling

### Documented Bot routine triggers [high]

A **routine** assigns one Bot a workflow that runs:

1. **On a schedule** — owner, clock time, and **timezone** are confirmed at creation. Example language: “Every weekday at 8:00 AM …”. No cron syntax published; UI/NL schedule, not crontab.
2. **On a supported event** via **Cursor account integrations** — documented examples: **Slack messages** and **GitHub notifications**. These are **distinct from Slack/GitHub plugins** and may need a separate connection. Narrow match rules required; “every new message” is explicitly discouraged (noise + usage burn).
3. **Manually** — message the Bot; **Test run** (real side effects).
4. **Chained Bots** — group chats (2–6 Bots) and async Bot-to-Bot DMs. A user DM **preempts** background work. “Stop now” ends the turn; it does **not** undo completed actions.

Background routines continue with the laptop closed. After a **long period away**, Grok Bot may ask whether to keep routines running and **pause them if unanswered**.

Sources: https://docs.x.ai/grok-bot/skills-routines-and-automations ; https://cursor.com/docs/grok-bot/work ; https://docs.x.ai/grok-bot/troubleshooting (routine did not run checklist: enabled, schedule/TZ, owning Bot exists, plugins authenticated, computer reachable, usage not paused).

### Not published as Bot routine triggers [high that docs are silent]

- Incoming **email** as a *Bot* trigger (email **is** a trigger for grok.com Automations, 2026-07-16 — different product).
- Generic **webhooks**.
- **X mentions / DMs / replies** as schedule/event sources (X plugin can *read* mentions once a routine is already running).
- Cron expressions, minimum interval, maximum run duration, routine concurrency cap.

### Observed schedule semantics (beta, unofficial but staff-confirmed) [medium]

Cursor forum thread “Grok Bot routines don’t auto-run on schedule” (2026-09-01/02): daily 11:00/15:00/21:00 KST looked missing. Staff (**Colin**, 2026-09-02) said every slot **did** run, delayed **10–37 minutes** in a queue; some completed **without posting chat messages**. “Run now” = due but not yet handed off. Timezone was correct (`Asia/Seoul`). Editing Bot instructions does **not** touch the routine schedule. Manual chat remains the reliable workaround.

https://forum.cursor.com/t/grok-bot-routines-dont-auto-run-on-schedule/170358

**Catch-up:** staff description implies a missed slot is **queued and started late**, not skipped and not doubled. No documented “catch up all missed hours” policy.

### Notifications [high]

Per-Bot notifications when a Bot **finishes or needs input** (suppressed while the app is focused). Mobile needs both OS permission and the Bot-level toggle. Errors appear above the composer with optional **request ID**. https://docs.x.ai/grok-bot/settings-and-notifications

Cursor help: report routines that stay enabled but inactive **>24 hours**. https://cursor.com/help/grok-bot/getting-started

---

## Q3. Runtime and tools

### Hosted sandbox [high]

- **One persistent Firecracker microVM per Cursor user**, shared by all of that user’s Bots. Linux, non-root, US-hosted. Hardware isolation **between users**; **none between Bots**.
- Browser (shared cookies/sessions), command line (shared credentials), filesystem. Durable path: **`/workspace`**.
- **Not durable:** temp dirs, **manually installed packages**, uncommitted app state. Image updates/recovery preserve durable files + logins; **Reset** reverts to last synced snapshot.
- Idle computers **hibernate** (not delete).
- Each Bot has its own **screen**; one computer-use task per screen at a time. Parallel Bots = parallel screens on the same VM.
- On-prem / BYO image / customer-hosted: **unsupported**. Shared static egress IPs (not per-customer).
- **Cannot call OpenAI/Anthropic from the Bot** as a documented feature. Model mix is Cursor-managed. Benjamin’s “no cross-provider verify seat” matches the published model story.

Sources: https://docs.x.ai/grok-bot/teams-and-enterprises ; https://docs.x.ai/grok-bot/computer-and-apps

### Shell / git / bun / tests [medium]

Terminal exists, so `git clone`, `bun`, `node`, tests are *possible* on the VM. Official guidance: treat installed packages as **replaceable**; keep durable artifacts in `/workspace`. No published OS image, preinstalled toolchain, RAM/CPU, or “bun is available” claim. Team Setup scripts (enterprise) can install standard tooling on every team computer — **do not put secrets in those scripts**.

### MCP: remote-only from the Bot’s point of view [high]

- Grok Bot **inherits Cursor’s MCP allow/block policy**. Connectors appear as **Plugins**. OAuth tokens stay on **Cursor’s connector backend**; Bots invoke tools without receiving tokens.
- Custom MCP: **public HTTPS URL**. Local/VPN MCP that works in Cursor IDE often fails in Bot because discovery/OAuth runs **from Cursor cloud**, not the laptop. Forum (2026-08-12): same URL works in IDE `mcp.json`, Bot shows `needsAuth` / “Failed to load MCP server” / `fetch failed`. Staff: architectural, not a misconfig. **stdio + mcp-remote bridge is not a documented Bot path.**
- Contrast: Grok **CLI** MCP supports **stdio** (`npx`) and remote HTTP. https://docs.x.ai/build/features/mcp-servers
- Day-0 in-app catalog snapshot (community, 2026-08-12): **219 plugins**, 13 categories. https://github.com/rdmgator12/awesome-grok-bot-plugins

**Named integrations (Bot plugins / docs examples)** [medium–high]:

| Integration | Path | Notes |
| --- | --- | --- |
| GitHub | Cursor marketplace plugin (official GitHub remote MCP) + separate GitHub-notification **event** integration | Repos, issues, PRs, code search, Actions (community catalog text) |
| X | Marketplace plugin ID **49086599** + Aug 29 “X connector” | Search/read/bookmarks; see Q4 |
| Slack | Plugin + separate Slack-message **event** integration | |
| Notion | Plugin (featured) | |
| Google (Gmail/Calendar/Drive) | Featured plugins | |
| Browser / computer use | Built-in | Sites without connectors; CAPTCHA/2FA handed to human |
| Cursor Cloud Agents | Delegation from Bot (admin can disable) | Separate computers; existing Cloud Agent GitHub App |

Grok.com connector catalog (Box, Canva, Linear, Salesforce, Vercel, …) is **not automatically the Bot plugin list**.

### Secrets [high]

- Do not paste passwords/OTPs into chat.
- **Secure secret card:** masked, excluded from transcript, not shown to the model. https://cursor.com/help/grok-bot/secrets
- Plugin OAuth on Cursor backend, not on the VM disk.
- Human takeover for password/passkey/2FA/CAPTCHA/payment.

### Output / delivery channels [high for what is documented; high that others are silent]

Documented:
- Conversation transcript (files/images/tool results as cards).
- `/workspace` files; attach back to chat.
- Drafts left for approval (email/LinkedIn examples on marketing pages).
- Bot-to-Bot messages; group threads.
- Per-Bot “finished / needs input” notifications.

**Not documented as first-class Bot delivery:** posting to X, sending email without a plugin+approval, generic outbound webhooks, GitHub PR as a built-in channel (PRs go through GitHub plugin, `gh` on the VM, or Cloud Agent — Q5).

### Observability [high]

- Routine run history: last **20** per routine (success/failure).
- Conversation shows tool activity, computer use, approvals.
- Composer error + **request ID**.
- Spend: `cursor.com/dashboard/usage` by product; invoices combine Cursor+Bot.
- **No consumer per-run cost line item** published.
- Enterprise: Audit Logs (admin/auth); Action Recording (off by default, **90-day** internal retention, optional OTel export). Not a customer EDR feed.

### Approvals / Auto Review [high]

Independent review model evaluates shell, plugin calls, computer use, routine/trigger writes, and Cloud Agent/subagent launches. Allow once / Always allow / Deny. Require-approval rules beat allow rules. Does **not** review every side effect (memory writes, most settings). Prompt-injection: outside content marked untrusted; Auto Review + network policy + per-action approval — “reduce, but do not eliminate” risk.

---

## Q4. X search from a bot and from the API

Distinguish **four** paths. Benjamin’s RUN.json error is path A, not path C.

### A. Grok Bot “user-X” MCP / marketplace X plugin [high]

- Plugin listing: https://x.ai/bot/plugin/49086599 — “Search posts, read timelines, pull trends, and manage bookmarks.”
- Community catalog (2026-08-12): “Read-only access to the X API.”
- Forum (2026-08-13): plugin exposes ~**24 tools** including **`search_posts_all`**, user/post lookup, news, trends, timelines, mentions, bookmarks, recent post **counts**. **No `search_posts_recent`** (no mapping to `GET /2/tweets/search/recent`). Maintainer: “There’s no recent-search tool for us to switch on today.” App-only bearer **403s** user-context tools (`get_users_me`, timeline). Direct recent-search with a valid token still **HTTP 402 credits depleted** when the X developer balance is empty.
  https://forum.cursor.com/t/grok-bot-x-connector-lacks-recent-search-direct-api-requires-separate-credits/168227

This is **X’s hosted MCP** (`https://api.x.com/mcp`), not xAI’s server-side `x_search`.

### The `client-not-enrolled` / Client Forbidden class [high]

X API **403** `client-forbidden`: authentication succeeded but the **app is not enrolled** for that endpoint/package.

Official MCP troubleshooting (`xdevplatform/docs` `tools/mcp.mdx`, accessed 2026-09-03): on `client-not-enrolled`, **move the app to Pay-per-use and Production**. Also: app must sit in a **Project** in https://console.x.com (matches Benjamin’s resume hint).

Related codes seen in Bot threads:
- **`user-not-enrolled`** (2026-08-27): OAuth “Connected” but tool calls still fail — distinct from client enrollment.
- **`needsAuth` / tools=0 / “Failed to load MCP server”**: OAuth never completed or tokens dropped.

X API pricing as of 2026-09-03: **pay-per-use credits**, no monthly Free/Basic/Pro ladder on the current pricing page. Post reads **$0.005/resource**, user reads **$0.010**, post create **$0.015** (URL posts $0.200). Cap **3M post reads / monthly cycle**. Legacy agreement text still mentions Basic/Pro — grandfathering possible. https://docs.x.com/x-api/getting-started/pricing

**`search_posts_all` extra gotcha [medium]:** third-party write-ups say full-archive search may require **app-only** auth; user-context `xurl` then 403s even when enrolled. Confirm in console which product the tool maps to.

### B. Grok Bot “X connector” announced 2026-08-29 [high]

https://x.ai/news/grok-bot-and-x :

> “Connect your X account in Grok Bot and we'll create a developer account for you if you don't have one. Paid Grok Bot users get free X API credits to start.”

Capabilities named: search posts, read timeline, check mentions, “pull together what's happening on X.” Plugin also: trends + bookmarks. **Posting and DMs are not claimed.** “First version.”

Whether those intro credits cover `search_posts_all` is **not stated**. Forum users with a connected plugin still hit **402 credits depleted** and asked for subscription-bundled search — not confirmed.

### C. xAI API server-side `x_search` [high]

- Tool type `x_search` on the **Responses API** (`https://api.x.ai/v1/responses`), xAI SDK `x_search()`, Vercel `xai.tools.xSearch()`.
- Implements `x_user_search`, `x_keyword_search`, `x_semantic_search`, `x_thread_fetch` (`SERVER_SIDE_TOOL_X_SEARCH`).
- Filters: `allowed_x_handles` / `excluded_x_handles` (max 20, mutually exclusive), `from_date` / `to_date`, image/video understanding flags.
- **Price: $5 per 1,000 successful calls** plus model tokens. Failures not billed. https://docs.x.ai/developers/pricing
- **Does not require an X developer Project.** xAI runs the tool. **Not documented as available inside Grok Bot** (Bot has no model/tool picker; Cursor chooses tools).

### D. Subscription-funded Grok CLI / grok.com XSearch [high]

- grok.com chat: “Real-time web + X search” on paid plans (Free: Limited). https://x.ai/pricing
- Local CLI `grok 1.0.13` binary contains `x_search` strings; headless `-p` uses backend-hosted X search when tools are not allowlisted away (`--tools` non-empty **strips** default X search — standing grok-CLI gotcha).
- CLIProxyAPI can server-inject `x_search` for `grok-4.6`. This is **API/CLI**, not Bot.

### Practical implication for Benjamin’s research Bot [high]

The RUN.json line `search_posts_all / search_news return client-not-enrolled Client Forbidden` is the **X MCP plugin (path A)** talking to **api.x.com**, not xAI `x_search`. Fixes to try, in order:

1. In https://console.x.com: app inside a **Project**, package **Pay-per-use**, env **Production**; regenerate tokens.
2. Confirm whether the Bot is using the Aug 29 first-party connector (auto developer account + intro credits) vs the marketplace plugin with *your* app.
3. Do **not** expect Grok Bot to call xAI `x_search` unless Cursor later wires it.
4. Workaround that does not need X enrollment: Bot **browser** on x.com (fragile), or hand the intel packet to local `grok -p` / CLIProxyAPI which already has subscription XSearch.

---

## Q5. GitHub integration

### Three (really four) GitHub paths [high]

1. **Grok Bot GitHub plugin** (Cursor marketplace, official GitHub **remote MCP**). Community catalog: “repositories, issues, pull requests, code search, and Actions.” Auth is GitHub OAuth via Cursor’s plugin flow; tokens stay on Cursor’s backend. This is **not** a PAT you paste into chat.
2. **GitHub notification event integration** — starts a **routine** on notifications. Separate from the plugin; separate auth. https://docs.x.ai/grok-bot/skills-routines-and-automations
3. **Computer-use / `git` on the VM** — clone into `/workspace`, `gh` if installed (ephemeral packages!). Browser login to github.com.
4. **Cursor Cloud Agents** — Grok Bot can **delegate** coding tasks. Cloud Agents use the **Cursor GitHub App** (admin connects GitHub). Trigger also via `@cursor` on a PR/issue. Isolated VM, new branch, push, open PRs. Admins can disable spawning. https://docs.x.ai/grok-bot/teams-and-enterprises ; https://cursor.com/docs/cloud-agent ; https://cursor.com/docs/integrations/github

Official GitHub MCP tool surface (upstream, not Bot-specific): PRs (`create_pull_request`, reviews, merge), issues, Actions (`get_job_logs`, rerun), commits. Auth: OAuth, PAT (`GITHUB_PERSONAL_ACCESS_TOKEN`), or GitHub App for non-interactive stdio — Bot uses the **remote OAuth** flavor. https://github.com/github/github-mcp-server

**PAT vs App for Bot:** no Bot docs describing a PAT field. `needsAuth` on the GitHub plugin = OAuth not completed (same class as X). Benjamin’s “GitHub MCP needsAuth. Publisher uses gh + cloud agent” matches the intended split: **plugin OAuth often flaky in Bot; land code via Cloud Agent / `gh`.**

### What is not documented [high that silent]

- Opening a PR **as a first-class Bot output channel** (no “deliver as GitHub PR” toggle).
- Reading Actions logs except via GitHub MCP tools / `gh` / browser.
- Payload/size limits **specific to GitHub handoff**. Known general limits: 6 attachments, 25 MB / 200 MB. Bot-to-group handoff **text-only**. Large base64 in a Cloud-agent prompt is **your** pipeline, not a published Bot limit — Benjamin’s `PAYLOAD_B64` gzip EOF is consistent with **truncation in transit**, not a documented quota.

Grok CLI MCP truncates tool results inline at **20,000 bytes** (full payload under session `mcp/`). That cap is **CLI**, not proven for Bot. https://github.com/xai-org/grok-build `07-mcp-servers.md`

### Recommended land-in-repo patterns (inferred from official pieces, not a vendor “do this” page) [medium]

| Pattern | Fit | Risk |
| --- | --- | --- |
| **Delegate to Cursor Cloud Agent** (GitHub App, PR) | Best documented coding path; Bot already allowed to spawn it | Admin may disable; Cloud Agent usage is Cursor’s, not Bot’s unpublished quota |
| **GitHub MCP plugin** create PR/issue/comment | Structured, no VM git | OAuth/`needsAuth`; MCP from cloud |
| **`git`/`gh` on Agent Computer** into `/workspace` then push | Works without plugin | Packages/credentials on shared VM; not durable across image rebuilds unless in `/workspace` |
| **Local execution** (desktop app runs commands on the laptop) | Uses *your* `gh`, keys, bun | Separate permission; default Ask every time; team ceiling |
| **Hand off to local Grok CLI / Codex** via file in repo or gist | Avoids Bot GitHub auth entirely | Not a built-in relay (see Q6) |

Do **not** put PATs in Bot description, skills, or `/workspace` world-readable files.

---

## Q6. Hosted bot vs local machine (Grok CLI relay)

### Two different “drive my machine” features — do not merge them [high]

**1. Grok Bot “Execution on Local Computer”** (desktop app setting)

Settings → General → Agent → Execution on Local Computer: Ask every time (default) / Always allow / Never. First action asks consent. Runs commands / reads files / copies between **cloud VM and the Mac/Windows/Linux box running the Bot app**. Separate from Auto Review (which governs the **hosted** computer). Team ceiling can forbid loosening. **Does not mention Grok CLI, `--grok-ws-url`, or ACP.**

https://docs.x.ai/grok-bot/approvals-security-and-privacy ; https://docs.x.ai/grok-bot/teams-and-enterprises

**2. Grok CLI WebSocket relay** (`grok agent headless --grok-ws-url`)

From `grok 1.0.13 --help` and open-source grok-build:

```
grok agent headless --grok-ws-url wss://your-relay.example.com/ws
```

Production default compiled into the binary and `xai-grok-env`:

- `PROD_RELAY_WS_URL` = **`wss://code.grok.com/ws/code-agent`**
  Comment: **“Web Frontend at grok.com/code driving a local agent”**
- `PROD_GATEWAY_WS_URL` = `wss://grok.com/ws/gw/` — **“Not the cloud-sandbox gateway”**; used for `/cloud new` sandboxes
- `PROD_CLI_CHAT_PROXY_BASE_URL` = `https://cli-chat-proxy.grok.com/v1`

Architecture: **local agent connects OUT** to the relay; browsers/clients connect to the same relay. “Useful for building web UIs.” `grok agent serve` binds **127.0.0.1:2419** with `GROK_AGENT_SECRET`. `grok agent leader` is the shared local process; `--relay-on-demand` vs eager connect.

**Hosted Grok Bot is not this relay.** grok-build agent-mode docs: hosted cloud sandboxes **do not run `grok agent serve`**. Enterprise docs: `code.grok.com` remote-session sync / sharing / WebSocket relay is **optional**; blocking it leaves CLI sessions local-only. TLS 1.2/1.3 required.

**Conclusion:** A Grok Bot **cannot** (documented) attach to `grok agent headless --grok-ws-url` as its runtime. Opposite direction: **grok.com/code** drives **your** CLI. Closest Bot→laptop path is Local Execution through the **Grok Bot desktop app**, not the CLI relay. A Bot could theoretically `ssh`/`tailscale` to DankStation from the VM if you install a client (Team Setup / private-networks docs: Tailscale or `cloudflared` **on the cloud computer**) — that is network reachability, not the Grok WS protocol.

### Grok CLI unattended automation (not Bot) [high]

User-guide chapters (grok-build tree): **14 Headless**, **15 Agent mode**, **17 Sessions**, **20 Background tasks**.

- `grok -p` / `--prompt-file` / `--output-format json|streaming-json`; sessions in `~/.grok/sessions`; `--resume` / `--continue`.
- ACP: `grok agent stdio`. Extensions under `x.ai/` : `fs/*`, `git/status|stage|commit|diffs|discard`, `git/worktree/*`, `search/fuzzy/*`, `terminal/*`, `session/fork`, auth, telemetry. Discover via `initialize`.
- **`/loop [interval] <prompt>`:** min **60s**, max **7 days** expiry, max **50** active loops, fires immediately then repeats. This is the **TUI/CLI scheduler**, not Grok Bot routines.
- Background commands, monitors (`persistent: true` for session lifetime), prompt queue.
- `--always-approve` / permission modes; sandbox Landlock (Linux) / Seatbelt (macOS).
- **No cron daemon in the CLI** beyond `/loop` (session-scoped, 7-day cap) and your own systemd/timer wrapping `grok -p`.

https://docs.x.ai/build/features/background-tasks ; https://docs.x.ai/build/cli/headless-scripting ; https://github.com/xai-org/grok-build `15-agent-mode.md`

---

## Q7. Changelog and roadmap (last ~90 days)

### Official x.ai/news affecting automation (2026-06-03 → 2026-09-03) [high]

| Date | Item | Automation relevance |
| --- | --- | --- |
| 2026-06-11 | Grok Build Plugin Marketplace | CLI plugins |
| 2026-06-15 | Agent Dashboard | many local sessions |
| 2026-06-22 | `/goal` in Grok Build | long-running local autonomy |
| 2026-07-15 | Grok Build open-sourced | relay/ACP docs in-tree |
| 2026-07-16 | Automations in Grok | **chat** schedule + **email** trigger |
| 2026-07-16 | Grok 4.5 | agentic coding |
| 2026-07-23 | Workflows in Grok Build | fan-out subagents |
| 2026-07-28 | Build Mode (Heavy, grok.com) | websites/apps early beta |
| 2026-08-11 | **Grok Bot launch** | this product |
| 2026-08-12 | Grok 4.6 | “long-running agents”; likely Bot serving mix |
| 2026-08-19 | Grok Build on web and mobile | grok.com/code (relay consumers) |
| 2026-08-26 | Bot on more plans | SuperGrok + Cursor Pro + Teams |
| 2026-08-29 | Bot + X | X connector + plugin 49086599 |
| 2026-09-02 | grok-bot troubleshooting docs updated | computer recover/reset, routines, plugins |

API release notes also: May 2026 WebSocket Responses API; May 2026 Grok Build beta (TUI, headless, ACP); Aug 2026 Grok Bot + Grok 4.6. **No 2026 API note named `x_search`** (that tool is older; pricing still $5/1k).

### Roadmap hints [medium]

- X integration is “the first version”; “keep making it easier for Grok Bot to do real work on X.” No posting/DMs promised. https://x.ai/news/grok-bot-and-x
- Forum X-plugin maintainer (2026-08-13): team informed about **recent search** and **possibly covering reads via subscription** — not shipped as of 2026-09-03.
- Enterprise Bot still waitlist/phased.
- Teach-a-task “rolling out gradually.”
- Cross-conversation search “can vary during rollout.”
- Local-execution team ceiling: “dashboard control … not available today.”
- Windows WebAuthn forwarding “in progress.”
- **Staff X posts:** native x.com search from this session did not return usable @xai/@grok hits (tool empty). Treat newsroom + docs as canonical; check https://x.com/xai manually.

### Reliability complaints (dated, secondary) [medium]

| Date | Source | Symptom |
| --- | --- | --- |
| 2026-08-12 | forum.cursor.com/168188 | Custom remote MCP OAuth never starts in Bot (`needsAuth`, `fetch failed`); same URL works in Cursor IDE. Cloud-side discovery. |
| 2026-08-12 | forum.cursor.com/168200 | MCP discovery `DeadlineExceeded` / ~840s tool timeouts across connectors |
| 2026-08-12 | github.com/vercel/vercel-plugin#141 | Vercel plugin OAuth 404 `/authorize`; GitHub/Notion/Google said to work in same client |
| 2026-08-13 | forum.cursor.com/168227 | X plugin: no recent search; 402 credits depleted; `needsAuth` flapping |
| 2026-08-15–09-01 | forum.cursor.com/168501 | Official X plugin OAuth “failed to give the app access”; `needsAuth` tools=0; later `user-not-enrolled`. Staff Colin: reinstall plugin. Desktop reinstall helped; Cloud/Bot lagged. |
| 2026-08-24 | reddit.com/r/cursor/1vxjipg | Truncated replies, forgotten tasks, timeouts, fast usage burn |
| 2026-08-26–09-01 | forum.cursor.com/169592 | X plugin auth broken on **Cloud + Bot + desktop refresh**; Cursor staff Mohit: server-side, no timeline, Cloud should reuse desktop/dashboard auth |
| 2026-09-01–02 | forum.cursor.com/170358 | Scheduled routines delayed 10–37 min; some silent completions (staff-confirmed) |

**Prompt injection:** enterprise docs acknowledge the risk (web/plugin/command output) and that controls do not eliminate it. No public 2026 incident post found in this pass.

**Truncation:** no official Bot max-transcript size. CLI MCP inline cap 20kB. Benjamin’s gzip EOF on `PAYLOAD_B64` is consistent with an undocumented transport limit when stuffing a Cloud-agent prompt.

---

## Open unknowns

What this pass could **not** establish, and where Benjamin should look:

1. **Numeric SuperGrok Heavy Bot weekly quota** (tokens/steps/$). Check Grok Bot app **plan screen / Usage & billing** and https://cursor.com/dashboard/usage after linking Heavy. Official pages only say “highest linked usage.”
2. **SuperGrok Heavy dollar price** — not in x.ai/pricing HTML. Check https://grok.com/supergrok (logged in) or grok.com Settings → Billing.
3. **Whether the Aug 29 first-party X connector uses a Cursor-owned X app** that is already enrolled (avoiding `client-not-enrolled`) vs wrapping the same marketplace MCP. Test: connect **only** the news-post connector, call `search_posts_all`, compare with plugin 49086599. Console: https://console.x.com (Project, Pay-per-use, Production).
4. **Intro X API credit amount** for paid Bot users — unpublished. Watch X developer billing after connecting.
5. **Min schedule interval, max run duration, routine concurrency, cron syntax, missed-run catch-up policy** — unpublished. Empirical: forum delays 10–37 min. Confirm on a test routine in-app.
6. **Whether Bot can invoke xAI `x_search`** (path C) — no docs say yes. If a run log ever shows `SERVER_SIDE_TOOL_X_SEARCH`, that would be the tell.
7. **GitHub plugin exact tool list in Bot** (vs upstream github-mcp-server). Open Settings → Plugins → GitHub → tools. Confirm Actions `get_job_logs` and `create_pull_request`.
8. **Cloud Agent spawn payload limit** when Bot delegates (the gzip EOF). Check Cloud Agent API docs / Cursor dashboard agent logs; consider passing a URL to `/workspace` or a gist instead of inline base64.
9. **Preinstalled VM toolchain** (git, bun, node, gh versions). SSH/open Agent Computer and `which git bun node gh`.
10. **Bot → grok CLI relay** — not documented; almost certainly unsupported. If experimenting, it would be Tailscale/ssh from the VM (private-networks docs), not `--grok-ws-url`.
11. **@xai / @grok staff roadmap posts** — native X search returned empty this session. Check https://x.com/xai and https://x.com/grok around 2026-08-11, 08-26, 08-29.
12. **docs.x.ai/grok-bot/get-started eligibility list** still stale vs 08-26 expansion — ask Cursor/xAI which page is canonical if a SuperGrok (non-Plus) link fails.
13. **Cross-provider models** — confirmed absent as a picker; not confirmed whether Cursor ever failovers Bot turns to non-Grok models (enterprise text: “no fixed vendor set guaranteed”).

---

## Sources

### Official product / news

- https://x.ai/bot (2026-09-03)
- https://x.ai/pricing (2026-09-03)
- https://x.ai/news/introducing-grok-bot (2026-08-11)
- https://x.ai/news/grok-bot-more-plans (2026-08-26)
- https://x.ai/news/grok-bot-and-x (2026-08-29)
- https://x.ai/bot/plugin/49086599 (X plugin)
- https://x.ai/news/grok-automations (2026-07-16)
- https://x.ai/news/grok-build-cli (2026-05-25)
- https://x.ai/news/workflows (2026-07-23)
- https://x.ai/news/grok-build-for-everyone (2026-08-19)
- https://x.ai/news/grok-4-6 (2026-08-12)
- https://x.ai/news (index, 2026-09-03)

### Grok Bot docs (docs.x.ai)

- https://docs.x.ai/grok-bot/overview
- https://docs.x.ai/grok-bot/get-started (eligibility list stale)
- https://docs.x.ai/grok-bot/faq
- https://docs.x.ai/grok-bot/bots
- https://docs.x.ai/grok-bot/skills-routines-and-automations
- https://docs.x.ai/grok-bot/computer-and-apps
- https://docs.x.ai/grok-bot/files-and-results
- https://docs.x.ai/grok-bot/settings-and-notifications
- https://docs.x.ai/grok-bot/approvals-security-and-privacy
- https://docs.x.ai/grok-bot/teams-and-enterprises
- https://docs.x.ai/grok-bot/identity-and-access
- https://docs.x.ai/grok-bot/private-networks
- https://docs.x.ai/grok-bot/troubleshooting (updated 2026-09-02)
- https://docs.x.ai/grok/faq (consumer weekly pool; Bot is a distinct product)
- https://docs.x.ai/grok/connectors (grok.com catalog, updated 2026-07-17)

### Cursor (Bot is Cursor-hosted)

- https://cursor.com/help/grok-bot/plans
- https://cursor.com/help/grok-bot/supergrok
- https://cursor.com/help/grok-bot/getting-started
- https://cursor.com/help/grok-bot/connect-plugins
- https://cursor.com/help/grok-bot/secrets
- https://cursor.com/docs/grok-bot/work
- https://cursor.com/docs/cloud-agent
- https://cursor.com/docs/integrations/github
- https://cursor.com/dashboard/bot (admin)
- https://cursor.com/dashboard/usage

### xAI API / CLI

- https://docs.x.ai/developers/tools/overview
- https://docs.x.ai/developers/tools/x-search
- https://docs.x.ai/developers/tools/tool-usage-details
- https://docs.x.ai/developers/pricing (`x_search` $5/1000)
- https://docs.x.ai/developers/models
- https://docs.x.ai/developers/release-notes
- https://docs.x.ai/build/cli/headless-scripting
- https://docs.x.ai/build/cli/reference
- https://docs.x.ai/build/features/background-tasks
- https://docs.x.ai/build/features/sessions
- https://docs.x.ai/build/features/mcp-servers
- https://docs.x.ai/build/modes-and-commands
- https://docs.x.ai/build/enterprise (`code.grok.com` relay)
- Local: `grok 1.0.13` `--help` / `agent headless|serve|leader`
- https://github.com/xai-org/grok-build `crates/codegen/xai-grok-env/src/lib.rs` (`wss://code.grok.com/ws/code-agent`)
- https://github.com/xai-org/grok-build user-guide `14-headless-mode.md`, `15-agent-mode.md`, `17-sessions.md`, `20-background-tasks.md`, `07-mcp-servers.md`

### X developer platform

- https://docs.x.com/x-api/getting-started/pricing (pay-per-use)
- https://docs.x.com/x-api/fundamentals/response-codes-and-errors (403 client-forbidden)
- https://github.com/xdevplatform/docs/blob/main/tools/mcp.mdx (`client-not-enrolled` → Pay-per-use + Production)
- https://api.x.com/mcp
- https://console.x.com (Project enrollment)

### GitHub MCP

- https://github.com/github/github-mcp-server

### Secondary (complaints / catalog)

- https://forum.cursor.com/t/grok-bot-custom-remote-mcp-oauth-never-starts-fetch-failed-same-url-works-in-cursor-ide/168188 (2026-08-12)
- https://forum.cursor.com/t/grok-bot-x-connector-lacks-recent-search-direct-api-requires-separate-credits/168227 (2026-08-13)
- https://forum.cursor.com/t/grok-bot-official-x-plugin-oauth-fails-with-something-went-wrong-failed-to-give-the-app-access/168501 (2026-08-15)
- https://forum.cursor.com/t/official-x-plugin-auth-is-broken-on-cursor-cloud-grok-bot-and-desktop-refresh/169592 (2026-08-26)
- https://forum.cursor.com/t/grok-bot-routines-dont-auto-run-on-schedule/170358 (2026-09-01)
- https://github.com/rdmgator12/awesome-grok-bot-plugins (219 plugins, 2026-08-12 snapshot)
- https://reddit.com/r/cursor/comments/1vxjipg/grok_bot_review/ (2026-08-24)

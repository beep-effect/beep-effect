# T3 Code capabilities for a multi-host fleet driver

Date: 2026-11-01. Read-only research. No dev server was started, no T3 state was
opened, and no process was touched.

- Source: the operator's t3code fork checkout at commit
  `fa31b66bbb2ae5234205a8628a78e038d917202f` (committed 2026-11-01). The local
  `upstream/main` ref (pingdotgg) was 6 commits ahead at inspection time, so
  findings are current to within a day of upstream. Citations are `path:line`
  in that repo.
- Video: Theo, "T3 Code broke me" (2026-10-29), auto-caption transcript,
  cited as `[h:mm:ss]`.
- Builds on `explorations/cross-provider-agent-communication/research/T3CODE-QUALIFICATION.md`
  and `T3CODE-OPTIONS.md`. Those documents already proved T3-owned Claude/Codex
  messaging via `t3_thread_send` on one environment. This report adds the
  multi-environment and fleet questions.

## 1. MCP server

**Endpoint and transport.** One authenticated HTTP MCP endpoint per environment
at `<environment-origin>/mcp` (`docs/user/outside-agents.md:11-17`). Internally
the provider-facing URL is loopback `http://<loopback>:<server-port>/mcp` with server key
`t3-code` (`docs/orchestration-v2/orchestrator-mcp-server.md:31-38`). HTTP
registration and auth live in `apps/server/src/mcp/McpHttpServer.ts`.

**Tool surface** (all `Tool.make` names, grouped by toolkit):

| Toolkit (file) | Tools | Purpose |
| --- | --- | --- |
| orchestrator (`apps/server/src/mcp/toolkits/orchestrator/tools.ts:72-336`) | `orchestrator_capabilities` | Live provider instances, models, modes, and which ones can run child tasks |
| | `delegate_task`, `task_status`, `task_cancel` | Create a T3-owned child thread on any provider/model (async or wait), poll it, stop it |
| | `create_threads` | Batch-create 1-20 top-level threads sharing the caller's checkout |
| | `t3_thread_list`, `t3_thread_read`, `t3_thread_update` | List/read any thread incrementally; rename, regenerate title, link PRs |
| | `t3_thread_send`, `t3_thread_wait`, `t3_thread_interrupt` | Message (`auto`/`queue`/`steer`/`restart`), wait on a run, interrupt |
| | `schedule_task`, `list_scheduled_tasks`, `delete_scheduled_task` | Scheduled and webhook tasks |
| | `t3_workflow_stop`, `t3_background_wait`, `request_secret` | Stop a workflow, wait on background work, ask the user for a secret |
| | `t3_environment_links`, `t3_environment_link`, `t3_environment_unlink` | Cross-environment peer links (beta-gated, see section 3) |
| project (`toolkits/project/tools.ts:51-123`) | `t3_project_list/read/create/update/delete/clone`, `t3_thread_launch` | Project CRUD; launch one thread bound to root, a new worktree, an existing worktree, or scratch |
| thread (`toolkits/thread/tools.ts:32-219`) | `t3_thread_organize`, `t3_queue`, `t3_pending_request`, `t3_thread_configure`, `t3_thread_transfer`, `t3_thread_search`, `run_scheduled_task_now` | Snooze/settle, queue control, answer questions, change provider/model, hand off context, search |
| worktree (`toolkits/worktree/tools.ts:29-62`) | `t3_worktree_handoff`, `t3_worktree_status`, `t3_worktree_list` | Worktree management |
| pullRequests (`toolkits/pullRequests/tools.ts:304-462`) | `link_pull_request(s)`, `unlink_pull_request(s)`, `list_thread_pull_requests`, `watch_pull_request`, `unwatch_pull_request`, `write/read_pull_request_guide(s)` | PR linking and the built-in low-rate-limit PR babysitter |
| environment (`toolkits/environment/tools.ts:41-56`) | `t3_environment_read`, `t3_environment_preferences_update` | Environment info and preferences |
| attachment, html, preview, previewControls, device | `t3_attachment_*`, `t3_thread_send_attachments`, `html_preview`, `preview_*` (13), `t3_preview_list/close`, `device_list/open/screenshot/close` | Files, HTML renders, the headless browser, mobile simulators |

**Outside-harness enrollment.** Public-client OAuth authorization code with
PKCE; stateless dynamic client registration; loopback redirects for local agents
and any HTTPS redirect for hosted ones (`docs/internals/environment-auth.md:42-53`,
`apps/server/src/auth/McpOAuth.ts`). Approval spends a one-time pairing code from
Settings → Sharing & access or `t3 auth pairing create`, or uses a browser
session holding `access:write` (`docs/user/outside-agents.md:43-46`).
Commands: `claude mcp add --transport http t3 <url>` then `claude mcp login t3`;
`codex mcp add t3 --url <url>` then `codex mcp login t3`; both support
`--no-browser` (`docs/user/outside-agents.md:56-76`). Sign-in only completes over
`https` or `localhost`; a plain-HTTP LAN or tailnet address is discoverable but
cannot finish OAuth (`docs/user/outside-agents.md:22-28`).

**Grants.** Not a scope list: the user picks Read only (default,
`orchestration:read`) or a runtime-mode ceiling from Supervised to Full access
(`docs/user/outside-agents.md:48-54`, `docs/internals/environment-auth.md:55-60`).
A thread the client starts or steers cannot exceed that ceiling.

**Lifetime and revocation.** An OAuth sign-in lasts 30 days, then re-approval is
required; revoke immediately under Settings → Sharing & access
(`docs/user/outside-agents.md:117-121`).

**Environment scope.** Yes. Grants cover every project in that environment
(`docs/user/outside-agents.md:52-53`). Thread tools accept any thread in the
environment; for a thread caller, list/search default to its own project
(`docs/orchestration-v2/orchestrator-mcp-server.md:510-512`).

**Tool-description evaluation.** `evals/mcp-tool-use` runs real models against
the real tool descriptions in fake threads and scores tool use, including device
routing (`evals/README.md:7-11`). Evals import descriptions from source, never
copies (`evals/README.md:28`), and are paid and not run in CI
(`evals/README.md:21`). AGENTS.md requires running them when model-facing text
changes.

**Auto-injection into T3-launched sessions: yes.** Before opening any V2
provider session, `ProviderSessionManager` issues a credential scoped to
environment + parent thread + provider instance + provider session
(`apps/server/src/orchestration-v2/ProviderSessionManager.ts:493`;
`orchestrator-mcp-server.md:40-55`). The credential is revoked when the session
is released and stops authenticating after a 24 h idle window
(`apps/server/src/mcp/McpSessionRegistry.ts:60-64`). Each adapter injects it:

- Codex: `-c mcp_servers.t3-code.url=...` with `bearer_token_env_var="T3_MCP_BEARER_TOKEN"`
  (`orchestrator-mcp-server.md:59-71`; `apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts:1362`, tool timeout 65 min at `:1336`).
- Claude Agent SDK: `mcpServers["t3-code"]` HTTP plus a bearer header, with `mcp__t3-code__*` allowed
  (`orchestrator-mcp-server.md:73-96`; `ClaudeAdapterV2.ts:974-1062`).
- Cursor SDK, Grok/ACP (`session/new|load|fork` `mcpServers`), generic ACP Registry agents, and Pi through a
  T3-owned extension bridge (`orchestrator-mcp-server.md:98-171`).
- Orchestration-capable adapters: Codex, Claude, Cursor, Grok, ACP registry, OpenCode, OpenCode 2, Pi,
  Antigravity (`orchestrator-mcp-server.md:183-190`).

Agents inside T3 therefore get the full toolset with no registration. The
outside-agent `t3` registration is only for harnesses T3 did not start.

## 2. Headless / server deployment

- Binary: the `t3` package (`apps/server/package.json:2,9-11`, bin `dist/bin.mjs`).
  Install with `curl -fsSL https://t3.codes/install.sh | sh` into `~/.local/bin`,
  or `npx t3@latest`; `t3 serve` runs without a browser (`docs/user/install.md:11-47`).
- Node: `^22.16 || ^23.11 || >=24.10` for the server package
  (`apps/server/package.json:98-100`). The repo dev toolchain pins 26.12.1
  (`package.json:67-69`). The installer ships its own executable, so Node is
  only needed for `npx` (`docs/user/install.md:46-47`).
- systemd: `t3 up` / `t3 service install|status|restart|uninstall`; uses a
  systemd *user* service named `t3code.service` and enables linger
  (`docs/user/background-service.md:6-19,86-88,150`). `t3 service protect`
  reserves memory and OOM protection for the server (`:104-120`). Do not run as
  root: that creates a separate install and Connect identity (`:141-143`).
- Config: `~/.t3/service.env` (KEY=VALUE, literal; cannot override `PATH` or
  `T3CODE_HOME`) (`docs/user/background-service.md:60-82`). Flags `--host`,
  `--base-dir` (equals `T3CODE_HOME`), `--tailscale-serve`
  (`apps/server/src/cli/config.ts:40-77,139`).
- State: T3 home defaults to `~/.t3`; data lives in `~/.t3/userdata`, or
  `<base-dir>/userdata` (`docs/user/thread-migration.md:43`).
- Providers and credentials belong to the host. CLIs must be on the server's
  `PATH`, or set **Binary path** per provider (needed for version managers such as mise)
  (`docs/user/install.md:154-177`). Each provider instance can carry its own env vars,
  home directory and API keys (`docs/user/install.md:194-197`; video `[0:05:25]`).
  For desktop-managed SSH hosts, CLIs must resolve in a non-interactive login
  shell (`docs/user/remote-access.md:219-224`).
- Desktop-managed SSH: the desktop app can start or reuse a server on a Linux host
  over SSH and download the runtime to `~/.t3/runtime` there
  (`docs/user/remote-access.md:208-234`).
- Host CLI without OAuth: `t3 thread start|send|show|list` on the host uses the
  same tools (`docs/user/outside-agents.md:95-115`; `apps/server/src/cli/thread.ts:557-760`).

## 3. Remote and multi-environment

- **Model.** Each connection joins a client to one environment. LAN, Tailscale,
  SSH and Connect are routes, not execution models
  (`docs/internals/remote.md:3-7`). A saved environment holds ordered routes and the client
  uses the first that answers. It also learns LAN and tailnet routes from the server
  (`docs/user/remote-access.md:110-143`; `docs/internals/remote.md:32-56`). One client
  (desktop, web, app.t3.codes, mobile) holds many saved environments. A thread's machine
  is picked at creation, optionally by load balancing
  (`docs/user/remote-access.md:152-168`; video `[0:11:27]`, `[0:12:00]`).
- **Pairing.** `t3 pair` (QR code plus pairing URL), `t3code://pair` desktop links,
  `t3 auth pairing create`, `t3 auth session list|revoke`
  (`docs/user/remote-access.md:85-108,230-234`). Without `--scope`, pairing tokens get
  every permission. `--scope` narrows to any of `access:read|write`,
  `environment:connect|maintain|status`, `filesystem:read|write`,
  `orchestration:read|operate`, `preview:operate`, `providers:manage`,
  `relay:read|write`, `settings:write`, `source-control:write`,
  `terminal:read|operate` (`docs/user/remote-access.md:375-416`;
  `packages/contracts/src`). `terminal:operate` and `orchestration:operate` can each mint
  full sessions, so they are effectively admin (`docs/internals/environment-auth.md:9-15`).
- **LAN/tailnet.** `t3 up --lan` / `T3CODE_LAN=true` listens on LAN and tailnet
  addresses and refuses public peers. It is not a firewall: the pairing code is the only gate
  (`docs/user/background-service.md:45-58`; `docs/internals/remote.md:58-65`).
  Plain HTTP works for the desktop and mobile apps, but not for app.t3.codes or MCP OAuth.
- **Tailscale HTTPS.** `t3 serve --tailscale-serve` or `t3 pair --tailscale`
  writes a persistent `tailscale serve` mapping (default 443, `--tailscale-serve-port`)
  (`docs/user/remote-access.md:170-196`). This is the route that makes `/mcp` OAuth
  work across the tailnet.
- **T3 Connect.** `t3 up --connect` / `t3 connect` gives a relay tunnel with device-code
  sign-in over SSH. The limit is 3 machines per account (phones and browsers excluded),
  10 with T3 Chat Pro, 100 with Premier (`docs/user/remote-access.md:6-65`; video
  `[0:13:05]`, `[0:36:44]`). Connect is the only route hosted agents and webhooks can use
  (`docs/user/outside-agents.md:29-31`; `docs/user/project-settings.md:99-104`).
- **Desktop driving remotes.** Yes. Any desktop app drives its saved remote environments.
  Switching off **Local environment** turns a machine into a remote-only driver
  (`docs/user/remote-access.md:455-463`; `docs/internals/remote.md:176-186`).
- **Environment-to-environment messaging: yes, behind a beta.** Peer links
  (`apps/server/src/peer/PeerLinks.ts`) make one environment an outside OAuth MCP
  client of another, enrolled with a pairing code (`docs/internals/remote.md:70-77`).
  The Linked environments beta must be on for both machines
  (`docs/user/remote-access.md:322-363`); the link tools are hidden while it is off
  (`apps/server/src/mcp/McpInvocationContext.ts:132,166`). Commands:
  `t3 environment link <address> --pairing-code <code> --access <mode>`, `list`,
  `unlink` (`apps/server/src/cli/environment.ts:85-164`). `environmentId` is accepted by
  `t3_thread_list/read/send/wait/interrupt`, `orchestrator_capabilities`, and the
  scheduled-task tools (`packages/contracts/src/orchestratorMcp.ts:331-844`). Remote
  delegation uses `delegate_task` `target.environmentId`, and a follower wakes the parent
  across restarts (`toolkits/orchestrator/tools.ts:308-311`; `docs/internals/remote.md:127-134`).
  Guardrails: the caller's modes travel as `T3-Mode-Limit`; links last 30 days; a link
  below full access can change only threads it started and skips setup scripts; a
  full-access link is unfenced and runs as the remote user; idempotency keys are
  namespaced per caller; forwarded waits are split into calls of 50 s or less
  (`docs/internals/remote.md:79-140`).
- **Cross-environment thread links** use `<t3-thread://v2/<environmentId>/<threadId>>`
  (`orchestrator-mcp-server.md:395-406`). Repository identity correlates clones but never
  routes work. Only peer links cross environments (`docs/internals/remote.md:9-19`).

## 4. Windows / WSL

- The Windows desktop app has a built-in WSL backend. Pick a distro in Settings → Sharing &
  access, and T3 installs its own server runtime inside it. Install provider CLIs inside the
  distro (`docs/user/install.md:113-118`). Implementation:
  `apps/desktop/src/wsl/DesktopWslBackend.ts:18-60`, with backends keyed `wsl:<distro>` and
  a loopback port that relies on WSL's localhost forwarding.
- Windows release builds embed the same-arch Linux CLI archive as the WSL runtime. It is
  extracted to `~/.t3/wsl-runtime/sha256-<digest>` in the distro
  (`docs/operations/release.md:34,491-496`).
- There is no Windows background service. Keep the desktop app open with its local
  environment on, or run `t3 serve` in a terminal (`docs/user/background-service.md:95-99`).
  Inside WSL, the Linux `t3 service` path should apply if the distro runs systemd. This is
  inferred, not documented.
- Managed policy inside WSL reads the distro's `/etc/t3code/policy.json`
  (`docs/user/managed-policy.md:263-265`). Resource telemetry for WSL backends is limited
  (`docs/internals/resource-telemetry.md:54-56`).

## 5. Orchestration features (video and source)

- Multi-provider sub-agents in a fresh T3 worktree, plus cross-repo thread launch and
  thread-to-thread talk via the MCP (`[0:06:32]`-`[0:08:12]`). External control of T3 from
  bots over MCP (`[0:08:46]`, `[0:26:32]`).
- Mid-thread harness/model switching with context handoff (`[0:27:04]`;
  `t3_thread_transfer`; `docs/user/portable-handoffs.md`). Drag a thread into another for
  context (`[0:28:41]`).
- Steer vs queue as the default send mode (`[0:17:58]`). Scheduled tasks
  (`[0:17:25]`; `docs/user/project-settings.md:79-95`). Webhook-triggered tasks with
  signatures, filters, dedup, and 24 h hold/replay via Connect (`[0:30:51]`;
  `project-settings.md:97-140`). A resume-at-limit-reset follow-up (`[0:23:17]`;
  `docs/user/thread-sidebar.md:247-249`).
- Worktree per thread with configurable branch naming (default prefix `t3/`)
  (`[0:29:45]`; `project-settings.md:66-77`). Checkpoints are hidden git refs per turn
  (AGENTS.md "How it works").
- PR linking with auto-settle on merge, and built-in PR watching (`[0:20:06]`, `[0:30:20]`;
  `watch_pull_request`). Usage/limits tab across accounts (`[0:22:45]`). Port a project
  to another machine (`[0:33:00]`). `npx t3 triage` (`[0:33:32]`). Remote terminal, browser,
  and simulators over Connect (`[0:22:14]`, `[0:25:28]`). One-click "Copy MCP URL"
  per machine (`[0:30:51]`).
- Restarts can resume active threads ("Continue threads after restarts", on by default,
  capped at three automatic resumes) (`docs/user/updating.md:62-81`).

## 6. Updating

- Channels: stable, nightly, and preview (a maintainer train that is never auto-offered).
  `t3 update [version] [--channel nightly] [--allow-downgrade]`; installer env
  `T3CODE_CHANNEL` / `T3CODE_VERSION` (`docs/user/background-service.md:25-38`;
  `docs/user/install.md:25-26`).
- One-click fleet update: the sidebar button updates providers, then servers, then the
  local desktop app on every connected machine, moving servers to the client's version
  (`docs/user/updating.md:7-37`; video `[0:31:54]`). The service launcher does staged,
  exact-version installs with SQLite snapshot rollback on a failed trial
  (`docs/internals/server-updates.md:1-50`).
- Client and server must share the orchestration protocol; mismatches are refused
  (`docs/user/updating.md:87-96`).
- **Fork caveat.** `t3 update` and the service resolve releases from the public npm
  package `t3` (`apps/server/src/cloud/npmRelease.ts:66`). A source-built server (`vp i &&
  vp run build:desktop`, then `node apps/server/dist/bin.mjs`) is outside `t3 update` and
  the service. It updates by `git pull` and a rebuild (`docs/user/install.md:49-62`).
  Connect works with forks (video `[0:21:42]`).

## Gaps / NOT FOUND

- No documented way to stop MCP auto-injection per provider, and no injection opt-out
  setting found. The search covered `ProviderSessionManager` and the adapters.
- No doc says whether a globally registered outside-agent `t3` server (in `~/.claude` or
  `~/.codex`) also loads inside T3-launched sessions next to the injected `t3-code`. This
  needs a live check.
- No `t3 service` support for a fork or custom npm registry. `npmRelease.ts` targets the
  public registry, and no override env var turned up.
- No documented WSL `t3 service` (systemd-in-WSL) path, and no doc on a Windows desktop
  pairing to a manually started WSL server beyond the built-in backend.
- Peer links are beta. No fleet-wide auto-linking was found. Each pair is linked by hand
  and re-linked every 30 days. Peer links are pairwise, not a mesh registry.
- `t3_thread_launch` has no retry key (`orchestrator-mcp-server.md:220`). No MCP scope
  narrower than environment-wide.

## Implications for the fleet

1. Run `t3 up --lan` plus `t3 serve --tailscale-serve` (or `t3 pair --tailscale`) on every
   Linux host as a systemd user service with linger. Tailscale HTTPS is required for MCP
   OAuth, and Connect's 3-machine free tier cannot cover the fleet.
2. Agents launched *by* T3 need no MCP registration. Register `t3` as an outside agent only
   in harnesses running outside T3 (terminal Claude/Codex sessions, bots), one environment
   URL each, with a 30-day re-approval cadence.
3. Cross-host messaging is native: turn on the Linked environments beta everywhere, link
   the workstation (hub) to each host, and use `environmentId` on send/read/wait and
   `delegate_task` `target.environmentId`. Use full-access links only where unfenced
   remote-user execution is acceptable.
4. Windows: use the desktop app's WSL backend, which ships its own runtime. Leave the desktop
   open for availability, or test systemd-in-WSL with `t3 service`.
5. Running the fork everywhere means leaving `t3 update`. Either track upstream npm
   releases fleet-wide, keeping the fork for local patches only, or build a
   pull-rebuild-restart script per host. Decide this before rollout.

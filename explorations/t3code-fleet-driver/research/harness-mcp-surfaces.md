# Harness MCP surfaces for a T3 Code MCP registration

Date: 2026-11-01. Read-only survey of the workstation; no config was edited and no
`add`/`login` command was run. Secret values were not read or recorded; token
stores are described by key/shape only. Home-directory paths are written as `~`.

Target being registered: a T3 Code environment's Streamable HTTP MCP endpoint at
`<environment-origin>/mcp` (`apps/server/src/mcp/McpHttpServer.ts:1153`), protected
by OAuth 2.1 public-client PKCE (S256 only, `token_endpoint_auth_methods_supported:
["none"]`, dynamic client registration at `/oauth/mcp/register`;
`apps/server/src/auth/McpOAuth.ts:84-96`). Its 401 advertises
`resource_metadata=<origin>/.well-known/oauth-protected-resource/mcp`
(`McpHttpServer.ts:84,99`). Approval needs a pairing code
(`explorations/cross-provider-agent-communication/research/T3CODE-QUALIFICATION.md:45`).
So a harness needs **Streamable HTTP + RFC 9728 discovery + DCR + PKCE**. A static
`Authorization` header only works if someone pastes a token in, which the
qualification doc rules out (`T3CODE-QUALIFICATION.md:83-85`).

## Matrix

| Harness | Config path(s) | Scope | Remote HTTP + OAuth | Add command (from `--help`) | Registered now (names) |
| --- | --- | --- | --- | --- | --- |
| Claude Code `claude` | `~/.claude.json` top-level `mcpServers` (user); `~/.claude.json` `projects[<path>].mcpServers` (local); `<repo>/.mcp.json` (project) | `-s local\|user\|project`, default `local` | Yes. `-t http`, `--client-id`, `--client-secret`, `--callback-port` "for servers requiring pre-registered redirect URIs". Tokens go in `~/.claude/.credentials.json` under `mcpOAuth`, one entry per server (36 entries today, e.g. `alphaxiv`, `stately`, `greptile`) | `claude mcp add --transport http <name> <url> [-s user]` | user: `docker-mcp`(http), `omi`, `omi-memory`(http), `omoide-curation`, `railway`; local: `alphaxiv`(http) on `~`, `folio` (beep-effect3), `civitai`(http) on `ai` |
| Proxy Claude (`claudep`/`claudex`/`claudeg`) | Same `claude` binary and the same `~/.claude.json`. The wrappers only set env vars and `--model` (`~/.zshrc:157-168`) | inherits Claude | inherits Claude | same as Claude | same as Claude. Exceptions: `claudev` runs a lean `--strict-mcp-config --mcp-config <lane>/mcp.json` (`~/.zshrc:203`), and the headless recipe in `~/.claude/CLAUDE.md` passes an empty `--strict-mcp-config`, so those runs see no MCP servers |
| Codex CLI `codex` 0.166.0 | `~/.codex/config.toml` `[mcp_servers.<name>]` (user); `<repo>/.codex/config.toml` (project, trusted projects only); `-c mcp_servers.x=…` per run | user / project / per-invocation | Yes. `--url` "for a streamable HTTP MCP server", `--oauth-client-id`, `--oauth-client-secret`, `--oauth-client-registration auto\|cimd\|dcr`, `--oauth-resource`; `codex mcp login <name> [--no-browser]`. `mcp_oauth_credentials_store` is unset in config.toml, so Codex uses its default store (keyring with file fallback; not checked locally). `~/.codex/mcp-oauth-locks/` exists | `codex mcp add <name> --url <url>` then `codex mcp login <name>` | `alphaxiv`(url), `docker-mcp`(url), `node_repl`, `omi-memory`(url + static header), `railway` (`config.toml:1207-1243`) |
| Grok CLI `grok` 1.0.73 | `~/.grok/config.toml` `[mcp_servers.<name>]` (user); `./.grok/config.toml` (project) | `-s user\|project`, default `user` | HTTP yes (`-t http` "streamable HTTP", `-H` headers). OAuth: there is no `login` subcommand, but `~/.grok/mcp_credentials.json` holds one entry keyed `<name>:<url>`, so OAuth runs when a server connects. `grok mcp doctor` checks connectivity. `[compat.cursor] mcps = false` turns off the Cursor-config import (`config.toml:110-111`) | `grok mcp add <name> <url> [-t http] [-s user]` | `xai-docs`(url), `docker-mcp`(url + header), `firecrawl`, `youtube-transcript`; disabled: `serena`, `codegraph` (`config.toml:1-4,25-47`) |
| Cursor `cursor-agent` 2026.10.22 | `~/.cursor/mcp.json` (user); `<repo>/.cursor/mcp.json` (project) | user / project | HTTP yes (`type`+`url` entries). OAuth: `agent mcp login <identifier>` "Authenticate with an MCP server configured in .cursor/mcp.json or ~/.cursor/mcp.json". Token store not found under `~/.cursor` | **No `add` subcommand.** Edit the JSON, then `agent mcp enable <id>` / `login <id>` | `railway`, `sourcegraph`(url) |
| JetBrains Junie 26.10.27 | `~/.junie/mcp/mcp.json` (user); project `.junie/mcp/mcp.json`; extra folders via `--mcp-location` | user / project (`--mcp-default-locations`) | HTTP with static `headers` yes (current `docker-mcp` entry has `url`+`headers`). OAuth: no CLI surface, not verified | **No `mcp` subcommand** (`junie mcp --help` falls through to the main usage). Edit the JSON | `docker-mcp`(url), `omoide-curation`, `omi` |
| Docker MCP gateway | `~/.config/systemd/user/docker-mcp-gateway.service`, streaming on loopback `:8811`, bearer from `MCP_GATEWAY_AUTH_TOKEN` via `op run` | host-wide fan-in | It aggregates containerised catalog servers (`--servers`, `--catalog`, `--mcp-registry`); `docker mcp oauth authorize` covers catalog OAuth apps only. Nothing suggests it can proxy an arbitrary remote OAuth MCP | n/a (`docker mcp client connect <client>` wires the gateway *into* clients) | gateway servers: `sequentialthinking`, `github-official`. Clients pointing at it: Claude, Codex, Grok, Junie (`docker-mcp`) |

## T3 auto-injection into T3-launched provider sessions

Yes. Every thread T3 launches gets a **thread-scoped** bearer credential for the
same environment's `/mcp`, named `t3-code`. You do not need a user-scope
registration for that.

- Issuance: `ProviderSessionManager.prepareMcpSession` issues or reuses a credential
  per thread with capabilities `orchestration`, `worktree`, `pull-requests`, plus
  `preview`/`device` when enabled (`orchestration-v2/ProviderSessionManager.ts:441-500`).
  `options.configureMcp === false` turns it off (`:254,445`). The endpoint is the
  server's own bind address, with loopback substituted for an unspecified bind
  (`mcp/McpSessionRegistry.ts:71-89`). Idle tokens expire after a 24 h liveness
  window (`:60-64`).
- Codex: injects `mcp_servers.t3-code = {url, tool_timeout_sec, http_headers.Authorization}`
  as per-thread app-server config and "Override[s] only T3's server so
  launch-argument MCP servers survive" (`Adapters/CodexAdapterV2.ts:1358-1369`).
- Claude: `claudeMcpQueryOverrides` adds `mcpServers["t3-code"] = {type:"http", url, headers}`
  and allow-lists the tools (`Adapters/ClaudeAdapterV2.ts:1717-1745`). It loads user
  settings unless a custom Claude home is set (`settingSources`, `:4579,4609`), so the
  user's own `~/.claude.json` servers load too.
- Cursor: `cursorMcpServers` builds the same `t3-code` http entry
  (`packages/provider-cursor/src/server/adapter.ts:202-217,2372`).
- Grok and other ACP agents: the shared `makeAcpAdapterV2` path
  (`packages/provider-grok/src/server/adapter.ts:76-80`). It injects a stdio
  `t3-code` server running `t3 acp-mcp-bridge` with `T3_ACP_MCP_ENDPOINT` /
  `T3_ACP_MCP_AUTHORIZATION` in env. HTTP injection is opt-in per flavour because
  "codex-acp 1.2.0 and pi-acp drop injected HTTP servers"
  (`packages/provider-acp/src/server/adapter.ts:660-700`;
  `apps/server/src/cli/acpMcpBridge.ts:6-11`).
- OpenCode: registers the server per thread as `t3-code-<threadId|hash>`
  (`packages/provider-opencode/src/server/v2/adapter.ts:350-357`; v1
  `adapter.ts:960-973`).
- Muse: http `mcpServers` when the host grants `sessionMcp`
  (`packages/provider-muse/src/server/adapter.ts:1824-1837`).
- Antigravity: declares `supportsMcpTools` but the driver passes `mcpServers: []`
  (`provider/Drivers/AntigravityDriver.ts:301,456`). Injection not traced further.
- Junie is not a T3 provider, so nothing is injected there.

What this means: a user-scope registration is needed only for sessions that T3
**did not** launch, such as a bare terminal `claude`/`codex`/`grok`, Junie, or
Cursor outside T3. If a T3-launched session also has a user-scope registration,
it sees two T3 servers: the thread-scoped `t3-code` and the environment-scope
OAuth one. Name the user-scope entry so it cannot collide with `t3-code` (Codex
overrides that key, Claude merges it). Then decide whether the duplicate in
T3-launched sessions is acceptable. The OAuth grant is broader:
`T3CODE-QUALIFICATION.md:99-102` notes that T3 OAuth "operates at environment
scope".

## How beep-effect manages these surfaces today

- Project-scope files: `beep-effect/.mcp.json` registers 11 servers (stdio:
  `shadcn`, `next-devtools`, `serena`, `nlp`, `beep-m365-outbox`, `fallow`,
  `chrome-devtools`; url: `webstorm`, `stately`, `phoenix-docs`, `phoenix`).
  `beep-effect/.codex/config.toml:135-146` carries the url ones for Codex.
  `.cursor/`, `.grok/`, `.junie/` in the repo hold hooks, workflows and skills but
  no MCP config. The files are hand-synchronised, and no `beep` command writes
  harness MCP config.
- `@beep/ai-sync` (`packages/tooling/library/ai-sync/AGENTS.md:1-30`) is the nearest
  thing to an owner. It has schemas (`CodexConfig`, `ClaudeMcpJson`), validation of
  `.mcp.json` (`src/validation.ts:320-323`), drift checks, and pure transforms
  `codexMcpServersToClaudeMcpJson`, `claudeMcpJsonToCodexConfig`,
  `claudeMcpJsonToJunieMcpJson`, and the reverses. It describes itself as "not a CLI
  package, file fanout tool". There is no Grok or Cursor transform and no
  user-scope writer.
- User-scope registration is documented as manual runbook steps, e.g.
  `docs/runbooks/m365-agent-outbox-registration.md:255-263`
  (`claude mcp add --scope user …`).
- INBOX `agent-config-canonicalization` (`explorations/INBOX.md:23-33`): one
  semantic manifest compiled into Claude/Codex/Grok/t3code/Docker-MCP configs with
  "fail-closed compilation (an adapter that can't express a constraint errors
  instead of widening authority)". It was captured after removing two servers
  meant touching five surfaces per harness and 47 `.mcp.json` copies had drifted
  into 3 hashes. Still an INBOX item, not a packet.
- `explorations/mcp-auth-gated-registration`: stage `graduate`, status
  `graduated`, closed (`README.md:5-8,24-29`). Its scope is the **server side** of
  beep's own MCP servers: credential-keyed conditional `Toolkit` composition,
  read/write tier gating, `api_key_required`, and progressive disclosure
  (`README.md:13-21`). It shipped `goals/mcp-kit`, `goals/uspto-mcp`,
  `goals/mcp-host-retrofit`. The write wall went to
  `goals/agent-execution-authority` (`README.md:31-40`). It does not cover
  client-side harness registration or OAuth enrolment, so it has no stance on
  this plan beyond "write-capable sinks are classified by audience under
  agent-execution-authority". That applies here, because `t3_thread_send` is a
  write sink.

## Remote reproduction (other Linux hosts)

- `scripts/cloud/bootstrap.sh` (317 lines) is the one repo-owned bootstrap,
  covering Claude cloud, Codex cloud and Cursor Cloud (`:4-43`). It installs
  toolchains and env and writes no harness MCP config.
- `goals/cloud-agent-readiness` (active; expanded 2026-10-14 to beep-worker,
  dankserver and tbk worker) requires that "`.mcp.json` [stay] unchanged unless a
  host-scoped enable/disable mechanism exists" (`SPEC.md:52`), and D7 says
  workstation-only servers are documented as expected-failing elsewhere
  (`SPEC.md:93`). The MCP qualification record is
  `history/2026-10-14-mcp-qualification.md`. It adds no new MCP server (`SPEC.md:78`).
- `goals/lane-bootstrap` (active) creates and wires worktree lanes
  (`beep worktree add`). Its packet docs never mention MCP.
- No goal or script today provisions **user-scope** `~/.claude.json`,
  `~/.codex/config.toml`, `~/.grok/config.toml`, `~/.cursor/mcp.json` or
  `~/.junie/mcp/mcp.json` on a remote host. Reproducing the registration there
  means running each harness's `add` command (Claude/Codex/Grok) or writing JSON
  (Cursor/Junie), then an interactive OAuth login per harness per host. The login
  needs a browser and a pairing code; Codex has `--no-browser`, and Claude has
  `--callback-port` for a fixed loopback redirect. Over SSH, a loopback redirect
  needs port forwarding or a no-browser paste flow.

## Multi-environment

One T3 environment can act on linked environments, so you need one registered
endpoint per harness, not one per host. That holds only if linked environments
are enabled.

- Thread, environment and other routed tools take an optional `environmentId`
  (`OrchestratorMcpEnvironmentTarget`): "A linked environment to act in instead
  of this one. The tools that take it forward the call there"
  (`packages/contracts/src/orchestratorMcp.ts:318-328`; used in
  `mcp/toolkits/thread/tools.ts:36,95,133,158,171,197,224`,
  `mcp/toolkits/environment/tools.ts:45,61`).
- Routing: `McpToolAccess.takesLinkedEnvironment` and `routed` forward the same
  call to the peer, which re-checks access (`mcp/McpToolAccess.ts:353-380`).
  `peer/PeerForwarding.ts:49-92` refuses when "Linked environments is off on this
  machine … the user can turn it on in Settings → Labs". The setting is
  `linkedEnvironmentsEnabled`, default `false`
  (`packages/contracts/src/settings.ts:1263`).
- Effective authority on the far side is "the link's access and the caller's own
  modes" (`orchestratorMcp.ts:318-321`), so a hub environment's OAuth client
  cannot exceed its peer link's grant.

Choice: register one hub environment per harness and turn on linked environments,
or register N endpoints (one per environment) with N OAuth logins per harness per
host. The hub option adds an availability dependency on the hub and limits reach
to whatever each link grants.

## Gaps

1. No writer: nothing in beep-effect writes user-scope MCP config for any harness,
   and `@beep/ai-sync` has no Grok or Cursor transforms. Of the five harnesses,
   three have a CLI `add` (Claude, Codex, Grok) and two need JSON edits (Cursor,
   Junie).
2. Junie OAuth is unverified, and so is Grok's DCR/PKCE flow against a
   non-catalog server. Both may end up on static-header fallback, which the
   qualification doc forbids for desktop bootstrap credentials. Probe each with a
   throwaway T3 environment before committing to a design.
3. Codex's OAuth store location is the unset default. Confirm it, so remote hosts
   without a keyring don't silently fall back to a file.
4. The Docker gateway cannot front the T3 endpoint. It stays a separate fan-in and
   is not a single registration point.
5. Duplicate exposure: in T3-launched sessions, the environment-scope OAuth server
   sits beside the thread-scoped `t3-code` and has broader authority. That needs a
   naming and narrowing decision (`T3CODE-QUALIFICATION.md:99-102`).
6. Remote OAuth bootstrap needs an interactive login and pairing per harness per
   host, and no repo-owned procedure exists for it. It belongs with the
   `agent-config-canonicalization` manifest or `cloud-agent-readiness`.
7. Hub routing depends on `linkedEnvironmentsEnabled` (a Labs flag, default off)
   and on peer-link grants per environment pair.

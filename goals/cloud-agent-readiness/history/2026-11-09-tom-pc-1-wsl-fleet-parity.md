# 2026-11-09: tom-pc-1-wsl brought to fleet parity

Sanitized receipt. Tokens, pairing codes, environment ids, tailnet names and
addresses stay in the private orchestrator handoff. Paths are relative to the
`agent` account's home directory on the distro.

Scope: only tom-pc-1-wsl was changed live ("We only need to do tom-pc-wsl-1.
No need for the others yet."). The repository changes below are fleet-generic.

## Done on the host

| Item | Result |
| --- | --- |
| Desktop pairing (client plane) | re-minted and accepted on DankStation |
| beep-effect checkout | fast-forwarded to `origin/main` at `8c902a15b2`, then `bun install` |
| Toolchain | mise globals bun 1.4.4 and node 24.22.1 |
| T3 project | the checkout registered with `t3 project add`; this is what makes the host appear in the desktop composer's "Run on", which lists only environments holding a project with the same repository key |
| Muse | the settings file (`~/.config/muse/settings.json`) had no `schema_version`, so `muse serve` exited 3 on every T3 probe and T3 could not read the model catalog. Fixed with `schema_version` 1, provider `meta`, model `muse-wonder-1.0`, `reasoning_effort` medium; T3 now reports Muse ready |
| Claude Code defaults | user settings: `permissions.defaultMode` `bypassPermissions`, `skipDangerousModePermissionPrompt` true, model `claude-opus-5-5` with `effortLevel` medium |
| Codex defaults | `~/.codex/config.toml`: model `gpt-6.1-sol`, `model_reasoning_effort` medium, `approval_policy` never, `default_permissions` `:danger-full-access` |
| Grok defaults | `[ui] permission_mode` `always-approve` |
| Junie defaults | `braveMode` on, `subagentsMode` Auto, `modelForLaunch` `gemini-3-flash-preview` |
| Checkout MCP servers | Claude's per-project `disabledMcpjsonServers` lists the checkout's `.mcp.json` servers the repository settings leave pending (`beep-m365-outbox`, `fallow`, `next-devtools`, `nlp`, `shadcn`), and the trust dialog is accepted, so a headless T3 turn does not stall at "Pending approval" |

The permission defaults follow the unsupervised child mode in
`docs/runbooks/agent-pools.md` ("Child permission mode", ruling R12). Claude stays
signed in to the operator's chosen account.

## Already in place (verified live)

- A `t3-code` MCP entry for all seven harnesses (Claude, Codex, Grok,
  cursor-agent, Junie, Kimi, Muse) pointing at the host's own loopback T3, each
  with its own 180-day bearer token expiring 2027-05-07.
- The agent-plane link at Full access until 2027-05-07; phone pairing over
  Tailscale until 2026-12-08.
- A `gh` login for git push (token expires 2027-11-09), the fork T3 pull timer,
  the fleet developer toolset and rootless Docker.
- No 1Password agent credential: an operator grant, out of scope here.

`/update-harnesses` status over `ssh-tom-pc-1-wsl` (read-only) found Claude
2.1.321 native, Codex 0.167.0 npm, Grok 1.0.77 native, Kimi 2.5.2, Junie
1468.30 npm (migrates to the managed launcher on the first update), Cursor
Agent 2026.11.05, Muse 1.4.14 and T3 `0.1.8-fork.20261110.15` from the fork
pull unit.

## Repository changes (this PR)

- `.claude/skills/update-harnesses/scripts/update_harnesses.py`: tom-pc-1-wsl
  joins `HOSTS` through `ssh-tom-pc-1-wsl` (touch login, `--admin -tt` admin
  route), with the `tom-pc-1` alias and its own unreachable note (PC off,
  Windows user signed out, or the `T3AgentWSL` keep-alive task not running).
  The admin route used to start the dankserver agent for every host; it now
  does so only for routes that forward it (beep-worker, grok-bot), because
  tom-pc-1-wsl's wrapper keeps its own agent.
- `.claude/skills/update-harnesses/scripts/harness_host.sh`: a read-only Muse
  check that adds a note to the `muse` row when the settings file lacks
  `schema_version`.
- Docs: the update-harnesses skill and its harness reference, the remote
  development host profiles, the orchestrator's spill note and
  `docs/runbooks/t3code-fleet.md` (link at `full-access`, Kimi and Muse MCP
  rows, the daily `harness-ensure` timer, four new gotchas).
- `goals/cloud-agent-readiness/history/2026-11-07-tom-pc-1-wsl-worker-access.md`:
  the access receipt from a stranded 2026-11-07 lane, corrected.

## Still open (operator-owned)

- Cursor sign-in inside T3: T3's Cursor provider uses its own credential,
  separate from the CLI login, which is signed in.
- Junie and Kimi need Install in T3's Settings → Providers (ACP registry).
  Kimi's T3 sign-in is blocked fleet-wide until `beep-effect/t3code#1` merges.
- sudo items: the unattended-upgrades `-updates` origin and `t3 service protect`.

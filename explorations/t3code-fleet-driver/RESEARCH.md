# Research

## 2026-11-01 — Synthesis

Four read-only sweeps, each with its own cited report:

| Sweep | Report |
| --- | --- |
| T3 Code product and source (fork `beep-effect/t3code` at `fa31b66bbb`, plus the operator's transcript of Theo's 2026-10-29 video) | [research/t3code-capabilities.md](research/t3code-capabilities.md) |
| Harness MCP registration surfaces | [research/harness-mcp-surfaces.md](research/harness-mcp-surfaces.md) |
| Fleet hosts and the DankStation compute signal | [research/fleet-hosts.md](research/fleet-hosts.md) |
| In-repo orchestration, handoff and messaging bricks | [research/repo-inventory.md](research/repo-inventory.md) |

This packet builds on
[cross-provider-agent-communication](../cross-provider-agent-communication/README.md).
That packet qualified a T3-owned desktop host for autonomous Claude <-> Codex
messaging ([T3CODE-QUALIFICATION.md](../cross-provider-agent-communication/research/T3CODE-QUALIFICATION.md))
and graduated `goals/agent-message-router` and `goals/agent-session-bridges`
(both merged in PR #1571). Its queued candidates for cross-host delivery and
live orchestrator coordination
([MAP.md](../cross-provider-agent-communication/MAP.md)) are the re-entry
points this packet picks up.

### What T3 Code already gives us

- **MCP inside T3 is automatic.** Every provider session T3 launches gets a
  `t3-code` MCP server with a credential scoped to that thread, for Codex,
  Claude, Cursor, Grok, ACP agents and OpenCode. Antigravity is the exception:
  it receives an empty server list. Agents running in T3 need no registration.
  ([capabilities §1](research/t3code-capabilities.md#1-mcp-server),
  [harness surfaces](research/harness-mcp-surfaces.md))
- **Outside harnesses enroll by OAuth.** The flow is PKCE plus a pairing code,
  with a Read-only or runtime-mode ceiling. The grant covers the whole
  environment, lasts 30 days, and can be revoked in Settings. OAuth completes
  only over HTTPS or loopback, so tailnet use needs Tailscale HTTPS
  (`t3 serve --tailscale-serve` / `t3 pair --tailscale`). A Read-only grant
  cannot send to a Full-access thread
  ([prior qualification](../cross-provider-agent-communication/research/T3CODE-QUALIFICATION.md)).
- **Cross-host messaging is native but in beta.** With "Linked environments"
  (a Labs setting, off by default) turned on at both ends, `t3_thread_send`,
  `read`, `wait`, `list`, `interrupt`, the scheduled-task tools and
  `delegate_task` accept an `environmentId` and forward the call to the
  linked environment. Each link joins two environments by pairing code
  (`t3 environment link`), must be renewed every 30 days, and has no fleet-wide
  auto-linking. A full-access link runs agents unfenced as the remote user.
  ([capabilities §3](research/t3code-capabilities.md#3-remote-and-multi-environment))
- **Headless Linux server.** Run `t3 up --lan` plus `t3 service install`: a
  systemd user service with linger. It needs Node `^22.16 || ^23.11 || >=24.10`,
  and keeps state in the T3 home's `userdata` directory. Provider CLIs must be on the service's
  PATH or set as per-provider binary paths (mise installs need this).
  ([capabilities §2](research/t3code-capabilities.md#2-headless--server-deployment))
- **One client drives many environments.** The desktop app saves remote
  environments and can run remote-only. T3 Connect's free tier stops at 3
  machines, so the fleet uses Tailscale.
- **Windows.** The desktop app has a WSL backend that installs its own server
  runtime inside a chosen distro. There is no Windows background service, so
  the app must stay open. `t3 service` under systemd inside WSL is
  undocumented. ([capabilities §4](research/t3code-capabilities.md#4-windows--wsl))
- **Updates.** The sidebar updater and `t3 update` track the public npm `t3`
  package. A fork build on remote hosts has to be distributed by us.
  ([capabilities §6](research/t3code-capabilities.md#6-updating))

### What the repo already has

- `bun run beep agent-message` is a private SQLite mailbox with grants,
  receipts and 17 subcommands. Its six `agent_message_*` tools have managed
  adapters for Codex, Claude and Grok; Cursor is blocked.
  ([inventory](research/repo-inventory.md))
- `@beep/t3-code` (`packages/drivers/t3-code`) wraps six T3 tools: send is
  queue-only, and it has no launch. Its URL is pinned to loopback
  (`T3Code.service.ts:32`), so a remote environment needs an SSH forward.
  `attach-t3` hardcodes model pins instead of reading the models manifest.
- Skills live only in `.claude/skills`. `.agents/skills` symlinks it, and Codex
  reads it from there. `bun run beep skills update` regenerates the Codex
  skills table. Junie and Grok do not receive repo skills.
- Edit targets for "T3 is the session and messaging substrate":
  `orchestrate` (route table and T3 section), `operator-handoff` (re-arm and
  broadcast), `remote-development-agents` (no T3 at all; two hosts missing),
  `docs/runbooks/agent-messaging.md`, `agent-notifications.md`,
  `agent-pools.md`, and `AGENTS.md`. The full table is in
  [inventory](research/repo-inventory.md).
- No `beep` command writes harness MCP config. `@beep/ai-sync` has schemas and
  Claude/Codex/Junie transforms, but no Grok or Cursor transform and no
  user-scope writer. `agent-config-canonicalization` is still an INBOX bullet.

### Fleet state (probed 2026-11-01, read-only)

| Host | T3 today | Spill fitness | Blocker |
| --- | --- | --- | --- |
| DankStation | Desktop app, tailnet-only Serve on :443 | Source of spill (32C/64T, 125 GiB) | — |
| beep-worker | **`t3code.service` running**; :3773 answers over tailnet | Primary target | Cores/RAM unrecorded; SSH needs YubiKey touch |
| tbk-worker | none | Small (4 vCPU / 32 GiB) | **Offline since 2026-10-26, protective-stop latch held; agents must not start it.** SSH-forward-only network design |
| dankserver | none | Last-resort overflow (8T / ~16 GiB, shared with monitoring) | One job at a time, 7 GiB slice |
| grok-bot-box-1 | none | Low | Tailnet policy refuses operator user; likely the Grok Bot hosted VM; the grok-bot packet forbids local credentials there |
| tom-pc-1 | none | Medium (8C / 64 GiB; one WSL distro capped at 4 CPU / 8 GB) | The attorney's PC, strict telemetry tier. **The accepted 2026-10-26 design is a Hyper-V VM, not WSL.** SSH key auth currently rejected; reboot coordination needed with the PC's user |

Details: [fleet-hosts.md](research/fleet-hosts.md).

### Compute signal for a spill policy

The Palantiri `host-pressure` parcel
(`bun run beep palantiri parcel host-pressure --json`, also over
`palantiri mcp`) reads local PSI, meminfo and admission slots, and stays fresh
for one minute. The 7-day DankStation baseline puts CPU some-avg10 p99 at about
30%, memory full-stall p99 at about 4%, and MemAvailable p1 at about 13.5 GiB.
One sample reports MemAvailable 0 and must be explained before it feeds a
threshold. Nothing reads remote-host pressure (`fleet-telemetry-tailnet` has
not started). The only existing constrained-compute rule pushes checks to
hosted CI after 10 minutes; nothing moves agent work to another host.
([fleet-hosts §compute](research/fleet-hosts.md#dankstation-compute-signal-for-spill-when-constrained),
[inventory](research/repo-inventory.md))

### Constraints surfaced

1. Tailnet MCP OAuth requires Tailscale HTTPS on every environment an outside
   harness enrolls with.
2. T3 OAuth is environment-wide and broader than Beep's recipient grants. A
   full-access environment link runs agents unfenced as the remote user.
3. Registering an outside `t3` server at user scope in `~/.claude` or
   `~/.codex` may also load it into T3-launched sessions next to the injected
   `t3-code`. Use a distinct name and verify live.
4. Both 30-day cadences need a renewal owner: outside-agent grants and
   environment links.
5. Fork builds bypass T3's updater. A distribution route is needed before
   rollout.
6. tbk-worker's latch and tom-pc-1's coordination with the PC's user are
   operator-only gates. Agents do not cross them.
7. tom-pc-1 is strict-tier: no Funnel, a loopback or tailnet-only listener,
   no client data in the repo, separate credentials.
8. Security exposure found during research: a plaintext static bearer in a
   user-scope Codex MCP header. It was reported to the operator and kept out
   of the repo; it is not a packet deliverable.

### Gaps (NOT FOUND)

- No per-provider switch to stop T3's MCP injection.
- No way to point T3's updater at a fork or custom registry.
- No MCP scope narrower than one environment.
- No remote-host pressure feed.
- No repo-owned writer for user-scope harness MCP config.
- No host profile for grok-bot-box-1 or tom-pc-1 in `remote-development-agents`.

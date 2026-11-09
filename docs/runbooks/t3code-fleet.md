# T3 Code fleet: fork publish, host pull, links

Every live worker host runs the same fork build of T3 Code as a systemd user
service, installed through T3's own updater from a tailnet-only mirror that
DankStation publishes after each fork sync. Packet:
`goals/t3code-fleet-rollout`. Versioned scripts: that packet's `ops/`.

## How it fits together

| Piece | Where | What it does |
| --- | --- | --- |
| `update-t3code-source` | DankStation `$HOME/.local/bin` (out of repo) | Timer at login (+4 min) and daily at 08:00: merge upstream into the fork, stamp one fork version, build the hub AppImage, publish the CLI archive, push the fork, install the hub build. The fork is `beep-effect/t3code`, the only fork of upstream in use. The primary checkout's `main` is fast-forwarded when it is clean. `T3CODE_SYNC_FORCE=1` rebuilds the current commit. Logs: `$HOME/.local/state/t3code-sync/`. |
| `t3code-restart-prompt` | DankStation `$HOME/.local/bin` (out of repo) | Launched detached by the sync when the hub app is open (it starts before the login timer fires): a Plasma notification offers "Restart T3 Code now"; on click it stops only the hub's Electron main, waits up to 30 s, and relaunches `t3code` with the old session environment. |
| `t3code-fork-publish` | DankStation `$HOME/.local/bin`; source `ops/t3code-fork-publish.sh` | Builds the resource monitor, the server single-executable and the Linux x64 CLI archive; writes `v<version>/{archive,SHA256SUMS}` and `latest.json` under `$HOME/.local/opt/t3code/publish`; serves that directory tailnet-only with Tailscale Serve (no Funnel). |
| `t3code-fork-pull` | each host `$HOME/.local/bin`; source `ops/t3code-fork-pull.sh` + timer units | Every 30 min: read `latest.json`; when the version differs from the service's `activeVersion`, run `t3 update <version> --yes`, which verifies `SHA256SUMS`, trials the runtime, rolls back on failure and restarts the service. |
| `$HOME/.config/t3code-fork/pull.env` | each host, mode 600, never committed | `T3CODE_FORK_MIRROR=https://<hub>.<tailnet>.ts.net:<port>` |
| `$HOME/.t3/service.env` | each host | The pull script pins `T3CODE_RELEASE_BASE_URL` to the mirror, so a remote "Update server" can only resolve fork versions; official releases are unreachable by construction. |

Version scheme: `<upstream version>-fork.<yyyymmdd>.<hhmm>` (prerelease ids
are plain semver numbers, so no leading zeros). The hub AppImage and the
archive carry the same string, so clients see every machine at one version.
T3 reads a `-fork.` prerelease as the stable channel; the `-nightly.` and
`-preview.` suffixes are reserved by upstream.

## Install the pull on a host

Ordinary worker account, the host's approved SSH wrapper, one YubiKey touch
per connection. No sudo is needed: the service, linger and the slice already
exist on beep-worker and dankserver.

```sh
# from the beep-effect checkout, <wrapper> = ssh-beep-worker | ssh-dankserver-worker
ops=goals/t3code-fleet-rollout/ops
tar -C "$ops" -cf - t3code-fork-pull.sh t3code-fork-pull.service t3code-fork-pull.timer \
  | <wrapper> 'd=$(mktemp -d) && tar -C "$d" -xf - \
    && mkdir -p $HOME/.local/bin $HOME/.config/systemd/user $HOME/.config/t3code-fork \
    && install -m755 "$d/t3code-fork-pull.sh" $HOME/.local/bin/t3code-fork-pull \
    && install -m644 "$d/t3code-fork-pull.service" "$d/t3code-fork-pull.timer" $HOME/.config/systemd/user/ \
    && rm -rf "$d"'
# write pull.env by hand on the host (mode 600) with the mirror URL, then:
<wrapper> 'systemctl --user daemon-reload && systemctl --user enable --now t3code-fork-pull.timer \
  && systemctl --user start t3code-fork-pull.service && cat $HOME/.t3/runtime/fork-current'
```

## Verify parity

- Hub: `cat $HOME/.local/opt/t3code/source-version` and `curl -s https://<hub>.<tailnet>.ts.net:<port>/latest.json`.
- Host: `cat $HOME/.t3/runtime/fork-current` (fork commit and version), `t3 service status`
  (`installed · t3@<version>`, no problems), `journalctl --user -u t3code-fork-pull.service -n 20`.
- All equal: the published `version` equals every host's `activeVersion`.

## Roll back a host

Previous versions stay under `$HOME/.t3/runtime/versions/`. Set
`T3CODE_FORK_ALLOW_DOWNGRADE=1` in `pull.env` only for the manual step:

```sh
T3CODE_RELEASE_BASE_URL=<mirror> t3 update <previous version> --yes --allow-downgrade
```

The timer will move the host forward again at its next run unless the mirror's
`latest.json` is also rolled back (republish from an older fork commit with
`T3CODE_SYNC_FORCE=1` after checking out that commit, or copy an older
`v<version>/` directory's values into `latest.json`).

## Linked environments

Two separate planes:

1. **Client plane** (Settings → Environments): the desktop app's own connection
   to each host. Pair over the host's `.ts.net` name. Load balancing, PR sharing
   and scheduled tasks live here. Load balancing routes only new composer threads
   inside a project grouped by repository ("Group by repository" in Settings →
   General); it never places `delegate_task` work.
2. **Agent plane** (Settings → Labs → Linked environments, on at both ends):
   one server links to another's MCP endpoint. Link hub → host over `https://`
   or `http://<host>.<tailnet>.ts.net:3773`, never a bare `http://100.x`. Choose
   Auto or Full access for unattended work (Supervised prompts on every command;
   only Full access allows remote scheduled tasks). The fleet links at Full access;
   below it, a link's agents touch only threads they started and skip setup
   scripts. Links expire after 180 days (see "Harness MCP registration and
   renewal"). Environment ids and tailnet names stay in the private orchestrator
   handoff, never in the repo.

## Pair a host in the desktop app (client plane)

A host linked on the agent plane does not appear in the composer's "Run on"
list until the desktop app has also paired with it. On the host:

```sh
t3 pair --ttl 15m --label dankstation-desktop
```

Paste the printed pairing URL into **Settings → Environments → Add
environment** on DankStation. For a host whose server binds loopback behind a
Serve route (dankserver), the printed URL carries `127.0.0.1:3773`; replace the
scheme, host and port with the Serve address (`https://<host>.<tailnet>.ts.net:8448`)
before pasting. The token is what authorizes the pairing; the address only tells
the app where to connect. Add the host under **Load balancing** afterwards if
Auto balance should place threads there.

## tom-pc-1 (WSL distro)

tom-pc-1 is the attorney's Windows PC. Its agent environment is a dedicated WSL
distro, `t3-agent` (Ubuntu 26.04, installed at `C:\WSL\t3-agent`), with its own
Linux user `agent`, `/mnt/c` automount and Windows interop off, systemd on, and
hostname `tom-pc-1-wsl`. The existing `Ubuntu` distro stays untouched. The
distro runs its own `tailscaled` and is its own tailnet node, because the
Windows node already carries an unrelated Funnel route and must not gain a T3
listener (decision 2026-11-06). All steps run over the PC's key-auth SSH
(`<windows-user>@tom-pc-1`, PowerShell), never through the Desktop remote-control task.

1. Install: `wsl --install Ubuntu-26.04 --name t3-agent --no-launch --location C:\WSL\t3-agent`.
2. Configure as root (`wsl -d t3-agent -u root`): write `/etc/wsl.conf`
   (`[boot] systemd=true`, `[automount] enabled=false mountFsTab=false`,
   `[interop] enabled=false appendWindowsPath=false`, `[user] default=agent`,
   `[network] hostname=tom-pc-1-wsl`), `useradd -m -s /bin/bash agent`, install
   `curl ca-certificates tar python3` and Tailscale (`tailscale.com/install.sh`),
   `loginctl enable-linger agent`, `tailscale set --operator=agent`, then
   `wsl --terminate t3-agent` so the config applies.
3. Keep-alive: WSL stops a distro a few seconds after its last session ends,
   systemd or not. A logon-triggered scheduled task `T3AgentWSL` runs
   `wscript //B C:\WSL\t3-agent-keepalive.vbs`, which holds a hidden
   `wsl -d t3-agent -u root --exec /bin/sleep infinity`; execution time limit
   0, restart on failure. This is also the reboot-survival path: the distro
   comes back at the PC user's next sign-in. Check with `wsl -l -v`.
4. Join the tailnet: `tailscale up --hostname tom-pc-1-wsl --ssh=false` prints
   a login URL; the operator approves it in the admin console.
5. Install T3 in the distro as `agent` with the mirror pinned (`$HOME` is that
   account's home): stage `ops/t3code-fork-pull.sh` and its units under
   `$HOME/.local/bin` and `~/.config/systemd/user`, write
   `~/.config/t3code-fork/pull.env`, then
   `T3CODE_RELEASE_BASE_URL=<mirror> T3CODE_VERSION=<published version> sh install.sh`
   (the public `t3.codes/install.sh` honours both), pin the same URL in
   `$HOME/.t3/service.env`, `t3 service install`, enable the pull timer. The
   staged `$HOME/t3-finish.sh` does exactly this once Tailscale is up.
6. Publish and link: `t3 pair --tailscale --ttl 15m` inside the distro (Serve
   on the distro's own node, no Funnel); on the hub
   `t3 environment link https://tom-pc-1-wsl.<tailnet>.ts.net --pairing-code <code> --access auto`.
   Then pair the desktop app the same way as the other hosts.

Rollback: `wsl --unregister t3-agent`, delete the `T3AgentWSL` task and
`C:\WSL`, and delete the `tom-pc-1-wsl` node in the Tailscale admin console.

## grok-bot host (the Grok Bot computer)

The Grok Bot's persistent cloud computer is a Cursor-hosted Firecracker microVM
(Debian 13, 8 cores, 15 GiB, user `box`) that the operator joined to the tailnet
by hand. It became a fleet host on 2026-11-08 (decision
`grok-bot-vm-in-scope` in `goals/t3code-fleet-rollout`), with three properties
no other host has:

- **It sleeps.** The hosting side hibernates the VM a few minutes after the
  Grok Bot app's computer view closes, whatever SSH is doing. Keep the view
  open while working there, or hand a Bot `/workspace/bootstrap/keepalive.sh`
  as one long-running task (usage is metered per turn, not per minute). The
  DankStation timer `grok-bot-ensure.timer` reconciles T3 only while the node
  is online and posts one notification per sleep/wake transition.
- **No systemd.** PID 1 is Cursor's supervisor, so `t3 service install` and
  the pull timer do not apply. `/workspace/bootstrap/ensure-services.sh` runs
  the fork pull (`t3-pull.sh`, the repo script minus its service steps),
  starts `t3 serve --no-browser --host 127.0.0.1 --port 3773 /workspace` when
  the port is dead, and keeps the tailnet-only Serve route on HTTPS 443 (the
  `box` account is the Tailscale operator). `tailscaled` was started by hand,
  so a true reboot needs `/workspace/bootstrap/boot.sh` from the Bot terminal.
- **Only `/workspace` is documented as durable.** Every install is a re-runnable
  script under `/workspace/bootstrap/`; home-directory state has survived so
  far but may not survive an image rebuild.

Access: Tailscale SSH as `box` (no sshd), wrapper `ssh-grok-bot`; `--admin`
forwards the dedicated YubiKey agent for `pam_rssh` sudo (the image's
passwordless sudo was replaced; the account password is the documented
fallback and lives only in the operator's private state). The box's egress
proxy refuses `deb.debian.org` pool downloads: list them with
`apt-get install --print-uris`, fetch on DankStation, push over the tailnet,
then `apt-get install ./*.deb`. Vendor repositories (Anthropic, OpenAI,
1Password, GitHub, the hub mirror) work directly.

## tbk-worker

The operator released tbk-worker's protective-stop latch on 2026-11-07, so the
gated steps this section used to hold have run. The guest uses the same pull as
beep-worker, keeps its T3 listener on loopback under `agent-runs.slice`, and is
published with Serve on its own tagged tailnet node, not through an SSH forward.
Its grants admit only hub SSH, hub to Serve, and guest to the hub mirror. Receipt:
[goals/t3code-fleet-rollout/history/2026-11-07-tbk-worker-link.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/t3code-fleet-rollout/history/2026-11-07-tbk-worker-link.md). A later stop
latch is still the operator's to release; agents do not clear it as job cleanup.

## Harness MCP registration and renewal

Every harness on every host has a user-scope MCP entry named `t3-code` that points
at **that host's own** loopback T3 (`http://127.0.0.1:3773/mcp`). Linked environments
carry calls on to the other hosts. This replaced the planned shared `t3-hub` entry
(decision `per-host-t3-code-replaces-t3-hub` in `goals/t3code-harness-mcp`).

| Harness | Where the entry lives | Header key |
| --- | --- | --- |
| Claude Code | `~/.claude.json`, top-level `mcpServers` | `headers.Authorization` |
| Codex | `~/.codex/config.toml`, `[mcp_servers.t3-code]` | `http_headers.Authorization` |
| Grok | `~/.grok/config.toml`, `[mcp_servers.t3-code]` | `headers.Authorization` |
| cursor-agent | `~/.cursor/mcp.json`, then `cursor-agent mcp enable t3-code` | `headers.Authorization` |
| Junie | `~/.junie/mcp/mcp.json` | `headers.Authorization` |

**Authorize or renew.** `/mcp` accepts only MCP OAuth tokens; `t3 auth session issue`
tokens fail with `invalid_mcp_credential`. The token has no refresh, so each harness
gets one bearer token by a headless authorization-code + PKCE run. The script lives
out of repo because tracked Python is banned: on the hub
`$HOME/.local/share/t3code-fleet/t3-mcp-authorize.py`. Copy it to the host, run it
there, and delete the copy. It mints its own pairing code, prints no token, backs up
each config under `$HOME/.cache/beep/mcp-auth-backup-<time>/` and leaves configs at
mode 600. Never copy a token between hosts.

**Renew the links** in the same pass: `t3 pair --ttl 10m` on the host, then on the hub
`t3 environment link <serve-url> --pairing-code <code> --access full-access`, which
upserts the same environment id.

**Expiry.** Tokens and links both ride the fork's `MCP_CLIENT_SESSION_TTL`, 180 days
(`beep-effect/t3code#2`), and the current set expires **2027-05-07**. The one-shot
`t3code-fleet-renewal-reminder.timer` on DankStation notifies on 2027-04-23. It only
reminds; automatic renewal was declined on 2026-11-08. After renewing, set the unit's
`OnCalendar` two weeks before the next expiry.

**Verify.** A headless turn in an empty directory (a repository's `.mcp.json` can stall
one at "Pending approval"): ask the harness to call `t3_thread_list` with
`allProjects: true, limit: 1`, then `t3_thread_read`.

**T3-launched sessions do not double-load.** T3 injects a thread-scoped server under the
same `t3-code` key, so the injected entry replaces the user-scope one. A T3-launched
Codex session lists `mcp__t3_code` plus `mcp__t3_code_direct`, which is T3's own split
(68 deferred tools and a direct `t3_thread_wait`, no name in both), not a second server.

## Where to launch (spill routing)

The advisory rule and its threshold table are in `.claude/skills/orchestrate/SKILL.md`,
"Where to launch". Read the signal with
`bun run beep palantiri parcel host-pressure --json`, which reads `/proc` live and does
not depend on the recorder below.

The baseline came from the contained PSI sampler: `beep-psi-sample.timer` (30 s) runs
`$HOME/.local/share/beep-psi/sample-safe.py` through the drop-in
`99-workstation-light-sampling.conf` and appends to
`$HOME/.local/state/beep-psi/safe-pressure.jsonl`, ring-trimmed at 14 days. Do not read
the older `psi.log`, `runtime.json` or `runtime-history.ndjson` in that directory; they
are stale since 2026-09-15. To re-derive the thresholds, use 7 days of samples and the
same percentile for each signal: p99 for the avg60 stall rows, p95 for the CPU avg300
qualifier, and p1 for available memory, as
[goals/t3code-spill-routing/history/2026-11-08-baseline.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/t3code-spill-routing/history/2026-11-08-baseline.md) did.

## Gotchas

- The single-executable build needs the exact `engines.node` from the fork's
  root `package.json` on PATH (`mise install node@<version>`); the archive ships
  the running Node.
- `t3 update` and `t3 service install` on a host always run
  `$HOME/.t3/runtime/versions/<version>/t3`; do not point the unit at any other path.
- Never run `t3 update` without the mirror pinned: with `T3CODE_RELEASE_BASE_URL`
  unset it resolves the public GitHub release and would replace the fork build.
- The hub AppImage is built without a GitHub publish config, so the desktop
  updater has no feed; the sync posts a restart prompt when the app is open,
  and a build installed while the app is closed runs on the next launch.
- Fork freshness is judged on `beep-effect/t3code` and the sync log
  (`$HOME/.local/state/t3code-sync/`), not on upstream's commit count.
- WSL terminates a distro once its last `wsl.exe` session ends, even with
  systemd running inside it; the T3 service on tom-pc-1 survives only while the
  `T3AgentWSL` keep-alive task holds a session open.
- A delegated Claude turn that fails with "Claude timed out while registering
  its MCP tools" after 90 s points at the target project's `.mcp.json`: servers
  the host's Claude config has neither approved nor disabled for that checkout
  sit at "Pending approval", and a headless T3 turn has no one to answer.
  `claude mcp list` in the checkout shows them. Record each one under that
  project's `disabledMcpjsonServers` (or `enabledMcpjsonServers`) in the host's
  Claude user config (`.claude.json` in the account's home). A bare one-commit
  project passing on the same host confirms the diagnosis.
- `t3_thread_list` from a session T3 did not launch fails with `target_required`
  ("this MCP client is not running inside a T3 thread") unless it passes `projectId`
  or `allProjects: true`. The registration is fine. Thread-scoped defaults exist only
  inside T3-launched sessions.
- Workers run an older Junie build without a JetBrains login. Their `t3-code` token
  works when called directly, but a Junie turn there needs an operator login first,
  and `--model=claude-opus-5-5` is not in that build's catalog.
- beep-worker's AppArmor profile (`/etc/apparmor.d/beep-cursor-sandbox`) pins the exact
  Cursor CLI and T3 SDK helper paths, so an update of either breaks that sandbox with
  `SandboxUnsupportedError`. Reconcile the two paths through YubiKey sudo, reload with
  `apparmor_parser -r`, confirm with `cursor-agent sandbox run echo ok`, and restart T3
  when idle to clear a cached preflight failure. Never disable the sandbox.

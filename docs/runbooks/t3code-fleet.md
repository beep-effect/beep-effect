# T3 Code fleet: fork publish, host pull, links

Every live worker host runs the same fork build of T3 Code as a systemd user
service, installed through T3's own updater from a tailnet-only mirror that
DankStation publishes after each fork sync. Packet:
`goals/t3code-fleet-rollout`. Versioned scripts: that packet's `ops/`.

## How it fits together

| Piece | Where | What it does |
| --- | --- | --- |
| `update-t3code-source` | DankStation `$HOME/.local/bin` (out of repo) | Daily timer: merge upstream into the fork, stamp one fork version, build the hub AppImage, publish the CLI archive, push the fork, install the hub build. `T3CODE_SYNC_FORCE=1` rebuilds the current commit. |
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
   only Full access allows remote scheduled tasks). Links expire after 30 days;
   `goals/t3code-harness-mcp` owns the renewal reminder. Environment ids and
   tailnet names stay in the private orchestrator handoff, never in the repo.

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
(`tjopp@tom-pc-1`, PowerShell), never through the Desktop remote-control task.

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
5. Install T3 as `agent` with the mirror pinned: stage `ops/t3code-fork-pull.sh`
   and its units under `~/.local/bin` and `~/.config/systemd/user`, write
   `~/.config/t3code-fork/pull.env`, then
   `T3CODE_RELEASE_BASE_URL=<mirror> T3CODE_VERSION=<published version> sh install.sh`
   (the public `t3.codes/install.sh` honours both), pin the same URL in
   `~/.t3/service.env`, `t3 service install`, enable the pull timer. The
   staged `~/t3-finish.sh` does exactly this once Tailscale is up.
6. Publish and link: `t3 pair --tailscale --ttl 15m` inside the distro (Serve
   on the distro's own node, no Funnel); on the hub
   `t3 environment link https://tom-pc-1-wsl.<tailnet>.ts.net --pairing-code <code> --access auto`.
   Then pair the desktop app the same way as the other hosts.

Rollback: `wsl --unregister t3-agent`, delete the `T3AgentWSL` task and
`C:\WSL`, and delete the `tom-pc-1-wsl` node in the Tailscale admin console.

## tbk-worker (gated)

Do not run these until the operator releases tbk-worker's protective-stop
latch (exploration `t3code-fleet-driver`, decision `tbk-worker`). tbk-worker
is a KVM guest whose network design exposes nothing but SSH to DankStation, so
its T3 listener stays on loopback and is reached through an SSH port forward,
not Tailscale Serve.

1. Start the guest through its guarded manual start and confirm the latch is
   clear; connect with `ssh-tbk-worker` (account `worker`, no sudo).
2. Install the pull the same way as beep-worker (section above); the service,
   linger and slice already exist from the worker's readiness packet.
   `service.env` keeps `T3CODE_HOST=127.0.0.1`.
3. Link from the hub over a forward:
   `ssh -N -L 127.0.0.1:3774:127.0.0.1:3773 tbk-worker` kept open by a user
   unit on DankStation, then `t3 pair --ttl 15m` on the guest and
   `t3 environment link http://127.0.0.1:3774 --pairing-code <code> --access auto`.
   The link dies with the forward; the unit must restart it.
4. Record the receipt under `goals/t3code-fleet-rollout/history/` and fill in
   the `tbk-worker` row of the host profiles.

## Gotchas

- The single-executable build needs the exact `engines.node` from the fork's
  root `package.json` on PATH (`mise install node@<version>`); the archive ships
  the running Node.
- `t3 update` and `t3 service install` on a host always run
  `$HOME/.t3/runtime/versions/<version>/t3`; do not point the unit at any other path.
- Never run `t3 update` without the mirror pinned: with `T3CODE_RELEASE_BASE_URL`
  unset it resolves the public GitHub release and would replace the fork build.
- The hub AppImage is built without a GitHub publish config, so the desktop
  updater has no feed; restart T3 Code after a sync to pick up the new build.
- WSL terminates a distro once its last `wsl.exe` session ends, even with
  systemd running inside it; the T3 service on tom-pc-1 survives only while the
  `T3AgentWSL` keep-alive task holds a session open.

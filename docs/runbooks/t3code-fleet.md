# T3 Code fleet: fork publish, host pull, links

Every live worker host runs the same fork build of T3 Code as a systemd user
service, installed through T3's own updater from a tailnet-only mirror that
DankStation publishes after each fork sync. Packet:
`goals/t3code-fleet-rollout`. Versioned scripts: that packet's `ops/`.

## How it fits together

| Piece | Where | What it does |
| --- | --- | --- |
| `update-t3code-source` | DankStation `~/.local/bin` (out of repo) | Daily timer: merge upstream into the fork, stamp one fork version, build the hub AppImage, publish the CLI archive, push the fork, install the hub build. `T3CODE_SYNC_FORCE=1` rebuilds the current commit. |
| `t3code-fork-publish` | DankStation `~/.local/bin`; source `ops/t3code-fork-publish.sh` | Builds the resource monitor, the server single-executable and the Linux x64 CLI archive; writes `v<version>/{archive,SHA256SUMS}` and `latest.json` under `~/.local/opt/t3code/publish`; serves that directory tailnet-only with Tailscale Serve (no Funnel). |
| `t3code-fork-pull` | each host `~/.local/bin`; source `ops/t3code-fork-pull.sh` + timer units | Every 30 min: read `latest.json`; when the version differs from the service's `activeVersion`, run `t3 update <version> --yes`, which verifies `SHA256SUMS`, trials the runtime, rolls back on failure and restarts the service. |
| `~/.config/t3code-fork/pull.env` | each host, mode 600, never committed | `T3CODE_FORK_MIRROR=https://<hub>.<tailnet>.ts.net:<port>` |
| `~/.t3/service.env` | each host | The pull script pins `T3CODE_RELEASE_BASE_URL` to the mirror, so a remote "Update server" can only resolve fork versions; official releases are unreachable by construction. |

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
    && mkdir -p ~/.local/bin ~/.config/systemd/user ~/.config/t3code-fork \
    && install -m755 "$d/t3code-fork-pull.sh" ~/.local/bin/t3code-fork-pull \
    && install -m644 "$d/t3code-fork-pull.service" "$d/t3code-fork-pull.timer" ~/.config/systemd/user/ \
    && rm -rf "$d"'
# write pull.env by hand on the host (mode 600) with the mirror URL, then:
<wrapper> 'systemctl --user daemon-reload && systemctl --user enable --now t3code-fork-pull.timer \
  && systemctl --user start t3code-fork-pull.service && cat ~/.t3/runtime/fork-current'
```

## Verify parity

- Hub: `cat ~/.local/opt/t3code/source-version` and `curl -s https://<hub>.<tailnet>.ts.net:<port>/latest.json`.
- Host: `cat ~/.t3/runtime/fork-current` (fork commit and version), `t3 service status`
  (`installed · t3@<version>`, no problems), `journalctl --user -u t3code-fork-pull.service -n 20`.
- All equal: the published `version` equals every host's `activeVersion`.

## Roll back a host

Previous versions stay under `~/.t3/runtime/versions/`. Set
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

## Gotchas

- The single-executable build needs the exact `engines.node` from the fork's
  root `package.json` on PATH (`mise install node@<version>`); the archive ships
  the running Node.
- `t3 update` and `t3 service install` on a host always run
  `~/.t3/runtime/versions/<version>/t3`; do not point the unit at any other path.
- Never run `t3 update` without the mirror pinned: with `T3CODE_RELEASE_BASE_URL`
  unset it resolves the public GitHub release and would replace the fork build.
- The hub AppImage is built without a GitHub publish config, so the desktop
  updater has no feed; restart T3 Code after a sync to pick up the new build.

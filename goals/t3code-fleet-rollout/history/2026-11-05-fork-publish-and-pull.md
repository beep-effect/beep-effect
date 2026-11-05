# 2026-11-05: fork publish on DankStation, pull on beep-worker and dankserver

Sanitized receipt. Tailnet names, addresses and environment ids are kept in the
private orchestrator handoff.

## What landed

- DankStation `update-t3code-source` (out of repo) now stamps one fork version
  per build (`<upstream>-fork.<yyyymmdd>.<hhmm>`) across the hub AppImage and a
  Linux x64 CLI archive, builds under the fork's exact `engines.node`
  (26.12.1 via mise), and calls `t3code-fork-publish` before pushing the fork
  and installing the hub build. Source: `ops/t3code-fork-publish.sh`.
- The mirror is a Tailscale Serve directory (tailnet only, no Funnel) in GitHub
  release layout: `latest.json`, `v<version>/t3-<version>-linux-x64.tar.gz`,
  `v<version>/SHA256SUMS`. Old versions are pruned to the newest three.
- Hosts pull with `ops/t3code-fork-pull.sh` and its 30-minute user timer,
  through `t3 update <version> --yes` (T3's staged updater verifies the
  checksum, trials the runtime, rolls back on failure) followed by
  `t3 service install` to move the launcher. `T3CODE_RELEASE_BASE_URL` is
  pinned in `~/.t3/service.env`, so no official release can replace the fork.

## Evidence

| Check | beep-worker | dankserver |
| --- | --- | --- |
| Before | official `t3@0.1.5`, `runtime/versions/{0.1.2,0.1.5}`, no `service.env` | same |
| First pull | `0.1.5 → 0.1.7-fork.20261105.2218`, download verified, service restarted | same |
| Launcher reconcile | `Service updated · t3@0.1.7-fork.20261105.2218`; unit `ExecStart` on the new version dir | same, done by the pull script |
| `t3 service status` | `installed · t3@0.1.7-fork.20261105.2218`, no problems | same |
| `runtime/fork-current` | fork commit `25b53299b7` + version | same |
| Timer | enabled, next run +30 min | same |
| Idempotent rerun | `current: t3@0.1.7-fork.20261105.2218` | not rerun |
| Reachable from the hub | `:3773` 200 and Tailscale HTTPS 200 | loopback only (worker-boundary drop-in); HTTPS :443 belongs to another service |

Hub: `~/.local/opt/t3code/source-version` = `0.1.7-fork.20261105.2218`,
`publish/latest.json` same version, fork commit `25b53299b7` (fast-forwarded to
upstream that run). The running desktop stays on `0.1.7` until T3 Code is
restarted.

## Build fixes found on the way

1. The server's `build-exe` spawns `vp` by name: the publish script prepends the
   build tree's `node_modules/.bin`.
2. The archive builder attributes `libatomic.so.1` with `dpkg-query`; on the
   pacman hub a two-query shim answers from pacman (license text still ships;
   the header wording names Ubuntu).
3. Prerelease ids must be semver numbers, so the time component drops leading
   zeros.

## Open

- dankserver tailnet exposure of `:3773` (Serve decision; its `:443` is taken).
- Links on the agent plane (Labs, both ends), tom-pc-1 WSL distro, tbk-worker
  (gated), `t3 service protect` on both hosts (needs sudo, not yet run).

## Link receipt (same day, after the hub restart)

- Hub restarted on `0.1.7-fork.20261105.2218`; `linkedEnvironmentsEnabled`,
  `loadBalancingEnabled` and project grouping "by repository" survived the
  restart. beep-worker's server had the Labs flag set and was restarted.
- Pairing: `t3 pair --ttl 15m` on beep-worker (orchestration, settings,
  source-control and access scopes); on the hub
  `t3 environment link https://<beep-worker>.<tailnet>.ts.net --pairing-code <code> --access auto`.
  Result: `Linked beep-worker (<id>) with auto access, until 2026-12-05`.
  `t3_environment_links` lists it `reachable`, access `auto`.
- Through the link: `t3_environment_read` reports `0.1.7-fork.20261105.2218`;
  `orchestrator_capabilities` lists Codex, Claude, Cursor, Grok and Muse;
  `t3_project_list` shows `beep-effect` with repository key
  `github.com/beep-effect/beep-effect` (the same key as the hub's project, so
  Auto balance can group them).
- One delegated turn (`delegate_task`, `claude-opus-5-5` medium, read-only)
  completed and returned verbatim: hostname `beep-worker`,
  `t3 v0.1.7-fork.20261105.2218`, `fork-current` = `25b53299b7` + version,
  checkout HEAD `b43a4098bb`, 4 CPUs.
- The environment id lives in the private orchestrator handoff, not here.

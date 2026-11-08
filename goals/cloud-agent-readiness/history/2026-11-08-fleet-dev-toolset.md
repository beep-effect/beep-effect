# Fleet developer toolset — 2026-11-08

Operator ask: the full development toolset on every fleet box, limited to
developer and CLI tools with no new credentials. Hosts: dankserver, beep-worker,
tbk-worker, tom-pc-1-wsl and grok-bot. The agent CLIs and their logins were
handled earlier the same day and were not touched here.

- Survey matrix (before and after, per host and tool):
  [`research/2026-11-08-fleet-toolset-survey.json`](../research/2026-11-08-fleet-toolset-survey.json)
- Installer: [`ops/fleet-dev-toolset.sh`](../ops/fleet-dev-toolset.sh), one
  idempotent script with a `system` phase (root, distro packages) and a `user`
  phase (the host's agent account), plus per-host environment knobs. Re-running
  it on a finished host changes nothing.

## Result

Each host was surveyed as its agent account, from inside its beep-effect
checkout, across 40 tools: the 37 in scope plus `portless`, `typos` and
`gitleaks` from the repo toolchain.

| Host | Agent user | Missing before | Missing after |
| --- | --- | --- | --- |
| dankserver | `worker` | 11, plus broken mise shims (below) | 0 |
| beep-worker | `elpresidank` | 1 (`qrencode`) | 0 |
| tbk-worker | `worker` | 15 | 0 |
| tom-pc-1-wsl | `agent` | 28 | 0 |
| grok-bot | `box` | 24 | 1 (`docker`, deferred) |

`scripts/cloud/bootstrap.sh` (with `BEEP_CLOUD_FORCE=1 BEEP_CLOUD_SKIP_OP=1`) ended
`ready` with `publication tools: ready` on all five hosts: bun 1.4.4, Node
24.22.1, typos 1.50.3 and gitleaks 8.30.1, at `origin/main` `9140b1f5c4`.

## What was installed

- **Distro packages** (missing ones only, per host): build-essential, cmake,
  ninja-build, pkg-config, ripgrep, fd-find, fzf, bat, eza, just, direnv,
  sqlite3, rsync, qrencode, pipx, ffmpeg, imagemagick, poppler-utils, pandoc,
  tesseract-ocr, golang-go (not on grok-bot, which keeps its `/usr/local/go`).
  `bat`/`fd` get `~/.local/bin` links to Debian's `batcat`/`fdfind`.
- **mise** (already used on four hosts; installed into `~/.local/bin` on
  grok-bot): `trusted_config_paths` covers the checkout roots, and `yq`
  (mikefarah v4), `cloudflared` and `pnpm` are global tools where missing.
- **User installers into `~/.local` / `~/.cargo`**: uv and rustup (minimal
  stable profile) on tom-pc-1-wsl and grok-bot; `portless` via `bun add -g`
  on dankserver.
- **Docker** on tom-pc-1-wsl: Docker's apt repository with rootless extras,
  the tbk-worker layout. Root daemon units are masked, nobody joined the `docker`
  group, linger is on for `agent`, and the user unit unsets `SSH_AUTH_SOCK`.
  `docker info` reports 29.9.3 with the `rootless` security option.

## Findings fixed along the way

- **dankserver's worker checkout had an untrusted `mise.toml`.** Every mise
  shim (`gh`, `cloudflared`, `typos`, `gitleaks`) failed inside the checkout,
  and `node` fell through to the distro's v22 instead of the `.nvmrc` pin.
  Trusting the checkout root and running `mise install` gave it Node 24.22.1
  and bun 1.4.4.
- **dankserver's `yq` was Ubuntu's jq-wrapper `yq` 3.4.3.** It now has
  mikefarah's v4, matching the other hosts and DankStation. The apt package
  stays installed underneath.
- **bootstrap.sh can skip its global `portless` install** when a checkout-local
  copy is on `PATH`. In a throwaway worktree that copy disappears with the
  worktree. The user phase now installs `portless` globally when it is absent.
- **grok-bot**: `apt-get install ./*.deb` still preferred the same-version
  repository copy and tried the broken Debian mirror. The offline path now runs
  `dpkg -i` over the full pushed closure. The 53 packages were fetched on
  DankStation and checked before the push: 47 against the MD5 sums in the box's
  own apt index, and the 6 security updates (for which `--print-uris` printed no
  hash) against the SHA256 in Debian's published `Packages` index.

## Choices and limits

- **Bootstrap ran from a fresh detached `origin/main` worktree**, not from each
  host's primary clone. The worktree was removed afterwards. beep-worker's
  primary clone is stale and dirty and must not be touched; grok-bot's
  `/workspace/beep-effect` is a stale clone. A worktree gave every host the
  current script and pins without moving a checkout that T3 threads may be
  using. The installed toolchain (`~/.bun`, Node, typos, gitleaks, the PATH
  line in `~/.bashrc`) persists. The stale clones still pin bun 1.4.2.
- **grok-bot has no Docker.** The VM has no systemd and no `newuidmap`, and
  its egress proxy blocks the Debian mirror. Running a daemon would mean
  extending the box's own service script, which needs a separate decision.
- **dankserver resource care**: the worker slice was at 6.3 of 7 GiB at the
  start, mostly page cache (anon 1.1 GiB). Bootstrap ran niced while I sampled
  the slice every 15 s. Anon stayed near 1.1 GiB, io-pressure `full` peaked at
  66% during `bun install`, and `t3 serve` answered 200 at every sample.
- **tbk-worker**: package installs and bootstrap ran at idle I/O priority,
  because an install was the one recorded cause of a protective stop. No stop
  happened.
- **No credentials were added on any host.** 1Password CLI installation was
  skipped (`BEEP_CLOUD_SKIP_OP=1`), and no SSH, PAM, sudo, tailnet or T3
  configuration changed. No T3 service was restarted.
- **YubiKey**: touches were announced before each prompt and serialized: SSH
  masters for beep-worker, tbk-worker and tom-pc-1-wsl, plus one admin session
  (login and sudo) each for tbk-worker, tom-pc-1-wsl, beep-worker and grok-bot.
  One beep-worker admin login touch was missed. The agent refused the signature,
  nothing ran, and the second attempt succeeded. dankserver used the existing
  `sudo -n` ticket.

## Re-run

```sh
# system phase (root): Ubuntu hosts
sudo bash goals/cloud-agent-readiness/ops/fleet-dev-toolset.sh system
# tom-pc-1-wsl adds: FLEET_DOCKER_ROOTLESS_USER=agent
# grok-bot: push the verified .deb closure first, then
#   FLEET_APT_DEB_DIR=<dir> FLEET_SKIP_GO=1
# user phase (agent account)
FLEET_BOOTSTRAP_REPO="$HOME/YeeBois/projects/beep-effect" \
  bash goals/cloud-agent-readiness/ops/fleet-dev-toolset.sh user
# tom-pc-1-wsl adds FLEET_DOCKER_ROOTLESS=1; grok-bot adds FLEET_INSTALL_MISE=1
# and uses FLEET_BOOTSTRAP_REPO=/workspace/beep-effect
```

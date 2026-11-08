#!/usr/bin/env bash
# fleet-dev-toolset.sh — idempotent developer/CLI toolset for fleet hosts.
#
# Usage (feed on stdin over SSH, or copy and run):
#   sudo bash fleet-dev-toolset.sh system   # distro packages; one sudo session per host
#   bash fleet-dev-toolset.sh user          # the agent account's user-level toolchain
#
# Scope: goals/cloud-agent-readiness/history/2026-11-08-fleet-dev-toolset.md.
# Installs tools only. It never writes a credential, token, login or vault item,
# and never changes tailnet, SSH, PAM or sudo configuration.
#
# Environment knobs (all optional):
#   FLEET_APT_DEB_DIR=<dir>        system: install the .deb files in <dir> instead of
#                                  fetching (grok-bot: its egress proxy breaks the
#                                  Debian mirror, so packages are fetched elsewhere)
#   FLEET_SKIP_GO=1                system: keep an existing non-distro Go
#   FLEET_DOCKER_ROOTLESS_USER=<u> system: Docker's apt repo + rootless extras, root
#                                  daemon masked, linger for <u> (tbk-worker layout)
#   FLEET_DOCKER_ROOTLESS=1        user: run dockerd-rootless-setuptool.sh install
#   FLEET_INSTALL_MISE=1           user: install mise into ~/.local/bin when absent
#   FLEET_BOOTSTRAP_REPO=<path>    user: run scripts/cloud/bootstrap.sh from a fresh
#                                  detached worktree of <path> at origin/main
set -euo pipefail

phase="${1:-}"
log() { printf '[fleet-dev-toolset] %s\n' "$*"; }
die() { printf '[fleet-dev-toolset] ERROR: %s\n' "$*" >&2; exit 1; }
# shellcheck disable=SC1091
. /etc/os-release

APT_PACKAGES=(
  build-essential cmake ninja-build pkg-config curl unzip xz-utils ca-certificates
  git jq ripgrep fd-find fzf bat eza just direnv sqlite3 rsync gnupg qrencode pipx
  ffmpeg imagemagick poppler-utils pandoc tesseract-ocr
)

system_phase() {
  [ "$(id -u)" = 0 ] || die "system phase needs root"
  export DEBIAN_FRONTEND=noninteractive
  # Idle I/O class: tbk-worker's guard stops the guest on sustained host I/O
  # pressure, and package installs were the one recorded cause.
  local gentle=(ionice -c3 nice -n 19)
  local pkgs=("${APT_PACKAGES[@]}")
  [ "${FLEET_SKIP_GO:-0}" = 1 ] || pkgs+=(golang-go)
  if [ -n "${FLEET_APT_DEB_DIR:-}" ]; then
    # The directory holds the full dependency closure from `apt-get install
    # --print-uris`, verified before the push. dpkg installs it as one set; apt
    # would prefer a same-version repository copy and try the broken mirror.
    log "installing pushed packages from ${FLEET_APT_DEB_DIR}"
    "${gentle[@]}" dpkg -i "${FLEET_APT_DEB_DIR}"/*.deb
  else
    local missing=() p
    for p in "${pkgs[@]}"; do
      dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q 'install ok installed' || missing+=("$p")
    done
    if [ "${#missing[@]}" -gt 0 ]; then
      log "apt install: ${missing[*]}"
      apt-get update -qq
      "${gentle[@]}" apt-get install -y --no-install-recommends "${missing[@]}"
    else
      log "distro packages already present"
    fi
  fi

  if [ -n "${FLEET_DOCKER_ROOTLESS_USER:-}" ]; then
    local u="${FLEET_DOCKER_ROOTLESS_USER}"
    if ! dpkg-query -W -f='${Status}' docker-ce-rootless-extras 2>/dev/null | grep -q 'install ok installed'; then
      log "Docker apt repository + rootless extras for ${u}"
      install -d -m 0755 /etc/apt/keyrings
      curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
      chmod a+r /etc/apt/keyrings/docker.asc
      printf 'Types: deb\nURIs: https://download.docker.com/linux/%s\nSuites: %s\nComponents: stable\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
        "${ID}" "${VERSION_CODENAME}" > /etc/apt/sources.list.d/docker.sources
      apt-get update -qq
      "${gentle[@]}" apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin \
        docker-compose-plugin docker-ce-rootless-extras uidmap slirp4netns dbus-user-session
    fi
    # Rootless only: the root daemon stays off and nobody joins the docker group.
    systemctl disable --now docker.service docker.socket containerd.service >/dev/null 2>&1 || true
    systemctl mask docker.service docker.socket containerd.service >/dev/null
    grep -q "^${u}:" /etc/subuid || usermod --add-subuids 100000-165535 "${u}"
    grep -q "^${u}:" /etc/subgid || usermod --add-subgids 100000-165535 "${u}"
    loginctl enable-linger "${u}"
  fi
  log "system phase done"
}

user_phase() {
  [ "$(id -u)" != 0 ] || die "user phase runs as the agent account, not root"
  local bin="${HOME}/.local/bin"
  install -d -m 0755 "${bin}"
  export PATH="${bin}:${HOME}/.local/share/mise/shims:${HOME}/.cargo/bin:${HOME}/.bun/bin:${PATH}"

  # Debian/Ubuntu ship bat as batcat and fd as fdfind.
  command -v bat >/dev/null || { command -v batcat >/dev/null && ln -sfn "$(command -v batcat)" "${bin}/bat"; }
  command -v fd >/dev/null || { command -v fdfind >/dev/null && ln -sfn "$(command -v fdfind)" "${bin}/fd"; }

  if ! command -v mise >/dev/null && [ "${FLEET_INSTALL_MISE:-0}" = 1 ]; then
    log "installing mise into ${bin}"
    curl -fsSL https://mise.run | MISE_INSTALL_PATH="${bin}/mise" sh
    grep -qF 'mise/shims' "${HOME}/.bashrc" 2>/dev/null ||
      printf '\n# fleet-dev-toolset: mise shims\nexport PATH="$HOME/.local/share/mise/shims:$PATH"\n' >> "${HOME}/.bashrc"
  fi
  if command -v mise >/dev/null; then
    # Trust the beep-effect checkouts so mise.toml's bun/node pins resolve there.
    local root
    for root in "${HOME}/YeeBois/projects" /workspace; do
      [ -d "${root}" ] || continue
      grep -qF "\"${root}\"" "${HOME}/.config/mise/config.toml" 2>/dev/null && continue
      mise settings add trusted_config_paths "${root}" >/dev/null 2>&1 || true
    done
    local tool
    # yq means mikefarah's Go yq (v4) fleet-wide; Ubuntu's apt yq is a jq wrapper.
    for tool in yq cloudflared pnpm; do
      if [ "${tool}" = yq ]; then
        yq --version 2>/dev/null | grep -q mikefarah && continue
      else
        command -v "${tool}" >/dev/null && "${tool}" --version >/dev/null 2>&1 && continue
      fi
      log "mise use -g ${tool}@latest"
      mise use -g "${tool}@latest"
    done
    if [ -f "${HOME}/YeeBois/projects/beep-effect/mise.toml" ]; then
      (cd "${HOME}/YeeBois/projects/beep-effect" && mise install)
    fi
  fi

  if ! command -v uv >/dev/null; then
    log "installing uv into ${bin}"
    curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="${bin}" INSTALLER_NO_MODIFY_PATH=1 sh
  fi
  if ! command -v rustup >/dev/null; then
    log "installing rustup (stable, minimal profile)"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
  fi

  # portless must persist outside any checkout: bootstrap.sh skips its global
  # install when a checkout-local node_modules/.bin copy is on PATH.
  if ! command -v portless >/dev/null && command -v bun >/dev/null; then
    log "bun add -g portless"
    bun add -g portless >/dev/null
  fi

  if [ "${FLEET_DOCKER_ROOTLESS:-0}" = 1 ] && ! systemctl --user is-active --quiet docker; then
    log "rootless Docker for $(id -un)"
    dockerd-rootless-setuptool.sh install
    install -d "${HOME}/.config/systemd/user/docker.service.d"
    printf '[Service]\nUnsetEnvironment=SSH_AUTH_SOCK\n' > "${HOME}/.config/systemd/user/docker.service.d/10-no-agent.conf"
    systemctl --user daemon-reload
    systemctl --user restart docker
    grep -qF 'DOCKER_HOST=unix://' "${HOME}/.bashrc" 2>/dev/null ||
      printf '\n# fleet-dev-toolset: rootless Docker\nexport DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock\n' >> "${HOME}/.bashrc"
  fi

  if [ -n "${FLEET_BOOTSTRAP_REPO:-}" ]; then
    local repo="${FLEET_BOOTSTRAP_REPO}" lane
    lane="$(dirname "${repo}")/beep-effect-worktrees/fleet-toolset-bootstrap"
    git -C "${repo}" fetch --quiet origin main
    if [ -d "${lane}" ]; then
      git -C "${lane}" checkout --quiet --detach origin/main
    else
      git -C "${repo}" worktree add --quiet --detach "${lane}" origin/main
    fi
    log "bootstrap.sh in ${lane} at $(git -C "${lane}" rev-parse --short HEAD)"
    # 1Password CLI is out of scope (no credentials); the host keeps its own op shim.
    (cd "${lane}" && BEEP_CLOUD_FORCE=1 BEEP_CLOUD_SKIP_OP=1 bash scripts/cloud/bootstrap.sh)
    git -C "${repo}" worktree remove --force "${lane}"
    git -C "${repo}" worktree prune
  fi
  log "user phase done"
}

case "${phase}" in
  system) system_phase ;;
  user) user_phase ;;
  *) die "usage: $0 system|user" ;;
esac

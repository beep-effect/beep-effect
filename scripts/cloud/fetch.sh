#!/usr/bin/env bash
# Synchronous download worker, owned by bootstrap.sh through GNU timeout.
# Keep descendants in this process group and prevent optional GPG daemons.
set -euo pipefail
# Bash defers this trap until its foreground child exits. If a child ignores
# TERM, timeout remains alive to send KILL to the whole group after its grace.
trap 'exit 143' TERM

kind="$1"
run_dir="$2"
BUN_VERSION="$3"
NODE_VERSION="$3"
OP_PINNED_VERSION="$3"
download_limits=(--connect-timeout 15 --max-time 120 --retry-max-time 120)

fetch_bun() {
  local sha work archive
  IFS= read -r sha < .bun-linux-x64.sha256 || [ -n "${sha}" ]
  sha="${sha//[[:space:]]/}"
  work="${run_dir}/bun"
  mkdir -p "${work}"
  archive="${work}/bun-linux-x64.zip"
  curl "${download_limits[@]}" --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --output "${archive}" \
    "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip"
  printf '%s  %s\n' "${sha}" "${archive}" | sha256sum --check --strict - >/dev/null
  unzip -oq "${archive}" -d "${work}"
}

fetch_node() {
  # nvm first when the image ships it (Cursor); otherwise the official tarball
  # from nodejs.org, which the Claude Trusted allowlist admits.
  if [ -s "${NVM_DIR:-${HOME}/.nvm}/nvm.sh" ]; then
    printf 'nvm' > "${run_dir}/node.mode"
    return 0
  fi
  local version work
  work="${run_dir}/node"
  mkdir -p "${work}"
  curl "${download_limits[@]}" --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --output "${work}/index.tab" "https://nodejs.org/dist/index.tab" || return 1
  awk -v requested="v${NODE_VERSION}" '$1 == requested { print $1; exit }' "${work}/index.tab" > "${work}/version"
  IFS= read -r version < "${work}/version" || return 1
  [ -n "${version}" ] || return 1
  curl "${download_limits[@]}" --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --output "${work}/node.tar.xz" \
    "https://nodejs.org/dist/${version}/node-${version}-linux-x64.tar.xz"
  curl "${download_limits[@]}" --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --output "${work}/SHASUMS256.txt" \
    "https://nodejs.org/dist/${version}/SHASUMS256.txt"
  pushd "${work}" >/dev/null
  grep " node-${version}-linux-x64.tar.xz\$" SHASUMS256.txt | sed 's# .*# node.tar.xz#' | sha256sum --check --strict - >/dev/null
  popd >/dev/null
  printf 'tarball' > "${run_dir}/node.mode"
}

# 1Password CLI: always download + GPG-verify the pinned release; never trust an
# `op` already on PATH (a reused snapshot could carry an unverified binary that
# would then handle OP_SERVICE_ACCOUNT_TOKEN). Best-effort: op-backed runs are
# optional, the toolchain is not.
OP_GPG_FINGERPRINT="3FEF9748469ADBE15DA7CA80AC2D62742012EA22"
OP_GPG_KEY_URL="https://downloads.1password.com/linux/keys/1password.asc"
fetch_op() {
  local work ver
  work="${run_dir}/op"
  mkdir -p "${work}"
  ver="v${OP_PINNED_VERSION}"
  curl "${download_limits[@]}" -fsSLo "${work}/op.zip" "https://cache.agilebits.com/dist/1P/op2/pkg/${ver}/op_linux_amd64_${ver}.zip" || return 1
  unzip -oq "${work}/op.zip" op op.sig -d "${work}" || return 1
  [ -f "${work}/op" ] && [ -f "${work}/op.sig" ] || return 1
  export GNUPGHOME="${work}/gnupg"
  mkdir -p "${GNUPGHOME}" && chmod 700 "${GNUPGHOME}"
  curl "${download_limits[@]}" -fsSL "${OP_GPG_KEY_URL}" | gpg --no-autostart --batch --import >/dev/null 2>&1 || return 1
  gpg --no-autostart --batch --with-colons --fingerprint 2>/dev/null | grep -q "^fpr:::::::::${OP_GPG_FINGERPRINT}:" || return 1
  gpg --no-autostart --batch --status-fd=1 --verify "${work}/op.sig" "${work}/op" 2>/dev/null \
    | grep -q "^\[GNUPG:\] VALIDSIG ${OP_GPG_FINGERPRINT} " || return 1
  unset GNUPGHOME
  : > "${run_dir}/op.verified"
}

case "${kind}" in
  bun) fetch_bun ;;
  node) fetch_node ;;
  op) fetch_op ;;
  *) printf 'Unknown bootstrap download: %s\n' "${kind}" >&2; exit 2 ;;
esac

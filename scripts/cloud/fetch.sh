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
TOOL_VERSION="$3"
download_limits=(--connect-timeout 15 --max-time 120 --retry-max-time 120)

# Required-host download. Only a network-policy denial exits 78: the egress
# proxy refusing the CONNECT tunnel (%{http_connect} 403) or, with no proxy
# configured, the target not resolving or connecting (curl 6/7). Proxy faults
# (curl 5, or 6/7 through a proxy), an origin 403, timeouts, 404 and 5xx keep
# their plain non-zero exit. The recorded host is the one curl reports it was
# fetching when it stopped (%{url_effective}, so a denied redirect hop is named
# rather than the caller's host), falling back to the caller's literal; it is
# never parsed from curl's error text.
fetch_required() {
  local host="$1" output="$2" url="$3" report http_connect effective proxy rc=0
  report="$(curl "${download_limits[@]}" --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    --write-out '%{http_code} %{http_connect} %{url_effective}' --output "${output}" "${url}")" || rc=$?
  [ "${rc}" -eq 0 ] && return 0
  read -r _ http_connect effective <<< "${report}"
  proxy="${HTTPS_PROXY:-${https_proxy:-${ALL_PROXY:-${all_proxy:-}}}}"
  if [ "${http_connect:-}" = 403 ] || { [ -z "${proxy}" ] && { [ "${rc}" -eq 6 ] || [ "${rc}" -eq 7 ]; }; }; then
    effective="${effective#*://}"; effective="${effective%%/*}"; effective="${effective##*@}"; effective="${effective%%:*}"
    printf '%s\n' "${effective:-${host}}" > "${run_dir}/${kind}.denied"
    exit 78
  fi
  return "${rc}"
}

fetch_bun() {
  local sha work archive
  IFS= read -r sha < .bun-linux-x64.sha256 || [ -n "${sha}" ]
  sha="${sha//[[:space:]]/}"
  work="${run_dir}/bun"
  mkdir -p "${work}"
  archive="${work}/bun-linux-x64.zip"
  fetch_required github.com "${archive}" \
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
  fetch_required nodejs.org "${work}/index.tab" "https://nodejs.org/dist/index.tab" || return 1
  awk -v requested="v${NODE_VERSION}" '$1 == requested { print $1; exit }' "${work}/index.tab" > "${work}/version"
  IFS= read -r version < "${work}/version" || return 1
  [ -n "${version}" ] || return 1
  fetch_required nodejs.org "${work}/node.tar.xz" \
    "https://nodejs.org/dist/${version}/node-${version}-linux-x64.tar.xz"
  fetch_required nodejs.org "${work}/SHASUMS256.txt" \
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

# Publication hook tools (lefthook pre-commit runs `typos` and `gitleaks`).
# Each pin is a version plus the sha256 of its x86_64 Linux release archive;
# a version without a recorded digest is refused, never fetched unverified.
# Sources (read 2026-11-02, digests re-hashed from the downloaded archives):
#   typos 1.50.3: taiki-e/install-action@1e29709c (the pin CI installs typos
#     through) manifests/typos.json, key 1.50.3 / x86_64_linux_musl.
#   gitleaks 8.30.1: the release's own gitleaks_8.30.1_checksums.txt, the
#     version CI pins in check.yml.
fetch_release_binary() {
  local name="$1" url="$2" sha="$3" member="$4" work archive
  work="${run_dir}/${name}"
  mkdir -p "${work}"
  archive="${work}/${name}.tar.gz"
  fetch_required github.com "${archive}" "${url}"
  printf '%s  %s\n' "${sha}" "${archive}" | sha256sum --check --strict - >/dev/null
  # Root would otherwise apply the archive's recorded owner and mode bits; the
  # binary's final 0755 mode is set by bootstrap.sh when it is installed.
  tar -xzf "${archive}" --no-same-owner --no-same-permissions -C "${work}" "${member}"
  [ -f "${work}/${name}" ]
}

fetch_typos() {
  local sha
  case "${TOOL_VERSION}" in
    1.50.3) sha="aca6b5d546307092b8d0a8e0a89dd80f9da51f2f7617c5e45c5607c1684ffbf2" ;;
    *) printf 'No verified checksum recorded for typos %s\n' "${TOOL_VERSION}" >&2; return 1 ;;
  esac
  fetch_release_binary typos \
    "https://github.com/crate-ci/typos/releases/download/v${TOOL_VERSION}/typos-v${TOOL_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    "${sha}" ./typos
}

fetch_gitleaks() {
  local sha
  case "${TOOL_VERSION}" in
    8.30.1) sha="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb" ;;
    *) printf 'No verified checksum recorded for gitleaks %s\n' "${TOOL_VERSION}" >&2; return 1 ;;
  esac
  fetch_release_binary gitleaks \
    "https://github.com/gitleaks/gitleaks/releases/download/v${TOOL_VERSION}/gitleaks_${TOOL_VERSION}_linux_x64.tar.gz" \
    "${sha}" gitleaks
}

case "${kind}" in
  bun) fetch_bun ;;
  node) fetch_node ;;
  op) fetch_op ;;
  typos) fetch_typos ;;
  gitleaks) fetch_gitleaks ;;
  *) printf 'Unknown bootstrap download: %s\n' "${kind}" >&2; exit 2 ;;
esac

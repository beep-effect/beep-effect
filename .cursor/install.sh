#!/usr/bin/env bash
# Cloud Agent install: idempotent dependency bootstrap for beep-effect.
#
# Runs after the repository is checked out. Safe to run repeatedly and against
# cached state (an environment build reuses the resulting snapshot). Keep this
# lean: durable dependency + toolchain preparation only, no dev servers.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

BUN_VERSION="$(tr -d '[:space:]' < .bun-version)"
export BUN_INSTALL="${HOME}/.bun"
export PATH="${BUN_INSTALL}/bin:${PATH}"

# 1. Install the pinned Bun toolchain when it is missing or the wrong version.
if ! command -v bun >/dev/null 2>&1 || [ "$(bun --version 2>/dev/null)" != "${BUN_VERSION}" ]; then
  curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
fi

# Expose bun to every shell (login, non-login, and the agent) regardless of
# whether shell profiles are sourced.
if command -v sudo >/dev/null 2>&1; then
  sudo ln -sf "${BUN_INSTALL}/bin/bun" /usr/local/bin/bun
  sudo ln -sf "${BUN_INSTALL}/bin/bunx" /usr/local/bin/bunx
fi

# 2. Provision the Node.js runtime pinned by .nvmrc (Next.js and portless
#    require Node 24+). nvm is sourced explicitly because this script runs in a
#    non-login shell. Guarded so a missing nvm does not abort the install.
NODE_VERSION="$(tr -d '[:space:]' < .nvmrc 2>/dev/null || echo 24)"
export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  set +e
  # shellcheck disable=SC1091
  . "${NVM_DIR}/nvm.sh"
  nvm install "${NODE_VERSION}"
  nvm alias default "${NODE_VERSION}"
  nvm use "${NODE_VERSION}"
  set -e
else
  echo "WARN: nvm not found at ${NVM_DIR}; skipping Node ${NODE_VERSION} provisioning."
fi

# 3. Install the portless dev-server proxy globally. Dev servers in this repo
#    are launched only through portless-wrapped package scripts; it is not a
#    workspace dependency, so it must be present on PATH.
if ! command -v portless >/dev/null 2>&1; then
  bun add -g portless
fi
if command -v sudo >/dev/null 2>&1 && [ -x "${BUN_INSTALL}/bin/portless" ]; then
  sudo ln -sf "${BUN_INSTALL}/bin/portless" /usr/local/bin/portless
fi

# 4. Install the 1Password CLI (op) for secret-backed runs. Secrets are provided
#    to the VM via the OP_SERVICE_ACCOUNT_TOKEN environment secret; the repo
#    resolves op:// references in a gitignored .env with `op run --env-file=.env`.
#    Best-effort and non-fatal: the core toolchain does not depend on it.
if ! command -v op >/dev/null 2>&1; then
  set +e
  OP_LATEST="$(curl -fsSL https://app-updates.agilebits.com/check/1/0/CLI2/en/2.0.0/N 2>/dev/null | grep -oE '"version":"[0-9.]+"' | head -1 | grep -oE '[0-9.]+')"
  OP_VER="v${OP_LATEST:-2.39.0}"
  if curl -fsSLo /tmp/op.zip "https://cache.agilebits.com/dist/1P/op2/pkg/${OP_VER}/op_linux_amd64_${OP_VER}.zip" \
    && unzip -o /tmp/op.zip op -d /tmp/opbin >/dev/null; then
    if command -v sudo >/dev/null 2>&1; then
      sudo mv /tmp/opbin/op /usr/local/bin/op && sudo chmod +x /usr/local/bin/op
    else
      mv /tmp/opbin/op "${BUN_INSTALL}/bin/op" && chmod +x "${BUN_INSTALL}/bin/op"
    fi
  else
    echo "WARN: 1Password CLI download failed; skipping (op-backed secret runs unavailable)."
  fi
  rm -f /tmp/op.zip
  set -e
fi

# 5. Install workspace dependencies.
#
# --ignore-scripts skips the repo root lifecycle scripts only. Bun does not run
# dependency lifecycle scripts without a trustedDependencies allowlist (none is
# declared here), so nothing dependency-side is lost. The root `postinstall`
# (`lefthook install` + GHA-runner prep) is intentionally skipped: `lefthook
# install` fails whenever git core.hooksPath is overridden (as Cursor Cloud
# does), and neither step is needed to build or run the apps.
bun install --ignore-scripts

# 6. Apply the Effect tsgo TypeScript patch that the root `prepare` script would
#    normally run (skipped above alongside the other lifecycle scripts).
bun run prepare

echo "beep-effect install complete: bun ${BUN_VERSION}, dependencies linked, tsgo patched."

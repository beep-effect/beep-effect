#!/usr/bin/env bash
# Cursor Cloud Agent install hook. The bootstrap itself is vendor-neutral and
# lives in scripts/cloud/bootstrap.sh so Claude cloud sessions, Codex cloud, and
# Cursor Cloud Agents share one source of truth. Keep this file a thin caller.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BEEP_CLOUD_VENDOR=cursor exec bash "${REPO_ROOT}/scripts/cloud/bootstrap.sh"

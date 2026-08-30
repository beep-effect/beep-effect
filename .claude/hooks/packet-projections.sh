#!/usr/bin/env bash
set -u

repo_root="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}}"
cd "$repo_root" || exit 0

# These files are ignored navigation aids. Failure stays non-blocking at
# session bootstrap; the canonical cheap gate reports projection failures.
bun run beep goals index --write >/dev/null 2>&1 || true
bun run beep explore atlas --write >/dev/null 2>&1 || true
exit 0

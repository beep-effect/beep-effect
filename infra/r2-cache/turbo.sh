#!/usr/bin/env bash
# Explicit direct-Turbo entry point, including historical worktrees.
set -euo pipefail
set +x
config="${XDG_CONFIG_HOME:-$HOME/.config}/beep/r2-cache/client.env"
[[ -f "$config" ]] || { echo 'Install the host R2 cache before using beep-turbo.' >&2; exit 78; }
exec python3 -I - "$config" "$@" <<'PY'
import os,sys
# Never resolve unrelated application references when launching a cache client.
environment={key:value for key,value in os.environ.items() if not value.startswith('op://')}
arguments=sys.argv[2:]
if not any(argument=='--cache-dir' or argument.startswith('--cache-dir=') for argument in arguments):
    arguments.append('--cache-dir='+os.path.join(os.environ['HOME'],'.cache/beep/turbo'))
if not any(argument=='--summarize' or argument.startswith('--summarize=') for argument in arguments):
    arguments.append('--summarize')
os.execvpe('op',['op','run','--env-file='+sys.argv[1],'--','bunx','turbo','run',*arguments],environment)
PY

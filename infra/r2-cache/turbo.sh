#!/usr/bin/env bash
# Explicit direct-Turbo entry point, including historical worktrees.
set -euo pipefail
set +x
config="${XDG_CONFIG_HOME:-$HOME/.config}/beep/r2-cache/client.env"
[[ -f "$config" ]] || { echo 'Install the host R2 cache before using beep-turbo.' >&2; exit 78; }
exec python3 -I - "$config" "$@" <<'PY'
import os,re,subprocess,sys
from pathlib import Path
root=Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],stderr=subprocess.DEVNULL,text=True).strip()).resolve()
if Path.cwd().resolve()!=root:raise SystemExit('Run beep-turbo from the checkout root.')
origin=subprocess.check_output(['git','remote','get-url','origin'],stderr=subprocess.DEVNULL,text=True).strip()
if not re.fullmatch(r'(?:https://github\.com/|git@github\.com:)beep-effect/beep-effect(?:\.git)?',origin):
    raise SystemExit('beep-turbo is enrolled only for the canonical public Beep repository.')
# Never resolve unrelated application references when launching a cache client.
environment={key:value for key,value in os.environ.items() if not value.startswith('op://')}
arguments=sys.argv[2:]
boundary=arguments.index('--') if '--' in arguments else len(arguments)
turbo_arguments=arguments[:boundary]
if not any(argument=='--cache-dir' or argument.startswith('--cache-dir=') for argument in turbo_arguments):
    turbo_arguments.append('--cache-dir='+os.environ.get('TURBO_CACHE_DIR',os.path.join(os.environ['HOME'],'.cache/beep/turbo')))
if not any(argument=='--summarize' or argument.startswith('--summarize=') for argument in turbo_arguments):
    turbo_arguments.append('--summarize')
arguments=turbo_arguments+arguments[boundary:]
cli=root/'packages/tooling/tool/cli/src/bin.ts'
runtime=cli.parent/'commands/Cache/Cache.runtime.ts'
if runtime.is_file():
    command=['bun','--no-env-file',str(cli),'cache','execute','--','run',*arguments]
else:
    native=root/'node_modules/.bin/turbo'
    if not native.is_file():raise SystemExit('Install this checkout\'s dependencies before running beep-turbo.')
    command=[str(native),'run',*arguments]
environment['TURBO_UI']='false'
os.execvpe('op',['op','run','--env-file='+sys.argv[1],'--',*command],environment)
PY

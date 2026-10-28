#!/usr/bin/env bash
# Reference-only enrollment and an unprivileged, loopback-only user service.
set -euo pipefail
set +x
umask 077
config="${XDG_CONFIG_HOME:-$HOME/.config}/beep/r2-cache/workstation.env"
installed="${XDG_DATA_HOME:-$HOME/.local/share}/beep/r2-cache/adapter.sh"
unit="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/beep-turbo-r2.service"
state="${XDG_STATE_HOME:-$HOME/.local/state}/beep/r2-cache"
source_dir="$(cd "$(dirname "$0")" && pwd)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"
case "${1:-}" in
  install)
    [[ -f "$config" ]] || { echo 'Reference-only workstation.env is missing; run the credential handoff.' >&2; exit 1; }
    python3 - "$config" <<'PYCONFIG'
from pathlib import Path
import os,sys
path=Path(sys.argv[1]);values=dict(line.split('=',1) for line in path.read_text().splitlines() if line and not line.startswith('#') and '=' in line)
for key in ['R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','TURBO_TOKEN']:
    if not values.get(key,'').startswith('op://'):raise SystemExit('Expected a secret reference for '+key)
client={'TURBO_API':'http://127.0.0.1:'+values.get('R2_ADAPTER_PORT','9427'),'TURBO_TOKEN':values['TURBO_TOKEN'],'TURBO_TEAM':values['TURBO_TEAM'],'TURBO_CACHE':'local:rw,remote:rw','BEEP_TURBO_TRUSTED_WRITER':'true'}
target=path.with_name('client.env')
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as out:out.write(''.join(key+'='+value+'\n' for key,value in client.items()))
PYCONFIG
    # Validate references without displaying resolved values.
    if ! op run --env-file="$config" -- true >/dev/null; then op-doctor; exit 1; fi
    mkdir -p "$(dirname "$installed")" "$(dirname "$unit")" "$state"
    [[ ! -f "$unit" ]] || cp "$unit" "$state/service-before-install-$(date -u +%Y%m%dT%H%M%S%N).unit"
    if [[ "$source_dir" != "$(dirname "$installed")" ]]; then
    cp "$source_dir/adapter.sh" "$installed"
    chmod 700 "$installed"
    cp "$source_dir/workstation.sh" "$(dirname "$installed")/workstation.sh"
    cp "$source_dir/fleet.py" "$(dirname "$installed")/fleet.py"
    cp "$source_dir/turbo.sh" "$(dirname "$installed")/turbo.sh"
    chmod 700 "$(dirname "$installed")/"{workstation.sh,fleet.py,turbo.sh}
    fi
    bin_home="${BEEP_R2_BIN_HOME:-$HOME/.local/bin}"
    mkdir -p "$bin_home"
    ln -sfn "$(dirname "$installed")/turbo.sh" "$bin_home/beep-turbo"
    "$installed" install
    exec_start="$(python3 - "$(command -v op)" "$config" "$installed" <<'PYUNIT'
import json,sys
args=[sys.argv[1],'run','--env-file='+sys.argv[2],'--',sys.argv[3],'serve']
quoted=[]
for index,arg in enumerate(args):
    arg=arg.replace('%','%%')
    # systemd expands environment variables in arguments, never the executable path.
    if index:arg=arg.replace('$','$$')
    quoted.append(json.dumps(arg,ensure_ascii=False))
print('ExecStart='+' '.join(quoted))
PYUNIT
)"
    cat > "$unit" <<EOF
# Managed by beep infra/r2-cache/workstation.sh
[Unit]
Description=Beep Turbo R2 loopback cache adapter
After=network-online.target
StartLimitIntervalSec=3600
StartLimitBurst=3

[Service]
Type=exec
$exec_start
Restart=on-failure
RestartSec=30
TimeoutStopSec=10
NoNewPrivileges=true
PrivateTmp=true
UMask=0077
MemoryHigh=256M
MemoryMax=512M

[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload
    systemctl --user enable beep-turbo-r2.service
    systemctl --user restart beep-turbo-r2.service
    echo 'R2 user service installed. Enable individual checkouts only after qualification.'
    ;;
  enable)
    checkout="${2:?Pass the checkout to enroll}"
    checkout="$(git -C "$checkout" rev-parse --show-toplevel)"
    mode="${3:-local:rw,remote:rw}"
    case "$mode" in local:rw,remote:r|local:rw,remote:rw) ;; *) echo 'Unsupported cache mode' >&2; exit 2 ;; esac
    [[ -f "$config" ]] || exit 1
    python3 - "$checkout" "$config" "$state" "$mode" <<'PYENROLL'
from pathlib import Path
import datetime,json,os,re,shlex,sys
checkout,config,state=map(Path,sys.argv[1:4]);mode=sys.argv[4];values={}
for line in config.read_text().splitlines():
    if line and not line.startswith('#') and '=' in line:
        key,value=line.split('=',1);values[key]=value
ref=values.get('TURBO_TOKEN','')
if not ref.startswith('op://'):raise SystemExit('TURBO_TOKEN must remain a secret reference')
target=checkout.resolve()/'.env'
if target.is_symlink():raise SystemExit('Refusing a symlinked checkout .env')
text=target.read_text() if target.exists() else ''
def assignment(line):
    match=re.match(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$',line)
    return match.groups() if match else ('', '')
updates={'TURBO_API':'http://127.0.0.1:'+values.get('R2_ADAPTER_PORT','9427'),'TURBO_TOKEN':ref,'TURBO_TEAM':values['TURBO_TEAM'],'TURBO_CACHE':mode,'BEEP_TURBO_TRUSTED_WRITER':'true' if mode.endswith(':rw') else 'false','BEEP_TURBO_HOST_CACHE_MANAGED':'true'}
before={};before_lines={}
for key in updates:
    found=[line for line in text.splitlines() if assignment(line)[0]==key]
    if len(found)>1:raise SystemExit('Duplicate cache assignment; reconcile before enrollment: '+key)
    before[key]=assignment(found[0])[1] if found else None
    before_lines[key]=found[0] if found else None
old_token=before['TURBO_TOKEN']
if old_token and (len(shlex.split(old_token,comments=True))!=1 or not shlex.split(old_token,comments=True)[0].startswith('op://')):
    raise SystemExit('Existing cache token is a raw value; migrate it to a reference before enrollment')
if before==updates:
    print('Checkout already enrolled; recovery receipt unchanged.');raise SystemExit(0)
state.mkdir(parents=True,exist_ok=True);stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
# Preserve the original rollback baseline when updating our own active enrollment.
# A manual cache edit breaks the chain; unrelated dotenv edits never enter it.
previous=next((json.loads(p.read_text()) for p in sorted(state.glob('enrollment-*.json'),reverse=True)
               if json.loads(p.read_text())['target']==str(target)),None)
if previous and all(before.get(key)==value for key,value in previous['after'].items()) and all(
    value is None for key,value in before.items() if key not in previous['after']):
    before.update(previous['before']);before_lines.update(previous.get('beforeLines',{}))
receipt=state/('enrollment-'+stamp+'.json')
fd=os.open(receipt,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as out:json.dump({'target':str(target),'before':before,'beforeLines':before_lines,'after':updates},out)
lines=[];remaining=dict(updates)
for line in text.splitlines():
    key,_=assignment(line)
    if key in remaining:lines.append(line[:line.index('=')+1]+remaining.pop(key))
    else:lines.append(line)
lines.extend(key+'='+value for key,value in remaining.items())
temporary=target.with_name('.env.r2-enrollment')
fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as out:out.write('\n'.join(lines)+'\n')
os.replace(temporary,target)
print('Checkout enrolled; cache-only reference rollback receipt retained.')
PYENROLL
    ;;
  rollback)
    checkout="${2:?Pass the enrolled checkout}"
    python3 - "$checkout" "$state" <<'PYROLLBACK'
from pathlib import Path
import json,os,re,sys
checkout,state=map(Path,sys.argv[1:]);target=checkout.resolve()/'.env'
receipts=[json.loads(p.read_text()) for p in sorted(state.glob('enrollment-*.json'),reverse=True)]
record=next((r for r in receipts if r['target']==str(target)),None)
if record is None:raise SystemExit('No enrollment receipt for this checkout')
if target.is_symlink():raise SystemExit('Refusing a symlinked checkout .env')
text=target.read_text();current={}
def assignment(line):
    match=re.match(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$',line)
    return match.groups() if match else ('', '')
for line in text.splitlines():
    if assignment(line)[0]:
        key,value=assignment(line)
        if key in record['after']:
            if key in current:raise SystemExit('Duplicate cache assignment; rollback stopped')
            current[key]=value
if current!=record['after']:raise SystemExit('Cache settings changed after enrollment; rollback stopped')
lines=[]
for line in text.splitlines():
    key,_=assignment(line)
    if key in record['before']:
        value=record['before'][key]
        if value is not None:lines.append(record.get('beforeLines',{}).get(key) or key+'='+value)
    else:lines.append(line)
temporary=target.with_name('.env.r2-rollback')
fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as out:out.write('\n'.join(lines)+'\n')
os.replace(temporary,target)
print('Original cache settings restored; unrelated dotenv edits preserved.')
PYROLLBACK
    ;;
  stop)
    systemctl --user disable --now beep-turbo-r2.service
    echo 'R2 service stopped. Run workstation.sh rollback for each enrolled checkout.'
    ;;
  *) echo 'Usage: workstation.sh install|enable <checkout> [local:rw,remote:r|local:rw,remote:rw]|rollback <checkout>|stop' >&2; exit 2 ;;
esac

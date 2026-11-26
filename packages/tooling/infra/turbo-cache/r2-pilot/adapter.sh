#!/usr/bin/env bash
# Upstream adapter lifecycle only; R2 grants enforce object access.
set -euo pipefail
set +x
umask 077
version=4.0.20
checksum=52334c002a55276b29e059caaf19c83326d50ede4280a13dbe48aebde0b816fd
cache="${XDG_CACHE_HOME:-$HOME/.cache}/beep/turbo-r2/${version}"
binary="$cache/decay"
self="$(realpath "$0")"

install_binary() {
  [[ "$(uname -sm)" == 'Linux x86_64' ]] || { echo 'R2 adapter requires Linux x86_64' >&2; return 1; }
  mkdir -p "$cache"
  if [[ -f "$binary" ]] && printf '%s  %s\n' "$checksum" "$binary" | sha256sum --check --status; then return; fi
  local download
  download="$(mktemp "$cache/download.XXXXXX")"
  if ! curl --fail --silent --show-error --location --connect-timeout 10 --max-time 30 \
    "https://github.com/brunojppb/turbo-cache-server/releases/download/${version}/decay-x86_64-unknown-linux-musl" -o "$download"; then
    rm -f "$download"; return 1
  fi
  if ! printf '%s  %s\n' "$checksum" "$download" | sha256sum --check --status; then
    rm -f "$download"; echo 'R2 adapter checksum mismatch' >&2; return 1
  fi
  chmod 700 "$download"
  mv "$download" "$binary"
}

serve() {
  local mode="${1:-ordinary}"
  : "${R2_ENDPOINT:?R2_ENDPOINT is required}" "${R2_BUCKET:?R2_BUCKET is required}"
  : "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}" "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
  : "${TURBO_TOKEN:?TURBO_TOKEN is required}"
  local port="${R2_ADAPTER_PORT:-9427}"
  [[ "$port" =~ ^[0-9]{4,5}$ ]] && (( port >= 1024 && port <= 65535 )) || return 1
  [[ "$R2_ENDPOINT" =~ ^https://[a-f0-9]{32}\.r2\.cloudflarestorage\.com$ ]] || return 1
  if [[ "$mode" == signed ]]; then
    : "${R2_SIGNED_ADAPTER:?R2_SIGNED_ADAPTER is required}" "${R2_SIGNED_ADAPTER_SHA256:?R2_SIGNED_ADAPTER_SHA256 is required}"
    : "${BEEP_CACHE_NAMESPACE:?BEEP_CACHE_NAMESPACE is required}" "${BEEP_CACHE_ACCESS_ROLE:?BEEP_CACHE_ACCESS_ROLE is required}"
    case "$BEEP_CACHE_ACCESS_ROLE" in reader|writer) ;; *) echo 'Signed adapter role must be reader or writer.' >&2; return 1 ;; esac
    [[ "$R2_SIGNED_ADAPTER" == /* && "$R2_SIGNED_ADAPTER_SHA256" =~ ^[a-f0-9]{64}$ ]] || { echo 'Signed adapter requires an absolute executable and SHA256 pin.' >&2; return 1; }
    binary="$(realpath -- "$R2_SIGNED_ADAPTER" 2>/dev/null)" || { echo 'Signed adapter executable is unavailable.' >&2; return 1; }
    [[ -f "$binary" && -x "$binary" ]] || { echo 'Signed adapter executable is unavailable.' >&2; return 1; }
    printf '%s  %s\n' "$R2_SIGNED_ADAPTER_SHA256" "$binary" | sha256sum --check --status || { echo 'Signed adapter checksum mismatch.' >&2; return 1; }
    export BEEP_CACHE_POLICY=signed-v1 BEEP_CACHE_NAMESPACE BEEP_CACHE_ACCESS_ROLE
  else
    install_binary
  fi
  export HOST=127.0.0.1 PORT="$port" S3_ENDPOINT="$R2_ENDPOINT" S3_REGION=auto
  export S3_BUCKET_NAME="$R2_BUCKET" S3_ACCESS_KEY="$R2_ACCESS_KEY_ID" S3_SECRET_KEY="$R2_SECRET_ACCESS_KEY"
  export S3_USE_PATH_STYLE=true TOKIO_WORKER_THREADS=2 OTEL_SDK_DISABLED=true
  # Exec with an explicit environment; secret values never enter argv.
  exec python3 -I - "$binary" "$mode" <<'PYENV'
import os,sys
allowed=("PATH","HOME","LANG","RUNNER_TRACKING_ID","SSL_CERT_FILE","SSL_CERT_DIR","HOST","PORT","S3_ENDPOINT","S3_REGION","S3_BUCKET_NAME","S3_ACCESS_KEY","S3_SECRET_KEY","S3_USE_PATH_STYLE","TOKIO_WORKER_THREADS","OTEL_SDK_DISABLED","TURBO_TOKEN")
if sys.argv[2]=="signed":allowed+=("BEEP_CACHE_POLICY","BEEP_CACHE_NAMESPACE","BEEP_CACHE_ACCESS_ROLE")
os.execve(sys.argv[1],[sys.argv[1]],{name:os.environ[name] for name in allowed if name in os.environ})
PYENV
}

owns_listener() {
  python3 - "$1" "$R2_ADAPTER_PORT" "$binary" <<'PYLISTENER'
from pathlib import Path
import os,sys
process=Path('/proc')/sys.argv[1]
try:
    if os.readlink(process/'exe')!=sys.argv[3]:raise SystemExit(1)
    sockets={os.readlink(fd)[8:-1] for fd in (process/'fd').iterdir() if os.readlink(fd).startswith('socket:[')}
    address='0100007F:'+format(int(sys.argv[2]),'04X')
    owned=any(row[1]==address and row[3]=='0A' and row[9] in sockets for row in (line.split() for line in (process/'net/tcp').read_text().splitlines()[1:]))
    raise SystemExit(0 if owned else 1)
except OSError:
    raise SystemExit(1)
PYLISTENER
}

start_ci() {
  : "${GITHUB_ENV:?GITHUB_ENV is required}" "${RUNNER_TEMP:?RUNNER_TEMP is required}"
  if [[ -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" || -z "${R2_ENDPOINT:-}" || -z "${R2_BUCKET:-}" || -z "${TURBO_TEAM:-}" ]]; then
    echo 'R2 cache not configured; preserving the existing cache posture.'; return
  fi
  local mode="${R2_CACHE_MODE:-local:rw,remote:r}" pid ready=false attempt
  case "$mode" in local:rw,remote:r|local:rw,remote:rw) ;; *) return 1 ;; esac
  install_binary || { echo 'R2 adapter unavailable; preserving the existing cache posture.'; return; }
  export TURBO_TOKEN="$(openssl rand -hex 32)" R2_ADAPTER_PORT="${R2_ADAPTER_PORT:-9427}"
  "$self" serve >/dev/null 2>&1 &
  pid=$!
  printf '%s\n' "$pid" > "$RUNNER_TEMP/beep-r2-adapter.pid"
  for attempt in {1..50}; do
    kill -0 "$pid" 2>/dev/null || break
    if printf 'header = "Authorization: Bearer %s"\n' "$TURBO_TOKEN" | \
      curl --config - --fail --silent --max-time 1 "http://127.0.0.1:$R2_ADAPTER_PORT/management/health" >/dev/null 2>&1 && owns_listener "$pid"; then
      ready=true; break
    fi
    sleep 0.1
  done
  if [[ "$ready" != true ]]; then
    kill "$pid" 2>/dev/null || true
    rm -f "$RUNNER_TEMP/beep-r2-adapter.pid"
    echo 'R2 adapter did not become ready; preserving the existing cache posture.'; return
  fi
  # GitHub's job environment file is the platform's credential-injection boundary.
  printf '::add-mask::%s\n' "$TURBO_TOKEN"
  {
    printf 'TURBO_API=http://127.0.0.1:%s\n' "$R2_ADAPTER_PORT"
    printf 'TURBO_TOKEN=%s\nTURBO_CACHE=%s\nTURBO_TEAM=%s\n' "$TURBO_TOKEN" "$mode" "$TURBO_TEAM"
    printf 'BEEP_CI_TURBO_R2_ACTIVE=true\n'
  } >> "$GITHUB_ENV"
  echo "R2 loopback adapter ready; cache posture $mode."
}

stop_ci() {
  local file="${RUNNER_TEMP:?RUNNER_TEMP is required}/beep-r2-adapter.pid" pid
  [[ -f "$file" ]] || return 0
  IFS= read -r pid < "$file"
  if [[ "$pid" =~ ^[0-9]+$ ]] && [[ "$(readlink "/proc/$pid/exe" 2>/dev/null || true)" == "$binary" ]]; then
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$file"
}

case "${1:-}" in
  install) install_binary ;;
  serve) serve ;;
  serve-signed) serve signed ;;
  start-ci) start_ci ;;
  stop-ci) stop_ci ;;
  *) echo 'Usage: adapter.sh install|serve|serve-signed|start-ci|stop-ci' >&2; exit 2 ;;
esac

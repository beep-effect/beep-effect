#!/usr/bin/env bash
# Local container lab for turbo-cache conformance (goal turborepo-cache-conformance).
#
#   lab.sh up       start every topology on 127.0.0.1 with fresh lab-only tokens
#   lab.sh evolved  add the evolved incumbent to a running lab
#   lab.sh status   print topology endpoints and liveness (no secret values)
#   lab.sh down     stop recorded processes, remove the store container and state
#
# Every listener binds loopback. Tokens are generated per run into a 0600 env
# file under the state root; no production credential, bucket or endpoint is
# read or reachable. Pins live in goals/turborepo-cache-conformance/research/pins-2026-10-23.json.
set -euo pipefail
umask 077

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
lambda_root="$(cd "$here/.." && pwd)"
root="${BEEP_TURBO_CACHE_LAB_ROOT:-${XDG_CACHE_HOME:-$HOME/.cache}/beep/turbo-cache-lab}"
state="$root/state"
container=beep-turbo-cache-lab-store

store_image='versity/versitygw@sha256:a13b9adbda0ea9d4b1d929e4bed327e4eccc18d13c23f7e5d192d987dde5651d' # v1.0.17, Apache-2.0
bruno_version=4.0.20
bruno_sha256=52334c002a55276b29e059caaf19c83326d50ede4280a13dbe48aebde0b816fd
ducktors_version=2.14.3
ducktors_integrity='sha512-FlW1gm1kjJseDc8Dcj92WUfsnMYLG2k5IYTIL3A3jQi8E5eUY2RGYC6RHqPJSxZJK5pbyOVTSJpoe9qqH7JcSA=='
incumbent_integrity='sha512-X34C/eyL+cIDQRDBAln0zEa5QsqpCbbbxS7qtiIhgmNGKlQQPFPo6snbOyq7xhRfVKFeyVEIAypTrR7XDZV6pw=='

store_port=17070
incumbent_port=17101
bruno_policy_port=17102
bruno_port=17103
ducktors_port=17104
evolved_port=17105
evolved_reader_port=17113
evolved_writer_port=17114
reader_port=17111
writer_port=17112

die() { printf 'lab: %s\n' "$*" >&2; exit 1; }
token() { openssl rand -hex 24; }

fetch_bruno() {
  local bin="$root/bin/decay-$bruno_version"
  if [[ -f "$bin" ]] && printf '%s  %s\n' "$bruno_sha256" "$bin" | sha256sum --check --status; then return; fi
  mkdir -p "$root/bin"
  local download="$bin.download"
  curl -fsSL "https://github.com/brunojppb/turbo-cache-server/releases/download/$bruno_version/decay-x86_64-unknown-linux-musl" -o "$download"
  printf '%s  %s\n' "$bruno_sha256" "$download" | sha256sum --check --status || { rm -f "$download"; die "bruno checksum mismatch"; }
  chmod 0700 "$download" && mv "$download" "$bin"
}

install_ducktors() {
  local dir="$root/ducktors-$ducktors_version"
  if [[ ! -f "$dir/node_modules/turborepo-remote-cache/package.json" ]]; then
    mkdir -p "$dir"
    printf '{"private":true,"dependencies":{"turborepo-remote-cache":"%s"}}\n' "$ducktors_version" >"$dir/package.json"
    (cd "$dir" && npm install --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null)
  fi
  local got
  got="$(jq -r '.packages["node_modules/turborepo-remote-cache"].integrity' "$dir/package-lock.json")"
  [[ "$got" == "$ducktors_integrity" ]] || die "ducktors integrity mismatch"
}

check_incumbent() {
  [[ -f "$lambda_root/node_modules/turborepo-remote-cache/package.json" ]] || die "run bun install --frozen-lockfile in $lambda_root first"
  grep -qF "$incumbent_integrity" "$lambda_root/bun.lock" || die "incumbent shim integrity is not the pinned 2.12.0"
}

spawn() { # name, then command; records the pid
  local name="$1"; shift
  nohup "$@" >"$state/logs/$name.log" 2>&1 &
  printf '%s\n' "$!" >"$state/pids/$name"
}

wait_port() {
  local port="$1" tries=0
  until curl -s -o /dev/null "http://127.0.0.1:$port/"; do
    tries=$((tries + 1)); [[ $tries -lt 100 ]] || die "port $port did not open"; sleep 0.1
  done
}

up() {
  [[ ! -d "$state" ]] || die "lab already up (state at $state); run down first"
  command -v bun >/dev/null && command -v node >/dev/null || die "bun and node must be on PATH (zsh -ic)"
  fetch_bruno; install_ducktors; check_incumbent
  mkdir -p "$state/pids" "$state/logs" "$state/data/store" "$state/data/ducktors"

  {
    printf 'LAB_READ_TOKEN=%s\nLAB_WRITE_TOKEN=%s\nLAB_WRITER_SECRET=%s\n' "$(token)" "$(token)" "$(token)"
    printf 'LAB_FOREIGN_TOKEN=%s\nLAB_UNKNOWN_TOKEN=%s\nLAB_BRUNO_TOKEN=%s\n' "$(token)" "$(token)" "$(token)"
    printf 'LAB_DUCKTORS_READ_TOKEN=%s\nLAB_DUCKTORS_WRITE_TOKEN=%s\n' "$(token)" "$(token)"
    printf 'LAB_S3_ACCESS=%s\nLAB_S3_SECRET=%s\n' "lab$(openssl rand -hex 8)" "$(token)"
  } >"$state/lab.env"
  set -a; . "$state/lab.env"; set +a

  docker run -d --rm --name "$container" -p "127.0.0.1:$store_port:7070" \
    -e ROOT_ACCESS_KEY_ID="$LAB_S3_ACCESS" -e ROOT_SECRET_ACCESS_KEY="$LAB_S3_SECRET" \
    -v "$state/data/store:/data" "$store_image" posix /data >/dev/null
  wait_port "$store_port"
  for bucket in lab-incumbent lab-incumbent-evolved lab-bruno; do
    AWS_ACCESS_KEY_ID="$LAB_S3_ACCESS" AWS_SECRET_ACCESS_KEY="$LAB_S3_SECRET" AWS_REGION=us-east-1 \
      aws s3api create-bucket --endpoint-url "http://127.0.0.1:$store_port" --bucket "$bucket" >/dev/null
  done

  local s3=(AWS_ACCESS_KEY_ID="$LAB_S3_ACCESS" AWS_SECRET_ACCESS_KEY="$LAB_S3_SECRET" AWS_REGION=us-east-1)
  # Incumbent: two shim functions (deployed READ_ONLY split) behind the gateway.
  for fn in reader writer; do
    local fport=$reader_port read_only=true
    [[ $fn == writer ]] && fport=$writer_port read_only=false
    spawn "incumbent-$fn" env -i PATH="$PATH" HOME="$HOME" "${s3[@]}" \
      AUTH_MODE=none STORAGE_PROVIDER=s3 STORAGE_PATH=lab-incumbent READ_ONLY="$read_only" \
      S3_ENDPOINT="http://127.0.0.1:$store_port" LAB_FUNCTION="$fn" LAB_WORKER_PORT="$fport" \
      LAB_WRITER_SECRET="$LAB_WRITER_SECRET" bun "$here/worker.ts"
  done
  spawn incumbent-gateway env -i PATH="$PATH" HOME="$HOME" LAB_MODE=incumbent LAB_PORT="$incumbent_port" \
    LAB_READER_PORT="$reader_port" LAB_WRITER_PORT="$writer_port" LAB_READ_TOKEN="$LAB_READ_TOKEN" \
    LAB_WRITE_TOKEN="$LAB_WRITE_TOKEN" LAB_WRITER_SECRET="$LAB_WRITER_SECRET" bun "$here/gateway.ts"

  # Bruno alone (the R2 cohort's loopback shape) and behind the policy gateway.
  spawn bruno env -i PATH="$PATH" HOME="$HOME" HOST=127.0.0.1 PORT="$bruno_port" OTEL_SDK_DISABLED=true \
    S3_ACCESS_KEY="$LAB_S3_ACCESS" S3_SECRET_KEY="$LAB_S3_SECRET" S3_REGION=us-east-1 \
    S3_ENDPOINT="http://127.0.0.1:$store_port" S3_USE_PATH_STYLE=true S3_BUCKET_NAME=lab-bruno \
    TURBO_TOKEN="$LAB_BRUNO_TOKEN" "$root/bin/decay-$bruno_version"
  spawn bruno-gateway env -i PATH="$PATH" HOME="$HOME" LAB_MODE=policy-proxy LAB_PORT="$bruno_policy_port" \
    LAB_UPSTREAM="http://127.0.0.1:$bruno_port" LAB_UPSTREAM_TOKEN="$LAB_BRUNO_TOKEN" \
    LAB_READ_TOKEN="$LAB_READ_TOKEN" LAB_WRITE_TOKEN="$LAB_WRITE_TOKEN" LAB_WRITER_SECRET="$LAB_WRITER_SECRET" \
    bun "$here/gateway.ts"

  # Ducktors upstream: static auth, local storage. Static tokens carry no role split.
  spawn ducktors env -i PATH="$PATH" HOME="$HOME" NODE_ENV=production HOST=127.0.0.1 PORT="$ducktors_port" \
    AUTH_MODE=static STORAGE_PROVIDER=local STORAGE_PATH="$state/data/ducktors" LOG_LEVEL=info \
    TURBO_TOKEN="$LAB_DUCKTORS_READ_TOKEN,$LAB_DUCKTORS_WRITE_TOKEN" \
    node "$root/ducktors-$ducktors_version/node_modules/turborepo-remote-cache/dist/cli.js"

  for port in "$reader_port" "$writer_port" "$incumbent_port" "$bruno_port" "$bruno_policy_port" "$ducktors_port"; do
    wait_port "$port"
  done
  start_evolved
  status
}

start_evolved() {
  # Minimum incumbent remediation: the 2.12.0 shim stores and returns
  # x-artifact-tag only when TURBO_REMOTE_CACHE_SIGNATURE_KEY is non-empty.
  # It never verifies with the value, so a fixed non-secret mode switch is set;
  # the client keeps the real signing key.
  local s3=(AWS_ACCESS_KEY_ID="$LAB_S3_ACCESS" AWS_SECRET_ACCESS_KEY="$LAB_S3_SECRET" AWS_REGION=us-east-1)
  for fn in reader writer; do
    local fport=$evolved_reader_port read_only=true
    [[ $fn == writer ]] && fport=$evolved_writer_port read_only=false
    spawn "evolved-$fn" env -i PATH="$PATH" HOME="$HOME" "${s3[@]}" \
      AUTH_MODE=none STORAGE_PROVIDER=s3 STORAGE_PATH=lab-incumbent-evolved READ_ONLY="$read_only" \
      TURBO_REMOTE_CACHE_SIGNATURE_KEY=tag-passthrough-mode-switch \
      S3_ENDPOINT="http://127.0.0.1:$store_port" LAB_FUNCTION="$fn" LAB_WORKER_PORT="$fport" \
      LAB_WRITER_SECRET="$LAB_WRITER_SECRET" bun "$here/worker.ts"
  done
  spawn evolved-gateway env -i PATH="$PATH" HOME="$HOME" LAB_MODE=incumbent LAB_PORT="$evolved_port" \
    LAB_READER_PORT="$evolved_reader_port" LAB_WRITER_PORT="$evolved_writer_port" LAB_READ_TOKEN="$LAB_READ_TOKEN" \
    LAB_WRITE_TOKEN="$LAB_WRITE_TOKEN" LAB_WRITER_SECRET="$LAB_WRITER_SECRET" bun "$here/gateway.ts"
  for port in "$evolved_reader_port" "$evolved_writer_port" "$evolved_port"; do wait_port "$port"; done
}

# Add the evolved incumbent to a lab started before it existed.
evolved() {
  [[ -d "$state" ]] || die "lab is down"
  set -a; . "$state/lab.env"; set +a
  AWS_ACCESS_KEY_ID="$LAB_S3_ACCESS" AWS_SECRET_ACCESS_KEY="$LAB_S3_SECRET" AWS_REGION=us-east-1 \
    aws s3api create-bucket --endpoint-url "http://127.0.0.1:$store_port" --bucket lab-incumbent-evolved >/dev/null 2>&1 || true
  start_evolved
  status
}

status() {
  [[ -d "$state" ]] || { echo "lab: down"; return; }
  for pidfile in "$state"/pids/*; do
    local name pid
    name="$(basename "$pidfile")"; pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then echo "$name: up (pid $pid)"; else echo "$name: DOWN"; fi
  done
  docker inspect -f '{{.Name}}: {{.State.Status}}' "$container" 2>/dev/null || echo "store: DOWN"
  printf 'endpoints: incumbent-evolved=%s ' "http://127.0.0.1:$evolved_port"
  printf 'incumbent=%s bruno-policy=%s bruno-loopback=%s ducktors-upstream=%s\n' \
    "http://127.0.0.1:$incumbent_port" "http://127.0.0.1:$bruno_policy_port" \
    "http://127.0.0.1:$bruno_port" "http://127.0.0.1:$ducktors_port"
  printf 'env file: %s\n' "$state/lab.env"
}

down() {
  if [[ -d "$state/pids" ]]; then
    for pidfile in "$state"/pids/*; do
      local pid; pid="$(cat "$pidfile")"
      kill "$pid" 2>/dev/null || true
    done
  fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  # The store container wrote as root; remove its data through the image.
  if [[ -d "$state/data/store" ]]; then
    docker run --rm -v "$state/data:/data" --entrypoint /bin/sh "$store_image" -c 'rm -rf /data/store' >/dev/null 2>&1 || true
  fi
  rm -rf "$state"
  echo "lab: down"
}

case "${1:-}" in
  up) up ;;
  evolved) evolved ;;
  status) status ;;
  down) down ;;
  *) die "usage: lab.sh up|evolved|status|down" ;;
esac

#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 <trusted-adapter> <repo> self-check <golden-dir>" >&2
  echo "       $0 <trusted-adapter> <repo> observe <output-dir>" >&2
  exit 64
}

[ "$#" -eq 4 ] || usage

adapter_input="$1"
repo_input="$2"
mode="$3"
target_input="$4"

command -v bwrap >/dev/null 2>&1 || {
  echo "refusing: bubblewrap is required for adapter isolation" >&2
  exit 69
}
command -v prlimit >/dev/null 2>&1 || {
  echo "refusing: prlimit is required for adapter resource bounds" >&2
  exit 69
}

[ ! -L "${adapter_input}" ] || {
  echo "refusing: trusted adapter path is a symbolic link" >&2
  exit 65
}
[ -f "${adapter_input}" ] || usage

adapter="$(realpath -- "${adapter_input}")"
repo="$(realpath -- "${repo_input}")"
adapter_parent="$(dirname -- "${adapter}")"

case "${adapter}" in
  "${repo}" | "${repo}"/*)
    echo "refusing: adapter must live outside the audited repository" >&2
    exit 65
    ;;
esac

adapter_owner="$(stat -c '%u' -- "${adapter}")"
parent_owner="$(stat -c '%u' -- "${adapter_parent}")"
parent_mode="$(stat -c '%a' -- "${adapter_parent}")"
if [ "${adapter_owner}" != "$(id -u)" ] || [ "${parent_owner}" != "$(id -u)" ]; then
  echo "refusing: trusted adapter and its directory must be owned by the current user" >&2
  exit 65
fi
if (( (8#${parent_mode} & 8#022) != 0 )); then
  echo "refusing: trusted adapter directory is writable by another user" >&2
  exit 65
fi

common=(
  --unshare-all
  --die-with-parent
  --new-session
  --clearenv
  --setenv HOME /nonexistent
  --setenv PATH /usr/bin
  --setenv PYTHONHASHSEED 0
  --setenv LC_ALL C.UTF-8
  --ro-bind /usr /usr
  --symlink usr/bin /bin
  --symlink usr/lib /lib
  --symlink usr/lib /lib64
  --proc /proc
  --dev /dev
  --tmpfs /tmp
  --ro-bind "${adapter}" /adapter.py
  --ro-bind "${repo}" /repo
  --chdir /repo
)

case "${mode}" in
  self-check)
    golden="$(realpath -- "${target_input}")"
    case "${golden}" in
      "${repo}" | "${repo}"/*) ;;
      *)
        echo "refusing: golden fixture must be inside the audited repository" >&2
        exit 65
        ;;
    esac
    sandbox_args=("${common[@]}" --ro-bind "${golden}" /golden /usr/bin/python3 /adapter.py --self-check /golden)
    ;;
  observe)
    mkdir -p -- "${target_input}"
    [ ! -L "${target_input}" ] || {
      echo "refusing: observation output is a symbolic link" >&2
      exit 65
    }
    output="$(realpath -- "${target_input}")"
    case "${output}" in
      "${repo}"/*) ;;
      *)
        echo "refusing: observation output must be inside the audited repository" >&2
        exit 65
        ;;
    esac
    sandbox_args=("${common[@]}" --bind "${output}" /out /usr/bin/python3 /adapter.py --repo /repo --out /out)
    ;;
  *) usage ;;
esac

exec prlimit \
  --cpu=120 \
  --as=2147483648 \
  --fsize=268435456 \
  --nproc=64 \
  --nofile=256 \
  -- bwrap "${sandbox_args[@]}"

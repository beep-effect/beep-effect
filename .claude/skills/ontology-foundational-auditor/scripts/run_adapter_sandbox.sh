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
adapter_mode="$(stat -c '%a' -- "${adapter}")"
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
if (( (8#${adapter_mode} & 8#022) != 0 )); then
  echo "refusing: trusted adapter file is writable by another user" >&2
  exit 65
fi

lib64_runtime="$(realpath -- /lib64 2>/dev/null || true)"
case "${lib64_runtime}" in
  /usr/*) lib64_target="${lib64_runtime#/}" ;;
  *)
    echo "refusing: the host /lib64 runtime does not resolve beneath /usr" >&2
    exit 69
    ;;
esac

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
  --symlink "${lib64_target}" /lib64
  --proc /proc
  --dev /dev
  --tmpfs /tmp
  --ro-bind "${adapter}" /adapter.py
  --ro-bind "${repo}" /repo
  --chdir /repo
)

# RLIMIT_NPROC is charged against the invoking UID's task count across the whole
# host, so applying it outside the sandbox makes bwrap's clone fail with EAGAIN on
# any busy desktop session (thousands of tasks > 64). The limits therefore wrap the
# adapter INSIDE the fresh user namespace, where the per-user task count restarts
# at the sandbox's own processes and every bound is enforced as intended.
resource_limits=(/usr/bin/prlimit --cpu=120 --as=2147483648 --fsize=268435456 --nproc=64 --nofile=256 --)

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
    sandbox_args=("${common[@]}" --ro-bind "${golden}" /golden "${resource_limits[@]}" /usr/bin/python3 /adapter.py --self-check /golden)
    ;;
  observe)
    output_lexical="$(realpath -ms -- "${target_input}")"
    case "${output_lexical}" in
      "${repo}"/*) ;;
      *)
        echo "refusing: observation output must be inside the audited repository" >&2
        exit 65
        ;;
    esac
    output_probe="${output_lexical}"
    while [ "${output_probe}" != "${repo}" ]; do
      [ ! -L "${output_probe}" ] || {
        echo "refusing: observation output contains a symbolic-link component" >&2
        exit 65
      }
      output_probe="$(dirname -- "${output_probe}")"
    done
    mkdir -p -- "${output_lexical}"
    output_probe="${output_lexical}"
    while [ "${output_probe}" != "${repo}" ]; do
      [ ! -L "${output_probe}" ] || {
        echo "refusing: observation output changed to a symbolic link" >&2
        exit 65
      }
      output_probe="$(dirname -- "${output_probe}")"
    done
    output="$(realpath -e -- "${output_lexical}")"
    case "${output}" in
      "${repo}"/*) ;;
      *)
        echo "refusing: observation output escaped the audited repository" >&2
        exit 65
        ;;
    esac
    sandbox_args=("${common[@]}" --bind "${output}" /out "${resource_limits[@]}" /usr/bin/python3 /adapter.py --repo /repo --out /out)
    ;;
  *) usage ;;
esac

exec bwrap "${sandbox_args[@]}"

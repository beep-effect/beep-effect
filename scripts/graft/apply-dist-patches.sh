#!/usr/bin/env bash
# Re-apply the workstation-local Graft dist patches after an install or upgrade.
#
# The patches live in scripts/graft/patches/<graft version>/ as unified diffs
# rooted at the installed package's dist/ directory. Each one is applied at
# most once: a patch that already matches the installed file is reported as
# applied and skipped, so the script is safe to run repeatedly.
#
#   scripts/graft/apply-dist-patches.sh            # apply what is missing
#   scripts/graft/apply-dist-patches.sh --check    # report only; exit 1 if any is missing
#
# --from <version> inherits patches only when the package version has no recorded directory.
# GRAFT_PACKAGE_ROOT overrides the package location (the directory that holds
# package.json and dist/); by default it is resolved from the `graft` on PATH.
set -euo pipefail

mode="--apply"
from=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply | --check) mode="$1"; shift ;;
    --from)
      if [ "$#" -lt 2 ] || [[ ! "$2" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
        echo "--from requires a stable major.minor.patch version" >&2
        exit 2
      fi
      from="$2"; shift 2 ;;
    *) echo "usage: $0 [--apply|--check] [--from <version>]" >&2; exit 2 ;;
  esac
done

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -n "${GRAFT_PACKAGE_ROOT:-}" ]; then
  pkg="$GRAFT_PACKAGE_ROOT"
else
  bin="$(command -v graft || true)"
  if [ -z "$bin" ]; then
    echo "graft is not on PATH; set GRAFT_PACKAGE_ROOT to the installed package directory" >&2
    exit 2
  fi
  # ~/.local/bin/graft -> <package>/dist/cli.js
  pkg="$(cd "$(dirname "$(readlink -f "$bin")")/.." && pwd)"
fi

if [ ! -f "$pkg/package.json" ] || [ ! -d "$pkg/dist" ]; then
  echo "no Graft package at $pkg (expected package.json and dist/)" >&2
  exit 2
fi

version="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$pkg/package.json" | head -n 1)"
patches="$here/patches/$version"
if [ ! -d "$patches" ] && [ -n "$from" ]; then
  patches="$here/patches/$from"
fi
if [ ! -d "$patches" ]; then
  echo "no dist patches recorded for graft $version under $here/patches/; port them before the next deep build" >&2
  exit 1
fi

# An empty patch directory cannot prove compatibility.
if ! compgen -G "$patches/*.patch" >/dev/null; then
  echo "no dist patches in $patches" >&2
  exit 1
fi

missing=0
for patch_file in "$patches"/*.patch; do
  name="$(basename "$patch_file" .patch)"
  if patch -p1 -d "$pkg/dist" -R --dry-run --silent <"$patch_file" >/dev/null 2>&1; then
    echo "applied  $name"
    continue
  fi
  if ! patch -p1 -d "$pkg/dist" --forward --dry-run --silent <"$patch_file" >/dev/null 2>&1; then
    echo "CONFLICT $name (does not apply to graft $version cleanly; port it by hand)"
    missing=$((missing + 1))
    continue
  fi
  if [ "$mode" = "--check" ]; then
    echo "missing  $name"
    missing=$((missing + 1))
    continue
  fi
  patch -p1 -d "$pkg/dist" --forward --silent -b -z ".orig-$version" <"$patch_file" >/dev/null
  echo "patched  $name"
done

if [ "$missing" -gt 0 ]; then
  echo "$missing patch(es) not applied to graft $version at $pkg/dist" >&2
  exit 1
fi
echo "graft $version at $pkg/dist carries every recorded dist patch"

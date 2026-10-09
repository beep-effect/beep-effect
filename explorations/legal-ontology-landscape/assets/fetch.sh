#!/usr/bin/env bash
# Reproduce gitignored vendor bytes from checksum-pinned manifest metadata.
# Usage: ./fetch.sh [--verify-only]
set -euo pipefail
cd "$(dirname "$0")"
[ ! -L vendor ] || { echo "INVALID vendor root symlink" >&2; exit 1; }
mkdir -p vendor
vendor_root=$(realpath vendor)
verify_only="${1:-}"
fail=0

contained_path() {
  local relative="$1" resolved
  case "$relative" in
    ""|/*|*\\*|.|..|./*|../*|*/./*|*/../*|*/.|*/..)
      echo "INVALID vendor-relative path" >&2; return 1 ;;
  esac
  resolved=$(realpath -m "vendor/$relative")
  case "$resolved" in
    "$vendor_root"/*) printf '%s\n' "$resolved" ;;
    *) echo "INVALID path outside vendor root" >&2; return 1 ;;
  esac
}

while IFS= read -r row; do
  [ -z "$row" ] && continue
  id=$(jq -r '.id' <<<"$row")
  url=$(jq -r '.fetchUrl' <<<"$row")
  sha=$(jq -r '.sha256 // empty' <<<"$row")
  fmt=$(jq -r '.format' <<<"$row")
  case "$fmt" in
    ttl) ext=ttl ;; rdfxml|owl) ext=$( [ "$fmt" = owl ] && echo owl || echo rdf ) ;;
    jsonld) ext=jsonld ;; skos) ext=rdf ;; *) ext=dat ;;
  esac
  manifested_path=$(jq -r '.path // empty' <<<"$row")
  relative="${manifested_path:-${id}.${ext}}"
  out=$(contained_path "$relative") || { fail=1; continue; }
  archive_path=$(jq -r '.archivePath // empty' <<<"$row")
  download="$out"
  if [ -n "$archive_path" ]; then
    [ "$(jq -r '.loadKind' <<<"$row")" = classification-scheme ] || {
      echo "INVALID archive load kind $id" >&2; fail=1; continue;
    }
    download=$(contained_path "$archive_path") || { fail=1; continue; }
  fi
  mkdir -p "$(dirname "$download")"
  if [ "$verify_only" != --verify-only ]; then
    echo "fetch  $id <- $url"
    curl -fsSL --retry 1 -o "$download" "$url"
  fi
  if [ -z "$sha" ] || [ ! -f "$download" ]; then
    echo "MISSING checksum or bytes $id" >&2; fail=1; continue
  fi
  got=$(sha256sum "$download" | cut -d' ' -f1)
  if [ "$got" != "$sha" ]; then
    echo "MISMATCH $id expected=$sha got=$got" >&2; fail=1; continue
  fi
  if [ -n "$archive_path" ]; then
    # Validate every member before the host unpacker sees the archive. Reject
    # symlinks and traversal, including existing symlink ancestors in vendor/.
    python - "$download" "$out" "$vendor_root" <<'PYZIP'
import os, stat, sys, zipfile
from pathlib import PurePosixPath
archive, destination, root = sys.argv[1:]
with zipfile.ZipFile(archive) as z:
    for member in z.infolist():
        name = member.filename
        parts = PurePosixPath(name).parts
        if not parts or name.startswith('/') or '\\' in name or '..' in parts:
            raise SystemExit('INVALID archive member path')
        if stat.S_ISLNK(member.external_attr >> 16):
            raise SystemExit('INVALID archive symlink member')
        resolved = os.path.realpath(os.path.join(destination, name))
        if os.path.commonpath([root, resolved]) != root:
            raise SystemExit('INVALID archive member outside vendor root')
PYZIP
    if [ "$verify_only" != --verify-only ]; then
      mkdir -p "$out"
      unzip -oq "$download" -d "$out"
    fi
  fi
  echo "ok     $id"
done < manifest.jsonl
exit "$fail"

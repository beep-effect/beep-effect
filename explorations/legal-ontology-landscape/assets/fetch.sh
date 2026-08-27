#!/usr/bin/env bash
# Reproduce assets/vendor/ from manifest.jsonl (vendor/ is gitignored; this
# script + the manifest are the committed record).
# Usage: ./fetch.sh [--verify-only]
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p vendor

verify_only="${1:-}"
fail=0

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
  if [ -n "$manifested_path" ]; then
    case "$manifested_path" in
      /*|*\\*|.|..|./*|../*|*/./*|*/../*|*/.|*/..)
        echo "INVALID PATH $id path=$manifested_path" >&2
        fail=1
        continue
        ;;
    esac
    out="vendor/$manifested_path"
  else
    out="vendor/${id}.${ext}"
  fi
  mkdir -p "$(dirname "$out")"
  if [ "$verify_only" != "--verify-only" ]; then
    echo "fetch  $id <- $url"
    curl -fsSL --retry 3 -o "$out" "$url"
  fi
  if [ -n "$sha" ] && [ -f "$out" ]; then
    got=$(sha256sum "$out" | cut -d' ' -f1)
    if [ "$got" != "$sha" ]; then
      echo "MISMATCH $id expected=$sha got=$got" >&2
      fail=1
    else
      echo "ok     $id"
    fi
  fi
done < manifest.jsonl

exit "$fail"

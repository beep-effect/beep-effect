#!/usr/bin/env zsh
# Mine lejeunebolt.com (+ its first-party microsites) into the machine-local corpus.
# Reproduces the 2026-08-25 L1 lane method (research/01-lejeunebolt-site-mining.md
# §Scope and method): robots.txt → sitemap index → sitemap URLs → same-site link
# closure → HTML + PDF/DOCX/XLSX/DXF/DWG retrieval. Output never enters the repo
# (public); it lands under ~/data-home/lejeune-bolt-corpus/ (see research/raw/README.md).
#
# Lessons baked in (research/OPPORTUNITIES.md): identify as a normal browser and
# probe two pages before the bulk pass — a self-described crawler UA drew 403s site-wide.
# Be polite: serial requests, 1s spacing, resume-safe (skips files already present).
set -euo pipefail
ROOT="${LEJEUNE_CORPUS_ROOT:-$HOME/data-home/lejeune-bolt-corpus}"
STAMP="$(date -u +%Y-%m-%d)"
OUT="$ROOT/site-$STAMP"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"
HOSTS=(lejeunebolt.com rentals.lejeunebolt.com tightenright.com)
mkdir -p "$OUT/html" "$OUT/files" "$OUT/meta"
fetch() { # url outfile
  [ -s "$2" ] && return 0
  curl -sSL --max-time 60 -A "$UA" -o "$2" -w '%{http_code} %{url_effective}\n' "$1" >> "$OUT/meta/fetch.log" || true
  sleep 1
}
probe() { # fail fast if the request profile is rejected
  for u in "https://lejeunebolt.com/" "https://lejeunebolt.com/contact-us/"; do
    code=$(curl -sSL --max-time 30 -A "$UA" -o /dev/null -w '%{http_code}' "$u")
    [ "$code" = "200" ] || { echo "probe $u returned $code — fix the request profile before crawling" >&2; exit 2; }
  done
}
urls_from_sitemaps() {
  for h in "${HOSTS[@]}"; do
    fetch "https://$h/robots.txt" "$OUT/meta/$h.robots.txt"
    fetch "https://$h/sitemap.xml" "$OUT/meta/$h.sitemap.xml"
    fetch "https://$h/sitemap_index.xml" "$OUT/meta/$h.sitemap_index.xml"
  done
  # expand sitemap indexes one level, then collect <loc> entries
  for f in "$OUT"/meta/*.sitemap*.xml; do
    grep -oE '<loc>[^<]+</loc>' "$f" 2>/dev/null | sed -E 's#</?loc>##g' | grep -E '\.xml$' | while read -r sm; do
      fetch "$sm" "$OUT/meta/$(echo "$sm" | tr -c 'A-Za-z0-9.' '_')"
    done
  done
  cat "$OUT"/meta/*.xml 2>/dev/null | grep -oE '<loc>[^<]+</loc>' | sed -E 's#</?loc>##g' | grep -vE '\.xml$' | sort -u
}
probe
urls_from_sitemaps > "$OUT/meta/urls.txt"
echo "$(wc -l < "$OUT/meta/urls.txt") sitemap URLs"
while read -r u; do
  slug=$(echo "$u" | sed -E 's#https?://##; s#[^A-Za-z0-9._-]+#_#g' | cut -c1-180)
  case "$u" in
    *.pdf|*.PDF|*.docx|*.xlsx|*.dxf|*.dwg|*.DXF|*.DWG) fetch "$u" "$OUT/files/$slug" ;;
    *) fetch "$u" "$OUT/html/$slug.html" ;;
  esac
done < "$OUT/meta/urls.txt"
# one level of same-site link closure for pages missing from sitemaps (incl. PDFs in wp-content/uploads)
grep -ohE 'https?://(rentals\.)?(lejeunebolt|tightenright)\.com/[^"'"'"' <>)]+' "$OUT"/html/*.html 2>/dev/null \
  | sed -E 's/[#?].*$//' | sort -u | comm -23 - <(sort -u "$OUT/meta/urls.txt") > "$OUT/meta/urls.discovered.txt" || true
echo "$(wc -l < "$OUT/meta/urls.discovered.txt") discovered URLs"
while read -r u; do
  slug=$(echo "$u" | sed -E 's#https?://##; s#[^A-Za-z0-9._-]+#_#g' | cut -c1-180)
  case "$u" in
    *.pdf|*.PDF|*.docx|*.xlsx|*.dxf|*.dwg|*.DXF|*.DWG) fetch "$u" "$OUT/files/$slug" ;;
    *.jpg|*.jpeg|*.png|*.gif|*.webp|*.svg|*.css|*.js|*.woff*|*.ico) ;;
    *) fetch "$u" "$OUT/html/$slug.html" ;;
  esac
done < "$OUT/meta/urls.discovered.txt"
echo "corpus at $OUT: $(ls "$OUT/html" | wc -l) pages, $(ls "$OUT/files" | wc -l) files; log: $OUT/meta/fetch.log"
echo "next: feed $OUT into the ingestion pipeline (@beep/file-processing → langextract → ontology) per MAP.md"

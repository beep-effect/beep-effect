#!/usr/bin/env bash
# Merge-gate table for every open PR in the current repo.
# REST for PRs and check runs (core quota); ONE GraphQL query for review threads.
# Required contexts come live from main's ruleset, so the list never drifts.
# usage: gate.sh [--no-threads]
# columns: #PR  ready|DRAFT  base  head  mergeable_state  ok=N/M  threads=unresolved/total  RED:...  GATE-MET
set -uo pipefail
R="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
OWNER="${R%/*}"
NAME="${R#*/}"
REQ="$(gh api "repos/$R/rules/branches/main" --jq '[.[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context]')"
NREQ="$(jq length <<<"$REQ")"

threads='{}'
if [ "${1:-}" != "--no-threads" ]; then
  out="$(gh api graphql -f query="query{repository(owner:\"$OWNER\",name:\"$NAME\"){pullRequests(states:OPEN,first:60){nodes{number reviewThreads(first:100){totalCount nodes{isResolved}}}}}}" 2>/dev/null)"
  if jq -e '.data.repository.pullRequests.nodes' >/dev/null 2>&1 <<<"$out"; then
    threads="$(jq -c '[.data.repository.pullRequests.nodes[] | {key: (.number|tostring), value: {total: .reviewThreads.totalCount, unresolved: ([.reviewThreads.nodes[]|select(.isResolved|not)]|length)}}] | from_entries' <<<"$out")"
  else
    echo "THREADS UNAVAILABLE (GraphQL quota?) — never read a missing count as zero" >&2
  fi
fi

gh api "repos/$R/pulls?state=open&per_page=100" --jq '.[] | [.number, .draft, .base.ref, .head.sha] | @tsv' | sort -n |
while IFS=$'\t' read -r n draft base sha; do
  state="$(gh api "repos/$R/pulls/$n" --jq '.mergeable_state')"
  gh api "repos/$R/commits/$sha/check-runs?per_page=100" --paginate --jq '.check_runs[] | {name, status, conclusion, id}' |
  jq -rs --argjson req "$REQ" --argjson nreq "$NREQ" --argjson th "$threads" \
     --arg n "$n" --arg draft "$draft" --arg base "$base" --arg sha "$sha" --arg state "$state" '
    (map(select(.name as $x | $req | index($x))) | group_by(.name) | map(max_by(.id))) as $r
    | ($r | map(select(.conclusion=="success" or .conclusion=="skipped" or .conclusion=="neutral")) | length) as $ok
    | ($r | map(select(.status=="completed" and (.conclusion!="success" and .conclusion!="skipped" and .conclusion!="neutral"))) | map("\(.name)=\(.conclusion)")) as $bad
    | ($th[$n] // null) as $t
    | [ "#"+$n, (if $draft=="true" then "DRAFT" else "ready" end), $base, $sha[0:10], $state,
        "ok=\($ok)/\($nreq)", "threads=" + (if $t then "\($t.unresolved)/\($t.total)" else "?" end),
        (if ($bad|length)>0 then "RED:" + ($bad|join(",")) else "" end),
        (if $ok==$nreq and $draft!="true" and $t and $t.unresolved==0 and $state!="dirty" then "GATE-MET" else "" end) ] | @tsv'
done

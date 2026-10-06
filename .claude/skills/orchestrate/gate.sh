#!/usr/bin/env bash
# Merge-gate table for every open PR in the current repo, matching AGENTS.md "Mergeable".
# REST for PRs and check runs (core quota); ONE GraphQL query for review threads.
# Required contexts come live from main's ruleset; the script fails closed when they are missing.
# usage: gate.sh [--no-threads]
# columns: #PR  ready|DRAFT  base  head  mergeable_state  ok=N/M  threads=outstanding/total  window=ok|Nm|?|-  RED:...  GATE-MET
#
# window is the review window (push-first-publish D11): WINDOW_MIN minutes since the later of
# the PR's last ready_for_review event (its creation when it was opened ready) and the push of
# its head (the earliest check suite on the head commit). ok = elapsed, Nm = minutes left,
# ? = a read failed (never read as elapsed), - = draft (the window starts at the flip).
# Keep WINDOW_MIN equal to YEET_REVIEW_WINDOW_DEFAULT in yeet's internal/ReviewWindow.ts.
#
# A thread is outstanding when it is unresolved, or when the PR author resolved it and a
# different human (not a bot) commented last — the same rule as yeet's
# deriveYeetReviewThreadState "resolved-follow-up". GATE-MET also needs no failing
# check run at all; a rate-limited Vercel failure (the one AGENTS.md exception) is a
# judgment call for the orchestrator after reading the run, never automatic.
set -uo pipefail
WINDOW_MIN="${WINDOW_MIN:-20}"
R="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
OWNER="${R%/*}"
NAME="${R#*/}"
REQ="$(gh api "repos/$R/rules/branches/main" --jq '[.[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context]' 2>/dev/null)"
NREQ="$(jq length <<<"$REQ" 2>/dev/null)"
if ! [ "${NREQ:-0}" -gt 0 ] 2>/dev/null; then
  echo "NO REQUIRED CONTEXTS on main (ruleset missing or unreadable): refusing to evaluate the gate" >&2
  exit 1
fi

threads='{}'
if [ "${1:-}" != "--no-threads" ]; then
  q="query{repository(owner:\"$OWNER\",name:\"$NAME\"){pullRequests(states:OPEN,first:60){nodes{number author{login} reviewThreads(first:100){totalCount nodes{isResolved resolvedBy{login} comments(last:1){nodes{author{__typename login}}}}}}}}}"
  out="$(gh api graphql -f query="$q" 2>/dev/null)"
  if jq -e '.data.repository.pullRequests.nodes' >/dev/null 2>&1 <<<"$out"; then
    threads="$(jq -c '
      [ .data.repository.pullRequests.nodes[]
        | (.author.login // "") as $pa
        | .reviewThreads as $rt
        | select(($rt.nodes | length) == $rt.totalCount)   # >100 threads: leave out so the row prints "?"
        | { key: (.number | tostring),
            value: { total: $rt.totalCount,
                     outstanding: ([ $rt.nodes[]
                       | (.comments.nodes[0].author // {}) as $last
                       | select((.isResolved | not)
                           or ((.resolvedBy.login // "") == $pa and $pa != ""
                               and ($last.login // $pa) != $pa
                               and ($last.__typename // "Bot") != "Bot")) ] | length) } } ]
      | from_entries' <<<"$out")"
  else
    echo "THREADS UNAVAILABLE (GraphQL quota?) — never read a missing count as zero" >&2
  fi
fi

gh api "repos/$R/pulls?state=open&per_page=100" --jq '.[] | [.number, .draft, .base.ref, .head.sha, .created_at] | @tsv' | sort -n |
while IFS=$'\t' read -r n draft base sha created; do
  state="$(gh api "repos/$R/pulls/$n" --jq '.mergeable_state')"
  window="-"
  if [ "$draft" != "true" ]; then
    window="?"
    if flips="$(gh api --paginate "repos/$R/issues/$n/timeline?per_page=100" --jq '.[] | select(.event=="ready_for_review") | .created_at' 2>/dev/null)" &&
       suites="$(gh api "repos/$R/commits/$sha/check-suites?per_page=100" --jq '.check_suites[].created_at' 2>/dev/null)"; then
      ready_at="$(sed '/^$/d' <<<"$flips" | sort | tail -1)"
      pushed_at="$(sed '/^$/d' <<<"$suites" | sort | head -1)"
      ready_s="$(date -u -d "${ready_at:-$created}" +%s 2>/dev/null)"
      pushed_s="$(date -u -d "$pushed_at" +%s 2>/dev/null)"
      if [ -n "$pushed_at" ] && [ -n "$ready_s" ] && [ -n "$pushed_s" ]; then
        left=$(( WINDOW_MIN * 60 - ($(date -u +%s) - (ready_s > pushed_s ? ready_s : pushed_s)) ))
        if [ "$left" -le 0 ]; then window="ok"; else window="$(( (left + 59) / 60 ))m"; fi
      fi
    fi
  fi
  gh api "repos/$R/commits/$sha/check-runs?per_page=100" --paginate --jq '.check_runs[] | {name, status, conclusion, id}' |
  jq -rs --argjson req "$REQ" --argjson nreq "$NREQ" --argjson th "$threads" \
     --arg n "$n" --arg draft "$draft" --arg base "$base" --arg sha "$sha" --arg state "$state" --arg window "$window" '
    def good: .conclusion=="success" or .conclusion=="skipped" or .conclusion=="neutral";
    (group_by(.name) | map(max_by(.id))) as $latest
    | ($latest | map(select(.name as $x | $req | index($x)))) as $r
    | ($r | map(select(good)) | length) as $ok
    | ($latest | map(select(.status=="completed" and (good | not)))
        | map("\(.name)=\(.conclusion)")) as $bad
    | ($th[$n] // null) as $t
    | [ "#"+$n, (if $draft=="true" then "DRAFT" else "ready" end), $base, $sha[0:10], $state,
        "ok=\($ok)/\($nreq)", "threads=" + (if $t then "\($t.outstanding)/\($t.total)" else "?" end), "window=" + $window,
        (if ($bad|length)>0 then "RED:" + ($bad|join(",")) else "" end),
        (if $ok==$nreq and ($bad|length)==0 and $draft!="true" and $t and $t.outstanding==0 and $state!="dirty" and $window=="ok"
         then "GATE-MET" else "" end) ] | @tsv'
done

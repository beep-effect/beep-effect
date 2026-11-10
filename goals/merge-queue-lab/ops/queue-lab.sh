#!/usr/bin/env bash
# queue-lab.sh: drive synthetic pull requests through the merge queue on the
# `queue-lab` branch and print what GitHub reports (goals/merge-queue-lab).
#
# Usage: queue-lab.sh <command> [args]
#
#   open <slug> [--pr MODE] [--mg MODE] [--workflow] [--commits N] [--title T] [--behind]
#        Branch queue-lab-<slug> from origin/queue-lab, add one entry file (or,
#        with --workflow, a workflow_dispatch-only workflow file), push, and open
#        a pull request against queue-lab whose body sets the toy check's modes
#        (pass, fail, skip, cancel, hang; default pass). --commits N adds N
#        commits. --behind cuts the branch from the base's first parent so it is
#        behind. --self-enqueue makes the pull-request run enqueue the pull
#        request with its own GITHUB_TOKEN. Prints the pull-request number.
#   read <n>                 One GraphQL read: PR, queue entry, queue, timeline.
#   enqueue <n> [--as ID] [--jump]
#   dequeue <n> [--as ID]
#   wait <n> [--until merged|out|state=STATE] [--max SECONDS]
#                            Poll every 30 s (the packet's API budget), one
#                            compact JSON line per poll.
#   runs [--limit N]         Recent Queue Lab workflow runs.
#   ruleset                  Print the lab ruleset.
#   ruleset-set KEY=VALUE... Change merge_queue parameters (or strict=true|false)
#                            on the lab ruleset; prints before and after.
#   as <identity> <gh args>  Run any gh command as user, app or pat.
#   cleanup                  Close every open queue-lab-* pull request and delete
#                            every queue-lab-* branch on origin.
#
# Identities (--as): user (the gh login, default), app (the orchestrator App;
# token from $QUEUE_LAB_APP_TOKEN_CMD), pat (a fleet fine-grained PAT read from
# the 1Password reference in $QUEUE_LAB_PAT_REF through the PATH op shim).
# Tokens are passed to gh through the environment and never printed.
set -euo pipefail

REPO="${QUEUE_LAB_REPO:-beep-effect/beep-effect}"
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"
BASE="${QUEUE_LAB_BASE:-queue-lab}"
RULESET_ID="${QUEUE_LAB_RULESET_ID:-26917133}"
APP_TOKEN_CMD="${QUEUE_LAB_APP_TOKEN_CMD:-$HOME/.cache/beep/orchestrator/bin/gh-app-token.sh}"
PAT_REF="${QUEUE_LAB_PAT_REF:-}"
WORKDIR="${QUEUE_LAB_WORKTREE:-}"
POLL_SECONDS=30
# gh subcommands without --repo (pr checks, run rerun) resolve the repository from here.
export GH_REPO="$REPO"

die() { echo "queue-lab: $*" >&2; exit 1; }

# Run gh as the chosen identity.
gh_as() {
  local who="$1"; shift
  case "$who" in
    user) gh "$@" ;;
    app)
      local t; t="$(bash "$APP_TOKEN_CMD" 2>/dev/null)" || die "App token mint failed (run op-doctor)"
      GH_TOKEN="$t" gh "$@" ;;
    pat)
      [ -n "$PAT_REF" ] || die "set QUEUE_LAB_PAT_REF to an op:// reference"
      local t; t="$(op read "$PAT_REF" 2>/dev/null)" || die "PAT read failed (run op-doctor)"
      GH_TOKEN="$t" gh "$@" ;;
    *) die "unknown identity: $who" ;;
  esac
}

READ_DOC='query($owner:String!,$name:String!,$n:Int!){ repository(owner:$owner,name:$name){ pullRequest(number:$n){
  id number state headRefName headRefOid baseRefName mergeable mergeStateStatus isInMergeQueue isMergeQueueEnabled
  mergeCommit{oid} autoMergeRequest{enabledAt mergeMethod enabledBy{login}}
  mergeQueueEntry{ id state position enqueuedAt estimatedTimeToMerge jump solo enqueuer{login} headCommit{oid} baseCommit{oid} }
  mergeQueue{ configuration{ checkResponseTimeout maximumEntriesToBuild maximumEntriesToMerge mergeMethod mergingStrategy minimumEntriesToMerge minimumEntriesToMergeWaitTime }
    nextEntryEstimatedTimeToMerge entries(first:20){ totalCount nodes{ position state jump solo pullRequest{number} headCommit{oid} baseCommit{oid} } } }
  timelineItems(last:20, itemTypes:[ADDED_TO_MERGE_QUEUE_EVENT,REMOVED_FROM_MERGE_QUEUE_EVENT,MERGED_EVENT,AUTO_MERGE_ENABLED_EVENT,AUTO_MERGE_DISABLED_EVENT]){ nodes{ __typename
    ... on AddedToMergeQueueEvent{createdAt actor{login} enqueuer{login}}
    ... on RemovedFromMergeQueueEvent{createdAt reason actor{login} enqueuer{login} beforeCommit{oid}}
    ... on MergedEvent{createdAt actor{login} commit{oid}}
    ... on AutoMergeEnabledEvent{createdAt actor{login}}
    ... on AutoMergeDisabledEvent{createdAt actor{login} reason} } } } } }'

ENQUEUE_DOC='mutation($id:ID!,$oid:GitObjectID,$jump:Boolean){ enqueuePullRequest(input:{pullRequestId:$id, expectedHeadOid:$oid, jump:$jump}){
  mergeQueueEntry{ id state position enqueuedAt jump solo enqueuer{login} headCommit{oid} baseCommit{oid} pullRequest{number} } } }'

DEQUEUE_DOC='mutation($id:ID!){ dequeuePullRequest(input:{id:$id}){
  mergeQueueEntry{ id state position enqueuedAt pullRequest{number} } } }'

read_pr() { gh api graphql -F owner="$OWNER" -F name="$NAME" -F n="$1" -f query="$READ_DOC"; }

cmd_read() { read_pr "$1" | jq .; }

cmd_enqueue() {
  local n="$1"; shift; local who=user jump=false
  while [ $# -gt 0 ]; do case "$1" in --as) who="$2"; shift 2 ;; --jump) jump=true; shift ;; *) die "bad flag $1" ;; esac; done
  local pr; pr="$(read_pr "$n")"
  local id oid; id="$(jq -r '.data.repository.pullRequest.id' <<<"$pr")"; oid="$(jq -r '.data.repository.pullRequest.headRefOid' <<<"$pr")"
  gh_as "$who" api graphql -F id="$id" -F oid="$oid" -F jump="$jump" -f query="$ENQUEUE_DOC" || true
}

cmd_dequeue() {
  local n="$1"; shift; local who=user
  while [ $# -gt 0 ]; do case "$1" in --as) who="$2"; shift 2 ;; *) die "bad flag $1" ;; esac; done
  local id; id="$(read_pr "$n" | jq -r '.data.repository.pullRequest.id')"
  gh_as "$who" api graphql -F id="$id" -f query="$DEQUEUE_DOC" || true
}

compact() {
  jq -c --arg t "$(date -u +%FT%TZ)" '{t:$t} + (.data.repository.pullRequest | {n:.number,state,mergeable,mergeStateStatus,inQueue:.isInMergeQueue,
    entry:(.mergeQueueEntry | if . then {state,position,head:.headCommit.oid,base:.baseCommit.oid} else null end),
    queue:[.mergeQueue.entries.nodes[]? | {n:.pullRequest.number,state,position}]})'
}

cmd_wait() {
  local n="$1"; shift; local until=out max=1800
  while [ $# -gt 0 ]; do case "$1" in --until) until="$2"; shift 2 ;; --max) max="$2"; shift 2 ;; *) die "bad flag $1" ;; esac; done
  local start; start=$(date +%s)
  while :; do
    local pr; pr="$(read_pr "$n")"; compact <<<"$pr"
    case "$until" in
      merged) jq -e '.data.repository.pullRequest.state=="MERGED"' >/dev/null <<<"$pr" && return 0 ;;
      out) jq -e '.data.repository.pullRequest.isInMergeQueue|not' >/dev/null <<<"$pr" && return 0 ;;
      state=*) jq -e --arg s "${until#state=}" '.data.repository.pullRequest.mergeQueueEntry.state==$s' >/dev/null <<<"$pr" && return 0 ;;
    esac
    [ $(( $(date +%s) - start )) -ge "$max" ] && { echo "queue-lab: wait timed out" >&2; return 2; }
    sleep "$POLL_SECONDS"
  done
}

cmd_runs() {
  local limit=10; [ "${1:-}" = --limit ] && limit="$2"
  gh run list --repo "$REPO" --workflow queue-lab.yml --limit "$limit" \
    --json databaseId,event,headBranch,headSha,status,conclusion,createdAt,attempt | jq -c '.[]'
}

cmd_ruleset() { gh api "repos/$REPO/rulesets/$RULESET_ID" | jq '{id,name,updated_at,conditions,rules,bypass_actors}'; }

cmd_ruleset_set() {
  local cur; cur="$(gh api "repos/$REPO/rulesets/$RULESET_ID")"
  echo "before: $(jq -c '{updated_at, rules:[.rules[]|{type,parameters}]}' <<<"$cur")"
  local next; next="$(jq '{name,target,enforcement,conditions,bypass_actors,rules}' <<<"$cur")"
  local kv
  for kv in "$@"; do
    local k="${kv%%=*}" v="${kv#*=}"
    case "$k" in
      strict) next="$(jq --argjson v "$v" '(.rules[]|select(.type=="required_status_checks")|.parameters.strict_required_status_checks_policy)=$v' <<<"$next")" ;;
      bypass-app) next="$(jq --argjson v "$v" '.bypass_actors = (if $v == 0 then [] else [{actor_id:$v, actor_type:"Integration", bypass_mode:"always"}] end)' <<<"$next")" ;;
      require) next="$(jq --arg v "$v" '(.rules[]|select(.type=="required_status_checks")|.parameters.required_status_checks) = ($v|split(",")|map({context:., integration_id:15368}))' <<<"$next")" ;;
      grouping_strategy|merge_method)
        next="$(jq --arg k "$k" --arg v "$v" '(.rules[]|select(.type=="merge_queue")|.parameters[$k])=$v' <<<"$next")" ;;
      *) next="$(jq --arg k "$k" --argjson v "$v" '(.rules[]|select(.type=="merge_queue")|.parameters[$k])=$v' <<<"$next")" ;;
    esac
  done
  gh api -X PUT "repos/$REPO/rulesets/$RULESET_ID" --input - <<<"$next" | jq -c '"after: " + ({updated_at, rules:[.rules[]|{type,parameters}], bypass_actors}|tostring)' -r
}

ensure_workdir() {
  [ -n "$WORKDIR" ] || die "set QUEUE_LAB_WORKTREE to a checkout of $REPO"
  git -C "$WORKDIR" fetch -q origin "$BASE"
}

cmd_open() {
  local slug="$1"; shift; local prm=pass mgm=pass workflow=false commits=1 title="" behind=false selfq=""
  while [ $# -gt 0 ]; do case "$1" in
    --pr) prm="$2"; shift 2 ;; --mg) mgm="$2"; shift 2 ;; --workflow) workflow=true; shift ;;
    --commits) commits="$2"; shift 2 ;; --title) title="$2"; shift 2 ;; --behind) behind=true; shift ;; --self-enqueue) selfq=$'\nqueue-lab-self-enqueue: yes'; shift ;;
    *) die "bad flag $1" ;; esac; done
  ensure_workdir
  local branch="queue-lab-$slug" from="origin/$BASE"
  $behind && from="origin/$BASE~1"
  git -C "$WORKDIR" switch -q --discard-changes -C "$branch" "$from"
  local i
  for i in $(seq 1 "$commits"); do
    if $workflow; then
      mkdir -p "$WORKDIR/.github/workflows"
      printf 'name: Queue Lab Touch %s\non:\n  workflow_dispatch:\npermissions: {}\njobs:\n  noop:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo %s-%s\n' \
        "$slug" "$slug" "$i" > "$WORKDIR/.github/workflows/queue-lab-touch-$slug.yml"
      git -C "$WORKDIR" add ".github/workflows/queue-lab-touch-$slug.yml"
    else
      mkdir -p "$WORKDIR/.queue-lab/entries"
      echo "$slug commit $i $(date -u +%FT%TZ)" >> "$WORKDIR/.queue-lab/entries/$slug.txt"
      git -C "$WORKDIR" add ".queue-lab/entries/$slug.txt"
    fi
    git -C "$WORKDIR" commit -q --no-verify -m "test(queue-lab): $slug commit $i" -m "Body line for $slug commit $i."
  done
  git -C "$WORKDIR" push -q --no-verify -f -u origin "$branch" 2>/dev/null
  local body
  body="Synthetic merge-queue lab entry (goals/merge-queue-lab). Not for review; closed at closeout.

queue-lab-pr: $prm
queue-lab-mg: $mgm$selfq"
  local existing
  existing="$(gh pr list --repo "$REPO" --state open --head "$branch" --json number --jq '.[0].number // empty')"
  if [ -n "$existing" ]; then
    gh pr edit "$existing" --repo "$REPO" --body "$body" >/dev/null
    echo "$existing"
    return
  fi
  gh pr create --repo "$REPO" --base "$BASE" --head "$branch" --title "${title:-test(queue-lab): synthetic entry $slug}" --body "$body" \
    | sed -n 's|.*/pull/\([0-9][0-9]*\)$|\1|p'
}

cmd_cleanup() {
  local n
  for n in $(gh pr list --repo "$REPO" --state open --base "$BASE" --json number,headRefName --jq '.[] | select(.headRefName|startswith("queue-lab-")) | .number'); do
    gh pr close "$n" --repo "$REPO" --comment "Closed by the merge-queue lab cleanup." >/dev/null && echo "closed #$n"
  done
  local ref
  for ref in $(gh api "repos/$REPO/git/matching-refs/heads/queue-lab-" --jq '.[].ref'); do
    gh api -X DELETE "repos/$REPO/git/$ref" --silent && echo "deleted $ref"
  done
}

main() {
  local cmd="${1:-}"; [ -n "$cmd" ] || die "no command (see the header)"; shift
  case "$cmd" in
    open) cmd_open "$@" ;; read) cmd_read "$@" ;; enqueue) cmd_enqueue "$@" ;; dequeue) cmd_dequeue "$@" ;;
    wait) cmd_wait "$@" ;; runs) cmd_runs "$@" ;; ruleset) cmd_ruleset ;; ruleset-set) cmd_ruleset_set "$@" ;;
    as) gh_as "$@" ;; cleanup) cmd_cleanup ;; *) die "unknown command: $cmd" ;;
  esac
}

main "$@"

#!/usr/bin/env bash
# Machine-local dead-owner recovery for published Yeet pull requests.
set -euo pipefail

mode="watch"
if [[ "${1:-}" == "--once" ]]; then
  mode="once"
  shift
fi

projects_root="${BEEP_YEET_PROJECTS_ROOT:-${HOME}/YeeBois/projects}"
stale_seconds="${BEEP_YEET_LEASE_STALE_SECONDS:-240}"
poll_seconds="${BEEP_YEET_WATCH_INTERVAL_SECONDS:-30}"
fixer_root="${BEEP_YEET_FIXER_ROOT:-${projects_root}/.beep-fixers}"

log() { printf '[yeet-pr-watch] %s\n' "$*"; }
warn() { printf '[yeet-pr-watch] WARN: %s\n' "$*" >&2; }

parse_timestamp_epoch() {
  local timestamp="$1" normalized parsed
  normalized="$timestamp"
  case "$normalized" in
    *.*Z) normalized="${normalized%%.*}Z" ;;
  esac
  parsed="$(date -u -d "$normalized" +%s 2>/dev/null || true)"
  if [[ -n "$parsed" ]]; then
    printf '%s' "$parsed"
    return 0
  fi
  parsed="$(date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$normalized" +%s 2>/dev/null || true)"
  [[ -n "$parsed" ]] || return 1
  printf '%s' "$parsed"
}

proc_start() {
  local pid="$1" rest
  [[ -r "/proc/${pid}/stat" ]] || return 1
  rest="$(sed 's/^.*) //' "/proc/${pid}/stat" 2>/dev/null || true)"
  [[ -n "$rest" ]] || return 1
  # shellcheck disable=SC2086
  set -- $rest
  printf '%s' "${20:-}"
}

proc_state() {
  local pid="$1" rest
  [[ -r "/proc/${pid}/stat" ]] || return 1
  rest="$(sed 's/^.*) //' "/proc/${pid}/stat" 2>/dev/null || true)"
  # shellcheck disable=SC2086
  set -- $rest
  printf '%s' "${1:-}"
}

unacked_p0_rows() {
  local failures="$1" acks="$2" pr_number="$3" head_sha="$4" ack_ids='[]' ack_path ack_id
  if [[ -d "$acks" ]]; then
    for ack_path in "$acks"/*; do
      [[ -e "$ack_path" ]] || continue
      [[ -f "$ack_path" && ! -L "$ack_path" ]] || continue
      local waive_expiry expiry_epoch now_epoch
      waive_expiry="$(jq -r 'select(.resolution.kind == "waive") | .resolution.expiresAt // empty' "$ack_path" 2>/dev/null || true)"
      if [[ -n "$waive_expiry" ]]; then
        expiry_epoch="$(parse_timestamp_epoch "$waive_expiry" || true)"
        now_epoch="$(date +%s)"
        [[ -n "$expiry_epoch" && "$expiry_epoch" -gt "$now_epoch" ]] || continue
      fi
      ack_id="${ack_path##*/}"
      ack_ids="$(jq -cn --argjson ids "$ack_ids" --arg id "$ack_id" '$ids + [$id]')"
    done
  fi
  jq -Rsc --argjson acks "$ack_ids" --argjson pr "$pr_number" --arg head "$head_sha" '
    split("\n")
    | map(try fromjson catch empty)
    | map(. as $row | select(
        .schemaVersion == "yeet-inbox/v1"
        and .severity == "P0"
        and (.capsule.prNumber? == $pr)
        and (.capsule.headSha? == $head)
        and (($acks | index($row.id)) == null)
      ))
    | unique_by(.id)
  ' "$failures" 2>/dev/null || printf '[]'
}

make_prompt() {
  local rows="$1" prompt_path="$2" pr_number="$3" head_sha="$4"
  jq -r --arg pr "$pr_number" --arg head "$head_sha" '
    "Incident mode: take ownership of Yeet PR #\($pr) at \($head). Fix every accumulated P0 capsule, run the narrow proof, publish one repair wave, and acknowledge each row before doing unrelated work.\n" +
    (map("- \(.id): \(.capsule.lane // .capsule.shard // .kind) \(.capsule.link // "")") | join("\n"))
  ' <<<"$rows" >"$prompt_path"
}

spawn_resumed_owner() {
  local root="$1" session_id="$2" prompt_path="$3" log_path="$4" raw_session
  if [[ -n "${BEEP_YEET_RESUME_COMMAND:-}" ]]; then
    nohup setsid "$BEEP_YEET_RESUME_COMMAND" "$root" "$session_id" "$prompt_path" >"$log_path" 2>&1 &
    printf '%s' "$!"
    return 0
  fi
  case "$session_id" in
    codex:*)
      command -v codex >/dev/null 2>&1 || return 1
      raw_session="${session_id#codex:}"
      (cd "$root" && nohup setsid codex exec resume --all "$raw_session" - <"$prompt_path" >"$log_path" 2>&1 & printf '%s' "$!")
      ;;
    claude:*)
      command -v claude >/dev/null 2>&1 || return 1
      raw_session="${session_id#claude:}"
      (cd "$root" && nohup setsid claude --print --resume "$raw_session" --permission-mode acceptEdits <"$prompt_path" >"$log_path" 2>&1 & printf '%s' "$!")
      ;;
    *) return 1 ;;
  esac
}

spawn_fresh_fixer() {
  local root="$1" prompt_path="$2" log_path="$3" pr_number="$4" head_sha="$5" generation="$6" head_branch="$7"
  local agent suffix worktree branch
  if command -v codex >/dev/null 2>&1; then
    agent='codex'
  elif command -v claude >/dev/null 2>&1; then
    agent='claude'
  else
    warn "no Codex or Claude executable is available for PR #${pr_number}"
    return 1
  fi
  suffix="$(tr -cd 'A-Za-z0-9' <<<"$generation" | cut -c1-12)"
  worktree="${fixer_root}/pr-${pr_number}-${suffix}"
  branch="fixer/pr-${pr_number}-${suffix}"
  mkdir -p "$fixer_root"
  git -C "$root" worktree add --quiet -b "$branch" "$worktree" "$head_sha" || return 1
  case "$agent" in
    codex)
      nohup env BEEP_YEET_PUSH_REFSPEC="HEAD:refs/heads/${head_branch}" \
        setsid codex exec -C "$worktree" - <"$prompt_path" >"$log_path" 2>&1 &
      ;;
    claude)
      (
        cd "$worktree" &&
          nohup env BEEP_YEET_PUSH_REFSPEC="HEAD:refs/heads/${head_branch}" \
            setsid claude --print --permission-mode acceptEdits <"$prompt_path" >"$log_path" 2>&1
      ) &
      ;;
  esac
  printf '%s\t%s\t%s' "$!" "$worktree" "$branch"
}

terminate_spawned_fixer() {
  local root="$1" pid="$2" expected_start="${3:-}" worktree="${4:-}" branch="${5:-}"
  if [[ "$pid" =~ ^[1-9][0-9]*$ ]]; then
    local observed_start
    if [[ -z "$expected_start" ]]; then
      if kill -0 "$pid" 2>/dev/null; then
        warn "refusing to signal live process ${pid} without an exact leader generation"
        return 1
      fi
      observed_start=''
    else
      observed_start="$(proc_start "$pid" || true)"
    fi
    if [[ -n "$expected_start" && "$observed_start" != "$expected_start" ]]; then
      if kill -0 -- "-$pid" 2>/dev/null; then
        warn "refusing to signal process group ${pid}: leader generation no longer matches ${expected_start}"
        return 1
      fi
    elif [[ -n "$expected_start" ]]; then
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
      for _ in {1..20}; do
        kill -0 -- "-$pid" 2>/dev/null || break
        sleep 0.05
      done
      if kill -0 -- "-$pid" 2>/dev/null; then
        kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
        for _ in {1..20}; do
          kill -0 -- "-$pid" 2>/dev/null || break
          sleep 0.05
        done
      fi
      if kill -0 -- "-$pid" 2>/dev/null; then
        warn "process group ${pid} survived TERM and KILL; refusing ownership recovery"
        return 1
      fi
    fi
  fi
  if [[ -n "$worktree" && -d "$worktree" ]]; then
    git -C "$root" worktree remove --force "$worktree" >/dev/null 2>&1 || true
  fi
  if [[ -n "$branch" ]]; then
    git -C "$root" branch -D "$branch" >/dev/null 2>&1 || true
  fi
}

# Run each checkout scan in a subshell so the dynamically allocated flock file
# descriptor is scope-bound: every early return closes it before the next scan.
take_over_checkout() (
  local root="$1" inbox lease failures acks lock_fd generation status session_id owner_pid owner_start head_branch
  local observed_start observed_state refreshed_at refreshed_epoch now_epoch age head_sha pr_number rows
  local precheck_refreshed_at precheck_refreshed_epoch precheck_now_epoch precheck_age
  local prompt_path log_path spawned spawn_pid spawn_worktree='' spawn_branch='' takeover_mode next_generation next_start tmp
  local claim_generation claim_start claim_tmp original_lease
  local claim_group claim_group_start claim_worktree claim_branch recovered_tmp registered_tmp
  inbox="${root}/.beep/inbox"
  lease="${inbox}/pr-lease.json"
  failures="${inbox}/failures.ndjson"
  if [[ -f "${inbox}/active.ndjson" && -f "${inbox}/active-p0-safe-v2" ]]; then
    failures="${inbox}/active.ndjson"
  fi
  acks="${inbox}/acks"
  [[ -f "$lease" && ! -L "$lease" && -r "$lease" && -f "$failures" && ! -L "$failures" && -r "$failures" ]] || return 0

  # Most leases are live. Avoid waiting on their hook mutex merely to rediscover that fact; a
  # stale-looking lease is fully decoded and rechecked after the mutex is acquired below.
  precheck_refreshed_at="$(jq -r '.refreshedAt // empty' "$lease" 2>/dev/null || true)"
  precheck_refreshed_epoch="$(parse_timestamp_epoch "$precheck_refreshed_at" || true)"
  [[ "$precheck_refreshed_epoch" =~ ^[0-9]+$ ]] || return 0
  precheck_now_epoch="$(date +%s)"
  precheck_age="$((precheck_now_epoch - precheck_refreshed_epoch))"
  (( precheck_age >= stale_seconds )) || return 0

  mkdir -p "$inbox"
  exec {lock_fd}>"${inbox}/hook-mutex.lock"
  flock -w 1 "$lock_fd" || return 0

  generation="$(jq -r 'select(.schemaVersion == "yeet-pr-lease/v1") | .generationId // empty' "$lease" 2>/dev/null || true)"
  [[ -n "$generation" ]] || return 0
  status="$(jq -r '.status // "active"' "$lease" 2>/dev/null || true)"
  case "$status" in
    retired) return 0 ;;
    active|claiming) ;;
    *) return 0 ;;
  esac
  session_id="$(jq -r '.sessionId // empty' "$lease")"
  owner_pid="$(jq -r '.pid // empty' "$lease")"
  owner_start="$(jq -r '.procStart // empty' "$lease")"
  refreshed_at="$(jq -r '.refreshedAt // empty' "$lease")"
  head_sha="$(jq -r '.headSha // empty' "$lease")"
  pr_number="$(jq -r '.prNumber // empty' "$lease")"
  head_branch="$(jq -r '.branch // empty' "$lease")"
  [[ "$owner_pid" =~ ^[1-9][0-9]*$ && "$pr_number" =~ ^[1-9][0-9]*$ && -n "$head_sha" && -n "$head_branch" ]] || return 0

  refreshed_epoch="$(parse_timestamp_epoch "$refreshed_at" || true)"
  [[ "$refreshed_epoch" =~ ^[0-9]+$ ]] || return 0
  now_epoch="$(date +%s)"
  age="$((now_epoch - refreshed_epoch))"
  (( age >= stale_seconds )) || return 0

  observed_start="$(proc_start "$owner_pid" || true)"
  observed_state="$(proc_state "$owner_pid" || true)"
  if [[ -n "$observed_start" && "$observed_start" == "$owner_start" && "$observed_state" != 'T' && "$observed_state" != 't' ]]; then
    return 0
  fi

  if [[ "$status" == 'claiming' ]]; then
    claim_group="$(jq -r '.claimWorkloadProcessGroupId // empty' "$lease")"
    claim_group_start="$(jq -r '.claimWorkloadProcStart // empty' "$lease")"
    claim_worktree="$(jq -r '.claimWorkloadWorktree // empty' "$lease")"
    claim_branch="$(jq -r '.claimWorkloadBranch // empty' "$lease")"
    if [[ "${BEEP_YEET_WATCHER_DRY_RUN:-0}" == '1' ]]; then
      jq -cn --arg root "$root" --arg generation "$generation" --arg group "$claim_group" \
        '{schemaVersion:"yeet-pr-claim-recovery-plan/v1",checkoutRoot:$root,generationId:$generation,processGroupId:$group}'
      return 0
    fi
    if [[ ! "$claim_group" =~ ^[1-9][0-9]*$ || -z "$claim_group_start" ]]; then
      warn "claiming generation ${generation} has no exact spawned process group; recovery failed closed"
      return 0
    fi
    terminate_spawned_fixer "$root" "$claim_group" "$claim_group_start" "$claim_worktree" "$claim_branch" || return 0
    recovered_tmp="$(mktemp "${inbox}/.pr-lease-recovered.XXXXXX")"
    jq -c --arg expected "$generation" --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      'select(.generationId == $expected)
       | .status = "active"
       | .refreshedAt = $now
       | del(.claimWorkloadProcessGroupId, .claimWorkloadProcStart, .claimWorkloadWorktree, .claimWorkloadBranch)' \
      "$lease" >"$recovered_tmp"
    [[ -s "$recovered_tmp" ]] || { rm -f "$recovered_tmp"; return 0; }
    mv -f "$recovered_tmp" "$lease"
    status='active'
  fi

  rows="$(unacked_p0_rows "$failures" "$acks" "$pr_number" "$head_sha")"
  (( $(jq 'length' <<<"$rows") > 0 )) || return 0

  if [[ "${BEEP_YEET_WATCHER_DRY_RUN:-0}" == '1' ]]; then
    jq -cn --arg root "$root" --arg generation "$generation" --argjson rows "$rows" \
      '{schemaVersion:"yeet-pr-takeover-plan/v1",checkoutRoot:$root,generationId:$generation,capsuleIds:($rows|map(.id))}'
    return 0
  fi

  original_lease="$(mktemp "${inbox}/.pr-lease-original.XXXXXX")"
  cp -- "$lease" "$original_lease"
  claim_generation="$(cat /proc/sys/kernel/random/uuid)"
  claim_start="$(proc_start "$$" || true)"
  [[ -n "$claim_start" ]] || {
    rm -f "$original_lease"
    return 0
  }
  claim_tmp="$(mktemp "${inbox}/.pr-lease-claim.XXXXXX")"
  jq -c \
    --arg expected "$generation" --arg claim "$claim_generation" --argjson pid "$$" \
    --arg proc_start "$claim_start" --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    'select(.generationId == $expected)
     | .generationId = $claim
     | .sessionId = ("watcher:" + $claim)
     | .pid = $pid
     | .procStart = $proc_start
     | .refreshedAt = $now
     | .status = "claiming"
     | .takeoverOf = $expected
     | .takeoverReason = "stale-unacked-dead-or-frozen"
     | del(.takeoverMode, .takeoverWorktree, .claimWorkloadProcessGroupId, .claimWorkloadProcStart, .claimWorkloadWorktree, .claimWorkloadBranch)' \
    "$lease" >"$claim_tmp"
  if [[ ! -s "$claim_tmp" ]]; then
    rm -f "$claim_tmp" "$original_lease"
    return 0
  fi
  mv -f "$claim_tmp" "$lease"

  prompt_path="${inbox}/takeover-${generation}.prompt"
  log_path="${inbox}/takeover-${generation}.log"
  make_prompt "$rows" "$prompt_path" "$pr_number" "$head_sha"
  spawned="$(spawn_resumed_owner "$root" "$session_id" "$prompt_path" "$log_path" || true)"
  takeover_mode='resume-owner'
  spawn_pid="${spawned%%$'\t'*}"
  if [[ ! "$spawn_pid" =~ ^[1-9][0-9]*$ ]] || ! kill -0 "$spawn_pid" 2>/dev/null; then
    spawned="$(spawn_fresh_fixer "$root" "$prompt_path" "$log_path" "$pr_number" "$head_sha" "$generation" "$head_branch" || true)"
    takeover_mode='fresh-worktree'
    spawn_pid="${spawned%%$'\t'*}"
    if [[ "$spawned" == *$'\t'* ]]; then
      spawn_worktree="${spawned#*$'\t'}"
      spawn_branch="${spawn_worktree#*$'\t'}"
      spawn_worktree="${spawn_worktree%%$'\t'*}"
    fi
  fi
  [[ "$spawn_pid" =~ ^[1-9][0-9]*$ ]] || {
    warn "unable to resume or spawn a fixer for PR #${pr_number} in ${root}"
    mv -f "$original_lease" "$lease"
    return 0
  }

  next_start=''
  for _ in {1..20}; do
    next_start="$(proc_start "$spawn_pid" || true)"
    [[ -n "$next_start" ]] && break
    sleep 0.05
  done
  if [[ -z "$next_start" ]]; then
    warn "spawned fixer ${spawn_pid} exited before exact process registration; restoring generation ${generation}"
    if terminate_spawned_fixer "$root" "$spawn_pid" "" "$spawn_worktree" "$spawn_branch"; then
      mv -f "$original_lease" "$lease"
    else
      rm -f "$original_lease"
    fi
    return 0
  fi
  registered_tmp="$(mktemp "${inbox}/.pr-lease-registered.XXXXXX")"
  jq -c \
    --arg expected "$claim_generation" --argjson group "$spawn_pid" --arg proc_start "$next_start" \
    --arg worktree "$spawn_worktree" --arg branch "$spawn_branch" \
    'select(.generationId == $expected and .status == "claiming")
     | .claimWorkloadProcessGroupId = $group
     | .claimWorkloadProcStart = $proc_start
     | if $worktree == "" then del(.claimWorkloadWorktree) else .claimWorkloadWorktree = $worktree end
     | if $branch == "" then del(.claimWorkloadBranch) else .claimWorkloadBranch = $branch end' \
    "$lease" >"$registered_tmp"
  if [[ ! -s "$registered_tmp" ]]; then
    rm -f "$registered_tmp"
    if terminate_spawned_fixer "$root" "$spawn_pid" "$next_start" "$spawn_worktree" "$spawn_branch"; then
      mv -f "$original_lease" "$lease"
    else
      rm -f "$original_lease"
    fi
    return 0
  fi
  mv -f "$registered_tmp" "$lease"
  next_generation="$(cat /proc/sys/kernel/random/uuid)"
  tmp="$(mktemp "${inbox}/.pr-lease-watch.XXXXXX")"
  jq -c \
    --arg expected "$claim_generation" --arg next "$next_generation" --arg mode "$takeover_mode" \
    --arg session "${session_id:-watcher:${next_generation}}" --argjson pid "$spawn_pid" \
    --arg proc_start "$next_start" --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg worktree "$spawn_worktree" \
    'select(.generationId == $expected)
     | .generationId = $next
     | .sessionId = $session
     | .pid = $pid
     | .procStart = $proc_start
     | .refreshedAt = $now
     | .status = "active"
     | .takeoverOf = (.takeoverOf // $expected)
     | .takeoverReason = "stale-unacked-dead-or-frozen"
     | .takeoverMode = $mode
     | if $worktree == "" then del(.takeoverWorktree) else .takeoverWorktree = $worktree end
     | del(.claimWorkloadProcessGroupId, .claimWorkloadProcStart, .claimWorkloadWorktree, .claimWorkloadBranch)' \
    "$lease" >"$tmp"
  if [[ -s "$tmp" ]]; then
    mv -f "$tmp" "$lease"
    rm -f "$original_lease"
    jq -cn --arg generation "$next_generation" --arg mode "$takeover_mode" --argjson pid "$spawn_pid" \
      --arg root "$root" --argjson rows "$rows" \
      '{schemaVersion:"yeet-pr-takeover/v1",generationId:$generation,mode:$mode,pid:$pid,checkoutRoot:$root,capsuleIds:($rows|map(.id))}' \
      >"${inbox}/pr-takeover.json"
    log "PR #${pr_number}: ${takeover_mode} generation ${generation} -> ${next_generation}"
  else
    rm -f "$tmp"
    if terminate_spawned_fixer "$root" "$spawn_pid" "$next_start" "$spawn_worktree" "$spawn_branch"; then
      mv -f "$original_lease" "$lease"
    else
      rm -f "$original_lease"
    fi
  fi
)

scan_once() {
  local roots=() lease_paths=() root lease_path restore_nullglob=0
  if (( $# > 0 )); then
    roots=("$@")
  elif [[ -n "${BEEP_YEET_WATCH_ROOTS:-}" ]]; then
    IFS=: read -r -a roots <<<"$BEEP_YEET_WATCH_ROOTS"
  elif [[ -d "$projects_root" ]]; then
    shopt -q nullglob || restore_nullglob=1
    shopt -s nullglob
    lease_paths=(
      "$projects_root"/*/.beep/inbox/pr-lease.json
      "$projects_root"/*-worktrees/*/.beep/inbox/pr-lease.json
    )
    (( restore_nullglob == 0 )) || shopt -u nullglob
    for lease_path in "${lease_paths[@]}"; do
      root="${lease_path%/.beep/inbox/pr-lease.json}"
      roots+=("$root")
    done
  fi
  for root in "${roots[@]}"; do
    [[ -e "${root}/.git" ]] || continue
    take_over_checkout "$root"
  done
}

while :; do
  scan_once "$@"
  [[ "$mode" == 'once' ]] && exit 0
  sleep "$poll_seconds"
done

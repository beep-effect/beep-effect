beep_otel_attrs() {
  local top branch cls="other" slug=""
  top=$(git rev-parse --show-toplevel 2>/dev/null) || top="$PWD"
  branch=$(git branch --show-current 2>/dev/null)
  case "$branch" in
    feat/*|feat-*) cls="feat" ;;
    fix/*|fix-*) cls="fix" ;;
    goals/*) cls="goals"; slug="${branch#goals/}" ;;
    chore/*|chore-*) cls="chore" ;;
    explore/*) cls="explore" ;;
  esac
  print -r -- "beep.repo=${top:t},beep.branch=${branch:-none},beep.task_class=${cls},beep.goal_slug=${slug},beep.schema_version=1,host.name=${HOST}"
}

claude() {
  OTEL_RESOURCE_ATTRIBUTES="$(beep_otel_attrs 2>/dev/null)" command claude "$@"
}

_claude_proxy() {
  local token_file="$HOME/.cli-proxy-api/client-token"
  local token_mode token

  if [[ ! -r "$token_file" ]]; then
    print -u2 -- "claude proxy token is unavailable: $token_file"
    return 1
  fi
  token_mode="$(command stat -c '%a' -- "$token_file" 2>/dev/null)" || {
    print -u2 -- "cannot inspect claude proxy token permissions"
    return 1
  }
  if [[ "$token_mode" != 600 ]]; then
    print -u2 -- "unsafe claude proxy token permissions: expected 600"
    return 1
  fi
  IFS= read -r token < "$token_file"
  if [[ -z "$token" ]]; then
    print -u2 -- "claude proxy token is empty"
    return 1
  fi

  ANTHROPIC_BASE_URL=http://127.0.0.1:8317 \
  ANTHROPIC_AUTH_TOKEN="$token" \
  "$@"
}

claudem() {
  ANTHROPIC_DEFAULT_HAIKU_MODEL='gpt-6-luna' \
  _claude_proxy claude --model 'muse-wonder-1.0(medium)' --settings '{"effortLevel":"medium"}' "$@"
}

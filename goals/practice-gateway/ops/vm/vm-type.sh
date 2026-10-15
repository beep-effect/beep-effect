#!/usr/bin/env bash
# Type ASCII text into the proof VM through virsh send-key (no guest agent
# needed). Used only to diagnose a VM whose SSH hook is not up yet.
#   vm-type.sh 'text'            type text
#   vm-type.sh --key KEY_ENTER   send one key (or a chord: KEY_LEFTMETA KEY_R)
set -euo pipefail
NAME="${VM_NAME:-practice-gateway-win11}"
send() { virsh -c qemu:///session send-key "$NAME" "$@" >/dev/null; }

if [[ "${1:-}" == "--key" ]]; then
  shift
  send "$@"
  exit 0
fi

text="${1:?usage: vm-type.sh 'text' | --key KEY...}"
for ((i = 0; i < ${#text}; i++)); do
  c="${text:i:1}"
  case "$c" in
    [a-z]) send "KEY_${c^^}" ;;
    [A-Z]) send KEY_LEFTSHIFT "KEY_$c" ;;
    [0-9]) send "KEY_$c" ;;
    ' ') send KEY_SPACE ;;
    '-') send KEY_MINUS ;;
    '_') send KEY_LEFTSHIFT KEY_MINUS ;;
    '.') send KEY_DOT ;;
    ',') send KEY_COMMA ;;
    ':') send KEY_LEFTSHIFT KEY_SEMICOLON ;;
    ';') send KEY_SEMICOLON ;;
    '\') send KEY_BACKSLASH ;;
    '/') send KEY_SLASH ;;
    '|') send KEY_LEFTSHIFT KEY_BACKSLASH ;;
    "'") send KEY_APOSTROPHE ;;
    '"') send KEY_LEFTSHIFT KEY_APOSTROPHE ;;
    '=') send KEY_EQUAL ;;
    '+') send KEY_LEFTSHIFT KEY_EQUAL ;;
    '(') send KEY_LEFTSHIFT KEY_9 ;;
    ')') send KEY_LEFTSHIFT KEY_0 ;;
    '$') send KEY_LEFTSHIFT KEY_4 ;;
    '*') send KEY_LEFTSHIFT KEY_8 ;;
    '>') send KEY_LEFTSHIFT KEY_DOT ;;
    '<') send KEY_LEFTSHIFT KEY_COMMA ;;
    '{') send KEY_LEFTSHIFT KEY_LEFTBRACE ;;
    '}') send KEY_LEFTSHIFT KEY_RIGHTBRACE ;;
    '[') send KEY_LEFTBRACE ;;
    ']') send KEY_RIGHTBRACE ;;
    '~') send KEY_LEFTSHIFT KEY_GRAVE ;;
    '?') send KEY_LEFTSHIFT KEY_SLASH ;;
    '#') send KEY_LEFTSHIFT KEY_3 ;;
    '&') send KEY_LEFTSHIFT KEY_7 ;;
    '%') send KEY_LEFTSHIFT KEY_5 ;;
    '@') send KEY_LEFTSHIFT KEY_2 ;;
    '!') send KEY_LEFTSHIFT KEY_1 ;;
    *) echo "vm-type: unsupported character '$c'" >&2; exit 1 ;;
  esac
done

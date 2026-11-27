#!/usr/bin/env bash
# PostToolUse advisory: hints a just-written effect/Schema field whose name
# reads as a duration, instant, byte size, URL, host, port or version while
# its schema decodes to a primitive. Always exits 0; silent without a hint.
# Logic: packages/tooling/tool/cli/src/commands/SchemaIdioms/SchemaIdioms.hook.ts
set -u

payload="$(cat 2>/dev/null || true)"

if command -v jq >/dev/null 2>&1; then
  file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
else
  file="$(printf '%s' "$payload" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')"
fi

case "$file" in
  *.d.ts | *.gen.ts | *.gen.tsx | *.test.ts | *.test.tsx | *.spec.ts | *.spec.tsx) exit 0 ;;
  */test/* | */tests/* | */__tests__/* | */_generated/*) exit 0 ;;
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || exit 0
entry="$here/../../packages/tooling/tool/cli/src/commands/SchemaIdioms/SchemaIdioms.hook.entry.ts"
[ -f "$entry" ] || exit 0
command -v bun >/dev/null 2>&1 || exit 0

# Keyed per user and per checkout like law-pulse.sh; the entry keys each
# remembered hint by session, file, field and kind inside it.
export BEEP_SCHEMA_IDIOM_STATE="${TMPDIR:-/tmp}/beep-schema-idiom-$(id -u)-$(printf '%s' "$PWD" | cksum | cut -d' ' -f1).json"

printf '%s' "$payload" | bun "$entry" 2>/dev/null || true
exit 0

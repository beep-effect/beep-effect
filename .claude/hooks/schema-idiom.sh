#!/usr/bin/env bash
# PostToolUse advisory: hints a just-written effect/Schema field whose name
# reads as a duration, instant, byte size, URL, host, port or version while
# its schema decodes to a primitive. Always exits 0; silent without a hint.
# Logic and path exclusions: packages/tooling/tool/cli/src/commands/SchemaIdioms/SchemaIdioms.hook.ts
set -u

payload="$(cat 2>/dev/null || true)"

if command -v jq >/dev/null 2>&1; then
  file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
else
  file="$(printf '%s' "$payload" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')"
fi

# Extension gate only, so Bun never starts for other files; the hook program
# applies the declaration, generated and test exclusions itself.
case "$file" in
  *.ts | *.tsx | *.mts | *.cts) ;;
  *) exit 0 ;;
esac

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || exit 0
entry="$here/../../packages/tooling/tool/cli/src/commands/SchemaIdioms/SchemaIdioms.hook.entry.ts"
[ -f "$entry" ] || exit 0
command -v bun >/dev/null 2>&1 || exit 0

# State lives in an owner-only directory, one file per checkout; it holds
# only digests of the remembered (session, file, field, kind) hints.
state_dir="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/beep-schema-idiom-$(id -u)"
(umask 077 && mkdir -p "$state_dir") 2>/dev/null || exit 0
{ [ -d "$state_dir" ] && [ ! -L "$state_dir" ] && [ -O "$state_dir" ]; } || exit 0
chmod 700 "$state_dir" 2>/dev/null || exit 0
export BEEP_SCHEMA_IDIOM_STATE="${BEEP_SCHEMA_IDIOM_STATE:-$state_dir/$(printf '%s' "$PWD" | cksum | cut -d' ' -f1).json}"
# A symlinked state file is refused so its target is never overwritten.
[ -L "$BEEP_SCHEMA_IDIOM_STATE" ] && exit 0

printf '%s' "$payload" | bun "$entry" 2>/dev/null || true
exit 0

#!/usr/bin/env bash
# Re-lay the BEEP_SECRETS 1Password item into prefix sections.
#   scripts/onepassword/beep-secrets-layout.sh           dry run: prints section/label layout only
#   scripts/onepassword/beep-secrets-layout.sh --apply   writes the item (needs a write-capable op)
# The agent service account is read-only on the vault; run --apply through op-human.
# Runbook: docs/runbooks/onepassword-beep-secrets-layout.md
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
vault="${BEEP_SECRETS_VAULT:-BEEP_SECRETS}"
item="${BEEP_SECRETS_ITEM:-BEEP_SECRETS}"
op_bin="${OP_BIN:-op}"
jq_file="$here/beep-secrets-layout.jq"

json="$("$op_bin" item get "$item" --vault "$vault" --format json)"
laid="$(printf '%s' "$json" | jq -c -f "$jq_file")"

before="$(printf '%s' "$json" | jq -c '.fields | map(del(.section)) | sort_by(.id)' | sha256sum)"
after="$(printf '%s' "$laid" | jq -c '.fields | map(del(.section)) | sort_by(.id)' | sha256sum)"
if [ "$before" != "$after" ]; then
  echo "refusing: layout changed field ids, labels, types or values" >&2
  exit 1
fi

if [ "${1:-}" != "--apply" ]; then
  printf '%s' "$laid" | jq -r '.fields[] | "\(.section.label // "(top)")\t\(.label)"' | column -t -s $'\t'
  printf '%s' "$laid" | jq -r '"\(.fields | length) fields, sections: \(.sections | map(.label) | join(" "))"'
  exit 0
fi

printf '%s' "$laid" | "$op_bin" item edit "$item" --vault "$vault" --format json \
  | jq -r '"written version \(.version): \(.fields | length) fields, sections: \(.sections | map(.label) | join(" "))"'

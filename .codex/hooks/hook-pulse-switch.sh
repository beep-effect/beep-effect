#!/usr/bin/env bash
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${here}/../../.claude/hooks/hook-pulse-switch.sh" "$@"

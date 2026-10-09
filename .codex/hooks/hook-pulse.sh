#!/usr/bin/env bash
# Codex uses the canonical writer, including stamps, surfaces, and refusals.
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BEEP_HOOK_PULSE_AGENT_KIND=codex-cli exec "${here}/../../.claude/hooks/hook-pulse.sh"

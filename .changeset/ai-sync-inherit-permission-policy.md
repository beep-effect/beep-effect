---
"@beep/ai-sync": patch
---

Codex repo safety policy now requires `approval_policy` and `sandbox_mode` to be omitted from
`.codex/config.toml` so sessions inherit the user's `~/.codex/config.toml`, instead of requiring
committed `never`/`danger-full-access` pins.

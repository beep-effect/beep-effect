---
"@beep/repo-cli": patch
---

Retire the basic-memory + codegraph bootstrap: `scripts/setup-agent-memory.sh`
is replaced by `scripts/setup-effect-ref.sh` (Effect reference checkout only),
with the CLI test following the rename.

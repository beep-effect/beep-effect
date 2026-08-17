---
{}
---

No release: untrack the `.repos/effect` vendored snapshot. The Effect v4
reference is now a gitignored machine-local symlink to a shared
Effect-TS/effect clone provisioned by `scripts/setup-agent-memory.sh`
(override via `BEEP_EFFECT_CHECKOUT`). Live doctrine surfaces cite
`.repos/effect` instead of the stale `.repos/effect-v4` path.

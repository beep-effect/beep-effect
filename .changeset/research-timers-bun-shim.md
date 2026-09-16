---
"@beep/repo-cli": patch
---

Resolve the Bun that `beep research install-timers` writes into the daily and
weekly units through the mise shim first, then a standalone `$HOME/.bun`
install, and only then the installer's own executable, so a `mise.toml` bump
no longer leaves the timers running a pruned Bun version. The `ExecStart` path
is quoted for systemd and `--bun-path` pins an explicit executable. The Bun
candidates, the unit-path rule, and the resolver move to a shared internal
module that `beep graft deep install-timer` now uses too, so both timer
installers resolve the same way.

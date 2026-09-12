---
"@beep/repo-cli": patch
---

Resolve the Bun that `beep graft deep install-timer` writes into the nightly
unit through the mise shim first, then a standalone `$HOME/.bun` install, and
only then the installer's own executable, so a `mise.toml` bump no longer
leaves the timer running a pruned Bun version. `--bun-path` pins an explicit
executable.

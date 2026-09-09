---
"@beep/repo-cli": patch
---

Stop baking and restoring the runner dependency-cache archive after timed EC2
probes showed its verification and extraction cost more than a fresh frozen
install. Preserve the baked Bun toolchain's integrity and freshness checks.

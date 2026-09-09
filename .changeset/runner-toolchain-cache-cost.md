---
"@beep/repo-cli": patch
"@beep/infra": patch
---

Stop baking and restoring the runner dependency-cache archive after timed EC2
probes showed its verification and extraction cost more than a fresh frozen
install. Preserve the baked Bun toolchain's integrity and freshness checks.
Pin the validated lean Bun 1.4.2 image for the attended production rollout.

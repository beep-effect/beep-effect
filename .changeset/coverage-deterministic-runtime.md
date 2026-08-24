---
"@beep/repo-cli": patch
---

Pin the hosted pull-request Turbo cache posture into the coverage runtime so local, PR, and
main-push coverage measure the same arms of `internal/cli/EnvConfig.ts`: `coverageEnvironment()`
spreads the new `turboCachePullRequestPosture` (credentials scrubbed, `TURBO_CACHE=local:rw`),
the ambient Turbo reader becomes the pure `readTurboCacheEnvironment(environment)` with every
classification arm unit-tested, and `canUseTurboCacheSecretSession` gains stubbed-spawner tests
for its CI, `op whoami`, and spawn-failure arms. Records ship-velocity B9 and the 150-run
evidence sweep behind it.

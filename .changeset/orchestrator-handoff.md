---
"@beep/repo-cli": minor
---

Add the orchestrator hand-off surfaces: `session note --role orchestrator|member` with the holder
printed first by `session open`, the `session register add|list` register of coordinated units
(kind, address, owns, state, waiting-on-orchestrator, last contact, orphan plan) under the
workstation state root, and `yeet merge-gate <pr> <sha>`, which re-verifies a pull request at a
pinned head (required contexts, attributed `--tolerate` for non-required reds, the 20-minute review
window, a fail-closed thread re-read) and squash-merges it as `<title> (#n)`.

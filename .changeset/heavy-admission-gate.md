---
"@beep/repo-cli": patch
---

Gate the heavy CI matrix behind admission. `check.yml` gains a `Heavy Admission`
job that runs the new `bun run beep ci admission` (verdict `run` on the
`ready-for-heavy` label, main push, or merge group; `skip-satisfied` for
docs-only diffs; `hold` otherwise) and passes it to `heavy.yml` as `admitted`.
Yeet's settle rule adds the non-terminal `heavy-not-admitted` reason with a
`gated` census bucket that never spends `--settle-timeout`, and the remote
status now carries the PR `labels` the monitor reads each poll.

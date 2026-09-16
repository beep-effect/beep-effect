---
"@beep/repo-cli": patch
---

`worktree remove --archive` now records why a pruned upstream was safe to retire. The pruned
upstream state carries a verdict — `ancestor-of-base` (the tip is already on the remote default
branch), `merged-pull-request` (GitHub reports a merged pull request whose head is exactly this tip,
via `gh pr list`), or `unverified` (nothing proved the tip pushed, so the commits stay preserved) —
and the residue `manifest.json` gains an `upstream` field with the branch-upstream state the
residue decision was made under. The removal receipt names the verdict on its pruned-upstream line.
`WorktreeRemovalServiceLayer` exposes the removal service with the merged-pull-request probe left
as a requirement so tests can substitute `WorktreeMergedPullRequestProbe`; `WorktreeRemovalServiceLive`
is unchanged for command wiring.

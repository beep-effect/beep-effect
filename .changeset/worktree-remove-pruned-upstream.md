---
"@beep/repo-cli": patch
---

`worktree remove --archive` now survives a pruned upstream. When the branch's configured upstream no
longer resolves (GitHub deleted the head branch at merge and a later `git fetch --prune` dropped
`refs/remotes/origin/<branch>`), the unpushed-commit probe judges `HEAD` against
`origin/<default>..HEAD` (default branch from `refs/remotes/origin/HEAD`, else `main`) instead of
failing the `inspect-upstream` preservation step. The removal receipt carries the new
`WorktreeUnpushedInspection` (`unpushed`, `baseRange`, and the upstream as `unset` / `live` /
`pruned`) and names the fallback range when the upstream was pruned; `worktree doctor` no longer
errors on such lanes either.

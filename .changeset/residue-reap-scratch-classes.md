---
"@beep/repo-cli": patch
---

`beep quality residue-reap` now also reaps the following, and `--fleet` sweeps every clone and
worktree sharing this origin:

- interrupted merged-preview worktrees whose owner pid is gone, torn down with
  `git worktree remove --force`;
- `.turbo/runs` summaries older than a day;
- the shared Turbo cache, aged out after 14 days and then trimmed oldest-written first to a 20 GiB
  budget;
- qualification dependency views, keeping the newest two plus every view a receipt cites.

The JSON report is now `residue-reap/v2`. `turbo`, `turbo-qualification`, `codex-security`,
`effect-vitest-canon`, and `boolean-creep` are never reaped whole as disposable beep cache.
Local `docgen` passes `--summarize` to Turbo only under CI.

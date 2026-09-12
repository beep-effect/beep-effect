---
"@beep/repo-cli": patch
---

Bake the post-merge closeout so agents run it without an operator:

- `beep yeet sweep --retire` archive-retires the linked worktree it runs in
  (a Claude Code `.claude/worktrees/<name>` lane or a sibling `-worktrees`
  lane) once its pull request is MERGED, deletes the branch, and then sweeps
  the owning clone instead of the checkout it was started in.
- `beep worktree remove <name>` also resolves lanes under the clone's
  `.claude/worktrees/`.
- `beep research install-timers` takes `--repo-root <clone>` (and refuses a
  root that does not exist) and `--refresh`; `beep graft deep install-timer`
  takes `--refresh`. A refresh re-renders the installed units from what they
  recorded with a fresh Bun resolution, reading the units back through a
  shared systemd unit reader.
- The `StepExec` examples import the resolvable `@beep/repo-cli/test/Process`
  kit instead of the blocked internal subpath.

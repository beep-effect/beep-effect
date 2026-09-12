---
"@beep/repo-cli": patch
---

Bake the post-merge closeout so agents run it without an operator:

- `beep yeet sweep --retire [--lane <path>]` archive-retires the linked
  worktree it runs in, or the one `--lane` names (a Claude Code
  `.claude/worktrees/<name>` lane or a sibling `-worktrees` lane), once its
  pull request is MERGED, deletes the branch, and then sweeps the owning clone
  instead of the checkout it was started in. The archive fence exempts the
  invoking session's own ancestry and refuses any other holder; `--json`
  prints one schema-owned document; `--branch` is refused with `--retire`.
- `beep worktree remove <name>` also resolves lanes under the clone's
  `.claude/worktrees/`, against registered worktrees only, sibling first, and
  refuses a name registered in both places.
- `research install-timers --repo-root` must name an existing directory.
- `beep research install-timers` takes `--repo-root <clone>` (and refuses a
  root that does not exist) and `--refresh`; `beep graft deep install-timer`
  takes `--refresh`. A refresh re-renders the installed units from what they
  recorded with a fresh Bun resolution, reading the units back through a
  shared systemd unit reader.
- The `StepExec` examples import the resolvable `@beep/repo-cli/test/Process`
  kit instead of the blocked internal subpath.

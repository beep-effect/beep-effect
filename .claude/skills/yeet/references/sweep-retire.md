# Sweep and retire a lane

Read when `yeet sweep --retire` refuses, names a holder, or you retire a lane from outside it. Part of the yeet skill.

- From inside a linked worktree (a Claude Code `.claude/worktrees/<name>` lane
  or a sibling `-worktrees` lane) the sweep above only fetch-prunes, because
  `main` lives in the owning clone and the merged branch is checked out right
  here. `--retire` is the post-merge closeout for that case: it archive-retires
  this worktree (dirty files and unpushed commits preserved under the residue
  root), deletes the branch, then sweeps the owning clone. A clone parked on a
  branch other than `main` keeps that checkout: the sweep updates refs only,
  because a `git switch` or `bun install` there could land under another
  session's running verify (receipt 2026-09-28). It refuses until the PR is
  MERGED and heads this branch, so running it early is safe:

```bash
bun run beep yeet sweep --retire --plan
```

```bash
CLONE="$(git rev-parse --path-format=absolute --git-common-dir)/.." && bun run beep yeet sweep --retire && cd "$CLONE"
```

  Run it from inside the lane: `bun run beep` resolves the CLI from the
  checkout it runs in, and the owning clone's `main` may still be behind the
  merge and reject `--retire` as an unknown flag. The command steps its own
  process out of the lane before removal; the trailing `cd` moves your shell
  to the swept clone. The fence exempts the invoking session's own ancestry
  and, when Claude Code names the session through `CLAUDE_PID`, everything
  that session spawned into the lane (MCP servers, tool shells, background
  jobs), so a desktop session retires its own lane. Run from inside the
  lane, an idle Claude Desktop Terminal panel shell (the app starts one in
  the session folder even when the panel is never opened) that stays quiet
  until the deletion is left in place and the lane removed under it; the
  report says to `cd ~` in that tab. Any other holder (a panel shell running
  a command, any panel shell under `--lane`, an editor, another session)
  still refuses it and is named in the error: `cd ~` in it (closing a panel
  tab starts a new shell in the lane) or close it, then rerun. Outside Claude
  Code, redirect the output to a file rather than piping it: the other stages
  of a shell pipeline stand in the lane and count as holders. `--lane <path>`
  retires a lane from elsewhere: the owning clone, or any sibling lane of
  the same clone (a later session's lane at a current checkout). When only
  the clone is at hand and its checkout predates `--retire`, run the lane's
  own CLI from the clone:

```bash
cd <clone> && bun run <lane>/packages/tooling/tool/cli/src/bin.ts -- yeet sweep --retire --lane <lane>
```

  `--json` prints one document; `--branch` is refused with `--retire`. Both
  the plan and the report name every goal packet the retired branch touched
  whose lifecycle is still `active` and whose manifest carries no
  `statusNote` or `blockedBy` saying why it stays open (`[yeet] packet still
  active after merge: goals/<slug> …`, `activePackets` in JSON): that packet's
  lifecycle flip belonged in the merged PR, so open the closeout PR before
  moving on. `bun run beep goals doctor` applies the same deferral and keeps
  flagging the packet as `active-after-merge` while a merge commit cites the
  slug and nobody touches it.

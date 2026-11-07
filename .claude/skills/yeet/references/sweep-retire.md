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
  MERGED and heads this branch, so running it early is safe. A lane whose
  branch never headed a PR (a scratch checkout, a stacked parent, a branch
  pushed straight to main) retires once `origin/main` already contains its
  tip and its tree is clean; the plan prints the verdict as `gate:` or
  `blocked:` (`pr-merged`, `pr-less-on-main`, or `refused` with the reason in
  the JSON documents):

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
  report says to `cd ~` in that tab. A process whose only hold is an inotify
  watch on the lane (an editor watching the whole clone, such as WebStorm's
  `fsnotifier`) never refuses: a watch cannot write, so the lane is removed
  under it and the report ends with a `warning:` line naming it. The fence's
  own rename makes such a watcher walk the renamed tree again, holding
  directories open as it goes; the fence rescans every 250 ms until the walk
  ends and refuses only if it outlasts 40 scans (about ten seconds), naming
  the watcher `still walking the tree`. Excluding the folder that holds the
  `.claude/worktrees/<name>` lanes from the editor's project stops both. Any
  other holder (a panel shell running a
  command, any panel shell under `--lane`, an editor with a file in the lane
  open or standing in it, another session) still refuses it and is named in
  the error: `cd ~` in it (closing a panel
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

  `--json` prints one document (`yeet-retire-sweep-plan/v2` with `--plan`,
  `yeet-retire-sweep-report/v2` otherwise, each carrying the `verdict`);
  `--branch` is refused with `--retire`. `bun run beep worktree remove <name>
  --archive --delete-branch` runs behind the same fence and the same
  invoker/session exemption, so a desktop session can remove its own lane
  that way too. Both
  the plan and the report name every goal packet the retired branch touched
  whose lifecycle is still `active` and whose manifest carries no
  `statusNote` or `blockedBy` saying why it stays open (`[yeet] packet still
  active after merge: goals/<slug> …`, `activePackets` in JSON): that packet's
  lifecycle flip belonged in the merged PR, so open the closeout PR before
  moving on. `bun run beep goals doctor` applies the same deferral and keeps
  flagging the packet as `active-after-merge` while a merge commit cites the
  slug and nobody touches it.

## Post-merge closeout law (moved from `AGENTS.md`)

Post-merge closeout is the agent's job. Once the PR is MERGED, retire the lane
and sweep its clone from inside the lane as the last command of the session:
`CLONE="$(git rev-parse --path-format=absolute --git-common-dir)/.." && bun run beep yeet sweep --retire && cd "$CLONE"`.
First read [lane retirement](standards/git-worktrees.md) and the
[closeout runbook](docs/runbooks/systemd-timers.md#retiring-the-lane-that-ran-the-closeout)
for archive fences, process holders, stale-clone fallback and `--lane` handling.
The command must preserve other live checkouts; never bypass a holder refusal.
If the merged change touched a systemd unit renderer, refresh the affected
research/refs timers from the swept clone using the runbook's `--refresh`
forms. Installed units are snapshots; do not leave them stale or hand this
authorized closeout work back to the operator.

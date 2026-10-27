# Vitest lane retirement, final pass — 2026-10-27

Closes #1877. Finishes what the 2026-10-23 result ([`2026-10-23-vitest-lane-retirement-result.md`](./2026-10-23-vitest-lane-retirement-result.md)) left open: the three owner-held lanes, the 22 remote branches and the local branches of the retired lanes. The operator chose this scope in-session on 2026-10-27, including the archive of the user-paused `effect-vitest-canon-continuation` goal lane. The pause the 2026-10-23 result put on further foreign-lane archives is lifted: #2167 is closed by #2201, so archive retirement now keeps git-ignored `.beep` material.

Run from the owning clone `~/YeeBois/projects/beep-effect2` (on `main`) with the CLI at `e39244dbc5`: `bun run <cli> -- worktree remove <name> --archive`.

## Preconditions, re-checked before the apply

- Owner confirmation: the operator, who owns all three lanes (their goal is the operator-paused `effect-vitest-canon`), confirmed in-session on 2026-10-27 that all three should be archive-retired, after being shown each lane's unpushed commit count, continuation's staged files and the "User-paused goal; await explicit resume" ledger row. The Codex sessions that wrote the 2026-10-06 rows are not running, so no other owner holds them.
- No process had a cwd at or below any of the three lanes (`/proc/*/cwd` scan).
- Their newest session-ledger rows were `open` from 2026-10-06, written by Codex sessions that are no longer running. Their last commits are from the same day.
- Every remote tip still equaled the 2026-10-22 inventory (`git ls-remote origin`).

## Owner-held lanes, archive-retired

| Lane | Branch | Head | Archive ref | Reason | Preserved residue |
| --- | --- | --- | --- | --- | --- |
| `effect-vitest-canon-property-values` | `codex/effect-vitest-canon-property-values` | `d64a63ec8f1b056c77848331610ab9eaa9eac010` | `refs/archive/worktrees/effect-vitest-canon-property-values/20261027-033927` | unpushed-commits (9) | no patch, untracked 0, `.beep` material none |
| `effect-vitest-canon-resource-next` | `codex/effect-vitest-canon-resource-next` | `813d406ac9cda55ba8cffb1229d38973da481c04` | `refs/archive/worktrees/effect-vitest-canon-resource-next/20261027-033945` | unpushed-commits (10) | no patch, untracked 0, `.beep/inbox` 6 files |
| `effect-vitest-canon-continuation` | `codex/effect-vitest-canon-continuation` | `e4c608f9c10e5e1b500a19943410404a9146f64a` | `refs/archive/worktrees/effect-vitest-canon-continuation/20261027-033953` | dirty+unpushed (23) | tracked patch (the 5 staged `goals/effect-vitest-canon/` files), untracked 0, `.beep` material `continuation-audit` 1, `fallow` 8, `inbox` 8 files |

Residue roots are `~/.cache/beep/worktree-residue/beep-effect2-ed013b4f7edc/<lane>-<stamp>/`. Each lane got a closing `done` row in the session ledger that names its archive ref.

The `effect-vitest-inventory-next` directory was not a git worktree. It held one 394-byte `.beep/yeet/runs/.../attempts.ndjson` (sha256 `fb8cc820…e96e89fa`), which was moved to `~/.cache/beep/worktree-residue/beep-effect2-ed013b4f7edc/effect-vitest-inventory-next-20261027-stray/`. The empty directory was removed.

## Local branches

The 33 local branches of the 30 lanes retired on 2026-10-23 and the three lanes above were deleted with `git branch -D`. Before the delete, each branch head equaled the object of an archive ref under `refs/archive/worktrees/` (33 of 33). Two `codex/effect-vitest-canon-before-*-20261006` backup branches have no archive ref and are outside the inventory, so they were left in place.

## Remote branches

All 22 remote branches in the 2026-10-22 inventory were deleted through `DELETE repos/beep-effect/beep-effect/git/refs/heads/<branch>`. Before the delete, every tip equaled the inventoried head and had a local archive ref in `beep-effect2`. For 21 of them, `refs/pull/<n>/head` also points at the same tip. The exception is `codex/effect-vitest-wave-d-cosmos` (PR #1258's head is `04dbe47df2925636d4cb52505d07a2b9edb0a3d7`), whose tip `d4ef8af2e6f8feae3a0008638f2c15724be8c560` survives as `refs/archive/worktrees/effect-vitest-wave-d-cosmos/20261023-205621`. Afterwards no `codex/effect-vitest-*` or `fix/vitest-alias-dock-css` branch remains on `origin`.

Deviation: this was a raw REST deletion with a separate tip check run beforehand, not the leased path the standard requires (`git push --force-with-lease=<branch>:<expected-tip> origin :<branch>`, as `yeet sweep` does). A lease rejects the delete if the remote tip moves after the check; the REST call does not. The gap between check and delete was a few minutes, and each tip had been unchanged since the 2026-10-22 inventory. Every checked tip has a local archive ref, but a push landing inside that gap would not have been caught. Use the leased path for any rerun or future remote retirement.

## Restore

- Lane: `git -C ~/YeeBois/projects/beep-effect2 worktree add <path> <archive ref>`, then `git -C <path> apply <residue-root>/tracked.patch` where a patch exists, and `bun run beep worktree restore-material <residue-root> <path>` where `.beep` material was kept.
- Local branch: `git -C ~/YeeBois/projects/beep-effect2 branch <branch> <archive ref>`.
- Remote branch: `git push origin <archive ref>:refs/heads/<branch>` from `beep-effect2`.

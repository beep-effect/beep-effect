# Live-clone residue pass under the 2026-11-02 archive-only ruling

Refs #1854. The operator ruled on 2026-11-02 (relayed verbatim by the orchestrator on the issue) that the archive-only ruling extends to live clones: each held row is archived to `~/.cache/beep/residue/<clone>/` once its clone has had no `.beep` operational write for 7 days, the existing `CHECKOUT_LIVE_DAYS` fence of `residue-reap`. This receipt records the first pass under that ruling. It continues `goals/repository-simplification-confidence/history/receipts/stage-3-a-local-residue.md` (#2420), which holds the census and the 2026-10-31 archive of six idle `.serena` directories.

## Pass

The pass ran on 2026-11-02 between 03:20Z and 03:30Z against the 12 rows #1854 still tracks: the 11 rows in the live clones `beep-effect`, `beep-effect11`, `beep-effect2`, `beep-effect3`, `beep-effect5`, `beep-effect6` and `beep-effect9`, and the held `beep-effect22/.serena`.

The fence is the one `residue-reap` applies to a checkout row (`checkoutWriteSkip` in `ResidueReap.ts`): the newest regular file under the clone's `.beep`, excluding the bookkeeping directories `.beep/residue-reap` and `.beep/retention`, must be at least 7 days old. Each clone was also probed for process cwds (`/proc/*/cwd` under the clone root, nested worktrees excluded) and for its latest session-ledger row.

**Result: no row is eligible. Nothing was moved.** Every clone had a `.beep` operational write inside the window. In the live clones the newest write is a `yeet-hook-session/v1` file under `.beep/inbox/sessions/`, which the Claude session hook writes while a session works in that clone; those sessions are the reason the clones are live. The next eligible date below is the newest write plus 7 days. For a clone with an open session it slides forward with every hook write, so it is the earliest possible date, not a forecast.

| Clone | Branch | Latest ledger row | Process cwds | Newest `.beep` operational write | Next eligible |
| --- | --- | --- | ---: | --- | --- |
| `beep-effect` | `main` | `open` 2026-11-02T03:13Z | 65 | 2026-11-02T03:23Z `.beep/inbox/sessions/claude-*.json` | 2026-11-09T03:24Z |
| `beep-effect11` | `main` | `open` 2026-11-02T03:03Z | 7 | 2026-11-02T02:55Z `.beep/inbox/sessions/claude-*.json` | 2026-11-09T02:56Z |
| `beep-effect2` | `main` | `open` 2026-10-31T18:10Z | 14 | 2026-11-02T02:55Z `.beep/inbox/sessions/claude-*.json` | 2026-11-09T02:56Z |
| `beep-effect3` | `main` | `open` 2026-11-01T04:24Z, PR #2467 | 0 | 2026-11-02T02:58Z `.beep/inbox/sessions/claude-*.json` | 2026-11-09T02:59Z |
| `beep-effect5` | `main` | `blocked` 2026-11-01T01:58Z, PR #2447 | 7 | 2026-11-02T02:57Z `.beep/inbox/sessions/claude-*.json` | 2026-11-09T02:58Z |
| `beep-effect6` | `main` | `open` 2026-10-29T02:12Z | 0 | 2026-10-28T10:39Z `.beep/inbox/sessions/codex-*.json` | 2026-11-04T10:40Z |
| `beep-effect9` | `main` | `open` 2026-10-31T07:11Z | 0 | 2026-11-02T02:57Z `.beep/inbox/sessions/claude-*.json` | 2026-11-09T02:58Z |
| `beep-effect22` | `main` | `done` 2026-10-31T08:04Z | 0 | 2026-10-31T08:04Z `.beep/inbox/sessions/claude-*.json` | 2026-11-07T08:05Z |

## Rows, re-verified

Every row is still in place, and its digest equals the one recorded in the 2026-10-31 census. The digest convention is the receipts' one: a file is hashed as itself; a directory is hashed as the sha256 of its sorted per-file `sha256  path` manifest, without a trailing newline. Byte counts here are `du -sb` apparent bytes.

| Path | Class | Files | Bytes | SHA-256 (file or manifest) | Newest content write | Destination when eligible | State |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| `$HOME/YeeBois/projects/beep-effect/.serena` | Serena project state | 3 | 11410 | `3f9786f2a5ae2c8a34788a3bce32c9e18a2e2da457a6beb2a39d0b4fb3fda7e3` | 2026-10-22T16:47Z | `~/.cache/beep/residue/beep-effect/.serena` | held: fence fails until 2026-11-09T03:24Z |
| `$HOME/YeeBois/projects/beep-effect/tools/skillopt/.venv` | SkillOpt pilot venv | 4560 | 104031179 | `2a7ecfc271cd7d9409350df000dcc01d127a4137a1883a63663054a4f56af7b3` | 2026-10-22T15:38Z | `~/.cache/beep/residue/beep-effect/tools/skillopt/.venv` | held: fence fails until 2026-11-09T03:24Z |
| `$HOME/YeeBois/projects/beep-effect11/.serena` | Serena project state | 3 | 11384 | `fc4a18d1157342838511b6a0e7ce6b26e1e8c351521e0555b1245b0a188ccf64` | 2026-10-09T15:33Z | `~/.cache/beep/residue/beep-effect11/.serena` | held: fence fails until 2026-11-09T02:56Z |
| `$HOME/YeeBois/projects/beep-effect2/.serena` | Serena project state | 4 | 13426 | `9dedea79e21bae024377cbf1daba574fa7c978483d4c3362913dc9ab25c2f149` | 2026-10-09T15:33Z | `~/.cache/beep/residue/beep-effect2/.serena` | held: fence fails until 2026-11-09T02:56Z |
| `$HOME/YeeBois/projects/beep-effect3/.serena` | Serena project state | 3 | 11383 | `d0f75bf014da386cbbb6963a88077a54bb5632862d912b5beed407a2a788828f` | 2026-10-09T15:33Z | `~/.cache/beep/residue/beep-effect3/.serena` | held: fence fails until 2026-11-09T02:59Z |
| `$HOME/YeeBois/projects/beep-effect3/packages/_internal/db-admin/sst-env.d.ts` | SST declaration | 1 | 239 | `70f025ac860170980a87c402bf7adfe583e47fa5d8f6b27952d11a20758a2981` | 2026-10-20T23:50Z | `~/.cache/beep/residue/beep-effect3/packages/_internal/db-admin/sst-env.d.ts` | held: fence fails until 2026-11-09T02:59Z |
| `$HOME/YeeBois/projects/beep-effect3/scratchpad/sst-env.d.ts` | SST declaration | 1 | 233 | `9e0b14e192520f7ce9c29a15075b9d141ac5136b92792e2e56421ed89b5edf1f` | 2026-10-20T23:50Z | `~/.cache/beep/residue/beep-effect3/scratchpad/sst-env.d.ts` | held: fence fails until 2026-11-09T02:59Z |
| `$HOME/YeeBois/projects/beep-effect3/sst-env.d.ts` | SST declaration | 1 | 289 | `7a67b58da08364c7e45b4cc6cb7f105c5dc12f7b22c749fdb41dd35530bd35ba` | 2026-10-20T23:50Z | `~/.cache/beep/residue/beep-effect3/sst-env.d.ts` | held: fence fails until 2026-11-09T02:59Z |
| `$HOME/YeeBois/projects/beep-effect5/.serena` | Serena project state | 4 | 13426 | `1e353ece5c1ce85c69f7e25ebba183c21e8241e14db18a758dffd21c45591a9a` | 2026-10-09T15:33Z | `~/.cache/beep/residue/beep-effect5/.serena` | held: fence fails until 2026-11-09T02:58Z |
| `$HOME/YeeBois/projects/beep-effect6/.serena` | Serena project state | 4 | 13426 | `9384a4aa8922c8b2bf12c56b4bb30f8d8a1e677d92dc6d9605209754dc5a4248` | 2026-10-09T15:33Z | `~/.cache/beep/residue/beep-effect6/.serena` | held: fence fails until 2026-11-04T10:40Z |
| `$HOME/YeeBois/projects/beep-effect9/.serena` | Serena project state | 3 | 11383 | `c94027eec54724d202757e86526315860c02fcdbcc3cb7c1e992e4da049b9b0b` | 2026-10-09T15:33Z | `~/.cache/beep/residue/beep-effect9/.serena` | held: fence fails until 2026-11-09T02:58Z |
| `$HOME/YeeBois/projects/beep-effect22/.serena` | Serena project state | 3 | 11386 | `e1a0a0f3f2d278c4be88a99bed2d307e9c8f0ab2d37e023784fc1cc052bb8660` | 2026-10-14T03:51Z | `~/.cache/beep/residue/beep-effect22/.serena` | held: fence fails until 2026-11-07T08:05Z |

## Next pass

The ruling stands and needs no new decision. A later pass repeats this receipt's method per clone, immediately before each move: recompute the newest `.beep` operational write, the process cwds and the ledger row; if the clone has been quiet for 7 days, move the row with `mv -nT` (directory) or `mv -n` (file) to its destination, recompute the digest on the archive, confirm it equals the row's digest above, and record the restore command (`mv -nT <destination> <path>` or `mv -n <destination> <path>`). The earliest candidates are `beep-effect6` (2026-11-04) and `beep-effect22` (2026-11-07). The primary clone and the clones with open sessions become eligible only once their sessions end and the hook stops writing.

`residue-reap` has no class for `.serena`, `sst-env.d.ts` or `tools/skillopt/.venv`, so these moves stay manual, under the receipt's digest convention, the same way the 2026-10-23 and 2026-10-31 archives were made. Nothing is deleted at any step; the archive store is purged only under a separate retention decision.

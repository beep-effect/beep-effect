# Stage 3-A local residue (re-census 2026-10-31)

Refs #1854. This is the `stage-3-a-local-residue.md` receipt that `PLAN.md` and `SPEC.md` require for workstream A. It supersedes the liveness columns of the two earlier receipts in `goals/repository-simplification-residue/history/receipts/`: `2026-10-22-foreign-clone-residue.md` (#2050) and `2026-10-23-foreign-clone-residue-archive.md` (#2099). Those receipts still hold the restore commands for the 17 paths archived on 2026-10-22 and 2026-10-23.

## Method

The census ran on 2026-10-31 at about 16:45Z. It covered 266 checkouts: every `~/YeeBois/projects/beep-effect*` clone root, every directory under the `*-worktrees` roots, and every `.claude/worktrees/*` lane. Each checkout was probed for:

- `.serena`, `map.html`, `.impeccable` and `tools/skillopt/.venv` at the checkout root;
- `sst-env.d.ts`, `.sst`, `sst.config.ts` and `map.html` to depth 5, skipping `node_modules`, `.git`, `.turbo` and `.beep`.

Each hit records the following:

- Bytes and file count.
- SHA-256. A file is hashed as itself. A directory is hashed as the sha256 of its sorted per-file `sha256  path` manifest, which is the convention of the earlier receipts.
- Newest mtime.
- The number of tracked files under the path (`git ls-files`).
- The checkout's branch.
- The number of processes whose cwd is the checkout. Nested worktrees are excluded from their clone's count.
- The latest session-ledger row for that checkout (`~/.local/state/beep/sessions/*.jsonl`, the store behind `bun run beep session open`).
- Open PRs for the branch.

A checkout counts as live when it has any process cwd, a latest ledger row in state `open` or `blocked`, or an open PR. An older `done` row does not prove the checkout is idle.

## Findings that change earlier dispositions

- **`map.html`: none left.** No checkout holds it. #2050 archived the only copy, from the `beep-effect2` root.
- **`.serena` is no longer live Serena state.** The 2026-10-22 and 2026-10-23 receipts kept 13 `.serena` directories as "live Serena MCP state". Today Serena is disabled at both levels: repository `.claude/settings.json` lists `serena` in `disabledMcpjsonServers` and sets `serena@claude-plugins-official` to `false`, and the user-level settings do the same. No `serena` process runs, and no `.serena` directory was written after 2026-10-22. The 13 directories are inert. Their only blocker is the clone they sit in.
- **Clone-root `.impeccable` is user-plugin state, not repository residue.** These directories hold `hook.cache.json` and `config.local.json`, written by the impeccable plugin enabled in the user-level Claude settings. They are rewritten whenever that hook runs; the newest is from today, in `beep-effect-private`. Archiving them would only see them regenerated, so they are retained. The repository's tracked Impeccable files were a separate surface, and they are already retired.
- **Tracked hits are not residue.** 128 hits are `.impeccable/` directories, and two are `sst.config.ts` (`beep-effect-worktrees/{ai-metrics-p6-proof,playground}`). All of them are tracked in old lane branches that predate the retirements. They leave only with their worktree's own retirement, so they are not listed below.
- **SST declarations.** The `.gitignore` SST block is gone, so the three `beep-effect3` `sst-env.d.ts` files now show as untracked in that clone's `git status`. #1851, which held them, is closed. No other checkout holds SST residue.
- **The w5 lane is untouched.** `beep-effect3-worktrees/rsc-residue-detectors-w5` has no residue hit, and #1871 owns it.

## Residue table (35 untracked paths)

The proposed recovery destination follows the out-of-checkout residue store convention of the earlier receipts. Restore is `mv -n` for a file and `mv -nT` for a directory, from the destination back to the path, after the precheck in `2026-10-23-foreign-clone-residue-archive.md`.

| Path | Class | Owner | Files | Bytes | SHA-256 (file or manifest) | Last write | Liveness | Proposed destination | Disposition |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| `~/YeeBois/projects/beep-effect/.impeccable` | impeccable hook state | `beep-effect` root, `@slop/10-27-26` | 1 | 10216 | `f639aaec1147bd2d1d0613d7cc2e993637b686399bdc1f7109bfc73a3980a890` | 2026-10-28T04:59Z | live: 31 process cwds; ledger `open` 2026-10-31; PR #2415 | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect/.serena` | Serena project state | `beep-effect` root, `@slop/10-27-26` | 3 | 11410 | `3f9786f2a5ae2c8a34788a3bce32c9e18a2e2da457a6beb2a39d0b4fb3fda7e3` | 2026-10-22T21:47Z | live: 31 process cwds; ledger `open` 2026-10-31; PR #2415 | `~/.cache/beep/residue/beep-effect/.serena` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect/tools/skillopt/.venv` | SkillOpt pilot venv | `beep-effect` root, `@slop/10-27-26` | 4560 | 104031079 | `2a7ecfc271cd7d9409350df000dcc01d127a4137a1883a63663054a4f56af7b3` | 2026-10-22T20:38Z | live: 31 process cwds; ledger `open` 2026-10-31; PR #2415 | `~/.cache/beep/residue/beep-effect/tools/skillopt/.venv` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect-private/.impeccable` | impeccable hook state | `beep-effect-private` root, `main` | 2 | 21200 | `3bc3a35e2d4182dcd23ce9cf848b73f2226c9c4c93d40c07632f0137fdbfaed0` | 2026-10-31T12:38Z | live: 7 process cwds | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect10/.impeccable` | impeccable hook state | `beep-effect10` root, `main` | 1 | 4778 | `ea457f4296014cb478d611c86f4d70e55b75436395bdbc181c03a3eac9f33809` | 2026-10-23T15:14Z | idle: 0 process cwds; ledger `done` 2026-10-23 | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect11/.impeccable` | impeccable hook state | `beep-effect11` root, `main` | 1 | 8839 | `3756522cecc08f8d81a82cd80a6214c8a4cbf564429bb637ef481a807f9fb288` | 2026-10-21T10:34Z | live: 88 process cwds; ledger `open` 2026-10-31 | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect11/.serena` | Serena project state | `beep-effect11` root, `main` | 3 | 11384 | `fc4a18d1157342838511b6a0e7ce6b26e1e8c351521e0555b1245b0a188ccf64` | 2026-10-09T20:33Z | live: 88 process cwds; ledger `open` 2026-10-31 | `~/.cache/beep/residue/beep-effect11/.serena` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect12/.impeccable` | impeccable hook state | `beep-effect12` root, `main` | 1 | 10397 | `829c7c4e184ab3a0e23746aa107fe2fd2599ef3c6e41349f8f523f3ba6790324` | 2026-10-21T18:59Z | live: 4 process cwds | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect13/.impeccable` | impeccable hook state | `beep-effect13` root, `main` | 1 | 12490 | `37dbeac75b28f67bd83b64da5645a5626bbfb106f97c452035d7a4d88dd5c09d` | 2026-10-20T16:35Z | live: 24 process cwds; ledger `open` 2026-10-29 | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect14/.serena` | Serena project state | `beep-effect14` root, `main` | 3 | 11384 | `a7f5347be307170ae176b998d482702128cfd02f437ec4c834d123421f0bd412` | 2026-10-09T20:33Z | idle: 0 process cwds; ledger none | `~/.cache/beep/residue/beep-effect14/.serena` | archived 2026-10-31 (operator ruling) |
| `~/YeeBois/projects/beep-effect16/.impeccable` | impeccable hook state | `beep-effect16` root, `main` | 1 | 6040 | `f40fa10a1933369271fb2843ab675a6c94d2097493b8b663a4ada555bf4fa475` | 2026-10-21T03:18Z | idle: 0 process cwds; ledger none | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect16/.serena` | Serena project state | `beep-effect16` root, `main` | 3 | 11384 | `7f5785d8e23d122666edd3f9c1e86804ad03895a8de26ab6dd0db1356050a9eb` | 2026-10-09T20:33Z | idle: 0 process cwds; ledger none | `~/.cache/beep/residue/beep-effect16/.serena` | archived 2026-10-31 (operator ruling) |
| `~/YeeBois/projects/beep-effect18/.impeccable` | impeccable hook state | `beep-effect18` root, `main` | 2 | 3071 | `2b573ab069bbda9522bba21bdc7fe213531c88be066c1f278585f3cd5b6c33fb` | 2026-10-21T03:19Z | idle: 0 process cwds; ledger none | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect18/.serena` | Serena project state | `beep-effect18` root, `main` | 3 | 11384 | `cee6a1860b2983623450a5422e1155a6d4186c41aa0fdb47506bdf6d876a8d4b` | 2026-10-09T20:33Z | idle: 0 process cwds; ledger none | `~/.cache/beep/residue/beep-effect18/.serena` | archived 2026-10-31 (operator ruling) |
| `~/YeeBois/projects/beep-effect19/.impeccable` | impeccable hook state | `beep-effect19` root, `main` | 1 | 249 | `de8d71842a24fdd7045854d7e6c30067a56292648712932b63a132cc207bb5e0` | 2026-10-21T03:19Z | idle: 0 process cwds; ledger none | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect2/.serena` | Serena project state | `beep-effect2` root, `main` | 4 | 13426 | `9dedea79e21bae024377cbf1daba574fa7c978483d4c3362913dc9ab25c2f149` | 2026-10-09T20:33Z | live: 27 process cwds; ledger `open` 2026-10-31 | `~/.cache/beep/residue/beep-effect2/.serena` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect20/.impeccable` | impeccable hook state | `beep-effect20` root, `main` | 1 | 3131 | `b98e1d914872d09e94702be17fecaa27c8c66ace885670e7e445097d47382bf9` | 2026-10-21T03:20Z | idle: 0 process cwds; ledger none | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect20/.serena` | Serena project state | `beep-effect20` root, `main` | 3 | 11384 | `4747a92627c565620937031657071b2ce4f9301713ca4b021eee702d77ec6e41` | 2026-10-09T20:33Z | idle: 0 process cwds; ledger none | `~/.cache/beep/residue/beep-effect20/.serena` | archived 2026-10-31 (operator ruling) |
| `~/YeeBois/projects/beep-effect21/.impeccable` | impeccable hook state | `beep-effect21` root, `main` | 1 | 2349 | `9ba363412e907cdb83ec0e7ac6b9743c704fdc39cce8ef6c656413f584a1b53c` | 2026-10-21T03:20Z | idle: 0 process cwds; ledger none | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect22/.impeccable` | impeccable hook state | `beep-effect22` root, `main` | 1 | 2446 | `2baa8dec1d464f4373dd42c790e8e5b99efb44ac5c77670d67569771d64b2133` | 2026-10-21T03:22Z | idle: 0 process cwds; ledger `done` 2026-10-31 | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect22/.serena` | Serena project state | `beep-effect22` root, `main` | 3 | 11386 | `e1a0a0f3f2d278c4be88a99bed2d307e9c8f0ab2d37e023784fc1cc052bb8660` | 2026-10-14T08:51Z | idle: 0 process cwds; ledger `done` 2026-10-31 | `~/.cache/beep/residue/beep-effect22/.serena` | owner disposition needed: idle clone root |
| `~/YeeBois/projects/beep-effect3/.impeccable` | impeccable hook state | `beep-effect3` root, `main` | 1 | 6955 | `7d8fa6baae64b10927c5471c2948ff3bccfa61a21cfd244d4912f56c14accac5` | 2026-10-21T08:35Z | live: 5 process cwds | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect3/.serena` | Serena project state | `beep-effect3` root, `main` | 3 | 11383 | `d0f75bf014da386cbbb6963a88077a54bb5632862d912b5beed407a2a788828f` | 2026-10-09T20:33Z | live: 5 process cwds | `~/.cache/beep/residue/beep-effect3/.serena` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect3/packages/_internal/db-admin/sst-env.d.ts` | SST declaration | `beep-effect3` root, `main` | 1 | 239 | `70f025ac860170980a87c402bf7adfe583e47fa5d8f6b27952d11a20758a2981` | 2026-10-21T04:50Z | live: 5 process cwds | `~/.cache/beep/residue/beep-effect3/packages/_internal/db-admin/sst-env.d.ts` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect3/scratchpad/sst-env.d.ts` | SST declaration | `beep-effect3` root, `main` | 1 | 233 | `9e0b14e192520f7ce9c29a15075b9d141ac5136b92792e2e56421ed89b5edf1f` | 2026-10-21T04:50Z | live: 5 process cwds | `~/.cache/beep/residue/beep-effect3/scratchpad/sst-env.d.ts` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect3/sst-env.d.ts` | SST declaration | `beep-effect3` root, `main` | 1 | 289 | `7a67b58da08364c7e45b4cc6cb7f105c5dc12f7b22c749fdb41dd35530bd35ba` | 2026-10-21T04:50Z | live: 5 process cwds | `~/.cache/beep/residue/beep-effect3/sst-env.d.ts` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect5/.impeccable` | impeccable hook state | `beep-effect5` root, `feat/beep-effect-web-alchemy` | 1 | 13963 | `3df04bfd69233338832640c285f3519666a9b34c58fe4625d9fe82cf555a3fe1` | 2026-10-28T20:34Z | live: 16 process cwds; ledger `open` 2026-10-28; PR #2391 | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect5/.serena` | Serena project state | `beep-effect5` root, `feat/beep-effect-web-alchemy` | 4 | 13426 | `1e353ece5c1ce85c69f7e25ebba183c21e8241e14db18a758dffd21c45591a9a` | 2026-10-09T20:33Z | live: 16 process cwds; ledger `open` 2026-10-28; PR #2391 | `~/.cache/beep/residue/beep-effect5/.serena` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect6/.impeccable` | impeccable hook state | `beep-effect6` root, `main` | 1 | 931 | `8984bf7d9bb50ea512d6dfc0618e9cd45162e3ed7379d2d4a9ffd925edbe27d4` | 2026-10-20T16:24Z | live: ledger `open` 2026-10-29 | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect6/.serena` | Serena project state | `beep-effect6` root, `main` | 4 | 13426 | `9384a4aa8922c8b2bf12c56b4bb30f8d8a1e677d92dc6d9605209754dc5a4248` | 2026-10-09T20:33Z | live: ledger `open` 2026-10-29 | `~/.cache/beep/residue/beep-effect6/.serena` | owner disposition needed: live clone |
| `~/YeeBois/projects/beep-effect7/.serena` | Serena project state | `beep-effect7` root, `main` | 4 | 13426 | `d23b134221733fc66874dc76d91a9a3487a6b43368c63818476f1b788405c0d7` | 2026-10-09T20:33Z | idle: 0 process cwds; ledger `done` 2026-10-14 | `~/.cache/beep/residue/beep-effect7/.serena` | archived 2026-10-31 (operator ruling) |
| `~/YeeBois/projects/beep-effect8/.impeccable` | impeccable hook state | `beep-effect8` root, `main` | 1 | 3552 | `96f84bfde764d005f1ff52fcf7aac9f4739216b02d31cf5dd5bc89f3fd92e05d` | 2026-10-23T01:06Z | idle: 0 process cwds; ledger `done` 2026-10-23 | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect8/.serena` | Serena project state | `beep-effect8` root, `main` | 3 | 11383 | `849d09166011797b1778e2f549c55f4b6e83eeab4db0e1327e1c46b772bf7fc1` | 2026-10-09T20:33Z | idle: 0 process cwds; ledger `done` 2026-10-23 | `~/.cache/beep/residue/beep-effect8/.serena` | archived 2026-10-31 (operator ruling) |
| `~/YeeBois/projects/beep-effect9/.impeccable` | impeccable hook state | `beep-effect9` root, `main` | 1 | 1051 | `d465268a62e077d0bbff77541ba606bcdc9ebe1386a26b01c87081ccf67c3abc` | 2026-10-20T16:34Z | live: 3 process cwds; ledger `open` 2026-10-31 | retain in place | retained: user-plugin state |
| `~/YeeBois/projects/beep-effect9/.serena` | Serena project state | `beep-effect9` root, `main` | 3 | 11383 | `c94027eec54724d202757e86526315860c02fcdbcc3cb7c1e992e4da049b9b0b` | 2026-10-09T20:33Z | live: 3 process cwds; ledger `open` 2026-10-31 | `~/.cache/beep/residue/beep-effect9/.serena` | owner disposition needed: live clone |

## Cleanup in the census pass: none

The census pass moved and deleted nothing. The brief allows cleanup only when the owning checkout is removed or its branch is merged, with no live process and no open ledger row, and only through an existing backed-up, drift-fenced path (`beep quality residue-reap` or `beep worktree remove --archive`). No row met both conditions:

- All 18 non-plugin rows sit in clone roots. A clone root is never removed, and new sessions re-enter it without notice. Its owner is the clone itself, not a merged lane.
- `residue-reap` discovers only closed classes (`codex-*`, `turbo-*`, `checkout-*`, `beep-cache-disposable`, `merged-preview`, `qualification-views`). None of them covers `.serena`, `sst-env.d.ts` or `tools/skillopt/.venv`.
- `worktree remove --archive` retires a whole linked worktree, not a path inside a clone root.

## Owner dispositions needed

- **11 rows in live clones:**
  - `beep-effect`: `.serena`, `tools/skillopt/.venv` (104 MB), PR #2415.
  - `beep-effect11`, `beep-effect2` and `beep-effect9`: `.serena`.
  - `beep-effect3`: `.serena` and three `sst-env.d.ts` files.
  - `beep-effect5`: `.serena`, PR #2391.
  - `beep-effect6`: `.serena`, open ledger row.

  Each needs the live session in that clone to archive the path, or to confirm the archive, before it is moved.
- **7 rows in idle clone roots:** `.serena` in `beep-effect14`, `beep-effect16`, `beep-effect18`, `beep-effect20`, `beep-effect22`, `beep-effect7` and `beep-effect8`. The operator then ruled archive-only for these, the same disposition as #2099 (see the archive pass below). Six were archived. `beep-effect22` failed the re-check and is held.
- **17 `.impeccable` rows** are retained as user-plugin state. No action is needed.

## Earlier "left in place" rows (2026-10-23 receipt)

Of the 29 rows:

- **Two checkouts are gone:** `beep-effect2-worktrees/effect-vitest-capability-leaves` and `effect-vitest-inventory-proof`. Their tracked `goals` rows left with them.
- **Tracked working-tree content stays with its checkout's own retirement:** the remaining `goals`, `packages`, `explorations`, `scratchpad`, `.changeset` and `tools` rows.
- **`.serena` and `sst-env.d.ts` rows** are carried into the table above with today's liveness.

## Archive pass (2026-10-31, operator ruling)

The operator ruled archive-only for the seven idle `.serena` rows (relayed by the program orchestrator: "Yes, archive them"), the same disposition as #2099. Each clone was re-checked at about 17:20Z, immediately before its move:

- **Process cwds:** none for any of the seven (`/proc/*/cwd` under the clone root, excluding nested worktrees).
- **Ledger:** the latest row for each clone is `done` or absent.
- **Tracking:** `.serena` holds no tracked file in any of the seven.
- **Writes:** The only non-dependency writes since 2026-10-24 are fleet maintenance, not session work. On 2026-10-31 at 15:27–15:30Z every clone root was fast-forwarded to `f16d82e9f1` by `git pull`, which also wrote the tracked files, the `node_modules` refresh and the generated `infra/ci-runners` SDK output. On 2026-10-28 at about 19:20Z the `.direnv` flake profiles were refreshed. Excluding those, the newest `.beep` write is 2026-10-28 in `beep-effect8`, 2026-10-27 in `beep-effect7` and `beep-effect16`, and 2026-09-25 in the rest. No `.serena` content has been written since 2026-10-09.
- **Held:** `beep-effect22` recorded Claude session writes on 2026-10-31 at 07:45–08:04Z (`.beep/inbox/sessions`, `.turbo/runs`), with its ledger row `done` at 08:04Z. A session less than a day old fails the "no recent writes" check, so this row stays in place and is archived only after a later idle re-check.

Each directory was moved with `mv -nT` to `~/.cache/beep/residue/<clone>/.serena`. The manifest digest (the convention of the 2026-10-23 receipt, hashed without a trailing newline) was recomputed on the archive, and it equals the pre-move digest in every row. The source path no longer exists. The documented shell manifest command reproduces the `beep-effect7` digest. Nothing was deleted.

Restore: first confirm the original path is absent. Then verify the archive against its digest:

```sh
(cd <archive> && find . -type f -print0 | sort -z | xargs -0 sha256sum | sed 's#  ./#  #' | LC_ALL=C sort | head -c -1 | sha256sum)
```

Then run the row's command.

| Path | Files | Bytes | Manifest SHA-256 (before = after) | Archive | Restore |
| --- | ---: | ---: | --- | --- | --- |
| `~/YeeBois/projects/beep-effect7/.serena` | 4 | 13426 | `d23b134221733fc66874dc76d91a9a3487a6b43368c63818476f1b788405c0d7` | `~/.cache/beep/residue/beep-effect7/.serena` | `mv -nT ~/.cache/beep/residue/beep-effect7/.serena ~/YeeBois/projects/beep-effect7/.serena` |
| `~/YeeBois/projects/beep-effect8/.serena` | 3 | 11383 | `849d09166011797b1778e2f549c55f4b6e83eeab4db0e1327e1c46b772bf7fc1` | `~/.cache/beep/residue/beep-effect8/.serena` | `mv -nT ~/.cache/beep/residue/beep-effect8/.serena ~/YeeBois/projects/beep-effect8/.serena` |
| `~/YeeBois/projects/beep-effect14/.serena` | 3 | 11384 | `a7f5347be307170ae176b998d482702128cfd02f437ec4c834d123421f0bd412` | `~/.cache/beep/residue/beep-effect14/.serena` | `mv -nT ~/.cache/beep/residue/beep-effect14/.serena ~/YeeBois/projects/beep-effect14/.serena` |
| `~/YeeBois/projects/beep-effect16/.serena` | 3 | 11384 | `7f5785d8e23d122666edd3f9c1e86804ad03895a8de26ab6dd0db1356050a9eb` | `~/.cache/beep/residue/beep-effect16/.serena` | `mv -nT ~/.cache/beep/residue/beep-effect16/.serena ~/YeeBois/projects/beep-effect16/.serena` |
| `~/YeeBois/projects/beep-effect18/.serena` | 3 | 11384 | `cee6a1860b2983623450a5422e1155a6d4186c41aa0fdb47506bdf6d876a8d4b` | `~/.cache/beep/residue/beep-effect18/.serena` | `mv -nT ~/.cache/beep/residue/beep-effect18/.serena ~/YeeBois/projects/beep-effect18/.serena` |
| `~/YeeBois/projects/beep-effect20/.serena` | 3 | 11384 | `4747a92627c565620937031657071b2ce4f9301713ca4b021eee702d77ec6e41` | `~/.cache/beep/residue/beep-effect20/.serena` | `mv -nT ~/.cache/beep/residue/beep-effect20/.serena ~/YeeBois/projects/beep-effect20/.serena` |

After this pass, #1854 has 12 rows left:

- 11 rows in live clones, owner-held.
- `beep-effect22/.serena`, held pending an idle re-check.

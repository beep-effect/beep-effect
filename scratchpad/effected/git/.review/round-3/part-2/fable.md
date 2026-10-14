<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the git command, config, and gitmodules surface against the pinned upstream oracle and the round-2 inventory, without changing any files.Round-2 closed nine required items on this surface. I'll read the current command, config, and parser files against those fixes and the pinned oracle.### fable-3-1
- file: scratchpad/effected/git/GitCommand.ts:295; scratchpad/effected/git/GitCommand.ts:316
- class: bug   severity: required
- standard: D9, D11, §14 upstream-bug; git-log `log.showSignature` / `--show-signature`. evidence: `commitInfo` spawns `git log -1 --format=%H%x00%G?%x00%B` and `log` spawns `git log -z --format=%x00%H%x00%aI%x00%cI%x00%an%x00%ae` with no `--no-show-signature`. `log.showSignature=true` makes Git print signature text before that format. `parseLog` (Git.ts:1027) rejects stdout that does not open with NUL, and `parseCommitInfo` (Git.ts:1202) treats every byte before the first NUL as the object id. The part-1 probe on this commit reproduced both results in the lab and the pinned oracle: log stdout began `No signature\n\0<sha>…` and failed with `unparseable log output: log output did not open with a record separator`; `commitInfo` returned `sha` `No signature\n3ad7b305790c7f0903f6d55766c55186745ba2d1`. Adding `--no-show-signature` restored the format prefixes and kept `%G?`.
- failure: A repository or global `log.showSignature=true` makes a successful `Git.log` fail and stores a signature banner inside `Git.commitInfo`'s object id. Ordinary format fixtures never set that variable, so the green suite does not see it.
- fix: Pass `--no-show-signature` on both argv lists. Keep `%G?` on `commitInfo`. Add regressions for both commands under `log.showSignature=true`, and record the upstream bug under §14 before changing behavior.

REQUIRED: 1
BACKLOG: 0

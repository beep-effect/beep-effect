---
title: "Final-check refresh reads pin their diff options"
date: 2026-11-14
kind: checkpoint
lane: "fix/final-check-refresh-diff-pins"
reversal: "Restore the unpinned filePatch argv and drop ignoreSubmodules from changedPaths in Yeet/internal/FinalCheckRefresh.ts; the kit option and PATCH_IDENTITY_DIFF_FLAGS can stay unused."
---

Found during slice 7. The final-check refresh rule decides whether an ancestor's receipt carries to a new head from two git reads: the changed-path lists (`git diff R F` and `git diff MBR MBF`) and one patch per path (`MBR..R` against `MBF..F`). Both ran with git's porcelain defaults, so local config could change the verdict:

- `diff.ignoreSubmodules=all`, or a checked-out `.gitmodules` entry with `ignore = all`, hid a moved gitlink from the path list and emptied its patch, so a receipt carried to a head whose only change was a gitlink pointer.
- A textconv driver could empty both patches. `diff.context=0`, or a `-diff` attribute (a binary delta copies source bytes by offset), could hide a change to the patch's context.
- A file named like pathspec magic, such as `:(top)a`, was read as another path.

The path lists now pass `--ignore-submodules=none` through a new optional `ignoreSubmodules` on `Git.changedFiles`. Nothing else in config changes a `--name-only -z --no-relative --no-renames` list. The patch read runs `git --literal-pathspecs diff` with `PATCH_IDENTITY_DIFF_FLAGS` from `Yeet/internal/PatchIdentity.ts`. The flags pin submodule visibility and format, colour, renames, external diff, textconv, binary detection (`--text` replaces `--binary`, so a binary file diffs as bytes under the same context rule as text), the index line, the prefixes, context, hunk joining, the algorithm and the indent heuristic. Three settings stay unpinned because they cannot change the identity: `diff.relative` (git runs at the top level), `core.quotePath` (it respells only dropped header lines) and `diff.suppressBlankEmpty` (one-to-one on both sides). A receipt distance that cannot be read now chooses no receipt instead of an older one.

The rewrite proof's patch read in `HeadMove.ts`, which PR #3329 pins separately, can use the same flag list once both merge. It would gain `--text` and drop `--no-relative`, a no-op at the top level.

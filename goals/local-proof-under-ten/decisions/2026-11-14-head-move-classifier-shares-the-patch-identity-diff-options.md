---
title: "Head-move classifier shares the patch-identity diff options"
date: 2026-11-14
kind: checkpoint
lane: "fix/head-move-shared-diff-flags"
reversal: "Restore the local PatchDiffFlags list (--binary, --no-relative) in Yeet/internal/HeadMove.ts patchDigest; the binary-diff tests and binaryReplay go with it."
---

Found after #3337. The head-move classifier (`Yeet/internal/HeadMove.ts`) proves that a GitHub rewrite (#3130) or a merge of the base (#3329) left the pull request's patch unchanged. It kept its own diff flag list and read each patch with `--binary`. A binary delta copies source bytes by offset, so for a file git treats as binary (a real binary, a `-diff` attribute, or a diff driver with `binary = true`), two patches that differ only in the bytes around the lane's edit print the same delta.

A scratch repository with `data.txt -diff` reproduced it on main. The lane retags line 120 and the base retags line 118, keeping its length. Under the old flags the identities of `O..B` and `MX..HX` were equal (`dcc0b8c699936a1d`), and under `--text` they differed (`2a15e557679a05c3`, `9d1fe15e3c83d42b`). Git merges a `-diff` text file as text, so the replay-tree and clean-merge checks passed (a real binary changed on both sides conflicts and is refused there), and both `classify` and `classifyBaseMerge` returned `unchanged`: the review window stayed anchored at the earlier push. The same delta failed the other way when the base only inserted lines above the hunk, so an unchanged patch read as changed and re-armed the window.

The classifier now reads with `PATCH_IDENTITY_DIFF_FLAGS`, the refresh rule's list. `--text` replaces `--binary`. `--no-relative` is dropped because `diff.relative` is a no-op at the top level; the hostile-config rewrite test sets it and still carries. `--literal-pathspecs` was already passed, and a test now covers a path named `:(top)a`. The `diff-tree` read keeps its own pins. The existing base-merge replay answers are text files, whose output is the same under both lists: three of the four recorded patch texts were rebuilt in a scratch repository and matched byte for byte under the new flags, so none changed; a new recording covers the `-diff` file and keeps the `--binary` answers for an argv without `--text`.

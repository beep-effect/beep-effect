---
"@beep/repo-cli": patch
---

`yeet publish` now treats `goals/INDEX.md` as the derived projection it is.

Immediately before the commit — after the reviewed intent is staged and after the `--staged-only`
stash has parked residue, the one point where the worktree provably equals the tree being
committed — publish renders the index from `goals/*/ops/manifest.json`. If the committed copy is
stale it is regenerated and staged into the same commit; if the publish intent hand-stages a copy
that disagrees with the manifests, publish refuses with a publish-scope failure packet naming
`bun run beep goals index --write` and leaves the staged file untouched. A staged copy that already
equals the projection proceeds unchanged.

This closes the merge class recorded in `goals/ship-velocity/research/c6-conflicts-queue.md`: the
index is whole-file sorted output, so every observed git auto-merge of it produced a plausible but
wrong packet count, and regeneration is the only correct resolution.

---
title: Followed symlinks use a per-branch ancestor chain and never enter an unresolvable link
date: 2026-11-26
reversal: Replace the frame ancestor chain with a walk-global visited set of real paths.
governs:
  - src/Descend.ts#childAncestors
  - src/Descend.ts#realPathOf
enforcedBy: []
---

Under `followSymlinks`, each frame carries the real paths of its own branch's ancestors, as
`@actions/glob`'s `traversalChain` does. A directory is a cycle only when its real path is already
on that chain, so two sibling links to one target both enumerate. Only the base and each link pay a
`realPath`; a plain directory's real path is its parent's plus its own name. A link whose real path
cannot be resolved is never queued, and the failure follows `onUnreadable`.

Rejected: a walk-global visited set (the second sibling link would vanish); recording the link's own
path as a stand-in for an unresolved one (every hop around a loop would look unseen); a silent skip.

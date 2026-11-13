---
title: "GitHub does not restack a layer when the trunk moves; only the cascade rewrites"
date: 2026-11-13
lane: "docs/stack-pilot-main-observed"
pullRequest: 3243
reversal: "None needed for a measured fact. Reopen the question if a pilot row shows a rewrite after a trunk move that nobody asked for."
---

This settles the fact the 2026-11-10 decision left open (the second server-side rewrite in the stack test). Measured on 2026-11-13 and recorded in research/stack-pilot-2026-11.md: an unmerged two-layer stack on main saw 11 trunk pushes and no rewrite (#3190); on a throwaway base, unmerged and partially merged stacks with one and with two layers left saw five trunk moves and no rewrite beyond the cascade (#3238, #3239); and on main a layer that `yeet merge-gate --alone` had cascaded kept its head through the next trunk move (#3244, layer #3243). The cascade, seconds after a lower layer merges alone, is the only rewrite GitHub made by itself. The stack test rewrite stays unattributed: its commits are GitHub-signed where a cascade leaves them unsigned, GitHub documents Rebase stack and `gh stack rebase` as the remedies when the trunk has moved ahead, and no audit log is available. For a lane this means a layer moves only when the lane pushes or the layer below merges alone, so `--alone` and the unstack procedure stand. It does not mean the review window survives a cascade: on #3243 it restarted, because the parent had changed after the layer was cut.

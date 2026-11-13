---
title: "yeet ready never pushes on a stack layer; the request comment is the wake"
date: 2026-11-13
lane: "feat/yeet-two-layer-stacks"
reversal: "Allow the S32 fallback on the top layer only, where a push cannot strand a layer above."
---

Since #2791 `yeet ready` wakes beep-reviewer with an exact-head issue comment for a PR the shared login authored, and pushes the empty S32 commit only as the fallback for an author or repository the comment routine does not cover. The P0 probes showed the comment waking the reviewer on a layer with no push: #3154 (position 1 of 2) sat ready for four minutes unreviewed, then got its summary 2 minutes 32 seconds after the comment, on an unchanged head. So slice C adds no new wake. It removes the fallback on every stack layer, top included, because a push below the top moves the head off the base of the layer above and a push on the top restarts a window the gate is about to read. An uncovered layer gets a warning with the manual comment body.

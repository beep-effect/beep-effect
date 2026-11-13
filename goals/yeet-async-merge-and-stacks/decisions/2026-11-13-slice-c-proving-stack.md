---
title: "Slice C lands as a proving stack of two small PRs plus the tooling PR"
date: 2026-11-13
lane: "feat/yeet-two-layer-stacks"
reversal: "None needed after the fact; a later slice returns to one PR per slice."
---

The acceptance row needs a real two-layer stack landed through the new code, and its evidence belongs in the PR that flips the row. So the stack is run with the lane's unmerged CLI on two small slice C changes that stand alone, and the tooling PR carries the code, the skill text, the evidence and the flips. The layers are code changes, not docs, so Yeet applies `ready-for-heavy` and the Heavy lanes run on a layer. The first parent, #3170 (the P0 record), could not serve: the shared login flipped it ready one minute after it opened as a draft and merged it ten minutes later, before a layer existed. The layers therefore open with their final-check receipts already written, are flipped by `yeet ready` at once, and carry `owner-merge-hold` and one unresolved hold thread each until the top is gated.

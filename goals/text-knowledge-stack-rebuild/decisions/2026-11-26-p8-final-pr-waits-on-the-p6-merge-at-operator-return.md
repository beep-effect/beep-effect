---
title: "P8 checkpoint: the final PR waits on the P6 merge at the operator's return"
date: 2026-11-26
kind: checkpoint
lane: "goals/text-knowledge-stack-rebuild-p7-retirement"
pullRequest: 3558
reversal: "Merge #3558 in an earlier slot if the driver rules that its pin PR can merge without the operator."
---

P6 (#3558) is final at `eac25bdcd3e`, and orch-gate verified that head. Its patch touches the CI binary closure (`bun.lock`, `tsconfig.json` and the identity registry data), so merging it cuts a release and opens a pin PR. Only the operator can merge a pin PR, and one queued on 2026-11-26 would freeze every other merge. The driver therefore holds #3558 until the first operator-present window on 2026-11-27, after the first hour of 6b. The P7 lane already contains P6's final head (`1d6c3e13a2e`) and P8's closeout row (`41741d9abdf`). After #3558 merges, the lane is retargeted onto `main`, passes `yeet final-check`, and opens as the final PR. Only then does it record `completed-retained`.

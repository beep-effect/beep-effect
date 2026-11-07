---
title: "Sweep batch 1: 50 goals archived at f77d312, verified and pushed"
date: 2026-11-07
kind: checkpoint
reversal: "Revert the batch PR on main to restore the 50 packets; the archive repo keeps its copies"
---

beep goals archive --kind goals --batch 50 (plan 736f91a4) mirrored 50 goals from main c19514e0d0 into beep-effect/beep-effect-goals-archive at f77d312 (index 4f122e9), pushed before the tombstone PR. An independent check matched every recorded contentHash to git rev-parse <commit>:<path> on origin/main. The batch exposed a researchReports projection gap in goal tombstones; the writer now reprojects it, and this batch's manifests were reprojected with goals manifest --write.

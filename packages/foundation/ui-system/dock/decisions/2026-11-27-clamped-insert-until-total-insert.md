---
title: Clamped tab inserts unwrap Array.insertAt until a total insert exists
date: 2026-11-27
reversal: Replace both O.getOrThrow(A.insertAt(...)) calls with a total Effect Array insert once one ships, and delete this record.
governs:
  - src/internal/Reducer.ts#movePanelForest
  - src/Dock.models-tree.ts#TabsNode
enforcedBy: []
---

The same-group move in movePanelForest and TabsNode.insert clamp the insertion index to the panel list's bounds, then unwrap `A.insertAt` with `O.getOrThrow`. After the clamp the insert cannot fail, so the unwrap never throws.
Reason: effect/Array offers only the partial `insertAt`, which returns `Option.none()` for an out-of-range index. The clamp makes the call total, but the type still says it may fail.
Rejected: matching on the `Option` and rejecting the command on `None`. That branch is unreachable after the clamp, and a rejection reason for it would describe a state no input can produce.
Remove this guard when a total Effect Array insert is available.

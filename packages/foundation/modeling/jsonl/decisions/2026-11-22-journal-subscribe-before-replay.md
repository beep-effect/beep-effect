---
title: Journal changes subscribe to the hub before reading the terminal state or replaying history, and join on offsets
date: 2026-11-22
reversal: Build the live half with Stream.fromPubSubTake and concatenate it after the replay, with no offset filter.
governs:
  - src/Journal.ts#makeEngine
enforcedBy: []
---

Slice validation precedes subscription acquisition, including no-replay reads. The subscription is taken first, in the effect the stream is unwrapped from and scoped to the stream, and only then are the terminal tail and `closed` read. A journal already terminal then returns the replay alone. A terminal append or close that lands between the two is delivered through the subscription; read in the other order, the hub (which has no replay) would hide it and a reader without a cursor would wait forever.
Early subscription overlaps: a line can be on disk when the replay reads it and still in flight to the hub. Offsets are monotonic in file order, so the last replayed `end` (starting from the requested cursor) is the boundary between delivered and new, and live lines below it are dropped exactly as the replay drops them. History and tail are one stream filtered the same way downstream, so a consumer sees no gap and no duplicate at the join.
`takeUntil(isTerminalEnvelope)` runs before the slice filter and before the de-duplication filter, so a terminal envelope ends the subscription even when the slice excludes it or the replay already delivered it.
Rejected: `Stream.fromPubSubTake` after the replay; it subscribes on first pull, which `Stream.concat` reaches only after the replay, so appends published during the replay are lost.
Rejected: de-duplicating before `takeUntil`, which drops an already-replayed terminal envelope and leaves the subscriber waiting on a finished journal.

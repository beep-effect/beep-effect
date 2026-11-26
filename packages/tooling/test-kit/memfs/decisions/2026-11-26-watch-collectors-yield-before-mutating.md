---
title: Watch collectors yield once after forking the subscriber, before the mutation runs
date: 2026-11-26
reversal: Run the mutation immediately after the fork, as upstream's watch collector does.
governs:
  - test/MemoryFileSystem.test.ts#watchEvents
  - test/helpers.ts#collectWatch
  - test/helpers.ts#firstEvent
enforcedBy: []
---

Upstream's ported suite mutates immediately after forking the watching child. The port yields once first: the FIFO scheduler then runs the child to its first real suspension, past the engine's `watchers.add`, so the subscription provably exists before any event is published. The kit's own collectors in helpers.ts follow the same order.
Rejected: upstream's immediate mutation, which leaves registration order to scheduler timing and can drop the event the test waits for.

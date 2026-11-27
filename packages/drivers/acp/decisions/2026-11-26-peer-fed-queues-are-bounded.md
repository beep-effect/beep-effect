---
title: Every peer-fed queue is bounded, and a failed writer fails every send instead of parking it
date: 2026-11-26
reversal: Make the protocol queues unbounded and drop the Queue.shutdown after Queue.fail in failOutgoingWrites.
governs:
  - src/AcpProtocol.service.ts#ACP_PROTOCOL_QUEUE_CAPACITY
  - src/AcpProtocol.service.ts#makeAcpPatchedProtocol
enforcedBy: []
---

Server, client and outgoing queues are `bounded(1024)`. `incoming` is a `sliding(32)` queue that drops the oldest unread notification instead of suspending, so a consumer that never drains it cannot stall the reader; no production consumer reads it, so a short tail (t3's 32) is enough.
Admission to the writer is atomic with its terminal state (`admitOutgoing`), so a response admitted while the writer closes fails with the rest instead of waiting forever for its acknowledgement.
A failed queue stays open for draining, so `failOutgoingWrites` also shuts it down: senders parked on the full queue resume with a rejected offer, and `rejectedWriteError` reports the writer's terminal error, so they fail like every other send after a writer failure.
Rejected: unbounded queues (peer-driven memory growth) and a suspending notification queue (a non-draining consumer stalls the reader).

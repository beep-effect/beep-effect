---
title: The stdout reader never waits on a handler that may need the reader to deliver a response
date: 2026-11-26
reversal: Run extension request and notification handlers inline on the reader fiber and delete the permit semaphores, AcpNotificationDispatch and CurrentNotificationDispatch.
governs:
  - src/AcpProtocol.service.ts#ACP_PROTOCOL_EXT_REQUEST_CONCURRENCY
  - src/AcpProtocol.service.ts#ACP_PROTOCOL_DETACHED_NOTIFICATION_HANDLERS
  - src/AcpProtocol.service.ts#AcpNotificationDispatch
  - src/AcpProtocol.service.ts#CurrentNotificationDispatch
  - src/AcpProtocol.service.ts#makeAcpPatchedProtocol
enforcedBy: []
---

Inbound extension requests run forked, at most 64 at once (`forkExtRequest`). Past the bound a request is answered with an error on the reader at once, since that response waits only for the writer: the reader never waits for a permit, which only a finishing handler returns.
Each notification handler runs on its own fiber, isolated so a failing or dying handler cannot stop the reader. The reader waits until the handler finishes or first sends a request on this connection, so handlers start in arrival order.
`CurrentNotificationDispatch` is set while a handler runs; `RpcClient` forks a typed call's send with the caller's context, so a request sent directly or through a typed client sees it. `AcpNotificationDispatch.connection` keeps a request on another connection from releasing this reader, and `readerReleased` completes on finish or first request.
A released handler holds one of 64 detached slots until it finishes; past the bound its request fails. Whichever of the handler's fibers or its completion releases first wins, and a late detach gives its slot back.
Reason: a handler that awaits an outbound request needs the reader to deliver the response; a reader parked on that handler, or on a permit, deadlocks the connection.
Rejected: inline dispatch on the reader (t3 upstream), which deadlocks on re-entrant requests.

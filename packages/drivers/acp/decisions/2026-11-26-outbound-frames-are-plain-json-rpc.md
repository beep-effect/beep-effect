---
title: Outbound ACP frames carry only plain JSON-RPC members, not effect-rpc's envelope
date: 2026-11-26
reversal: Pass RpcClient messages to the encoder unchanged in offerOutgoing, encode notifications as id-less Requests, and delete toAcpWireRequest.
governs:
  - src/AcpProtocol.service.ts#toAcpWireRequest
  - src/AcpProtocol.service.ts#makeAcpPatchedProtocol
enforcedBy: []
---

`toAcpWireRequest` drops a typed call's effect trace ids and headers, `offerOutgoing` never writes an `@effect/rpc/Interrupt`, and `sendNotificationEffect` encodes a raw JSON-RPC notification with no `id`.
Reason: a strict peer rejects unknown members, and the trace ids would leak internal span ids. RpcClient emits `Interrupt` when a pending typed call is interrupted; ACP has no such method and agents log it as an error. A Request encoded without `isNotification` carries an id, which real agents (Grok CLI) read as a malformed request and silently drop.
Rejected: writing effect-rpc's encoded messages as they come, which breaks strict and real agents.

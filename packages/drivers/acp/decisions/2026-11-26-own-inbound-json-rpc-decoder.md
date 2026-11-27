---
title: Inbound ACP frames go through the package's own JSON-RPC decoder, not effect's ndJsonRpc parser
date: 2026-11-26
reversal: Decode stdout with RpcSerialization.ndJsonRpc in makeAcpPatchedProtocol and delete makeNdJsonRpcFrameDecoder and normalizeAcpJsonRpcError.
governs:
  - src/internal/jsonrpc.ts#makeNdJsonRpcFrameDecoder
  - src/internal/jsonrpc.ts#toResponseMessage
  - src/AcpProtocol.service.ts#normalizeAcpJsonRpcError
  - src/AcpProtocol.service.ts#makeAcpPatchedProtocol
enforcedBy: []
---

`makeNdJsonRpcFrameDecoder` mirrors the envelope mapping of effect's `RpcSerialization.ndJsonRpc` (4.0.0-rc.113), but reads each line through `readJsonText` and yields only requests, chunks and exits (`AcpInboundMessage`). Batches are not correlated: ACP never sends them.
Reason: `JSON.parse` on V8 12.8 through 13.7 (Node 24, Electron 36 and 37) can turn an escaped `_meta` key such as "\n" into "\\", and the effect parser does not allow injecting another reader.
An ACP peer has no effect-rpc control plane. An id-less `@effect/rpc/<Tag>` method stays an ordinary request or notification, because a peer `Eof` would end our writer and an `Interrupt` would stop a typed handler.
An error object tagged `Defect` stays the response of the id it carries, because effect applies a connection-level defect to every in-flight call; the protocol logs and drops one no outstanding request claims. A member `_tag` other than `Cause` is ordinary data, since ACP error objects allow extra members.
effect's codec reads a standard error object in a `Cause` envelope whose data is not a cause array as a defect; `normalizeAcpJsonRpcError` restores a single protocol-shaped defect to a `Fail` entry, the peer's typed failure.
Rejected: effect's `ndJsonRpc` parser as-is, which leaks the V8 key bug and lets one peer line end the writer or fail every pending request.

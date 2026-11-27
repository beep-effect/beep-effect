---
title: Dual-generation unions list their members in a deliberate order
date: 2026-11-26
reversal: Reorder the union members in the Compat RPCs and AcpSessionUpdateParams, generation 2 first.
governs:
  - src/AcpRpc.models.ts#CompatNewSessionRpc
  - src/AcpRpc.models.ts#CompatPromptRpc
  - src/AcpProtocol.service.ts#AcpSessionUpdateParams
enforcedBy: []
---

Compat RPC results decode as the compat shapes (generation 1 plus the legacy `models`) before the generation-2 member. The compat request member comes first, so a caller's payload reaches a generation-1 agent unchanged: RpcClient builds payloads with `make`, and the generated generation-2 `S.tag` discriminators have constructor defaults that would tag an untagged generation-1 stdio MCP server as `type: "stdio"`.
A generation-1 prompt result decodes as the compat result (open stop reason) before the open generation-2 acknowledgement, which accepts any object (`messageId` optional); the client keeps the stop reason of a result that still falls through to it.
`session/update` params decode as generation 2 first, then generation 1: the open generation-2 structs keep the prompt `error` some agents send on an idle as JSON instead of failing. The compat member is last; it is what `transformSessionUpdate` returns, so dispatched notifications carry the decoded wire shape or the normalized one.
Rejected: generation-2-first RPC unions, which rewrite generation-1 payloads and drop generation-1 result fields.

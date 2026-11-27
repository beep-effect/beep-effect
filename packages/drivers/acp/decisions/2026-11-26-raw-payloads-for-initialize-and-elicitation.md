---
title: The negotiating initialize and elicitation/create RPCs take an unknown payload
date: 2026-11-26
reversal: Give CompatInitializeRpc and CompatElicitationRpc union payload schemas over both generations.
governs:
  - src/AcpRpc.models.ts#CompatInitializeRpc
  - src/AcpRpc.models.ts#CompatElicitationRpc
  - src/AcpClient.service.ts#serveElicitation
enforcedBy: []
---

The negotiating `initialize` request carries both generations' field names on purpose; a union encoder would pick one member and drop the other generation's fields before they reach the agent.
`elicitation/create` is decoded by the client itself (`serveElicitation`), so a malformed request is answered with -32602 without calling the handler.
Rejected: union payload schemas, which strip negotiation fields and fail a malformed elicitation inside RpcServer.

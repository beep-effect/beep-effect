---
title: McpServer.layerHttp owns the Origin check and the OPTIONS route
date: 2026-11-26
reversal: Leave layerHttp's allowedOrigins unset and declare an explicit OPTIONS route on /mcp.
governs:
  - server/OntologyMcpTransport.ts#makeOntologyMcpTransportLayer
enforcedBy: []
---

`McpServer.layerHttp` runs its own DNS-rebinding Origin check and answers 403 to any Origin outside `allowedOrigins`; left unset it rejects every browser-origin request. It receives `ontologyMcpAllowedOrigins`, the same allowlist the origin middleware and CORS layer enforce.

`layerHttp` also declares the OPTIONS route itself. The transport declares none: a second declaration on one path is a hard router error, and `HttpMiddleware.cors` already answers every OPTIONS request with a 204 before a route handler runs.

`layerHttp` fails with `IllegalArgumentError` only on a malformed path or an empty protocol list, both literals here, so the server layer is `Layer.orDie`: a failure is a defect, not a startup condition the shell can report.

Rejected: an explicit OPTIONS route, and an unset or separate origin list.

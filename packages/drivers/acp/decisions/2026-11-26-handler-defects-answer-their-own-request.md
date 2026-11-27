---
title: A dying request handler answers its own request id, and RpcServer runs with no error reporter
date: 2026-11-26
reversal: Drop disableFatalDefects and ErrorReporter.layer([]) from serveAgentRpcs and serveClientRequests.
governs:
  - src/AcpAgent.service.ts#serveAgentRpcs
  - src/AcpClient.service.ts#serveClientRequests
enforcedBy: []
---

Both RPC servers run with `disableFatalDefects: true`, so a handler defect answers its own request id and the server keeps reading, and with an empty `ErrorReporter` set.
Reason: `runHandler` already logs the defect with its method and answers it; an inherited reporter would report the same defect again.
Rejected: RpcServer's default fatal defects, where one handler bug fails the whole connection.

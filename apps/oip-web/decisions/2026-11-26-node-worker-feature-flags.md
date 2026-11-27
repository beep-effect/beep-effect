---
title: node worker feature flags
date: 2026-11-26
reversal: Forward all parent Node execArgv flags into Next build workers.
governs:
  - next.config.ts#blockedNodeWorkerFlag
enforcedBy: []
---

Remove --js-float16array from the parent execArgv before Next can spawn build workers.
Reason: Next copies parent flags into worker NODE_OPTIONS, where V8 rejects this feature flag.
Rejected: forwarding the complete parent argument list and failing worker startup.

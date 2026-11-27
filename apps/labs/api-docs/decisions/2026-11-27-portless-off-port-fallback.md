---
title: api-docs listens on 8787 when Portless does not inject PORT
date: 2026-11-27
reversal: Drop the Config.withDefault(8787) fallback so a missing PORT fails at startup.
governs:
  - src/main.ts#main
enforcedBy: []
---

Portless injects `PORT` for `api-docs.labs.beep.localhost`; without it, the server listens on 8787.
Reason: the `PORTLESS=0` diagnostic bypass runs the server with no injected `PORT`, and it must still start on a known port.
Rejected: requiring `PORT`, which breaks the diagnostic bypass.

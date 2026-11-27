---
title: api-docs listens on 8787 when Portless does not inject PORT
date: 2026-11-27
reversal: Drop the Config.withDefault(8787) fallback so a missing PORT fails at startup.
governs:
  - src/main.ts#main
enforcedBy: []
---

Portless injects `PORT` for `api-docs.labs.beep.localhost`; without it, the server listens on 8787.
Reason: a run without `PORT` (a bare `bun src/main.ts`, or `PORTLESS=0` without the `PORT=<port>` that `DESIGN.md` documents for the diagnostic bypass) still starts on a known port instead of failing at startup.
Rejected: requiring `PORT`, which turns such a run into a startup configuration error; the documented bypass sets `PORT` and works either way.

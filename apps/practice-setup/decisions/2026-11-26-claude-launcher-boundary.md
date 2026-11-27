---
title: Prefer the current per-user Claude launcher
date: 2026-11-26
reversal: Open every extension or claude link through its registered Windows handler.
governs:
  - src/Setup.services.ts#SetupHost
  - src/Setup.services.ts#SetupHostShape
enforcedBy: []
---

Prefer the per-user Claude executable for extension files and claude links; use Windows opening only when that launcher is absent.
Reason: Claude updates can leave the protocol handler pointing to a removed app-version directory, while the per-user launcher starts the current version.
Rejected: always invoke the registered handler. Pass both text inputs as environment variables so neither is parsed as PowerShell.
Explorer may exit 1 after opening its target; ignore that exit on the fallback file-open path.

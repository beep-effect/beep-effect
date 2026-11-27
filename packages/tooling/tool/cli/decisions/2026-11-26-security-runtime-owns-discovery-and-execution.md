---
title: Security.runtime owns both runtime discovery and child-process execution
date: 2026-11-26
reversal: Move securityRuntime into a Security.config.ts role and import it from Security.runtime.ts.
governs:
  - src/commands/Codex/Security.runtime.ts#securityRuntime
  - src/commands/Codex/Security.runtime.ts#runSecurityCli
enforcedBy: []
---

A Security process is only ever spawned against a verified pin, so `runSecurityCli` and the
discovery that verifies the pinned package and plugin (`securityRuntime`) share one module. That
module holds the config-provider concern a `.config.ts` role would normally own, so neither concern
reaches into the other.

Rejected: a separate `Security.config.ts` role for discovery, which splits the pin check from the
only code that depends on it.

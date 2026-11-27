---
title: The client keeps t3's error-idle prompt completion and its local failures of generation-2-only methods
date: 2026-11-26
reversal: Fail the prompt on an idle with stopReason error in completePrompt, and gate deleteSession and providers/* on advertised capabilities instead of failLocally.
governs:
  - src/AcpClient.service.ts#completePrompt
  - src/AcpClient.service.ts#providerMethods
  - src/AcpClient.service.ts#sessionManagementMethods
enforcedBy: []
---

An idle `state_update` ends the generation-2 turn of its session whether or not a session-update handler is registered yet. An idle that reports an error still completes the prompt; the error stays visible to session-update handlers.
Generation 1 defines `session/delete` and `providers/*`, but a generation-1 client fails `deleteSession`, `listProviders`, `setProvider` and `disableProvider` locally with method-not-found.
Reason: parity with t3 `packages/effect-acp`, which these paths are ported from.
Rejected: failing the prompt on an error idle, and forwarding the generation-1 provider and delete methods.

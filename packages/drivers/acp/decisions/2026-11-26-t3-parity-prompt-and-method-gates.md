---
title: The client keeps t3's generation-2 default, error-idle prompt completion and local generation-1 method failures
date: 2026-11-26
reversal: Start a negotiating client on generation 1 in initialGeneration, fail the prompt on an idle with stopReason error in completePrompt, and gate deleteSession and providers/* on advertised capabilities instead of failLocally.
governs:
  - src/AcpClient.service.ts#initialGeneration
  - src/AcpClient.service.ts#completePrompt
  - src/AcpClient.service.ts#providerMethods
  - src/AcpClient.service.ts#sessionManagementMethods
enforcedBy: []
---

Before `initialize` answers, a negotiating client takes the generation-2 paths.
An idle `state_update` ends the generation-2 turn of its session whether or not a session-update handler is registered yet. An idle that reports an error still completes the prompt; the error stays visible to session-update handlers.
Generation 1 defines `session/delete` and `providers/*`, but a generation-1 client fails `deleteSession`, `listProviders`, `setProvider` and `disableProvider` locally with method-not-found.
Reason: parity with t3 `packages/effect-acp`, which these paths are ported from.
Rejected: generation-1 paths before the initialize reply, failing the prompt on an error idle, and forwarding the generation-1 provider and delete methods.

---
title: The HTTP sidecar raises Bun's idle timeout to its 255-second maximum
date: 2026-11-26
reversal: Drop the idleTimeout override and let Bun's 10-second default apply.
governs:
  - server/main.ts#bunMaxIdleTimeoutSeconds
enforcedBy: []
---

The HTTP transport serves streamed chat turns. Bun's default 10-second `idleTimeout` severs a streamed response during the silent tail of a turn, when no bytes flow while the model thinks, so the sidecar sets it to 255 seconds, Bun's maximum, which covers the turn budget. The proof-of-concept server made the same choice.

Rejected: the 10-second default, which cuts long turns off mid-stream.

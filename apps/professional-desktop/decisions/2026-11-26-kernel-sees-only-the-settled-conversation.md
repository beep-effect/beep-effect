---
title: The turn kernel sees only the settled active-branch conversation, one turn at a time per thread
date: 2026-11-26
reversal: Send every timeline turn to the kernel, accept a prompt behind an orphaned user turn, and let turns on one thread run concurrently.
governs:
  - src/chat/ChatOrchestrator.ts#projectActiveBranchToHistory
  - src/chat/ChatOrchestrator.ts#repairOrphanedUserTurn
  - src/chat/ChatOrchestrator.ts#holdThreadTurnPermit
  - src/chat/ChatOrchestrator.ts#trackedThreadTurn
enforcedBy: []
---

The model never sees an unanswered prompt other than the one it is answering. Three rules keep that true.
History is the active branch only. Flattening every turn handed the kernel the tail an edit had replaced, so a rewritten prompt was answered in the context of the wording it replaced.
Before a send appends its user row, an active branch that ends in a user prompt (left by an assistant-store outage) is repaired, so the kernel is never handed two unanswered user turns. If the store is still down, the send fails before appending and the repair runs again after recovery.
A turn (append, stream, persist) holds its thread's permit for the life of the stream, released when the stream's scope closes on completion, failure or stop, so a concurrent send waits.
Rejected: concurrent turns on one thread. Two windows on one thread interleaved: both prompts landed with no answer between them, both kernels answered the first, and a reload showed the corruption persisted.

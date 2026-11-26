---
title: A stopped or failed assistant turn persists only a terminal note, and persists at most once
date: 2026-11-26
reversal: Persist nothing for an unfinished turn, or persist its partial model output, and fail the send when usage accounting fails.
governs:
  - src/chat/ChatOrchestrator.ts#STOPPED_NOTE
  - src/chat/ChatOrchestrator.ts#FAILED_NOTE
  - src/chat/ChatOrchestrator.ts#streamAndPersist
enforcedBy: []
---

The assistant-turn stream persists once, behind a single-shot `Ref`. A finished turn stores its streamed blocks, sorted by envelope index and lifted to a Document, then appends the finalized-turn usage record. A turn that stops or fails stores only "(stopped)" or "(failed)": never the partial model output and never a usage record, so half-generated content is not kept and nothing is billed. The note is appended after whatever had streamed, so a stopped answer reads as truncated and an empty one still records that the request was made and abandoned.
The exit handler claims the persist for unfinished turns; on the success path it is a no-op. A persistence failure there is logged and swallowed so it never replaces the original cause.
Once the answer is committed, a usage-accounting failure is logged as a warning and does not fail the turn.
Rejected: erasing the unfinished turn entirely. The prompt stayed in the thread with no answer, the next prompt arrived after an unanswered request, and the model answered the abandoned one (a stop-then-send returned the cancelled reply); a reload showed the prompt orphaned with no way to retry.
Rejected: failing the turn on a usage-record failure. A delivered answer was reported as a rejected send, the client handed the prompt back, and a retry produced the answer twice.

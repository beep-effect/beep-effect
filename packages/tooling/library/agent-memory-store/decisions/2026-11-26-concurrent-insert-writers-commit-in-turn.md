---
title: The concurrent-insertion test commits its two writers' batches one after the other
date: 2026-11-26
reversal: Append the two writers' batches concurrently, for example with Effect.all and unbounded concurrency over the two connections.
governs:
  - test/MarkdownProjector.byte-identity.test.ts#appendWritersInTurn
enforcedBy: []
---

The AC-1 concurrent-insertion test builds both writers' inserts against the same base before either commits, then appends the first connection's batch and only then the second's.
bun:sqlite waits for a busy lock synchronously, so two connections in one process that interleave inside a transaction would block the thread that holds it.
The concurrency under test is two batches naming one predecessor from one base, which commit order does not change.
Rejected: appending both batches concurrently (the natural shape for a concurrency test, which would block the one Bun thread holding the lock).

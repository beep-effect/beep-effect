---
title: The journal watcher arms before it catches up, re-arms after a watch ends, and gives up after bounded immediate completions
date: 2026-11-22
reversal: Catch up with an ingest first and arm fs.watch afterwards, loop the supervisor unconditionally, or fail the layer when the watch cannot be established.
governs:
  - src/Journal.ts#makeEngine
  - src/Journal.ts#MAX_IMMEDIATE_REARMS
enforcedBy: []
---

Arm first, then catch up. Catching up first leaves a window where the file grows while nothing watches and nothing re-reads, so in a quiet journal the write stays invisible for hours as a stale `latest` and an idle subscription. `onReady` releases the catch-up once the backend can buffer events; completion releases it too, so a failing or ending watch still reaches the re-arm loop instead of hanging. The catch-up ingest after arming includes growth during registration, and a stable file contributes no envelopes.
Each watch event is a poke: re-stat and ingest, never a source of paths. When the file watch ends (the file was replaced or removed) the supervisor ingests and re-arms, because a node watcher follows the inode and the old registration is attached to a file nobody writes to.
The loop is bounded: a watch that ends without the cursor moving counts as an immediate completion, and after `MAX_IMMEDIATE_REARMS` the supervisor stops with a warning returned in one statement, so the log line is the observable stop. No timer is permitted to back off, and an unbounded loop on an unsupported backend or a vanishing path is a hot spin.
The supervisor's failure is ignored: the journal keeps working for local appends and stops observing external ones. Failing the layer would break the missing-journal contract that construction succeeds.
Rejected: catch up, then arm. Rejected: an unbounded re-arm loop. Rejected: a backoff timer.

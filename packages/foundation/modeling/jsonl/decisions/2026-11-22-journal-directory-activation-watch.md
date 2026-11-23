---
title: A missing journal is activated by a directory watch that only pokes, then handed to a file watch
date: 2026-11-22
reversal: Watch config.path directly with one fs.watch call, or keep the directory watch for the journal's whole life and branch on WatchEvent tags.
governs:
  - src/Journal.ts#makeEngine
  - src/Journal.ts#lastSeparator
  - src/Journal.ts#basenameOf
  - src/Journal.ts#parentOf
enforcedBy: []
---

The journal file is watched once it exists: one `Update` per append and trustworthy tags. While it does not exist, its directory is watched, because `fs.watch` stats first and fails on a missing path. No timer anywhere; activation is event-driven.
Directory-watch tags are not trustworthy (the node backend reports a creation and an append both as `Remove`, with a bare relative path), so that watch never branches on `WatchEvent._tag`: an event whose basename matches the journal filename is an untyped poke to re-stat the journal. `event.path` is used for that comparison only and never opened, on either watch; it can resolve against the process CWD and produce a phantom `JournalNotFound`.
The directory watch ends as soon as the journal exists, stopping only upstream pulls so a downstream ingest that already advanced the cursor finishes publishing first; the supervisor then arms the file watch. A non-recursive directory watch reports creation, not later appends, so staying on it would miss every external append. Creation can finish before the watch installs, so the journal is re-stat'ed once `onReady` says the backend can buffer events.
`parentOf` is the only path this package derives and hands to the filesystem, as `JournalConfig.directory`'s default; paths are otherwise opaque. `lastSeparator` checks both `/` and `\`: a Windows path has no `/`, and matching `/` only would point the activation watch at the CWD. A caller whose path convention does not fit names the directory explicitly.
Rejected: one watch on the journal path, which fails on a missing file. Rejected: polling for creation.

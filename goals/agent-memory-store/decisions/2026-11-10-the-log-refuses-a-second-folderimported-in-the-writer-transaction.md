---
title: "The log refuses a second FolderImported in the writer transaction"
date: 2026-11-10
lane: "agent-memory-store-p1"
reversal: "Drop the FolderImported handler check and the race mapping together with decision second-import-is-idempotent-on-a-projected-folder, once one log may hold several folders"
---

Review finding on PR 3058: the projector decided first import from its in-memory fold, outside the journal transaction, so two first imports racing on one database both landed and doubled every file. The FolderImported handler now fails the batch with FolderAlreadyImportedError when the order table already holds a FolderImported, inside the writer transaction, so the whole losing import (its NodeCreated and FileImported events with it) appends nothing. Matching decision second-import-is-idempotent-on-a-projected-folder, the losing projector returns the current base when its folder digest equals the imported one and fails with ForeignFolderError otherwise. The finding's second ask, refusing a NodeCreated with no predecessor for a file that already has a root, is not taken: several roots are how an insert at the top of a file is written (decision file-is-an-ordered-node-partition orders them newest first, and the AC-1 replay inserts at the top), and the race is closed by the FolderImported check because an import is one journal transaction (decision folder-import-is-one-journal-transaction). Tests: the second-FolderImported case in test/MemoryLog.test.ts and the two lost-race cases in test/MarkdownProjector.test.ts.

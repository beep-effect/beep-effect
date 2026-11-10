---
title: "Export fence rows are inserted in chunks of 300 inside one transaction"
date: 2026-11-10
lane: "agent-memory-store-p1"
reversal: "Insert the fence rows in one statement again if the store moves to a driver without a bound-parameter limit"
---

Review note on PR 3058: recordFolderFiles bound three parameters per file in one INSERT, so a folder of about 10,900 files would pass SQLite's 32,766 bound-parameter limit. The rows now go in chunks of 300 (900 parameters, under the 999 limit of the oldest SQLite builds) inside one transaction, so a folder's rows still land all or none. Test: the 301-file import case in test/MarkdownProjector.test.ts.

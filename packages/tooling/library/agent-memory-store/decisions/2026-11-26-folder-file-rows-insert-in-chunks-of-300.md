---
title: Folder file rows are inserted in chunks of 300 inside one transaction
date: 2026-11-26
reversal: Insert every fence row in one statement again once the store runs only on a driver without a bound-parameter limit.
governs:
  - src/MarkdownProjector.layer.ts#FOLDER_FILE_ROWS_PER_INSERT
  - src/MarkdownProjector.layer.ts#make
enforcedBy: []
---

Each fence row binds three parameters. 300 rows bind 900, under the 999-parameter limit of the oldest SQLite builds and far under the 32,766 of current ones, so a folder of any size can be recorded. The chunks run inside one transaction, so a folder's rows still land all or none.
Rejected: one statement for every row (a folder of about 10,900 files passes the 32,766 limit), and one statement per row (a large folder pays one round trip per file).

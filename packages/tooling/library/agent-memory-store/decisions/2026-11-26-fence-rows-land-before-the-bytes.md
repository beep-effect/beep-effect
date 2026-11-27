---
title: Export fence rows are recorded before the bytes they describe, and with the import batch
date: 2026-11-26
reversal: Record the fence rows after the files are written and after the import batch commits, in their own transactions.
governs:
  - src/MarkdownProjector.layer.ts#make
enforcedBy: []
---

`recordFolderFiles` lands the rows for a file's new bytes before `exportFolder` writes them, so a write cut short leaves every file at old or new bytes the fence knows.
On import the rows and the import batch commit in one transaction: the journal's writer transaction runs on this fiber's connection as a savepoint inside it, so a refused or failed append rolls the rows back and a folder holds fence rows only when its import landed. The log refuses a second `FolderImported` in that transaction, so of two first imports racing on one database exactly one lands.
A first import that lost that race with the same folder digest is the same import: the folder's bytes are the log's, so its fence rows are recorded then. A folder with another digest is foreign and keeps none.
Rejected: rows after the bytes (a cut-short export leaves bytes the fence never saw and the next export refuses the folder), and rows in their own transaction after the import (a failed append leaves rows for a folder the log never imported).

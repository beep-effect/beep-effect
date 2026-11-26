---
title: "P6: email rows are walled by archive and folder-prefix bindings to one matter; unbound messages are denied"
date: 2026-11-24
lane: "p6"
reversal: "Remove MailFolderBinding from MatterScope and leave email_search unwalled, recording why in a decision"
---

Independent review of the P6 design. email_messages carries no docket, family or client column (server/src/PracticeKg.fts.ts:93-107); the existing email_search family filter is a substring match on subject or folder (PracticeKg.queries.ts:100-112, the $5 parameter), and the tool notes that matter linkage is archive-level confidence only (PracticeKg.tool-handlers.ts:79-80). A docket-family filter therefore either drops every email or matches text, which is not authorization. MatterScope gains mailFolders: HashSet<MailFolderBinding { archive, folderPrefix }>, binding the messages of one archive (archive_digest) under one folder path prefix to one matter. email_search filters inside its SQL by the granted bindings (archive_digest equal and folder_path prefixed); a message under no granted binding is not returned, and the free-text family filter stays a text filter. MatterAuthorityConfig refuses a binding whose prefix is a prefix of another matter's binding in the same archive. The bindings are evaluated at query time against configuration, so a grants change needs no rebuild. The two-matter fixture puts a message in each matter, and path 4 asserts email_search as well as corpus_search_text. Until the operator writes the bindings (the row 14 HOLD), email_search returns nothing.

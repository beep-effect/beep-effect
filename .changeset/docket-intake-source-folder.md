---
"@beep/law-practice-use-cases": minor
---

Docket intake now records where in the mailbox a message was found.
`DocketMessage` gains `sourceFolder` (`DocketSourceFolder`: `mailbox`, `junk`
or `deleted`, default `mailbox`), and `DocketEntryFlag` gains `junk-folder` and
`deleted-folder`. Every entry written for a message found in Junk Email or
Deleted Items carries the matching flag and a line saying where it was found.

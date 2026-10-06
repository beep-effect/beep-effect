---
"@beep/law-practice-domain": patch
"@beep/law-practice-use-cases": patch
"@beep/law-practice-server": patch
---

Add the mail-tagging adapters: the Outlook mailbox over `@beep/m365` with a
safe stale-write retry, the matter directory over the practice KG with the KG
reference extractor feeding the tagger, the Box document store with per-run call
metering, and file-backed folder and known-document lookups behind one service layer.

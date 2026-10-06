---
"@beep/law-practice-server": patch
---

Read files held outside any matter from the known-documents index instead of
failing the run: a null or absent family key decodes as none and never counts
as known for a matter.

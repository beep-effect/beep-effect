---
"@beep/editor": patch
"@beep/professional-desktop": patch
---

Make the composer send/stop toggle the single canonical stop control while a turn streams (the
in-thread duplicate is removed), and reject self-referential, forward, or missing parent links
before rendering the branch versions marker.

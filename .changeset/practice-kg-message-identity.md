---
"@beep/law-practice-server": patch
"@beep/practice-kg-mcp": patch
---

Count a filed email and its archive copy once (by `Message-ID`), treat an
archive item without a `Message-ID` as one message across export trees, and
stamp archive-mail builds with bundle version `2026-10-07-03` by default.

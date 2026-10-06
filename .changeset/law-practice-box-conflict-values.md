---
"@beep/law-practice-server": patch
---

The mail-tagging document store now reads the conflicting file's size and SHA-1 from a Box name
conflict, so a rerun after an interrupted upload reconciles the file it already uploaded instead of
filing a short-hash duplicate. A single-object upload conflict from Box identifies the holder.

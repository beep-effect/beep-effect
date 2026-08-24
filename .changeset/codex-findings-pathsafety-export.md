---
"@beep/file-processing": patch
---

Export the isResolvedPathWithinRoot containment predicate from PathSafety so
CLI filesystem guards reuse the platform-aware policy instead of cloning it.

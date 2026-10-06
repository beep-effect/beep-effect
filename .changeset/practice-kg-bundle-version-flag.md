---
"@beep/law-practice-server": patch
"@beep/practice-kg-mcp": patch
---

`build.ts --bundle-version <version>` stamps a rebuilt practice knowledge-graph bundle with a caller-chosen version (`PracticeKgOptions.bundleVersion`), so rebuilding from a newer corpus no longer needs a source change. Omitting it keeps the build's default version.

A document the organizer already placed keeps its original run label, size and date when a folded-in run holds a second copy of it; `source_origin_chain` still lists every run the file appears in.

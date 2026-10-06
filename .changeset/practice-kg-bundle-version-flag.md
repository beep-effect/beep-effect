---
"@beep/law-practice-server": patch
"@beep/practice-kg-mcp": patch
---

`build.ts --bundle-version <version>` stamps a rebuilt practice knowledge-graph bundle with a caller-chosen version (`PracticeKgOptions.bundleVersion`), so rebuilding from a newer corpus no longer needs a source change. Omitting it keeps the build's default version.

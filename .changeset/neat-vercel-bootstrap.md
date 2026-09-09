---
"@beep/oip-web": patch
"@beep/todox": patch
---

Isolate Vercel's pinned Bun bootstrap from npm's workspace dependency parsing
so deployments can install and build with Bun catalog entries and scoped overrides.

---
"@beep/oip-web": patch
"@beep/repo-configs": patch
---

Use Bun 1.4.2 for OIP web deployment installs and builds, and align the shared
Next.js configuration schema with the updated Next.js Web Vitals metrics by
rejecting the removed FID metric while continuing to accept INP.

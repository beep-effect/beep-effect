---
"@beep/oip-web": patch
"@beep/todox": patch
"@beep/repo-configs": patch
---

Read the Bun runtime for OIP and Todox deployment installs and builds from the
canonical `.bun-version` file so future upgrades cannot leave deployment pins
behind. Align the shared Next.js configuration schema with the updated Next.js
Web Vitals metrics by rejecting the removed FID metric while accepting INP.

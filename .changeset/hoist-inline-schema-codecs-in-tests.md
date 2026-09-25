---
"@beep/schema": patch
"@beep/pglite": patch
"@beep/tailscale": patch
---

Hoist inline schema codecs and guards in the HTTP header, PGlite client and Tailscale test suites
to module scope so the test files satisfy the oxlint no-inline-schema-compile rule.

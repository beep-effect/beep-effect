---
"@beep/utils": patch
---

Guard the HostProcess module-load platform/architecture reads through `globalThis.process` so browser bundles evaluate the `@beep/utils` barrel without throwing; the constants fall back to `"browser"` / `"unknown"` when no process global exists.

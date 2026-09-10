---
"@beep/m365": minor
---

Make `@azure/msal-node-extensions` an optional peer dependency instead of an
optional dependency, so its native `keytar` addon leaves the workspace install
graph. Hosts that set `tokenCachePath` declare the extension themselves.

---
"@beep/professional-desktop": patch
"@beep/db-admin": patch
"@beep/test-utils": patch
---

Add the in-process PGlite driver package, wire professional desktop runtime
persistence through it, and share migration/test helpers for PGlite-backed
integration tests. Professional Desktop now fails closed with a recovery log
when an existing `CHAT_DB_PATH` looks like a prior PGlite store but cannot be
opened by the bundled in-process runtime, leaving the data directory untouched
instead of silently resetting chat history. The former `pglite-socket`
`CHAT_DB_PORT` TCP loopback endpoint is removed with this in-process runtime;
local debugging should point tools at a disposable or existing file-backed
`CHAT_DB_PATH` instead.

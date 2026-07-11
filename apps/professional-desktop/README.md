# @beep/professional-desktop

## Chat Database Compatibility

The desktop sidecar owns `CHAT_DB_PATH` with the bundled in-process PGlite runtime. The app pins `@electric-sql/pglite` to the version that matches `@effect/sql-pglite`; this keeps the compiled sidecar assets and the runtime driver in lockstep.

If an existing `CHAT_DB_PATH` was created by an older desktop build and cannot be opened by the current runtime, boot fails closed and leaves that directory untouched. To preserve data, run the older build once, export the chat database, then import it into a fresh directory created by the current build. To reset local state, move the old `chat-db` directory aside or point `CHAT_DB_PATH` at an empty directory before launching the current build.

The sidecar writes `.beep-pglite-inprocess-v2` only after the current runtime opens the directory and migrations finish. That marker means future boots still probe the directory, but they do not treat it as a legacy non-PGlite folder.

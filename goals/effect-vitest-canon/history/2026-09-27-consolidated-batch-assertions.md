# Consolidated batch assertion phase

Shared Tables now uses assertNone for the three original absent index lookups.
Every lookup, polarity and other metadata assertion is unchanged. Package audit,
four configured tests and docgen pass.

M365 MCP uses pipe(first, O.isSome, assertTrue) for the existing Boolean Some
observation. The subsequent non-failure assertion and payload branch are retained.
The first nested-helper spelling exposed TS377050; the pipe form passes the
full package audit, 20 configured tests and docgen. No expected payload or error
was invented in this phase. OnePassword CLI needs no assertion migration.

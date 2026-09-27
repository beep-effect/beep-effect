# AI metrics native resources and privacy observation

The saved AI metrics inventory contains 408 findings, including six resource
proposals. This batch consumes those proposals before the remaining assertion,
property, flake and runner work. The package baseline passes 377 tests with zero
skips on both Node and Bun. Native filesystem, DuckDB and shell boundaries remain
real; no provider request or secret resolution is introduced.

The two DuckDB overload tests and the retention NULL-timestamp test now use the
public `it.layer(NodeServices.layer)` harness. Their temporary-directory
`acquireUseRelease` lifetimes are unchanged. Retention still closes its seeding
connection, runs retention in a separate connection scope, and reopens for the
final observation before deleting the root. Both overloads and SELECT results
remain asserted.

Thirty-nine direct whole-test `Effect.scoped` wrappers (29 writer, 10 notifier)
are supplied by `it.effect` itself. The installed rc.117 harness scopes both its
normal and layer-provided Effect testers. AST comparison verifies that the only
changes in these two files are those direct wrappers and formatting. Nested
resource boundaries, per-execution temporary paths, isolated HOME, fake local
executables, disarmed stdin, both output drains, exit joins, foreground/setsid
modes and all assertions remain intact. File inventory retains host permission,
symlink and device behavior; the unprivileged POSIX prerequisite held locally.

The Codex subagent privacy test previously compared Option wrappers with raw
strings, so missing and incorrect hashes passed. It now unwraps all three
negative comparisons and additionally asserts Some of independent SHA-256
witnesses for `test-salt`, NUL and each original identifier. Temporary controls
replace each of the session, parent-thread and role values with None or an
incorrect Some hash. All six cases fail the revised complete test and pass its
original version, including the original SQL/storage path. Every mutation was
restored. No production privacy code changed.

Conservation checks retain all 334 original maximal expect expressions across
DuckDB, retention and ingest, and all 59 registrations in those files, with only
the three intended Option unwraps. Three exact Some assertions were added.
Full package verification passes audit (13.5 s) and docgen (4.6 s); root Oxlint
also passes. These are resource-phase results, not whole-goal completion or a
claim that the remaining package proposals are resolved.

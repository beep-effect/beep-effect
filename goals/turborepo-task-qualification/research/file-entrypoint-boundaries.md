# File entrypoint boundary review

At `0dca998780`, the nested inventory resolves twelve file-entrypoint sites to
specific owning workspaces. The six driver `scripts/generate.ts` sites retain
the source interpretation in `generator-boundaries.md`; their current bytes
are bound by the accepted source attachment. This supplement examines the
other entrypoints without executing scripts or changing lifecycle status.

| Sites | Entrypoint | Observed boundary |
| ---: | --- | --- |
| 1 | repo-configs allowlist snapshot generator | Reads the repository allowlist, decodes/renders a snapshot and writes the generated module only when bytes differ. Read failures become snapshot diagnostics, including path/error text; the generator logs counts and does not itself reject a nonempty diagnostic list. Consumers must interpret the snapshot. |
| 1 | db-admin migration drift check | Copies the existing migration tree to a scoped temporary directory, invokes `bunx --bun drizzle-kit generate` against `src/schema.ts`, then compares directory entries. Nonzero generator exit fails. New entries cause generated migration SQL to be printed and the check to fail. The checked-in migration directory is not the selected generation output. |
| 2 | professional-desktop migration bundle sync | Reads db-admin migration subdirectories containing `migration.sql`, sorts by name, renders a TypeScript module and compares the current target. `--check` fails on mismatch; without that flag the script writes the target, including the explicit `--write` invocation. Both modes depend on another workspace's migration contents and membership. |
| 1 | Storybook test wrapper | Chooses supplied story roots or four cross-workspace defaults, recursively discovers and sorts story files, and runs Vitest sequentially in chunks of twenty. Empty discovery fails; all chunk results are collected and any failed chunk sets final exit one. |
| 1 | repo-docgen binary | Reads module version and dispatches the docgen CLI with its process/filesystem services. It explicitly exits on success after default teardown. Full downstream configuration/rendering/compiler/write interpretation remains in the docgen category. |

Storybook installs Chromium's headless shell with Playwright unless `CI` is
exactly `"true"`. That branch can involve network and browser installation
writes. Subprocesses inherit cwd, environment and stdio; executable resolution,
Vitest configuration, browser state and story imports remain semantic inputs.
The wrapper's source-list and chunk summary is not a browser-test verdict by
itself. This review launches no browser or installer.

The migration drift check uses a package-relative schema and temporary output,
with generator stdout ignored and stderr inherited. The generation/import/tool
closure and temporary writes remain part of the check, even though committed
migration files are preserved. Its drift diagnostics print SQL content, so
capture safety requires evidence rather than a generic check-mode assumption.
The comparison detects new directory entries, not a generic byte-for-byte
comparison of all scratch contents.

The desktop bundle sync skips non-directories and entries without migration
SQL. Directory/file presence is therefore an input alongside SQL bytes. An
unreadable target is treated as empty for comparison. Check and write modes
have distinct effect contracts; neither mode applies migrations to a database
in this entrypoint.

The allowlist snapshot generator separates generation from validation. It can
successfully render diagnostics for unavailable or invalid input, and its log
also distinguishes changed from unchanged output. Qualification would need to
capture both generated content and those observable outcomes. A successful
process or unchanged file alone is not proof of a valid law allowlist.

These classifications retain the scripts' downstream import, tool, environment,
write and capture obligations. They grant no runtime qualification, no network
authorization, and no change to the operational census's seven open obligations.

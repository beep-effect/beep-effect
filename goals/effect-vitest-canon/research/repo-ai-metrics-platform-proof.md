# AI metrics static platform layers

The residual mechanical review distinguishes static platform adapters from
per-scenario resource layers. Eighty-seven manual NodeServices provisions now
use the native harness: 34 reuse the ingest suite's existing layer, and 53 use
native test groups. The two filesystem-lock tests retain their live-clock path,
including concurrent writers and the bounded stale-lock failure.

The migration preserves nested scope transforms where a callback establishes an
inner lifetime. Sixty redundant direct test scopes are removed: 51 around the
new native platform groups and the nine existing circuit-breaker/telemetry-store
wrappers. Ingest's inner scoped blocks and archive's function-level scope
transforms remain at their previous boundaries. Temporary directories still use
the original acquisition and release helpers.

All 68 dynamic provisions remain unchanged. They include temporary DuckDB
connections, runtime/Phoenix fixtures, sender permutations, the recording
filesystem and event-log handler. Moving these services to a shared static group
would change their inputs or lifetime. Native filesystem provenance and platform
hook-budget candidates still require explicit inventory adjudication; the
package is not declared complete by this migration.

The newer harness-ledger tests now use `Effect.flip` for four malformed decode
cases and verify the SchemaError tag. Their previous Result wrappers only
observed Failure. Three absent optional fields use individual `assertNone`
checks instead of a boolean array comparison.

An AST audit across all 28 test files preserves test registrations, all temporary
directory helpers and every dynamic provision. It accounts for 1,242 resulting
assertion expressions after explicitly mapping the four failure tags and splitting
the combined None assertion; no original assertion requirement was dropped.
Full package verification passes audit (13.6 s) and docgen (4.7 s), and root Oxlint
passes. Runner integration, owned inventory reconciliation and final Node/Bun
measurements remain outstanding.

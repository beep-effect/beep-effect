# Held forwarder source change and rollback boundary

The historical forwarder service and timer remain masked and inactive. The
foundation worktree changes source discovery to retain a bounded round-robin
cursor in an additive DuckDB table, ai_metrics_discovery_cursors. This source
change has not been installed into or run against the held historical store.
The cursor is scheduling progress, not an ingestion or delivery acknowledgment.

The current full AI-metrics gate covers fair forwarder discovery after read
failure. An additional synthetic compatibility proof ran the current forwarder
on one fixture file, then the previous forwarder implementation from this
worktree's base HEAD against the same disposable database. Both selected one
file. The original implementation preserved the cursor table byte-for-byte at
its row-value boundary and increased retained source rows from one to two.
No historical store, real transcript or service was involved.

Receipt: ops/history/forwarder-schema-compatibility.json. The old source's relative
imports were resolved to current dependency modules; original and rebased source
hashes are retained. This proves rollback of the discovery implementation with
current dependencies. It does not prove rollback of a complete historical
binary, every other schema change, or restoration of historical archives.

Operational reversal before rollout is retaining the existing masked units and
uninstalled replacement. If the discovery implementation is reverted in a future
qualified rollout, leave its harmless cursor table intact. Do not drop evidence
or treat this fixture as authorization to restart the historical collector.
A full binary/store recovery still requires its separate integrity/resource
qualification and explicit release of the hold.

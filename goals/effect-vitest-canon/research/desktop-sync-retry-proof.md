# Sync retry uses an explicit failing public client

The retry UI test now seeds DesktopSyncClient.runtime.layer with a client that
fails through VaultSyncActionError and the standard Reactivity layer. The real
VaultSyncPanel and query atoms still run. Only the client boundary is controlled;
no failure-state atom or Retry element is pre-seeded.

The original case title, Retry visibility and text assertions, registry provider,
and 4,000 ms wait bound remain. A sidecar's availability or response time no
longer determines whether this UI failure-state test enters its subject state.
The generic service stub follows the existing sync-atoms test pattern.

A temporary control made global fetch never resolve. The original test failed
waiting for Retry, while the controlled-client test passed and additionally
asserted that fetch was never called. The temporary spy, its finalizer, and the
extra no-fetch assertion were removed afterward. This demonstrates independence
from the ambient HTTP boundary, without claiming transport conformance here.

Final validation passed the normal Node test, full Desktop audit/docgen, the
Effect/Vitest ratchet with zero introduced findings, schema-first checks, and
strict inventory/census/ledger decoding. Reversing only the client fixture,
provider seed, imports, and corrected comment reproduced the original file
exactly. Desktop-wide ledger reconciliation remains pending.

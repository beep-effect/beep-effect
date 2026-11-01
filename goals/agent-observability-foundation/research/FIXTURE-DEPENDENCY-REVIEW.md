# Standalone fixture dependency ownership

The first delivery Fallow repair mistakenly removed `@beep/ai-provider-cli`
from the AI-metrics development dependencies. Fallow's blanket exclusion of
`**/test/fixtures/**` hid the standalone managed-process fixture's runtime import.
Package audit/docgen passing did not validate that separate process launch.

The independent Astra panel rejected the proposed cache refresh on 2026-10-29:
`test/fixtures/managed-observation-process.ts` imports the provider session,
opens it and supplies its layer, and `verify-worker-entrypoint.py` launches that
fixture directly. This demonstrates dependency ownership even though workspace
linking could conceal an actual runtime resolution failure.

The dependency was restored. The exact fixture is now a Fallow entrypoint and
an exception to the fixture exclusion, so its imports participate in analysis.
No other fixture was admitted and no finding was suppressed. The canonical
lock, tsconfig references, Fallow boundaries and policy fingerprint were synced.
Frozen installation, cache audit and the dead-code check all passed in
`foundation-fixture-dependency-repair-v1` with exit zero and no memory kill.

The restored manifest returns to the previously reviewed SHA-256
`2771e64c027fee88d87effbd6a1dcfebbaa8bf890a661b7232c46d3cc9b82e99`.
No cache baseline refresh was needed or performed for this correction.
The root protobuf catalog entry remains necessary and matches its existing
version override. Current-source installed-process qualification remains open.

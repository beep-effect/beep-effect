# ACP property checkpoint

The existing agent and protocol effectful JSON round-trip properties now use
it.effect.prop. Twelve runtime calls became yielded calls to the same compiled
module codecs. Both arbitrary input arrays, four independent reencoded-string
equality oracles and fcRuns(25) floors remain unchanged. The separate synchronous
four-input schema property retains its original registration and domains.

Full `bun run beep quality package-verify @beep/acp` passed: audit 11.9 seconds
and docgen 4.1 seconds. A separate focused run with BEEP_FC_NUM_RUNS=400 and
BEEP_FC_SEED=20260708 passed all three property registrations. Its 23 non-property
registrations were deliberately excluded by the name filter; that run is property
proof only, not a replacement for the configured whole-package run.

Flake review and observability remain pending. No production changes or generator
narrowing were introduced.

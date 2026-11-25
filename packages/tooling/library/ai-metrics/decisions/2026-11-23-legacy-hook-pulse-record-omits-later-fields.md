---
title: The legacy hook-pulse/v1 record omits every field added after pseudonymization
date: 2026-11-23
reversal: Declare isInterrupt, surface and harnessHash as optional keys on HookPulseLegacyV1Record.
governs:
  - src/hook-pulse.ts#HookPulseLegacyV1Record
enforcedBy: []
---

"Legacy" means exactly one thing: a hook-pulse/v1 row written before private identifiers were
pseudonymized. `isInterrupt` and its only owning event `PostToolUseFailure` were added after that
change, and `surface` and `harnessHash` later still, so no legacy-shaped row can carry them.
The omission is a dating argument, not an oversight.
The raw-identifier fields stay raw for the mirror-image reason: raw is what such a row contains,
and the codec exists to hash them on the way in.
Rejected: declaring the later fields as optional keys for symmetry with HookPulseV1. That models a
combination that cannot exist and suggests some legacy corpus tells an interrupt from an error.

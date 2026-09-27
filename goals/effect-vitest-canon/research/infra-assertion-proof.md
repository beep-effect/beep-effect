# Infrastructure assertion migration

Seventy-five boolean and Option assertions now use public Effect Vitest helpers
across eight files. An AST conservation audit maps each conversion and preserves
all531 original assertion expressions, including nested matcher operands and
polarity. The optional decoded attachStagingDomain false witness uses strictEqual
so undefined still fails without pretending the value is statically boolean.

The full infrastructure package audit passes in8.2 seconds and docgen in5.8
seconds. The audit includes the nested Lambda typecheck, Bun tests and bundle/zip
checks. The unchanged configured Vitest baseline passes93 tests on both runtimes;
Node required the documented generated-SDK preparation and one stale transform
refresh. Baseline receipts remain separate from later migration measurements.
Schema property registration, shell isolation and runner integration remain
outstanding; this is an assertion-phase receipt, not package closure.

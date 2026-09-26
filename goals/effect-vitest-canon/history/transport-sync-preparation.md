# AI Sync and API Transport preparation

This wave uses the existing wave-six inventory from main `7980e5aaa1`.
It covers five recorded files and 41 existing rows. The source snapshot
contains 1,008 current lines, with three files changed since the frozen
census commit `662823dd960367046ba7d73dd8fd25d15782865a`.
No global reinventory is performed for this preparation.

## Before measurements

All four configured runtime runs exited zero with stable source, manifest
and lockfile hashes. Each run preserves load, CPU/memory/IO pressure, runtime
versions and process limits alongside its JSON report.

| Package | Node command | Bun command | Passing tests |
| --- | ---: | ---: | ---: |
| AI Sync | 6.809 s | 3.947 s | 16 |
| API Transport | 7.129 s | 4.140 s | 9 |

Reports are in the preparation/transport-sync timing directory and matching
context directory. Shared-workstation timings are evidence, not controlled
performance comparisons. Package configurations were not changed.

## Ordered review

Current-source review applies the existing resource, property, flake and
observability charters. AI Sync's mixed native and portable filesystem
fixtures need deliberate separation: repository artifact checks must retain
real checkout reads, while synthetic temporary config fixtures are candidates
for MemoryFileSystem. Historical findings already fixed upstream must retain
that attribution. API Transport's runtime boundaries and properties are
reviewed without weakening rate-limit, authorization or retry oracles.

Implementation proceeds in D12 order: scope, assertions, properties, flake,
then instrumentation. This preparation makes no remediation, hosted-readiness
or goal-completion claim. Production changes remain outside this wave.

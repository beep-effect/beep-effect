# OBS P2 migration proof

All 29 saved package records were reviewed: 13 detector candidates and 16
independent lens records. This checkpoint is scoped migration proof, not P1
closure, final goal completion or hosted approval.

Eight service cases now register separate one-test layer fixtures. Their mutable
protocol events, calls and scene-creation Ref are not shared across cases.
PubSub shutdown is explicit. Protocol rejection scopes still release resources
before their errors are inspected. All four test files use the instrumented tester.

The optional native OBS availability probe now owns its listeners/socket and has
a two-second collection deadline. Static phase logs distinguish open, error,
close and timeout; unexpected defects are not converted to skips. The real live
body keeps native services through excludeTestServices and its original 30-second
body timeout. Its layer has an explicit acquisition/release hook budget.

## Preservation and proof

- Assertion/name parity: service 39/39 assertions and 8/8 names; protocol 42/42
  and 10/10; live 5/5 and 1/1. Equivalence is import-only, preserving three
  assertions and two names.
- Non-live Node baseline: 20 tests passed; no OBS connection attempted.
- Migrated non-live Bun tests: 20 passed across three files; test typecheck passed.
- Full package verification: audit passed in 7.6 seconds; docgen in 4.4 seconds.
- Configured Node timing: 20 passed and one optional live case skipped, whole
  command 4.255 seconds. This does not prove an external OBS session executed.
- Exact probe-expression harness with an injected fake WebSocket passed open,
  error, close, timeout, interruption and constructor-defect scenarios. Every
  constructed socket was closed once and all three listeners removed; a
  constructor defect remained a failure. No external connection in this harness.
- Cache projection: only nine OBS computation dependency lists changed; other
  nodes and projection configuration/sources are unchanged.

The timing context retains runtime, source hashes and workstation pressure/load.
Runtime/test population differs from the original census baseline; no causal
speedup is claimed. Private reproducible receipts live under
`~/.cache/beep/effect-vitest-canon/obs-*`.

Two shorter handshake scopes remain intentional exceptions. Ten no-findings
coverage records remain unchanged. The 17 fixes point to implementation commit `1201d9f3fc5609988129bcf0af5b8b05ce01fdb5`.
All 29 records strictly decode; hosted publication remains a separate gate.

## Timing provenance reconciliation

The timing run was collected from uncommitted migration sources while Git HEAD
still named the Cosmos parent. Both context heads now identify the equivalent
committed source tree `242a6ac6b235afd44b8c6475da1daf64b6d1ec74`. Every one of
the 13 saved source/config manifest hashes matches that commit, including the
lockfile, package manifest and four migrated tests. These are source-equivalence
anchors, not a claim that the measurement ran after that commit was created.
Raw report/log hashes, timing, runtime, load and acceptance remain unchanged.

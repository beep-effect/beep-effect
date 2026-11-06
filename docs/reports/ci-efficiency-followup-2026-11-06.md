# CI efficiency follow-up, 2026-11-06

This follow-up addresses four costs observed while qualifying the compiler and
repository performance PR #2751. Its measurements are separate from that PR's
compiler and JSDoc results.

## HTML worker setup in unit-d

The green #2749 unit-d job took about 25 minutes. Within it,
`@beep/law-practice-server` reported 1,375.14 seconds for 141 files and 975 passing
tests (one existing skip). `CitationHtmlWorkerCorpus.test.ts` reported 570.433
seconds and `CitationHtmlBytes.test.ts` reported 394.677 seconds. File durations
can overlap; these numbers must not be summed into a pipeline saving.

Source: [unit-d on #2749](https://github.com/beep-effect/beep-effect/actions/runs/42203199573/job/127843316063).

Those two files verify 1,097 text cases and 589 byte cases. They independently
confirm 859 and 589 child-process exits, respectively. The existing regex fixture
bundles trusted worker source once per runtime, but the HTML fixture still pointed
every child at the TypeScript source entrypoint. Each child repeated its module
loading and transformation work.

The HTML fixture now reuses the existing scoped bundler and copies the pinned
WASM asset into the same relative directory layout. Every case still launches
its own real process. The source-entrypoint smoke test stays unbundled. Request
limits, concurrency, deadlines, exit acknowledgements, corpus hashes, coverage
floors, and production worker code remain unchanged. Temporary bundles and assets
are owned by the test scope; there is no persistent or cross-revision cache.

Initial local Bun/Istanbul comparison, two files / five tests:

| Observation | Source launches | Scoped bundle |
| --- | ---: | ---: |
| Vitest elapsed | 215.81 s | 37.90 s |
| Whole command elapsed | 216.22 s | 38.31 s |
| Peak RSS reported by GNU time | 1,360,728 KiB | 1,298,928 KiB |
| Passing tests | 5 | 5 |
| Per-file coverage-summary entries | 178 | 178 |

All 178 coverage-summary entries were identical. A second optimized run, after
retaining the raw-source smoke control and restoring the fixture service boundary,
passed the same five tests in 37.48 seconds. All 34 tests across the nine fixture
consumer files also passed with Istanbul, including HTML Unicode integration. The first observed elapsed-time
reduction is about 82%. This is a shared-workstation observation, not a controlled
hosted benchmark; GNU time's RSS is not an aggregate of simultaneously alive child
processes. Hosted unit-d must validate the resulting critical-path improvement.

Reproduce from `packages/law-practice/server` on the base and follow-up revision:

```sh
/usr/bin/time -v bunx --bun vitest run \
  test/CitationHtmlBytes.test.ts test/CitationHtmlWorkerCorpus.test.ts --coverage
```

## Publication without a user service manager

In this session Yeet pushed #2751 successfully, then failed while submitting its
background readiness monitor. Its recovery message asked for the same unavailable
background operation again. Publication now probes the existing launcher support,
reuses a live registered monitor first, and otherwise runs the same readiness
monitor attached when background services are unavailable. The submit lock is
released before waiting on the attached monitor.

An attached monitor is not durable: the publishing process must remain alive.
A nonzero monitor result still fails the publication tail and names the attached
continuation command; it does not certify readiness. Explicit `--detach` retains
its existing requirement for a user service manager. No hosted check or review
window is bypassed.

## Reusing proof after a main merge

`yeet ready` previously returned immediately for an already-ready PR, before
validating its new head's final-check proof. That prevented using the existing
ancestor-receipt refresh path to verify a clean base merge through this command.
The operator repeated local checks instead: the latest replay included 2m30s of
cheap checks, 1m47s of policy checks and 2m05s of documentation checks.

The already-ready path now validates the current-head proof with the same helper
used before a draft flip. It can carry an eligible ancestor receipt, prints its
provenance and recorded skips, and refuses missing or failing proof. It performs
no extra ready flip or review-trigger push. The refresh allowlist and hosted
acceptance gates are unchanged; no new receipt is fabricated.

## Packet scaffolding should not run native test suites

[PR #2750](https://github.com/beep-effect/beep-effect/pull/2750/files) changed only
packet prose, recognized manifests and directory placeholders. Its `goals/`
`.gitkeep` files were absent from the docs-only classifier, so the code-bearing
fallback ran unit-d and other unrelated code lanes. The exact three locations
emitted by the existing goal bootstrap are now recognized: `history/.gitkeep`,
`history/reflections/.gitkeep`, and `research/.gitkeep`, immediately beneath a
goal packet. Arbitrary goal scripts, JSON fixtures, unknown marker locations and
code-root files still require their normal checks.

The typed classifier, generated pre-runtime JSON and shell fallback stay aligned.
Tests replay the complete #2750 path list, check mixed script/fixture/code
counterexamples, and compare the shell adapter with the typed CLI against real
Git diffs. The workflow's existing skip-satisfied jobs keep required check names
present while avoiding unrelated installs and tests. Packet validation, security
and review-window policy are unchanged. No GitHub ruleset is weakened.

## Other observations and disposition

- CLI shard test steps differed substantially (one finished in 215 seconds while
  siblings were still active after 400 seconds). Rebalancing those shards alone
  would not remove the much longer native unit-d path. The concrete optimization
  in this follow-up targets that path first; shard counts are unchanged.
- Setup steps ranged from roughly 20 seconds on heavy runners to 118 seconds on
  one CLI shard. Different runners and cache states make this an observation, not
  evidence for removing setup validation or widening cache trust.
- Superseded runs consume runner time until cancellation completes. The existing
  workflow already enables cancellation on new PR pushes; the obsolete #2751 run
  was explicitly cancelled so the main-merged head could proceed. No additional
  cancellation policy is needed based on that observation alone.

To reverse the changes, restore the HTML fixture's source-entrypoint runtime,
the two Yeet branches and the synchronized CI path patterns. No migration or persistent cache cleanup is required.

# Hosted quality repair after declaration visibility

At 3768f2816f, hosted Check run 41452962178 passes build, type checking,
docgen and doctest. The unit-d result is 544 passed, one skipped and one
failed: the 1,097-case native-worker corpus hit its 599,750 ms instrumentation
watchdog. The test's total replay allowance is now twenty minutes. Per-request
clean/operation/cleanup limits, every expected outcome and child-exit assertion
are retained. This is a suite timeout adjustment, not an engine safety waiver.

The green integration job did not run CitationHtmlUnicode: explicit root task
filters disable the legacy-only integration bucket. The server now exposes the
same test:integration:parallel alias as workspace-server/epistemic-server.
A Turbo dry run with an explicit server filter contains the server parallel task
and its original beep:test:integration implementation. The Unicode qualification
runs two independent lanes, each with its own arena, registry and sequential
history, at concurrency two. No source assertion spans different histories.
Aggregate gates remain exactly 2,016 histories, 6,412 snapshots, 482 expected
parser failures and 1,025 independently confirmed child exits. Native execution
has not been rerun locally. A green unrelated integration job is not this proof.

Code repairs:

- The default resolver now separates full, Id, short, supra and reference
  decisions while preserving encounter order and exact work/edge charging.
  A scoped Fallow check reports zero findings for Resolve.ts.
- Document authority verification separates decision, candidate, group and
  binding checks in their original order. Its scoped complexity check also
  reports zero findings. No receipt is promoted into a runtime proof.
- Mention/receipt coherence shares one predicate over the existing schema
  types. HTML text/byte/native stages share the same reservation settlement.
  Default resolution paths share their source-ordered metadata string selection.
- Twenty-five exact Option/Result assertions use canonical helpers. Twenty-two
  Boolean assertions preserve their original predicates, polarity and available
  labels without inventing success values, errors or Causes.
- Callback limit/reentry observations are asserted outside the failure-sanitizing
  callback boundary. This prevents an assertion failure from becoming the very
  callback failure the test expects. Actual typed failure reasons are checked;
  runtime stack annotations are not fabricated as expected Causes.
- The registry harness is a support module with an explicitly forbidden spawner.
  It needs no real OS/filesystem services. The focused canonical detector scan
  for its test/support pair completes without findings; the prior combined test
  body stalled the scan. Hosted lint acceptance still needs a fresh result.
- The two exported artifact alternatives now have real schema-derived codec-law
  consumers. Both preserve coherent source JSON bytes and reject forged derived
  views; no extra public barrel export or dead-code suppression is added.

Focused verification before publication includes 78 server tests, 35 domain
checks, 21 use-case tests, the final 27 registry/callback/ledger controls and two
new artifact laws. All passed in their focused runs. Source/test type checking
and generated-catalog/divergence audits are recorded separately from full hosted
acceptance. No native corpus or whole-repository build ran locally.

The package manifest change is reviewed only for law-practice-server using the
canonical cache baseline writer. The parallel task is already uncached in Turbo;
other subjects and the qualification ledger/scope/profile/epoch stay unchanged.
This configuration review grants no cache qualification or hosted proof.

Remaining work includes the rest of the hosted complexity/duplication inventory,
source-backed platform/filesystem and outcome-capture lint judgments, fresh
exact-head CI, and the provider-limited Vercel contexts. Neither PR review thread
is unresolved at the inspection point. PR 2511 remains an unfinished draft; this
repair does not claim complete engine parity or merge readiness.

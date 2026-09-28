# Epistemic UI canonical test proof

Source commit: `c7da537e85`. This batch closes the seven saved actionable
findings for `@beep/epistemic-ui`, plus the adjacent panel act-environment
restoration gap. It does not close the overall goal.

The queue-query law now uses native property registration with its original
production-schema arbitrary, encode/decode equivalence and `fcRuns(25)`.
The adjacent claim-evidence panel already had a native confidence property;
its original domain and `fcRuns(50)` remain. Independently inverted predicates
in both properties produced seed `20260708` and shrinking. One aggregate
`Passed` assertion retires. All 125 original assertions and all 19 test
registrations remain, including accessibility, public-error/private-cause,
controlled callbacks, exact request payloads and verified-source markup.

Both DOM suites restore the exact prior `IS_REACT_ACT_ENVIRONMENT` property
descriptor after their suite; the view also restores `scrollIntoView`.
Originally absent own properties are deleted instead of replaced with an
undefined-valued property. Four controls cover both files with present and
absent descriptors: each old teardown failed its restoration assertion and
each new teardown passed. Per-test React root unmounting, container removal,
act flushing and the view's serial suite remain. This repairs a demonstrated
harness-state leak, not a claimed reproduced hosted flake.

All four files use the shared runner and public Effect test facade. The view's
ordinary `vi.fn` callbacks also come from the facade; there are no hoisted
module mocks requiring a direct Vitest import. The new development dependencies
are `@beep/test-runner` and `@effect/vitest`; generated configuration adds two
TypeScript references and two Fallow edges. Eight runner cache edges were
reviewed across 13 owned computations without promoting qualification state.

The adjacent `ClaimEvidenceReviewPanel` file is now in the census and all four
human lenses. Its static markup preserves the distinction between extraction
confidence, source verification and human approval, along with pending,
current, stale, duplicate-approval and changed-source states. No source file,
approval service or external endpoint is accessed by these tests.

## Verification

- Final full package verification passed with 400 trials and seed `20260708`:
  audit 10.2 seconds and docgen 3.1 seconds.
- All six root policy checks passed on the final import state, along with
  post-commit changeset coverage.
- Normal Node and Bun runs each passed all 19 tests before and after, with no
  skips and stable source hashes. Final whole-command observations were
  Node 6.5822 seconds before and 5.7261 after; Bun 3.2692 before and 2.2173
  after. Load and CPU/memory/I/O pressure are recorded. These single
  observations do not establish causal performance gains.
- Preservation, census, timing and ledger schemas pass. The package has no
  current detector findings. Reconciliation preserves 683 unrelated ledger
  hashes and unrelated raw root/census objects.

These receipts prove configured jsdom React interaction and static server
rendering. They do not prove real-browser behavior, remote evidence retrieval,
authenticated desktop transport or repository-wide merge readiness. Fifteen
packages and 911 saved actions remain, including the explicitly open use-case
authentication-boundary finding assigned to the desktop batch.

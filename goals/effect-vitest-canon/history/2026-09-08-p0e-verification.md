# P0e verification receipt

Status: complete. P0e establishes the four lens charters and the public
instrumented runner, with detector integration, runtime/package proof and a
fully attributed artifact refresh. P0.5 and later phase gates remain separate.

## Public runner and regression closure

- The explicit @beep/test-utils/Vitest subpath exports instrumented it and
  TestHang. The ordinary test-utils root barrel is unchanged.
- Public Vitest aroundEach and standard AsyncLocalStorage establish the actual
  repeat/retry execution boundary. Each delegates its original complete array
  once; properties share one deadline across trials/shrinks and reset per try.
- Body-only logger capture preserves the last body message or None. Lifecycle
  and watchdog logs do not overwrite that evidence. Trace/CI gating, TestClock,
  live and excluded-TestEnv modes, scopes/finalizers, named/unnamed/nested layers,
  conditional/failure methods and concurrent identities are covered by the
  Node/Bun integration fixtures.
- Independent identity/repeat probes pass under Node and Bun. The former failed
  receipts prove the corrected full-name and stale-deadline regressions.
- Original plain Function-title/optional-handler calls now register the
  upstream todo task. Added pipeable forms also handle their declared omitted
  callback/options arguments. Unchanged callable and omitted-argument probes
  pass on Node and Bun; owned registration tests cover those branches. Root
  completed only the two existing dispatch predicates and tests after the lane
  handoff. The Effect compiler remains enabled; no diagnostic was suppressed.
- The watchdog retains the resolved per-test budget, concrete identity, typed
  failure and last body log. It uses a live clock without advancing/replacing
  the body's TestClock. Tiny timer evidence does not claim sub-millisecond OS
  scheduling precision.

## Package and dependency proof

Bun 1.4.1 and Node v24.20.0 were used. All source writers had exited before
aggregate verification.

- Full initial package-verify: test-utils passed in 55.732 seconds; repo-cli
  passed in 479.415 seconds (audit 456.1s, docgen 21.3s). All 63 captured hashes
  were stable throughout both commands.
- After the callable-only corrections, final full package-verify for
  @beep/test-utils passed in 42.507 seconds with stable hashes. The retained
  repo-cli proof is explicit: all CLI source/tests/graph and the test-utils
  dependency manifest/root barrel remain byte-identical. Only the explicit
  Vitest callable adapter and its test changed, so no second unchanged CLI
  audit is represented as having run.
- The full lane runtime matrix passed on Bun (10 files; 67 passed, one expected
  failure, nine skips before the subsequent callable additions) and Node
  (two files; 24 passed, one expected failure, two skips). Later callable checks
  and the final full package audit cover the added registrations. Expected
  skips/fails/todos exercise those public Vitest methods rather than concealing
  a test failure.
- @effect/vitest moved from devDependencies to dependencies at the same catalog
  pin. Bun 1.4.1 regenerated bun.lock; its entire diff is that declaration move.
  No dependency version, root barrel, test configuration or property floor changed.
- Eight charter examples compile under the package's existing check config;
  docgen separately checked 37 examples. Earlier private-verifier configuration
  failures were retained and corrected without changing source/compiler policy.

## Detector integration and exact artifact delta

The new subpath's actual it binding is recognized through existing provenance
and shadowing logic, including renamed/namespace/nested-layer forms. Negative
cases exclude unrelated modules and non-tester exports. The alias lane's 67
focused tests passed. Only Syntax and its detector test changed against the
29-file P0d receipt; detector algorithms and the pinned graph stayed frozen.

Exact final commands: two writer runs and one default ratchet, all exit zero.
Process-wall durations are 8.532, 8.121 and 8.072 seconds; measured scan times
are 6741.6, 6334.0 and 6035.2ms. All 123 artifact hashes match across runs and
source hashes remain stable. The default ratchet reports introduced=0/resolved=0.

Census: 1,075 unique files (970 tests, 105 support modules), 139 owners resolved
from 142 registered workspace roots. The only additions are Vitest.test.ts and
Vitest.runtime.test.ts in test-utils. No existing path was removed, and every
byte/line count, owner and kind matches the actual source.

The baseline and 121 detector JSONL files agree on 5,016 unique rows. All 5,013
previous canonical identities, semantic fields, locations and replacements are
unchanged. Exactly three judgment candidates were added in the new tests:

- EV009: the explicit live-mode runner regression.
- EV010: the NodeServices import used by real subprocess filesystem evidence.
- EV014: the shared probe layer whose default hook timeout is exercised.

These remain visible for the P1 lens audit; this receipt neither suppresses them
nor treats baseline growth as remediation. The full goal still requires final
judgment disposition and an empty baseline at P3.

## Private receipts

All under ~/.cache/beep/effect-vitest-canon:

- p0e-alias-frozen-source-audit.json
- p0e-final-independent-proofs.json and Node/Bun identity/repeat logs
- p0e-final-callable-proofs.json and Node/Bun callable/omitted logs
- p0e-package-verify-status.json and both initial package logs
- p0e-final-package-verify-status.json and final affected-package log
- p0e-dependency-lockfile.json and reviewed before-lock snapshot
- p0e-charter-final-example-proof.json and retained verifier attempts
- p0e-final-command-proof.json and all three exact command logs
- p0e-final-membership-delta.json and p0e-final-artifact-audit.json

No commit, push, PR or merge has been performed. Filesystem conformance,
adversarial review, Benjamin's ratification/merges, the full inventory and
remediation waves, and closeout remain pending.

## P0.5 source recheck clarification

The final P0e proof's actual public Vitest.ts bytes export TestContextUnavailable
alongside TestHang and it. The earlier prose did not enumerate that additional
typed boundary error. A recheck against all final package-proof hashes found
no source drift; this clarification corrects the description, not the source.

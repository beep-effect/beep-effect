# Shared internals and labs ceremony runtime proof

Source commit: `ffeeb3a2d0e324be719230f6d37857057b989a2d`.

The shared-internals suite retains all 44 cases and 105 assertion trees. Fifteen
plain callbacks now return Effects, direct runtimes and the local scoped-layer
wrapper are removed, and a shared Crypto/Path layer has an explicit ten-second
hook budget. All 24 Effect callbacks receive fresh TestConsole services. Serial
registration preserves the existing environment/cache ordering. Pure per-case
ConfigProvider and FileSystem stubs remain explicit service values under D14;
this does not exercise a real secret-provider subprocess or claim its health.

The labs-ceremony suite retains six cases and twelve assertion trees. Its one
runtime-backed case now uses an Effect callback under the public NodePath layer
with an explicit ten-second hook budget. The five synchronous cases are intact.

## Evidence

- Final CI-enabled Node and Bun runs each pass all 50 tests in both files.
  Combined durations are 6.59 and 3.20 seconds respectively.
- Private AST checks preserve all 117 assertion trees. Shared-internals retains
  all 44 test names and explicit test options. The labs change retains its six
  registrations; the layer hook budget is the only new timeout.
- A temporary identity probe passes on both runtimes and observes 24 distinct
  console services. It restores the exact source afterward. The subsequent
  source change replaces only two JSON fixture constructions with byte-equivalent
  string literals; final ordinary tests cover that revision.
- Actual test-typecheck diagnostics are empty with exit code zero. The first
  pass found native JSON calls newly inside Effect callbacks; equivalent wire
  text now supplies those decoder fixtures without an encoder dependency.
- The first labs draft returned a bare generator. Its one Effect case failed
  before assertions. Wrapping the callback body in Effect.gen fixed the contract;
  the failure is retained privately and recorded in OPPORTUNITIES.md.
- The targeted detector drops from twenty shared-internals findings and one
  labs finding to zero. The root ratchet scans 1,217 files: 2,878 findings,
  zero introduced and 2,153 resolved against the existing baseline.
- Ledger reconciliation closes twenty historical rows and captures one newly
  observed timeout finding as fixed. All historical IDs are preserved. Strict
  decoding and ID uniqueness pass: 3,496 CLI rows, with 1,967 fixed, twelve
  exceptions and 1,517 open. Other lens judgments remain open.

Fresh pre-migration single-file command observations were shared-internals
3.78 seconds on Node and 1.70 on Bun, and labs 4.82 and 1.97 seconds. Initial
post-migration observations were shared-internals 3.59 and 1.61 seconds, and
labs 4.74 and 2.53 seconds. Shared workstation load and overlapping verification
make these observations unsuitable for causal performance claims.

Full CLI package verification is running on the committed source. Its terminal
result is required before this batch is handed off or published. This receipt
does not claim package-wide or hosted acceptance, or completion of the goal.

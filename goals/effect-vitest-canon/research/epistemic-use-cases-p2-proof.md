# Epistemic use-case test migration and remaining boundary proof

Source commit: `2aa780b403`. This batch closes 51 saved detector findings and
retains one open authentication-observability finding. It does not close the
package's complete ledger or the goal.

Five manual properties now use native registration: candidate submissions
retain `fcRuns(50)`, and four source-highlight/page laws retain `fcRuns(25)`.
Arbitraries, codec predicates and negative range/source checks remain. The
as-of-query and claim-projection laws were already migrated upstream in
`b1aa7e320c`; their schema inputs and `fcRuns(50)` remain unchanged. Seven
independently inverted original predicates each reported seed `20260708` and
shrinking. Five aggregate `Passed` assertions retire.

The validity-interval regression now yields its existing deterministic sample
inside `it.effect`, preserving count 1, seed 520 and all four boundary outcomes.
The second Ref-backed disposition fixture receives the same explicit ten-second
acquisition deadline as its sibling. Existing fixture state and body deadlines
remain.

A preservation check accounted for all 144 original assertions and all 50
registrations across eight files, with 52 public helper conversions. The
package-local adjacent `ClaimEvidenceReview` file is now represented in the
census and four human lenses. Its actual Crypto digest, TestClock epoch-zero
approval, stale-source/quote/scope checks and call-through mutation witness
remain; these fixed regressions are not represented as random property laws.

All eight files use the shared runner. Its development dependency adds two
TypeScript references, two generated Fallow edges and eight reviewed cache
edges across 13 owned computations. No qualification state is promoted.

## Verification

- Full package verification passed with 400 trials and seed `20260708`: audit
  9.9 seconds and docgen 3.8 seconds.
- Root Oxlint, Sherif, Fallow health, Fallow audit, cache policy and schema-first
  checks passed; post-commit changeset coverage passed.
- Normal Node and Bun runs each pass all 50 tests with zero skips and stable
  source hashes. Node whole-command observations were 5.7253 seconds before
  and 7.0305 after; Bun observations were 2.7685 before and 1.8169 after.
  Timing context records load and CPU/memory/I/O pressure. Baseline overlapped
  publication, and after overlapped package proof and machine scans. These
  observations do not establish a causal speedup.
- The current detector has zero package findings. Reconciliation preserves
  683 unrelated ledger hashes and unrelated raw root/census objects.

## Authentication finding remains open

`L-OBS-03` in `ContradictionTriage.rpc.test.ts` remains open. The exact
four-descriptor map and all payload/schema assertions are preserved, but a
map comparison does not execute authentication. The actual desktop composition
merges `ContradictionRpcs` into `DesktopRpcs`; `RpcSessionAuthLayer` guards the
HTTP transport. Existing `rpc-session-auth.test.ts` tests pure header helpers,
and the contradiction contract tests use `RpcTest` without that HTTP boundary.
Neither proves an unauthenticated request is rejected by the actual middleware.

Complete the authenticated positive and unauthenticated negative boundary
observations in the professional-desktop batch, then link that proof here and
close the original finding. No endpoint exposure or absent authentication is
inferred. No provider or real user session was contacted. The package's source
migration and proof permit dependent migrations to proceed while this explicit
cross-package acceptance item remains open in the same consolidated PR.

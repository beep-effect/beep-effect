# Assertion detector complexity repair

The merged-main cheap gates exposed two introduced Fallow findings in
`dataAssertionRoute` and `detectBooleanDataShape`. Membership arity/provenance
recognition and piped absence recognition now have separate local functions;
the membership route uses a flat guard. No recognition rule, assertion
replacement, confidence, severity, occurrence identity or provenance check is
removed. No threshold or suppression changes were made.

## Verification

- All 260 detector, contract, store and primitive tests pass with CI enabled on
  Node (18.09 seconds) and Bun (8.36 seconds).
- All 2,861 emitted detector rows match the pre-refactor scan. The sole metadata
  difference is the native compiler exception already committed before this
  repair; every detection field remains identical.
- Fallow audit and health pass. The audit has zero introduced findings; two
  inherited adjacent findings remain nonblocking under the existing policy.
- Full CLI package audit and docgen are pending. This is not a claim of hosted
  readiness or completion of the broader goal.

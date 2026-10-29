# Calibration implementation verification

These are local dirty-source results, not exact-head hosted or completion receipts.
Current source identity is history/execution-v1.json; later edits require scoped
reverification. All data used were generated fixtures.

| Check | Result |
| --- | --- |
| Domain package-verify | audit and docgen passed |
| Use-cases package-verify | audit and docgen passed |
| Server package-verify | audit and docgen passed |
| Focused report + evaluation tests | 20 passed |
| Migrated PGlite authority suite | 4 passed; both coordinates, complete projection directory deletion, JSON/text/answer equality, all edge/disposition rows unchanged |
| Native calibration command tests | 16 passed; complete output-directory replay, exclusive output, bad digest, duplicate strata, wrong temporal split, wrong candidate set |
| Script-inclusive server typecheck | passed; scripts added to test typecheck coverage |
| Independent exact-input replay | byte-identical, 44 evaluations and 11 canonical policy digests independently verified |
| Injected typed candidate failure | exit 1 after preserving 44 failed attempts and 20 schema-invalid attempts |

Initial introduced failures were repaired: runtime schema import, dual helper
signatures, branded policy digest decode, unnecessary yieldable-error wrapping,
script crypto/runtime composition, test tuple typing and decoded-time revalidation.
No failing check was bypassed. A remote Turbo cache warning did not prevent local
cached builds or audits; no authentication or credential change was attempted.

Domain coverage: 119 tests, 100% statements/branches/functions/lines.
Use-case coverage: 90 tests, 100% branches/functions; Retention service fully covered.
Native receipt-submission tests hit the forbidden-field boundary, not production
registry authentication/revocation. See G2-REPORT.md for exact scope.

Not yet proven: Yeet publication/final-check, hosted readiness, reviews/window,
merge, completion receipt or lane retirement. Production CLI and registry composition
remain unchanged. Do not treat this local evidence as production calibration.

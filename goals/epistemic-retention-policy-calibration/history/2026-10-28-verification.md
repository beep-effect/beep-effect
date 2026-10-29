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

## 2026-10-29 root-gate repair

The publication preflight found introduced root-policy violations outside the
package audit. The repair uses required schema tags, hoisted codecs, explicit
native filesystem/path/process test layers, schema-derived property tests,
a shared tier-summary function, and a declared standalone CLI entrypoint.
Input admission and baseline coverage now have separate validation steps.
Generated schema/span catalogs were refreshed by their owning commands.

Server and use-case package-verify passed again (audit plus docgen). Server has
59 unit tests and 49 integration tests passing; two existing integration files
remain skipped. The native CLI suite remains 16 tests, with the receipt test
now checking five schema-generated digests. Focused report/evaluation coverage
now contains 21 tests. Schema-first, schema-tag, Oxlint, Fallow audit and Fallow health passed.
The first Effect/Vitest inventory extraction succeeded, but its actual parity
check found one native-filesystem judgment; see the subsequent independent
review and exact exception in 2026-10-29-repair-review.md.

The exact repair sources are recorded in `2026-10-29-repair-replay.json`.
Replay is byte-identical to the frozen accepted bundle; the fixture, protocol,
candidates and output hashes did not change. Historical verification above is
retained rather than rewritten as evidence for a different source revision.

The final deterministic receipt restoration increases native CLI coverage to
17 tests (60 server unit tests). Package audit and docgen passed again.

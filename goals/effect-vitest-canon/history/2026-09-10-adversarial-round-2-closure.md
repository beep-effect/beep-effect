# P0f round two closure ledger

Status: **closed by Root for progression to round three**. All twelve findings
have an explicit disposition, the confirmed defects and subsequent reconciliation
failures are repaired, and final package, inventory and timing gates pass. This
closes the review round; final CLI coverage, round three, aggregate proof and
exact-head hosted closure remain separate PR gates.

## Root decisions

| Finding | Disposition | Evidence and limit |
| --- | --- | --- |
| R2-001 | Addressed | A sleep inside a deferred provided method is not proven directly awaited by the test body. Keep it visible as judgment; retain mechanical direct stalls. No callback-wide fork-plus-adjust exemption. |
| R2-002 | Addressed; broad getter proposal waived | The repository Option facade re-exports the exact helpers. Projected labels, strings and paths remain plain values under D5; unwrap fallbacks and projections do not prove equivalent structural assertions. |
| R2-003 | Addressed | Detect actual filesystem imports and resolved barrel references; separate pure Path/Spawner and opaque resource residue. Preserve real root-barrel and CommonJS filesystem evidence. |
| R2-004 | Addressed | Add for-of and for-in loops, with independent span coverage and retry versus ordinary-loop regressions. Retry candidates remain judgment. |
| R2-005 | Addressed; blanket exemption waived | Deterministic clocks must remain available. Shared reset mutates shared state and can wake other tests; neither one nested test nor a reset hook proves isolation. Review ownership and concurrency before choosing a remedy. |
| R2-006 | Addressed | Preserve family, polarity, negation, matcher and compound expressions. Boolean predicates supply no expected payload, error or Cause. Ambiguous guidance is review only. |
| R2-007 | Addressed; blanket deletion waived | A package-prefixed module string does not prove a service key. Keep unresolved module mocks visible as judgment; Layer.mock requires a real service dependency. |
| R2-008 | Addressed by runtime binding and executed evidence | Installed Vitest 4.1.11 exports the runner class whose static getCurrentSuite is present in both declaration and shipped JavaScript. The adapter captures that function. Unnamed-layer regression passes in the accepted Node 22, Node 24 and Bun suites. The declared Vitest 5 peer mismatch remains explicit under the existing compatibility decision. |
| R2-009 | Fixed after the review snapshot | README records the 100-entry rc113 graph and adopted 1,000-test/110-support census, with 7,775 starting findings. Current status distinguishes completed local evidence from remaining coverage, round-three and hosted gates. |
| R2-010 | Fixed | Resource charter anchors were checked against the immutable rc113 source: layer APIs, resource-safety README section, Layer.mock and the FileSystem service. Original graph API coordinates remain unchanged. |
| R2-011 | Fixed | SPEC now records the completed D5 helper/plain-value assertion split in all three doctrine surfaces. The former blanket expect ban is historical. |
| R2-012 | Fixed and example executed | The concurrency example uses TestClock.adjust, Effect.forkChild, Fiber.join and an explicit Ref import. It advances two seconds in total for two one-second batches. The exact concurrency-limit registration and assertions were extracted and pass on Node 24/Vitest 4.1.11. Other illustrative examples were not executed by this check. |

The three narrowly waived proposals are dated and explained in DECISIONS.md.
They do not waive the confirmed defects or authorize automatic migration.

## Evidence handling

The original ten findings remain unchanged; the two doctrine findings were appended
by the same reviewer. A later same-round read completed the missing PLAN range.
All 351 sealed corpus inputs match their recorded hashes. The read audit validates
196 successful source slices with no mismatches and all twenty complete samples.
Background reports and large unchanged dependencies were inspected at relevant
ranges; this is not a claim that every supplied dependency was read in full.

The two graph handoffs preserve all 100 API entries, names, signatures and source
coordinates. Conditional guidance adds four edges across existing TestClock and
assertion helpers; all previous edges remain. The graph decodes through the current
schema. Detector integration, complete finding reconciliation, canonical adoption, final
package proof and normal timing are accepted. Final CLI coverage remains a separate
publication gate.

## Final integration evidence

- The final detector passes 207 focused cases, compiler/lint and Fallow audit/health.
  All 182 preceding detector and 90 contract assertion expressions are preserved.
  Full repo-cli audit/docgen passes in 423.690 seconds on frozen source.
- Reconciliation caught and repaired the Services-subpath losses, seven incidental
  plain-value positives and 20 genuine tagged-assertion losses. The final comparison
  accounts for every field through all four candidate arrays, with no unexplained
  delta, scope loss or exception transfer. All 29 declarations remain. See the
  current-delta and detector-repair distillations in history/lanes.
- The canonical writer reproduces all 7,775 accepted findings and the 1,110-record
  census exactly. Three normal commands pass in 9.943252, 9.503443 and 9.587565
  seconds with source/canonical hashes unchanged; host resource context and all
  prior failed timing cohorts remain recorded.
- The runner retains all native timeout/watchdog budgets and passes all 52
  registrations on Node 22, Node 24 and Bun. Final test-utils package proof and
  normal scoped Node 22 coverage pass. Controlled-clock regressions prove exact
  tiny/concurrent boundaries while separate live-watchdog evidence is retained.
- The schema inventory relocation preserves the existing exception identity and
  reason; all other 92 entries are unchanged. Canonical writer and normal verifier
  pass. The TypeScript compiler API replacement is behavior-equivalent and tested.

Private Root acceptance records bind the final source, package receipts, complete
row mapping, canonical artifacts and timing cohort. Their authority is limited to
those proofs. PR #1067 remains open, and P1/P2 still require their packet gates.

# PR #1067: final round-two finding reconciliation

Root accepts the complete correspondence from the adopted 8,026-row inventory
through the two rejected candidates to the final 7,775-row candidate. Canonical
publication remains conditional on the separate full package proof. This receipt
covers finding semantics and scope; it does not claim coverage, timing or hosted
readiness.

The first comparison exposed 23 lost NodeServices/BunServices findings and seven
plain-value false positives. The next candidate restored the Services findings
but removed 337 assertion findings. Root identified 20 supported assertions that
must remain: one composed Option equality, four piped predicates, nine Array
predicate compositions, one Option.contains assertion and five yielded Exit
assertions. The other 317 removals lack supported asserted tagged-value
provenance across their call, projection or callback boundaries. That is a limit
of syntax-only discovery, not a claim about every opaque helper's runtime return
type. Their complete source evidence remains in the private ledger.

The final correction preserves all 7,684 preceding payloads and adds 91 judgment
candidates. Twenty restore the confirmed losses; the other 71 are new detections
in existing assertions. None comes from the appended regression fixtures. Each
addition has checked source, import provenance, full operands and terminal-result
evidence. No expected payload, error or Cause is invented.

| Source-backed form | Added findings |
| --- | ---: |
| Completed Option transformations | 9 |
| Option.contains Boolean assertions | 6 |
| Array callbacks returning tagged predicates | 11 |
| Final piped Option.isNone predicates | 4 |
| Array predicate reference Exit.isFailure | 1 |
| Delegated yields ending in Effect.exit | 60 |

Primary API evidence is pinned to rc.113 at
`d3b837aee836f35d625d55205f7d6e61305fc198`. Effect.exit returns an Effect whose
success value is an Exit; the delegated yield is necessary before this rule
recognizes the asserted Exit. Exact repository Option and Array re-exports are
verified. Plain terminal getters, unknown transformations, incidental inputs,
unrelated callbacks, partial applications and unexecuted Effects remain negative
under the bounded contracts.

The four ordered arrays reconstruct exactly: 8,026 → 7,998 → 7,684 → 7,775.
End-to-end accounting contains 7,612 semantic pairs, including 4,805 completely
unchanged payloads, 414 original losses with carried dispositions and 163 final
introductions. Every field is accounted for. There are no duplicate assignments,
unassigned rows, unexplained losses, exceptions or transferred reasons. All
findings remain open candidates.

The current census contains 1,000 tests and 110 support modules. The last step
changes one test file's byte/line metadata and preserves the other 1,109 records;
all 29 generated declarations remain present. Every finding's owner and census
membership is checked. All 7,775 primary graph edges and assembled guidance
suffixes validate against the unchanged 100-entry primitive graph.

Root verified all 33 final reconciliation artifacts. The implementation lane's
progress report appended package status during review, so the manifest records
that nonbinding narrative drift explicitly. All required source snapshots and
proof receipts are unchanged. This does not imply that the package worker had
finished during the review.

Final finding payload SHA256:
`7ff770991382f4efe628ba23d81b897556e5743cc6ab6c056d9bdc394bfbab22`.
Private evidence is retained under
`~/.cache/beep/effect-vitest-canon/pr1067-resume/tagged-final-delta-review/`,
with the Root disposition in `post-round2-tagged-delta-root-acceptance.json`.
Earlier complete comparisons and rejected candidates remain intact.

The separate final package proof subsequently passed in 423.690 seconds. Root
then ran the canonical census/inventory writer: exit zero in 9.827 seconds, exact
row and census equality, no source drift. The adopted inventory now contains the
7,775 rows reviewed here. Normal-command timing and coverage are separate proofs.

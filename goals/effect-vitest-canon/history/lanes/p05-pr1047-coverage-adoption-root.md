# PR1047 final coverage adoption review

Root reviewed the final R2 source and 26 added public-API cases with immutable
Node/Bun/static/integrity receipts. All original tests remain; full package audit
and docgen pass. Canonical combined package coverage exits 1 solely for new-file
identities. It restores package L/S/B/F to 96.19/95.51/93.16/91.04; old floors were
78.88/79.37/71.95/66.98. Existing file floors/gap counts pass strict guards.

Core coverage is 98.87 lines, 97.66 statements, 94.57 branches and 97.85 functions.
Remaining 13 lines, 30 statements, 31 branches and seven functions match the
coverage lane's private invariant/resource-exhaustion analysis. The seven function
gaps are State's unused descriptors default, missing-inode callback, canonical
path fallbacks in parent/link/temp helpers, guarded directory attachment and a
same-size allocation-pressure catch. These cannot be safely forced by ordinary
deterministic public-API tests without corrupting private state or manipulating
host memory. Retain those defensive paths and measure them honestly.

The helper's single uncovered branch is the opt-out arm for scoped temporary
directory cleanup (LCOV line289); all three canonical backends assert cleanup. Its original defaults
and collision assertions remain intact; actual always-no-op copy mutation proof
protects the new positive-copy leg.

Root accepts measured adoption of the three genuinely new source identities
through the existing scoped writer, conditional on its fresh measurement and
strict postguards. This adopts 32 new-file uncovered branch units, while old-file
branch gaps improve from 23 to 13; package total branch gaps rise to 45. All other
package uncovered totals improve (lines95 to71, statements99 to91, functions70
to54). No claim of an unchanged package branch-gap budget is made.

The origin/main baseline is byte-identical to the saved preimage. Hosted SqlTest
metrics exactly match the current local surviving-row improvement. No new policy,
exclusion, waiver, lowered floor or other package baseline is proposed. A normal
scoped ratchet and base-pinned proof must pass after generation; hosted checks
remain required after the user-authorized fast publish.

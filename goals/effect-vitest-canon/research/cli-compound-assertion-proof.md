# CLI compound assertion migration

Source commit `8ae1c5a2b7e4bfa29e65beb82028e66335570988` removes the 35 live EV006
findings in the existing open-record audit: 31 assertion migrations and four
false positives around already canonical public Boolean helpers. This is not
a new exhaustive main-delta inventory or goal completion.

## Semantics and detector repair

The Effect reference confirms that direct/curried `Option.contains` and
Array `every`/`some` return Boolean values. Membership uses Effect Equal
semantics. The detector now recommends the corresponding public Boolean
helper for proven membership/aggregate calls and accepts that exact helper.
A new regression failed against the old detector; all 213 detector tests now
pass on Node and Bun. Option-valued transformations remain visible, and
stronger absence routes remain intact.

The source rewrites retain all supplied expected values and custom messages.
Partial-object assertions compare only the originally selected fields via
`Struct.pick`; unrelated fields stay unconstrained. Existing schema and
variant guards express V3/terminated facts already asserted by the surrounding
tests before projection. No casts are introduced. Two absence assertions use
public `deepStrictEqual` with `Option.none()` to retain their custom messages;
`assertNone` delegates to the same comparison but accepts no message.

The dynamic Cause-message rewrite is guarded by the pre-existing
`expectReportedExit`, which already rejects success before message matching.
The projected job-count success assertion reuses the original expected 2.
The manifest assertion retains its Some/JSON-record checks and supplied
`bespoke` object. Structural comparison verifies only the planned non-import
changes, including the explicit narrowing refinements.

## Evidence and accounting

Two overlapping before/after cohorts cover 902 distinct registrations. The
732-test cohort passes on Node (70.628/81.813 seconds) and Bun
(47.746/54.361 seconds). The 394-test cohort passes on Node
(65.422/68.689 seconds) and Bun (54.006/58.773 seconds). Every run has
identical registration multiplicities, zero skips/failures and stable source
hashes. Workstation load and pressure are recorded; concurrent work means
these timings do not establish a causal performance change.

The actual generated test-typecheck artifact has exit zero and empty output.
Detector comparison preserves other finding counts and reconciles exactly
19 enclosing-statement hashes. The root ratchet passes with 3,731 findings,
zero introduced and 1,286 resolved; no baseline expansion occurred.

The ledger fixes 28 matching historical assertions and four proven canonical
false positives, and captures three current assertions missing from the old
ledger. It now has 3,457 unique records: 1,040 fixed, 7 exception and 2,410
open. Seven historical EV006 records remain pending provenance reconciliation.
No status was inferred solely from a missing detector finding.

Full CLI package verification is running and has not yet been credited.
PR1323 remains frozen; hosted follow-up proof and remaining goal work are
outstanding. Private receipts use `cli-compound-assertions-*`,
`cli-partial-assertions-*`, `cli-assertion-closeout-*` and
`cli-canonical-compound-reconciliation.json`.

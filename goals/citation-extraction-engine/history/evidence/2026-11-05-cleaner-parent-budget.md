# Cleaner charges join the Document invocation authority

The cleaner pipeline now captures an optional compatible CitationTextBudget.
Ordinary work reservations preflight the local ledger, reserve against the parent
before issuing the live charge ticket, and retain the existing local work count.
Failed parent reservations issue no local ticket or text value. A later caller
Context cannot replace the captured parent authority. Standalone execution with
no parent preserves its existing behavior.

Bounded producers borrow the parent authority and receive the smaller of local
and parent remaining capacity. Output is checked against that actual allowance
before local tickets settle. The existing uninterruptible settlement then joins
both counters exactly once; no second global charge is made when tickets are
consumed. Empty output/failure/cleanup rules are unchanged. Existing Effect
capacity and reservation services own all exclusion and accounting.

Document installation captures the cleaner runtime, rather than constructing a
pipeline before any invocation budget exists. Cleaning constructs the existing
pipeline inside captured invocation work, so it inherits the actual fresh or
enclosing parent authority. Successful non-geometry source cases now prove the
returned reservation count equals cleaner production. Geometry cases retain the
cleaner charge alongside native receiving/slicing charges. This supersedes the
separate-cleaner-counter gap in the preceding constructor receipt, without
claiming complete whole-engine allocation acceptance.

## Text and native capacity ordering

Inspection found a resource-order inversion exposed by the new bridge. HTML
production can hold borrowed text capacity before acquiring a native slot;
regex input preparation previously acquired its native slot before attempting
the composed text reservation. Concurrent calls could therefore wait on each
other until a deadline. Diff preparation already reserves text first.

Regex preparation now follows complete frame preflight, text reservation, native
grant, then receiving payload/projection/map allocation. The existing input
preparer accepts a trusted optional grant effect after reservation; request data
contains no callback. Complete measured frame bytes are retained for that grant,
and all prior frame/input checks remain. Native admission still precedes copying.
An interrupted wait for held text capacity acquires no slot and makes no
successful text reservation. If a later native grant fails, an already-committed
text reservation remains spent under the existing non-refund contract.
No frame format, process limit, timer or queue ceiling changes.

## Passed proof and retained limits

Twenty-three initial regressions pass across Document, owned cleaner, existing
pipeline and parent-budget consumers in 14.45 seconds. Three tighter controls
pass in 1.72 seconds: direct callback allocation is refused before materialization
against the captured original parent; the real underscore builtin settles both
ledgers once; and a real HTML child obeys a one-unit remaining allowance, retires
independently, returns a complete refusal and issues no new value handle.

The qualified acquisition-order regression passes all 36 tests across six files
in 14.06 seconds, including real regex workers and Document composition. With a
single native slot and held text allowance, the focused ordering control observes
zero native claims while regex input waits. Cancellation frees the wait, and the
text borrower can claim/release that slot. Final text/native state is empty.
The twenty-test cleaner/capacity/Document regression also passes in 11.42 seconds.
Package lint, source and test type checks pass. A boolean fixture diagnostic was
resolved with the repository's explicit boolean comparison; no rule, limit,
baseline or suppression changed.

Hosted exact-head proof, full constructor corpus and Node constructor replay
remain pending. The default host-protocol adapter, all other engine stages,
whole-engine allocation/scaling qualification and exhaustive parity/accounting
remain open. This bridge does not prove every allocation site is integrated or
complete reflection/lifecycle adoption. No source semantic divergence is added.

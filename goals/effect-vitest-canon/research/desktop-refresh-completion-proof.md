# Receipt retention waits for an applied timeline refresh

The receipt-uncertain regression previously initialized the timeline with the
same text it awaited after clicking refresh. That wait could finish before the
GetTimeline operation completed. The refreshed response now retains both
original turns and adds a distinct assistant turn. The test proves its text is
absent before the click and visible afterward, then runs every original
assertion about the prior timeline text and retained receipt/user prompt.

The real UI refresh button, original fixture turns, receipt state, expected user
prompt, test title, and deadlines remain unchanged. No production behavior was
modified. The response-only marker provides an observable witness that the new
timeline was applied, rather than merely that the RPC was invoked.

A temporary control replaced only this test's GetTimeline result with
`Effect.never`. The original test passed; the strengthened test failed while
waiting for the response-only marker. The control was removed. The normal Node
run passed all nine tests in the file.

Full Desktop package verification passed (audit and docgen), as did the root
Effect/Vitest ratchet with zero introduced findings and the schema-first checks.
Strict baseline, census, and ledger decoding passed. Reversing only the added
response fixture, its result substitution, and the two marker assertions exactly
reproduced the pre-edit file, preserving all original cases and assertions.
Desktop ledger closure remains deferred to the complete package reconciliation.

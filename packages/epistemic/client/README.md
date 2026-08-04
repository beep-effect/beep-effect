# @beep/epistemic-client

Atom-first browser client for the `epistemic` slice.

The contradiction-triage module binds the authenticated desktop RPC protocol to
reactive queue, detail, verified-source, selection, temporal-filter, and review
mutation atoms. Review invalidation refreshes the queue and exact candidate
detail without introducing React-owned application state.

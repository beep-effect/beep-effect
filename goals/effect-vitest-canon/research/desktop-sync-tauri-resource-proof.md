# Sync registries and IPC reader scope ownership

Both sync atom tests now register registry disposal in the live test scope before
starting their command families. Their Deferred-controlled workspace isolation,
same-workspace sequencing, exact RPC call lists, failure message, retry limits
and live-clock behavior are unchanged.

The IPC reader test creates a child of the current test scope rather than an
unowned scope. It still explicitly closes that child before joining the suspended
pull and checking the close error and two unlisten calls. Parent ownership now
also covers failures before that explicit close.

Separate-process controls injected defects while sync RPCs remained suspended and
immediately after IPC reader acquisition. Both original sync tests observed zero
disposal callbacks; both corrected tests observed one. The original IPC test left
both listeners registered; the corrected test invoked both unlisten callbacks.
Every probe was removed. All nine ordinary Node tests pass.

Exact source reversal verifies that the only changes are two registry
acquisitions, removal of their success-tail disposals, and the IPC child-scope
constructor. Original assertions, mocks, subjects, and early-close ordering are
preserved. Public-layer and live-clock inventory judgments remain separate from
these resource repairs.

The full Desktop package audit, including Bun unit tests, and Docgen pass (16.8
and 17.4 seconds respectively). Two enclosing sync EV009 identities changed;
exact finding evidence matches their prior entries, and both retain their open
status after location/fingerprint refresh. Strict inventory/census validation and
diff checks pass.

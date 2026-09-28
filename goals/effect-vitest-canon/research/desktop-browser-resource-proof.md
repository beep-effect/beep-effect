# Browser failure registry ownership

Both browser-failure atom tests now acquire their actual registries through
`Effect.acquireRelease`; the public live test scope owns disposal. Cleanup is
registered before mounting either the handled failure or global listener atom.
The two success-tail disposals were removed.

Exact source reversal confirms that only those two acquisitions and two disposals
changed. All seven assertions, test titles, delayed logger, idle TTL, mount points,
live-clock selection and retry limits remain intact.

Temporary failure controls injected a defect immediately after each mount and
observed disposal after scope closure. Both original tests failed the cleanup
assertion with zero callbacks; both corrected tests passed with exactly one. Each
case ran in its own process. The probes were removed and the ordinary Node suite
passes both tests. The full Desktop package audit, including Bun unit tests, and
Docgen pass (15.2 and 16.4 seconds respectively).

The resource edit changed two enclosing EV009 fingerprints. Their test-title
prefixes and ordered identities were matched one-to-one; only location/evidence
fields were refreshed. Both live-clock judgments remain open, with their existing
remediation obligations unchanged. This resource fix does not waive them.

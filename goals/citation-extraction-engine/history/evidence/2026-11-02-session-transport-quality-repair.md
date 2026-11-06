# Session projection and worker transport quality repair

PR #2511, 2026-11-02. Session projection now separates ambiguous candidates,
individual decisions and final resource groups. Encounter order, descriptor
memoization, edge/authority limits, member-list equality checks and receipt
construction order remain intact. Scoped complexity reports zero findings.

Worker JSON transport separates exact point-byte accounting, quoted-string
state, structural depth and frame-byte consumption. Complete-frame bounds,
maximum depth/property checks, excess properties, partial/extra frames and
isolated-surrogate escaping remain enforced. The native-runtime checker passes;
no native switch or rule suppression was retained. Scoped complexity reports
zero findings for HtmlWorkerProtocol.ts.

Review found a regression in the newly shared HtmlInput transport copier: reading
a buffer's length again after a server preflight callback could accept an empty
buffer after detachment. The copier now receives the original validated size,
and the native reader retains the original point count. A regression test
transfers the buffer during preflight and requires the typed invalid-input
failure. This restores the pre-refactor guard instead of treating detached input
as successful empty content.

All 24 focused preparation, framing, descriptor and callback-session tests pass
across five suites, including the detachment control. Server source/test type
checking and focused Oxlint pass. Native-runtime checks pass across the three
changed production files without allowlist entries. Source formatting precedes
divergence-ledger regeneration. Hosted CI and complete engine parity remain
pending; no native corpus was rerun locally and no proof row was waived.

# HTML local policy proof repair

The full early-publish proof failed in lint policy on two introduced categories:
inline JSON codec compilation in the security forgery test, and private output
paths in three timing-context commands. The security codecs now compile once
at module scope, preserving the schema, values, and assertions. Command receipts
explicitly replace only the private output directory with a placeholder.

Full HTML package verification passed: audit 18.9 seconds, docgen 15.7 seconds.
Root oxlint passed. Fresh post-repair runs passed all 196 tests on Node and Bun,
with no failed or pending tests and unchanged source hashes during each run.
Whole command times were 7.781 seconds on Node and 3.338 seconds on Bun;
load, pressure, runtime versions, limits, and hashes accompany the reports.
These shared-workstation measurements do not establish a performance speedup.

All five inventory lenses validate as complete with zero missing rows after
updating no-findings spans to the current files. Historical finding identities
and evidence are retained. The reference census operates on a committed tree;
its pre-commit invocation still reported the preceding commit's private paths.
The committed-tree reference check and full Yeet proof remain distinct gates.

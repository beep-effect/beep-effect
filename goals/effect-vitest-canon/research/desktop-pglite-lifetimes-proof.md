# Desktop PGlite lifetime review

PgliteDataDirCompatibility no longer defines provideScopedLayer, withPgliteSql,
or withChatDbPath. The existing public it.layer fixture still owns the platform
services. Each database lifetime is now visible at its use site through
Layer.build and a deliberately shorter Effect.scoped region. SQL is obtained
from the built context; production boot configuration is composed into the layer.

These lifetimes cannot be shared across the suite. Fixture creation closes its
engine before compatibility inspection or reopening the directory. Fixture reads
close their own engine. The extension-bundle case closes the database before
asserting that its materialized bundle is removed. The production boot case
closes the migrated layer before opening a new verification SQL connection.
Generic makeSqlTestLayer substitution would also change the subject: these cases
exercise the app's bundled engine, compatibility gate, and boot layer directly.

Node and Bun each passed all nine original cases. AST comparison preserved all
nine test titles and 56 assertion call expressions, including nested assertions.
The full Desktop package verification passed audit and docgen. Original database
paths, queries, legacy engine, markers, permissions, and timeouts are preserved.

A temporary negative control removed only the extension case's shorter scope.
The original empty-directory assertion then failed because the materialized
extension bundle remained until the outer test scope closed. The control was
restored in a finally block. This demonstrates why runner-owned test scope is
insufficient for this assertion; the shorter scope is observable test behavior.

The detector now sees five explicit shorter-scope review points, including four
previously hidden behind local generic wrappers. All five have narrow EV004
judgments in the root inventory and Desktop ledger. This supersedes the pending
local-wrapper review in desktop-sidecar-boundaries-proof.md; other Desktop lens
judgments and final package reconciliation remain open.

Schema-first and strict packet validation passed. The packet has 5,006 unique
root finding IDs and 15,254 unique ledger rows after recording the four newly
visible scopes. The ratchet reports zero introduced findings, 231 resolved
against the retained baseline, and 4,775 live findings. The live count increased
by four because the previously hidden scopes are now explicit and reviewed;
no findings were suppressed or blanket-rebaselined.

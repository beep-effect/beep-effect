---
"@beep/shared-domain": minor
"@beep/epistemic-domain": minor
"@beep/epistemic-tables": minor
"@beep/epistemic-use-cases": minor
"@beep/epistemic-server": minor
"@beep/db-admin": minor
"@beep/test-utils": minor
"@beep/professional-desktop": patch
"@beep/pglite": patch
"@beep/architecture-lab-server": patch
"@beep/workspace-server": patch
"@beep/documents-server": patch
"@beep/law-practice-server": patch
"@beep/law-practice-use-cases": patch
---

epistemic-bitemporal-edge-core P1: the Postgres bitemporal claim/edge authority
core. New epistemic domain values/entities (LogicalEdgeIdentity digest,
EdgeEndpoint union, EdgeVersion with half-open BIGINT-millis axes,
ClaimDisposition), table projections with row converters, EdgeAuthority and
ClaimDisposition use-case ports/commands/errors (resolveClaimGateOutcome closes
the rejected-verdict no-op), transactional server repositories (atomic
close-and-insert supersession, canonical asOf reads, constraint-name error
mapping), the epistemic-edge db-admin migration (btree_gist EXCLUDE, open-head
partial unique index, bounded endpoints, disposition vocabulary CHECK), a
test-utils in-process PGlite extensions seam, and btree_gist registration in
the desktop sidecar. Migration-applying integration suites are pinned to the
in-process extension-capable lane. The P0 spike suites, fixtures, and the
@beep/pglite spike devDependencies (@beep/postgres, @electric-sql/pglite) are
removed. Graphiti Apache-2.0 attribution recorded (THIRD_PARTY_NOTICES.md,
licenses/Apache-2.0.txt); no donor runtime dependency.

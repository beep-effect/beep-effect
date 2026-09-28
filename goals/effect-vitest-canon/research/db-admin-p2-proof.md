# Db-admin canonical test closeout

Source commit: `c522eec8d5`. All fifteen saved actions are adjudicated across ten
test files. Existing public fixtures retain fresh in-process PGLite databases,
the btree_gist extension, two-minute acquisition limits, 120,000 ms body limits,
and isolated final SQL denial probes. No external database or provider is used.

All ninety original assertions and test titles remain. Nine assertions use
public helpers, including the original literal numeric ID expectations without
casts or schema changes. The exact array-of-Option content-digest readback
remains as one compound assertion exception. The execution-decision query now
orders by seq before the existing exact [0, 1] assertion; both rows, outcome
count and final append-only denial remain. This addresses an unsupported row
ordering assumption, not a claimed reproduction of a hosted flake.

Two native properties retain MigrationTargetArbitrary with encoded/decoded
Equal.equals, and PatentCitationEvent's schema-derived validity predicate.
Both keep fcRuns(25). Two aggregate Passed checks retire. Each independently
inverted predicate exposes native replay seed 20260708 and shrinking. Catalog
assertions remain qualified: named triggers do not by themselves prove every
trigger body's behavior. Existing executed denial probes remain unchanged.

Full package audit and docgen pass at 400 trials and seed 20260708 (16.9 and
8.0 seconds). Root Oxlint, Sherif, attributed Fallow health/audit, cache-policy
and post-commit changeset checks pass. Schema-first initially reports three
stale exception line anchors after import movement; only those three line
numbers are refreshed, preserving existing reasons and unrelated entries.
The final schema-first check passes with no missing, stale or enforced findings.
The shared runner adds ten reviewed edges across fifteen owned cache nodes,
without changing cache qualification or unrelated dependencies.

| Configured suite, including migrations | Before | After | Outcomes |
| --- | ---: | ---: | --- |
| Node Vitest | 10.132 s | 11.585 s | 22 passed; zero skipped |
| Bun Vitest | 7.927 s | 7.628 s | 22 passed; zero skipped |

Both phases have stable source hashes. Public contexts record load,
CPU/memory/IO pressure, runtime versions and limits. Baseline observations
overlap the preceding publisher; after observations overlap package proof and
census. These are contextual measurements, not a causal performance claim.

Strict schemas cover 5,605 unique root findings and 14,713 unique ledger rows.
One current detector exception and sixteen historical rows are retained.
Reconciliation preserves 683 unrelated ledger hashes and unrelated root/census
objects byte-for-byte. Eighteen packages and 1,025 saved actions remain.
Final goal-wide acceptance remains open.

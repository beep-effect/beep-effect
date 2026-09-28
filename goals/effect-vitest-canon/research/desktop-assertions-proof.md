# Desktop canonical assertion migration

All 42 saved EV006 findings now use canonical helpers: 25 assertNone conversions,
13 assertTrue conversions and four assertSome conversions. Boolean-only checks
retain their original predicates, including compound checks, and do not invent
Result payloads or Exit Causes. Some assertions retain their original expected
values. The contradiction sidecar assertion preserves the current null-safe
Option chain added on main after the saved inventory.

The structural receipt accounts for 502 original assertion calls in 17 files.
Reversing only the 42 reviewed substitutions reproduces every original non-import
statement, preserving test bodies, titles, schemas, fixtures, domains and limits.

Node passes 240 unit tests and all 30 enabled integration tests. The full Desktop
package audit, including Bun unit tests, and Docgen pass. Opt-in scenarios whose
guards register no tests are not credited by these totals.

The assertion edits changed 14 surrounding EV002/EV009 occurrence identities.
The reanchor receipt checks equal ordered peer counts and exact finding evidence
against the pre-edit scan and root inventory. Their statuses and remediation
obligations remain unchanged; no new candidate was waived. Two existing
schema-first exceptions retain their reasons, with only line anchors refreshed.

Package ledger reconciliation remains part of the continuing Desktop batch.

Bun also passes the same 30 enabled integration tests. Final schema-first lint,
strict inventory/census validation and the Effect/Vitest ratchet pass; the ratchet
reports zero introduced findings after the reviewed anchor refresh.

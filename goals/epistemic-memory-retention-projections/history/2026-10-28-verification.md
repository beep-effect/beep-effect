# Retention mechanism verification

## Requirement-to-evidence map

| Requirement | Owning implementation | Executable evidence |
| --- | --- | --- |
| Standalone tier and pressure report | domain Retention contracts; use-case generate/render/encode operations; server CLI | Retention unit suite and migrated-database report drill |
| Both as-of axes | reader SQL half-open predicates; generator defense in depth | early/later known-time answers, before valid-time start, exact transaction upper bound |
| Disposition views and groups | endpoint disposition selection by `(resolvedAt, id)` at knownAt | active/rejected history, future/foreign-tenant disposition exclusion, filter and summary assertions |
| Policy schemas and calibration gate | RetentionPolicy; discriminated RetentionPolicyAdmission; deployment-owned registry port | unordered/non-finite/nonpositive policy rejection; synthetic/wrong-policy/wrong-org/future/expired receipt rejection; missing receipt inert |
| Complete delete/rebuild identity | server rebuildRetentionStore | full directory removal including extra cache; byte equality for JSON and text; report answer equality at two coordinates |
| Authority unchanged | SELECT-only read-only repeatable-read adapter | all edge and disposition rows compared before and after the drill |
| Repo-native implementation | P0 provenance inventory and source review | no donor imports, copied constants, authority migrations, operator memory, or fusion arithmetic |

The eleven focused reporting tests, the dedicated authority rebuild test and ten core-authority integration tests pass
as one 22-test run. The new rebuild drill runs against migrated embedded
Postgres through the real authority repository and the new Drizzle reader/store.
The report and rebuild properties generate ordered candidate policies constructively
from the policy schema's positive-number field, including shrink-safe minimal windows.
The database authority is seeded once and remains read-only across property cases.
This is fixture proof; no production database was read or changed.

Full package verification (`bun run beep quality package-verify <package>`) is
required for each of `@beep/epistemic-domain`, `@beep/epistemic-use-cases`, and
`@beep/epistemic-server`, including audit and documentation generation. Initial
quick checks were followed by full checks; they are not substitutes for them.
The standalone script also has a separate typecheck because the package's source
and test configurations do not include scripts. Its no-argument runtime path
returns usage guidance before database configuration or connection acquisition.
A live production CLI connection is not part of the synthetic drill.

## Determinism and boundary review

Canonical encoding reuses the existing repo encoder. Requested keys and filters,
report rows and disposition tie-breaking have explicit ordering. No clock,
random identifier, generated-at stamp or store path enters output. Text and JSON
are independent of directory enumeration order. Snapshot reads are scoped by
organization and explicit keys; report filters never become authority writes.
Candidate policy data is present for inspection, but only the calibrated union
case can carry active policy and receipt data. The shipped CLI always composes
the inert registry. Synthetic receipts are never admitted by the gate.

Each generated report is transaction-consistent. Byte identity across rebuilds
requires unchanged authority/configuration. Store directories have one writer;
JSON is the commit artifact, text is derived, and an interrupted write is repaired
by rebuilding. This goal adds no cross-process store coordinator or production
calibration registry.

## Publication gate

Local package checks and fixture results do not prove publication or completion.
Yeet publication, exact-head final-check, hosted checks, review resolution and
review-window readiness remain required. Packet closure is proposed in the same
PR as the implementation and reflection; the conversation goal remains active
until its full completion audit succeeds.

## Resource judgment review

The authoritative Effect-test detector reports no findings for Retention.test.ts.
The rebuild property has two documented judgment exceptions in
`standards/effect-vitest.inventory.jsonc`: EV004 is the shorter artifact lifetime
that closes before the final authority reread, and EV010 is the native filesystem
which is the chosen projection-store subject. Neither is an assertion migration
or a policy waiver. Platform services are provided at the `it.layer` boundary;
the database is seeded once and is read-only throughout generated rebuild cases.

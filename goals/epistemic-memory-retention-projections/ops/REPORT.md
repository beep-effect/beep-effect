# Standalone retention report

From the repository root, with an authorized read-only Postgres connection in
`BEEP_RETENTION_DATABASE_URL`, run:

```sh
bun run packages/epistemic/server/scripts/retention-report.ts query.json /path/to/dedicated-projection-store
```

An optional third argument is a candidate policy JSON file. Resolve credentials
through the established environment/1Password lane; do not put the URL in argv.
The command does not migrate or seed a database. The store directory must be
exclusively owned by this report; `report.json` and `report.txt` are replaced.
Use a separate directory per concurrent operator invocation. JSON is the commit
artifact; text is a derived presentation. If a write is interrupted, rebuild.

Example request (replace the digest with a real logical edge key):

```json
{
  "orgId": 1,
  "logicalKeys": ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
  "validAt": 1500,
  "knownAt": 2500,
  "dispositions": []
}
```

Times are epoch milliseconds; both temporal intervals are half-open. Keys and
filters are sorted and deduplicated before output. At most 1,000 keys can be
requested; an empty key array returns an empty report without an authority read.
An empty disposition array includes every visible row. Otherwise either endpoint
matching a listed disposition selects the row. Allowed values are `active`,
`rejected`, `superseded`, `unresolved`, and `not-applicable`. A non-claim endpoint
is `not-applicable`; a claim without a known disposition is `unresolved`.
Dispositions are selected by latest `(resolvedAt, id)` at or before `knownAt`.
Disposition-group counts can overlap because both endpoints are represented.
`missingKeys` records absent temporal authority, independently of the view filter.

The report contains tier counts, disposition groups, rows, and measured canonical
fact-payload UTF-8 bytes. Bytes do not include database/storage overhead and are
not an estimate of RAM or model tokens. Policy-free rows are `unclassified` and
have no decay or budget ratio. Neither `evictable` nor a high budget ratio
permits deletion of authority.

## Calibration gate

No policy defaults or production calibration receipts ship. Candidate policy
files need positive integer values for `hotThroughMillis`, `warmThroughMillis`,
`coldThroughMillis`, `decayScaleMillis`, and `payloadBudgetBytes`; the three age
windows must be strictly increasing. They remain visible but inert in the report.

The standalone command always uses `RetentionCalibrationRegistry.inert`.
Product deployments may compose a controlled registry only after the calibration
phase establishes all of the following:

1. A versioned, independently accounted product dataset and its SHA-256 digest.
2. A reproducible evaluation report justifying all age windows, the rational
   decay scale, and byte budget; no imported constants or assumed salience.
3. Nonzero sample accounting, authenticated human approval and bounded validity.
4. A registry receipt binding the exact policy digest, organization and
   `retention-v1` mechanism. Its evaluation report reference must remain resolvable;
   the registry owner checks evidence quality, revocation and approval authenticity.
5. Tests for the registry's storage, admission and revocation path before enabling
   it in a deployment. Report input must never be treated as registry membership.

The report service additionally rejects synthetic receipts, different policies or
organizations, future approvals, expired approvals and malformed receipt data.
Schema validity alone is not a calibration gate. No deployment-owned registry is
implemented or enabled by this goal; the read-only port is the future seam.

After admission the repo-native diagnostic uses age since the edge assertion
became known: hot/warm/cold windows have inclusive upper cutoffs; older rows are
advisory `evictable`. Decay is `1 / (1 + age / decayScale)` and pressure is selected
payload bytes divided by the approved byte budget. This uses only recorded
age; it does not invent access frequency, confidence, reinforcement or salience.

## Delete/rebuild drill

Keep the authoritative database and request/policy/registry configuration. Remove
the complete dedicated projection directory, then repeat the same invocation.
Neither old report is a rebuild input. The same authority snapshot and configuration
produce identical JSON and text bytes. A source correction or changed coordinates
can legitimately change output. Each generation reads a transaction-consistent
snapshot; separate invocations cannot promise identical bytes if authority changes.

Executable proof lives in
`packages/epistemic/server/test/integration/EdgeAuthority.pglite.test.ts`, test
`rebuilds disposable retention bytes at two coordinates after full deletion without changing authority`.
It uses migrated embedded Postgres, accepted authority repository writes, a
retroactive correction and durable rejection, destroys the full store including
an extra cache file, compares both output files and report answers, and compares
all authoritative edge/disposition rows before and after. No production database
or operator memory is touched by the fixture.

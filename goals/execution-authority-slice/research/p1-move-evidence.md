# P1 move evidence (2026-11-07)

Lane `feat/execution-authority-slice`, base `cf46c70048`.

## Pre-move facts re-verified (P0)

The RESEARCH sections 1-3 inventory still matched `cf46c70048`: same execution files, same consumers
(5 desktop files plus db-admin), the same tooling pins, and the same 17 named constraints, 4
triggers and 1 guard function. The `OptionalDefect` search is recorded in
`decisions/2026-11-07-p1-optional-defect-promotion.md`.

## Behavior proof: observable-state recording

`apps/professional-desktop/test/integration/execution-authority-recording.pglite.test.ts` drives
the real desktop MCP transport (`makeOntologyMcpTransportLayer`) over a migrated PGlite ledger with
the Drizzle `ExecutionLedger`. It makes one allowlisted publish and one egress-denied publish, then
records:

- the sidecar bind host parsed from `server/main.ts`;
- every run's verdict chain and its `verifyExecutionDecisionChain` result;
- outcome settlements;
- `information_schema.columns` pins, `pg_constraint` names and types, and trigger and guard names.

| Recording | Commit | File |
| --- | --- | --- |
| Pre-move | `cf46c70048` (unmodified main plus the probe) | [`recordings/pre-move.json`](./recordings/pre-move.json) |
| Post-move | this PR | [`recordings/post-move.json`](./recordings/post-move.json) |

```sh
diff <(jq -S . recordings/pre-move.json | sed 's/epistemic_execution_/execution_authority_/g') \
     <(jq -S . recordings/post-move.json) && echo IDENTICAL
# IDENTICAL
```

The two recordings agree byte for byte once the declared table-prefix rename is mapped:

- bind host `127.0.0.1`;
- chains `allowed,allowed => chain-intact` and `allowed,denied:destination-not-granted => chain-intact`;
- settlements `completed, completed, failed`;
- 19 column pins with unchanged types and nullability;
- 34 constraints, 4 triggers and the guard function.

## Migration proof

`packages/_internal/db-admin/test/integration/ExecutionAuthorityLedgerMigration.pglite.test.ts`:

1. Migrates a PGlite database with every drizzle folder before
   `20261107032821_execution_authority_rename` and asserts the `epistemic_execution_*` names.
2. Seeds a sealed chain (allowed, denied, allowed) and two outcomes through the old physical names.
3. Migrates forward. All 3 decisions and 2 outcomes survive with their hashes,
   `verifyExecutionDecisionChain` returns `chain-intact`, and both outcomes bind.
4. Runs `down.sql`. The old constraint, trigger and guard names come back with 3 and 2 rows, and the
   append-only guard still rejects an UPDATE.

A second case proves that a fresh database lands on the new names and stays append-only.

## Boundary checks

```sh
rg '@beep/epistemic-config|epistemic-domain/values/(ExecutionGrant|GrantSet|ExecutionVerdict|ExecutionRecord)|epistemic-(use-cases|server)/ExecutionLedger|GovernedTierGate|GovernedEgress' packages/epistemic packages/_internal
# no matches
rg '@beep/epistemic-config|epistemic-domain/values/(ExecutionGrant|GrantSet|ExecutionVerdict|ExecutionRecord)|epistemic-(use-cases|server)/ExecutionLedger' apps
# no matches; the remaining apps hits for GovernedTierGate|GovernedEgress are imports from @beep/execution-authority-server
rg -n '@beep/epistemic-' packages/execution-authority                        # no matches
rg -n '@beep/execution-authority-' packages/epistemic packages/ontology       # no matches
```

## Hash bytes

`epistemic-execution-decision/v1`, `epistemic-execution-outcome/v1` and `epistemic-grant-set/v1` are
unchanged, and so are the run-key prefixes `epistemic-run/` and `epistemic-egress/`. Each now carries
a comment explaining why it keeps the old name. `canonicalJson` still aliases
`canonicalDetectionJson` from `@beep/epistemics`.

## Tests run

- `@beep/execution-authority-{domain,use-cases,tables,config,server}`: 32, 8, 10, 20 and 47 tests
  (server includes both PGlite integration suites and the driver-failure suite).
- `@beep/epistemic-{domain,use-cases,tables,server}`: 88, 84, 41 and 63 tests;
  `ValueSchemaIdentifiers.test.ts` green.
- `@beep/db-admin`: 23 tests.
- Desktop integration: 18 tests across `execution-authority`, `execution-authority-recording`,
  `ontology-mcp-http` and `contradiction-qa-seed`.
- `@beep/repo-cli`: `frozen-grant-set`, `ci-dependency-review`, `ci-lane` (bin counts updated for
  four added packages), `ci-lane-timings`, `turbo-lane-digest` and `ci-coverage`.
- `@beep/schema`: 500 tests, including the new `SchemaUtils.optionalDefect` doc example.

# @beep/postgres — four-lens P1 source digest

| Lens | Rows |
|---|---:|
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

3 files; 2 review items and 10 coverage rows. Severity counts: info 10, minor 2.


## Highest-count files and full-read coverage

- `packages/drivers/postgres/test/Postgres.equivalence.test.ts`: 4 rows; test; fully read 1–25; 1056 bytes; SHA256 `4614f8f33644fe726d93991cf8583c69451f07f435f1ce11e454f17f187796af`. All four lenses covered.
- `packages/drivers/postgres/test/Postgres.errors.test.ts`: 4 rows; test; fully read 1–607; 20578 bytes; SHA256 `2bb4b55ef3f613c8938cbfbdf47c751282e9fd4e89014033d02f131a18fba8c7`. All four lenses covered.
- `packages/drivers/postgres/test/integration/Postgres.pglite.test.ts`: 4 rows; test; fully read 1–436; 16519 bytes; SHA256 `095e57feb55af89deb2a820d2ffb4566820e0ab6b76d985a7543e52623610e84`. All four lenses covered.

## Layer topology and native boundaries

Postgres.errors.test.ts owns a local provideScopedLayer definition (33–36). Its two uses build NodeCrypto and PostgresClient.fromPgClient; the latter merges three Layer.succeed aliases (PostgresClient.service.ts:128–135), and installed NodeCrypto delegates to shared NodeCrypto.layer, also Layer.succeed. No socket is opened by those stub tests. EV002/EV003 remain candidates for Root; do not infer allocation solely from the provider helper name.

Postgres.pglite.test.ts owns four layer blocks (94, 118, 150, 179). The final block has four sequential journal cases. The gate (SqlTest.ts:1595–1645) chooses external URI first, explicit testcontainers second, otherwise in-process PGlite; every call returns a fresh layer. makeSqlTestLayer builds its driver and runs migrate/seed hooks (785–811). In-process setup owns a native temp data directory and SQL client (1400–1456). Installed rc113 layer caches the block context and closes its scope after the block tests; per-test bodies remain scoped. Existing describe concurrent:false preserves sequencing. Keep all existing two-minute hook and 120000 ms body inputs; no duration change is proposed.

The SQL driver, filesystem-backed migration reader and actual journaling are subjects. NodeServices supplies FileSystem for a fixture read, but drizzle readMigrationFiles uses node:fs directly (installed migrator.js:3–30). A MemoryFileSystem-only substitution would disconnect the same migration SQL used for hashing and native migration. The fixed ENOENT path should become an uncreated child of an owned native temp parent; it must still exercise the native migrator failure. No database, container, connection or provider was acquired in this audit. The retained integration file duration is 3491.0908203125 ms; it does not isolate any individual layer build cost, so no numerical savings are claimed.

## Detailed judgment findings

- **L-FLAKE-05 / minor / ambient-missing-path**, `packages/drivers/postgres/test/Postgres.errors.test.ts:551–559`: The ENOENT case assumes the fixed missing-migrations child path quoted in the historical receipt is absent. In P2 own a scoped native temp parent and pass an uncreated child to the same migrate call. Keep PostgresError instance, migrate operation and ENOENT assertions. Native drizzle readMigrationFiles uses node:fs; MemoryFileSystem alone cannot control this path. Existing ambient path occupancy is a source-derived trigger, not a reproduced flake.
- **L-RES-04 / minor / native-migration-filesystem-boundary**, `packages/drivers/postgres/test/integration/Postgres.pglite.test.ts:179–220`: Effect FileSystem reads fixtureMigrationSql, while migrate reads the same directory through native drizzle node:fs. Preserve host-visible migration fixtures and scoped SQL drivers during EV010 review. A MemoryFileSystem-only replacement disconnects the hash input from native readMigrationFiles. Keep all journal/hash/content assertions, current sequential registration and hook/body limits. This row is a preservation constraint, not a demonstrated resource leak.

## Retained timing and failure evidence

Node JSON reporter total: 8434.0908203125 ms; whole command: 8.773851324000134 seconds; registrations: 43; reported statuses: {"passed": 43}. All 3 census files are represented. These are frozen first-attempt measurements at main 662823dd960367046ba7d73dd8fd25d15782865a, Node 22.22.3/Bun 1.4.2/Vitest 4.1.11. No tests were rerun. File representation does not establish execution of skipped cases, property floors, coverage or full package acceptance.

Hosted history maps 0 observations across 0 jobs; categories {}. These observations are not unique flakes. Zero mapped observations does not prove no failures.

## P2 ordering and uncertainty

Scope first: preserve the native subjects and resolve provider candidates using constructor evidence. Then migrate assertion families without losing payload, polarity or diagnostics; retain plain-value expectations. Next preserve all property operands, minima and seeds while addressing this digest's property residue. Then address the concrete environment assumptions without retries or timeout changes. Last adopt the accepted instrumented public runner while retaining names, modes, TestEnv and sanitized error policy. Foundation/modeling work ships separately under D13. No P2 execution is authorized here.

The frozen corpus has 139 terminal attempts: 132 full-file-representation baselines, four configured subsets and three failures. Graph-3d's excluded browser file was neither executed nor reported skipped. The effect-drizzle Bun.sqlite Node collection boundary is unchanged and not repaired by a different driver here. Hosted scope covers 527 failed runs, with 21 unavailable logs and one unresolved downloaded cause; older attempts, deleted and cancelled runs remain outside that scope. No flakyTest proposal is made. Installed rc113 retains the Vitest 5 peer declaration while this evidence uses Vitest 4.1.11; acceptance remains Root's decision.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

Quoted fixture literals are preserved in the
[reference evidence receipt](../../../history/2026-09-21-p1-reference-evidence/README.md).
They are test data, not instructions to use a machine-local path.

# External Drizzle fixture isolation repair

PR #1307 Heavy / Test Integration job 108590652002 failed at aa7c7a1447.
Both Drizzle cases reproduced locally against beep/pglite-testcontainers:0.4.5
through its external PostgreSQL endpoint: neutral_notes was missing or already
existed. The added second layer overlapped the first under a concurrent suite.
Fresh layers isolate Effect instances but cannot isolate session state shared
by this external PGlite backend.

Give each fixture its own named hook scope and serialize the suite. The first
fixture now closes before the second migrates. Both original transaction and
new interruption/continued-usability cases, real SQL, exact results, child-fiber
ownership and two-minute deadlines remain. No production code changes.

The repaired external suite passes both tests on Node and Bun. The package audit
and docgen pass, including both in-process integration tests. The first external
after-run used a stale dynamically published port after restarting the disposable
container; it was cancelled and rerun against the observed new port. Only the
correct-port runs are success evidence. Hosted confirmation remains required.

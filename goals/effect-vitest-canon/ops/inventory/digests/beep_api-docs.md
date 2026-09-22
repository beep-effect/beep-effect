# @beep/api-docs P1 digest

### @beep/api-docs

3 complete assigned census files; 12 rows, 3 minor review items and 9 info coverage rows. Every lens has 3 file rows.

Catalog provides BunServices for committed-path existence. Docs and health acquire/dispose independent in-process ApiLive web handlers; routes read committed specs and installed Scalar. No port listener or browser is started. No isolated rebuild duration or speedup is established.

**apps/labs/api-docs/test/Catalog.test.ts**

- resource: **L-RES-04**, lines 17–40, minor. The filesystem case verifies committed repository specifications, not arbitrary FileSystem behavior; seeding MemoryFS would fabricate that provenance. When resolving EV002/EV010, keep the actual repository path resolver and committed-file existence check under harness-owned platform provision. MemoryFileSystem seeded with expected names would prove fixture setup rather than committed asset presence. Preserve all nine entries, unique slugs, four contract generation calls and path-labeled assertions. No native server or provider operation is needed.
- flake: **L-FLAKE-NONE**, lines 1–48, info. Nine-entry and four-contract counts are fixed; existence checks are concurrent reads, with no mutable shared fixture.
- property: **L-PROP-NONE**, lines 1–48, info. Unique slugs, exact entry counts and all contract generation calls are covered; no generated catalog substitute is justified.
- observability: **L-OBS-NONE**, lines 1–48, info. Existence assertions carry source.specPath, preserving missing-file attribution during layer migration.

**apps/labs/api-docs/test/Docs.routes.test.ts**

- resource: **L-RES-04**, lines 16–60, minor. A scoped toWebHandler owns ApiLive disposal and serves actual committed spec and pinned Scalar assets without opening a network listener. Retain in-process public HttpRouter handler behavior, actual committed spec bytes and installed Scalar asset version, CSP and CDN negatives. A harness-owned fixture must acquire and dispose the same handler; resolving EV004 must not delete cleanup. Do not replace actual repository files with seeded MemoryFS or launch an external browser/server. This constrains migration, not evidence of a current leak.
- flake: **L-FLAKE-NONE**, lines 1–65, info. Requests are awaited sequentially and handler disposal is acquired with a finalizer; no external HTTP service or timer is used.
- property: **L-PROP-NONE**, lines 1–65, info. Statuses, HTML/JS types, self CSP, absent CDN and exact Scalar version/size are explicit; preserve all operands and negative assertions.
- observability: **L-OBS-NONE**, lines 1–65, info. The composite case has endpoint-specific response assertions; logger disabling does not alone prove missing failure context.

**apps/labs/api-docs/test/health.test.ts**

- resource: **L-RES-NONE**, lines 1–23, info. The in-process handler has acquireRelease disposal; shared application layer ownership must preserve this finalizer when addressing EV004.
- flake: **L-FLAKE-NONE**, lines 1–23, info. The health request uses a local web handler and no network transport, server port or retry.
- property: **L-PROP-04**, lines 15–18, minor. The health test decodes an ok body but never asserts HTTP status, allowing a non-success response with the same body to pass. Preserve schema decoding and exact health.status ok assertion. Add an explicit expected HTTP 200 assertion before reading the body; otherwise a 500 with the same valid body satisfies this test. Keep the local handler and disposal, with no real network request or weakened Health schema.
- observability: **L-OBS-NONE**, lines 1–23, info. A named health case decodes the response schema directly; no hidden catch or lost cause is established.

Retained timing: 5 passed registrations, reporter total 3766.24365234375 ms; whole command 4.120752062000065 seconds. This is the accepted configured Node baseline, not a new execution or package/coverage proof. Hosted history maps zero observations to this package; that is not proof of no failures.

P2 order: scope and subject boundaries, assertion oracles, property registration with all floors/deadlines preserved, cause-supported flake work, then observability. No flakyTest proposal is supported. Root has accepted these P1 inventory rows; P2 remains gated.


Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

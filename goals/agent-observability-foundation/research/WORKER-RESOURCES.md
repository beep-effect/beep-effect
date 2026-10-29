# Worker resource and ownership proof — 2026-10-28

The composed worker passed a disposable Linux process proof with synthetic metadata. This qualifies the tested process arrangement; it does not enroll a source, start the production forwarder, explain the historical swap/VMA fault, or complete the foundation SPEC.

Evidence: [resource receipt](../ops/worker-resource-verification.json), [reproducible verifier](../ops/verify-worker-resources.py), and the actual worker fixture at `packages/tooling/library/ai-metrics/test/fixtures/observation-worker-process.ts`. The fixture's pressure and control routes are test-only and must never enter a production listener.

## Arrangement and measured boundary

The actual Effect/Bun worker opens its own synthetic SQLite journal and starts paused. An external `flock --no-fork` keeps an advisory lock in the worker process. The verifier binds that lock to the exact open descriptor and kernel lock record, and proves a second owner is refused. The kernel's Btrfs device identifier differs from ordinary file metadata on this host; matching only those device strings would incorrectly report a missing lock. The corrected proof uses the descriptor's file identity and its kernel lock information.

Caddy 2.11.7 fronts the worker through a mode-0600 Unix socket in a mode-0700 proof directory. Its HTTP listener binds only an exclusive ephemeral IPv4 loopback port; the verifier checks that the Caddy PID owns that exact listening socket. Admin and automatic HTTPS are disabled. No backend, historical archive, real prompt or credential is used.

| Resource | Worker | Proxy | Evidence |
| --- | --- | --- | --- |
| Memory | 512 MiB | 128 MiB | Actual cgroup limits; worker deliberately crosses its ceiling and receives an OOM kill |
| Additional swap | 0 | 0 | Actual cgroup limits |
| CPU | 50% of one CPU | 25% of one CPU | Actual cgroup limits; two-second worker burn exercises throttling |
| Tasks | 64 | 64 | Actual cgroup limits; task exhaustion is not deliberately exercised |
| File descriptors | 256 | 128 | Actual process limits; worker reaches EMFILE, releases handles and serves the next request |
| Per-file size | 2 MiB | 2 MiB configured | Worker process limit inspected; this is not an aggregate directory quota |
| Core dumps | disabled | disabled | Actual process limits |
| Lifetime | 60 seconds | 60 seconds | Disposable service limit; no restart loop |

The combined configured ceiling for one worker and one proxy is 640 MiB, 75% of one CPU and 128 tasks. The first proxy is stopped and checked before the restart proxy is created. The journal has a separate 1 MiB SQLite page ceiling and a 1 MiB logical payload budget. Database files, rollback files, backup generations, logs and other temporary files still need an aggregate storage policy before deployment.

## Requests, receipts and recovery

- Paused admission returns 503 with no receipt; restarting also begins paused.
- A valid synthetic request commits one metadata page and one native receipt. The private prompt marker is absent from the stored payload.
- A 262,145-byte body receives 413. A 25,000-byte header probe receives 431 with a configured 16 KiB header limit. Go's bounded header read-ahead means this is not a claim that precisely byte 16,385 is refused.
- Incomplete headers are closed in about two seconds. An incomplete body receives retryable 503 without a receipt in about one second. Refused requests do not change the admitted population.
- After the deliberate OOM kill, independent SQLite integrity and population checks pass. A fresh worker on the same journal starts paused; after explicit resume, exact replay returns the original receipt without a duplicate page.
- Every owned proof worker and proxy is stopped, and cleanup is included in the evidence. No held forwarder unit is touched.

Local acceptance happens when the metadata transaction commits. A returned receipt proves that local boundary, not Phoenix visibility. A response can still be lost after commit; exact replay is the recovery mechanism. Requests lost before local commit have no durable receipt and remain outside the ledger. Neither a successful request nor an idle listener supplies the missing fleet denominator.

## Failed approaches retained as findings

Bun's configured two-second idle timeout did not close an incomplete-header connection within the six-second test window. A custom Effect socket relay then lost early HTTP 413 responses while the client was still uploading. A unit fixture could model a successful early response, but actual sockets still lost it. The relay source and its tests were removed; their passing unit result was not accepted as transport proof. The standard proxy arrangement passed the real exchange.

Caddy is used only as a checksum-pinned test dependency here. The official release archive has SHA-256 `727b91701a392de6ebc5027509f548bf39979e5216340d0faed8fa5e69c84f8b`; its Linux amd64 binary has SHA-256 `678ade3bfc088749c81a681adc603333ee0bb023b6a6cfe3c0f58bef8ff854e9`. The verifier requires that binary and records its identity. It was extracted into a user cache, not installed as a system service. Configuration follows the [official server timeout and header options](https://caddyserver.com/docs/caddyfile/options) and the [official v2.11.7 release](https://github.com/caddyserver/caddy/releases/tag/v2.11.7).

## Next qualification

Production composition still needs the owned launcher, scheduling and observable refusal/lag signals; exact connection admission and aggregate storage policy; independent backup and guarded restoration; actual CLI/desktop routes; and bounded canary/rollback. Proxy logging also needs an explicit metadata-only policy before real producer traffic. This proof is process-failure evidence, not a power-loss or storage-device-failure experiment.

For the backup lane, the existing Effect Bun client offers whole-database export, while the Node client offers SQLite backup. Whole-database export would introduce a memory-sized copy; selecting it requires an explicit bound. SQLite's [VACUUM INTO documentation](https://www.sqlite.org/lang_vacuum.html) describes a consistent separate database but warns that interruption can leave an incomplete output, and that implicit row IDs can change. Any implementation must bind the snapshot to journal identity, verify it before publication, retain the prior generation after failure, and qualify restoration into a distinct owned database before replacing any route. No physical backup or restore implementation is claimed by this resource receipt.


## Controlled-stop and streaming follow-up (2026-10-28)

Routine verification now uses a controlled stop; only explicit `--exercise-oom`
invokes deliberate memory exhaustion. The successful older OOM receipt remains
separate. The latest routine evidence is
`ops/worker-resource-controlled-stop-verification.json`.

An intermittent oversized declared upload previously produced Caddy 502 because
the backend closed its unread upstream body. The proxy now rejects declared
bodies above 256 KiB before forwarding and applies the same streaming body cap.
The real-worker verification passed 24 consecutive oversized declared requests
(413), six valid/oversized chunked pairs (200/413 with exact receipt replay),
and six rounds of paused/unsupported-type/wrong-method/unknown-route requests
with 128 KiB bodies (503/415/405/404, no receipt). Header/read deadlines and
unchanged accepted populations also passed. This is the exact synthetic listener
configuration's evidence, not broad producer or production qualification.

The same run verified a separate physical snapshot, controlled restart, and
exact receipt replay; all owned units stopped. Physical backup implementation
and crash/corruption tests are documented in `PHYSICAL-BACKUP.md`. Aggregate
storage, production scheduling, connection admission and rollout remain open.

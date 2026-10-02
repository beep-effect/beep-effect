# Signed runner integration boundary

The private native probes establish protocol behavior for the pinned stable and
canary clients. The owned `cache protocol-run` command now executes nine synthetic cases through
the existing Cache command group. The retained command-level receipt is
[owned-protocol-runner.json](./owned-protocol-runner.json). Real-pilot execution
and protected receipt import remain separate required work.
One integration writer owns the remaining changes. PR #1327 merged before
this implementation was integrated; consolidate the remainder in one final PR.

## Reuse and placement

- `Cache.protocol.schemas.ts` and `Cache.protocol.ts` currently bound and review
  six synthetic native cases with observation-only authority. Keep that limit
  explicit until the trust-owned contract supplies validated provenance.
- The existing `Cache.pilot.ts` owns real-pilot source mounts, toolchain/runtime
  verification, dependency freshness, native summaries and replay-log checks.
  Reuse those mechanisms for signed comparisons; do not create a second real
  pilot runner in the conformance packet.
- The existing scoped capture and scheduler APIs own subprocess termination,
  capture bounds and admission. A scoped local server must release its listener
  and storage after success, rejection, timeout or interruption.
- Keep server artifact tags opaque. Signing material belongs only to native
  clients. HTTP reader and writer authority remain separate from signing.

## Trust boundary

The local fixture supplies fresh synthetic credentials for each invocation and
uses distinct stable/canary namespaces. Reader mounts exclude protected storage
and producer receipts; PID isolation excludes the parent environment. The
stronger retained probe verifies both read and write denial and scans every
fixture file plus captured stream for those credentials while they are still
available in memory. Source, client, runtime and backend identities must be
bound by the owned runner before its receipts become importable.

The current real pilot uses `--unshare-all` and local-only cache arguments.
Signed mode must introduce only the controlled fixture endpoint and preserve
all existing fresh-authority, input, dependency and capture checks. Network
access is a changed profile boundary and must be represented explicitly;
passing a prior offline matrix cannot silently establish the online profile.
Prefer keeping a private outer network namespace for the trusted supervisor and
local HTTP endpoint, then nested reader user/PID/mount isolation sharing only
that namespace. A separate bounded network probe now confirms nested loopback HTTP succeeds,
no default route exists and an external address fails with network unreachable.
Its receipt lives in the trust packet as `nested-fixture-network-probe.json`.
This probe did not execute Turbo. The owned runner must combine the demonstrated
network and file/process boundaries before claiming real-pilot evidence.

## Required acceptance before promotion

1. Exercise the reusable synthetic runner with genuine hit/miss, signature and
   body faults, authorization/tenant/epoch rejection and transport ambiguity.
2. Keep unexecuted corpus cases explicitly pending; no local result scores AWS
   direct-invocation/IAM or backend capacity gates.
3. Execute three isolated signed fresh/replay pairs per pinned client for the
   real pilot, with wire/storage/native relationships and restored-log equality.
4. Add adversarial importer tests for altered identities/receipts, duplicate
   pairs, rejected upload, false hit, unsigned fallback and absent producer
   protection. Ordinary editable request JSON cannot grant qualification.
5. Replace the existing qualified-state rejection only when those accepted
   contracts and operational checks actually exist. Package and final Yeet
   proof remain required on the integrated implementation.

## Owned command checkpoint — 2026-09-29

`cache protocol-run --request <request.json> --output <report.json>` accepts a
channel, exact client pin (version, binary SHA-256 and namespace), and executable
path. It admits one bounded job, starts the fixture supervisor in a private
network namespace, and uses separate nested user/PID/mount namespaces for native
clients. The worker refuses interfaces other than loopback. Each reader receives
only its reader capability and signing material; server storage remains outside
reader mounts. Per-native capture is bounded at 64 KiB per stream and 120 seconds;
the supervisor has a 15-minute deadline. Temporary roots are scope-owned.

Both clients pass producer/replay, four signature/body rejection cases, and
truncation/429/503 cases. Negative cases reject any restored output directory.
Wrong binary/version/channel requests fail without a report and clean their
temporary roots. An unconfined worker fails before fixture execution.

The worker checks native summaries and file captures before cleanup. Retained
reports contain only hashes, outcomes and sanitized events; they deliberately
remain editable observations with no qualification authority. The real pilot
must reuse its existing runtime, dependency, source and replay-log checks and
produce a separately versioned signed-profile receipt. Do not relabel its offline
local v5 receipt. Protected producer validation and operational import remain
required before changing qualified-transition rejection.

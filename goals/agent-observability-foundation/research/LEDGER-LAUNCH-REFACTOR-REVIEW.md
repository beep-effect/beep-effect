# Ledger, launch facts and readback fixture review — 2026-10-29

Independent reviewer: existing `review.panel` Astra xhigh session
`/root/foundation_panel_astra`, separate from the implementing orchestrator.
Scope: compare the exact before snapshots and current source. Read-only review;
the reviewer did not run tests or certify the orchestrator's execution results.

## Exact source binding

| File | Before SHA-256 | Accepted SHA-256 |
| --- | --- | --- |
| `src/delivery-ledger.ts` | `2851683ef96997ae3995c892002fb4a9384c227938394309b65b4bdd22d73244` | `796f8afe623bf0c0191fd6bc598a26d3c77e68d5f02fa24648931f1c1ddc1bc3` |
| `src/observation-launch-facts.ts` | `775f221abd1ab56e947227bc02b55c7264489917158c0fc0cf1a231b1a2a640a` | `95a792708cc5858115577f2e272227d7e68b420067b7abe4edfdfd5e5d6d7cac` |
| `test/native-readback.test.ts` | `81a53c94da63307ff321d1125b8847efb3010edfcf286e15a914a217a4db4722` | `1e2a3d794c1d738d4ea8f847f8acb9d3041e1af7f3c456c77d5770ed1b00640e` |

Paths are relative to `packages/tooling/library/ai-metrics`. Before snapshots
are retained with the delivery verification archive.

## Bounded acceptance

No actionable semantic regression or weakened assertion was found.

Ledger registration preserves marker lookup, validated and hashed candidates,
population lookup, identity conflict before new-identity capacity, and atomic
event/page insertion. Attempt replay remains before capacity and sendability;
sorted identities, checksum/clock/insertion order and transactions are unchanged.
Send reservation, outcome recording and visibility recording are byte-equivalent
to the before snapshot. State reads validate bounded ordered history before
visibility. Exact projection precedence remains visible, accepted-unverified,
unresolved, rejected, pending; later rejection cannot erase prior acknowledgment
or ambiguity. Helpers retain the captured SQL client and original transactions.

A subsequent deduplication extracts the identical bounded outcome query and
optional decode. The first extraction used a plain Effect-returning callback
with `fnUntraced`, which this installed Effect version requires to be a generator.
It failed 39 of 52 regression cases with `iter.next is not a function`.
The reviewer explicitly withdrew acceptance of intermediate hash
`cd0cfe08e727b2772bdcd42514a670cd88d8f117c6cafe74f640527faebb2927`
and acknowledged missing runtime API compatibility. The final generator version
above passed all 52 cases and received a fresh source review against previously
accepted `7831edb8fad2b9b6006b087fc73ef3aed3ad709ead0526bed5ae7badb49db1d4`.
It preserves parent/membership refusals before reads, checksum before decode,
encoding before raw prior-payload comparison, and original transactions/errors.
The failed intermediate run is retained as evidence, never counted as passing.

Launch facts preserve public models, privacy and receipt identity. Stored-row
validation retains payload length, byte count, epoch, checksum, decoding, owner,
phase, recorded-time and identity order. An earlier binding failure still avoids
identity hashing. Exact replay remains before transition, capacity and clock
checks. Closed/prepared/started transition rules and non-success closure without
a start remain equivalent. Oversized receipts short-circuit budget reads;
non-preparation facts skip reservation reads. Writes remain in the transaction.

All eight readback test declarations, inputs and assertions are byte-equivalent
from the first `it.layer`. Fixture extraction retains scalar decoding including
zero and false, literal mutation values, and every adversarial timestamp branch:
split point, rounded point, reversed endpoints, submicrosecond representation,
valid rounding, excessive drift and second carry. Test-local helpers introduce
no production matching logic into expected values or change resource lifetime.

This acceptance covers the three exact refactors only. It does not replace
required package tests, final installed proof, the complete panel, hosted gates,
real harness coverage, or packet closeout. Recovery hold remains unchanged.

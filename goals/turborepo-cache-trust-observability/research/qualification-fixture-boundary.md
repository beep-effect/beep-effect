# Qualification signed-fixture boundary

This is an implementation design, not an accepted trust receipt. Qualification
needs the early signed-fixture handoff, not completion of production rollout.
PR #1327 has merged; one integration writer owns the remaining Cache roles in
the final qualification branch. Conformance owns case
execution and trust owns result/producer contracts. Qualification owns the
importer and lifecycle decision.

## Existing contracts and missing consumer

Reuse `CacheQualificationKey`, `CacheQualificationPins`, `CacheClientPin`,
`CacheEvidenceReference` and `CacheQualificationObservation` from the curated
`@beep/repo-configs/cache` facade. Cache currently has no signed receipt importer:
`validateTransitionContract` rejects every `qualified` transition. Keep that
rejection until a validated producer/result contract and adversarial importer
checks replace it. A shape-valid local JSON document must never unlock promotion.

The exact client source pins are recorded in the conformance packet's
`current-qualification-client-pins.json`. Both selected versions use the same
length-prefixed signature v2 implementation. Canary remote-call suppression
requires isolated fault processes and explicit wire-call accounting.

## Minimal local fixture

Use an isolated local HTTP/storage fixture with no production endpoint, account,
credential, or incremental cloud resource. The client must perform real native
signed PUT/HEAD/GET; copying a local archive cannot earn remote-hit credit.
Keep artifact signing material in client processes only. The server preserves
opaque tags and independently enforces reader/writer bearer capabilities and
one exact tenant/epoch. Reader clients must not receive writer credentials or
write access to fixture storage or producer receipts.

Bound each case by process timeout, request count, body bytes and retained
capture size. Derive representative payload/load limits from observed artifacts
before scoring capacity. Direct request and storage receipts must correlate by
case/request id, task hash and content digest without retaining bearer values,
signing keys, artifact bodies or sensitive paths in public reports.

Use a dedicated protected fixture storage boundary outside reader mounts, and
prove reader inability to mutate objects or producer receipts. A local report
hash is an integrity binding only, not protected-producer authority. Until the
storage/process boundary is demonstrated, producer attribution remains
unproven and the importer must reject promotion. No asymmetric attestation is
introduced by this design.

## Required early handoff

1. Versioned result variants distinguish genuine miss, read/write denial,
   tenant/epoch/profile mismatch, missing or invalid tag, corrupt/truncated
   payload, unavailable/throttled transport, ambiguous write and invalid receipt.
2. Producer evidence binds source/workflow provenance appropriate to the fixture,
   exact client/backend identities, task hash, tenant/epoch, accepted upload and
   immutable stored bytes. It declares the demonstrated protection mechanism.
3. Native rejection is checked before restored output appears. A successful
   fallback computation cannot turn a signature failure into a passing hit.
4. Qualification imports three isolated fresh/remote-hit pairs per client,
   preserving distinct root/run/receipt identities and existing semantic/shadow
   obligations. Stable and canary namespaces stay separate.
5. Importer negatives cover edited receipts, wrong source/pins/profile/epoch,
   duplicate pairs, missing wire/storage events, rejected uploads, false hit
   reports, absent protected producer and unsigned fallback.

All 32 conformance corpus ids remain in the case inventory. Cases not executed
by this early slice remain explicitly pending; local fixture results do not
score AWS invocation/IAM behavior or backend comparisons. Trust production
readiness and observation windows remain separate incomplete milestones.

## Demonstrated local mechanism

The 2026-09-29 isolated stable/canary receipts now demonstrate a candidate
mechanism: separate bubblewrap user/PID/mount namespaces, protected files outside
reader mounts, reader-only bearer authority, and parent-owned storage/receipt
verification. All five reader cases deny protected file and parent-environment
reads/writes. Native signatures and denied reader uploads are observed on wire.
These private probes still need the reusable owned runner and adversarial
importer before they can satisfy the accepted handoff. A public JSON digest
alone remains insufficient authority.

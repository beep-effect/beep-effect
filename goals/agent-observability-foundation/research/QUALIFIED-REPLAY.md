# Target-qualified delivery recovery

The scheduler previously queried accepted or unresolved attempts indefinitely.
A durable pre-send reservation followed by a crash before transport therefore
had no automatic forward-progress path. The regression test first failed with
`Reconciled` where a qualified replay required `Sent` (12 existing tests passed).

The replacement remains conservative by default. An optional immutable scheduling
policy binds a target ID, an owner-supplied qualification receipt digest and a
minimum replay delay. The digest is a provenance reference, not an automatically
validated certificate. Qualifying another backend/version/project is an operator
responsibility; the library refuses a different target ID before creating its
schedule. Policy changes refuse an existing scheduling profile rather than
silently retargeting its events.

After a fresh successful read-back reports Missing, only a qualified policy may
repeat the event. Missing is not proof of loss. Read failures and metadata
mismatches never authorize a send. The minimum delay, existing capped exponential
backoff and both ledger attempt ceilings remain enforced. Every actual retry has
a new attempt ID, retains stable event/span identity and preserves prior receipt
facts. Transport acceptance still does not imply visibility. Unqualified profiles
retain their previous encoded policy and behavior.

## Evidence

- `ops/native-duplicate-replay-verification.json`: pinned Phoenix and rendered
  collector; six native submissions with identical payload digests retained
  three unique native spans and unchanged usage totals. Including reconstructed
  fixtures, nine records remained after collector shutdown.
- `ops/native-qualified-recovery-verification.json`: a loopback fault proxy dropped
  one synthetic request before forwarding it. The sender recorded unresolved;
  a reconstructed scheduler queried the actual backend, repeated identical bytes
  under a fresh attempt and subsequently recorded visible. The first scenario
  establishes the project before the dropped request. This is scheduler
  reconstruction plus actual transport failure, not a process-crash proof.
- `ops/native-qualified-recovery-source.json`: source hashes and guarded focused
  test receipt. Eighteen scheduler tests cover default hold, target refusal,
  delay, query failure, mismatch, attempts exhausted across reconstruction,
  interrupted-send recovery, fresh IDs and matching payload digests.

The first recovery fixture dropped the very first request, before its Phoenix
project existed. Read-back correctly failed instead of authorizing a retry.
That failed run removed all owned resources; the corrected fixture establishes
its disposable project before injecting failure. A missing/unreachable project
remains a configuration/query failure, not evidence permitting replay.

All fixture content is synthetic. No held collector, real producer, historical
archive or production scheduling policy was changed. The previous qualification
receipt remains immutable. Full package quality is recorded separately; these
proofs do not close retention operations, deployment sizing, real harness coverage
or repository delivery.


## Permanent refusal and hop accounting correction

The scheduler now checks the latest immutable attempt outcome before a qualified
Missing replay. A later permanent HTTP refusal suppresses another send even when
the event's derived state correctly retains earlier acceptance or uncertainty.
Read-back remains available. Both accepted-history and interrupted-history
regressions passed in the 20-case scheduler suite.

The refreshed pinned-backend proof is retained in
`ops/native-qualified-recovery-hop-verification.json`, with its direct source
binding in `ops/native-qualified-recovery-hop-source.json`. It records seven native
transport attempts, one dropped before upstream, and six native submissions to
the collector. Six reconstructed sends are accounted separately. The exact proxy
count and identical dropped/retry payload checks pass; Phoenix retains three
native plus six reconstructed spans and unchanged usage totals. Earlier receipts
remain historical; their ambiguous `nativeNetworkSubmissions` label is superseded
by these explicitly separated counts. No actual harness enrollment is implied.

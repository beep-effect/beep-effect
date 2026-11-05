# Source-bound isolated regex worker

The private regex supervisor now sends one preflighted native-word job to an
isolated Bun child. Both parent and child bind the width-sensitive fingerprint,
flags and independently installed profile against freshly compiled original
words. Effect Rpc/RpcGroup, RpcClient/RpcServer.makeNoSerialization, Stream/Sink,
ChildProcessSpawner, Scope, Clock, timeout combinators and transactional shared
admission provide the execution machinery. Thin shared native RPC configuration
and restricted process construction are also used by HTML. No parallel RPC,
process-spawning or timer implementation is introduced.

The child renders the source-point alphabet, executes incrementally with
Effect's RegExp constructor and native exec, and feeds the existing bounded
capture collector. Effect String.matchAll would materialize all matches before
the collector could enforce the quota. Complete result frames retain the
existing result/v1 encoding. Remaining-match quotas, including zero, are
checked before native span decoding. An oversized result publishes no partial
capture table. Ready, Started and terminal framing remain strict; Started means
that a complete job was decoded, not that native matching has been entered.

The parent's native deadline covers spawn, startup, traffic and matching; its
captured stage/operation deadline also covers preparation and queueing. The
shared owner retains total and regex leases through retirement and only
publishes the result after exit acknowledgement. Child errors cross a closed
schema union without source-bearing engine diagnostics. A regression test found
and fixed reply structural preflight accidentally rejecting the nested safety
error; flat request preflight retains its original one-object limit.

This is an internal execution boundary, not family approval or a completed
engine. The initial evaluated profile requires positive width, at most ten
capture groups and no repeated captures or nullable repeated body. Unsupported
profiles fail explicitly. Canonical family matching, scaling and capability
review, remaining Python matching profiles, public engine composition and full
parity accounting remain obligations. No safety policy or semantic waiver is
changed. PR #2637 owns the Effect 4.1.2 dependency upgrade; this checkout is still
qualified against installed patched 4.1.1.

Focused evidence:

- Four actual-child tests cover participating/unmatched captures, zero-match
  quota success and quota exhaustion, unknown-pattern rejection before spawn,
  and scalar versus literal-surrogate-word matching and UTF-16 projection.
  Every returned native result is accompanied by an independent OS PID exit
  observation, with shared total/regex reservations back at zero.
- Forty-four focused result, framing, ownership, HTML/regex RPC and host-resource
  tests pass. Server test compilation and package laws pass.
- Hosted Check run 41591267727 on dfc56bc1df passed Heavy / Check, Heavy / Test
  Integration and Fallow Advisory Envelopes. The partition repair therefore has
  full hosted proof at that revision. New worker changes require a new run.

Hosted lint failures on that revision were a stale generated identity profile,
five literal discriminator fields and two newly detected test-resource findings.
Regenerate the profile and use schema tag fields. Preserve reviewed real-OS
resource exceptions: NativeProcess tests assert actual child retirement;
RegexWorker tests require an OS-visible entrypoint and temporary directory.
MemoryFileSystem would change those subjects. The qualification helper's nested
Scope intentionally closes each child before its concurrency slot is reused
and before its independent exit assertion; test teardown alone cannot do that.
The targeted detector rows were generated using the repository's detector and
schema encoder, then given these specific reasons in the inventory. No unrelated
baseline findings were accepted or rewritten.

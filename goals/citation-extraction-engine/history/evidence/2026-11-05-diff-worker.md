# Owned default-diff worker and shared transport boundaries

The private default-diff adapter now runs the authenticated kernel only in an
independently stoppable Bun or Node child. Installation captures immutable policy,
runtime, Clock, Scope, process spawner, the optional composed text budget and the
existing native admission service. Returned methods have R=never and a closed
kernel/transport/resource error channel, checked by a compile-time assignment.
Both native layouts, their combined UTF-16 allowance and the exact complete job
frame are checked before receiving copies or acquiring native capacity. The
existing reserved Unicode owner preserves source bytes and projection distinctions.

The evaluator accepts a reducing per-call step quota bounded by policy. A zero
remaining quota can return a complete empty diff; a nonempty edit result fails
without a partial value. Policy installation still requires positive limits.
This is a quota seam, not a completed engine-wide work counter.

## Reused Effect and repository capabilities

The installed dependency is Effect 4.1.2. RpcGroup, RpcClient.makeNoSerialization,
RpcServer.makeNoSerialization, Deferred, Scope and concurrent Effect.zipWith own
the RPC request/result lifetime. The existing ChildProcess command, admission
transactions and physical owner retain queueing, immediate force-kill configuration,
independent exit acknowledgement, cleanup deadlines and quarantine. No second
scheduler, notification protocol, retirement loop or process registry is added.

Shared helpers move the existing regex lease acquisition/start/retirement sequence
into withCitationNativeProcess; regex and diff both use it. HTML, regex and diff
share Ready/Started/terminal ordering, EOF validation and registered-write delivery.
Existing HTML/regex JSON/base64 preflight and error translation now live in one
NativeJson/ByteFrames boundary. Schema still owns JSON/base64 encoding/decoding.
The shared restricted WASM host additionally owns pinned ABI initialization and
bounded asset loading. Existing successful HTML/regex wire representations remain
unchanged, and their regressions pass.

SchemaBinary and RpcSerialization.layerSchemaBinary were inspected before choosing
this reuse. The installed binary codec exposes an arena-backed encoder and a
parser maxFrameSize; it has no encoder size-measurement or output-ceiling API for
the required refusal before variable output allocation. The existing resource
guard is therefore retained and shared, rather than writing a third serializer
or frame reader. Inspected package-source SHA-256 values:

- effect/src/encoding/SchemaBinary.ts:
  172f897a9498311ab519dcac2b63566ad7075bc8ca3519516e6f24bec13047f7
- effect/src/rpc/RpcSerialization.ts:
  226befca4f4742e52a512e989fa82f4773e62fc59593d7f18e671f945dcee309

## Complete framing and native output allocation

The wire carries original native widths/bytes and packed little-endian edit
pairs. It never projects native input into a JavaScript string for diffing.
Request preflight encodes only a bounded empty-payload header, then charges both
exact padded base64 lengths and the terminal LF. Success capacity similarly comes
from the exact empty-success header and remaining base64 capacity. Decode uses
the existing bounded frame reader, fatal UTF-8, structural work limits and strict
Schema codecs. Extra/missing/partial frames and unknown message structures fail
without returning a result.

The authored C++ ABI now exposes the required step count independently of packed
emission. The host supplies the smaller policy/transport emission allowance before
the native vector allocation. A refusal retains a zero published vector, and the
required count distinguishes diffSteps from processMessageBytes. Native algorithm
workspace remains bounded by the authenticated module's 512 MiB maximum and the
parent's stoppable child; no partial output is accepted. The upstream DMP header
and original-source expectations remain unchanged.

Two clean builds reproduce the current binary and receipt. Current WASM is
874,218 bytes, SHA-256
eede49e6c281c6d4735ce8dea2a0d218fd39364008cf3c811e12efda491df2bf.
The standalone sealed verifier passes all 1,052 maps / 9,978 steps under both Bun
and Node, including required-count and no-partial-result checks. This supersedes
the earlier host binary digest without changing the source algorithm.

## Timing finding and qualification

The first delayed-exit control exposed extraction timing around the cleanup
boundary: extractDeadline masked cleanupDeadline. The extraction timer now wraps
only preparation/queueing/native/RPC work inside the shared ownership boundary.
Independent retirement follows that timer; the separately captured operation
timer covers the whole call. Both runtimes now return cleanupDeadline while
retaining quarantined capacity when exit acknowledgement is delayed. Caller
context cannot replace the captured clock.

All 62 focused tests pass across nine files: diff worker, diff protocol/kernel,
existing regex worker/protocol/result, shared physical owner, and HTML host/protocol.
The real source smoke checks eight maps per runtime and confirms each child exit
with an independent OS probe. Additional real native calls prove closed step
refusal and complete zero-step success. Both runtime controls prove parent
responsiveness, captured deadlines, cancellation-before-return retirement and
quarantine until late acknowledgement. Input/cumulative-text refusals spawn no
child; caller-provided replacement text services cannot replace captured authority.
Boundary tests cover all base64 residues, exact complete-frame limits, malformed
structure/UTF-8, packed edit coherence, fragmentation and excess frames.

Local receipts retain initial failures and final passes separately:
.beep/diff-worker-qualified-regressions.log (62 passing),
.beep/diff-worker-final-lifecycle.log (26 passing after the final test-helper
formatting repair), .beep/diff-worker-complete-typecheck.log and
.beep/diff-worker-package-verify-final.log. Scoped duplication analysis reports
zero clone groups touching changed files. Scoped health has no new finding;
the existing main SpanOffsets.update finding remains owned by the consolidated
repair PR #2738. No threshold, suppression, baseline or safety limit changes.

The new hosted integration tests require all 1,005 source maps and independently
confirmed exits per runtime. That full replay is pending, not claimed from the
local smoke. Whole-engine composition/accounting, builtin difflib, placeholder and
emphasis discovery, HTML names, public codecs/services, complete safety/scaling
qualification and reflection/lifecycle closeout remain open. All representation
laws and fidelity questions remain unfinished; this receipt grants no waiver.

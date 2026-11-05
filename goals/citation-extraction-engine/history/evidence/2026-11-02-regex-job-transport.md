# Native regex job framing and composed preparation

`CitationRegexWorkerJob` now carries a closed, versioned evaluation request.
Both pattern and source retain their original one/two/four-byte native Unicode
carriers. Flags and remaining raw-match capacity are bounded schema data. No
projected text, callback, executable command or callable crosses this protocol.
The job is transport data, not reviewed-pattern authority; its receiving worker
must repeat canonical word/layout, policy and matching-semantic validation.

The exact complete-frame calculation encodes only the fixed metadata header
with empty carriers and adds both padded base64 lengths plus terminal LF.
This runs from validated layouts before native receiving payload, base64 or
whole-message allocation. Encoding repeats the count with actual owned bytes
and requires the emitted size to agree. Exact equality is allowed; the next
byte fails with `CitationSafetyLimitExceeded(extract, processMessageBytes)`.
Encoded pattern/source lengths and decoded native-byte ceilings are checked on
their respective sides of the base64 codec.

The receiving decoder rejects arrays, object nesting and excess properties
before JSON/base64 allocation. Its flat property ceiling is derived from the
job schema. Malformed UTF-8, unknown/missing versions, invalid fields, excessive
encoded byte counts and unknown properties become the source-free private
worker failure. It retains no pattern, source, raw frame or native cause.

`makeCitationRegexJobPreparation` joins both native preparers. Its nested
preflight obtains both layouts before either receiving payload/map is
allocated. The server hook then receives the full encoded byte count and may
reserve shared process/work capacity. The constructor captures policy and
Clock; its returned method has R = never and one extract/operation deadline
covering nested preflight, receiving preparation and encoding. Its result keeps
the job/frame and live source/pattern maps separate: map functions are never
serialized. Caller-owned storage stays immutable while borrowed, and resulting
receiving snapshots own their buffers.

Regex input preparation now has captured schema-literal `source`/`pattern`
roles. The pattern role enforces `patternUtf16`; the source role retains raw
source/intermediate limits. Their failures remain distinct even through nested
preparation. The role is selected by trusted server construction, never request
data. This adds no ambient configuration or policy ceiling.

The bounded LF reader is shared in `ByteFrames.ts`. The HTML API wraps it with
the same existing clean-operation failures; the regex API supplies extract
failures. Amortized buffer growth remains bounded before allocation. Complete
frames are copied before delivery, and extra, missing or partial frames fail.
One-byte fragmentation cannot create an unbounded retained chunk list.

## Focused verification

All twelve focused component suites pass 67 tests (14.39 seconds), including:

- All four HTML protocol tests, with every frozen string, exact byte limits and
  every split/single-byte fragmentation case, plus all ten HTML supervisors.
- Regex source/pattern carrier combinations with identical display projections
  but distinct native widths/bytes, preserving both through round-trip framing.
- Both base64 residues and full-envelope charges, exact ceilings, every frame
  split, one-byte fragments, partial/extra frames and oversized streams.
- Structural amplification, malformed UTF-8, unknown/missing versions, excess
  fields, invalid flags/base64 and excessive encoded pattern sizes.
- Nested layout-only preflight, independent pattern/source budget failures,
  retained source maps and captured whole-job timing under caller Clock change.
- Source-free stream-error mapping and all prior input/admission/cleaner tests.

Test typecheck, focused lint and native-runtime law checks pass separately.
No full native corpus qualification ran locally. Hosted proof remains
exact-head-specific and pending for these changes.

The actual regex child program, result/capture protocol and parent-owned
evaluation supervisor remain unimplemented. The matching encoding must preserve
literal-surrogate/astral distinctions; this transport preserves their carriers
but does not supply that encoding. Per-evaluation grants, counters, native
deadlines, confirmed cleanup and quarantine still require production integration
and proof. Every source-family semantic/routing/scaling obligation, extraction,
mapping/annotation, transforms, public engine composition and full goal closure
remain open. No oracle fixture/producer or semantic waiver changes, and no
source proof row is made terminal by this checkpoint.

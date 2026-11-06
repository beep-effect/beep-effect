# Complete native regex capture-result boundary

The private `RegexResult.ts` factory captures limits, Clock, prepared source
point count and expected capture-group count. It supplies complete-result
encoding/decoding and an accessor over owned decoded capture bytes. Group
names must eventually come from the reviewed pattern descriptor, not from an
untrusted child response. This boundary executes no regex and supplies no
verified document span.

The closed flat JSON envelope is `Complete`, version
`citation-regex-result/v1`, with group count, raw-match count and a base64
capture table. Every row contains the whole match followed by numbered groups.
Each cell has two little-endian unsigned 32-bit Python source-point offsets.
Two `0xffffffff` words denote a nonparticipating group; this is different from
a participating empty range. Group zero cannot be absent. Lookaround captures
may extend beyond the whole match but remain within the source.

Before base64/native payload allocation, decoding checks complete-frame bytes,
flat structure, closed fields, expected groups, effective raw-match budget,
exact computed payload/frame budget and encoded payload length. Encoding checks
counts and complete-frame size before base64/JSON output. Both sides require
exact native byte count and validate every cell with periodic Effect yields.
Whole matches must progress without overlap; an empty match followed by a
nonempty match at the same position is permitted, while duplicate empty whole
matches are rejected. These checks constrain accepted responses; they do not
prove that a child found all source matches.

Successful decoding owns its capture buffer. Mutating the supplied frame after
decode cannot change captures. Trusted encode/frame callers keep borrowed
buffers immutable during the call. Returned accessors reject out-of-range
indices without exposing source/pattern bytes. Total extract/operation timing
is captured at construction, including Clock identity, with total-operation
precedence on an equal deadline. The actual regex execution deadline and native
retirement remain the future supervisor's obligations.

Three focused suites pass 20 tests: result boundary (seven), request transport
(nine) and existing HTML framing (four). Controls cover source-point versus
UTF-16 ambiguity, unmatched/empty/lookaround captures, whole-match ordering,
invalid words and lengths, exact complete-frame ceilings, count-before-payload
failure, malformed/amplified/excess envelopes, buffer ownership and captured
Clock/deadline priority. Final test compiler and scoped laws/lint are recorded
with the implementation checkpoint. No oracle fixture or producer is changed.

Still open: unambiguous native matching encoding, actual regex execution child,
parent-owned admission/retirement, reviewed pattern group descriptors, regex
family semantics/safety/scaling, source-derived result replay and document
mapping through the canonical verified-span adapter. The divergence ledger's
unfinished proof rows and fidelity questions remain unfinished.

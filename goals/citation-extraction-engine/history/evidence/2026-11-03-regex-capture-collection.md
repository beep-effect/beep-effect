# Bounded incremental native capture collection

The owned regex child needs to collect native matches without first building an
unbounded list of match objects. `makeCitationRegexResult.collect` now pulls one
trusted indices row at a time and returns only a complete encoded result frame.
Its callback is captured server code, never a request field or execution grant.

For each observed match, remaining per-call capacity, schema-owned match limits
and exact complete-envelope size are checked before row decoding or native-table
growth. A zero remaining quota accepts a complete no-match result and rejects
the first observed match. The policy itself retains its existing positive
ceilings; zero is a remaining operation quota, not a policy change.

Native row arity is checked before decoding individual indices. A shared range
validator enforces source-point bounds, whole-match progress and empty versus
unmatched distinctions during collection and complete encode/decode. Native
storage grows geometrically within the process-message byte ceiling. Only used
words enter the final codec. No partial table is returned on a later bad row,
limit violation, pull failure or interruption.

Collection captures the existing Clock and stage/operation deadline behavior.
It cannot make a synchronous native call interruptible: the real process owner
must independently enforce regex lifetime, terminate the exact child and retain
the lease until retirement is confirmed. This slice grants no pattern-family
approval or parent-side regex execution authority.

The fixed isolated qualifier now streams each controlled program's actual
native match indices through collection and decoding before comparing all
groups/names to the frozen source observations. It also routes the native
surrogate/scalar capture cases through the same path. The expected 26 controlled
matches and original fixture hashes are unchanged. Full native execution is
hosted verification and has not run locally for this revision.

Verification:

- Twenty-nine tests across result/request/native input pass, including a
  schema-derived property over up to 64 participating-empty/unmatched histories.
- Exact frame ceiling and one-byte-short controls pass; the next over-budget
  match is rejected before malformed capture data can be decoded.
- Complete zero-match output with zero remaining quota passes. A nonempty
  observation at that quota fails, retaining count equality semantics.
- Malformed rows, overlap, out-of-source indices and later pull failure cannot
  publish a partial result. Captured Clock timing still applies to a stalled
  pull and gives the total deadline precedence on a tie.
- Server test compilation passes. Logs:
  `.beep/pr2511-regex-collector-types.log`,
  `.beep/pr2511-regex-collector-final-tests.log`.
- The byte-ceiling priority control rejects a malformed row for the complete
  frame limit before row decoding. Its focused rerun passes in
  `.beep/pr2511-regex-collector-priority-tests.log`.
- Scoped lint and package laws pass. Schema-first retains 293 tracked/live
  entries with zero missing/stale. The new-only Fallow audit passes with zero
  dead-code, complexity or clone findings after separating bounded row decoding
  and copying from collection; no suppression or threshold changed.

Actual regex worker/supervisor, reviewed descriptor admission, family semantics
and scaling, public composition and exhaustive parity remain open. No source
observation, safety threshold, semantic waiver or family approval changed.

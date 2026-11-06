# Exact native Unicode through literal cleaner composition

The four literal builtins now consume retained native Unicode through the value
owner and return native storage to `materializeUnicode`. The existing scanning
algorithm still chooses substrings and replacement spaces. An optional bounded
selection mask records those decisions in original UTF-16 coordinates; native
output is reconstructed from the original source points, never by decoding the
possibly ambiguous JavaScript result back into code points.

The source is validated and copied before scanning. Mask size is bounded by
validated input units. Native output width and length are determined before its
buffer allocation, after every output slice/replacement has reserved its units.
The builder preserves both adjacent surrogate source points and supplementary
scalars, and checks its output unit count against the projected result. Scans
and native passes yield cooperatively; the complete native stage uses the
captured minimum clean/operation deadline and returns R = never.

The new builtin path retains the existing original charge tickets. The real
pipeline ledger consumes them, verifies issued output handles and output size,
and closes on failure. A failed stage can retain reservations for a slice it
already built, but cannot publish a partial result handle. HTML input transport,
callback/hash protocols and complete source registry semantics are separate
unfinished integration duties. No normalization waiver was added.

Validation:

- Every one of the 1,068 non-HTML histories in the integrity-bound Unicode
  source corpus passes through builtin dispatch and the real reservation ledger.
- All 2,784 transitions and 3,852 observed values match native bytes/width,
  Python length, UTF-16 size, pinned source hash, and prior-reference identity.
- The fixture adapter supplies explicit native source snapshots and direct
  callable handles. It does not claim to prove the unfinished registry protocol.
- A separate raw-text request containing two surrogate points separated by
  underscores now retains two native source points after cleaning. Its Python
  hash remains 7910225535238332317; the projected scalar hashes differently at
  -3536540696076613844. Both results match the pinned source observations.
- Schema-derived cumulative budget/step cases and a fixed exhausted-budget
  control prove ledger closure, bounded reservations, and no next result handle
  after exhaustion. Empty plans retain the existing final-value charge rule.
- Four composition tests passed in 3.92 seconds with one worker. Seven existing
  literal/value tests also passed in the focused runs, including the original
  440 literal cases and 340 identity/subclass cases. No worker process was
  allowed to start in the new composition harness.
- Server source/test type checking, focused Oxlint and native-runtime checks
  passed. Catalog and identity profile updates use canonical writers.

The full 2,016-history source corpus includes HTML compositions that remain
outside this target slice. Full target parity, public service integration and
hosted quality acceptance remain open.

# Native regex input preparation and unverified projection maps

`makeCitationRegexInput` now prepares exact native Unicode transport from
already-owned intermediate values and canonical raw strings. It captures
validated policy and Clock and returns methods with R = never. It does not
evaluate patterns or choose an unproven matching encoding.

Native width and byte content are preserved. The preparer measures source
point count, projected UTF-16 units, canonical width, exact byte length,
private point-map allocation and projection ambiguity before receiving
allocation. A trusted server transport preflight receives that layout before
native-copy, display-projection or offset-map allocation. That callback is an
injected capability, never request data. As with the HTML adapter, the source
storage must remain immutable while borrowed through preparation. The completed
receiving snapshot owns its bytes independently of the original caller buffer.

Raw source uses `sourceUtf16`; intermediate storage/projections use
`producedTextUtf16`. Native payload size is checked against
`processMessageBytes`; the later transport callback must still check the
complete encoded frame. The private point map is a fixed four-byte entry per
source boundary, including EOF, bounded by the schema-owned text ceiling.
Invalid words, noncanonical widths and partial native words fail without
calling transport preflight. Size exhaustion produces the corresponding
`CitationSafetyLimitExceeded(extract, ...)`, without partial prepared output.

The entire preparation, including preflight and map construction, is bounded by
the shorter extract/operation deadline under the captured Clock. A shorter
total deadline takes precedence. The shared Unicode adapter is parameterized
with this extract-stage timing; an unrelated clean deadline cannot shorten it.
The caller's Clock or later policy mutation cannot change the captured timing
and counts. No native process is started by this preparer.

The private projection closure retains the original source-point map. Results
are one of:

- `Range`: a nonempty unverified UTF-16 display range.
- `Point`: an empty source match retained as data.
- `Split`: at least one source boundary falls inside a projected surrogate pair.

The layout's own codec checks native/map size arithmetic and possible canonical
width/point counts. The projection codecs enforce nonempty forward ranges and
forward split projections; malformed data cannot acquire those descriptions.
None is a verified mention, quote locator or source-identity receipt. Valid
display offsets must still pass document mapping and the canonical public span
adapter. The implementation does not weaken the prerequisite's nonempty and
UTF-16-boundary contracts. Its tests confirm agreement with the public adapter
for an ordinary astral range and `invalid-offset` rejection for a split range.

## Source observations and focused proof

`probe-regex-input.py` runs against the clean pinned eyecite checkout under
CPython 3.11.15, little-endian 64-bit layout and hash seed zero. It checks the
native ABI and reads actual compact Unicode width/content. The source product
contains every length-zero-through-three combination of ASCII, Latin-1,
non-Latin-1 BMP, high surrogate, low surrogate and an astral digit. It records
native bytes, source lengths, every boundary prefix, projected boundaries and
the canonical raw-string reinterpretation. No target preparer is used by the
producer. Header, producer, license and lock hashes are retained.

The authenticated `regex-input.json` fixture has SHA-256
`dab2793dc0edefee741b317a2558da9c01d58021a53bcb29b4e18b87d34bf51d`.
The replay passes all 259 source layouts, 2,395 source projections, 13 ambiguous
layouts and every canonical raw-string interpretation. It confirms independent
receiving storage and exact layout/map sizes.

Eight input tests also cover malformed layouts, invalid offsets, exact policy
equality, budget failure before preflight, explicit transport rejection,
receiving snapshot ownership, captured policy/Clock, deadline precedence and
codec coherence. All ten focused component suites pass 54 tests (6.74 seconds). Test typecheck,
focused lint and the native-runtime law check pass separately. These checks do
not substitute for native regex execution or complete-frame qualification.

The owned regex worker/protocol remains unimplemented. Its matching encoding
must distinguish literal surrogate points from a supplementary scalar, retain
this native carrier through transport, and return exact source-point positions.
This preparer preserves the information and classifies projection boundaries;
it does not close the matching-encoding obligation. Full native qualification,
iteration/routing, every family’s semantic/safety/scaling proof, extraction,
mapping/annotation, transforms, public Layer composition and full goal closure
remain open. No source proof row is terminalized and no semantic waiver is added.

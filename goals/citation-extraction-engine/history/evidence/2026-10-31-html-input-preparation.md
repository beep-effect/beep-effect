# Bounded HTML Unicode input preparation

Date: 2026-10-31. Scope: private input preparation, before native parsing.

The private makeCitationHtmlInput factory captures the effective limits and
Clock. Its prepare method returns R = never and performs no native regex or
HTML parsing. This implements the input-side lxml 5.1.0 behavior that the
isolated native prototype required; it does not incorporate that prototype.

## Source behavior and adaptation

The frozen lxml parser.pxi selects UTF-8 for ASCII Python strings, ISO-8859-1
for Latin-1 strings, UTF-16LE for BMP strings and UTF-32LE for strings containing
astral code points on the pinned little-endian CPython runtime. The target
emits those exact bytes, without a BOM or implicit terminal padding. Lone
surrogates survive as buffer units, including in UTF-32 input containing astral
text. Ordinary UTF-8 conversion would lose this behavior.

The source full-document recognizer uses Python whitespace, including U+0085
and U+001C, and excludes U+FEFF. A prefix such as htmlx still matches its html
alternative. The target uses the existing frozen Python whitespace facts.

The source encoding-declaration detector has observable details: either quote
can close a value, a value may contain a greater-than sign, and the nonempty
prefix before separating whitespace means a declaration beginning with only
one space after xml can be accepted while two spaces reject. Cooperative
linear scans preserve these decisions without executing the source regex.
The source probe extracts the expression from the pinned apihelpers.pxi and
checks each expected rejection against actual lxml.html.fromstring execution.

The root THIRD_PARTY_NOTICES.md now retains the BSD 3-Clause lxml notice and
attributes the wrapper behavior to Ian Bicking and the other adapted material
to Infrae. The source report binds both distribution notice files. This change
incorporates no libxml2 binary, native C kernel or Python runtime.

## Evidence and safety

The source report contains 1,075 decisions and 1,071 immutable strings. They
cover the original 69 HTML audit inputs, encoding and wrapper combinations,
all 29 Python whitespace characters, nearby non-whitespace controls, lone
surrogates, mixed astral/surrogate input and declaration scans crossing 4,096
and 8,192 units. Exhaustive single-code-point classification records 1,114,112
Unicode values. Source notice, wrapper, parser and helper hashes are retained.

Focused target replay matches all 837 prepared byte digests, byte lengths,
encoding selections and wrapper decisions, and all 238 declaration rejections.
A full-file digest authenticates the exact test corpus. Twelve corruption
controls reject missing/duplicate cases, altered strings, source identity,
whitespace, buffer evidence, lengths, wrapper flags, byte order, licensing and
fabricated backend qualification. Fresh oracle replay reproduces the report.

The target checks the effective source ceiling and payload byte ceiling before
allocating its result buffer. Every unbounded scan yields after bounded work,
with a captured clean deadline. Tests cover exact count boundaries, failures
without partial results, independent buffer ownership, captured clock behavior
and interruption of a long declaration scan. Neither text nor byte buffers are
attached to expected failures.

## Remaining obligations

The complete worker frame must charge its additional bytes. The enclosing
clean operation must share its remaining deadline across preparation and native
execution. Native allocation, terminal padding, parser options, memory/resource
signals, body/head wrapper mutation, exact error translation, owned worker
lifecycle and interruption cleanup remain open. The production native parser,
HTML source maps and default Layer are not implemented by this phase.

All canonical completion rows remain unfinished. This input proof is not a
normalization law, semantic waiver, exhaustive HTML proof or overall parity
verdict. The separately approved native-resource failure exception remains
unchanged.

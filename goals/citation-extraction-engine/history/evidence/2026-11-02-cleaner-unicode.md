# Exact source Unicode across cleaner composition

Status: source evidence only. Target Unicode ownership remains open.

## Capture and provenance

The pinned eyecite commit/tree, clean.py and BSD license, CPython 3.11.15,
seed-zero hashing, lxml 5.1.0 and libxml 2.12.3 are checked before capture.
The producer also checks the installed CPython Unicode layout header and
reads only retained, live interpreter-owned compact strings. Every captured
native byte sequence and storage width is compared with actual Python storage.
No pointer/address is retained or published. The layout adaptation is covered
by the complete CPython PSF notice in THIRD_PARTY_NOTICES.md.

The report retains 2,016 full histories and 6,412 value snapshots:

- 1,872 compositions: twelve inputs and every sequence of the five named
  cleaners of length zero through three, including the empty sequence.
- 144 storage-width scenes: four prefixes, four bodies, three suffixes and
  three cleaner orders, observed through real clean_text callbacks.
- 482 source ParserError outcomes, with all values observed before failure.
- 1,208 snapshots whose exact source code points cannot round-trip through a
  JavaScript string projection.

Each value retains full code points, canonical width, actual native byte hex,
Python length, UTF-16 size and seed-zero hash. Each callback snapshot records
all equal-identity prior snapshots while the actual references remain alive;
this avoids mistaking allocator address reuse for identity. No source value
is replaced with a digest or a normalized JavaScript string.

Each complete history occupies one JSON line, retaining every value while
avoiding a large repetitive formatting diff. Parsed evidence is unchanged.

The complete raw report SHA-256 is
`0c314524ff16f1a8689b8aaf50d235a5c2439187f1e168c84b84d700160aead0`.
The runtime header SHA-256 is
`9183d40b4aec778c4f59d2091b4374722f635116a33ae6fc66c16e0b5fa700b5`.

## Observed ownership gap

An ordinary JavaScript-representable input containing U+D83D, two underscores
and U+DE00 becomes two adjacent source surrogate code points after underscores.
Python still reports length two and hash 7910225535238332317. A JavaScript
projection merges that representation into U+1F600, whose Python length is one
and hash is -3536540696076613844. The current string-only cleaner owner loses
that distinction on concatenation.

HTML behavior also depends on source storage width. On the two-byte result,
HTML combines those surrogate code points into U+1F600. With a U+1F600 prefix,
the same remaining pair occupies four-byte Python storage; HTML returns only
the prefix. Sending a normalized projection to the native parser would change
that result. Full source code points and width must therefore survive literal
stages, value issuance, hashing, callbacks and native HTML preparation.

This is outstanding implementation work, not an approved normalization or a
completed target parity row. The only approved parser divergence remains the
explicit resource-exhaustion failure recorded separately.

## Portable checks and publication

The Bun source checker seals the complete report and producer, verifies pinned
provenance, counts and retained identity/value relationships, and is the twelfth
component of citation:parity-check. Audit success remains source accounting;
it does not establish target parity or engine completion.

The Python verifier additionally checks every native word/width, UTF-16 size,
code-point projection and identity relation, exact sequence coverage and the
complete canonical seal. Twenty corruption controls reject missing/duplicate
rows, altered storage, identity, provenance and fabricated normalization. An
optional fresh oracle replay must reproduce the report byte-for-byte.

The initial source capture, portable checker, twenty corruption controls and
byte-identical fresh replay passed. Full engine and repository verification
remain hosted requirements. This source-evidence wave is published into the
existing draft PR before the implementation fix, following operator direction
to keep ready work visible without waiting on full local proof.

## First hosted repair wave

The initial draft's hosted jobs exposed an Effect 4.1.1 map/mapError diagnostic,
three evidence-script type errors, a moved domain test fixture import, a stale
identity profile/catalog, seven documentation-shape regressions and unresolved
private test imports. This wave uses mapBoth, typed source-reference handling,
the current public test fixture, generated profile/catalog outputs and canonical
Details sections. All 148 same-package citation test imports now name real
private source files; the virtual alias is removed without publishing internal
modules. The public test case type is consumed by a dedicated source-structure
validator, and the canonical safety-budget type names the real HTML limit input.

The evidence scripts pass their focused type check. The canonical documentation
scorer reports no remaining multiple-description paragraphs in changed public
citation source. These results do not establish full repository green: hosted
schema/policy, complexity and remaining integration findings are still open.
No baseline is raised and no diagnostic suppression is introduced by this wave.

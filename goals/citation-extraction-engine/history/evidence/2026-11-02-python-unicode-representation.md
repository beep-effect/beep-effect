# Lossless Python Unicode representation preparation

The exact cleaner composition corpus exposes 1,208 source snapshots whose
JavaScript string projection cannot reconstruct their native Python code
points. A pair of surrogate code points and one supplementary scalar may have
the same JavaScript text while differing in Python length, native width, hash,
and later HTML behavior. Treating projection as source state loses parity.

The private `PythonUnicode.ts` adapter now prepares an explicit
`CitationPythonUnicodeValue`: canonical native storage, JavaScript projection,
Python code-point length, and UTF-16 unit count. It validates word alignment,
code-point range, minimal canonical one/two/four-byte width, empty layout, and
both absolute and captured intermediate ceilings. Input storage is copied
before the first scan yield. JavaScript input is decoded as JavaScript Unicode;
that direction deliberately cannot reconstruct an ambiguous source history.

Scans yield every 4,096 source points and use a captured Clock and a copied
minimum operation/clean deadline. The adapter also captures its numeric ceiling
rather than reading a mutable caller policy later. Projection accumulates
bounded chunks, preserving lone surrogate code points instead of decoding them
to replacement characters. Every returned service method has R = never.
Failures contain only a closed reason, never source data or partial output.

This is representation data, not an issued capability. Receiving adapters must
keep their bytes immutable and retain produced-text reservation obligations.
Cleaner value ownership, literal composition, callbacks and storage-sensitive
HTML transport are still unwired to this representation. This wave does not
close those integration duties, the registry protocols, or target parity.

Validation:

- The integrity-bound source fixture retains SHA-256
  `0c314524ff16f1a8689b8aaf50d235a5c2439187f1e168c84b84d700160aead0`.
- All 6,412 snapshots from all 2,016 source histories preserve native bytes,
  width, Python length, UTF-16 size, and independently computed source hash.
- All 1,208 non-round-tripping snapshots remain distinct after projection back
  to native storage; the other snapshots round-trip exactly.
- Fifty schema-derived JavaScript strings round-trip through native storage.
- Fixed controls distinguish a surrogate pair from a scalar, verify buffer
  snapshotting and captured numeric limits, and reject malformed layouts.
- Captured deadline/Clock and interruption of both scans are tested without
  publishing partial data.
- Five focused tests passed in 3.17 seconds with one worker. No native parser
  process or full package test suite ran locally.
- The server source-and-test type check, focused native-runtime check, Biome,
  and focused Oxlint passed during this wave. Catalog/profile updates use
  canonical writers; full hosted quality and acceptance remain separate.

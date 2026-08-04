# P0 Hostile-Text Contract

Date: 2026-07-29
Verdict: PASS

## Executable Fixture

The pre-contract spike lives at
`packages/foundation/capability/langextract/test/VerifiedSpanSpike.test.ts`.
It ran before any public `SourceTextIdentity`, verified-anchor, normalization,
or raw-offset API was added.

```sh
cd packages/foundation/capability/langextract
bunx --bun vitest run test/VerifiedSpanSpike.test.ts
```

Final result:

```text
Test Files  1 passed (1)
Tests       9 passed (9)
```

The first run intentionally remained evidence-bearing: 8/9 passed and the
ligature fixture exposed an incorrect expected end offset. `ﬁ` is one UTF-16
code unit even though NFKC expands it to two locator characters, so the raw
half-open range for `ofﬁce` is `[4, 9)`, not `[4, 10)`. Correcting that fixture
made all nine tests pass without weakening the raw-slice invariant.

## Locked Conversion Contract

1. Canonical offsets are half-open UTF-16 code-unit offsets. Foreign
   code-point ranges convert explicitly; malformed or reversed ranges fail as
   `invalid-offset`.
2. Locator normalization is NFKC compatibility normalization plus
   typographic-quote folding and whitespace-run collapse. It never case-folds
   and never fuzzy-matches.
3. Normalization tracks every normalized UTF-16 code unit back to the raw
   cluster start/end. A successful match emits only
   `source.slice(startChar, endChar)`, including decomposed marks, ligatures,
   typographic quotes, and original whitespace.
4. A normalized match is admitted only when normalizing its recovered raw
   slice reproduces the normalized locator. This rejects partial matches
   inside compatibility expansions.
5. All distinct raw occurrences are enumerated. Zero occurrences fail
   `not-found`; more than one fails `ambiguous`; first-match wins is forbidden.
6. Chunks carry explicit global UTF-16 starts and include separators as raw
   data. Reconstruction requires contiguous starts, inserts nothing, and fails
   `malformed-source` for every gap or overlap.
7. Digest or extractor-version mismatch fails `stale-source`. The prior anchor
   is retained unchanged; a later re-anchor must create a new anchor only
   after repeating exact raw-slice proof against the new identity.

## Fixture Coverage

| Required case | Locked result |
| --- | --- |
| Surrogate pair | Code-point range `[1, 2)` converts to UTF-16 `[1, 3)` |
| Combining mark | Composed `Café` locates raw decomposed `Café` |
| Ligature | Locator `office` emits raw `ofﬁce` at `[4, 9)` |
| Curly quotes | Straight locator emits raw curly quotes; lowercase variant fails |
| Collapsed whitespace | One locator space emits the full tab/space/newline run |
| Duplicate occurrences | Fails `ambiguous` |
| Page boundary | Explicit form-feed is preserved once in a global straddle |
| Malformed reconstruction | Offset gap fails `malformed-source` |
| Source drift | Digest or extractor-version mismatch fails `stale-source` |

## P1 Boundary

P1 may now freeze the smallest public contracts that implement this behavior:
pure source identity and verified anchors in provenance, plus bounded
normalization/raw mapping and explicit chunk/offset adapters in langextract.
Filesystem access, extraction, and digest computation remain in the
coordinated file-processing resolver/provider lane.

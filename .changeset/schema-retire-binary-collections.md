---
"@beep/schema": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-tables": patch
"@beep/nlp": patch
"@beep/workspace-domain": patch
---

Retire the binary and collection schemas under the "Upstream-First Foundation/Modeling"
decision (`standards/architecture/DECISIONS.md`, 2026-09-29): `ArrayBuffer`, `Bytes`,
`ArrayOf`, `HashSet`, `MutableHashMap`, `MutableHashSet`, `Graph`, and `RegExp` are deleted
with their barrel and subpath exports, and no alias is left behind. Every consumer migrates in
the same change, using the compositions in the goal's boundary table:

- `HashSet` fields persisted as jsonb in `@beep/law-practice-domain` become
  `Item.pipe(S.HashSet, S.toCodecJson)`, keeping each field's existing `.check(...)`. The
  stored JSON arrays are byte-identical, and the columns derived by `toPgTable` are unchanged.
- `ArrayOf` presets become `S.Array(S.String)` and `S.Array(S.NonEmptyString)`.
- The `FileContent` ArrayBuffer member in `@beep/schema` is `S.instanceOf(ArrayBuffer)` linked
  to `S.Uint8ArrayFromBase64` for JSON, so its base64 bytes are unchanged. It keeps the
  detached-buffer rejection (same message) and byte equivalence, so `FileContent` decodes,
  compares, and encodes as before.
- `ParserOptions` decodes its token pattern through `S.String` to `S.RegExp`, keeping the
  plain-string wire.
- The `@beep/nlp` term-count carrier is an `S.declare` over `MutableHashMap.isMutableHashMap`,
  linked to an entry array.
- `Bytes`, `MutableHashSet`, and the `Graph` family have no production consumer outside
  `scratchpad/`, which moves to `S.Graph` and `S.Natural`.

Type-check cost, tsgo 7.0.2, fresh build-info, before → after. The gate is the
`--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 672,414 | 202,571 → 191,126 | 1.005 → 0.929 s |
| `@beep/repo-cli` | 4,126,448 → 4,126,448 | 1,059,620 → 1,059,620 | 10.107 → 11.258 s |
| `@beep/law-practice-domain` | 874,541 → 874,498 | 259,729 → 259,793 | 1.131 → 1.168 s |

Check time is advisory within a 5% band. Flagged: `@beep/repo-cli` single-threaded check time
read 10.180 to 12.388 s across five after-runs (+0.7% to +22.6%) with identical instantiations
and types every time, on a shared workstation at load average 13 to 17.

The default four-checker run is advisory:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,083,005 | 367,663 → 359,514 | 0.501 → 0.438 s |
| `@beep/repo-cli` | 8,433,860 → 8,433,909 | 2,153,175 → 2,153,227 | 4.577 → 4.851 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,290,711 | 376,265 → 376,524 | 0.716 → 0.719 s |

---
"@beep/schema": minor
---

Retire the time and duration concepts under the "Upstream-First Foundation/Modeling"
decision (`standards/architecture/DECISIONS.md`, 2026-09-29): `Timestamp`,
`DateTimeUtcFromValid`, `Duration`, and `Timezone` are deleted with their barrel and subpath
exports, and no alias is left behind. Every consumer migrates in the same change:

- `ISOStr` fields keep their string wire through a consumer-local
  `S.Trim.check(S.isNonEmpty(...), S.makeFilter(DateTime.make parses, ...))` composition
  that carries the same empty-string message and arbitrary pattern, so stored receipts and
  residue manifests decode and re-encode byte for byte. `S.DateTimeUtcFromString` is not used
  there because it rewrites `...56Z` as `...56.000Z`.
- The `DateTimeUtcFromValid` picker adapters move into the MUI date adapter over
  `DateTime.make`, `DateTime.toUtc`, and `DateTime.setZone`.
- The Graft step timeout keeps its `${number} ${unit}` string through `S.TemplateLiteral`
  over `S.Literals` of the `Duration.Unit` names; the observability Node SDK options take
  `S.Duration` values.
- `Timezone` had no consumer; `S.TimeZoneNamedFromString` covers named zones.

Type-check cost, tsgo 7.0.2, fresh build-info, before → after. The gate is the
`--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 676,193 | 202,571 → 193,058 | 0.951 → 1.078 s |
| `@beep/repo-cli` | 4,126,448 → 4,126,142 | 1,059,620 → 1,059,549 | 10.168 → 10.682 s |
| `@beep/law-practice-domain` | 874,541 → 874,541 | 259,729 → 259,729 | 1.096 → 1.327 s |

Check time is advisory within a 5% band. Flagged: single-threaded check time rose on all three
packages (`@beep/schema` +13%, `@beep/repo-cli` +5.1%, `@beep/law-practice-domain` +21%)
while instantiations fell or held and `@beep/law-practice-domain` is untouched. The station
load average rose from about 12 at the before runs to 16-18 at the after runs; two repeat
after runs read 1.011-1.190 s, 10.607-10.795 s, and 1.150-1.282 s.

The default four-checker run is advisory; its totals depend on how files split across
checkers:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,078,092 | 367,663 → 357,402 | 0.530 → 0.549 s |
| `@beep/repo-cli` | 8,433,860 → 8,465,574 | 2,153,175 → 2,157,694 | 4.581 → 4.560 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,290,676 | 376,265 → 376,265 | 0.703 → 0.764 s |

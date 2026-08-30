# Pack semver — round 1 fix report

JSDoc-only upgrades under `scratchpad/semver/`. Runtime behavior was not
changed. `$I.annote` / `$I.annoteSchema` were not added (inventory rejected:
this kit-port has no beep identity composer).

## Changed files

- `scratchpad/semver/index.ts`
- `scratchpad/semver/Comparator.ts`
- `scratchpad/semver/Range.ts`
- `scratchpad/semver/SemVer.ts`
- `scratchpad/semver/VersionCache.ts`
- `scratchpad/semver/VersionDiff.ts`
- `scratchpad/semver/internal/desugar.ts`
- `scratchpad/semver/internal/grammar.ts`
- `scratchpad/semver/internal/normalize.ts`
- `scratchpad/semver/internal/order.ts`

## Items closed

All 24 accepted findings:

| ID | Status | What landed |
| --- | --- | --- |
| semver-R1-001 | closed | Comparator module header; `InvalidComparatorError` `@category errors` + titled Example (`^1.2.3` → `_tag`); `Comparator` titled Example + `@category schemas` |
| semver-R1-002 | closed | Range module header; both error classes + `ComparatorSet` tags; `Range` titled Example |
| semver-R1-003 | closed | SemVer module header; `InvalidVersionError` / `SemVer` / `SemVerBump` tags + titled Examples |
| semver-R1-004 | closed | VersionCache module header; three errors + shape + service tags/Examples |
| semver-R1-005 | closed | VersionDiff module header; titled Example keeps `[type, major]` |
| semver-R1-006 | closed | Barrel Example converted; `@since 0.0.0`; described `@see` |
| semver-R1-007 | closed | desugar module header; `PartialParts` type-level; four functions `@category normalization` with titled Examples |
| semver-R1-008 | closed | grammar module header; parsers `@category parsing`, formatters `@category formatting` |
| semver-R1-009 | closed | normalize module header; `normalizeSets` Example shows build collapse + operator-weight sort |
| semver-R1-010 | closed | order module JSDoc above `VersionParts`; types type-level; compare fns `@category combinators` |
| semver-R1-011 | closed | Gotchas + Example on `InvalidVersionError` / `SemVer` / `parseVersion`: no `v`/`V`/`=`/leading zeros/partial/`coerce` |
| semver-R1-012 | closed | Gotchas: parse trims, `isValid` / Exact / Pinnable reject padding; `parseResult` Example shows both |
| semver-R1-013 | closed | Every `@see` has a purpose phrase; barrel Effect `@see` described |
| semver-R1-014 | closed | Public Examples import `@beep/scratchpad/semver`, never `@effected/semver` |
| semver-R1-015 | closed | Member `@remarks`/`@example` moved to Details/Gotchas/titled Example on touch |
| semver-R1-016 | closed | Range class Gotchas: dual `(version, range)`, prerelease restriction, conservative `isSubset`, empty-string match-all |
| semver-R1-017 | closed | Described `@see` between Comparator↔Range, parse surfaces, `Order`↔`OrderWithBuild`, tagged errors↔`FromString` |
| semver-R1-018 | closed | VersionCache Gotchas: build twins share a slot; `next`/`prev` `none` only at an existing edge |
| semver-R1-019 | closed | VersionDiff Gotchas: `"build"` vs `SemVer.equal`; `@see` OrderWithBuild / equal |
| semver-R1-020 | closed | SemVerBump Gotchas + Example: `1.0.0` + `prerelease("rc")` → `1.0.1-rc.0`; build stripped |
| semver-R1-021 | closed | grammar Gotchas: trim, empty range, `~>`, no version coerce, implicit `=` |
| semver-R1-022 | closed | caret 0.x, X-range operator rewrite, hyphen partial upper; sibling `@see` |
| semver-R1-023 | closed | `normalizeSets` Details/Gotchas: per-set sort; build-ignored dedup keys |
| semver-R1-024 | closed | `compareParts` `@see` `SemVer.Order`; `compareBuild` `@see` `SemVer.OrderWithBuild`; numeric-vs-alpha Example |

## Residual risk

- Internal pipeline Examples (`desugar*`, `parse*`, `format*`, `normalizeSets`,
  `compare*`) import `../../semver/internal/*.ts` relative to
  `scratchpad/.jsdoc-loop/generated-docs/examples/`. Those symbols are not on
  the `@beep/scratchpad/semver` barrel. Public class Examples use the mapped
  alias as required.
- `$I.annote` was not added (runtime schema change; inventory rejected).
- Barrel fileoverview still attaches to the first `export { ... } from` via
  TypeScript; it is titled Example now, so census `legacy-carrier` on that
  re-export should stay quiet. Re-exports were not documented as new symbols.

## Commands run

- Mechanical census rules from `scratchpad/.jsdoc-loop/census.ts` re-checked
  against the ten owned files:
  - no `@example` / `@remarks` / `@module` / `@template`
  - no `@see {@link ...}` lines without a purpose phrase
  - no `@returns -` / type-brace tags
  - 10/10 modules have a useful lead, `@packageDocumentation`, `@since 0.0.0`
  - 34/34 owning exports have `@category` + `@since 0.0.0`
  - 27/27 value-level owning exports have `**Example** (`
- `bun scratchpad/.jsdoc-loop/census.ts` is the acceptance command; re-run it
  to refresh `census-summary.json` pack counters (`semver` open modules and
  open owning exports should both be 0).

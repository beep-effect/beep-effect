# Pack semver

- modules: 10
- owning exports: 34
- re-exports: 5
- open modules: 9
- open owning exports: 34

## Files

- `semver/Comparator.ts` owning=2 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `semver/Range.ts` owning=4 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `semver/SemVer.ts` owning=3 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `semver/VersionCache.ts` owning=5 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `semver/VersionDiff.ts` owning=1 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `semver/index.ts` owning=0 moduleFindings=none
- `semver/internal/desugar.ts` owning=5 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `semver/internal/grammar.ts` owning=7 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `semver/internal/normalize.ts` owning=1 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `semver/internal/order.ts` owning=6 moduleFindings=missing-packageDocumentation|missing-module-since

## Open modules

- `semver/Comparator.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `semver/Range.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `semver/SemVer.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `semver/VersionCache.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `semver/VersionDiff.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `semver/internal/desugar.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `semver/internal/grammar.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `semver/internal/normalize.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `semver/internal/order.ts`: missing-packageDocumentation, missing-module-since

## Open owning exports

- `semver/Comparator.ts:14` `InvalidComparatorError` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `semver/Comparator.ts:49` `Comparator` (value/class) missing=@category|@since findings=legacy-example|missing-required-tags
- `semver/Range.ts:17` `InvalidRangeError` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `semver/Range.ts:35` `ComparatorSet` (type/type) missing=@category|@since findings=missing-required-tags
- `semver/Range.ts:60` `Range` (value/class) missing=@category|@since findings=legacy-example|missing-required-tags
- `semver/Range.ts:382` `UnsatisfiableConstraintError` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `semver/SemVer.ts:27` `InvalidVersionError` (value/class) missing=@category|@since|@example findings=undescribed-see|missing-required-tags
- `semver/SemVer.ts:85` `SemVer` (value/class) missing=@category|@since findings=legacy-example|undescribed-see|missing-required-tags
- `semver/SemVer.ts:587` `SemVerBump` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `semver/VersionCache.ts:13` `EmptyCacheError` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `semver/VersionCache.ts:25` `VersionNotFoundError` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `semver/VersionCache.ts:41` `UnsatisfiedRangeError` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `semver/VersionCache.ts:65` `VersionCacheShape` (type/interface) missing=@category|@since findings=missing-required-tags
- `semver/VersionCache.ts:143` `VersionCache` (value/class) missing=@category|@since findings=legacy-example|missing-required-tags
- `semver/VersionDiff.ts:44` `VersionDiff` (value/class) missing=@category|@since findings=legacy-example|missing-required-tags
- `semver/internal/desugar.ts:13` `PartialParts` (type/interface) missing=@category|@since findings=missing-required-tags
- `semver/internal/desugar.ts:36` `desugarTilde` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/desugar.ts:57` `desugarCaret` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/desugar.ts:102` `desugarXRange` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/desugar.ts:169` `desugarHyphen` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/grammar.ts:20` `ParseResult` (type/type) missing=@category|@since findings=missing-required-tags
- `semver/internal/grammar.ts:240` `parseVersion` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/grammar.ts:444` `parseRange` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/grammar.ts:539` `parseComparator` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/grammar.ts:562` `formatVersion` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/grammar.ts:574` `formatComparator` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/grammar.ts:580` `formatRange` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/normalize.ts:50` `normalizeSets` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/order.ts:10` `VersionParts` (type/interface) missing=@category|@since findings=missing-required-tags
- `semver/internal/order.ts:19` `ComparatorOperator` (type/type) missing=@category|@since findings=missing-required-tags
- `semver/internal/order.ts:22` `ComparatorParts` (type/interface) missing=@category|@since findings=missing-required-tags
- `semver/internal/order.ts:32` `comparePrereleaseIdentifier` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/order.ts:43` `compareParts` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `semver/internal/order.ts:70` `compareBuild` (value/const) missing=@category|@since|@example findings=missing-required-tags


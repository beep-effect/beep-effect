# Pack glob

- modules: 13
- owning exports: 34
- re-exports: 5
- open modules: 12
- open owning exports: 34

## Files

- `glob/GlobPattern.ts` owning=3 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `glob/GlobSet.ts` owning=1 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `glob/index.ts` owning=0 moduleFindings=none
- `glob/internal/assertValidPattern.ts` owning=1 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `glob/internal/ast.ts` owning=2 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `glob/internal/balancedMatch.ts` owning=3 moduleFindings=missing-packageDocumentation|missing-module-since
- `glob/internal/braceExpansion.ts` owning=2 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `glob/internal/braceExpressions.ts` owning=2 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `glob/internal/escape.ts` owning=1 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `glob/internal/limits.ts` owning=9 moduleFindings=missing-packageDocumentation|missing-module-since
- `glob/internal/minimatch.ts` owning=3 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since
- `glob/internal/types.ts` owning=6 moduleFindings=missing-packageDocumentation|missing-module-since
- `glob/internal/unescape.ts` owning=1 moduleFindings=missing-module-summary|missing-packageDocumentation|missing-module-since

## Open modules

- `glob/GlobPattern.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `glob/GlobSet.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `glob/internal/assertValidPattern.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `glob/internal/ast.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `glob/internal/balancedMatch.ts`: missing-packageDocumentation, missing-module-since
- `glob/internal/braceExpansion.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `glob/internal/braceExpressions.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `glob/internal/escape.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `glob/internal/limits.ts`: missing-packageDocumentation, missing-module-since
- `glob/internal/minimatch.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since
- `glob/internal/types.ts`: missing-packageDocumentation, missing-module-since
- `glob/internal/unescape.ts`: missing-module-summary, missing-packageDocumentation, missing-module-since

## Open owning exports

- `glob/GlobPattern.ts:24` `GlobPatternError` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `glob/GlobPattern.ts:50` `GlobPatternOptions` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `glob/GlobPattern.ts:144` `GlobPattern` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `glob/GlobSet.ts:58` `GlobSet` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/assertValidPattern.ts:12` `assertValidPattern` (value/const) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `glob/internal/ast.ts:69` `ExtglobType` (type/type) missing=@category|@since findings=missing-summary|missing-required-tags
- `glob/internal/ast.ts:180` `AST` (value/class) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `glob/internal/balancedMatch.ts:27` `BalancedResult` (type/interface) missing=@category|@since findings=missing-required-tags
- `glob/internal/balancedMatch.ts:44` `balanced` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/balancedMatch.ts:62` `range` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/braceExpansion.ts:108` `BraceExpansionOptions` (type/interface) missing=@category|@since findings=missing-summary|missing-required-tags
- `glob/internal/braceExpansion.ts:119` `expand` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/braceExpressions.ts:38` `ParseClassResult` (type/type) missing=@category|@since findings=missing-summary|missing-required-tags
- `glob/internal/braceExpressions.ts:46` `parseClass` (value/const) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `glob/internal/escape.ts:39` `escape` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `glob/internal/limits.ts:5` `MAX_PATTERN_LENGTH` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/limits.ts:8` `EXPANSION_MAX` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/limits.ts:11` `MAX_GLOBSTAR_RECURSION` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/limits.ts:14` `MAX_EXTGLOB_RECURSION` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/limits.ts:17` `MAX_NESTING_DEPTH` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/limits.ts:20` `GuardReason` (type/type) missing=@category|@since findings=missing-required-tags
- `glob/internal/limits.ts:28` `GuardExceeded` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/limits.ts:39` `isGuardExceeded` (value/const) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `glob/internal/limits.ts:46` `assertCap` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/minimatch.ts:39` `GLOBSTAR` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `glob/internal/minimatch.ts:117` `braceExpand` (value/const) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `glob/internal/minimatch.ts:135` `Minimatch` (value/class) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `glob/internal/types.ts:13` `Platform` (type/type) missing=@category|@since findings=missing-required-tags
- `glob/internal/types.ts:33` `EngineOptions` (type/interface) missing=@category|@since findings=missing-required-tags
- `glob/internal/types.ts:88` `MMRegExp` (type/type) missing=@category|@since findings=missing-required-tags
- `glob/internal/types.ts:94` `GLOBSTAR` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `glob/internal/types.ts:96` `ParseReturnFiltered` (type/type) missing=@category|@since findings=missing-summary|missing-required-tags
- `glob/internal/types.ts:97` `ParseReturn` (type/type) missing=@category|@since findings=missing-summary|missing-required-tags
- `glob/internal/unescape.ts:45` `unescape` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags


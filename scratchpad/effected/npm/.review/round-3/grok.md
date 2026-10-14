I'll review the npm port at that commit against the upstream oracle and the round-2 inventory, and report only new findings. First I'm loading the binding decisions, closed items, and the ported surface.Round-2 defects are recorded as fixed. I'll check what the green gates already cover, then look for behavior and idiom gaps they miss.The remaining cores still need a differential against the pinned oracle. I'll read those lab and upstream files and only file a finding when the difference is new and observable.### grok-3-1
- file: scratchpad/effected/npm/ReleaseAgeGate.ts:133
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; D5; D11   evidence: `matchesExclude` calls `patterns.some` at line 133. `combine` calls `contributions.map` and `.filter` at lines 221–223 and `contributions.flatMap` at line 225. `filterVersions` calls `versions.filter` at line 328. `effect/Array` `some` delegates to the receiver's `some`; `map`, `filter`, and `flatMap` match these dense arrays. `NoNativeRuntime.ts` flags only `Array.from`/`isArray`/`of` (lines 68 and 459–460) and hotspot `.sort` (line 463). `STRING_METHODS` does not include these calls. `preferEffectArray` is absent from `tsconfig.base.json` `diagnosticSeverity`, so its upstream default is off. Round 2 closed `Str.includes` at line 102 and the `HashSet`/`A.sort` exclude path; these four calls remain. The recorded `effect-first` deviation covers string helpers and `Hex.encode`, not these sites.
- failure: Release-age matching, age merging, exclude collection, and version filtering still use native array methods. EF-5 requires `effect/Array`, and the green tsgo and native-runtime gates do not see these calls.
- fix: Replace them with `A.some`, `A.filterMap` (keep the `P.isNumber` and `Number.isFinite` clamp), `A.flatMap`, and `A.filter`. Leave the two-pointer scan, `Math.max`, and the `DateFromString` path unchanged.

### grok-3-2
- file: scratchpad/effected/npm/Manifest.ts:314
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; D5; D11   evidence: `needsResolution` calls `DependencyField.literals.some` at line 314 and `R.values(section).some` at line 318. `A.some` is `self.some(predicate)`. The same native-runtime and tsgo limits as grok-3-1 apply. Upstream uses the same `.some` shape; this is the remaining Effect helper substitution, not a resolution-result change. The `__proto__` `fromEntries` fixes stay as recorded.
- failure: The manifest fast-path still branches through native `Array.some` after the record values are already in hand.
- fix: Import `effect/Array` as `A` and use `A.some` for both the field list and `R.values(section)`.

### grok-3-3
- file: scratchpad/effected/npm/PackageManagerCache.ts:111
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; D5; D11   evidence: `under` is `[home, ...parts].join(windows ? "\\" : "/")`. `effect/Array` `join` is `fromIterable(self).join(sep)`, and `fromIterable` returns an array input unchanged, so the path string is the same. Native-runtime does not flag instance `.join`. This is outside the recorded cache-constructor coverage deviation.
- failure: Default cache paths are still joined with the native array method.
- fix: Replace the call with `A.join([home, ...parts], windows ? "\\" : "/")`.

REQUIRED: 3
BACKLOG: 0

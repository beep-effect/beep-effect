# Current shape

Provisional native P2 design for stable `r3-tooling-bun-report-drift-flags`, correcting D1 to qualified 4/3. Frozen source: HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. The R28 R–Z primary footer's blanket retention requires independent correction; P3 remains pending.

`packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/BunResolver.ts:538–568` exports `buildBunReport`. It constructs the complete drift-item array at `:543–554`, then declares actual Boolean values `hasDrift` and `hasInternalMismatch` at `:556–557`. The report status at `:560` is based on their OR. The owner qualifies because these are two genuine sibling computed Booleans; required strings and the required array do not manufacture inventory axes.

`BunVersionState` (`:325–344`) retains two full required strings, with existing empty-string defaults, and five complete `Option<string>` payloads: Vercel install/build versions, current/expected archive checksum, and latest version. None and Some(empty string) remain distinct; no input is narrowed by this design.

# Cardinality gap

For `[hasDrift, hasInternalMismatch]`, representable cardinality is 4 and legal cardinality is 3: FF, TF and TT. FT is impossible. `requiredBunVersionDrift` at `:504–513` returns None exactly when its current and expected raw strings are equal. The first two items at `:544–545` compare both pins with the same target (the package-manager comparison adds the same `bun@` prefix to both sides). If the two pins differ, at least one comparison fails and `items` is nonempty. This holds for every full string value, not only valid semver; `latest` selection cannot break the implication.

Existing supported witnesses are equal local pins with no other drift (`test/version-sync-effect.test.ts:347–357`, FF), equal pins with Vercel/checksum drift (`:294–312`, TF), and unequal pins (`:264–291`, TT). The fixtures call the exported constructor and report builder. The semver target-selection behavior at `BunResolver.ts:296–315` remains exact.

# Target schema

Reuse the existing `VersionCategoryStatus` LiteralKit (`VersionSync.schemas.ts:122–187`) and its `VersionCategoryStatusThunk` helpers. Derive the status directly from the existing drift-item array:

```ts
status: A.match(items, {
  onEmpty: VersionCategoryStatusThunk.ok,
  onNonEmpty: VersionCategoryStatusThunk.drift,
}),
```

Delete both Boolean locals and the redundant mismatch comparison. This exact existing pattern is already used by `NodeResolver.ts:253–256`, `BiomeResolver.ts:241–244`, and `EffectResolver.ts:247–250`. Do not add a second drift vocabulary or a tagged wrapper. The status taxonomy is `literalkit`, reusing the existing four-value domain; Bun's builder continues to emit only ok/drift, while unpinned/error remain legal elsewhere.

# Migration inventory

| Location | Required migration or preservation |
| --- | --- |
| `BunResolver.ts:556–563` | Delete paired Booleans and derive the status using the existing array matcher and status thunks. |
| `BunResolver.ts:296–344,504–554` | Preserve target selection, all constructor/decoding defaults and Options, each drift item and its order, raw string comparisons, and checksum-pair behavior. |
| `internal/services/ResolverService.ts:19,59–72` | Keep the exported builder signature and Bun-resolution error fallback; the report is unchanged. |
| `VersionSync.schemas.ts:205–219`; `VersionSync.render.ts:69–75` | Keep the Bun report case, complete item payloads, latest/error Options and status rendering. |
| `test/version-sync-effect.test.ts:193–357,417–433` | Preserve constructor/codec tests, direct builder fixtures and updater use of the report. |
| `src/test/VersionSync.test-kit.ts:10`; `package.json:66` | Preserve test facade and direct command-subpath exposure. |

Exhaustive source occurrence search across packages and apps found the production invocation in ResolverService and direct tests in `version-sync-effect.test.ts`; the two local Boolean identifiers have no other consumer. Module exports broaden callable exposure but do not create an additional supported Boolean tuple: the string-equality implication holds for every input accepted by the exported builder.

# Guard-deletion accounting

Remove two Boolean locals, one duplicate raw pin-inequality comparison, and one OR. Replace the Boolean matcher with the already used array matcher; preserve both status branches. Delete zero invalid-state guards and zero error paths. Preserve all five drift-item calculations, the Option handling and semantic-version parser. Array emptiness is still needed to derive report status, but is not an invented member of the audited carrier.

# Encoded-side impact

Tier 1, derived/internal. The Boolean locals are never encoded. `BunVersionState`, `VersionCategoryReport` and `VersionSyncReport` retain all accepted inputs and encoded output fields, category/status literals, item ordering, full current/expected payloads and omission/Option semantics. No exported decoded signature changes. Downstream reporting and updating continue to receive the exact same report values.

# Test impact

Retain the existing FF/TF/TT fixtures and add a bounded assertion that equal pins with a newer `latest` also produce drift. Keep the direct builder and updater tests, checksum missing/present pairs, empty defaults, and semver/prerelease behavior. A property over the existing complete `BunVersionState` schema can establish observational equality of the old and new report, but generic arbitrary construction is not the source of the legality proof. Run required CLI package verification only during implementation. No test or package command ran for this draft.

# Risk

The main risk is deleting item construction because it looks redundant with the mismatch flag; only the flag calculation is redundant. Both full pin values and all non-pin drift causes must remain. No source, current design, canonical status or archive is changed by this provisional P2 document.

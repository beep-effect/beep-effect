I'll review the semver port at that commit against the pinned upstream oracle and the binding decisions, and report findings only. First I'm loading the review laws, the port ledger, and the module surface.### grok-1-1
- file: scratchpad/effected/semver/SemVer.ts:607
- class: bug   severity: required
- standard: D9 and section 14 (different error tag). Evidence: upstream `packages/semver/src/SemVer.ts` `overflow` throws `new Error(message, { cause })`. The port throws `SemVerBumpOverflowError` (`_tag: "SemVerBumpOverflowError"`, stored `message` field) from `SemVer.ts:600`. No `schemaNumber`, `lazyEffect`, or D15 rule forces that class: the upstream test's `(e as Error)` cast is removed by `assert.instanceOf(e, Error)`, which narrows. `KNOWLEDGE.md` (carried upstream convention) says tagged errors take a `message` getter from structured fields and never store a preformatted message. README Port notes and the ledger both say deviations: none.
- failure: `SemVer.of(Number.MAX_SAFE_INTEGER, 0, 0).bump.major()` throws a tagged schema error instead of a plain `Error`. `name`, `_tag`, and `constructor` differ. `scratchpad/test/semver/SemVer.test.ts:238` was edited from `assert.instanceOf(e, Error)` to `assert.instanceOf(e, SemVerBumpOverflowError)`, so the suite now locks the new tag in. The class is also a new file export and is not listed under Added exports.
- fix: Delete `SemVerBumpOverflowError`. Restore `throw new Error(\`SemVerBump invariant violated: bumping "${component}" would exceed Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER})\`, { cause })`. In the test, use `assert.instanceOf(e, Error)` and `assert.isDefined(e.cause)`, and drop the `SemVerBumpOverflowError` import.

### grok-1-2
- file: scratchpad/effected/semver/VersionCache.ts:82
- class: docs   severity: backlog
- standard: effect-tsgo `lazyEffect` (TS377091) plus section 14. Evidence: upstream `VersionCacheShape` types `versions`, `latest`, and `oldest` as `() => Effect`. The port types them as `Effect` and builds them with `Effect.suspend` (`VersionCache.ts:204`). Upstream tests call `cache.latest()` (`__test__/VersionCache.test.ts:61`); the port calls `cache.latest` (`scratchpad/test/semver/VersionCache.test.ts:63`). README and the ledger record no deviation.
- failure: `yield* cache.latest()`, `cache.oldest()`, and `cache.versions()` no longer match the service. The behavior of each query is unchanged, and `lazyEffect` forces the property shape, but the call-shape change is an unrecorded deviation.
- fix: Keep the property shape. Add a `law:lazyEffect` row to the ledger `deviations` and to README Port notes → Deviations, citing the three adjusted call sites in `VersionCache.test.ts`.

### grok-1-3
- file: scratchpad/effected/semver/VersionDiff.ts:54
- class: docs   severity: backlog
- standard: effect-tsgo `schemaNumber` plus section 14. Evidence: upstream `VersionDiff.major` / `minor` / `patch` are `Schema.Number`, and `InvalidVersionError.position`, `InvalidComparatorError.position`, and `InvalidRangeError.position` are `Schema.optionalKey(Schema.Number)`. The port uses `S.Finite` (`VersionDiff.ts:54`, `SemVer.ts:36`, `Comparator.ts:26`, `Range.ts:31`). `nonNegativeInteger` is not a behavior change: `isInt` plus `isBetween` already rejected non-finite components. Deviations are recorded as none.
- failure: `VersionDiff.make` and the three error `position` fields now reject `NaN`, `Infinity`, and `-Infinity`, which upstream `Schema.Number` accepted. Parser positions and `VersionDiff.between` only produce finite numbers, so the suites do not show it.
- fix: Keep `S.Finite`. Record one `law:schemaNumber` deviation naming those four fields.

REQUIRED: 1
BACKLOG: 2

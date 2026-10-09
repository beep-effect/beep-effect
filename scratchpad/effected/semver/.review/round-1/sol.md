### sol-1-1
- file: scratchpad/effected/semver/Range.ts:343
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `Range.simplify` must preserve matching semantics.   evidence: Read-only `bun --no-install -e` probes against both the port and the pinned oracle parsed `">=1.0.0 || >=1.0.0 || <0.5.0"`. The original range matches `1.2.3`; `Range.simplify` returns `"<0.5.0"`, which rejects it.
- failure: The filter removes each duplicate comparator set because the other duplicate contains it. When an unrelated set survives, the empty-result fallback does not restore the deleted matches. Simplification therefore loses an entire branch of the union.
- fix: Remove strict subsets, but retain one representative of mutually containing sets—for example, use the original index to break equivalence ties. Add the duplicate-plus-unrelated-set regression and record the verified upstream-bug deviation under section 14.

### sol-1-2
- file: scratchpad/effected/semver/Range.ts:273
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; intersection membership must satisfy `intersection.test(v) === (a.test(v) && b.test(v))`.   evidence: In both the port and the pinned oracle, for `a = ">=1.0.0-alpha"`, `b = "<2.0.0"` and `v = "1.0.0-beta"`, read-only probes returned `a.test(v) = true`, `b.test(v) = false`, and `Range.intersectResult(a, b).success.test(v) = true`.
- failure: Concatenating comparator sets combines their prerelease tuple permissions. A prerelease comparator from one operand grants permission that the other operand does not grant, so the resulting intersection accepts versions rejected by an operand.
- fix: Preserve both operands’ prerelease admission restrictions when constructing each intersection candidate. Separate stable bounds from prerelease branches and retain a prerelease tuple only when both source sets admit it. Add the counterexample as a regression and record the upstream-bug deviation.

### sol-1-3
- file: scratchpad/effected/semver/Range.ts:483
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the documented conservative subset approximation permits false negatives, not false positives.   evidence: Both the port and the pinned oracle return `true` for `Range.isSubset(parse(">=1.0.0-alpha <2.0.0"), parse(">=0.0.0 <2.0.0"))`. The first range accepts `1.0.0-beta`; the second rejects it. Simplifying their union also changes that version’s membership from `true` to `false`.
- failure: `isComparatorSetSubset` checks comparator implication without checking prerelease tuple admission. It falsely declares containment and allows `simplify` to discard a branch that contributes valid prerelease matches.
- fix: Before returning containment, conservatively verify that the superset admits every potentially matching prerelease tuple admitted by the subset. Return `false` when that cannot be established. Retain the existing allowance for conservative false negatives, add this regression, and record the upstream-bug deviation.

### sol-1-4
- file: scratchpad/effected/semver/Range.ts:445
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `Range.intersectResult` promises `UnsatisfiableConstraintError` when no version satisfies the intersection.   evidence: Read-only probes against both implementations returned `Success` for intersecting `">1.0.0"` with `"<1.0.1"`. No stable version lies strictly between these adjacent patch versions, and neither comparator admits prereleases.
- failure: Comparing lower and upper endpoints establishes that the bounds are ordered, but does not establish that an admissible SemVer exists between them. The satisfiability check treats the version domain as dense and returns a successful range that matches no version.
- fix: Check for an actual admissible witness within the bounds: the least possible stable version and any prerelease tuples allowed by the set. Reject the candidate when neither can satisfy every comparator. Add the adjacent-patch regression and record the upstream-bug deviation.

### sol-1-5
- file: scratchpad/effected/semver/Range.ts:136
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `Range.parseResult` exposes parse failure as `InvalidRangeError`, and Effect-first EF-1/EF-3 require boundary validation failures to remain typed.   evidence: In both the port and the pinned oracle, `Range.parseResult("^9007199254740991.0.0")` and `Range.parseResult("~1.9007199254740991.0")` throw `Schema validation failed`. `Effect.runSyncExit(Range.parse("^9007199254740991.0.0"))` contains that defect instead of an `InvalidRangeError`.
- failure: The input components pass the safe-integer grammar, but desugaring increments a component beyond `Number.MAX_SAFE_INTEGER`. The subsequent `SemVer.make` throws outside the declared Result failure channel. Callers handling `InvalidRangeError` cannot recover through the advertised API.
- fix: Validate desugared comparator parts through a non-throwing schema decoder and translate failure into `InvalidRangeError` before constructing the range. Add boundary cases for incrementing sugar forms and record the upstream-bug deviation.

### sol-1-6
- file: scratchpad/effected/semver/Range.ts:96
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the `Range.FromString` codec must preserve the represented range when encoding and decoding supported model values.   evidence: Read-only `S.encodeUnknownResult`/`S.decodeUnknownResult` probes reproduced both cases in the port and pinned oracle: `Range.make({ sets: [] })` encodes as `""`, then changes from rejecting `1.0.0` to accepting it; `Range.make({ sets: [[]] })` also encodes as `""`, then changes from accepting `1.0.0-alpha` to rejecting it.
- failure: The schema accepts distinct empty structures whose matching semantics differ, while the formatter serializes both to the parser’s stable-only wildcard representation. Successful serialization silently changes the constraint.
- fix: Encode the empty union with an explicitly unsatisfiable expression such as `"<0.0.0-0"`. For empty comparator sets whose unrestricted prerelease semantics cannot be represented by the string grammar, return a typed encoding failure rather than silently emit `""`. Add both round-trip regressions and record the upstream-bug deviation.

### sol-1-7
- file: scratchpad/effected/semver/SemVer.ts:143
- class: schema   severity: required
- standard: D5; operator revision step 4, “Every schema … takes its identity from the … IdentityComposer”; `standards/effect-first-development.md` EF-12 and EF-12c.   evidence: A read-only runtime probe found `SemVer.ExactVersionString.ast.annotations === undefined` and its custom check’s annotations undefined. `SemVer.PinnableVersionString` at line 164 has the same omissions. The owning `SemVer` class has composer metadata, but these independently constructed string schemas do not inherit it.
- failure: Two public schemas remain outside the required identity scheme, and their reusable custom checks lack the required identifier, title and description. The green gates have missed these static schema members.
- fix: Attach `$I.annoteSchema(...)` metadata to both string schemas and composer-derived identifier/title/description metadata to each `S.makeFilter`. Preserve their current string types and validation behavior.

### sol-1-8
- file: scratchpad/effected/semver/VersionCache.ts:82
- class: docs   severity: backlog
- standard: D9 and section 14 deviation records; D2 added-export inventory. Classified as backlog under the explicit instruction that documentation findings are deferred.   evidence: Read-only differential probes showed that upstream cache queries are functions while the port’s `versions`, `latest` and `oldest` are Effect objects; overflow errors change from native `Error` to `SemVerBumpOverflowError`; and decoding an error with `position: Infinity` changes from success to failure. The module README says “Deviations: None” and “Added exports: None”; ledger row `w1-semver` has empty `deviations` and `exportsAdded`.
- failure: The port records neither its law-forced public contract changes nor the newly exported overflow error. A subsequent reviewer or consumer cannot distinguish intentional changes from accidental divergence using the required records.
- fix: Record the cache query change with `lazyEffect`, numeric narrowing with `schemaNumber`, and the overflow error change with the native-Error law, citing the adjusted tests. List `SemVerBumpOverflowError` in the added-export inventory and README Port notes.

### sol-1-9
- file: scratchpad/effected/semver/Comparator.ts:95
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements and Carrier policy; explicitly deferred S2.   evidence: The source retains `@remarks` at this line and legacy `@example` at line 101. The same carriers occur throughout the public classes. Apart from the new overflow error, the public declarations also lack canonical `@category` and `@since 0.0.0` tags.
- failure: The carried documentation does not satisfy the required JSDoc section grammar and export metadata. This is deferred conversion work, not a failure of the completed S1 gates.
- fix: During S2, preserve the existing prose and examples while converting them to titled `**Example** (Title)` and appropriate `**Details**`/`**Gotchas**` sections; add canonical categories and `@since 0.0.0` to owning declarations.

### sol-1-10
- file: scratchpad/test/semver/Range.test.ts:89
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5 and `.patterns/testing-patterns.md`, “Choose assertions by value, not by tester”; explicitly deferred S3.   evidence: Lines 89–90 compare Option containers with `assert.deepStrictEqual`, and line 91 asserts `O.isNone(...)`. Equivalent container assertions remain in the SemVer and VersionCache suites.
- failure: These tests do not use the required canonical Option assertion helpers, so the deferred test-canon criterion remains unmet.
- fix: Use `assertSome` with the expected payload and `assertNone` from `@effect/vitest/utils`, preserving each existing assertion’s meaning.

### sol-1-11
- file: scratchpad/test/semver/Range.test.ts:51
- class: test   severity: backlog
- standard: D10 property floor and S3; explicitly deferred by operator order.   evidence: The Range codec has only a fixed-example round trip. Searching the scoped tests found just two property registrations—SemVer and Comparator round trips—and no `fcRuns` usage. VersionDiff’s round trip is also a fixed example.
- failure: The module lacks the required generated codec/parser/formatter properties and repository-controlled run floors. The fixed Range example does not exercise the empty structures that change meaning through serialization.
- fix: During S3, add schema-derived round-trip properties for the remaining schemas/codecs and parser/formatter fidelity and idempotence properties. Apply `{ arbitrary: fcRuns(n) }` to property registrations, retaining meaningful assertions and the regressions identified above.

REQUIRED: 7
BACKLOG: 4
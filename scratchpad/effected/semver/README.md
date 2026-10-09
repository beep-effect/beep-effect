# semver (lab port of @effected/semver)

[![npm](https://img.shields.io/npm/v/@effected%2Fsemver?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/semver)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Strict SemVer 2.0.0 versions, ranges and comparators as Effect schemas. `SemVer`, `Comparator` and `Range` are `Schema.Class`es, so a version is a validated value with methods on it rather than a string you re-parse at every call site, and each one carries a `FromString` codec that decodes the canonical form and encodes back to it. Parsing is strict: no `v` prefix, no `=` prefix, no leading zeros on numeric identifiers, no partially consumed input. Every failure is a tagged error carrying the offending string and the character position where the grammar gave up. Zero runtime dependencies, no IO.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/semver

The version parsers most projects reach for are lenient by default. They coerce `v1.2.3` and `=1.2.3` into a version, then hand back `null` — or throw — when they finally decide something is wrong, leaving you to reconstruct what failed and where. Once parsed, the result is a bag of numbers you stringify to store and re-parse to compare. This package inverts that. The class *is* the schema, so a version field anywhere in your own schemas decodes to a real `SemVer` and re-encodes to its canonical string with no glue code, and the operations you want live on the value you already have.

Failures are `Schema.TaggedError` values you route with `Effect.catchTag`, each one structured rather than stringly: `InvalidVersionError` carries `input` and `position`, `UnsatisfiedRangeError` carries the range *and* every version that was available to match against it. The strictness is deliberate. Coercion is a decision about your data taken inside a library you did not write, and it is where version bugs hide. `Range.intersect` holds the same line: intersecting `^1.0.0` with `^2.0.0` does not quietly hand back a range that matches nothing, it fails with `UnsatisfiableConstraintError` carrying both constraints. Nothing here repairs your input behind your back.

## Install

```bash
npm install @effected/semver effect
```

```bash
pnpm add @effected/semver effect
```

Requires Node.js >=24.11.0.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`effect` v4 is the only peer dependency, and it is the only dependency of any kind — no parser, no polyfill, no platform package rides in behind it. There is no IO here, so there is nothing to provide at the edge either: the whole surface runs under `Effect.runSync`, apart from `VersionCache`, which brings its own layer.

## Quick start

Parse, bump, compare, and test a version against a range:

```ts
import { Range, SemVer } from "@effected/semver";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const version = yield* SemVer.parse("1.2.3");
  const next = version.bump.minor();
  const range = yield* Range.parse("^1.0.0");
  return [next.toString(), range.test(version), version.gt(next)] as const;
});

console.log(Effect.runSync(program));
// => ["1.3.0", true, false]
```

Instance methods are the canonical API. Cross-cutting operations are dual statics on the owning class, so `SemVer.gt(a, b)` and `a.pipe(SemVer.gt(b))` both typecheck and mean the same thing.

## Versions

`SemVer`'s fields are validated in the schema — non-negative safe integers for the components, well-formed prerelease and build identifiers — so `SemVer.make` cannot produce an invalid version. Use `SemVer.parse` for a string and `SemVer.of(1, 2, 3)` for the positional form.

```ts
import { SemVer } from "@effected/semver";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const stable = yield* SemVer.parse("1.0.0");
  const rc = yield* SemVer.parse("2.0.0-rc.1");
  return [
    stable.bump.prerelease("beta").toString(),
    rc.bump.prerelease().toString(),
    rc.isPrerelease,
    SemVer.truncate(rc, "prerelease").toString(),
  ] as const;
});

console.log(Effect.runSync(program));
// => ["1.0.1-beta.0", "2.0.0-rc.2", true, "2.0.0"]
```

Bumping is node-semver compatible: a stable version starts a prerelease of the *next* patch, switching identifiers resets the counter, and a trailing numeric identifier increments. Build metadata never survives a bump.

Equality follows the spec rather than the string. `Equal.equals` ignores build metadata (§10) and includes prerelease identifiers (§11), and `SemVer` overrides `[Hash.symbol]` to agree with that, so two versions differing only in build metadata are one value in a `HashSet` and one slot in `VersionCache`. `SemVer.Order` sorts by precedence; `SemVer.OrderWithBuild` adds a lexical tiebreak on build metadata when you need a total order over distinct version strings.

Collection operations are statics: `sort`, `rsort`, `max`, `min`, `groupBy` (by major, minor or patch), `latestByMajor` and `latestByMinor`.

## Ranges and comparators

A `Range` is a union (OR) of comparator sets (AND). Parsing accepts the node-semver dialect — hyphen ranges, X-ranges, tilde, caret and `||` — desugars it into primitive comparators and normalizes the result. A `Comparator` is one operator applied to one complete version, with no wildcards and no sugar; that vocabulary belongs to `Range`.

```ts
import { Range, SemVer } from "@effected/semver";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const caret = yield* Range.parse("^1.0.0");
  const floor = yield* Range.parse(">=1.5.0");
  const both = yield* Range.intersect(caret, floor);
  const versions = [SemVer.of(1, 2, 0), SemVer.of(1, 6, 0), SemVer.of(2, 0, 0)];
  return [both.test(SemVer.of(1, 6, 0)), Range.filter(versions, caret).map((v) => v.toString())] as const;
});

console.log(Effect.runSync(program));
// => [true, ["1.2.0", "1.6.0"]]
```

Matching implements node-semver's prerelease restriction: a prerelease version satisfies a set only when some comparator in that set carries a prerelease on the same `major.minor.patch` tuple. That is what keeps `^1.2.3` from unexpectedly matching `1.2.4-alpha`.

The range algebra is `union`, `intersect`, `isSubset`, `equivalent` and `simplify`. `isSubset` is a deliberate conservative approximation: it can report `false` for a range that is technically a subset, when the sub-range straddles comparator-set boundaries in the sup-range. False negatives are safe, because all they do is decline a simplification.

## Comparing two versions

`VersionDiff.between(a, b)` classifies a change and carries the signed component deltas. It is a `Schema.TaggedClass`, so a diff serializes as cleanly as it computes.

```ts
import { SemVer, VersionDiff } from "@effected/semver";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const from = yield* SemVer.parse("1.2.3");
  const to = yield* SemVer.parse("2.0.0");
  const diff = VersionDiff.between(from, to);
  return [diff.type, diff.major, diff.toString()] as const;
});

console.log(Effect.runSync(program));
// => ["major", 1, "major (1.2.3 → 2.0.0)"]
```

`type` names the highest-precedence field that differs: `"major"`, `"minor"`, `"patch"`, `"prerelease"`, `"build"` or `"none"`.

## Version cache

`VersionCache` is a `Context.Service` over a sorted, deduplicated set of versions — pure state in a `Ref`, no IO. Reach for it when you hold a list of published versions and a range to resolve against them.

```ts
import { SemVer, VersionCache } from "@effected/semver";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const cache = yield* VersionCache;
  yield* cache.load([SemVer.of(1, 0, 0), SemVer.of(1, 4, 2), SemVer.of(2, 0, 0)]);
  const latest = yield* cache.latest;
  const resolved = yield* cache.resolveString("^1.0.0");
  return [latest.toString(), resolved.toString()] as const;
}).pipe(Effect.provide(VersionCache.layer));

console.log(Effect.runSync(program));
// => ["2.0.0", "1.4.2"]
```

The two kinds of absence stay apart. `next` and `prev` fail with `VersionNotFoundError` when the pivot version is not in the cache, and succeed with `Option.none()` when the pivot sits at a boundary. Queries over the whole cache (`versions`, `filter`) never fail and return `[]`.

## Errors

Every failure is a `Schema.TaggedError` routed with `Effect.catchTag`, carrying structured fields. The `message` getter is derived from those fields, never stored.

| Tag | Raised by | Carries |
| --- | --------- | ------- |
| `InvalidVersionError` | `SemVer.parse` | `input`, and the `position` where the grammar failed |
| `InvalidComparatorError` | `Comparator.parse` | `input`, `position` |
| `InvalidRangeError` | `Range.parse`, `VersionCache.resolveString` | `input`, `position` |
| `UnsatisfiableConstraintError` | `Range.intersect` | `constraints`, the ranges whose intersection is empty |
| `EmptyCacheError` | `VersionCache.latest`, `VersionCache.oldest` | nothing; the cache is empty |
| `VersionNotFoundError` | `VersionCache.diff`, `next`, `prev` | `version`, the pivot that is not cached |
| `UnsatisfiedRangeError` | `VersionCache.resolve`, `resolveString` | `range`, plus `available`, the versions that were there to match |

The `FromString` codecs report the same failures through a generic `Schema` parse error carrying the same message, so schema decoding and the `parse` statics never disagree about what is valid.

```ts
import { SemVer } from "@effected/semver";
import { Effect } from "effect";

// A leading `v` is not a version, and nothing here coerces it into one.
const program = SemVer.parse("v1.2.3").pipe(Effect.catch((error) => Effect.succeed(`${error._tag}: ${error.input}`)));

console.log(Effect.runSync(program));
// => "InvalidVersionError: v1.2.3"
```

## Features

- `SemVer` — the version model: schema-validated fields, `parse` / `of` / `make` construction, bumping through `version.bump`, comparison as instance methods and dual statics, spec-correct `Equal` and `Hash`, and the collection statics (`sort`, `max`, `groupBy`, `latestByMajor`, …).
- `Comparator` — a single operator-plus-version constraint, and the primitive that range sugar desugars into.
- `Range` — the node-semver range dialect parsed into normalized comparator sets, with matching (`test`, `filter`, `maxSatisfying`, `minSatisfying`) and algebra (`union`, `intersect`, `isSubset`, `equivalent`, `simplify`).
- `VersionDiff` — the classified difference between two versions with signed component deltas, serializable as a tagged class.
- `VersionCache` — a sorted in-memory version set with range resolution and neighbor navigation, provided by `VersionCache.layer`.
- `SemVer.FromString`, `Comparator.FromString`, `Range.FromString` — codecs between the canonical strings and the models, usable as fields inside your own schemas.
- Seven tagged errors, each carrying the structured payload a caller needs to report what actually went wrong.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/semver` 0.11.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.

# semver — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/semver/CLAUDE.md -->
# @effected/semver

Strict SemVer 2.0.0 versions, ranges and comparators as Effect schemas. First
migrated package and the repo's **DX north star** — when in doubt about API
shape elsewhere, copy what this package does.

**Pure tier:** peer-depends on `effect` only, zero runtime deps, no IO,
`"sideEffects": false`. Never add a filesystem, network or clock dependency
here; a boundary-tier consumer owns that.

**Design doc:** `@./okf/modules/semver.md` — load when
changing the public API, the error set, or the grammar pipeline.

## Public surface

`src/index.ts` is the only re-exporting module. Its full export list:

- `src/SemVer.ts` — `SemVer`, `SemVerBump`, `InvalidVersionError`
- `src/Comparator.ts` — `Comparator`, `InvalidComparatorError`
- `src/Range.ts` — `Range`, `ComparatorSet` (type), `InvalidRangeError`,
  `UnsatisfiableConstraintError`
- `src/VersionDiff.ts` — `VersionDiff`
- `src/VersionCache.ts` — `VersionCache`, `VersionCacheShape` (type),
  `EmptyCacheError`, `VersionNotFoundError`, `UnsatisfiedRangeError`

Layout is module-per-concept, not the kind-based `errors/` + `schemas/` folders
the v3 source repo used; each concept owns its tagged errors. `src/internal/`
holds `grammar.ts` (recursive-descent parser), `desugar.ts`
(caret/tilde/x-range/hyphen), `normalize.ts` and `order.ts` (compare
primitives). Outside `index.ts`, modules import explicitly — no barrels.

## Conventions

- **The class is the schema.** `SemVer`, `Comparator`, `Range` are
  `Schema.Class`; `VersionDiff` is a `Schema.TaggedClass`. Each string form is
  a `static readonly FromString` transformation.
- **No floating functions.** Instance methods are canonical; cross-cutting ops
  are `Fn.dual` statics on the owning class (`SemVer.gt`, `Range.filter`, ...).
- **Construct with `.make()`**, never `new` — `make` runs validation.
  `SemVer.of(1, 2, 3)` is the positional convenience form.
- **Errors** are `Schema.TaggedError` with a `message` getter derived from
  structured fields; never store a preformatted message.
- **`Effect.fn("Name.op")` spans on fallible public boundaries only** — `parse`
  statics, `Range.intersect`, every fallible `VersionCache` method.
- **String-level validity lives on the class too**: `SemVer.isValid` /
  `SemVer.isPinnable` (booleans) and `SemVer.ExactVersionString` /
  `SemVer.PinnableVersionString` (`Schema.String` checks — the type stays
  `string`). All four **reject surrounding whitespace**, deliberately diverging
  from `parseResult`, which trims (matching node-semver): padded input is the
  caller's bug to surface, not this package's to hide, and the padded-input
  tests are the recorded discriminating mutant for a bare-`parseResult`
  rewrite. "Pinnable" additionally excludes build metadata (the corepack pin
  notion). `PinnableVersionString` is consumed **by identity** in
  `@effected/package-json`'s `PackageManager` — do not re-derive it downstream.
- **The sync `Result` form is the primitive; the `Effect` form derives from it.**
  `SemVer.parseResult`, `Range.parseResult`, `Comparator.parseResult` and
  `Range.intersectResult` hold the engine; each `Effect` twin is
  `Effect.fromResult(...)` behind its existing span, so the two cannot drift.
  Never re-derive the grammar on the `Effect` side. Kit convention —
  `@./okf/conventions/sync-primitive-policy.md` and
  `@./okf/decisions/sync-form-named-result.md`. The
  comparison statics (`SemVer.compare`, `Range.satisfies`, ...) are out of
  scope: already plain, total and dual, so a `Result` twin would be dead
  surface.

## Gotchas

- `SemVer.diff` does **not** exist: `VersionDiff` fields reference `SemVer`, so
  a delegating static would cycle (`noImportCycles` is error-level). Use
  `VersionDiff.between(a, b)`.
- `SemVer` overrides **both** `[Equal.symbol]` and `[Hash.symbol]`. Equality
  ignores build metadata (§10), includes prerelease identifiers (§11), and
  `Equal.equals` fast-paths on hash mismatch — the two must agree.
  `VersionCache` dedupe inherits these semantics.
- `prereleaseIdentifier` in `src/SemVer.ts` is **lookahead-free** on purpose:
  the native `Arbitrary` regex compiler rejects lookahead, and
  `Arbitrary.schema(SemVer)` powers the `it.effect.prop` round-trip tests.
- `Range.test` implements node-semver's prerelease restriction — a prerelease
  version matches a set only when some comparator carries a prerelease on the
  same `major.minor.patch` tuple.
- `Range.isSubset` (and thus `equivalent`, `simplify`) is a conservative
  approximation; false negatives are expected and safe. Read the in-source
  remark before "fixing" it.
- `savvy.build.ts` carries a **narrow** api-extractor suppression,
  `{ messageId: "ae-forgotten-export", pattern: "_base" }`, for the heritage
  symbols inline class factories synthesize. Never widen it — four sibling
  packages depend on this precedent staying narrow.

## Test and build

Tests live in `__test__/` (6 files, 243 tests), use `@effect/vitest`, and
assert with `assert.*` — never `expect`. Default to `it.effect`; `VersionCache`
suites use one top-level `layer(VersionCache.layer)(...)` group. Shared cases
live in `__test__/fixtures/`.

```bash
pnpm vitest run packages/semver          # this package's tests
pnpm build --filter @effected/semver     # dev + prod, from the repo root
```

Never run `node savvy.build.ts --target prod` directly: it skips `build:dev`,
emits no `.d.ts`, and leaves a truncated `issues.json` that looks exactly like
a clean gate.


---
<!-- okf/modules/semver.md -->
---
type: Module
title: semver
description: Strict SemVer 2.0.0 versions, ranges and comparators as Effect Schema classes — the kit's DX exemplar.
status: stable
kind: package
resource: ../../packages/semver
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: f3b1091e81939728aa07b86fe07f1a590577d72b90bf9ac820a8379b028efd6b
---

# semver

## Purpose

`@effected/semver` implements strict SemVer 2.0.0 — parsing, comparison, range matching, range algebra, and a version cache — entirely as Effect Schema classes. It is the repository's DX north star: when another package's API shape is in question, this package is the precedent to copy.

## Tier and dependency posture

[Pure tier](../glossary/library-tier.md): `effect` is the only peer, no IO anywhere, `"sideEffects": false`, and no cross-`@effected` edges. The dependency direction is one-way — downstream packages depend on semver, never the reverse.

## Module layout

Module-per-concept: one file per domain concept (`SemVer.ts`, `Comparator.ts`, `Range.ts`, `VersionDiff.ts`, `VersionCache.ts`), each owning its own tagged errors rather than kind-based `errors/`/`schemas/` folders. `src/index.ts` is the only re-exporting module. `src/internal/` holds the parsing pipeline: `grammar.ts` (recursive descent), `desugar.ts` (caret/tilde/x-range/hyphen), `normalize.ts` (comparator sort and build-metadata-ignoring dedupe), and `order.ts` — a module that exists solely to break a cycle, since both `SemVer` and `Range` need the spec's compare primitives and neither may import the other.

## Public surface

Class-based throughout: instance methods are the canonical form, cross-cutting operations are `Fn.dual` statics on the owning class, and there are no floating functions. Construct via `.make()` (or the positional `SemVer.of`), never `new`, so validation runs.

The class *is* the schema: `SemVer`, `Comparator` and `Range` are plain `Schema.Class` with no `_tag`, because each has a canonical string form via its own `FromString` transformation; `VersionDiff` is the one `Schema.TaggedClass`, the single concept where serialized tag discrimination earns its keep.

String-level validity is a lexically paired surface: `SemVer.isValid` (boolean) pairs with the `ExactVersionString` `Schema.String` check, and `isPinnable` pairs with `PinnableVersionString`; each schema check is refined by its same-stem predicate so the two cannot drift and the pairing is discoverable by name. All four **reject surrounding whitespace**, deliberately diverging from `parseResult`, which trims to match node-semver's constructor — the parser canonicalizes, the predicates answer "is this string, byte for byte, a version?", and padded input is the caller's bug to surface, not this package's to hide. "Pinnable" additionally excludes build metadata, encoding the corepack `<name>@<version>[+<integrity>]` pin notion (the first `+` after the version always begins the integrity component); `PinnableVersionString` is consumed **by identity** in `package-json`'s `PackageManager`, and downstream must never re-derive it.

There is deliberately **no `SemVer.diff`**: `VersionDiff`'s fields reference `SemVer`, so a delegating static on `SemVer` would create an import cycle, and `noImportCycles` is error-level. `VersionDiff.between(a, b)` is the single canonical diff entry point. Grouping (`groupBy`, `latestByMajor`, `latestByMinor`) lives on `SemVer` as pure statics rather than on `VersionCache`, since grouping needs no state and putting it on the service would force a pure operation to require a layer.

`VersionCache` is a `Context.Service` over a `Ref<ReadonlyArray<SemVer>>` kept sorted and deduplicated by SemVer precedence via binary search, with membership and dedupe ignoring build metadata; `VersionCache.layer` is bound once with `Layer.effect` (`Ref` construction is effectful) and requires nothing. Its absence semantics are the load-bearing design decision: "nothing is cached" and "the pivot version is not cached" are typed failures, while "the pivot sits at the boundary" and "no version matched" are `Option` and `[]` respectively — a caller that conflates the two mishandles an empty cache.

## Result is the primitive

The synchronous `Result` form holds the engine and the `Effect` form derives from it: `SemVer.parseResult`, `Range.parseResult`, `Comparator.parseResult` and `Range.intersectResult` run the grammar, and each `Effect` twin is `Effect.fromResult(...)` behind the existing span, so the two cannot drift and synchronous callers never pay for a runtime. This is the kit-wide [sync primitive policy](../conventions/sync-primitive-policy.md); see [semver's Result-is-the-primitive decision](../decisions/semver-result-is-the-primitive.md) for why the comparison statics are deliberately out of scope for a `Result` twin.

## Schema transformations

Each `FromString` is a `Schema.decodeTo` transformation from `Schema.String` to the domain class: decode runs the internal pipeline (grammar → desugar → normalize for ranges), encode is `toString`. One source of truth yields both round-tripping and `Schema.toArbitrary` derivation for property tests. Two constraints on `SemVer`'s field checks are load-bearing: prerelease string identifiers must carry at least one non-digit, so all-numeric identifiers decode as numbers and `FromString` round-trips stay canonical; and the identifier pattern is written **lookahead-free**, because the native `Arbitrary` regex compiler rejects lookahead, which is what makes `Arbitrary.schema(SemVer)` — and therefore the `it.effect.prop` round-trip tests — work at all.

## Errors

Domain errors carry structured `input`/`position` payloads and derive `message` from a getter — never a preformatted string — so a serialized error stays reconstructible. The `FromString` transformations fail with `SchemaIssue.InvalidValue` instead; `SchemaError` never escapes the package. `Range.intersect` carries a typed failure rather than returning an unsatisfiable range, so an impossible constraint set is a failure the caller must handle rather than a value that silently matches nothing. `Range.isSubset` (and therefore `equivalent` and `simplify`) is a conservative approximation — false negatives are expected and safe.

## Equal and Hash semantics

`SemVer` customizes structural equality to ignore build metadata (SemVer §10) while including prerelease identifiers (§11); `VersionCache` dedupe and `Equal.equals` both inherit this. Because `Equal.equals` fast-paths on hash mismatch, the class overrides **both** `[Equal.symbol]` and `[Hash.symbol]` — overriding equality alone silently fails.

## Observability

Named `Effect.fn` spans on the effectful, failure-carrying public boundaries only — the `parse` statics, `Range.intersect`, and every fallible `VersionCache` method. Pure synchronous comparisons, bumps and matching are not instrumented, and internal grammar helpers get no spans. The library is telemetry-agnostic.

## Testing

`@effect/vitest` with `it.effect` as the default mode, tests in `packages/semver/__test__/`. `VersionCache` suites use one top-level `layer(VersionCache.layer)((it) => {...})` group so the layer is built once and memoized rather than provided per test. Round-trip properties run through `it.effect.prop` with `Schema.toArbitrary(SemVer)`, the payoff for the lookahead-free identifier pattern. A node-semver-compatible spec-compliance fixture suite is the safety net for any grammar change.

## Build

Class factories are written inline (`export class X extends Schema.Class<X>("X")({...}) {}`), which synthesizes `_base` heritage symbols API Extractor cannot resolve; `savvy.build.ts` suppresses them narrowly (`ae-forgotten-export` scoped to the `_base` pattern), keeping `dist/prod/issues.json` zero-warning via the `suppressed` bucket. Never widen this suppression — sibling packages depend on this precedent staying narrow.


---
<!-- okf/conventions/sync-primitive-policy.md -->
---
type: Convention
title: Sync-primitive policy
description: A pure kit boundary exposes the sync form as its primitive; the Effect form is derived from it and adds only the tracing span.
status: stable
stale_after: 2027-03-13T00:00:00Z
tags:
  - architecture
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: eec01eebdbcaf466a5ea059f81c63f1681b34db30f4edc8258c69a023b580168
---

# Sync-primitive policy

**Pure computation exposes the sync form as the primitive; the `Effect` form
is derived from it and adds only the tracing span.** This applies to every
pure boundary in the kit, not only the format packages where it was first
noticed — it is the generalized form of the [format-package
convention](format-package-convention.md)'s return-type decision.

## Scope test

A surface is in scope when it is a public boundary that returns `Effect` with
`R = never`, has no async step and does no IO — i.e. the `Effect` wrapper
carries nothing but a span and the error channel.

For those, the `Effect` is a tax: it forces `Effect.runSync` on every
synchronous consumer, and synchronous consumers are real. A lint-staged
handler must be synchronous, and so must a config file evaluated before any
runtime exists.

Out of scope: anything that does IO, anything with an async step, and
anything whose `Effect` is load-bearing for a reason other than the span —
see [where the policy stops](#where-the-policy-stops).

## The derivation

```ts
static parseResult(text: string): Result.Result<A, E> { /* the engine */ }
static readonly parse = Effect.fn("X.parse")((text: string) =>
  Effect.fromResult(X.parseResult(text)),
);
```

Three properties make this cheap and safe. Adding the sync form is purely
additive — the `Effect` signature is unchanged, so no consumer breaks. The
span is preserved, so observability is not traded away. And the two forms
cannot drift, because one is defined in terms of the other rather than
re-deriving the engine.

The derivation direction is the load-bearing half. A package that ships both
forms over two independent copies of the engine has satisfied the letter of
the policy and none of its value: `@effected/yaml` shipped exactly that for a
while, with the `Effect` path calling the composer, the failure records and
the alias budget inline while the sync path called the same three
independently. Fixing the derivation, not adding the surface, was the real
work.

## Why it pays inside Effect too

The payoff is easiest to miss because it looks like a concession to
non-Effect hosts. It is not. `@effected/github`'s `GitTag.latestSemver` is a
single pass over the tag stream, filtering and comparing inside one
`Effect.sync`, because `@effected/semver` ships `parseResult` and `compare`
synchronously. With only the `Effect` forms available, the same operation was
several times longer — one `Effect` per candidate comparison. A sync
primitive on a pure boundary is what lets an effectful consumer keep its own
loop flat.

## Naming: `*Result`, never `*Sync`

The sync form is spelled `*Result`, on three arguments in ascending order of
force:

1. **Precedent.** `*Result` is where the policy started and what the kit's
   own skills name.
2. **Accuracy.** `Sync` names a distinction that does not exist — the
   `Effect` form is also synchronous, which is the entire premise of the
   policy. `Result` names the one thing that actually differs: the return
   type.
3. **`*Sync` is already taken in this kit, for an incompatible meaning.**
   `@effected/workspaces` ships a sync facade family
   (`findWorkspaceRootSync`, `getWorkspacePackagesSync`, `readPackageSync`)
   whose members are genuinely IO-performing functions returning nullables,
   not `Result`s. Within one kit, `*Sync` would mean both "does blocking IO,
   returns a nullable" and "pure computation, returns a `Result`".

The rule holds even where the `Effect` twin is not merely a span.
`@effected/jsonc`'s `JsoncFingerprint.hash` requires core's `Crypto.Crypto`,
so its synchronous twin is not a free derivation — it takes the digest from
the caller — and the accuracy argument above does not strictly apply, since
the `Effect` form really is the effectful one. It is still spelled
`hashResult` (`packages/jsonc/src/JsoncFingerprint.ts:483`), on the
precedent and naming-collision arguments: `Result` is what the kit's readers
have been taught to look for, and `*Sync` would still collide with the
workspaces meaning. A sync twin that needs the caller to supply the platform
is named for its return type like every other one, and takes that platform
as an explicit argument rather than importing `node:*` — the
`TsconfigLoaderSyncOptions` shape
(`packages/tsconfig-json/src/TsconfigLoaderSync.ts:91`) is the worked
example: it carries a `SyncFileSystem` and `SyncPath` supplied by the caller
rather than reaching for `node:fs`/`node:path` itself.

See [sync-form-named-result](../decisions/sync-form-named-result.md) for the
naming decision's alternatives-rejected record.

## Where the policy stops

It applies to the engine, not to every adapter over it.

`@effected/config-file`'s four codecs shape-match the policy and are
deliberately exempt. They do not own their signature — they implement the
`ConfigCodec` interface, whose `Effect` is not a span wrapper but the
polymorphism that makes the seam composable: the error type is generic
precisely so decorator codecs can wrap a codec, widen the error channel and
return a codec. A sync twin would mean a parallel sync interface and a
parallel decorator stack for every decorator. And the synchronous host does
not exist one level down: a codec is consumed by a config-loading pipeline
hosted by an application at startup, already in `Effect` and already reading
files through `FileSystem`. The sync pressure is real one level up, in the
format packages, and that is exactly where the fix belongs.

The second stopping rule is: do not complete the pattern for its own sake.
`@effected/templates` gives only `parse` the `*Result` + `Effect` twin pair,
because only `parse` is a public boundary a consumer would otherwise want as
an `Effect`; its instance methods on an already-parsed document return
`Result`/`Option`/a total value with no `Effect` twin, and adding twins would
mint dead surface.

## Adopters

As of this writing, `grep -rl parseResult packages/*/src` names: `git`,
`github`, `github-actions`, `jsonc`, `jsonl`, `markdown`, `npm`,
`package-json`, `sbom`, `schemastore`, `semver`, `spdx`, `templates`, `toml`,
`workspaces` and `yaml`. Every pure-tier format and grammar package in the
kit is built on this policy, plus the pure cores of some boundary packages;
each package's own documentation names its own primitives.

A missing twin on an in-scope boundary is a review finding, not a
nice-to-have — the policy is also stated in the kit's own Effect
observability guidance so a reviewer meets it without reading this document.


---
<!-- okf/decisions/sync-form-named-result.md -->
---
type: Decision
title: "The sync form is named `*Result`, never `*Sync`"
description: "The kit spells a pure boundary's synchronous twin `*Result`, reserving `*Sync` for genuinely IO-performing sync facades."
status: draft
tags:
  - architecture
  - dx
  - compat
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 53744903cc1e476aac52cab446147c5fc0a223e67f898a3a6b2deb519002d218
---

# The sync form is named `*Result`, never `*Sync`

## Context

The [sync-primitive policy](../conventions/sync-primitive-policy.md)
established that a pure kit boundary derives an `Effect` form from a
synchronous primitive. Naming that primitive needed a single answer, chosen
before it shipped on published surfaces across many packages.

## Decision

The sync form is spelled `*Result`, never `*Sync`, on three arguments in
ascending order of force:

1. **Precedent.** `*Result` is where the policy started and what the kit's
   own skills already name.
2. **Accuracy.** `Sync` names a distinction that does not exist — the
   `Effect` form in scope for this policy is also synchronous (`R = never`,
   no async step, no IO), which is the entire premise of the policy.
   `Result` names the one thing that actually differs between the two forms:
   the return type.
3. **`*Sync` is already taken in this kit, for an incompatible meaning.**
   `@effected/workspaces` ships a sync facade family
   (`findWorkspaceRootSync`, `getWorkspacePackagesSync`, `readPackageSync`)
   whose members are genuinely IO-performing functions returning nullables,
   not `Result`s. Within one kit, `*Sync` would mean both "does blocking IO,
   returns a nullable" and "pure computation, returns a `Result`" —
   indistinguishable from the name alone.

The rule holds even where the `Effect` twin is not merely a span wrapper.
`@effected/jsonc`'s `JsoncFingerprint.hash` requires core's `Crypto.Crypto`,
so its synchronous twin, `hashResult`
(`packages/jsonc/src/JsoncFingerprint.ts:483`), is not a free derivation — it
takes the digest from the caller instead of the service. Argument 2 does not
strictly apply here, since the `Effect` form really is the effectful one, but
arguments 1 and 3 still hold: `Result` is what the kit's readers have been
taught to look for, and `*Sync` would still collide with the workspaces
meaning. A sync twin that needs the caller to supply the platform is named
for its return type like every other one, and takes that platform as an
explicit argument rather than importing `node:*` — the
`TsconfigLoaderSyncOptions` shape
(`packages/tsconfig-json/src/TsconfigLoaderSync.ts:91`), carrying a
consumer-supplied `SyncFileSystem` and `SyncPath`, is the worked example.

This decision is the [format-package
convention](../conventions/format-package-convention.md)'s naming decision
generalized past formatting: `PackageJsonFormat.sortValue` and
`.formatToString` name their own shapes rather than borrowing `*Result`,
because they are total, not fallible-and-sync; `*Result` names the fallible
case specifically.

## Alternatives rejected

**`*Sync`.** Rejected on the naming-collision argument above:
`@effected/workspaces`'s existing sync facade family already uses `*Sync` for
a different contract (real IO, nullable return), and reusing the suffix for
"pure, `Result`-returning" would make the name lie about one of the two
meanings depending on which package a reader last read.

**A generic wrapper name unrelated to the return type, such as `*Pure`.**
Rejected as strictly less useful than naming the return type directly:
`Result` tells a reader exactly what to expect from the call, where `Pure`
only tells them what the call is not.

## Consequences

Every pure boundary's synchronous twin in the kit is discoverable by grepping
for the `*Result` suffix, and that grep is stable because `*Sync` is reserved
for a different, IO-performing contract. A package introducing a new
IO-performing synchronous facade uses `*Sync`; a package deriving a
synchronous primitive under the [sync-primitive
policy](../conventions/sync-primitive-policy.md) uses `*Result` regardless of
whether the derivation is free or takes an explicit platform argument.
